import csv
import random
from django.db import models
from django.utils import timezone
from django.http import HttpResponse
from rest_framework import viewsets, status, permissions, generics
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import (
    User, Faculty, Invitation, Course, CourseUnit, Application, Exam, Question, 
    ExamAttempt, Test, TestQuestion, TestAttempt, ClassContent, AttendanceSession, AttendanceRecord,
    ClassTimetable, ExamTimetable, SystemLog, ProctoringSetting, log_system_event
)
from .serializers import (
    UserSerializer, UserCreateSerializer, AdminUserSerializer, FacultySerializer,
    InvitationSerializer, CourseSerializer, CourseUnitSerializer, ApplicationSerializer, ApplicationReviewSerializer,
    ExamSerializer, QuestionLecturerSerializer, QuestionStudentSerializer, ExamAttemptSerializer,
    TestSerializer, TestQuestionLecturerSerializer, TestQuestionStudentSerializer, TestAttemptSerializer,
    ClassContentSerializer, AttendanceSessionSerializer, AttendanceRecordSerializer,
    ClassTimetableSerializer, ExamTimetableSerializer, SystemLogSerializer, ProctoringSettingSerializer
)
from .permissions import IsAdmin, IsDVC, IsDean, IsFacultyAdmin, IsRegistrar, IsLecturer, IsStudent, IsStaffUser

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
        data = super().validate(attrs)
        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'email': self.user.email,
            'role': self.user.role,
            'first_name': self.user.first_name,
            'last_name': self.user.last_name,
            'tuition_paid_percentage': getattr(self.user, 'tuition_paid_percentage', 100.0)
        }
        log_system_event(self.user, "User Login Success", level="INFO")
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

# 4b. Invitation Management ViewSet
class InvitationViewSet(viewsets.ModelViewSet):
    serializer_class = InvitationSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get_queryset(self):
        return Invitation.objects.all().order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

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
    queryset = Faculty.objects.all().order_by('code')
    serializer_class = FacultySerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), (IsAdmin | IsDVC | IsDean | IsFacultyAdmin)()]

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
        if not student_id:
            return Response({'detail': 'student_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            student = User.objects.get(id=student_id, role='student')
            student.faculty = faculty
            if course_ids:
                courses = Course.objects.filter(id__in=course_ids, faculty=faculty)
                student.assigned_courses.set(courses)
            student.save()
            log_system_event(user, f"Assigned Student {student.username} to Faculty {faculty.code}", level='INFO')
            return Response({'detail': f'Assigned student {student.get_full_name() or student.username} to {faculty.name}.', 'student': UserSerializer(student).data})
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
    queryset = Course.objects.all().order_by('code')
    serializer_class = CourseSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), (IsAdmin | IsDVC | IsDean | IsFacultyAdmin)()]

class CourseUnitViewSet(viewsets.ModelViewSet):
    serializer_class = CourseUnitSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        if self.action == 'assign_lecturer':
            return [permissions.IsAuthenticated(), (IsAdmin | IsFacultyAdmin)()]
        return [permissions.IsAuthenticated(), (IsAdmin | IsDVC | IsDean | IsFacultyAdmin)()]

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

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsAdmin | IsFacultyAdmin | IsDean])
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
        return Application.objects.filter(student=user).order_by('-applied_at')

    def perform_create(self, serializer):
        serializer.save(student=self.request.user, status='pending')

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsDean | IsDVC | IsAdmin])
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
            student_courses = Course.objects.filter(
                models.Q(applications__student=user, applications__status='approved') |
                models.Q(assigned_students=user) |
                models.Q(faculty=user.faculty)
            ).distinct()
            return Exam.objects.filter(is_active=True, course__in=student_courses).order_by('-created_at')
        elif user.role == 'lecturer':
            return Exam.objects.filter(lecturer=user).order_by('-created_at')
        return Exam.objects.all().order_by('-created_at')

    def perform_create(self, serializer):
        user = self.request.user
        if user.role == 'lecturer':
            course_unit = serializer.validated_data.get('course_unit')
            course = serializer.validated_data.get('course')
            is_assigned = False
            if course_unit and course_unit.lecturers.filter(id=user.id).exists():
                is_assigned = True
            elif course and course.units.filter(lecturers=user).exists():
                is_assigned = True
            if not is_assigned:
                raise generics.serializers.ValidationError({"detail": "Permission Denied: You can only set exams for your assigned courses or course units."})
        exam = serializer.save(lecturer=user)
        log_system_event(user, f"Exam Created: {exam.title} ({exam.course.code})", level="INFO")

    def perform_update(self, serializer):
        user = self.request.user
        if user.role == 'lecturer':
            if serializer.instance.lecturer != user:
                raise generics.serializers.ValidationError({"detail": "Permission Denied: You can only update your own created exams."})
        serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
        if user.role == 'lecturer':
            if instance.lecturer != user:
                raise generics.serializers.ValidationError({"detail": "Permission Denied: You can only delete your own created exams."})
        instance.delete()

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsDean | IsAdmin])
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

        # Fee Gate: Exam requires 100% full tuition clearance!
        if getattr(student, 'tuition_paid_percentage', 100.0) < 100.0:
            return Response({
                'detail': f'Exam Access Denied: 100% full tuition clearance required to sit for final examinations. Your current clearance is {student.tuition_paid_percentage}%. Please clear your outstanding balance with the Bursar.'
            }, status=status.HTTP_403_FORBIDDEN)

        # Dean Approval check (PDF Requirement: available upon respective dean approval)
        if not exam.is_approved_by_dean:
            return Response({'detail': 'Exam Access Denied: This examination is pending approval from the Faculty Dean and is not yet available.'}, status=status.HTTP_400_BAD_REQUEST)

        if not exam.is_active:
            return Response({'detail': 'This exam is not active.'}, status=status.HTTP_400_BAD_REQUEST)

        # Scheduled Date & Time Availability check (PDF Requirement: only on the set date and time)
        now = timezone.now()
        if exam.scheduled_start:
            if now < exam.scheduled_start:
                return Response({'detail': f'Exam Access Denied: This exam is scheduled for {exam.scheduled_start.strftime("%Y-%m-%d %H:%M")} and is not yet open.'}, status=status.HTTP_400_BAD_REQUEST)
            end_window = exam.scheduled_start + timezone.timedelta(minutes=exam.duration_minutes)
            if now > end_window:
                return Response({'detail': 'Exam Access Denied: Scheduled exam time window has expired.'}, status=status.HTTP_400_BAD_REQUEST)

        # Security check: Late entry rule
        start_time = exam.scheduled_start or exam.created_at
        allowed_delay_minutes = exam.duration_minutes / 3.0
        elapsed_minutes = (now - start_time).total_seconds() / 60.0

        if elapsed_minutes > allowed_delay_minutes and exam.scheduled_start:
            return Response({
                'detail': f'Security Lockdown: Late entry policy prohibits starting the exam after 1/3 of allocated duration ({allowed_delay_minutes:.1f} mins) has elapsed.'
            }, status=status.HTTP_403_FORBIDDEN)

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
        if unit_id:
            qs = qs.filter(exam__course_unit_id=unit_id)
        if lecturer_id:
            qs = qs.filter(exam__lecturer_id=lecturer_id)
        if exam_id:
            qs = qs.filter(exam_id=exam_id)
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
            student_courses = Course.objects.filter(
                models.Q(applications__student=user, applications__status='approved') |
                models.Q(assigned_students=user) |
                models.Q(faculty=user.faculty)
            ).distinct()
            return Test.objects.filter(is_published=True, course__in=student_courses).order_by('-created_at')
        elif user.role == 'lecturer':
            return Test.objects.filter(lecturer=user).order_by('-created_at')
        return Test.objects.all().order_by('-created_at')

    def perform_create(self, serializer):
        user = self.request.user
        if user.role == 'lecturer':
            course_unit = serializer.validated_data.get('course_unit')
            course = serializer.validated_data.get('course')
            is_assigned = False
            if course_unit and course_unit.lecturers.filter(id=user.id).exists():
                is_assigned = True
            elif course and course.units.filter(lecturers=user).exists():
                is_assigned = True
            if not is_assigned:
                raise generics.serializers.ValidationError({"detail": "Permission Denied: You can only set tests for your assigned courses or course units."})
        test = serializer.save(lecturer=user)
        log_system_event(user, f"Test Created: {test.title} ({test.course.code})", level="INFO")

    def perform_update(self, serializer):
        user = self.request.user
        if user.role == 'lecturer':
            if serializer.instance.lecturer != user:
                raise generics.serializers.ValidationError({"detail": "Permission Denied: You can only update your own created tests."})
        serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
        if user.role == 'lecturer':
            if instance.lecturer != user:
                raise generics.serializers.ValidationError({"detail": "Permission Denied: You can only delete your own created tests."})
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

        # Fee Gate: Test requires at least 50% tuition clearance!
        if getattr(student, 'tuition_paid_percentage', 100.0) < 50.0:
            return Response({
                'detail': f'Test Access Denied: At least 50% tuition clearance required to access quizzes and tests. Your current clearance is {student.tuition_paid_percentage}%. Please clear your fees with the Bursar.'
            }, status=status.HTTP_403_FORBIDDEN)

        if not test_obj.is_published:
            return Response({'detail': 'This test is currently unpublished.'}, status=status.HTTP_400_BAD_REQUEST)

        # Scheduled Date & Time Availability check (PDF Requirement: only on the set date and time)
        now = timezone.now()
        if test_obj.scheduled_start:
            if now < test_obj.scheduled_start:
                return Response({'detail': f'Test Access Denied: This test is scheduled for {test_obj.scheduled_start.strftime("%Y-%m-%d %H:%M")} and is not yet open.'}, status=status.HTTP_400_BAD_REQUEST)
            end_window = test_obj.scheduled_start + timezone.timedelta(minutes=test_obj.duration_minutes)
            if now > end_window:
                return Response({'detail': 'Test Access Denied: Scheduled test time window has expired.'}, status=status.HTTP_400_BAD_REQUEST)

        if test_obj.due_date and now > test_obj.due_date:
            return Response({'detail': 'Test Access Denied: The deadline for submitting this test has passed.'}, status=status.HTTP_400_BAD_REQUEST)

        # Security check: Late entry rule
        start_time = test_obj.scheduled_start or test_obj.created_at
        allowed_delay_minutes = test_obj.duration_minutes / 2.0
        elapsed_minutes = (now - start_time).total_seconds() / 60.0

        if elapsed_minutes > allowed_delay_minutes and test_obj.scheduled_start:
            return Response({
                'detail': f'Security Lockdown: Late entry policy prohibits starting this test after half (1/2) of allocated duration ({allowed_delay_minutes:.1f} mins) has elapsed.'
            }, status=status.HTTP_403_FORBIDDEN)

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
        if unit_id:
            qs = qs.filter(test__course_unit_id=unit_id)
        if lecturer_id:
            qs = qs.filter(test__lecturer_id=lecturer_id)
        if test_id:
            qs = qs.filter(test_id=test_id)
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
                raise generics.serializers.ValidationError({"detail": "Permission Denied: You can only upload resources for your assigned courses."})
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
                raise generics.serializers.ValidationError({"detail": "Permission Denied: You can only open attendance for your assigned courses."})
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

        exam_attempts = ExamAttempt.objects.filter(completed_at__isnull=False)
        test_attempts = TestAttempt.objects.filter(completed_at__isnull=False)

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
            'students_100_tuition': User.objects.filter(role='student', tuition_paid_percentage__gte=100.0).count(),
            'students_50_tuition': User.objects.filter(role='student', tuition_paid_percentage__gte=50.0, tuition_paid_percentage__lt=100.0).count(),
            'students_below_50_tuition': User.objects.filter(role='student', tuition_paid_percentage__lt=50.0).count(),
        }

        # Role-specific additions
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
            approved_courses = Course.objects.filter(applications__student=user, applications__status='approved')
            if approved_courses.exists():
                return qs.filter(course__in=approved_courses)
            default_course = Course.objects.filter(code='BIT2026').first()
            if default_course:
                return qs.filter(course=default_course)

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
            approved_courses = Course.objects.filter(applications__student=user, applications__status='approved')
            if approved_courses.exists():
                return qs.filter(course__in=approved_courses)
            default_course = Course.objects.filter(code='BIT2026').first()
            if default_course:
                return qs.filter(course=default_course)

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
