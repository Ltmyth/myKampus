import csv
import re
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

from .permissions import IsAdmin, IsPlatformCoordinator, IsDVC, IsDean, IsFacultyAdmin, IsRegistrar, IsLecturer, IsStudent, IsStaffUser, IsExecutiveReadOnly
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
        current_password = request.data.get('current_password') or request.data.get('old_password')
        new_password = request.data.get('new_password') or request.data.get('password')

        if not current_password or not new_password:
            return Response({'detail': 'Both current password and new password are required.'}, status=status.HTTP_400_BAD_REQUEST)

        if not user.check_password(current_password):
            return Response({'detail': 'Current password does not match.'}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.must_change_password = False
        user.save()

        log_system_event(user, "USER_PASSWORD_CHANGED", level="AUDIT", details=f"User {user.username} updated password successfully.")
        
        serializer = UserSerializer(user)
        return Response({
            'detail': 'Password changed successfully!',
            'user': serializer.data
        })

def get_user_assigned_faculties(user):
    if not user or not user.is_authenticated:
        return Faculty.objects.none()
    if user.role in ['admin', 'platform_coordinator', 'registrar', 'dvc', 'vc']:
        return Faculty.objects.all()
    
    facs = Faculty.objects.filter(
        models.Q(id=user.faculty_id) |
        models.Q(dean=user) |
        models.Q(secretary=user)
    ).distinct()

    if not facs.exists() and getattr(user, 'faculty', None):
        facs = Faculty.objects.filter(id=user.faculty.id)

    return facs

def clean_sheet_cell(val):
    if val is None:
        return ''
    if isinstance(val, float) and val.is_integer():
        return str(int(val))
    return str(val).strip()

def generate_excel_response(filename, headers, sample_rows, sheet_title="Template"):
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter
    import io

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = sheet_title
    if hasattr(ws, 'views') and len(ws.views.sheetView) > 0:
        ws.views.sheetView[0].showGridLines = True

    header_font = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="1B4D3E", end_color="1B4D3E", fill_type="solid") # CIU Deep Forest Green
    header_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
    
    cell_font = Font(name="Segoe UI", size=10)
    thin_border = Border(
        left=Side(style='thin', color='D0D7DE'),
        right=Side(style='thin', color='D0D7DE'),
        top=Side(style='thin', color='D0D7DE'),
        bottom=Side(style='thin', color='D0D7DE')
    )

    ws.append(headers)
    for cell in ws[1]:
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align
        cell.border = thin_border
    ws.row_dimensions[1].height = 28

    for row_idx, row_data in enumerate(sample_rows, start=2):
        ws.append(row_data)
        ws.row_dimensions[row_idx].height = 20
        for cell in ws[row_idx]:
            cell.font = cell_font
            cell.border = thin_border
            cell.alignment = Alignment(vertical="center")

    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            val_str = str(cell.value or '')
            max_len = max(max_len, len(val_str))
        ws.column_dimensions[col_letter].width = max(max_len + 5, 15)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    response = HttpResponse(
        output.getvalue(),
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response

def generate_csv_response(filename, headers, sample_rows):
    response = HttpResponse(content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    writer = csv.writer(response)
    writer.writerow(headers)
    for r in sample_rows:
        writer.writerow(r)
    return response

# 4. System Admin User Management ViewSet
class AdminUserViewSet(viewsets.ModelViewSet):
    serializer_class = AdminUserSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        if self.action in ['promote_class', 'promote_students']:
            return [permissions.IsAuthenticated(), (IsAdmin | IsPlatformCoordinator | IsLecturer | IsFacultyAdmin | IsDean)()]
        if self.action in ['sample_student_file', 'sample_staff_file', 'sample_allocation_csv', 'sample_student_csv', 'sample_student_excel', 'sample_staff_csv', 'sample_staff_excel']:
            return [permissions.AllowAny()]
        if self.action in ['upload_students', 'bulk_allocate_csv']:
            return [permissions.IsAuthenticated(), (IsAdmin | IsPlatformCoordinator | IsFacultyAdmin | IsRegistrar)()]
        if self.action in ['bulk_onboard_staff']:
            return [permissions.IsAuthenticated(), (IsAdmin | IsPlatformCoordinator)()]
        return [permissions.IsAuthenticated(), IsAdmin()]

    def perform_content_negotiation(self, request, force=False):
        if self.action in ['sample_student_file', 'sample_staff_file', 'sample_allocation_csv', 'sample_student_csv', 'sample_student_excel', 'sample_staff_csv', 'sample_staff_excel']:
            from rest_framework.renderers import JSONRenderer
            return (JSONRenderer(), 'application/json')
        return super().perform_content_negotiation(request, force=force)

    def get_queryset(self):
        user = self.request.user
        qs = User.objects.all().order_by('-date_joined')
        role_param = self.request.query_params.get('role')
        if role_param:
            qs = qs.filter(role=role_param)

        entry_year_param = self.request.query_params.get('entry_year')
        if entry_year_param and entry_year_param != 'All':
            try:
                qs = qs.filter(entry_year=int(entry_year_param))
            except (ValueError, TypeError):
                pass

        intake_param = self.request.query_params.get('intake')
        if intake_param and intake_param != 'All':
            qs = qs.filter(intake__iexact=intake_param.strip())

        faculty_param = self.request.query_params.get('faculty')
        if faculty_param and faculty_param != 'All':
            if str(faculty_param).isdigit():
                qs = qs.filter(faculty_id=int(faculty_param))
            else:
                qs = qs.filter(faculty__code__iexact=faculty_param.strip())

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
        elif user.role in ['dean', 'faculty_admin', 'faculty_secretary']:
            assigned_facs = get_user_assigned_faculties(user)
            return qs.filter(
                models.Q(faculty__in=assigned_facs) |
                models.Q(assigned_courses__faculty__in=assigned_facs) |
                models.Q(assigned_course_units__course__faculty__in=assigned_facs)
            ).distinct().order_by('-date_joined')
        return qs

    def perform_create(self, serializer):
        user_obj = serializer.save()
        raw_pass = self.request.data.get('password') or self.request.data.get('new_password')
        if raw_pass:
            user_obj.set_password(str(raw_pass).strip())
            user_obj.must_change_password = True
            user_obj.save()

    def perform_update(self, serializer):
        user_obj = serializer.save()
        raw_pass = self.request.data.get('password') or self.request.data.get('new_password')
        if raw_pass:
            user_obj.set_password(str(raw_pass).strip())
            user_obj.save()

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

    def update(self, request, *args, **kwargs):
        user_obj = self.get_object()
        if request.user.role == 'platform_coordinator' and user_obj.role == 'admin':
            if 'password' in request.data or 'new_password' in request.data:
                return Response({'detail': 'Platform Coordinator cannot reset or change System Admin password.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        user_obj = self.get_object()
        if request.user.role == 'platform_coordinator' and user_obj.role == 'admin':
            return Response({'detail': 'Platform Coordinator cannot delete System Admin accounts.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsAdmin])
    def reset_password(self, request, pk=None):
        user_obj = self.get_object()
        if request.user.role == 'platform_coordinator' and user_obj.role == 'admin':
            return Response({'detail': 'Platform Coordinator cannot reset System Admin password.'}, status=status.HTTP_403_FORBIDDEN)
        new_password = (request.data.get('new_password') or request.data.get('password') or '').strip()
        if not new_password:
            return Response({'detail': 'New password parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)
        user_obj.set_password(new_password)
        user_obj.must_change_password = True
        user_obj.save()
        log_system_event(request.user, f"Admin Password Reset for user: {user_obj.username} ({user_obj.role})", level="INFO")
        return Response({
            'detail': f"Password for {user_obj.username} has been reset successfully.",
            'username': user_obj.username,
            'new_password': new_password
        })

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsAdmin])
    def bulk_delete(self, request):
        user_ids = request.data.get('user_ids', [])
        if not user_ids or not isinstance(user_ids, list):
            return Response({'detail': 'Please provide a non-empty list of user_ids to delete.'}, status=status.HTTP_400_BAD_REQUEST)
        
        user_ids = [uid for uid in user_ids if uid != request.user.id]
        qs = User.objects.filter(id__in=user_ids)
        if request.user.role == 'platform_coordinator':
            qs = qs.exclude(role='admin')
        deleted_count, _ = qs.delete()
        log_system_event(request.user, "BULK_USER_DELETE_SUCCESS", level="AUDIT", details=f"Admin deleted {deleted_count} user accounts in bulk.")
        return Response({
            'detail': f'Successfully deleted {deleted_count} selected user accounts.',
            'count': deleted_count
        })

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsAdmin])
    def bulk_reset_passwords(self, request):
        user_ids = request.data.get('user_ids', [])
        new_password = (request.data.get('new_password') or request.data.get('password') or '').strip()
        if not user_ids or not isinstance(user_ids, list):
            return Response({'detail': 'Please provide a non-empty list of user_ids.'}, status=status.HTTP_400_BAD_REQUEST)
        if not new_password:
            return Response({'detail': 'new_password parameter is required for bulk password reset.'}, status=status.HTTP_400_BAD_REQUEST)

        users_to_update = User.objects.filter(id__in=user_ids)
        if request.user.role == 'platform_coordinator':
            users_to_update = users_to_update.exclude(role='admin')

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
            'count': updated_count,
            'new_password': new_password
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

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsAdmin | IsFacultyAdmin | IsRegistrar])
    def bulk_allocate_csv(self, request):
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
        allocated_count = 0
        duplicate_count = 0
        not_found_count = 0
        total_rows = 0
        seen_entries = set()

        for row in reader:
            if not row or not any(row):
                continue
            if header is None:
                header = [c.strip().lower() for c in row]
                continue

            total_rows += 1
            row_dict = {}
            for i, val in enumerate(row):
                if i < len(header):
                    row_dict[header[i]] = val.strip()

            reg_num = (row_dict.get('reg_number') or row_dict.get('reg_no') or row_dict.get('reg no') or
                       row_dict.get('registration_number') or row_dict.get('student_id') or
                       row_dict.get('username') or row_dict.get('email') or '')
            faculty_code = (row_dict.get('faculty_code') or row_dict.get('faculty') or row_dict.get('faculty code') or
                            row_dict.get('fac') or '')
            course_code = (row_dict.get('course_code') or row_dict.get('course') or row_dict.get('course code') or
                           row_dict.get('program') or row_dict.get('program_code') or '')
            year_val_raw = (row_dict.get('year_of_study') or row_dict.get('year') or row_dict.get('year of study') or
                            row_dict.get('yos') or '')
            semester_raw = (row_dict.get('semester') or row_dict.get('sem') or '')

            if not reg_num:
                continue

            # Deduplication key across file batch
            batch_key = (reg_num.lower(), faculty_code.lower(), course_code.lower(), str(year_val_raw), str(semester_raw))
            if batch_key in seen_entries:
                duplicate_count += 1
                continue
            seen_entries.add(batch_key)

            # Locate student
            student = (User.objects.filter(role='student', reg_number__iexact=reg_num).first() or
                       User.objects.filter(role='student', username__iexact=reg_num).first() or
                       User.objects.filter(role='student', email__iexact=reg_num).first() or
                       User.objects.filter(reg_number__iexact=reg_num).first())

            if not student:
                not_found_count += 1
                continue

            # Check Faculty restrictions for Faculty Admin / Secretary
            target_fac = None
            if faculty_code:
                target_fac = Faculty.objects.filter(code__iexact=faculty_code).first() or Faculty.objects.filter(name__icontains=faculty_code).first()

            if request.user.role in ['faculty_admin', 'dean']:
                user_fac = request.user.faculty or (request.user.administered_faculties.first() if hasattr(request.user, 'administered_faculties') else None)
                if user_fac and target_fac and target_fac != user_fac:
                    continue

            # Course lookup
            target_course = None
            if course_code:
                target_course = Course.objects.filter(code__iexact=course_code).first() or Course.objects.filter(name__icontains=course_code).first()

            # Year of study
            year_val = None
            if year_val_raw:
                cleaned_yr = re.sub(r'[^\d]', '', str(year_val_raw))
                if cleaned_yr and int(cleaned_yr) in [1, 2, 3, 4]:
                    year_val = int(cleaned_yr)

            # Semester
            sem_val = None
            if semester_raw:
                cleaned_sem = re.sub(r'[^\d]', '', str(semester_raw))
                if cleaned_sem and int(cleaned_sem) in [1, 2]:
                    sem_val = int(cleaned_sem)

            # Check if student already has this exact allocation (idempotent / duplicate ignore)
            is_already_allocated = True
            if target_fac and student.faculty != target_fac:
                is_already_allocated = False
            if target_course and not student.assigned_courses.filter(id=target_course.id).exists():
                is_already_allocated = False
            if year_val is not None and student.year_of_study != year_val:
                is_already_allocated = False
            if sem_val is not None and student.semester != sem_val:
                is_already_allocated = False

            if is_already_allocated:
                duplicate_count += 1
                continue

            # Apply changes
            if target_fac:
                student.faculty = target_fac
            if year_val is not None:
                student.year_of_study = year_val
            if sem_val is not None:
                student.semester = sem_val
            student.save()

            if target_course:
                student.assigned_courses.add(target_course)

            allocated_count += 1

        msg = f"Bulk student allocation completed: {allocated_count} unique student allocation(s) applied. {duplicate_count} duplicate row(s) ignored."
        log_system_event(request.user, "BULK_STUDENT_ALLOCATION_CSV_SUCCESS", level="AUDIT", details=msg)
        return Response({
            'detail': msg,
            'allocated_count': allocated_count,
            'updated': allocated_count,
            'duplicate_count': duplicate_count,
            'skipped_duplicates': duplicate_count,
            'not_found_count': not_found_count,
            'total_rows': total_rows
        })

    @action(detail=False, methods=['get'])
    def sample_allocation_csv(self, request):
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="sample_student_allocations.csv"'
        writer = csv.writer(response)
        writer.writerow(['reg_number', 'faculty_code', 'course_code', 'year_of_study', 'semester'])
        writer.writerow(['2026SOBAT-A001', 'SOBAT', 'BIT2026', '2', '1'])
        writer.writerow(['2026FST-A002', 'FST', 'BCS2026', '1', '2'])
        writer.writerow(['2026FAS-A003', 'FAS', 'BSN2026', '3', '1'])
        return response

    @action(detail=False, methods=['get'])
    def sample_student_file(self, request):
        fmt = request.query_params.get('format', 'csv').lower().strip()
        headers = ['Registration Number', 'Full Name', 'Email', 'Faculty Code', 'Entry Year', 'Intake', 'Year of Study', 'Semester', 'Phone Contact']
        sample_rows = [
            ['2026SOBAT-B001', 'KIGOZI IVAN', 'ikigozi@ciu.ac.ug', 'SOBAT', 2026, 'August Intake', 1, 1, '0772123456'],
            ['2026FST-B002', 'NAMUGANGA SARAH', 'snamuganga@ciu.ac.ug', 'FST', 2026, 'August Intake', 1, 1, '0701987654'],
            ['2026SONM-B003', 'ATUHAIRE PATIENCE', 'patuhaire@ciu.ac.ug', 'SONM', 2026, 'August Intake', 1, 1, '0783456789'],
            ['2026SOPH-B004', 'MUGISHA BRIAN', 'bmugisha@ciu.ac.ug', 'SOPH', 2026, 'January Intake', 1, 1, '0754112233'],
            ['2026IAH-B005', 'NAJJEMBA GLORIA', 'gnajjemba@ciu.ac.ug', 'IAH', 2026, 'August Intake', 1, 1, '0778990011']
        ]
        if fmt in ['xlsx', 'excel', 'xls']:
            return generate_excel_response('sample_student_onboarding.xlsx', headers, sample_rows, sheet_title="Students Onboarding")
        return generate_csv_response('sample_student_onboarding.csv', headers, sample_rows)

    @action(detail=False, methods=['get'])
    def sample_student_csv(self, request):
        return self.sample_student_file(request)

    @action(detail=False, methods=['get'])
    def sample_student_excel(self, request):
        headers = ['Registration Number', 'Full Name', 'Email', 'Faculty Code', 'Entry Year', 'Intake', 'Year of Study', 'Semester', 'Phone Contact']
        sample_rows = [
            ['2026SOBAT-B001', 'KIGOZI IVAN', 'ikigozi@ciu.ac.ug', 'SOBAT', 2026, 'August Intake', 1, 1, '0772123456'],
            ['2026FST-B002', 'NAMUGANGA SARAH', 'snamuganga@ciu.ac.ug', 'FST', 2026, 'August Intake', 1, 1, '0701987654'],
            ['2026SONM-B003', 'ATUHAIRE PATIENCE', 'patuhaire@ciu.ac.ug', 'SONM', 2026, 'August Intake', 1, 1, '0783456789'],
            ['2026SOPH-B004', 'MUGISHA BRIAN', 'bmugisha@ciu.ac.ug', 'SOPH', 2026, 'January Intake', 1, 1, '0754112233'],
            ['2026IAH-B005', 'NAJJEMBA GLORIA', 'gnajjemba@ciu.ac.ug', 'IAH', 2026, 'August Intake', 1, 1, '0778990011']
        ]
        return generate_excel_response('sample_student_onboarding.xlsx', headers, sample_rows, sheet_title="Students Onboarding")

    @action(detail=False, methods=['get'])
    def sample_staff_file(self, request):
        fmt = request.query_params.get('format', 'csv').lower().strip()
        headers = ['Employee Name', 'Phone Contact', 'Email', 'User Name', 'Role', 'Faculty Code']
        sample_rows = [
            ['JOHN CHARLES OKIRIA', '0772409126', 'jokiria@ciu.ac.ug', 'CIU01', 'lecturer', 'SOBAT'],
            ['DR. SENGOOBA ASUMAN', '0702487553', 'asengooba@ciu.ac.ug', 'CIU02', 'lecturer', 'FST'],
            ['LONY TITUS OKELLO', '0772557156', 'tlony@ciu.ac.ug', 'CIU03', 'lecturer', 'FAS'],
            ['TUSUUBIRA SHARIFU', '0770000000', 'stusuubira@ciu.ac.ug', 'CIU04', 'lecturer', 'SOBAT'],
            ['DR. NAKITTO MARIA', '0782334455', 'mnakitto@ciu.ac.ug', 'CIU05', 'faculty_admin', 'SOBAT'],
            ['PROF. SSEMAKULA PETER', '0752112233', 'pssemakula@ciu.ac.ug', 'CIU06', 'dean', 'FST']
        ]
        if fmt in ['xlsx', 'excel', 'xls']:
            return generate_excel_response('sample_staff_list.xlsx', headers, sample_rows, sheet_title="Staff Onboarding")
        return generate_csv_response('sample_staff_list.csv', headers, sample_rows)

    @action(detail=False, methods=['get'])
    def sample_staff_csv(self, request):
        return self.sample_staff_file(request)

    @action(detail=False, methods=['get'])
    def sample_staff_excel(self, request):
        headers = ['Employee Name', 'Phone Contact', 'Email', 'User Name', 'Role', 'Faculty Code']
        sample_rows = [
            ['JOHN CHARLES OKIRIA', '0772409126', 'jokiria@ciu.ac.ug', 'CIU01', 'lecturer', 'SOBAT'],
            ['DR. SENGOOBA ASUMAN', '0702487553', 'asengooba@ciu.ac.ug', 'CIU02', 'lecturer', 'FST'],
            ['LONY TITUS OKELLO', '0772557156', 'tlony@ciu.ac.ug', 'CIU03', 'lecturer', 'FAS'],
            ['TUSUUBIRA SHARIFU', '0770000000', 'stusuubira@ciu.ac.ug', 'CIU04', 'lecturer', 'SOBAT'],
            ['DR. NAKITTO MARIA', '0782334455', 'mnakitto@ciu.ac.ug', 'CIU05', 'faculty_admin', 'SOBAT'],
            ['PROF. SSEMAKULA PETER', '0752112233', 'pssemakula@ciu.ac.ug', 'CIU06', 'dean', 'FST']
        ]
        return generate_excel_response('sample_staff_list.xlsx', headers, sample_rows, sheet_title="Staff Onboarding")

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsAdmin])
    def bulk_onboard_staff(self, request):
        uploaded_file = request.FILES.get('file') or request.FILES.get('staff_file') or request.FILES.get('excel_file') or request.FILES.get('csv_file')
        raw_content = request.data.get('content') or request.data.get('csv_content')
        default_role = request.data.get('default_role', 'lecturer')
        default_faculty_id = request.data.get('faculty_id')
        default_password = request.data.get('default_password') or 'Kampus@2026'

        if not uploaded_file and not raw_content:
            return Response({'detail': 'Please provide an Excel (.xls, .xlsx) or CSV file containing staff members.'}, status=status.HTTP_400_BAD_REQUEST)

        rows = []
        filename = getattr(uploaded_file, 'name', '').lower() if uploaded_file else ''

        if uploaded_file:
            file_bytes = uploaded_file.read()
            if filename.endswith('.xls') or file_bytes.startswith(b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1'):
                # Process with xlrd (.xls legacy Excel format)
                try:
                    import xlrd
                    book = xlrd.open_workbook(file_contents=file_bytes)
                    sheet = book.sheet_by_index(0)
                    if sheet.nrows > 0:
                        headers = [str(sheet.cell_value(0, c)).strip().lower().replace('_', ' ') for c in range(sheet.ncols)]
                        for r in range(1, sheet.nrows):
                            row_vals = [sheet.cell_value(r, c) for c in range(sheet.ncols)]
                            if any(str(v).strip() for v in row_vals):
                                rows.append(dict(zip(headers, row_vals)))
                except Exception as e:
                    return Response({'detail': f'Failed to parse .xls Excel file: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

            elif filename.endswith('.xlsx') or file_bytes.startswith(b'PK\x03\x04'):
                # Process with openpyxl (.xlsx modern Excel format)
                try:
                    import openpyxl
                    import io
                    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
                    sheet = wb.active
                    iter_rows = list(sheet.iter_rows(values_only=True))
                    if iter_rows:
                        headers = [str(c or '').strip().lower().replace('_', ' ') for c in iter_rows[0]]
                        for row_vals in iter_rows[1:]:
                            if any(str(v or '').strip() for v in row_vals):
                                rows.append(dict(zip(headers, row_vals)))
                except Exception as e:
                    return Response({'detail': f'Failed to parse .xlsx Excel file: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

            else:
                # Process as CSV / text
                try:
                    import io
                    text_str = None
                    for encoding in ['utf-8-sig', 'utf-8', 'latin-1', 'cp1252']:
                        try:
                            text_str = file_bytes.decode(encoding)
                            break
                        except UnicodeDecodeError:
                            continue
                    if text_str is None:
                        text_str = file_bytes.decode('utf-8', errors='ignore')
                    
                    reader = csv.reader(io.StringIO(text_str))
                    lines = [r for r in reader if any(cell.strip() for cell in r)]
                    if lines:
                        headers = [c.strip().lower().replace('_', ' ') for c in lines[0]]
                        for row_vals in lines[1:]:
                            rows.append(dict(zip(headers, row_vals)))
                except Exception as e:
                    return Response({'detail': f'Failed to parse CSV file: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        elif raw_content:
            import io
            reader = csv.reader(io.StringIO(raw_content))
            lines = [r for r in reader if any(cell.strip() for cell in r)]
            if lines:
                headers = [c.strip().lower().replace('_', ' ') for c in lines[0]]
                for row_vals in lines[1:]:
                    rows.append(dict(zip(headers, row_vals)))

        if not rows:
            return Response({'detail': 'No staff rows found in the uploaded file.'}, status=status.HTTP_400_BAD_REQUEST)

        default_faculty = None
        if default_faculty_id:
            default_faculty = Faculty.objects.filter(id=default_faculty_id).first()

        created_users = []
        skipped_users = []
        created_count = 0
        skipped_count = 0

        from django.contrib.auth.hashers import make_password
        hashed_default_pwd = make_password(default_password)
        valid_roles = dict(User.ROLE_CHOICES)

        for row in rows:
            raw_name = ''
            raw_phone = ''
            raw_email = ''
            raw_username = ''
            raw_role = ''
            raw_faculty = ''

            for k, v in row.items():
                k_clean = str(k).strip().lower()
                val_str = str(v).strip() if v is not None else ''
                if isinstance(v, float) and v.is_integer():
                    val_str = str(int(v))

                if any(x in k_clean for x in ['employee name', 'staff name', 'full name', 'name']) and not any(x in k_clean for x in ['user', 'login']):
                    raw_name = raw_name or val_str
                elif any(x in k_clean for x in ['phone', 'contact', 'telephone', 'mobile', 'cell']):
                    raw_phone = raw_phone or val_str
                elif any(x in k_clean for x in ['email', 'mail']):
                    raw_email = raw_email or val_str
                elif any(x in k_clean for x in ['user name', 'username', 'staff id', 'staff no']):
                    raw_username = raw_username or val_str
                elif any(x in k_clean for x in ['role', 'designation', 'position']):
                    raw_role = raw_role or val_str
                elif any(x in k_clean for x in ['faculty', 'department', 'school']):
                    raw_faculty = raw_faculty or val_str

            if not raw_name and not raw_username and not raw_email:
                continue

            # Parse name
            name_parts = raw_name.split()
            first_name = name_parts[0] if name_parts else 'Staff'
            last_name = ' '.join(name_parts[1:]) if len(name_parts) > 1 else ''

            # Parse username
            username = raw_username.strip()
            if not username:
                if raw_email and '@' in raw_email:
                    username = raw_email.split('@')[0].strip()
                else:
                    username = f"{first_name[:3].lower()}{random.randint(100, 999)}"

            # Parse email
            email = raw_email.strip().lower()
            if not email:
                email = f"{username.lower()}@ciu.ac.ug"

            # Parse role
            target_role = default_role
            if raw_role:
                r_low = raw_role.strip().lower()
                for r_code, r_label in valid_roles.items():
                    if r_low == r_code.lower() or r_low == r_label.lower():
                        target_role = r_code
                        break

            # Parse faculty
            target_faculty = default_faculty
            if raw_faculty:
                fac = Faculty.objects.filter(models.Q(code__iexact=raw_faculty) | models.Q(name__icontains=raw_faculty)).first()
                if fac:
                    target_faculty = fac

            # Deduplication: Check if username already exists
            if User.objects.filter(username__iexact=username).exists():
                skipped_count += 1
                skipped_users.append({
                    'username': username,
                    'email': email,
                    'name': raw_name or f"{first_name} {last_name}".strip(),
                    'reason': f"Username '{username}' already exists in system"
                })
                continue

            try:
                new_user = User(
                    username=username,
                    email=email,
                    first_name=first_name,
                    last_name=last_name,
                    phone=raw_phone[:30] if raw_phone else '',
                    role=target_role,
                    faculty=target_faculty,
                    password=hashed_default_pwd,
                    must_change_password=True
                )
                new_user.save()

                created_count += 1
                created_users.append({
                    'id': new_user.id,
                    'username': new_user.username,
                    'name': f"{new_user.first_name} {new_user.last_name}".strip(),
                    'email': new_user.email,
                    'phone': new_user.phone,
                    'role': new_user.role,
                    'faculty': target_faculty.code if target_faculty else None
                })
            except Exception as e:
                skipped_count += 1
                skipped_users.append({
                    'username': username,
                    'email': email,
                    'name': raw_name,
                    'reason': f"Database error: {str(e)}"
                })

        msg = f"Bulk Staff Onboarding: Successfully onboarded {created_count} staff accounts ({skipped_count} skipped/duplicates)."
        log_system_event(request.user, "BULK_STAFF_ONBOARDING_SUCCESS", level="AUDIT", details=msg)

        return Response({
            'detail': msg,
            'total_rows': len(rows),
            'created_count': created_count,
            'skipped_count': skipped_count,
            'created_users': created_users,
            'skipped_users': skipped_users
        })

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsAdmin | IsPlatformCoordinator | IsLecturer | IsFacultyAdmin | IsDean])
    def promote_class(self, request):
        user = request.user
        faculty_id = request.data.get('faculty_id')
        course_id = request.data.get('course_id')
        current_year = request.data.get('current_year')
        current_semester = request.data.get('current_semester')
        entry_year = request.data.get('entry_year')
        intake = request.data.get('intake')
        promotion_target = request.data.get('promotion_target') or request.data.get('promotion_mode') or 'next_year'
        target_year = request.data.get('target_year')
        target_semester = request.data.get('target_semester')
        student_updates = request.data.get('students', [])
        student_ids = request.data.get('student_ids', [])

        if not student_updates and student_ids:
            student_updates = [{'id': sid, 'selected': True} for sid in student_ids]

        if not student_updates or not isinstance(student_updates, list):
            qs = User.objects.filter(role='student')
            if faculty_id:
                qs = qs.filter(faculty_id=int(faculty_id))
            if course_id:
                qs = qs.filter(models.Q(assigned_courses__id=int(course_id)) | models.Q(course_applications__course_id=int(course_id), course_applications__status='approved')).distinct()
            if current_year:
                qs = qs.filter(year_of_study=int(current_year))
            if current_semester:
                qs = qs.filter(semester=int(current_semester))
            if entry_year and str(entry_year) != 'All':
                try:
                    qs = qs.filter(entry_year=int(entry_year))
                except (ValueError, TypeError):
                    pass
            if intake and str(intake) != 'All':
                qs = qs.filter(intake__iexact=str(intake).strip())
            student_updates = [{'id': st.id, 'selected': True} for st in qs]

        if not student_updates:
            return Response({'detail': 'No eligible student accounts found to promote.'}, status=status.HTTP_400_BAD_REQUEST)

        updated_count = 0
        updated_students = []

        for item in student_updates:
            s_id = item.get('id')
            if not s_id or not item.get('selected', True):
                continue
            try:
                st = User.objects.get(id=s_id, role='student')
                if user.role in ['faculty_admin', 'dean']:
                    sec_faculty = user.faculty or (user.administered_faculties.first() if hasattr(user, 'administered_faculties') else None)
                    if sec_faculty and st.faculty != sec_faculty:
                        continue

                cust_year = item.get('target_year')
                cust_sem = item.get('target_semester')

                if cust_year:
                    st.year_of_study = int(cust_year)
                elif promotion_target == 'next_semester':
                    if st.semester == 1:
                        st.semester = 2
                    else:
                        st.semester = 1
                        st.year_of_study = min(4, st.year_of_study + 1)
                elif promotion_target == 'next_year' or target_year:
                    st.year_of_study = int(target_year) if target_year else min(4, st.year_of_study + 1)
                    st.semester = 1
                else:
                    st.year_of_study = min(4, st.year_of_study + 1)

                if cust_sem:
                    st.semester = int(cust_sem)
                elif target_semester:
                    st.semester = int(target_semester)

                if item.get('reg_number'):
                    st.reg_number = item.get('reg_number')
                st.save()
                updated_count += 1
                updated_students.append(st)
            except User.DoesNotExist:
                continue

        msg = f"Promotion Executed: Successfully promoted {updated_count} student(s) to Year {updated_students[0].year_of_study if updated_students else ''} (Semester {updated_students[0].semester if updated_students else ''})."
        log_system_event(user, f"STUDENT_PROMOTION_SUCCESS: {msg}", level="INFO")
        return Response({
            'detail': msg,
            'count': updated_count,
            'students': AdminUserSerializer(updated_students, many=True).data
        })

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsAdmin | IsPlatformCoordinator | IsFacultyAdmin | IsRegistrar])
    def upload_students(self, request):
        file_obj = request.FILES.get('file') or request.FILES.get('excel_file') or request.FILES.get('csv_file') or request.FILES.get('student_file')
        raw_content = request.data.get('content') or request.data.get('csv_content') or request.data.get('csv_text')
        if not file_obj and not raw_content:
            return Response({'detail': 'Please upload an Excel (.xlsx/.xls) or CSV (.csv) file.'}, status=status.HTTP_400_BAD_REQUEST)

        filename = getattr(file_obj, 'name', '').lower() if file_obj else ''
        rows = []

        if file_obj:
            file_bytes = file_obj.read()
            if filename.endswith('.xls') or file_bytes.startswith(b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1'):
                # Process with xlrd (.xls legacy Excel format)
                try:
                    import xlrd
                    wb = xlrd.open_workbook(file_contents=file_bytes)
                    for sheet_name in wb.sheet_names():
                        ws = wb.sheet_by_name(sheet_name)
                        if ws.nrows < 2: continue
                        headers = [re.sub(r'[\s_]+', ' ', str(cell).strip().lower().replace('.', '')) for cell in ws.row_values(0)]
                        for r_idx in range(1, ws.nrows):
                            row_vals = [clean_sheet_cell(c) for c in ws.row_values(r_idx)]
                            if not any(row_vals): continue
                            row_dict = {headers[i]: row_vals[i] for i in range(min(len(headers), len(row_vals)))}
                            rows.append(row_dict)
                except Exception as ex1:
                    try:
                        import openpyxl, io
                        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
                        for ws in wb.worksheets:
                            iter_rows = list(ws.iter_rows(values_only=True))
                            if not iter_rows: continue
                            headers = [re.sub(r'[\s_]+', ' ', str(c or '').strip().lower().replace('.', '')) for c in iter_rows[0]]
                            for row_data in iter_rows[1:]:
                                row_vals = [clean_sheet_cell(c) for c in row_data]
                                if not any(row_vals): continue
                                row_dict = {headers[i]: row_vals[i] for i in range(min(len(headers), len(row_vals)))}
                                rows.append(row_dict)
                    except Exception as ex2:
                        return Response({'detail': f'Error reading Excel file: {str(ex1)} | {str(ex2)}'}, status=status.HTTP_400_BAD_REQUEST)

            elif filename.endswith('.xlsx') or file_bytes.startswith(b'PK\x03\x04'):
                # Process with openpyxl (.xlsx modern Excel format)
                try:
                    import openpyxl, io
                    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
                    for ws in wb.worksheets:
                        iter_rows = list(ws.iter_rows(values_only=True))
                        if not iter_rows: continue
                        headers = [re.sub(r'[\s_]+', ' ', str(c or '').strip().lower().replace('.', '')) for c in iter_rows[0]]
                        for row_data in iter_rows[1:]:
                            row_vals = [clean_sheet_cell(c) for c in row_data]
                            if not any(row_vals): continue
                            row_dict = {headers[i]: row_vals[i] for i in range(min(len(headers), len(row_vals)))}
                            rows.append(row_dict)
                except Exception as ex1:
                    try:
                        import xlrd
                        wb = xlrd.open_workbook(file_contents=file_bytes)
                        for sheet_name in wb.sheet_names():
                            ws = wb.sheet_by_name(sheet_name)
                            if ws.nrows < 2: continue
                            headers = [re.sub(r'[\s_]+', ' ', str(cell).strip().lower().replace('.', '')) for cell in ws.row_values(0)]
                            for r_idx in range(1, ws.nrows):
                                row_vals = [clean_sheet_cell(c) for c in ws.row_values(r_idx)]
                                if not any(row_vals): continue
                                row_dict = {headers[i]: row_vals[i] for i in range(min(len(headers), len(row_vals)))}
                                rows.append(row_dict)
                    except Exception as ex2:
                        return Response({'detail': f'Error reading Excel file: {str(ex1)} | {str(ex2)}'}, status=status.HTTP_400_BAD_REQUEST)

            else:
                # Process as CSV
                try:
                    import io
                    text_str = None
                    for enc in ['utf-8-sig', 'utf-8', 'latin-1', 'cp1252']:
                        try:
                            text_str = file_bytes.decode(enc)
                            break
                        except UnicodeDecodeError:
                            continue
                    if text_str is None:
                        text_str = file_bytes.decode('utf-8', errors='ignore')
                    reader = csv.reader(io.StringIO(text_str))
                    header = None
                    for r in reader:
                        if not r or not any(r): continue
                        if header is None:
                            header = [re.sub(r'[\s_]+', ' ', c.strip().lower().replace('.', '')) for c in r]
                            continue
                        row_dict = {header[i]: clean_sheet_cell(r[i]) for i in range(min(len(header), len(r)))}
                        rows.append(row_dict)
                except Exception as e:
                    return Response({'detail': f'Failed to parse CSV file: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        elif raw_content:
            import io
            reader = csv.reader(io.StringIO(raw_content))
            header = None
            for r in reader:
                if not r or not any(r): continue
                if header is None:
                    header = [re.sub(r'[\s_]+', ' ', c.strip().lower().replace('.', '')) for c in r]
                    continue
                row_dict = {header[i]: clean_sheet_cell(r[i]) for i in range(min(len(header), len(r)))}
                rows.append(row_dict)

        if not rows:
            return Response({'detail': 'No student records found in the uploaded file.'}, status=status.HTTP_400_BAD_REQUEST)

        created_students = []
        skipped_students = []
        created_count = 0
        skipped_count = 0

        default_faculty_id = request.data.get('default_faculty_id') or request.data.get('faculty_id') or request.data.get('faculty')
        default_faculty_obj = None
        if default_faculty_id:
            if str(default_faculty_id).isdigit():
                default_faculty_obj = Faculty.objects.filter(id=int(default_faculty_id)).first()
            else:
                default_faculty_obj = Faculty.objects.filter(code__iexact=str(default_faculty_id).strip()).first() or Faculty.objects.filter(name__icontains=str(default_faculty_id).strip()).first()

        default_batch_pass = request.data.get('default_password') or request.POST.get('default_password')
        if default_batch_pass:
            default_batch_pass = str(default_batch_pass).strip()

        default_entry_year = request.data.get('entry_year') or request.data.get('default_entry_year') or 2026
        try:
            default_entry_year = int(re.sub(r'[^\d]', '', str(default_entry_year)))
        except Exception:
            default_entry_year = 2026

        default_intake = (request.data.get('intake') or request.data.get('default_intake') or 'August Intake').strip()

        from django.contrib.auth.hashers import make_password
        pass_hash_cache = {}
        if default_batch_pass:
            pass_hash_cache[default_batch_pass] = make_password(default_batch_pass)

        for index, r in enumerate(rows, start=1):
            # Extract reg number
            reg = ''
            for k, v in r.items():
                if any(x in k for x in ['reg', 'registration', 'student no', 'student id', 'entry no']) and not any(x in k for x in ['date', 'time', 'status']):
                    reg = reg or v
            if not reg:
                reg = r.get('username') or f"2026SOBAT-B{index:03d}"
            reg = str(reg).strip()

            # Extract name
            surname = ''
            first_name_col = ''
            full_name_col = ''
            for k, v in r.items():
                if any(x in k for x in ['surname', 'last name']):
                    surname = surname or v
                elif any(x in k for x in ['first name', 'given name']):
                    first_name_col = first_name_col or v
                elif any(x in k for x in ['full name', 'student name', 'name', 'employee name']) and not any(x in k for x in ['user', 'faculty', 'course']):
                    full_name_col = full_name_col or v

            if surname or first_name_col:
                name = f"{first_name_col} {surname}".strip()
            elif full_name_col:
                name = full_name_col.strip()
            else:
                name = f"Student {index}"

            name_parts = name.split(' ', 1)
            first_name = name_parts[0] if name_parts else 'Student'
            last_name = name_parts[1] if len(name_parts) > 1 else ''

            # Extract email
            email = ''
            for k, v in r.items():
                if 'email' in k or 'mail' in k:
                    email = email or v
            email = str(email).strip().lower()

            # Username
            username = reg.replace('/', '-').replace(' ', '').lower()
            if not email:
                email = f"{username}@ciu.ac.ug"

            # Faculty
            fac_str = ''
            for k, v in r.items():
                if any(x in k for x in ['faculty', 'department', 'school', 'program']):
                    fac_str = fac_str or v
            fac_str = str(fac_str).strip()

            faculty_obj = None
            if fac_str:
                faculty_obj = Faculty.objects.filter(code__iexact=fac_str).first() or Faculty.objects.filter(name__icontains=fac_str).first()
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
                faculty_obj = default_faculty_obj or Faculty.objects.first()

            # Entry Year
            entry_year_val = default_entry_year
            for k, v in r.items():
                if any(x in k for x in ['entry year', 'admission year', 'year of entry', 'cohort year']):
                    cleaned_y = re.sub(r'[^\d]', '', str(v))
                    if cleaned_y and len(cleaned_y) == 4:
                        entry_year_val = int(cleaned_y)
                        break

            # Intake
            intake_val = default_intake
            for k, v in r.items():
                if any(x in k for x in ['intake', 'admission intake', 'cohort']):
                    if str(v).strip():
                        intake_val = str(v).strip()
                        break

            # Year of study
            year_of_study = 1
            for k, v in r.items():
                if any(x in k for x in ['year of study', 'yos', 'study year']):
                    cleaned_yos = re.sub(r'[^\d]', '', str(v))
                    if cleaned_yos and int(cleaned_yos) in [1, 2, 3, 4, 5]:
                        year_of_study = int(cleaned_yos)
                        break

            # Semester
            semester = 1
            for k, v in r.items():
                if any(x in k for x in ['semester', 'sem']):
                    cleaned_s = re.sub(r'[^\d]', '', str(v))
                    if cleaned_s and int(cleaned_s) in [1, 2]:
                        semester = int(cleaned_s)
                        break

            # Phone
            phone = ''
            for k, v in r.items():
                if any(x in k for x in ['phone', 'contact', 'mobile', 'telephone']):
                    phone = phone or v
            phone = str(phone).strip()[:30]

            # Password
            specified_pass = ''
            for k, v in r.items():
                if any(x in k for x in ['password', 'otp', 'one time password']):
                    specified_pass = specified_pass or v
            specified_pass = str(specified_pass).strip() or default_batch_pass
            otp_pass = specified_pass if specified_pass else f"CIU-{random.randint(100000, 999999)}"

            if otp_pass not in pass_hash_cache:
                pass_hash_cache[otp_pass] = make_password(otp_pass)
            hashed_pass = pass_hash_cache[otp_pass]

            # Deduplication: Check if username or reg_number already exists
            existing_user = User.objects.filter(
                models.Q(username__iexact=username) |
                models.Q(reg_number__iexact=reg)
            ).first()

            if existing_user:
                skipped_count += 1
                skipped_students.append({
                    'username': existing_user.username,
                    'reg_number': reg,
                    'full_name': name,
                    'reason': f"Student account '{reg}' / '{existing_user.username}' already exists in system"
                })
                continue

            try:
                user_obj = User(
                    username=username,
                    email=email,
                    first_name=first_name,
                    last_name=last_name,
                    phone=phone,
                    role='student',
                    reg_number=reg,
                    faculty=faculty_obj,
                    entry_year=entry_year_val,
                    intake=intake_val,
                    year_of_study=year_of_study,
                    semester=semester,
                    tuition_paid_percentage=0.0,
                    password=hashed_pass,
                    must_change_password=True
                )
                user_obj.save()

                created_count += 1
                created_students.append({
                    'id': user_obj.id,
                    'username': user_obj.username,
                    'reg_number': reg,
                    'full_name': name,
                    'email': email,
                    'faculty': faculty_obj.code if faculty_obj else 'SOBAT',
                    'entry_year': entry_year_val,
                    'intake': intake_val,
                    'year_of_study': year_of_study,
                    'semester': semester,
                    'one_time_password': otp_pass
                })
            except Exception as e:
                skipped_count += 1
                skipped_students.append({
                    'username': username,
                    'reg_number': reg,
                    'full_name': name,
                    'reason': f"Database error: {str(e)}"
                })

        msg = f"Bulk Student Onboarding: Successfully onboarded {created_count} student account(s) ({skipped_count} skipped/duplicates)."
        log_system_event(request.user, "BATCH_STUDENT_IMPORT_SUCCESS", level="AUDIT", details=msg)
        return Response({
            'detail': msg,
            'total_rows': len(rows),
            'created_count': created_count,
            'skipped_count': skipped_count,
            'students': created_students,
            'skipped_students': skipped_students
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
        if not user or not user.is_authenticated:
            return Faculty.objects.none()
        if user.role in ['dean', 'faculty_admin', 'faculty_secretary']:
            return get_user_assigned_faculties(user).order_by('code')
        if user.role == 'lecturer':
            return Faculty.objects.filter(
                models.Q(courses__units__lecturers=user) | models.Q(id=user.faculty_id)
            ).distinct().order_by('code')
        return Faculty.objects.all().order_by('code')

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
        if not user or not user.is_authenticated:
            return Course.objects.none()
        if user.role in ['dean', 'faculty_admin', 'faculty_secretary']:
            assigned_facs = get_user_assigned_faculties(user)
            return Course.objects.filter(faculty__in=assigned_facs).order_by('code')
        if user.role == 'lecturer':
            return Course.objects.filter(
                models.Q(units__lecturers=user) | models.Q(faculty=user.faculty)
            ).distinct().order_by('code')
        return Course.objects.all().order_by('code')

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), (IsAdmin | IsFacultyAdmin)()]

    def perform_create(self, serializer):
        user = self.request.user
        if user.role in ['faculty_admin', 'faculty_secretary']:
            faculty = serializer.validated_data.get('faculty')
            assigned_facs = get_user_assigned_faculties(user)
            if faculty and faculty not in assigned_facs:
                raise serializers.ValidationError({"detail": "Permission Denied: You can only create courses for your assigned faculty."})
        course = serializer.save()
        log_system_event(user, f"Course Created: {course.code} - {course.name}", level='INFO')

    def perform_update(self, serializer):
        user = self.request.user
        if user.role in ['faculty_admin', 'faculty_secretary']:
            assigned_facs = get_user_assigned_faculties(user)
            if serializer.instance.faculty and serializer.instance.faculty not in assigned_facs:
                raise serializers.ValidationError({"detail": "Permission Denied: You cannot modify courses from other faculties."})
        course = serializer.save()
        log_system_event(user, f"Course Updated: {course.code} - {course.name}", level='INFO')

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
        if not user or not user.is_authenticated:
            return CourseUnit.objects.none()
        if user.role in ['dean', 'faculty_admin', 'faculty_secretary']:
            assigned_facs = get_user_assigned_faculties(user)
            return CourseUnit.objects.filter(course__faculty__in=assigned_facs).order_by('code')
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
        return CourseUnit.objects.all().order_by('code')

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
        created_count = 0
        updated_count = 0
        duplicate_count = 0
        total_rows = 0
        seen_signatures = set()

        for row in reader:
            if not row or not any(row):
                continue
            if header is None:
                header = [c.strip().lower() for c in row]
                continue

            total_rows += 1
            row_dict = {}
            for i, val in enumerate(row):
                if i < len(header):
                    row_dict[header[i]] = val.strip()

            code = (row_dict.get('course code') or row_dict.get('code') or row_dict.get('unit_code') or
                    row_dict.get('unit code') or '')
            name = (row_dict.get('course name') or row_dict.get('name') or row_dict.get('unit_name') or
                    row_dict.get('unit name') or '')
            course_code = (row_dict.get('course_code') or row_dict.get('program_code') or row_dict.get('program') or
                           row_dict.get('course') or request.data.get('course_code') or '')
            credit_units = (row_dict.get('credit units') or row_dict.get('credit_units') or
                            row_dict.get('credits') or '3')
            year_of_study = (row_dict.get('year_of_study') or row_dict.get('year') or
                             row_dict.get('year of study') or '1')
            lecturer_ref = (row_dict.get('lecturer_email') or row_dict.get('lecturer') or
                            row_dict.get('lecturer_username') or '')

            if not code or not name:
                continue

            # Batch deduplication key
            batch_key = (code.upper().strip(), course_code.upper().strip(), lecturer_ref.lower().strip())
            if batch_key in seen_signatures:
                duplicate_count += 1
                continue
            seen_signatures.add(batch_key)

            try:
                cu_val = int(float(credit_units))
            except (ValueError, TypeError):
                cu_val = 3

            try:
                cleaned_yr = re.sub(r'[^\d]', '', str(year_of_study))
                yr_val = int(cleaned_yr) if cleaned_yr and int(cleaned_yr) in [1, 2, 3, 4] else 1
            except (ValueError, TypeError):
                yr_val = 1

            course = None
            if course_code:
                try:
                    course = Course.objects.get(code__iexact=course_code)
                except Course.DoesNotExist:
                    course = Course.objects.filter(code__icontains=course_code).first()

            if not course:
                course = Course.objects.first()

            if not course:
                continue

            # Locate Lecturer if provided
            lecturer_obj = None
            if lecturer_ref:
                lecturer_obj = (User.objects.filter(role='lecturer', email__iexact=lecturer_ref).first() or
                                User.objects.filter(role='lecturer', username__iexact=lecturer_ref).first() or
                                User.objects.filter(email__iexact=lecturer_ref).first())

            existing_unit = CourseUnit.objects.filter(code__iexact=code, course=course).first()
            if existing_unit:
                # Check if identical (duplicate ignore)
                is_identical = (
                    existing_unit.name.strip().lower() == name.strip().lower() and
                    existing_unit.credit_units == cu_val and
                    existing_unit.year_of_study == yr_val
                )
                if lecturer_obj and not existing_unit.lecturers.filter(id=lecturer_obj.id).exists():
                    is_identical = False

                if is_identical:
                    duplicate_count += 1
                    continue

                existing_unit.name = name
                existing_unit.credit_units = cu_val
                existing_unit.year_of_study = yr_val
                existing_unit.save()
                if lecturer_obj:
                    existing_unit.lecturers.add(lecturer_obj)
                updated_count += 1
            else:
                new_unit = CourseUnit.objects.create(
                    code=code,
                    name=name,
                    course=course,
                    credit_units=cu_val,
                    year_of_study=yr_val
                )
                if lecturer_obj:
                    new_unit.lecturers.add(lecturer_obj)
                created_count += 1

        msg = f"Course unit allocation completed: {created_count} created, {updated_count} updated, {duplicate_count} duplicate row(s) ignored."
        log_system_event(request.user, "CSV_COURSE_UNITS_UPLOADED", level='INFO', details=msg)
        return Response({
            'detail': msg,
            'created_count': created_count,
            'updated_count': updated_count,
            'duplicate_count': duplicate_count,
            'count': created_count + updated_count,
            'total_rows': total_rows
        })

    @action(detail=False, methods=['get'])
    def sample_csv(self, request):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="sample_course_units_allocation.csv"'
        writer = csv.writer(response)
        writer.writerow(['unit_code', 'unit_name', 'course_code', 'year_of_study', 'credit_units', 'lecturer_email'])
        writer.writerow(['BIT2104', 'Cloud Infrastructure Systems', 'BIT2026', '2', '4', 'lecturer@ciu.ac.ug'])
        writer.writerow(['BIT2105', 'Cybersecurity & Cryptography Principles', 'BIT2026', '2', '3', 'lecturer@ciu.ac.ug'])
        writer.writerow(['BCS1101', 'Structured Programming in C', 'BCS2026', '1', '4', 'lecturer@ciu.ac.ug'])
        writer.writerow(['BSN2102', 'Human Anatomy & Clinical Physiology', 'BSN2026', '2', '4', 'lecturer@ciu.ac.ug'])
        return response

# 6. Applications ViewSet
class ApplicationViewSet(viewsets.ModelViewSet):
    serializer_class = ApplicationSerializer

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Application.objects.none()
        if user.role in ['dean', 'faculty_admin', 'faculty_secretary']:
            assigned_facs = get_user_assigned_faculties(user)
            return Application.objects.filter(
                models.Q(course__faculty__in=assigned_facs) | models.Q(student__faculty__in=assigned_facs)
            ).distinct().order_by('-applied_at')
        elif user.role in ['admin', 'dvc', 'vc', 'registrar']:
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

def parse_aiken_questions(raw_text):
    """
    Parses Aiken-formatted text files into structured question dictionaries.
    Compatible with neuro.txt format:
    Question text line(s)...
    A. Option 1
    B. Option 2
    C. Option 3
    D. Option 4
    ANSWER: B
    """
    lines = raw_text.splitlines()
    questions = []
    curr_q = {'question_text': '', 'option_a': '', 'option_b': '', 'option_c': '', 'option_d': '', 'correct_answer': ''}
    state = 'text'

    option_pattern = re.compile(r'^([A-Da-d])[\.\)]\s*(.*)$')
    answer_pattern = re.compile(r'^(?:ANSWER|Ans|Correct Answer)\s*:\s*([A-Da-d])', re.IGNORECASE)

    for line in lines:
        clean = line.strip()
        if not clean:
            continue

        ans_match = answer_pattern.match(clean)
        if ans_match:
            curr_q['correct_answer'] = ans_match.group(1).upper()
            if curr_q['question_text'] and curr_q['option_a'] and curr_q['option_b']:
                questions.append(curr_q)
            curr_q = {'question_text': '', 'option_a': '', 'option_b': '', 'option_c': '', 'option_d': '', 'correct_answer': ''}
            state = 'text'
            continue

        opt_match = option_pattern.match(clean)
        if opt_match:
            letter = opt_match.group(1).upper()
            opt_text = opt_match.group(2).strip()
            if letter == 'A':
                curr_q['option_a'] = opt_text
            elif letter == 'B':
                curr_q['option_b'] = opt_text
            elif letter == 'C':
                curr_q['option_c'] = opt_text
            elif letter == 'D':
                curr_q['option_d'] = opt_text
            state = 'option'
            continue

        if state == 'text':
            cleaned_line = re.sub(r'^\d+[\.\)]\s*', '', clean) if not curr_q['question_text'] else clean
            if curr_q['question_text']:
                curr_q['question_text'] += ' ' + cleaned_line
            else:
                curr_q['question_text'] = cleaned_line

    return questions


# 7. Exam ViewSet
class ExamViewSet(viewsets.ModelViewSet):
    serializer_class = ExamSerializer

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Exam.objects.none()
        if user.role in ['dean', 'faculty_admin', 'faculty_secretary']:
            assigned_facs = get_user_assigned_faculties(user)
            return Exam.objects.filter(
                models.Q(course__faculty__in=assigned_facs) | models.Q(course_unit__course__faculty__in=assigned_facs)
            ).distinct().order_by('-created_at')
        elif user.role == 'student':
            if user.assigned_courses.exists():
                student_courses = user.assigned_courses.all()
            else:
                student_courses = Course.objects.filter(
                    models.Q(applications__student=user, applications__status='approved') |
                    models.Q(faculty=user.faculty)
                ).distinct()
            student_year = getattr(user, 'year_of_study', 1) or 1
            return Exam.objects.filter(
                models.Q(is_active=True) | models.Q(is_published=True),
                course__in=student_courses
            ).filter(
                models.Q(year_of_study=student_year) | models.Q(year_of_study=0) | models.Q(course_unit__year_of_study=student_year)
            ).order_by('-created_at')
        elif user.role == 'lecturer':
            return Exam.objects.filter(
                models.Q(lecturer=user) |
                models.Q(course__units__lecturers=user) |
                models.Q(course_unit__lecturers=user)
            ).distinct().order_by('-created_at')
        return Exam.objects.all().order_by('-created_at')

    def perform_create(self, serializer):
        user = self.request.user
        if user.role in ['faculty_admin', 'dean', 'registrar', 'dvc', 'vc']:
            raise serializers.ValidationError({"detail": "Permission Denied: Faculty Secretaries, Deans, Academic Registrars, DVC, and VC are restricted from setting exams. Only Lecturers, Platform Coordinators and System Administrators can set exams."})
        
        course_unit = serializer.validated_data.get('course_unit')
        year_of_study = serializer.validated_data.get('year_of_study', 0)
        target_course_ids = self.request.data.get('target_course_ids', [])
        target_years = self.request.data.get('target_years', [])

        # Only System Admin or Platform Coordinator can set an exam for All Course Units & All Years (Year 0)
        if user.role not in ['admin', 'platform_coordinator'] and year_of_study == 0 and not course_unit:
            raise serializers.ValidationError({"detail": "Permission Denied: Only System Administrators and Platform Coordinators can set exams for All Course Units & All Years (Year 0). Please select an assigned course unit and specific year of study."})
        
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

        # Handle multi-course / multi-program and multi-year exam scoping
        if (target_course_ids and len(target_course_ids) > 1) or (target_years and len(target_years) > 1):
            courses_to_create = Course.objects.filter(id__in=target_course_ids) if target_course_ids else [exam.course]
            years_to_create = target_years if target_years else [exam.year_of_study]

            for c in courses_to_create:
                for y in years_to_create:
                    if c.id == exam.course.id and int(y) == exam.year_of_study:
                        continue
                    Exam.objects.create(
                        course=c,
                        course_unit=exam.course_unit,
                        lecturer=user,
                        title=exam.title,
                        duration_minutes=exam.duration_minutes,
                        scheduled_start=exam.scheduled_start,
                        year_of_study=int(y),
                        due_date=exam.due_date,
                        is_active=exam.is_active,
                        is_approved_by_dean=exam.is_approved_by_dean,
                        is_results_released=exam.is_results_released
                    )

    def perform_update(self, serializer):
        user = self.request.user
        if user.role in ['faculty_admin', 'dean', 'registrar', 'dvc', 'vc']:
            raise serializers.ValidationError({"detail": "Permission Denied: Faculty Secretaries, Deans, Academic Registrars, DVC, and VC are restricted from editing exams."})
        if user.role == 'lecturer':
            if serializer.instance.lecturer != user:
                raise serializers.ValidationError({"detail": "Permission Denied: You can only update your own created exams."})
            if serializer.instance.is_approved_by_dean:
                raise serializers.ValidationError({"detail": "Permission Denied: Approved exams cannot be modified by the lecturer."})
        serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
        if user.role in ['faculty_admin', 'dean', 'registrar', 'dvc', 'vc']:
            raise serializers.ValidationError({"detail": "Permission Denied: Faculty Secretaries, Deans, Academic Registrars, DVC, and VC are restricted from deleting exams."})
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
            if user.role not in ['lecturer', 'admin', 'platform_coordinator', 'faculty_admin']:
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

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsLecturer | IsAdmin | IsPlatformCoordinator])
    def import_txt_questions(self, request, pk=None):
        exam = self.get_object()
        txt_file = request.FILES.get('file') or request.FILES.get('txt_file')
        txt_content = request.data.get('content') or request.data.get('text') or ''

        if txt_file:
            txt_content = txt_file.read().decode('utf-8-sig', errors='ignore')

        if not txt_content.strip():
            return Response({'detail': 'Please provide a .txt file or paste Aiken question text.'}, status=status.HTTP_400_BAD_REQUEST)

        parsed_questions = parse_aiken_questions(txt_content)
        if not parsed_questions:
            return Response({'detail': 'No valid Aiken-format questions were found in the text file. Please ensure format: Question text, A. option, B. option, ANSWER: X.'}, status=status.HTTP_400_BAD_REQUEST)

        created_objs = []
        for q in parsed_questions:
            created_objs.append(Question(
                exam=exam,
                question_text=q['question_text'],
                option_a=q['option_a'],
                option_b=q['option_b'],
                option_c=q['option_c'] or 'N/A',
                option_d=q['option_d'] or 'N/A',
                correct_option=q['correct_answer']
            ))
        Question.objects.bulk_create(created_objs)

        msg = f"Successfully translated & imported {len(created_objs)} questions from text file into exam '{exam.title}'."
        log_system_event(request.user, "EXAM_TXT_QUESTIONS_IMPORTED", level="INFO", details=msg)
        return Response({
            'detail': msg,
            'count': len(created_objs),
            'questions': QuestionLecturerSerializer(created_objs, many=True).data
        })

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsLecturer | IsAdmin | IsPlatformCoordinator])
    def create_from_txt(self, request):
        txt_file = request.FILES.get('file') or request.FILES.get('txt_file')
        txt_content = request.data.get('content') or request.data.get('text') or ''
        title = request.data.get('title') or 'New Examination Paper'
        course_id = request.data.get('course') or request.data.get('course_id')
        course_unit_id = request.data.get('course_unit') or request.data.get('course_unit_id')
        duration_minutes = int(request.data.get('duration_minutes', 60))
        year_of_study = int(request.data.get('year_of_study', 0))
        scheduled_start = request.data.get('scheduled_start') or None
        due_date = request.data.get('due_date') or None

        if txt_file:
            txt_content = txt_file.read().decode('utf-8-sig', errors='ignore')

        if not txt_content.strip():
            return Response({'detail': 'Please upload a .txt file or paste Aiken question text.'}, status=status.HTTP_400_BAD_REQUEST)

        parsed_questions = parse_aiken_questions(txt_content)
        if not parsed_questions:
            return Response({'detail': 'No valid Aiken-format questions were found in the text file.'}, status=status.HTTP_400_BAD_REQUEST)

        course = None
        if course_id:
            course = Course.objects.filter(id=course_id).first()
        elif course_unit_id:
            cu = CourseUnit.objects.filter(id=course_unit_id).first()
            if cu:
                course = cu.course
        if not course:
            course = Course.objects.first()

        course_unit = CourseUnit.objects.filter(id=course_unit_id).first() if course_unit_id else None

        exam = Exam.objects.create(
            course=course,
            course_unit=course_unit,
            lecturer=request.user,
            title=title,
            duration_minutes=duration_minutes,
            year_of_study=year_of_study,
            scheduled_start=scheduled_start,
            due_date=due_date,
            is_active=False,
            is_published=False
        )

        created_objs = []
        for q in parsed_questions:
            created_objs.append(Question(
                exam=exam,
                question_text=q['question_text'],
                option_a=q['option_a'],
                option_b=q['option_b'],
                option_c=q['option_c'] or 'N/A',
                option_d=q['option_d'] or 'N/A',
                correct_option=q['correct_answer']
            ))
        Question.objects.bulk_create(created_objs)

        msg = f"Successfully created exam '{exam.title}' with {len(created_objs)} questions translated from text file!"
        log_system_event(request.user, "EXAM_CREATED_FROM_TXT", level="INFO", details=msg)
        return Response({
            'detail': msg,
            'exam': ExamSerializer(exam).data,
            'questions_count': len(created_objs)
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsLecturer | IsAdmin | IsPlatformCoordinator])
    def publish(self, request, pk=None):
        exam = self.get_object()
        user = request.user
        if user.role == 'lecturer' and exam.lecturer != user:
            if not (exam.course_unit and exam.course_unit.lecturers.filter(id=user.id).exists()):
                raise serializers.ValidationError({"detail": "Permission Denied: Only the user who set the exam (or admin/coordinator) can publish or unpublish it."})
        exam.is_active = not exam.is_active
        exam.is_published = exam.is_active
        exam.save()
        log_system_event(user, f"Exam Publication Status set to {exam.is_published} for {exam.title}", level="INFO")
        return Response({
            'detail': f"Exam publication status set to {'PUBLISHED' if exam.is_published else 'DRAFT'}.",
            'is_published': exam.is_published,
            'is_active': exam.is_active
        })

    @action(detail=True, methods=['get'], permission_classes=[permissions.IsAuthenticated, IsLecturer | IsAdmin | IsPlatformCoordinator | IsFacultyAdmin | IsDean])
    def preview_scorecard(self, request, pk=None):
        exam = self.get_object()
        questions = exam.questions.all()
        questions_data = QuestionLecturerSerializer(questions, many=True).data
        return Response({
            'id': exam.id,
            'title': exam.title,
            'course_code': exam.course.code,
            'course_name': exam.course.name,
            'course_unit_code': exam.course_unit.code if exam.course_unit else None,
            'course_unit_name': exam.course_unit.name if exam.course_unit else None,
            'lecturer_name': exam.lecturer.get_full_name() or exam.lecturer.username,
            'duration_minutes': exam.duration_minutes,
            'scheduled_start': exam.scheduled_start,
            'due_date': exam.due_date,
            'year_of_study': exam.year_of_study,
            'is_published': exam.is_published or exam.is_active,
            'is_approved_by_dean': exam.is_approved_by_dean,
            'is_results_released': exam.is_results_released,
            'total_questions': questions.count(),
            'pass_percentage': 50.0,
            'questions': questions_data,
            'preview_mode': True,
            'card_type': 'exam_scorecard'
        })

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

        if not exam.is_published and not exam.is_active:
            return Response({'detail': 'Exam Access Denied: This exam is currently not published.'}, status=status.HTTP_400_BAD_REQUEST)

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

        # Late attempt detection (attempt started after scheduled stop time)
        is_late = False
        if exam.scheduled_start:
            stop_time = exam.scheduled_start + timezone.timedelta(minutes=exam.duration_minutes)
            if now > stop_time:
                is_late = True

        attempt = ExamAttempt.objects.create(student=request.user, exam=exam, is_late=is_late)
        return Response(ExamAttemptSerializer(attempt, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], permission_classes=[permissions.AllowAny])
    def export_csv(self, request, pk=None):
        authenticate_token_param(request)
        if not request.user or not request.user.is_authenticated or request.user.role not in ['admin', 'platform_coordinator', 'lecturer', 'dean', 'dvc', 'registrar', 'faculty_admin']:
            return Response({'detail': 'Authentication credentials were not provided or unauthorized.'}, status=status.HTTP_401_UNAUTHORIZED)

        exam = self.get_object()
        attempts = exam.attempts.select_related('student').all()

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="Exam_Results_{exam.course.code}_{exam.id}.csv"'

        writer = csv.writer(response)
        writer.writerow(['Student Username', 'Full Name', 'Email', 'Exam Title', 'Course Code', 'Score (%)', 'Submitted At', 'Tab Switches', 'Is Late', 'Late Reason', 'Status'])

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
                'YES' if att.is_late else 'NO',
                att.late_submission_reason or '',
                'Completed' if att.completed_at else 'Incomplete'
            ])

        return response

# 8. Exam Attempt ViewSet
class ExamAttemptViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ExamAttemptSerializer

    def get_queryset(self):
        user = self.request.user
        qs = ExamAttempt.objects.all().order_by('-started_at')
        if not user or not user.is_authenticated:
            return qs.none()
        if user.role in ['dean', 'faculty_admin', 'faculty_secretary']:
            assigned_facs = get_user_assigned_faculties(user)
            qs = qs.filter(
                models.Q(exam__course__faculty__in=assigned_facs) |
                models.Q(exam__course_unit__course__faculty__in=assigned_facs) |
                models.Q(student__faculty__in=assigned_facs)
            ).distinct()
        elif user.role == 'student':
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

        now = timezone.now()
        exam = attempt.exam

        # Hard Due Date Cutoff
        if exam.due_date and now > exam.due_date:
            return Response({'detail': 'Exam Access Denied: The final deadline (due date) for this exam has passed. Submissions are closed.'}, status=status.HTTP_400_BAD_REQUEST)

        answers = request.data.get('answers', {})
        tab_switches = request.data.get('tab_switches', 0)
        auto_submitted_reason = request.data.get('auto_submitted_reason', None)
        late_submission_reason = (request.data.get('late_submission_reason') or request.data.get('late_comment') or request.data.get('comment') or '').strip()

        # Late detection
        is_late = attempt.is_late
        allotted_stop = attempt.started_at + timezone.timedelta(minutes=exam.duration_minutes)
        scheduled_stop = (exam.scheduled_start + timezone.timedelta(minutes=exam.duration_minutes)) if exam.scheduled_start else None

        if now > allotted_stop or (scheduled_stop and now > scheduled_stop):
            is_late = True

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
        attempt.is_late = is_late
        if late_submission_reason:
            attempt.late_submission_reason = late_submission_reason
        elif is_late and not attempt.late_submission_reason:
            attempt.late_submission_reason = auto_submitted_reason or 'Late submission after regular stop time.'
        attempt.completed_at = now
        attempt.save()

        log_system_event(request.user, f"Exam Submitted: {attempt.exam.title} (Score: {attempt.score}%, Late: {attempt.is_late})", level="INFO")
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
        if not user or not user.is_authenticated:
            return Test.objects.none()
        if user.role in ['dean', 'faculty_admin', 'faculty_secretary']:
            assigned_facs = get_user_assigned_faculties(user)
            return Test.objects.filter(
                models.Q(course__faculty__in=assigned_facs) | models.Q(course_unit__course__faculty__in=assigned_facs)
            ).distinct().order_by('-created_at')
        elif user.role == 'student':
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
        elif user.role == 'lecturer':
            return Test.objects.filter(
                models.Q(lecturer=user) |
                models.Q(course__units__lecturers=user) |
                models.Q(course_unit__lecturers=user)
            ).distinct().order_by('-created_at')
        return Test.objects.all().order_by('-created_at')

    def perform_create(self, serializer):
        user = self.request.user
        if user.role in ['faculty_admin', 'dean', 'registrar', 'dvc', 'vc']:
            raise serializers.ValidationError({"detail": "Permission Denied: Faculty Secretaries, Deans, Academic Registrars, DVC, and VC are restricted from setting tests. Only Lecturers, Platform Coordinators and System Administrators can set tests."})
        
        course_unit = serializer.validated_data.get('course_unit')
        year_of_study = serializer.validated_data.get('year_of_study', 0)
        target_course_ids = self.request.data.get('target_course_ids', [])
        target_years = self.request.data.get('target_years', [])

        # Only System Admin or Platform Coordinator can set a test for All Course Units & All Years (Year 0)
        if user.role not in ['admin', 'platform_coordinator'] and year_of_study == 0 and not course_unit:
            raise serializers.ValidationError({"detail": "Permission Denied: Only System Administrators and Platform Coordinators can set tests for All Course Units & All Years (Year 0). Please select an assigned course unit and specific year of study."})
        
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

        # Handle multi-course / multi-program and multi-year test scoping
        if (target_course_ids and len(target_course_ids) > 1) or (target_years and len(target_years) > 1):
            courses_to_create = Course.objects.filter(id__in=target_course_ids) if target_course_ids else [test.course]
            years_to_create = target_years if target_years else [test.year_of_study]

            for c in courses_to_create:
                for y in years_to_create:
                    if c.id == test.course.id and int(y) == test.year_of_study:
                        continue
                    Test.objects.create(
                        course=c,
                        course_unit=test.course_unit,
                        lecturer=user,
                        title=test.title,
                        description=test.description,
                        category=test.category,
                        duration_minutes=test.duration_minutes,
                        scheduled_start=test.scheduled_start,
                        total_marks=test.total_marks,
                        pass_percentage=test.pass_percentage,
                        allowed_attempts=test.allowed_attempts,
                        is_published=test.is_published,
                        is_results_released=test.is_results_released,
                        year_of_study=int(y),
                        due_date=test.due_date
                    )

    def perform_update(self, serializer):
        user = self.request.user
        if user.role in ['faculty_admin', 'dean', 'registrar', 'dvc', 'vc']:
            raise serializers.ValidationError({"detail": "Permission Denied: Faculty Secretaries, Deans, Academic Registrars, DVC, and VC are restricted from editing tests."})
        if user.role == 'lecturer':
            if serializer.instance.lecturer != user:
                raise serializers.ValidationError({"detail": "Permission Denied: You can only update your own created tests."})
        serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
        if user.role in ['faculty_admin', 'dean', 'registrar', 'dvc', 'vc']:
            raise serializers.ValidationError({"detail": "Permission Denied: Faculty Secretaries, Deans, Academic Registrars, DVC, and VC are restricted from deleting tests."})
        if user.role == 'lecturer':
            if instance.lecturer != user:
                raise serializers.ValidationError({"detail": "Permission Denied: You can only delete your own created tests."})
        instance.delete()

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsLecturer | IsAdmin | IsPlatformCoordinator])
    def publish(self, request, pk=None):
        test_obj = self.get_object()
        user = request.user
        if user.role == 'lecturer' and test_obj.lecturer != user:
            if not (test_obj.course_unit and test_obj.course_unit.lecturers.filter(id=user.id).exists()):
                raise serializers.ValidationError({"detail": "Permission Denied: Only the user who set the test (or admin/coordinator) can publish or unpublish it."})
        test_obj.is_published = not test_obj.is_published
        test_obj.save()
        log_system_event(user, f"Test Publication Status set to {test_obj.is_published} for {test_obj.title}", level="INFO")
        return Response({
            'detail': f"Test publication status set to {'PUBLISHED' if test_obj.is_published else 'DRAFT'}.",
            'is_published': test_obj.is_published
        })

    @action(detail=True, methods=['get'], permission_classes=[permissions.IsAuthenticated, IsLecturer | IsAdmin | IsPlatformCoordinator | IsFacultyAdmin | IsDean])
    def preview_scorecard(self, request, pk=None):
        test_obj = self.get_object()
        questions = test_obj.questions.all()
        questions_data = TestQuestionLecturerSerializer(questions, many=True).data
        return Response({
            'id': test_obj.id,
            'title': test_obj.title,
            'category': test_obj.category,
            'category_display': test_obj.get_category_display(),
            'course_code': test_obj.course.code,
            'course_name': test_obj.course.name,
            'course_unit_code': test_obj.course_unit.code if test_obj.course_unit else None,
            'course_unit_name': test_obj.course_unit.name if test_obj.course_unit else None,
            'lecturer_name': test_obj.lecturer.get_full_name() or test_obj.lecturer.username,
            'duration_minutes': test_obj.duration_minutes,
            'total_marks': test_obj.total_marks,
            'pass_percentage': test_obj.pass_percentage,
            'allowed_attempts': test_obj.allowed_attempts,
            'is_published': test_obj.is_published,
            'is_results_released': test_obj.is_results_released,
            'year_of_study': test_obj.year_of_study,
            'scheduled_start': test_obj.scheduled_start,
            'due_date': test_obj.due_date,
            'total_questions': questions.count(),
            'questions': questions_data,
            'preview_mode': True,
            'card_type': 'test_scorecard'
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
            if user.role not in ['lecturer', 'admin', 'platform_coordinator', 'faculty_admin']:
                return Response({'detail': 'Only lecturers or staff can add test questions.'}, status=status.HTTP_403_FORBIDDEN)
            
            data = request.data.copy()
            data['test'] = test_obj.id
            serializer = TestQuestionLecturerSerializer(data=data)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsLecturer | IsAdmin | IsPlatformCoordinator])
    def import_txt_questions(self, request, pk=None):
        test_obj = self.get_object()
        txt_file = request.FILES.get('file') or request.FILES.get('txt_file')
        txt_content = request.data.get('content') or request.data.get('text') or ''

        if txt_file:
            txt_content = txt_file.read().decode('utf-8-sig', errors='ignore')

        if not txt_content.strip():
            return Response({'detail': 'Please provide a .txt file or paste Aiken question text.'}, status=status.HTTP_400_BAD_REQUEST)

        parsed_questions = parse_aiken_questions(txt_content)
        if not parsed_questions:
            return Response({'detail': 'No valid Aiken-format questions were found in the text file. Please ensure format: Question text, A. option, B. option, ANSWER: X.'}, status=status.HTTP_400_BAD_REQUEST)

        created_objs = []
        for q in parsed_questions:
            created_objs.append(TestQuestion(
                test=test_obj,
                question_text=q['question_text'],
                question_type='mcq',
                option_a=q['option_a'],
                option_b=q['option_b'],
                option_c=q['option_c'] or 'N/A',
                option_d=q['option_d'] or 'N/A',
                correct_answer=q['correct_answer'],
                points=1.0
            ))
        TestQuestion.objects.bulk_create(created_objs)

        msg = f"Successfully translated & imported {len(created_objs)} questions from text file into test '{test_obj.title}'."
        log_system_event(request.user, "TEST_TXT_QUESTIONS_IMPORTED", level="INFO", details=msg)
        return Response({
            'detail': msg,
            'count': len(created_objs),
            'questions': TestQuestionLecturerSerializer(created_objs, many=True).data
        })

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsLecturer | IsAdmin | IsPlatformCoordinator])
    def create_from_txt(self, request):
        txt_file = request.FILES.get('file') or request.FILES.get('txt_file')
        txt_content = request.data.get('content') or request.data.get('text') or ''
        title = request.data.get('title') or 'New Test Paper'
        category = request.data.get('category') or 'quiz'
        course_id = request.data.get('course') or request.data.get('course_id')
        course_unit_id = request.data.get('course_unit') or request.data.get('course_unit_id')
        duration_minutes = int(request.data.get('duration_minutes', 30))
        total_marks = int(request.data.get('total_marks', 100))
        pass_percentage = float(request.data.get('pass_percentage', 50.0))
        allowed_attempts = int(request.data.get('allowed_attempts', 1))
        year_of_study = int(request.data.get('year_of_study', 0))
        scheduled_start = request.data.get('scheduled_start') or None
        due_date = request.data.get('due_date') or None

        if txt_file:
            txt_content = txt_file.read().decode('utf-8-sig', errors='ignore')

        if not txt_content.strip():
            return Response({'detail': 'Please upload a .txt file or paste Aiken question text.'}, status=status.HTTP_400_BAD_REQUEST)

        parsed_questions = parse_aiken_questions(txt_content)
        if not parsed_questions:
            return Response({'detail': 'No valid Aiken-format questions were found in the text file.'}, status=status.HTTP_400_BAD_REQUEST)

        course = None
        if course_id:
            course = Course.objects.filter(id=course_id).first()
        elif course_unit_id:
            cu = CourseUnit.objects.filter(id=course_unit_id).first()
            if cu:
                course = cu.course
        if not course:
            course = Course.objects.first()

        course_unit = CourseUnit.objects.filter(id=course_unit_id).first() if course_unit_id else None

        test_obj = Test.objects.create(
            course=course,
            course_unit=course_unit,
            lecturer=request.user,
            title=title,
            category=category,
            duration_minutes=duration_minutes,
            total_marks=total_marks,
            pass_percentage=pass_percentage,
            allowed_attempts=allowed_attempts,
            year_of_study=year_of_study,
            scheduled_start=scheduled_start,
            due_date=due_date,
            is_published=False,
            is_results_released=True
        )

        created_objs = []
        for q in parsed_questions:
            created_objs.append(TestQuestion(
                test=test_obj,
                question_text=q['question_text'],
                question_type='mcq',
                option_a=q['option_a'],
                option_b=q['option_b'],
                option_c=q['option_c'] or 'N/A',
                option_d=q['option_d'] or 'N/A',
                correct_answer=q['correct_answer'],
                points=1.0
            ))
        TestQuestion.objects.bulk_create(created_objs)

        msg = f"Successfully created test '{test_obj.title}' with {len(created_objs)} questions translated from text file!"
        log_system_event(request.user, "TEST_CREATED_FROM_TXT", level="INFO", details=msg)
        return Response({
            'detail': msg,
            'test': TestSerializer(test_obj).data,
            'questions_count': len(created_objs)
        }, status=status.HTTP_201_CREATED)

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

        # Hard Due Date cutoff
        if test_obj.due_date and now > test_obj.due_date:
            return Response({'detail': 'Test Access Denied: The deadline (due date) for submitting this test has passed.'}, status=status.HTTP_400_BAD_REQUEST)

        user_attempts = TestAttempt.objects.filter(student=request.user, test=test_obj)
        completed_count = user_attempts.filter(completed_at__isnull=False).count()

        if test_obj.allowed_attempts > 0 and completed_count >= test_obj.allowed_attempts:
            return Response({'detail': f'Maximum allowed attempts ({test_obj.allowed_attempts}) reached for this test.'}, status=status.HTTP_400_BAD_REQUEST)

        active_attempt = user_attempts.filter(completed_at__isnull=True).first()
        if active_attempt:
            return Response(TestAttemptSerializer(active_attempt).data)

        # Detect late attempt if started after scheduled stop time
        is_late = False
        if test_obj.scheduled_start:
            stop_time = test_obj.scheduled_start + timezone.timedelta(minutes=test_obj.duration_minutes)
            if now > stop_time:
                is_late = True

        attempt = TestAttempt.objects.create(
            student=request.user,
            test=test_obj,
            attempt_number=completed_count + 1,
            is_late=is_late
        )
        return Response(TestAttemptSerializer(attempt).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], permission_classes=[permissions.AllowAny])
    def export_csv(self, request, pk=None):
        authenticate_token_param(request)
        if not request.user or not request.user.is_authenticated or request.user.role not in ['admin', 'platform_coordinator', 'lecturer', 'dean', 'dvc', 'registrar', 'faculty_admin']:
            return Response({'detail': 'Authentication credentials were not provided or unauthorized.'}, status=status.HTTP_401_UNAUTHORIZED)

        test_obj = self.get_object()
        attempts = test_obj.attempts.select_related('student').all()

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="Test_Results_{test_obj.course.code}_{test_obj.id}.csv"'

        writer = csv.writer(response)
        writer.writerow(['Student Username', 'Full Name', 'Email', 'Test Title', 'Category', 'Course Code', 'Score (%)', 'Passed Status', 'Submitted At', 'Tab Switches', 'Attempt #', 'Is Late', 'Late Reason'])

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
                att.attempt_number,
                'YES' if att.is_late else 'NO',
                att.late_submission_reason or ''
            ])

        return response

# 10. Test Attempt ViewSet
class TestAttemptViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TestAttemptSerializer

    def get_queryset(self):
        user = self.request.user
        qs = TestAttempt.objects.all().order_by('-started_at')
        if not user or not user.is_authenticated:
            return qs.none()
        if user.role in ['dean', 'faculty_admin', 'faculty_secretary']:
            assigned_facs = get_user_assigned_faculties(user)
            qs = qs.filter(
                models.Q(test__course__faculty__in=assigned_facs) |
                models.Q(test__course_unit__course__faculty__in=assigned_facs) |
                models.Q(student__faculty__in=assigned_facs)
            ).distinct()
        elif user.role == 'student':
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

        now = timezone.now()
        test_obj = attempt.test

        # Hard Due Date Cutoff
        if test_obj.due_date and now > test_obj.due_date:
            return Response({'detail': 'Test Access Denied: The final deadline (due date) for this test has passed. Submissions are closed.'}, status=status.HTTP_400_BAD_REQUEST)

        answers = request.data.get('answers', {})
        tab_switches = request.data.get('tab_switches', 0)
        auto_submitted_reason = request.data.get('auto_submitted_reason', None)
        late_submission_reason = (request.data.get('late_submission_reason') or request.data.get('late_comment') or request.data.get('comment') or '').strip()

        # Late detection
        is_late = attempt.is_late
        allotted_stop = attempt.started_at + timezone.timedelta(minutes=test_obj.duration_minutes)
        scheduled_stop = (test_obj.scheduled_start + timezone.timedelta(minutes=test_obj.duration_minutes)) if test_obj.scheduled_start else None

        if now > allotted_stop or (scheduled_stop and now > scheduled_stop):
            is_late = True

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
        attempt.is_late = is_late
        if late_submission_reason:
            attempt.late_submission_reason = late_submission_reason
        elif is_late and not attempt.late_submission_reason:
            attempt.late_submission_reason = auto_submitted_reason or 'Late submission after regular stop time.'
        attempt.completed_at = now
        attempt.save()

        log_system_event(request.user, f"Test Submitted: {attempt.test.title} (Score: {attempt.score}%, Passed: {passed}, Late: {attempt.is_late})", level="INFO")
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
        
        # Determine scoping for Dean and Faculty Admin/Secretary
        if user.role in ['dean', 'faculty_admin', 'faculty_secretary']:
            assigned_facs = get_user_assigned_faculties(user)
            student_qs = User.objects.filter(role='student', faculty__in=assigned_facs)
            lecturer_qs = User.objects.filter(
                models.Q(faculty__in=assigned_facs) | models.Q(assigned_course_units__course__faculty__in=assigned_facs),
                role='lecturer'
            ).distinct()
            total_students = student_qs.count()
            total_lecturers = lecturer_qs.count()
            total_faculties = assigned_facs.count()
            total_courses = Course.objects.filter(faculty__in=assigned_facs).count()
            total_course_units = CourseUnit.objects.filter(course__faculty__in=assigned_facs).count()
            total_exams = Exam.objects.filter(course__faculty__in=assigned_facs).count()
            approved_exams = Exam.objects.filter(course__faculty__in=assigned_facs, is_approved_by_dean=True).count()
            total_tests = Test.objects.filter(course__faculty__in=assigned_facs).count()
            published_tests = Test.objects.filter(course__faculty__in=assigned_facs, is_published=True).count()
            total_class_timetables = ClassTimetable.objects.filter(
                models.Q(faculty__in=assigned_facs) | models.Q(course__faculty__in=assigned_facs)
            ).distinct().count()
            total_exam_timetables = ExamTimetable.objects.filter(
                models.Q(faculty__in=assigned_facs) | models.Q(course__faculty__in=assigned_facs)
            ).distinct().count()
        else:
            student_qs = User.objects.filter(role='student')
            total_students = student_qs.count()
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

        if user.role in ['dean', 'faculty_admin', 'faculty_secretary']:
            assigned_facs = get_user_assigned_faculties(user)
            exam_attempts = exam_attempts.filter(
                models.Q(exam__course__faculty__in=assigned_facs) | models.Q(student__faculty__in=assigned_facs)
            ).distinct()
            test_attempts = test_attempts.filter(
                models.Q(test__course__faculty__in=assigned_facs) | models.Q(student__faculty__in=assigned_facs)
            ).distinct()

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
            'students_100_tuition': sum(1 for s in student_qs if check_student_clearance(s)['is_exam_cleared']),
            'students_50_tuition': sum(1 for s in student_qs if check_student_clearance(s)['is_test_cleared'] and not check_student_clearance(s)['is_exam_cleared']),
            'students_below_50_tuition': sum(1 for s in student_qs if not check_student_clearance(s)['is_test_cleared']),
            'total_api_cleared_students': sum(1 for s in student_qs if check_student_clearance(s)['is_api_cleared']),
            'external_api_total_records': len(fetch_external_cleared_students()) if isinstance(fetch_external_cleared_students(), list) else 0,
        }

        # Role-specific additions
        if user.role in ['dvc', 'vc', 'dean', 'admin', 'registrar', 'faculty_admin', 'faculty_secretary']:
            faculty_submissions = []
            if user.role in ['dean', 'faculty_admin', 'faculty_secretary']:
                faculties = get_user_assigned_faculties(user)
            else:
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
        if not request.user or not request.user.is_authenticated or request.user.role not in ['admin', 'platform_coordinator']:
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


# 20. Question CRUD ViewSets for Scorecard Layout Editing
class TestQuestionViewSet(viewsets.ModelViewSet):
    queryset = TestQuestion.objects.all()
    serializer_class = TestQuestionLecturerSerializer
    permission_classes = [permissions.IsAuthenticated, IsLecturer | IsAdmin | IsPlatformCoordinator | IsFacultyAdmin]

    def perform_create(self, serializer):
        user = self.request.user
        test_obj = serializer.validated_data.get('test')
        if user.role == 'lecturer' and test_obj and test_obj.lecturer != user:
            raise serializers.ValidationError({"detail": "Permission Denied: You can only add questions to your own tests."})
        serializer.save()

    def perform_update(self, serializer):
        user = self.request.user
        if user.role == 'lecturer' and serializer.instance.test.lecturer != user:
            raise serializers.ValidationError({"detail": "Permission Denied: You can only edit questions on your own tests."})
        serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
        if user.role == 'lecturer' and instance.test.lecturer != user:
            raise serializers.ValidationError({"detail": "Permission Denied: You can only delete questions from your own tests."})
        instance.delete()


class QuestionViewSet(viewsets.ModelViewSet):
    queryset = Question.objects.all()
    serializer_class = QuestionLecturerSerializer
    permission_classes = [permissions.IsAuthenticated, IsLecturer | IsAdmin | IsPlatformCoordinator | IsFacultyAdmin]

    def perform_create(self, serializer):
        user = self.request.user
        exam_obj = serializer.validated_data.get('exam')
        if user.role == 'lecturer' and exam_obj and exam_obj.lecturer != user:
            raise serializers.ValidationError({"detail": "Permission Denied: You can only add questions to your own exams."})
        serializer.save()

    def perform_update(self, serializer):
        user = self.request.user
        if user.role == 'lecturer' and serializer.instance.exam.lecturer != user:
            raise serializers.ValidationError({"detail": "Permission Denied: You can only edit questions on your own exams."})
        serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
        if user.role == 'lecturer' and instance.exam.lecturer != user:
            raise serializers.ValidationError({"detail": "Permission Denied: You can only delete questions from your own exams."})
        instance.delete()


