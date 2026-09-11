import csv
import random
from django.db import models
from django.utils import timezone
from django.http import HttpResponse
from rest_framework import viewsets, status, permissions, generics, serializers
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import (
    User, Faculty, Invitation, Course, CourseUnit, Application, Exam, Question, 
    ExamAttempt, Test, TestQuestion, TestAttempt, ClassContent, AttendanceSession, AttendanceRecord,
    ClassTimetable, ExamTimetable, SystemLog, ProctoringSetting, log_system_event,
    TemporaryClearance, QuestionBank, QuestionBankItem, ProctorSnapshot
)
from .serializers import (
    UserSerializer, UserCreateSerializer, AdminUserSerializer, FacultySerializer,
    InvitationSerializer, CourseSerializer, CourseUnitSerializer, ApplicationSerializer, ApplicationReviewSerializer,
    ExamSerializer, QuestionLecturerSerializer, QuestionStudentSerializer, ExamAttemptSerializer,
    TestSerializer, TestQuestionLecturerSerializer, TestQuestionStudentSerializer, TestAttemptSerializer,
    ClassContentSerializer, AttendanceSessionSerializer, AttendanceRecordSerializer,
    ClassTimetableSerializer, ExamTimetableSerializer, SystemLogSerializer, ProctoringSettingSerializer,
    TemporaryClearanceSerializer, QuestionBankSerializer, QuestionBankItemSerializer, ProctorSnapshotSerializer
)

from .permissions import IsAdmin, IsDVC, IsDean, IsFacultyAdmin, IsRegistrar, IsLecturer, IsStudent, IsStaffUser, IsExecutiveReadOnly
from .clearance import fetch_external_cleared_students, check_student_clearance

def authenticate_token_param(request):
    if not request.user or not request.user.is_authenticated:
        token_str = request.query_params.get('token')
        if token_str:
            try:
                from rest_framework_simplejwt.tokens import AccessToken
                validated_token = AccessToken(token_str)
                user_id = validated_token['user_id']
                user = User.objects.get(id=user_id)
                request.user = user
            except Exception:
                pass

# 1. Custom JWT Token Auth to return role & profile info directly on login
class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        username_input = attrs.get(self.username_field, '').strip()
        password = attrs.get('password')

        # Match user by reg_number, username, or email
        user_obj = User.objects.filter(
            models.Q(reg_number__iexact=username_input) |
            models.Q(username__iexact=username_input) |
            models.Q(email__iexact=username_input)
        ).first()

        if not user_obj:
            for s in User.objects.filter(role='student'):
                if s.registration_number and s.registration_number.upper() == username_input.upper():
                    user_obj = s
                    break

        if user_obj:
            if user_obj.role == 'student':
                student_reg = (user_obj.reg_number or user_obj.registration_number or '').upper()
                if username_input.upper() != student_reg:
                    raise serializers.ValidationError({
                        "detail": f"Students must log in using their official Registration Number (e.g. {student_reg or '2026/CIU/FST/001'}). Username login is not permitted for students."
                    })
            attrs[self.username_field] = user_obj.username

        data = super().validate(attrs)
        clearance_info = check_student_clearance(self.user)

        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'email': self.user.email,
            'role': self.user.role,
            'first_name': self.user.first_name,
            'last_name': self.user.last_name,
            'reg_number': self.user.reg_number or self.user.registration_number,
            'registration_number': self.user.registration_number,
            'tuition_paid_percentage': clearance_info['tuition_paid_percentage'],
            'is_exam_cleared': clearance_info['is_exam_cleared'],
            'is_test_cleared': clearance_info['is_test_cleared'],
            'clearance_source': clearance_info['source'],
            'must_change_password': self.user.must_change_password
        }
        log_system_event(self.user, f"User Login Success ({self.user.role})", level="INFO")
        return data

class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer

# 2. Registration View (Open registration creates Student account, or uses Invite Code for role assignment)
class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserCreateSerializer
    permission_classes = [permissions.AllowAny]

# 3. User Profile Endpoint
class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

# 3b. Student / User Change Password Endpoint
class ChangePasswordView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        current_password = request.data.get('current_password')
        new_password = request.data.get('new_password')

        if not current_password or not new_password:
            return Response({'detail': 'Both current password and new password are required.'}, status=status.HTTP_400_BAD_REQUEST)

        if not user.check_password(current_password):
            return Response({'detail': 'Current password does not match.'}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.must_change_password = False
        user.save()

        log_system_event(user, "STUDENT_PASSWORD_CHANGED", level="AUDIT", details=f"User {user.username} updated one-time password.")
        
        serializer = UserSerializer(user)
        return Response({
            'detail': 'Password changed successfully!',
            'user': serializer.data
        })

# 4. System Admin User Management ViewSet
class AdminUserViewSet(viewsets.ModelViewSet):
    serializer_class = AdminUserSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), IsAdmin()]

    def get_queryset(self):
        user = self.request.user
        qs = User.objects.all().order_by('-date_joined')
        role_param = self.request.query_params.get('role')
        if role_param:
            qs = qs.filter(role=role_param)

        if user.role == 'student':
            student_courses = Course.objects.filter(
                models.Q(applications__student=user, applications__status='approved') |
                models.Q(assigned_students=user) |
                models.Q(faculty=user.faculty)
            ).distinct()
            return User.objects.filter(
                role='lecturer',
                assigned_course_units__course__in=student_courses
            ).distinct().order_by('-date_joined')
        return qs

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsAdmin])
    def sync_clearance(self, request):
        cleared_list = fetch_external_cleared_students(force_refresh=True)
        if cleared_list is None:
            return Response({'detail': 'Failed to connect to CIU Cleared Students API endpoint.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        updated_api_count = 0
        active_temp_count = 0
        barred_count = 0

        students = User.objects.filter(role='student')
        for student in students:
            clearance = check_student_clearance(student, preloaded_api_data=cleared_list)
            if clearance['is_temp_cleared']:
                student.tuition_paid_percentage = 100.0
                student.save()
                active_temp_count += 1
            elif clearance['is_api_cleared']:
                student.tuition_paid_percentage = 100.0
                student.save()
                updated_api_count += 1
            else:
                # Keep custom admin overrides if set > 0, otherwise default to 0.0
                if student.tuition_paid_percentage >= 100.0:
                    student.tuition_paid_percentage = 0.0
                    student.save()
                barred_count += 1

        msg = f"Successfully synced live clearance API & temporary clearance overrides across {students.count()} students! {updated_api_count} cleared via live API, {active_temp_count} active temporary overrides."
        log_system_event(request.user, "STUDENT_CLEARANCE_SYNC_SUCCESS", level="AUDIT", details=msg)
        return Response({
            'detail': msg,
            'total_students': students.count(),
            'api_cleared': updated_api_count,
            'temp_cleared': active_temp_count,
            'barred_count': barred_count
        })

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsAdmin])
    def reset_password(self, request, pk=None):
        user_obj = self.get_object()
        new_password = request.data.get('new_password')
        if not new_password:
            return Response({'detail': 'New password parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)
        user_obj.set_password(new_password)
        user_obj.save()
        log_system_event(request.user, f"Admin Password Reset for user: {user_obj.username} ({user_obj.role})", level="INFO")
        return Response({'detail': f"Password for {user_obj.username} has been reset successfully."})

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsAdmin])
    def bulk_delete(self, request):
        user_ids = request.data.get('user_ids', [])
        if not user_ids or not isinstance(user_ids, list):
            return Response({'detail': 'Please provide a non-empty list of user_ids to delete.'}, status=status.HTTP_400_BAD_REQUEST)
        
        user_ids = [uid for uid in user_ids if uid != request.user.id]
        deleted_count, _ = User.objects.filter(id__in=user_ids).delete()
        log_system_event(request.user, "BULK_USER_DELETE_SUCCESS", level="AUDIT", details=f"Admin deleted {deleted_count} user accounts in bulk.")
        return Response({
            'detail': f'Successfully deleted {deleted_count} selected user accounts.',
            'count': deleted_count
        })

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsAdmin])
    def bulk_reset_passwords(self, request):
        user_ids = request.data.get('user_ids', [])
        new_password = request.data.get('new_password', '').strip()
        if not user_ids or not isinstance(user_ids, list):
            return Response({'detail': 'Please provide a non-empty list of user_ids.'}, status=status.HTTP_400_BAD_REQUEST)
        if not new_password:
            return Response({'detail': 'new_password parameter is required for bulk password reset.'}, status=status.HTTP_400_BAD_REQUEST)

        users_to_update = User.objects.filter(id__in=user_ids)
        updated_count = 0
        for u in users_to_update:
            u.set_password(new_password)
            u.must_change_password = True
            u.save()
            updated_count += 1

        msg = f"Bulk password reset completed for {updated_count} user accounts."
        log_system_event(request.user, "BULK_PASSWORD_RESET_SUCCESS", level="AUDIT", details=msg)
        return Response({
            'detail': msg,
            'count': updated_count
        })

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsAdmin | IsFacultyAdmin])
    def bulk_assign_year_and_courses(self, request):
        user_ids = request.data.get('user_ids', [])
        year_of_study = request.data.get('year_of_study')
        faculty_id = request.data.get('faculty_id')
        course_ids = request.data.get('course_ids', [])

        if not user_ids or not isinstance(user_ids, list):
            return Response({'detail': 'Please provide a non-empty list of user_ids.'}, status=status.HTTP_400_BAD_REQUEST)

        students = User.objects.filter(id__in=user_ids)
        updated_count = 0

        target_faculty = None
        if faculty_id:
            try:
                target_faculty = Faculty.objects.get(id=int(faculty_id))
            except Faculty.DoesNotExist:
                pass

        target_courses = []
        if course_ids and isinstance(course_ids, list):
            target_courses = list(Course.objects.filter(id__in=[int(c) for c in course_ids if str(c).isdigit()]))

        for student in students:
            if year_of_study is not None and str(year_of_study).isdigit():
                student.year_of_study = int(year_of_study)
            if target_faculty:
                student.faculty = target_faculty
            student.save()

            if target_courses:
                student.assigned_courses.set(target_courses)

            updated_count += 1

        msg = f"Bulk student allocation updated successfully for {updated_count} student accounts!"
        log_system_event(request.user, "BULK_STUDENT_ALLOCATION_SUCCESS", level="AUDIT", details=msg)
        return Response({
            'detail': msg,
            'count': updated_count
        })

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsAdmin])
    def upload_students(self, request):
        file_obj = request.FILES.get('file') or request.FILES.get('excel_file')
        if not file_obj:
            return Response({'detail': 'Please upload an Excel (.xlsx/.xls) or CSV (.csv) file.'}, status=status.HTTP_400_BAD_REQUEST)

        filename = file_obj.name.lower()
        rows = []

        if filename.endswith('.csv'):
            decoded = file_obj.read().decode('utf-8-sig', errors='ignore')
            reader = csv.reader(decoded.splitlines())
            header = None
            for r in reader:
                if not r or not any(r): continue
                if header is None:
                    header = [c.strip().lower() for c in r]
                    continue
                row_dict = {header[i]: r[i].strip() for i in range(min(len(header), len(r)))}
                rows.append(row_dict)
        elif filename.endswith(('.xlsx', '.xls')):
            file_bytes = file_obj.read()
            # Try xlrd for BIFF8 .xls or as fallback
            if filename.endswith('.xls'):
                try:
                    import xlrd
                    wb = xlrd.open_workbook(file_contents=file_bytes)
                    for sheet_name in wb.sheet_names():
                        ws = wb.sheet_by_name(sheet_name)
                        if ws.nrows < 2: continue
                        header = [str(cell).strip().lower() for cell in ws.row_values(0)]
                        for r_idx in range(1, ws.nrows):
                            row_vals = [str(c).strip() if c is not None else '' for c in ws.row_values(r_idx)]
                            if not any(row_vals): continue
                            row_dict = {header[i]: row_vals[i] for i in range(min(len(header), len(row_vals)))}
                            rows.append(row_dict)
                except Exception as ex1:
                    try:
                        import openpyxl
                        import io
                        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
                        for ws in wb.worksheets:
                            header = None
                            for row in ws.iter_rows(values_only=True):
                                if not row or not any(row): continue
                                row_vals = [str(cell).strip() if cell is not None else '' for cell in row]
                                if header is None:
                                    header = [c.lower() for c in row_vals]
                                    continue
                                row_dict = {header[i]: row_vals[i] for i in range(min(len(header), len(row_vals)))}
                                rows.append(row_dict)
                    except Exception as ex2:
                        return Response({'detail': f'Error reading Excel file: {str(ex1)} | {str(ex2)}'}, status=status.HTTP_400_BAD_REQUEST)
            else:
                try:
                    import openpyxl
                    import io
                    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
                    for ws in wb.worksheets:
                        header = None
                        for row in ws.iter_rows(values_only=True):
                            if not row or not any(row): continue
                            row_vals = [str(cell).strip() if cell is not None else '' for cell in row]
                            if header is None:
                                header = [c.lower() for c in row_vals]
                                continue
                            row_dict = {header[i]: row_vals[i] for i in range(min(len(header), len(row_vals)))}
                            rows.append(row_dict)
                except Exception as ex1:
                    try:
                        import xlrd
                        wb = xlrd.open_workbook(file_contents=file_bytes)
                        for sheet_name in wb.sheet_names():
                            ws = wb.sheet_by_name(sheet_name)
                            if ws.nrows < 2: continue
                            header = [str(cell).strip().lower() for cell in ws.row_values(0)]
                            for r_idx in range(1, ws.nrows):
                                row_vals = [str(c).strip() if c is not None else '' for c in ws.row_values(r_idx)]
                                if not any(row_vals): continue
                                row_dict = {header[i]: row_vals[i] for i in range(min(len(header), len(row_vals)))}
                                rows.append(row_dict)
                    except Exception as ex2:
                        return Response({'detail': f'Error reading Excel file: {str(ex1)} | {str(ex2)}'}, status=status.HTTP_400_BAD_REQUEST)

        created_students = []
        default_batch_pass = request.data.get('default_password') or request.POST.get('default_password')
        if default_batch_pass:
            default_batch_pass = str(default_batch_pass).strip()

        from django.contrib.auth.hashers import make_password
        pass_hash_cache = {}

        for index, r in enumerate(rows, start=1):
            reg = (
                r.get('registration no') or r.get('registration_no') or
                r.get('registration number') or r.get('reg_number') or r.get('registration_number') or
                r.get('reg_no') or r.get('regno') or
                r.get('entry no') or r.get('entry_no') or
                r.get('student_no') or r.get('student no') or f"2026SOBAT-B{index:03d}"
            ).strip()

            surname = (r.get('surname') or r.get('last name') or r.get('last_name') or '').strip()
            first_name_col = (r.get('first name') or r.get('first_name') or '').strip()
            
            if surname or first_name_col:
                name = f"{first_name_col} {surname}".strip()
            else:
                name = (r.get('full name') or r.get('full_name') or r.get('name') or r.get('student name') or r.get('student_name') or f"Student {index}").strip()

            email = (r.get('email') or r.get('student_email') or r.get('student email') or f"student_{index}@ciu.ac.ug").strip()
            fac_str = (r.get('faculty') or r.get('faculty_code') or r.get('faculty code') or r.get('program') or 'SOBAT').strip()

            name_parts = name.split(' ', 1)
            first_name = name_parts[0]
            last_name = name_parts[1] if len(name_parts) > 1 else ''

            specified_pass = r.get('password') or r.get('one_time_password') or r.get('otp') or default_batch_pass
            otp_pass = str(specified_pass).strip() if (specified_pass and str(specified_pass).strip()) else f"CIU-{random.randint(100000, 999999)}"
            username = reg.replace('/', '-').replace(' ', '').lower()

            if otp_pass not in pass_hash_cache:
                pass_hash_cache[otp_pass] = make_password(otp_pass)
            hashed_pass = pass_hash_cache[otp_pass]

            # Smart faculty resolution
            faculty_obj = Faculty.objects.filter(code__iexact=fac_str).first()
            if not faculty_obj:
                faculty_obj = Faculty.objects.filter(name__icontains=fac_str).first()
            if not faculty_obj:
                fac_lower = fac_str.lower()
                if 'business' in fac_lower or 'sobat' in fac_lower or 'applied tech' in fac_lower:
                    faculty_obj = Faculty.objects.filter(code='SOBAT').first()
                elif 'nursing' in fac_lower or 'sonm' in fac_lower:
                    faculty_obj = Faculty.objects.filter(code='SONM').first()
                elif 'public health' in fac_lower or 'soph' in fac_lower:
                    faculty_obj = Faculty.objects.filter(code='SOPH').first()
                elif 'allied' in fac_lower or 'iah' in fac_lower:
                    faculty_obj = Faculty.objects.filter(code='IAH').first()
                elif 'science' in fac_lower or 'fst' in fac_lower:
                    faculty_obj = Faculty.objects.filter(code='FST').first()
            
            if not faculty_obj:
                faculty_obj = Faculty.objects.first()

            user_obj, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'email': email,
                    'first_name': first_name,
                    'last_name': last_name,
                    'role': 'student',
                    'reg_number': reg,
                    'faculty': faculty_obj,
                    'tuition_paid_percentage': 0.0,
                    'must_change_password': True
                }
            )
            user_obj.password = hashed_pass
            user_obj.reg_number = reg
            user_obj.email = email
            user_obj.first_name = first_name
            user_obj.last_name = last_name
            user_obj.must_change_password = True
            if faculty_obj:
                user_obj.faculty = faculty_obj
            user_obj.save()

            created_students.append({
                'id': user_obj.id,
                'username': user_obj.username,
                'reg_number': reg,
                'full_name': name,
                'email': email,
                'faculty': faculty_obj.code if faculty_obj else 'SOBAT',
                'one_time_password': otp_pass
            })

        log_system_event(request.user, "BATCH_STUDENT_IMPORT_SUCCESS", level="AUDIT", details=f"Imported {len(created_students)} student accounts via Excel/CSV with generated one-time passwords.")
        return Response({
            'detail': f'Successfully onboarded {len(created_students)} students with one-time passwords.',
            'students': created_students
        })


    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated, IsAdmin])
    def ciu_cleared_students(self, request):
        cleared_api_records = fetch_external_cleared_students() or []
        students = User.objects.filter(role='student').select_related('faculty')
        
        students_by_key = {}
        for s in students:
            reg = (s.reg_number or s.registration_number or '').strip().upper()
            if reg:
                students_by_key[reg] = s
            if s.username:
                students_by_key[s.username.strip().upper()] = s
            if s.email:
                students_by_key[s.email.strip().lower()] = s

        all_payload_records = []

        if isinstance(cleared_api_records, list):
            for idx, item in enumerate(cleared_api_records):
                if isinstance(item, dict):
                    reg_no = str(item.get('RegNo') or item.get('reg_no') or item.get('RegistrationNo') or item.get('StudentNo') or item.get('username') or '').strip()
                    name = str(item.get('StudentName') or item.get('name') or item.get('Fullname') or item.get('Student_Name') or 'CIU Student').strip()
                    program = str(item.get('Program') or item.get('Faculty') or item.get('Course') or item.get('Department') or 'SOBAT').strip()
                    acad = str(item.get('AcademicYear') or item.get('AcadYear') or '2026/2027').strip()
                    sem = str(item.get('Semester') or item.get('Sem') or '1').strip()
                    status_txt = str(item.get('Status') or item.get('ClearanceStatus') or 'CLEARED').strip()

                    matched_user = None
                    if reg_no:
                        matched_user = students_by_key.get(reg_no.upper())
                    if not matched_user and name:
                        for s in students:
                            if name.lower() in (s.get_full_name() or s.username).lower():
                                matched_user = s
                                break

                    rec_entry = {
                        'id': f"api_{idx+1}",
                        'raw_payload': item,
                        'reg_number': reg_no or 'N/A',
                        'student_name': name,
                        'program': program,
                        'acad_year': acad,
                        'semester': sem,
                        'status': status_txt,
                        'is_db_matched': bool(matched_user),
                    }

                    if matched_user:
                        clearance = check_student_clearance(matched_user)
                        rec_entry['db_student'] = {
                            'id': matched_user.id,
                            'username': matched_user.username,
                            'full_name': matched_user.get_full_name() or matched_user.username,
                            'email': matched_user.email,
                            'faculty': matched_user.faculty.name if matched_user.faculty else 'General / Unassigned',
                            'faculty_code': matched_user.faculty.code if matched_user.faculty else 'SOBAT',
                            'tuition_paid_percentage': clearance['tuition_paid_percentage'],
                            'is_exam_cleared': clearance['is_exam_cleared'],
                            'is_test_cleared': clearance['is_test_cleared'],
                            'clearance_source': clearance['source']
                        }

                    all_payload_records.append(rec_entry)
                elif isinstance(item, str):
                    all_payload_records.append({
                        'id': f"api_{idx+1}",
                        'raw_payload': item,
                        'reg_number': 'N/A',
                        'student_name': item,
                        'program': 'N/A',
                        'acad_year': '2026/2027',
                        'semester': '1',
                        'status': 'CLEARED',
                        'is_db_matched': False
                    })

        faculties_map = {}
        for student in students:
            f_name = student.faculty.name if student.faculty else 'General / Unassigned'
            f_code = student.faculty.code if student.faculty else 'SOBAT'
            if f_name not in faculties_map:
                faculties_map[f_name] = {'code': f_code, 'students': []}
            
            clearance = check_student_clearance(student)
            faculties_map[f_name]['students'].append({
                'id': student.id,
                'username': student.username,
                'full_name': student.get_full_name() or student.username,
                'email': student.email,
                'reg_number': student.reg_number or student.registration_number,
                'tuition_paid_percentage': clearance['tuition_paid_percentage'],
                'is_exam_cleared': clearance['is_exam_cleared'],
                'is_test_cleared': clearance['is_test_cleared'],
                'is_api_cleared': clearance['is_api_cleared'],
                'clearance_source': clearance['source']
            })
        
        return Response({
            'faculties': faculties_map,
            'external_api_raw_records': cleared_api_records or [],
            'all_payload_records': all_payload_records,
            'external_api_count': len(cleared_api_records) if isinstance(cleared_api_records, list) else 0
        })

# 4b. Invitation Management ViewSet
class InvitationViewSet(viewsets.ModelViewSet):
    serializer_class = InvitationSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get_queryset(self):
        return Invitation.objects.all().order_by('-created_at')

    def perform_create(self, serializer):
        invitation = serializer.save(created_by=self.request.user)
        try:
            from django.core.mail import send_mail
            from django.conf import settings
            subject = "Official Invitation to CIU MyKampus Academic Portal"
            register_url = f"http://localhost:3000/login?invite={invitation.id}"
            message = (
                f"Dear Invitee,\n\n"
                f"You have been invited to join the Clarke International University (CIU) Academic Portal as a {invitation.get_role_display()}.\n\n"
                f"Your Unique Invitation Code: {invitation.id}\n\n"
                f"Please click the link below to complete your registration:\n{register_url}\n\n"
                f"Best regards,\nCIU Academic Administration"
            )
            send_mail(
                subject=subject,
                message=message,
                from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'CIU Portal Admin <noreply@ciu.ac.ug>'),
                recipient_list=[invitation.email],
                fail_silently=False
            )
            log_system_event(self.request.user, f"Invitation Email Sent to {invitation.email} (Code: {invitation.id})", level="INFO")
        except Exception as e:
            log_system_event(self.request.user, f"Failed to send invitation email to {invitation.email}: {str(e)}", level="WARNING")

    def perform_destroy(self, instance):
        email = instance.email
        token_id = str(instance.id)
        instance.delete()
        log_system_event(self.request.user, f"INVITATION_DELETED: Deleted invitation token for {email} (Token: {token_id})", level="AUDIT")

    @action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny])
    def validate_code(self, request):
        code = request.query_params.get('code')
        if not code:
            return Response({'valid': False, 'message': 'Invitation code parameter required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            invite = Invitation.objects.get(id=code, is_used=False)
            return Response({'valid': True, 'email': invite.email, 'role': invite.role})
        except (Invitation.DoesNotExist, ValueError):
            return Response({'valid': False, 'message': 'Invalid or expired token.'}, status=status.HTTP_400_BAD_REQUEST)

# 5. Faculty & Course Management ViewSets
class FacultyViewSet(viewsets.ModelViewSet):
    serializer_class = FacultySerializer

    def get_queryset(self):
        user = self.request.user
        qs = Faculty.objects.all().order_by('code')
        if user and user.is_authenticated and user.role == 'lecturer':
            return Faculty.objects.filter(courses__units__lecturers=user).distinct().order_by('code')
        return qs

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), (IsAdmin | IsFacultyAdmin)()]

    def perform_create(self, serializer):
        faculty = serializer.save()
        log_system_event(self.request.user, f"Faculty Created: {faculty.code} - {faculty.name}", level='INFO')

    def perform_update(self, serializer):
        faculty = serializer.save()
        log_system_event(self.request.user, f"Faculty Updated: {faculty.code} - {faculty.name}", level='INFO')

    def perform_destroy(self, instance):
        log_system_event(self.request.user, f"Faculty Deleted: {instance.code} - {instance.name}", level='WARNING')
        instance.delete()

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsAdmin])
    def assign_dean(self, request, pk=None):
        faculty = self.get_object()
        dean_id = request.data.get('dean_id')
        if not dean_id:
            faculty.dean = None
            faculty.save()
            log_system_event(request.user, f"Dean Unassigned from Faculty: {faculty.code}", level='INFO')
            return Response({'detail': f'Unassigned Dean from {faculty.name}.', 'faculty': FacultySerializer(faculty).data})
        try:
            dean = User.objects.get(id=dean_id, role='dean')
            faculty.dean = dean
            faculty.save()
            log_system_event(request.user, f"Assigned Dean {dean.username} to Faculty {faculty.code}", level='INFO')
            return Response({'detail': f'Assigned Dean {dean.get_full_name()} to {faculty.name}.', 'faculty': FacultySerializer(faculty).data})
        except User.DoesNotExist:
            return Response({'detail': 'Dean user not found.'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsAdmin])
    def assign_secretary(self, request, pk=None):
        faculty = self.get_object()
        secretary_id = request.data.get('secretary_id')
        if not secretary_id:
            faculty.secretary = None
            faculty.save()
            log_system_event(request.user, f"Faculty Secretary Unassigned from Faculty: {faculty.code}", level='INFO')
            return Response({'detail': f'Unassigned Faculty Secretary from {faculty.name}.', 'faculty': FacultySerializer(faculty).data})
        try:
            secretary = User.objects.get(id=secretary_id, role='faculty_admin')
            faculty.secretary = secretary
            faculty.save()
            log_system_event(request.user, f"Assigned Faculty Secretary {secretary.username} to Faculty {faculty.code}", level='INFO')
            return Response({'detail': f'Assigned Faculty Secretary {secretary.get_full_name()} to {faculty.name}.', 'faculty': FacultySerializer(faculty).data})
        except User.DoesNotExist:
            return Response({'detail': 'Faculty Secretary user not found.'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsAdmin | IsFacultyAdmin])
    def assign_student(self, request, pk=None):
        faculty = self.get_object()
        user = request.user
        if user.role == 'faculty_admin' and faculty.secretary != user:
            return Response({'detail': 'Permission Denied: You can only assign students to your managed faculty.'}, status=status.HTTP_403_FORBIDDEN)
        
        student_id = request.data.get('student_id')
        course_ids = request.data.get('course_ids', [])
        year_of_study = request.data.get('year_of_study')
        if not student_id:
            return Response({'detail': 'student_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            student = User.objects.get(id=student_id, role='student')
            student.faculty = faculty
            if year_of_study is not None and str(year_of_study).isdigit():
                student.year_of_study = int(year_of_study)
            if course_ids:
                courses = Course.objects.filter(id__in=course_ids)
                student.assigned_courses.set(courses)
            student.save()
            log_system_event(user, f"Assigned Student {student.username} (Year {student.year_of_study}) to Faculty {faculty.code}", level='INFO')
            return Response({'detail': f'Assigned student {student.get_full_name() or student.username} (Year {student.year_of_study}) to {faculty.name}.', 'student': UserSerializer(student).data})
        except User.DoesNotExist:
            return Response({'detail': 'Student user not found.'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsAdmin | IsFacultyAdmin])
    def remove_student(self, request, pk=None):
        faculty = self.get_object()
        user = request.user
        if user.role == 'faculty_admin' and faculty.secretary != user:
            return Response({'detail': 'Permission Denied: You can only remove students from your managed faculty.'}, status=status.HTTP_403_FORBIDDEN)
        
        student_id = request.data.get('student_id')
        if not student_id:
            return Response({'detail': 'student_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            student = User.objects.get(id=student_id, role='student', faculty=faculty)
            student.faculty = None
            student.assigned_courses.clear()
            student.save()
            log_system_event(user, f"Removed Student {student.username} from Faculty {faculty.code}", level='INFO')
            return Response({'detail': f'Removed student {student.get_full_name() or student.username} from {faculty.name}.', 'student': UserSerializer(student).data})
        except User.DoesNotExist:
            return Response({'detail': 'Student not found in this faculty.'}, status=status.HTTP_404_NOT_FOUND)

class CourseViewSet(viewsets.ModelViewSet):
    serializer_class = CourseSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Course.objects.all().order_by('code')
        if user and user.is_authenticated and user.role == 'lecturer':
            return Course.objects.filter(units__lecturers=user).distinct().order_by('code')
        return qs

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), (IsAdmin | IsFacultyAdmin)()]

class CourseUnitViewSet(viewsets.ModelViewSet):
    serializer_class = CourseUnitSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        if self.action == 'assign_lecturer':
            return [permissions.IsAuthenticated(), (IsAdmin | IsFacultyAdmin)()]
        return [permissions.IsAuthenticated(), (IsAdmin | IsFacultyAdmin)()]

    def get_queryset(self):
        user = self.request.user
        qs = CourseUnit.objects.all().order_by('code')
        if not user or not user.is_authenticated:
            return qs
        if user.role == 'student':
            student_courses = Course.objects.filter(
                models.Q(applications__student=user, applications__status='approved') |
                models.Q(assigned_students=user) |
                models.Q(faculty=user.faculty)
            ).distinct()
            return CourseUnit.objects.filter(course__in=student_courses).order_by('code')
        elif user.role == 'lecturer':
            return CourseUnit.objects.filter(
                models.Q(lecturers=user) | models.Q(course__units__lecturers=user)
            ).distinct().order_by('code')
        return qs

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsAdmin | IsFacultyAdmin])
    def assign_lecturer(self, request, pk=None):
        unit = self.get_object()
        lecturer_id = request.data.get('lecturer_id')
        action_type = request.data.get('action', 'assign')
        if not lecturer_id:
            return Response({'detail': 'lecturer_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            lecturer = User.objects.get(id=int(lecturer_id))
            if request.user.role in ['faculty_admin', 'dean']:
                sec_faculty = request.user.faculty
                if not sec_faculty and hasattr(request.user, 'administered_faculties'):
                    sec_faculty = request.user.administered_faculties.first()
                if not sec_faculty and hasattr(request.user, 'managed_faculties'):
                    sec_faculty = request.user.managed_faculties.first()

                if lecturer.faculty and sec_faculty and lecturer.faculty != sec_faculty:
                    return Response({
                        'detail': f"Permission Denied: As a Faculty Secretary for {sec_faculty.code}, you cannot assign/unassign lecturer {lecturer.get_full_name() or lecturer.username} who is assigned to faculty '{lecturer.faculty.code}'."
                    }, status=status.HTTP_403_FORBIDDEN)

            if action_type == 'unassign':
                unit.lecturers.remove(lecturer)
                msg = f'Unassigned lecturer {lecturer.get_full_name() or lecturer.username} from {unit.code}.'
            else:
                unit.lecturers.add(lecturer)
                msg = f'Assigned lecturer {lecturer.get_full_name() or lecturer.username} to {unit.code}.'
            log_system_event(request.user, msg, level='INFO')
            return Response({'detail': msg, 'unit': CourseUnitSerializer(unit).data})
        except User.DoesNotExist:
            return Response({'detail': 'Lecturer user not found.'}, status=status.HTTP_404_NOT_FOUND)
        except (ValueError, TypeError):
            return Response({'detail': 'Invalid lecturer_id format.'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsAdmin | IsFacultyAdmin])
    def upload_csv(self, request):
        csv_file = request.FILES.get('file') or request.FILES.get('csv_file')
        csv_text = request.data.get('csv_text')

        if not csv_file and not csv_text:
            return Response({'detail': 'Please upload a CSV file or provide csv_text data.'}, status=status.HTTP_400_BAD_REQUEST)

        lines = []
        if csv_file:
            decoded = csv_file.read().decode('utf-8-sig', errors='ignore')
            lines = decoded.splitlines()
        elif csv_text:
            lines = csv_text.splitlines()

        reader = csv.reader(lines)
        header = None
        imported_count = 0

        for row in reader:
            if not row or not any(row):
                continue
            if header is None:
                header = [c.strip().lower() for c in row]
                continue

            row_dict = {}
            for i, val in enumerate(row):
                if i < len(header):
                    row_dict[header[i]] = val.strip()

            code = row_dict.get('course code') or row_dict.get('code') or row_dict.get('unit_code') or row_dict.get('unit code')
            name = row_dict.get('course name') or row_dict.get('name') or row_dict.get('unit_name') or row_dict.get('unit name')
            course_code = row_dict.get('course_code') or row_dict.get('program_code') or row_dict.get('program') or row_dict.get('course') or request.data.get('course_code')
            credit_units = row_dict.get('credit units') or row_dict.get('credit_units') or row_dict.get('credits') or '3'

            if not code or not name:
                continue

            try:
                cu_val = int(float(credit_units))
            except (ValueError, TypeError):
                cu_val = 3

            course = None
            if course_code:
                try:
                    course = Course.objects.get(code__iexact=course_code)
                except Course.DoesNotExist:
                    course = Course.objects.filter(code__icontains=course_code).first()

            if not course:
                course = Course.objects.first()

            if course:
                unit, created = CourseUnit.objects.update_or_create(
                    code=code,
                    course=course,
                    defaults={'name': name, 'credit_units': cu_val}
                )
                imported_count += 1

        log_system_event(request.user, f"CSV Course Units Uploaded: {imported_count} units imported", level='INFO')
        return Response({'detail': f'Successfully imported {imported_count} course units from CSV.', 'count': imported_count})

# 6. Applications ViewSet
class ApplicationViewSet(viewsets.ModelViewSet):
    serializer_class = ApplicationSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role in ['admin', 'dvc', 'dean', 'faculty_admin', 'registrar']:
            return Application.objects.all().order_by('-applied_at')
        elif user.role == 'lecturer':
            return Application.objects.filter(course__units__lecturers=user).distinct().order_by('-applied_at')
        return Application.objects.filter(student=user).order_by('-applied_at')

    def perform_create(self, serializer):
        serializer.save(student=self.request.user, status='pending')

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsAdmin | IsFacultyAdmin])
    def review(self, request, pk=None):
        application = self.get_object()
        serializer = ApplicationReviewSerializer(application, data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(ApplicationSerializer(application).data)

# 7. Exam ViewSet
class ExamViewSet(viewsets.ModelViewSet):
    serializer_class = ExamSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == 'student':
            if user.assigned_courses.exists():
                student_courses = user.assigned_courses.all()
            else:
                student_courses = Course.objects.filter(
                    models.Q(applications__student=user, applications__status='approved') |
                    models.Q(faculty=user.faculty)
                ).distinct()
            student_year = getattr(user, 'year_of_study', 1) or 1
            return Exam.objects.filter(
                is_active=True,
                course__in=student_courses
            ).filter(
                models.Q(year_of_study=student_year) | models.Q(year_of_study=0) | models.Q(course_unit__year_of_study=student_year)
            ).order_by('-created_at')
        elif user.role == 'dean':
            dean_faculty = user.faculty or (user.managed_faculties.first() if hasattr(user, 'managed_faculties') else None)
            if dean_faculty:
                return Exam.objects.filter(course__faculty=dean_faculty).order_by('-created_at')
            return Exam.objects.all().order_by('-created_at')
        elif user.role == 'faculty_admin':
            sec_faculty = user.faculty or (user.administered_faculties.first() if hasattr(user, 'administered_faculties') else None)
            if sec_faculty:
                return Exam.objects.filter(course__faculty=sec_faculty).order_by('-created_at')
            return Exam.objects.all().order_by('-created_at')
        elif user.role == 'lecturer':
            return Exam.objects.filter(
                models.Q(lecturer=user) |
                models.Q(course__units__lecturers=user) |
                models.Q(course_unit__lecturers=user)
            ).distinct().order_by('-created_at')
        return Exam.objects.all().order_by('-created_at')

    def perform_create(self, serializer):
        user = self.request.user
        if user.role in ['dvc', 'vc', 'dean']:
            raise serializers.ValidationError({"detail": "Permission Denied: DVC, VC, and Deans have read-only access and cannot create, update, or delete data."})
        
        course_unit = serializer.validated_data.get('course_unit')
        year_of_study = serializer.validated_data.get('year_of_study', 0)

        # Only System Admin can set an exam for All Course Units & All Years (Year 0)
        if user.role != 'admin' and year_of_study == 0 and not course_unit:
            raise serializers.ValidationError({"detail": "Permission Denied: Only System Administrators can set exams for All Course Units & All Years (Year 0). Please select an assigned course unit and specific year of study."})
        
        if course_unit and (year_of_study == 0 or 'year_of_study' not in serializer.validated_data):
            serializer.validated_data['year_of_study'] = course_unit.year_of_study

        if user.role == 'lecturer':
            course = serializer.validated_data.get('course')
            is_assigned = False
            if course_unit and course_unit.lecturers.filter(id=user.id).exists():
                is_assigned = True
            elif course and course.units.filter(lecturers=user).exists():
                is_assigned = True
            if not is_assigned:
                raise serializers.ValidationError({"detail": "Permission Denied: You can only set exams for your assigned course units."})
        exam = serializer.save(lecturer=user)
        log_system_event(user, f"Exam Created: {exam.title} ({exam.course.code})", level="INFO")

    def perform_update(self, serializer):
        user = self.request.user
        if user.role in ['dvc', 'vc', 'dean']:
            raise serializers.ValidationError({"detail": "Permission Denied: DVC, VC, and Deans have read-only access and cannot create, update, or delete data."})
        if user.role == 'lecturer':
            if serializer.instance.lecturer != user:
                raise serializers.ValidationError({"detail": "Permission Denied: You can only update your own created exams."})
            if serializer.instance.is_approved_by_dean:
                raise serializers.ValidationError({"detail": "Permission Denied: Approved exams cannot be modified by the lecturer."})
        serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
        if user.role in ['dvc', 'vc', 'dean']:
            raise serializers.ValidationError({"detail": "Permission Denied: DVC, VC, and Deans have read-only access and cannot create, update, or delete data."})
        if user.role == 'lecturer':
            if instance.lecturer != user:
                raise serializers.ValidationError({"detail": "Permission Denied: You can only delete your own created exams."})
            if instance.is_approved_by_dean:
                raise serializers.ValidationError({"detail": "Permission Denied: Approved exams cannot be deleted by the lecturer."})
        instance.delete()

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsAdmin | IsFacultyAdmin])
    def approve_exam(self, request, pk=None):
        exam = self.get_object()
        exam.is_approved_by_dean = not exam.is_approved_by_dean
        exam.save()
        return Response({
            'detail': f"Exam approval status updated to: {'APPROVED' if exam.is_approved_by_dean else 'PENDING'}",
            'is_approved_by_dean': exam.is_approved_by_dean
        })

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsRegistrar | IsAdmin])
    def release_results(self, request, pk=None):
        exam = self.get_object()
        exam.is_results_released = not exam.is_results_released
        exam.save()
        return Response({
            'detail': f"Exam results release status updated to: {'RELEASED TO STUDENTS' if exam.is_results_released else 'HIDDEN'}",
            'is_results_released': exam.is_results_released
        })

    @action(detail=True, methods=['get', 'post'], url_path='questions')
    def questions(self, request, pk=None):
        exam = self.get_object()
        user = request.user

        if request.method == 'GET':
            questions = exam.questions.all()
            if user.role == 'student':
                serializer = QuestionStudentSerializer(questions, many=True)
            else:
                serializer = QuestionLecturerSerializer(questions, many=True)
            return Response(serializer.data)

        elif request.method == 'POST':
            if user.role not in ['lecturer', 'admin', 'faculty_admin']:
                return Response({'detail': 'Only lecturers or staff can add questions.'}, status=status.HTTP_403_FORBIDDEN)
            if user.role == 'lecturer':
                if exam.lecturer != user:
                    return Response({'detail': 'Permission Denied: You can only add questions to your own created exams.'}, status=status.HTTP_403_FORBIDDEN)
                if exam.is_approved_by_dean:
                    return Response({'detail': 'Permission Denied: Approved exams cannot be modified by the lecturer.'}, status=status.HTTP_403_FORBIDDEN)
            
            data = request.data.copy()
            data['exam'] = exam.id
            serializer = QuestionLecturerSerializer(data=data)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsStudent])
    def start_attempt(self, request, pk=None):
        exam = self.get_object()
        student = request.user

        # Fee Gate: Exam requires 100% full tuition clearance or CIU Cleared Students API verification!
        clearance = check_student_clearance(student, examtype="EXAMS")
        if not clearance['is_exam_cleared']:
            return Response({
                'detail': f"Exam Access Denied: 100% tuition clearance or CIU Cleared Students API verification is required to sit for final examinations. Current clearance: {clearance['tuition_paid_percentage']}% ({clearance['source']})."
            }, status=status.HTTP_403_FORBIDDEN)

        # Dean Approval check (PDF Requirement: available upon respective dean approval)
        if not exam.is_approved_by_dean:
            return Response({'detail': 'Exam Access Denied: This examination is pending approval from the Faculty Dean and is not yet available.'}, status=status.HTTP_400_BAD_REQUEST)

        if not exam.is_active:
            return Response({'detail': 'This exam is not active.'}, status=status.HTTP_400_BAD_REQUEST)

        # Scheduled Date & Time Availability check (Ugandan East Africa Time UTC+3)
        now = timezone.now()
        if exam.scheduled_start and now < exam.scheduled_start:
            return Response({'detail': f'Exam Access Denied: This exam is scheduled for {exam.scheduled_start.strftime("%Y-%m-%d %H:%M")} EAT and is not yet open.'}, status=status.HTTP_400_BAD_REQUEST)

        if exam.due_date and now > exam.due_date:
            return Response({'detail': 'Exam Access Denied: The deadline for submitting this exam has passed.'}, status=status.HTTP_400_BAD_REQUEST)

        existing = ExamAttempt.objects.filter(student=request.user, exam=exam)
        if existing.exists():
            attempt = existing.first()
            if attempt.completed_at:
                return Response({'detail': 'You have already completed this exam.'}, status=status.HTTP_400_BAD_REQUEST)
            return Response(ExamAttemptSerializer(attempt, context={'request': request}).data)

        attempt = ExamAttempt.objects.create(student=request.user, exam=exam)
        return Response(ExamAttemptSerializer(attempt, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], permission_classes=[permissions.AllowAny])
    def export_csv(self, request, pk=None):
        authenticate_token_param(request)
        if not request.user or not request.user.is_authenticated or request.user.role not in ['admin', 'lecturer', 'dean', 'dvc', 'registrar', 'faculty_admin']:
            return Response({'detail': 'Authentication credentials were not provided or unauthorized.'}, status=status.HTTP_401_UNAUTHORIZED)

        exam = self.get_object()
        attempts = exam.attempts.select_related('student').all()

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="Exam_Results_{exam.course.code}_{exam.id}.csv"'

        writer = csv.writer(response)
        writer.writerow(['Student Username', 'Full Name', 'Email', 'Exam Title', 'Course Code', 'Score (%)', 'Submitted At', 'Tab Switches', 'Status'])

        for att in attempts:
            writer.writerow([
                att.student.username,
                att.student.get_full_name(),
                att.student.email,
                exam.title,
                exam.course.code,
                att.score,
                att.completed_at.strftime('%Y-%m-%d %H:%M:%S') if att.completed_at else 'In Progress',
                att.tab_switches_count,
                'Completed' if att.completed_at else 'Incomplete'
            ])

        return response

# 8. Exam Attempt ViewSet
class ExamAttemptViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ExamAttemptSerializer

    def get_queryset(self):
        user = self.request.user
        qs = ExamAttempt.objects.all().order_by('-started_at')
        if user.role == 'student':
            qs = qs.filter(student=user)
        elif user.role == 'lecturer':
            qs = qs.filter(exam__lecturer=user)

        unit_id = self.request.query_params.get('course_unit')
        lecturer_id = self.request.query_params.get('lecturer')
        exam_id = self.request.query_params.get('exam')
        course_param = self.request.query_params.get('course')
        faculty_param = self.request.query_params.get('faculty')

        if unit_id:
            qs = qs.filter(exam__course_unit_id=unit_id)
        if lecturer_id:
            qs = qs.filter(exam__lecturer_id=lecturer_id)
        if exam_id:
            qs = qs.filter(exam_id=exam_id)
        if course_param:
            qs = qs.filter(models.Q(exam__course_id=course_param) | models.Q(exam__course__code__iexact=course_param))
        if faculty_param:
            qs = qs.filter(models.Q(exam__course__faculty_id=faculty_param) | models.Q(student__faculty_id=faculty_param) | models.Q(exam__course__faculty__code__iexact=faculty_param))
        return qs

    @action(detail=True, methods=['post'], url_path='submit', permission_classes=[permissions.IsAuthenticated, IsStudent])
    def submit_exam(self, request, pk=None):
        attempt = self.get_object()
        if attempt.student != request.user:
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        if attempt.completed_at:
            return Response({'detail': 'Attempt already completed.'}, status=status.HTTP_400_BAD_REQUEST)

        answers = request.data.get('answers', {})
        tab_switches = request.data.get('tab_switches', 0)
        auto_submitted_reason = request.data.get('auto_submitted_reason', None)

        exam_questions = attempt.exam.questions.all()
        correct_count = 0
        total_questions = exam_questions.count()

        for q in exam_questions:
            student_choice = answers.get(str(q.id))
            if student_choice and student_choice == q.correct_option:
                correct_count += 1

        score_percent = (correct_count / total_questions * 100.0) if total_questions > 0 else 0.0

        attempt.answers = answers
        attempt.score = round(score_percent, 2)
        attempt.tab_switches_count = tab_switches
        attempt.auto_submitted_reason = auto_submitted_reason
        attempt.completed_at = timezone.now()
        attempt.save()

        log_system_event(request.user, f"Exam Submitted: {attempt.exam.title} (Score: {attempt.score}%)", level="INFO")
        return Response(ExamAttemptSerializer(attempt, context={'request': request}).data)

    @action(detail=True, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def results(self, request, pk=None):
        attempt = self.get_object()
        user = request.user

        if user.role == 'student' and attempt.student != user:
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        if user.role == 'student' and not attempt.exam.is_results_released:
            return Response({
                'is_results_released': False,
                'detail': f"Examination results for '{attempt.exam.title}' are currently withheld by the Academic Registrar / Lecturer. Official scorecards will be visible here once released.",
                'attempt': ExamAttemptSerializer(attempt, context={'request': request}).data,
                'questions': []
            }, status=status.HTTP_200_OK)

        questions = attempt.exam.questions.all()
        q_serializer = QuestionLecturerSerializer(questions, many=True)

        return Response({
            'is_results_released': True,
            'attempt': ExamAttemptSerializer(attempt, context={'request': request}).data,
            'questions': q_serializer.data
        })

# 9. Test ViewSet
class TestViewSet(viewsets.ModelViewSet):
    serializer_class = TestSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == 'student':
            if user.assigned_courses.exists():
                student_courses = user.assigned_courses.all()
            else:
                student_courses = Course.objects.filter(
                    models.Q(applications__student=user, applications__status='approved') |
                    models.Q(faculty=user.faculty)
                ).distinct()
            student_year = getattr(user, 'year_of_study', 1) or 1
            return Test.objects.filter(
                is_published=True,
                course__in=student_courses
            ).filter(
                models.Q(year_of_study=student_year) | models.Q(year_of_study=0) | models.Q(course_unit__year_of_study=student_year)
            ).order_by('-created_at')
        elif user.role == 'dean':
            dean_faculty = user.faculty or (user.managed_faculties.first() if hasattr(user, 'managed_faculties') else None)
            if dean_faculty:
                return Test.objects.filter(course__faculty=dean_faculty).order_by('-created_at')
            return Test.objects.all().order_by('-created_at')
        elif user.role == 'faculty_admin':
            sec_faculty = user.faculty or (user.administered_faculties.first() if hasattr(user, 'administered_faculties') else None)
            if sec_faculty:
                return Test.objects.filter(course__faculty=sec_faculty).order_by('-created_at')
            return Test.objects.all().order_by('-created_at')
        elif user.role == 'lecturer':
            return Test.objects.filter(
                models.Q(lecturer=user) |
                models.Q(course__units__lecturers=user) |
                models.Q(course_unit__lecturers=user)
            ).distinct().order_by('-created_at')
        return Test.objects.all().order_by('-created_at')

    def perform_create(self, serializer):
        user = self.request.user
        if user.role in ['dvc', 'vc', 'dean']:
            raise serializers.ValidationError({"detail": "Permission Denied: DVC, VC, and Deans have read-only access and cannot create, update, or delete data."})
        
        course_unit = serializer.validated_data.get('course_unit')
        year_of_study = serializer.validated_data.get('year_of_study', 0)

        # Only System Admin can set a test for All Course Units & All Years (Year 0)
        if user.role != 'admin' and year_of_study == 0 and not course_unit:
            raise serializers.ValidationError({"detail": "Permission Denied: Only System Administrators can set tests for All Course Units & All Years (Year 0). Please select an assigned course unit and specific year of study."})
        
        if course_unit and (year_of_study == 0 or 'year_of_study' not in serializer.validated_data):
            serializer.validated_data['year_of_study'] = course_unit.year_of_study

        if user.role == 'lecturer':
            course = serializer.validated_data.get('course')
            is_assigned = False
            if course_unit and course_unit.lecturers.filter(id=user.id).exists():
                is_assigned = True
            elif course and course.units.filter(lecturers=user).exists():
                is_assigned = True
            if not is_assigned:
                raise serializers.ValidationError({"detail": "Permission Denied: You can only set tests for your assigned course units."})
        test = serializer.save(lecturer=user)
        log_system_event(user, f"Test Created: {test.title} ({test.course.code})", level="INFO")

    def perform_update(self, serializer):
        user = self.request.user
        if user.role in ['dvc', 'vc', 'dean']:
            raise serializers.ValidationError({"detail": "Permission Denied: DVC, VC, and Deans have read-only access and cannot create, update, or delete data."})
        if user.role == 'lecturer':
            if serializer.instance.lecturer != user:
                raise serializers.ValidationError({"detail": "Permission Denied: You can only update your own created tests."})
        serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
        if user.role in ['dvc', 'vc', 'dean']:
            raise serializers.ValidationError({"detail": "Permission Denied: DVC, VC, and Deans have read-only access and cannot create, update, or delete data."})
        if user.role == 'lecturer':
            if instance.lecturer != user:
                raise serializers.ValidationError({"detail": "Permission Denied: You can only delete your own created tests."})
        instance.delete()

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsLecturer | IsAdmin])
    def publish(self, request, pk=None):
        test_obj = self.get_object()
        test_obj.is_published = not test_obj.is_published
        test_obj.save()
        log_system_event(request.user, f"Test Publication Status set to {test_obj.is_published} for {test_obj.title}", level="INFO")
        return Response({
            'detail': f"Test publication status set to {'PUBLISHED' if test_obj.is_published else 'DRAFT'}.",
            'is_published': test_obj.is_published
        })

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsLecturer | IsAdmin])
    def release_results(self, request, pk=None):
        test_obj = self.get_object()
        new_val = request.data.get('is_results_released')
        if new_val is not None:
            test_obj.is_results_released = bool(new_val)
        else:
            test_obj.is_results_released = not test_obj.is_results_released
        test_obj.save()
        log_system_event(request.user, f"Test Results Release Status set to {test_obj.is_results_released} for {test_obj.title}", level="INFO")
        return Response({
            'detail': f"Test results release status set to {'RELEASED' if test_obj.is_results_released else 'WITHHELD'}.",
            'is_results_released': test_obj.is_results_released
        })

    @action(detail=True, methods=['get', 'post'], url_path='questions')
    def questions(self, request, pk=None):
        test_obj = self.get_object()
        user = request.user

        if request.method == 'GET':
            questions = test_obj.questions.all()
            if user.role == 'student':
                serializer = TestQuestionStudentSerializer(questions, many=True)
            else:
                serializer = TestQuestionLecturerSerializer(questions, many=True)
            return Response(serializer.data)

        elif request.method == 'POST':
            if user.role not in ['lecturer', 'admin', 'faculty_admin']:
                return Response({'detail': 'Only lecturers or staff can add test questions.'}, status=status.HTTP_403_FORBIDDEN)
            
            data = request.data.copy()
            data['test'] = test_obj.id
            serializer = TestQuestionLecturerSerializer(data=data)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsLecturer | IsAdmin])
    def bulk_add_questions(self, request, pk=None):
        test_obj = self.get_object()
        sample_questions = [
            {
                "question_text": "What is the primary function of an Operating System Kernel?",
                "question_type": "mcq",
                "option_a": "Resource Management and Hardware Abstraction",
                "option_b": "Text Editing",
                "option_c": "Web Browsing",
                "option_d": "Graphic Design Rendering",
                "correct_answer": "A",
                "points": 2.0,
                "explanation": "The kernel is the core component managing hardware resources and providing system calls."
            },
            {
                "question_text": "In relational databases, Primary Keys can contain duplicate values.",
                "question_type": "tf",
                "option_a": "True",
                "option_b": "False",
                "correct_answer": "False",
                "points": 1.5,
                "explanation": "Primary keys must be strictly unique and non-null for every record."
            },
            {
                "question_text": "Which algorithm complexity represents logarithmic growth?",
                "question_type": "mcq",
                "option_a": "O(1)",
                "option_b": "O(n)",
                "option_c": "O(log n)",
                "option_d": "O(n^2)",
                "correct_answer": "C",
                "points": 2.0,
                "explanation": "O(log n) grows logarithmically as seen in binary search algorithms."
            }
        ]

        created = []
        for item in sample_questions:
            item['test'] = test_obj.id
            serializer = TestQuestionLecturerSerializer(data=item)
            if serializer.is_valid():
                serializer.save()
                created.append(serializer.data)

        return Response({
            'detail': f'Successfully added {len(created)} questions to question bank.',
            'questions': created
        })

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsStudent])
    def start_attempt(self, request, pk=None):
        test_obj = self.get_object()
        student = request.user

        # Fee Gate: Test requires at least 50% tuition clearance or CIU Cleared Students API verification!
        clearance = check_student_clearance(student, examtype="TESTS")
        if not clearance['is_test_cleared']:
            return Response({
                'detail': f"Test Access Denied: At least 50% tuition fee clearance or CIU Cleared Students API verification is required to access quizzes and tests. Current clearance: {clearance['tuition_paid_percentage']}% ({clearance['source']})."
            }, status=status.HTTP_403_FORBIDDEN)

        if not test_obj.is_published:
            return Response({'detail': 'This test is currently unpublished.'}, status=status.HTTP_400_BAD_REQUEST)

        # Scheduled Date & Time Availability check (Ugandan East Africa Time UTC+3)
        now = timezone.now()
        if test_obj.scheduled_start and now < test_obj.scheduled_start:
            return Response({'detail': f'Test Access Denied: This test is scheduled for {test_obj.scheduled_start.strftime("%Y-%m-%d %H:%M")} EAT and is not yet open.'}, status=status.HTTP_400_BAD_REQUEST)

        if test_obj.due_date and now > test_obj.due_date:
            return Response({'detail': 'Test Access Denied: The deadline for submitting this test has passed.'}, status=status.HTTP_400_BAD_REQUEST)

        user_attempts = TestAttempt.objects.filter(student=request.user, test=test_obj)
        completed_count = user_attempts.filter(completed_at__isnull=False).count()

        if test_obj.allowed_attempts > 0 and completed_count >= test_obj.allowed_attempts:
            return Response({'detail': f'Maximum allowed attempts ({test_obj.allowed_attempts}) reached for this test.'}, status=status.HTTP_400_BAD_REQUEST)

        active_attempt = user_attempts.filter(completed_at__isnull=True).first()
        if active_attempt:
            return Response(TestAttemptSerializer(active_attempt).data)

        attempt = TestAttempt.objects.create(
            student=request.user,
            test=test_obj,
            attempt_number=completed_count + 1
        )
        return Response(TestAttemptSerializer(attempt).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], permission_classes=[permissions.AllowAny])
    def export_csv(self, request, pk=None):
        authenticate_token_param(request)
        if not request.user or not request.user.is_authenticated or request.user.role not in ['admin', 'lecturer', 'dean', 'dvc', 'registrar', 'faculty_admin']:
            return Response({'detail': 'Authentication credentials were not provided or unauthorized.'}, status=status.HTTP_401_UNAUTHORIZED)

        test_obj = self.get_object()
        attempts = test_obj.attempts.select_related('student').all()

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="Test_Results_{test_obj.course.code}_{test_obj.id}.csv"'

        writer = csv.writer(response)
        writer.writerow(['Student Username', 'Full Name', 'Email', 'Test Title', 'Category', 'Course Code', 'Score (%)', 'Passed Status', 'Submitted At', 'Tab Switches', 'Attempt #'])

        for att in attempts:
            writer.writerow([
                att.student.username,
                att.student.get_full_name(),
                att.student.email,
                test_obj.title,
                test_obj.category,
                test_obj.course.code,
                att.score,
                'PASSED' if att.passed else 'FAILED',
                att.completed_at.strftime('%Y-%m-%d %H:%M:%S') if att.completed_at else 'In Progress',
                att.tab_switches_count,
                att.attempt_number
            ])

        return response

# 10. Test Attempt ViewSet
class TestAttemptViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TestAttemptSerializer

    def get_queryset(self):
        user = self.request.user
        qs = TestAttempt.objects.all().order_by('-started_at')
        if user.role == 'student':
            qs = qs.filter(student=user)
        elif user.role == 'lecturer':
            qs = qs.filter(test__lecturer=user)

        unit_id = self.request.query_params.get('course_unit')
        lecturer_id = self.request.query_params.get('lecturer')
        test_id = self.request.query_params.get('test')
        course_param = self.request.query_params.get('course')
        faculty_param = self.request.query_params.get('faculty')

        if unit_id:
            qs = qs.filter(test__course_unit_id=unit_id)
        if lecturer_id:
            qs = qs.filter(test__lecturer_id=lecturer_id)
        if test_id:
            qs = qs.filter(test_id=test_id)
        if course_param:
            qs = qs.filter(models.Q(test__course_id=course_param) | models.Q(test__course__code__iexact=course_param))
        if faculty_param:
            qs = qs.filter(models.Q(test__course__faculty_id=faculty_param) | models.Q(student__faculty_id=faculty_param) | models.Q(test__course__faculty__code__iexact=faculty_param))
        return qs

    @action(detail=True, methods=['post'], url_path='submit', permission_classes=[permissions.IsAuthenticated, IsStudent])
    def submit_test(self, request, pk=None):
        attempt = self.get_object()
        if attempt.student != request.user:
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        if attempt.completed_at:
            return Response({'detail': 'Attempt already completed.'}, status=status.HTTP_400_BAD_REQUEST)

        answers = request.data.get('answers', {})
        tab_switches = request.data.get('tab_switches', 0)
        auto_submitted_reason = request.data.get('auto_submitted_reason', None)

        test_questions = attempt.test.questions.all()
        total_points = 0.0
        earned_points = 0.0

        for q in test_questions:
            total_points += q.points
            student_ans = answers.get(str(q.id))
            if student_ans:
                if q.question_type == 'short':
                    if student_ans.strip().lower() == q.correct_answer.strip().lower():
                        earned_points += q.points
                else:
                    if student_ans.strip().upper() == q.correct_answer.strip().upper():
                        earned_points += q.points

        score_percent = (earned_points / total_points * 100.0) if total_points > 0 else 0.0
        passed = score_percent >= attempt.test.pass_percentage

        attempt.answers = answers
        attempt.score = round(score_percent, 2)
        attempt.passed = passed
        attempt.tab_switches_count = tab_switches
        attempt.auto_submitted_reason = auto_submitted_reason
        attempt.completed_at = timezone.now()
        attempt.save()

        log_system_event(request.user, f"Test Submitted: {attempt.test.title} (Score: {attempt.score}%, Passed: {passed})", level="INFO")
        return Response(TestAttemptSerializer(attempt).data)

    @action(detail=True, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def results(self, request, pk=None):
        attempt = self.get_object()
        user = request.user

        if user.role == 'student' and attempt.student != user:
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        if user.role == 'student' and not attempt.test.is_results_released:
            return Response({
                'is_results_released': False,
                'detail': f"Results for '{attempt.test.title}' are currently withheld by the lecturer. Official scorecards will be published here once released.",
                'attempt': TestAttemptSerializer(attempt).data,
                'questions': []
            }, status=status.HTTP_200_OK)

        questions = attempt.test.questions.all()
        q_serializer = TestQuestionLecturerSerializer(questions, many=True)

        return Response({
            'is_results_released': True,
            'attempt': TestAttemptSerializer(attempt).data,
            'questions': q_serializer.data
        })

# 11. Class Content ViewSet
class ClassContentViewSet(viewsets.ModelViewSet):
    queryset = ClassContent.objects.all().order_by('-created_at')
    serializer_class = ClassContentSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), IsLecturer | IsAdmin]

    def perform_create(self, serializer):
        user = self.request.user
        if user.role == 'lecturer':
            course = serializer.validated_data.get('course')
            if course and not course.units.filter(lecturers=user).exists():
                raise serializers.ValidationError({"detail": "Permission Denied: You can only upload resources for your assigned courses."})
        content = serializer.save(lecturer=user)
        log_system_event(user, f"Class Content Uploaded: {content.title} ({content.course.code})", level="INFO")

# 12. Attendance Session ViewSet
class AttendanceSessionViewSet(viewsets.ModelViewSet):
    serializer_class = AttendanceSessionSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == 'student':
            return AttendanceSession.objects.filter(is_active=True).order_by('-created_at')
        elif user.role == 'lecturer':
            return AttendanceSession.objects.filter(lecturer=user).order_by('-created_at')
        return AttendanceSession.objects.all().order_by('-created_at')

    def perform_create(self, serializer):
        user = self.request.user
        if user.role == 'lecturer':
            course = serializer.validated_data.get('course')
            if course and not course.units.filter(lecturers=user).exists():
                raise serializers.ValidationError({"detail": "Permission Denied: You can only open attendance for your assigned courses."})
        code = str(random.randint(1000, 9999))
        session = serializer.save(lecturer=user, code=code, is_active=True)
        log_system_event(user, f"Attendance Session Opened: {session.course.code} (Code: {code})", level="INFO")

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsStudent])
    def check_in(self, request):
        session_id = request.data.get('session_id')
        code = request.data.get('code')

        try:
            session = AttendanceSession.objects.get(id=session_id, is_active=True)
        except AttendanceSession.DoesNotExist:
            return Response({'detail': 'Attendance session is closed or invalid.'}, status=status.HTTP_400_BAD_REQUEST)

        if session.code != code:
            return Response({'detail': 'Incorrect verification code.'}, status=status.HTTP_400_BAD_REQUEST)

        record, created = AttendanceRecord.objects.get_or_create(session=session, student=request.user)
        if not created:
            return Response({'detail': 'You have already checked in for this class session.'}, status=status.HTTP_400_BAD_REQUEST)

        return Response({'detail': 'Check-in successful! Attendance logged.'}, status=status.HTTP_201_CREATED)

# 13. Reports ViewSet
class ReportsViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'])
    def summary(self, request):
        user = request.user
        
        # General stats
        total_students = User.objects.filter(role='student').count()
        total_lecturers = User.objects.filter(role='lecturer').count()
        total_faculties = Faculty.objects.count()
        total_courses = Course.objects.count()
        total_course_units = CourseUnit.objects.count()
        total_exams = Exam.objects.count()
        approved_exams = Exam.objects.filter(is_approved_by_dean=True).count()
        total_tests = Test.objects.count()
        published_tests = Test.objects.filter(is_published=True).count()
        total_class_timetables = ClassTimetable.objects.count()
        total_exam_timetables = ExamTimetable.objects.count()

        faculty_param = request.query_params.get('faculty')
        course_param = request.query_params.get('course')

        exam_attempts = ExamAttempt.objects.filter(completed_at__isnull=False)
        test_attempts = TestAttempt.objects.filter(completed_at__isnull=False)

        if faculty_param:
            exam_attempts = exam_attempts.filter(models.Q(exam__course__faculty_id=faculty_param) | models.Q(student__faculty_id=faculty_param) | models.Q(exam__course__faculty__code__iexact=faculty_param))
            test_attempts = test_attempts.filter(models.Q(test__course__faculty_id=faculty_param) | models.Q(student__faculty_id=faculty_param) | models.Q(test__course__faculty__code__iexact=faculty_param))

        if course_param:
            exam_attempts = exam_attempts.filter(models.Q(exam__course_id=course_param) | models.Q(exam__course__code__iexact=course_param))
            test_attempts = test_attempts.filter(models.Q(test__course_id=course_param) | models.Q(test__course__code__iexact=course_param))

        avg_exam_score = round(sum(a.score for a in exam_attempts) / exam_attempts.count(), 1) if exam_attempts.exists() else 0.0
        avg_test_score = round(sum(a.score for a in test_attempts) / test_attempts.count(), 1) if test_attempts.exists() else 0.0

        exam_pass_count = sum(1 for a in exam_attempts if a.score >= 50.0)
        test_pass_count = sum(1 for a in test_attempts if a.passed)

        exam_pass_rate = round((exam_pass_count / exam_attempts.count()) * 100, 1) if exam_attempts.exists() else 0.0
        test_pass_rate = round((test_pass_count / test_attempts.count()) * 100, 1) if test_attempts.exists() else 0.0

        res_data = {
            'total_students': total_students,
            'total_lecturers': total_lecturers,
            'total_faculties': total_faculties,
            'total_courses': total_courses,
            'total_course_units': total_course_units,
            'total_exams': total_exams,
            'approved_exams': approved_exams,
            'dean_approved_exams': approved_exams,
            'total_tests': total_tests,
            'published_tests': published_tests,
            'published_active_tests': published_tests,
            'total_class_timetables': total_class_timetables,
            'total_exam_timetables': total_exam_timetables,
            'total_timetables': total_class_timetables,
            'avg_exam_score': avg_exam_score,
            'avg_test_score': avg_test_score,
            'exam_pass_rate': exam_pass_rate,
            'test_pass_rate': test_pass_rate,
            'total_exam_submissions': exam_attempts.count(),
            'total_test_submissions': test_attempts.count(),
            'total_exam_attempts': exam_attempts.count(),
            'total_test_attempts': test_attempts.count(),
            # Financial Clearance stats consuming CIU Cleared Students API
            'students_100_tuition': sum(1 for s in User.objects.filter(role='student') if check_student_clearance(s)['is_exam_cleared']),
            'students_50_tuition': sum(1 for s in User.objects.filter(role='student') if check_student_clearance(s)['is_test_cleared'] and not check_student_clearance(s)['is_exam_cleared']),
            'students_below_50_tuition': sum(1 for s in User.objects.filter(role='student') if not check_student_clearance(s)['is_test_cleared']),
            'total_api_cleared_students': sum(1 for s in User.objects.filter(role='student') if check_student_clearance(s)['is_api_cleared']),
            'external_api_total_records': len(fetch_external_cleared_students()) if isinstance(fetch_external_cleared_students(), list) else 0,
        }

        # Role-specific additions
        if user.role in ['dvc', 'vc', 'dean', 'admin', 'registrar', 'faculty_admin']:
            faculty_submissions = []
            faculties = Faculty.objects.all()

            for fac in faculties:
                fac_students = User.objects.filter(role='student', faculty=fac)
                fac_exam_attempts = ExamAttempt.objects.filter(
                    models.Q(exam__course__faculty=fac) | models.Q(student__faculty=fac),
                    completed_at__isnull=False
                ).distinct()
                fac_test_attempts = TestAttempt.objects.filter(
                    models.Q(test__course__faculty=fac) | models.Q(student__faculty=fac),
                    completed_at__isnull=False
                ).distinct()

                exam_pass_c = sum(1 for a in fac_exam_attempts if a.score >= 50.0)
                test_pass_c = sum(1 for a in fac_test_attempts if a.passed)

                fac_exam_pass_rate = round((exam_pass_c / fac_exam_attempts.count()) * 100, 1) if fac_exam_attempts.exists() else 0.0
                fac_test_pass_rate = round((test_pass_c / fac_test_attempts.count()) * 100, 1) if fac_test_attempts.exists() else 0.0

                faculty_submissions.append({
                    'faculty_id': fac.id,
                    'faculty_name': fac.name,
                    'faculty_code': fac.code,
                    'total_students': fac_students.count(),
                    'total_exam_submissions': fac_exam_attempts.count(),
                    'total_test_submissions': fac_test_attempts.count(),
                    'total_submissions': fac_exam_attempts.count() + fac_test_attempts.count(),
                    'exam_pass_rate': fac_exam_pass_rate,
                    'test_pass_rate': fac_test_pass_rate,
                })

            res_data['faculty_submissions'] = faculty_submissions

        if user.role == 'student':
            student_exam_attempts = ExamAttempt.objects.filter(student=user, completed_at__isnull=False)
            student_test_attempts = TestAttempt.objects.filter(student=user, completed_at__isnull=False)
            
            res_data['exams_done'] = student_exam_attempts.count()
            res_data['exams_passed'] = sum(1 for a in student_exam_attempts if a.score >= 50.0)
            res_data['exams_failed'] = res_data['exams_done'] - res_data['exams_passed']
            
            res_data['tests_done'] = student_test_attempts.count()
            res_data['tests_passed'] = sum(1 for a in student_test_attempts if a.passed)
            res_data['tests_failed'] = res_data['tests_done'] - res_data['tests_passed']

            res_data['average_exam_score'] = round(sum(a.score for a in student_exam_attempts) / student_exam_attempts.count(), 1) if student_exam_attempts.exists() else 0.0
            res_data['average_test_score'] = round(sum(a.score for a in student_test_attempts) / student_test_attempts.count(), 1) if student_test_attempts.exists() else 0.0
            res_data['attendance_count'] = AttendanceRecord.objects.filter(student=user).count()

            # Course Unit breakdown with ZERO for unsubmitted work!
            registered_units = CourseUnit.objects.filter(
                models.Q(course__applications__student=user, course__applications__status='approved') |
                models.Q(course__assigned_students=user) |
                models.Q(course__faculty=user.faculty)
            ).distinct()
            if not registered_units.exists():
                registered_units = CourseUnit.objects.all()[:10]

            course_reports = []
            for unit in registered_units:
                latest_exam_att = student_exam_attempts.filter(exam__course_unit=unit).order_by('-completed_at').first()
                if not latest_exam_att:
                    latest_exam_att = student_exam_attempts.filter(exam__course=unit.course).order_by('-completed_at').first()
                
                latest_test_att = student_test_attempts.filter(test__course_unit=unit).order_by('-completed_at').first()
                if not latest_test_att:
                    latest_test_att = student_test_attempts.filter(test__course=unit.course).order_by('-completed_at').first()

                exam_score = latest_exam_att.score if latest_exam_att else 0.0
                test_score = latest_test_att.score if latest_test_att else 0.0

                course_reports.append({
                    'id': unit.id,
                    'code': unit.code,
                    'name': unit.name,
                    'course_code': unit.course.code,
                    'exam_score': exam_score,
                    'test_score': test_score,
                    'has_exam_submission': bool(latest_exam_att),
                    'has_test_submission': bool(latest_test_att),
                    'status': 'PASSED' if (exam_score >= 50.0 or test_score >= 50.0) else ('NO SUBMISSIONS (0%)' if not (latest_exam_att or latest_test_att) else 'FAILED')
                })
            res_data['course_reports'] = course_reports

        elif user.role == 'lecturer':
            lecturer_exams = Exam.objects.filter(lecturer=user)
            lecturer_tests = Test.objects.filter(lecturer=user)
            lecturer_exam_att = ExamAttempt.objects.filter(exam__in=lecturer_exams, completed_at__isnull=False)
            lecturer_test_att = TestAttempt.objects.filter(test__in=lecturer_tests, completed_at__isnull=False)
            
            res_data['exams_created'] = lecturer_exams.count()
            res_data['tests_created'] = lecturer_tests.count()
            res_data['total_exam_submissions'] = lecturer_exam_att.count()
            res_data['total_test_submissions'] = lecturer_test_att.count()

            exam_pass = sum(1 for a in lecturer_exam_att if a.score >= 50.0)
            test_pass = sum(1 for a in lecturer_test_att if a.passed)
            res_data['exam_pass_rate'] = round((exam_pass / lecturer_exam_att.count()) * 100, 1) if lecturer_exam_att.exists() else 0.0
            res_data['test_pass_rate'] = round((test_pass / lecturer_test_att.count()) * 100, 1) if lecturer_test_att.exists() else 0.0

        return Response(res_data)

# 14. Class Timetable ViewSet
class ClassTimetableViewSet(viewsets.ModelViewSet):
    queryset = ClassTimetable.objects.all().order_by('class_date', 'day_of_week', 'start_time')
    serializer_class = ClassTimetableSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), (IsFacultyAdmin | IsAdmin)()]

    def get_queryset(self):
        user = self.request.user
        qs = ClassTimetable.objects.all().order_by('class_date', 'day_of_week', 'start_time')
        if not user or not user.is_authenticated:
            return qs.none()

        course_id = self.request.query_params.get('course')
        course_code = self.request.query_params.get('course_code')
        if course_id:
            return qs.filter(course_id=course_id)
        if course_code:
            return qs.filter(course__code__iexact=course_code)

        if user.role == 'student':
            student_year = getattr(user, 'year_of_study', 1) or 1
            approved_courses = Course.objects.filter(applications__student=user, applications__status='approved')
            if approved_courses.exists():
                return qs.filter(course__in=approved_courses).filter(models.Q(year_of_study=student_year) | models.Q(year_of_study=0))
            default_course = Course.objects.filter(code='BIT2026').first()
            if default_course:
                return qs.filter(course=default_course).filter(models.Q(year_of_study=student_year) | models.Q(year_of_study=0))
            if user.faculty:
                return qs.filter(faculty=user.faculty).filter(models.Q(year_of_study=student_year) | models.Q(year_of_study=0))

        elif user.role == 'dean':
            dean_faculty = user.faculty or (user.managed_faculties.first() if hasattr(user, 'managed_faculties') else None)
            if dean_faculty:
                return qs.filter(models.Q(faculty=dean_faculty) | models.Q(course__faculty=dean_faculty)).distinct()
        elif user.role == 'faculty_admin':
            sec_faculty = user.faculty or (user.administered_faculties.first() if hasattr(user, 'administered_faculties') else None)
            if sec_faculty:
                return qs.filter(models.Q(faculty=sec_faculty) | models.Q(course__faculty=sec_faculty)).distinct()
        elif user.role == 'lecturer':
            assigned_units = CourseUnit.objects.filter(lecturers=user)
            assigned_courses = Course.objects.filter(course_units__in=assigned_units).distinct()
            return qs.filter(models.Q(lecturer=user) | models.Q(course_unit__in=assigned_units) | models.Q(course__in=assigned_courses)).distinct()

        return qs

    def perform_create(self, serializer):
        user = self.request.user
        timetable = serializer.save(created_by=user)
        log_system_event(user, f"Class Timetable Created: {timetable.course.code} ({timetable.day_of_week})", level='INFO')

    def perform_destroy(self, instance):
        log_system_event(self.request.user, f"Class Timetable Deleted: {instance.course.code} ({instance.day_of_week})", level='WARNING')
        instance.delete()

# 15. Exam Timetable ViewSet
class ExamTimetableViewSet(viewsets.ModelViewSet):
    queryset = ExamTimetable.objects.all().order_by('exam_date', 'start_time')
    serializer_class = ExamTimetableSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), (IsRegistrar | IsAdmin)()]

    def get_queryset(self):
        user = self.request.user
        qs = ExamTimetable.objects.all().order_by('exam_date', 'start_time')
        if not user or not user.is_authenticated:
            return qs.none()

        course_id = self.request.query_params.get('course')
        course_code = self.request.query_params.get('course_code')
        if course_id:
            return qs.filter(course_id=course_id)
        if course_code:
            return qs.filter(course__code__iexact=course_code)

        if user.role == 'student':
            student_year = getattr(user, 'year_of_study', 1) or 1
            approved_courses = Course.objects.filter(applications__student=user, applications__status='approved')
            if approved_courses.exists():
                return qs.filter(course__in=approved_courses).filter(models.Q(year_of_study=student_year) | models.Q(year_of_study=0))
            default_course = Course.objects.filter(code='BIT2026').first()
            if default_course:
                return qs.filter(course=default_course).filter(models.Q(year_of_study=student_year) | models.Q(year_of_study=0))
            if user.faculty:
                return qs.filter(faculty=user.faculty).filter(models.Q(year_of_study=student_year) | models.Q(year_of_study=0))

        elif user.role == 'dean':
            dean_faculty = user.faculty or (user.managed_faculties.first() if hasattr(user, 'managed_faculties') else None)
            if dean_faculty:
                return qs.filter(models.Q(faculty=dean_faculty) | models.Q(course__faculty=dean_faculty)).distinct()
        elif user.role == 'faculty_admin':
            sec_faculty = user.faculty or (user.administered_faculties.first() if hasattr(user, 'administered_faculties') else None)
            if sec_faculty:
                return qs.filter(models.Q(faculty=sec_faculty) | models.Q(course__faculty=sec_faculty)).distinct()

        elif user.role == 'lecturer':
            assigned_units = CourseUnit.objects.filter(lecturers=user)
            assigned_courses = Course.objects.filter(course_units__in=assigned_units).distinct()
            return qs.filter(models.Q(invigilator=user) | models.Q(course_unit__in=assigned_units) | models.Q(course__in=assigned_courses)).distinct()

        return qs

    def perform_create(self, serializer):
        user = self.request.user
        timetable = serializer.save(created_by=user)
        log_system_event(user, f"Exam Timetable Created: {timetable.title} on {timetable.exam_date}", level='INFO')

    def perform_destroy(self, instance):
        log_system_event(self.request.user, f"Exam Timetable Deleted: {instance.title}", level='WARNING')
        instance.delete()

# 16. System Audit Log ViewSet
class SystemLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SystemLog.objects.all().order_by('-timestamp')
    serializer_class = SystemLogSerializer

    def get_permissions(self):
        if self.action == 'export_csv':
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated(), IsAdmin()]

    def get_queryset(self):
        qs = super().get_queryset()
        level = self.request.query_params.get('level')
        search = self.request.query_params.get('search')
        if level and level != 'ALL':
            qs = qs.filter(level=level.upper())
        if search:
            qs = qs.filter(action__icontains=search) | qs.filter(details__icontains=search) | qs.filter(user__username__icontains=search)
        return qs

    @action(detail=False, methods=['get'])
    def export_csv(self, request):
        authenticate_token_param(request)
        if not request.user or not request.user.is_authenticated or request.user.role != 'admin':
            return Response({'detail': 'Authentication credentials were not provided or unauthorized.'}, status=status.HTTP_401_UNAUTHORIZED)

        qs = self.get_queryset()
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="System_Audit_Logs_{timezone.now().strftime("%Y%m%d_%H%M")}.csv"'

        writer = csv.writer(response)
        writer.writerow(['Timestamp', 'Level', 'User', 'Role', 'Action Event', 'Audit Details', 'IP Address'])

        for log in qs:
            writer.writerow([
                log.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                log.level,
                log.user.username if log.user else 'System',
                log.user.role if log.user else 'N/A',
                log.action,
                log.details or '',
                log.ip_address or ''
            ])

        return response

# 17. Proctoring Settings ViewSet (System Admin Controlled)
class ProctoringSettingViewSet(viewsets.ModelViewSet):
    queryset = ProctoringSetting.objects.all()
    serializer_class = ProctoringSettingSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), IsAdmin()]

    def list(self, request, *args, **kwargs):
        setting, _ = ProctoringSetting.objects.get_or_create(id=1, defaults={'is_proctoring_enabled': True, 'require_webcam': True})
        return Response(ProctoringSettingSerializer(setting).data)

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsAdmin])
    def toggle(self, request):
        setting, _ = ProctoringSetting.objects.get_or_create(id=1, defaults={'is_proctoring_enabled': True, 'require_webcam': True})
        new_val = request.data.get('is_proctoring_enabled')
        if new_val is not None:
            setting.is_proctoring_enabled = bool(new_val)
        else:
            setting.is_proctoring_enabled = not setting.is_proctoring_enabled
        setting.updated_by = request.user
        setting.save()
        log_system_event(request.user, f"Global Live Assessment Proctoring set to {setting.is_proctoring_enabled}", level='AUDIT')
        return Response({
            'detail': f"Global live assessment proctoring system {'ACTIVATED' if setting.is_proctoring_enabled else 'DEACTIVATED'}.",
            'is_proctoring_enabled': setting.is_proctoring_enabled
        })


# 18. Temporary Clearance Management ViewSet
class TemporaryClearanceViewSet(viewsets.ModelViewSet):
    serializer_class = TemporaryClearanceSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), (IsAdmin | IsRegistrar | IsFacultyAdmin | IsDean)()]

    def get_queryset(self):
        user = self.request.user
        qs = TemporaryClearance.objects.select_related('student', 'granted_by', 'student__faculty').all().order_by('-created_at')
        if user.role == 'student':
            qs = qs.filter(student=user)
        elif user.role == 'faculty_admin':
            qs = qs.filter(student__faculty=user.administered_faculties.first())
        elif user.role == 'dean':
            qs = qs.filter(student__faculty=user.managed_faculties.first())
        return qs

    def perform_create(self, serializer):
        duration_days = int(self.request.data.get('duration_days', 7))
        custom_expiry = self.request.data.get('expires_at')
        if custom_expiry:
            expires_at = timezone.datetime.fromisoformat(custom_expiry.replace('Z', '+00:00'))
        else:
            expires_at = timezone.now() + timezone.timedelta(days=duration_days)

        clearance = serializer.save(granted_by=self.request.user, expires_at=expires_at)
        log_system_event(
            self.request.user,
            "TEMPORARY_CLEARANCE_GRANTED",
            level="AUDIT",
            details=f"Granted temporary clearance ({clearance.clearance_type}) for student {clearance.student.username} until {clearance.expires_at.strftime('%Y-%m-%d %H:%M')}."
        )

    @action(detail=True, methods=['post'])
    def revoke(self, request, pk=None):
        clearance = self.get_object()
        clearance.is_active = False
        clearance.save()
        log_system_event(request.user, "TEMPORARY_CLEARANCE_REVOKED", level="AUDIT", details=f"Revoked temporary clearance for {clearance.student.username}")
        return Response({'detail': f'Temporary clearance for {clearance.student.username} revoked.'})

    @action(detail=True, methods=['post'])
    def extend(self, request, pk=None):
        clearance = self.get_object()
        days = int(request.data.get('days', 7))
        clearance.expires_at = clearance.expires_at + timezone.timedelta(days=days)
        clearance.is_active = True
        clearance.save()
        log_system_event(request.user, "TEMPORARY_CLEARANCE_EXTENDED", level="AUDIT", details=f"Extended temporary clearance for {clearance.student.username} by {days} days.")
        return Response({'detail': f'Extended clearance by {days} days until {clearance.expires_at.strftime("%Y-%m-%d %H:%M")}.'})

    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        student_ids = request.data.get('student_ids', [])
        duration_days = int(request.data.get('duration_days', 7))
        clearance_type = request.data.get('clearance_type', 'both')
        reason = request.data.get('reason', 'Bulk Administrative Clearance Override')

        if not student_ids:
            return Response({'detail': 'student_ids list is required.'}, status=status.HTTP_400_BAD_REQUEST)

        expires_at = timezone.now() + timezone.timedelta(days=duration_days)
        created_count = 0
        students = User.objects.filter(id__in=student_ids, role='student')
        for s in students:
            TemporaryClearance.objects.create(
                student=s,
                granted_by=request.user,
                clearance_type=clearance_type,
                expires_at=expires_at,
                reason=reason,
                is_active=True
            )
            created_count += 1

        log_system_event(request.user, "TEMPORARY_CLEARANCE_BULK_GRANTED", level="AUDIT", details=f"Bulk granted clearance for {created_count} students for {duration_days} days.")
        return Response({'detail': f'Granted temporary clearance for {created_count} students.', 'count': created_count})

    @action(detail=False, methods=['post'])
    def upload_bulk_clearance(self, request):
        file_obj = request.FILES.get('file') or request.FILES.get('excel_file')
        if not file_obj:
            return Response({'detail': 'Please upload an Excel (.xlsx/.xls) or CSV (.csv) file.'}, status=status.HTTP_400_BAD_REQUEST)

        duration_days = int(request.data.get('duration_days', 7))
        clearance_type = request.data.get('clearance_type', 'both')
        reason = request.data.get('reason', 'Bulk Excel Temporary Clearance Grant')
        expires_at = timezone.now() + timezone.timedelta(days=duration_days)

        filename = file_obj.name.lower()
        reg_numbers_or_usernames = []

        try:
            if filename.endswith('.csv'):
                decoded = file_obj.read().decode('utf-8-sig', errors='ignore')
                reader = csv.reader(decoded.splitlines())
                header = None
                for r in reader:
                    if not r or not any(r): continue
                    if header is None:
                        header = [c.strip().lower() for c in r]
                        continue
                    row_dict = {header[i]: r[i].strip() for i in range(min(len(header), len(r)))}
                    val = row_dict.get('reg_number') or row_dict.get('registration_number') or row_dict.get('reg_no') or row_dict.get('username') or row_dict.get('student_no') or (r[0].strip() if r else '')
                    if val:
                        reg_numbers_or_usernames.append(val)
            elif filename.endswith(('.xlsx', '.xls')):
                import openpyxl
                wb = openpyxl.load_workbook(file_obj, data_only=True)
                ws = wb.active
                header = None
                for row in ws.iter_rows(values_only=True):
                    if not row or not any(row): continue
                    row_vals = [str(cell).strip() if cell is not None else '' for cell in row]
                    if header is None:
                        header = [c.lower() for c in row_vals]
                        continue
                    row_dict = {header[i]: row_vals[i] for i in range(min(len(header), len(row_vals)))}
                    val = row_dict.get('reg_number') or row_dict.get('registration_number') or row_dict.get('reg_no') or row_dict.get('username') or row_dict.get('student_no') or (row_vals[0] if row_vals else '')
                    if val:
                        reg_numbers_or_usernames.append(val)
        except Exception as e:
            return Response({'detail': f'Error parsing Excel/CSV file: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        created_count = 0
        cleared_students = []
        for term in reg_numbers_or_usernames:
            term_clean = term.strip().upper()
            student = User.objects.filter(
                models.Q(role='student') & (
                    models.Q(reg_number__iexact=term_clean) |
                    models.Q(username__iexact=term_clean) |
                    models.Q(email__iexact=term_clean)
                )
            ).first()

            if not student:
                for s in User.objects.filter(role='student'):
                    if s.registration_number and s.registration_number.upper() == term_clean:
                        student = s
                        break

            if student:
                TemporaryClearance.objects.create(
                    student=student,
                    granted_by=request.user,
                    clearance_type=clearance_type,
                    expires_at=expires_at,
                    reason=reason,
                    is_active=True
                )
                created_count += 1
                cleared_students.append({
                    'id': student.id,
                    'username': student.username,
                    'reg_number': student.reg_number or student.registration_number,
                    'name': student.get_full_name() or student.username,
                    'expires_at': expires_at.strftime('%Y-%m-%d %H:%M')
                })

        log_system_event(request.user, "TEMPORARY_CLEARANCE_EXCEL_GRANTED", level="AUDIT", details=f"Granted bulk temporary clearance for {created_count} students via Excel import.")
        return Response({
            'detail': f'Successfully granted temporary clearance for {created_count} students.',
            'count': created_count,
            'cleared_students': cleared_students
        })



# 19. Question Bank ViewSets
class QuestionBankViewSet(viewsets.ModelViewSet):
    serializer_class = QuestionBankSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), IsLecturer | IsAdmin | IsFacultyAdmin()]

    def get_queryset(self):
        user = self.request.user
        qs = QuestionBank.objects.select_related('course', 'course_unit', 'created_by').prefetch_related('items').all().order_by('-created_at')
        if user.role == 'lecturer':
            return qs.filter(models.Q(created_by=user) | models.Q(course__units__lecturers=user)).distinct()
        return qs

    def perform_create(self, serializer):
        bank = serializer.save(created_by=self.request.user)
        log_system_event(self.request.user, "QUESTION_BANK_CREATED", level="INFO", details=f"Created Question Bank: {bank.title} ({bank.course.code})")

    @action(detail=True, methods=['post'])
    def import_to_test(self, request, pk=None):
        bank = self.get_object()
        test_id = request.data.get('test_id')
        exam_id = request.data.get('exam_id')

        if not test_id and not exam_id:
            return Response({'detail': 'test_id or exam_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        imported_count = 0
        if test_id:
            try:
                test_obj = Test.objects.get(id=test_id)
                for item in bank.items.all():
                    TestQuestion.objects.create(
                        test=test_obj,
                        question_text=item.question_text,
                        question_type=item.question_type,
                        option_a=item.option_a,
                        option_b=item.option_b,
                        option_c=item.option_c,
                        option_d=item.option_d,
                        correct_answer=item.correct_answer,
                        points=item.points,
                        explanation=item.explanation
                    )
                    imported_count += 1
                log_system_event(request.user, "QUESTION_BANK_IMPORTED", level="INFO", details=f"Imported {imported_count} questions from bank '{bank.title}' into test '{test_obj.title}'")
            except Test.DoesNotExist:
                return Response({'detail': 'Test not found.'}, status=status.HTTP_404_NOT_FOUND)
        elif exam_id:
            try:
                exam_obj = Exam.objects.get(id=exam_id)
                for item in bank.items.all():
                    Question.objects.create(
                        exam=exam_obj,
                        question_text=item.question_text,
                        option_a=item.option_a or '',
                        option_b=item.option_b or '',
                        option_c=item.option_c or '',
                        option_d=item.option_d or '',
                        correct_option=(item.correct_answer.strip().upper() if item.correct_answer else 'A')[:1]
                    )
                    imported_count += 1
                log_system_event(request.user, "QUESTION_BANK_IMPORTED", level="INFO", details=f"Imported {imported_count} questions from bank '{bank.title}' into exam '{exam_obj.title}'")
            except Exam.DoesNotExist:
                return Response({'detail': 'Exam not found.'}, status=status.HTTP_404_NOT_FOUND)

        return Response({'detail': f'Successfully imported {imported_count} questions from Question Bank.', 'count': imported_count})


class QuestionBankItemViewSet(viewsets.ModelViewSet):
    serializer_class = QuestionBankItemSerializer
    permission_classes = [permissions.IsAuthenticated, IsLecturer | IsAdmin | IsFacultyAdmin]

    def get_queryset(self):
        return QuestionBankItem.objects.all()


# 20. Proctoring Monitoring ViewSet
class ProctoringMonitorViewSet(viewsets.ModelViewSet):
    serializer_class = ProctorSnapshotSerializer

    def get_permissions(self):
        if self.action == 'stream_snapshot':
            return [permissions.IsAuthenticated(), IsStudent()]
        return [permissions.IsAuthenticated(), IsStaffUser()]

    def get_queryset(self):
        user = self.request.user
        qs = ProctorSnapshot.objects.select_related('student', 'test', 'exam', 'student__faculty').all().order_by('-captured_at')
        if user.role == 'student':
            qs = qs.filter(student=user)
        return qs

    @action(detail=False, methods=['post'])
    def stream_snapshot(self, request):
        student = request.user
        image_data = request.data.get('image_data')
        test_id = request.data.get('test_id')
        exam_id = request.data.get('exam_id')
        tab_switches = int(request.data.get('tab_switches', 0))
        is_camera_active = bool(request.data.get('is_camera_active', True))
        flag_reason = request.data.get('flag_reason', None)

        if not image_data:
            return Response({'detail': 'image_data string is required.'}, status=status.HTTP_400_BAD_REQUEST)

        test_obj = Test.objects.filter(id=test_id).first() if test_id else None
        exam_obj = Exam.objects.filter(id=exam_id).first() if exam_id else None

        snapshot = ProctorSnapshot.objects.create(
            student=student,
            test=test_obj,
            exam=exam_obj,
            image_data=image_data,
            tab_switches_count=tab_switches,
            is_camera_active=is_camera_active,
            flag_reason=flag_reason
        )

        if not is_camera_active or tab_switches >= 3:
            log_system_event(student, "PROCTORING_FLAGGED", level="WARNING", details=f"Candidate camera inactive or high tab switches ({tab_switches}) during test/exam.")

        return Response(ProctorSnapshotSerializer(snapshot).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def live_feeds(self, request):
        latest_snapshots = []
        students_seen = set()
        recent_cutoff = timezone.now() - timezone.timedelta(minutes=15)
        
        snapshots = ProctorSnapshot.objects.select_related('student', 'test', 'exam', 'student__faculty').filter(captured_at__gte=recent_cutoff).order_by('-captured_at')
        for snap in snapshots:
            if snap.student_id not in students_seen:
                students_seen.add(snap.student_id)
                latest_snapshots.append(snap)

        return Response(ProctorSnapshotSerializer(latest_snapshots, many=True).data)

    @action(detail=False, methods=['post'])
    def issue_warning(self, request):
        student_id = request.data.get('student_id')
        warning_msg = request.data.get('message', 'Exam Officer Alert: Please ensure your face is visible on webcam.')
        action_type = request.data.get('action', 'warning')

        try:
            student = User.objects.get(id=student_id, role='student')
            if action_type == 'terminate':
                log_system_event(request.user, "PROCTOR_ATTEMPT_TERMINATED", level="AUDIT", details=f"Terminated exam attempt for student {student.username}. Reason: {warning_msg}")
                return Response({'detail': f'Terminated exam attempt for {student.username}.', 'action': 'terminate'})
            else:
                log_system_event(request.user, "PROCTOR_WARNING_ISSUED", level="WARNING", details=f"Issued proctor warning to {student.username}: {warning_msg}")
                return Response({'detail': f'Warning issued to candidate {student.username}.', 'action': 'warning'})
        except User.DoesNotExist:
            return Response({'detail': 'Student not found.'}, status=status.HTTP_404_NOT_FOUND)

