import csv
import random
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
    ClassTimetable, ExamTimetable, SystemLog, log_system_event
)
from .serializers import (
    UserSerializer, UserCreateSerializer, AdminUserSerializer, FacultySerializer,
    InvitationSerializer, CourseSerializer, CourseUnitSerializer, ApplicationSerializer, ApplicationReviewSerializer,
    ExamSerializer, QuestionLecturerSerializer, QuestionStudentSerializer, ExamAttemptSerializer,
    TestSerializer, TestQuestionLecturerSerializer, TestQuestionStudentSerializer, TestAttemptSerializer,
    ClassContentSerializer, AttendanceSessionSerializer, AttendanceRecordSerializer,
    ClassTimetableSerializer, ExamTimetableSerializer, SystemLogSerializer
)
from .permissions import IsAdmin, IsDVC, IsDean, IsFacultyAdmin, IsRegistrar, IsLecturer, IsStudent, IsStaffUser

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
        }
        log_system_event(self.user, "User Login Success", level="INFO")
        return data

class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer

# 2. Registration API
class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserCreateSerializer
    permission_classes = (permissions.AllowAny,)

# 3. Admin User Management ViewSet
class AdminUserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = AdminUserSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def create(self, request, *args, **kwargs):
        serializer = UserCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)

# 4. Invitation ViewSet
class InvitationViewSet(viewsets.ModelViewSet):
    queryset = Invitation.objects.all().order_by('-created_at')
    serializer_class = InvitationSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin | IsFacultyAdmin | IsRegistrar]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny], url_path='verify/(?P<token>[^/.]+)')
    def verify(self, request, token=None):
        try:
            invite = Invitation.objects.get(id=token, is_used=False)
            return Response({
                'valid': True,
                'email': invite.email,
                'role': invite.role
            })
        except (Invitation.DoesNotExist, ValueError):
            return Response({'valid': False, 'message': 'Invalid or expired token.'}, status=status.HTTP_400_BAD_REQUEST)

# 5. Faculty & Course Management ViewSets
class FacultyViewSet(viewsets.ModelViewSet):
    queryset = Faculty.objects.all().order_by('code')
    serializer_class = FacultySerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), IsAdmin | IsDVC | IsDean | IsFacultyAdmin]

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

class CourseViewSet(viewsets.ModelViewSet):
    queryset = Course.objects.all().order_by('code')
    serializer_class = CourseSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), IsAdmin | IsDVC | IsDean | IsFacultyAdmin]

class CourseUnitViewSet(viewsets.ModelViewSet):
    queryset = CourseUnit.objects.all().order_by('code')
    serializer_class = CourseUnitSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), IsAdmin | IsDVC | IsDean | IsFacultyAdmin]

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsAdmin | IsFacultyAdmin | IsDean])
    def assign_lecturer(self, request, pk=None):
        unit = self.get_object()
        lecturer_id = request.data.get('lecturer_id')
        try:
            lecturer = User.objects.get(id=lecturer_id, role='lecturer')
            unit.lecturers.add(lecturer)
            return Response({'detail': f'Assigned lecturer {lecturer.get_full_name()} to {unit.code}'})
        except User.DoesNotExist:
            return Response({'detail': 'Lecturer not found.'}, status=status.HTTP_404_NOT_FOUND)

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

# 7. Exam ViewSet (with Dean Approvals, Registrar Release, CSV Export, and 1/3 Cutoff Security)
class ExamViewSet(viewsets.ModelViewSet):
    serializer_class = ExamSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == 'student':
            return Exam.objects.filter(is_active=True).order_by('-created_at')
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
        if not exam.is_active:
            return Response({'detail': 'This exam is not active.'}, status=status.HTTP_400_BAD_REQUEST)

        # Security check: Late entry rule (Student CANNOT start exam after 1/3 of allocated duration has passed)
        now = timezone.now()
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

    @action(detail=True, methods=['get'], permission_classes=[permissions.IsAuthenticated, IsStaffUser])
    def export_csv(self, request, pk=None):
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
        if user.role == 'student':
            return ExamAttempt.objects.filter(student=user).order_by('-started_at')
        elif user.role == 'lecturer':
            return ExamAttempt.objects.filter(exam__lecturer=user).order_by('-started_at')
        return ExamAttempt.objects.all().order_by('-started_at')

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsStudent])
    def submit(self, request, pk=None):
        attempt = self.get_object()
        if attempt.student != request.user:
            return Response({'detail': 'Unauthorized.'}, status=status.HTTP_403_FORBIDDEN)
        if attempt.completed_at:
            return Response({'detail': 'This attempt has already been submitted.'}, status=status.HTTP_400_BAD_REQUEST)

        answers = request.data.get('answers', {})
        tab_switches = request.data.get('tab_switches', 0)
        auto_reason = request.data.get('auto_submitted_reason', '')

        attempt.answers = answers
        attempt.tab_switches_count = tab_switches
        attempt.auto_submitted_reason = auto_reason
        
        questions = attempt.exam.questions.all()
        total_questions = questions.count()
        
        if total_questions == 0:
            score = 0.0
        else:
            correct_count = 0
            for q in questions:
                student_ans = answers.get(str(q.id))
                if student_ans and str(student_ans).upper() == str(q.correct_option).upper():
                    correct_count += 1
            
            score = (correct_count / total_questions) * 100.0

        attempt.score = round(score, 2)
        attempt.completed_at = timezone.now()
        attempt.save()

        return Response(ExamAttemptSerializer(attempt, context={'request': request}).data)

# 9. NEW Test ViewSet (Full Test Portal Engine)
class TestViewSet(viewsets.ModelViewSet):
    serializer_class = TestSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == 'student':
            return Test.objects.filter(is_published=True).order_by('-created_at')
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
        test_obj = serializer.save(lecturer=user)
        log_system_event(user, f"Test Created: {test_obj.title} ({test_obj.course.code})", level="INFO")

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsLecturer | IsAdmin])
    def publish(self, request, pk=None):
        test_obj = self.get_object()
        test_obj.is_published = not test_obj.is_published
        test_obj.save()
        return Response({
            'detail': f"Test publication status updated to: {'PUBLISHED' if test_obj.is_published else 'DRAFT'}",
            'is_published': test_obj.is_published
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
        """Seamlessly seeds a package of standard test questions into the target test."""
        test_obj = self.get_object()
        preset_questions = [
            {
                "question_text": "What is the primary role of data structures in software design?",
                "question_type": "mcq",
                "option_a": "Styling user interfaces",
                "option_b": "Efficient data organization and access",
                "option_c": "Sending HTTP network packets",
                "option_d": "Formatting database tables",
                "correct_answer": "B",
                "points": 2.0,
                "explanation": "Data structures provide organized formats for storing, retrieving, and managing computer data efficiently."
            },
            {
                "question_text": "Relational databases use SQL as the standard query language.",
                "question_type": "tf",
                "option_a": "True",
                "option_b": "False",
                "correct_answer": "True",
                "points": 1.0,
                "explanation": "SQL (Structured Query Language) is the universally standard domain-specific language for managing RDBMS."
            },
            {
                "question_text": "Which HTTP request method is idempotent and primarily used to fetch data?",
                "question_type": "short",
                "correct_answer": "GET",
                "points": 2.0,
                "explanation": "The GET method is defined as idempotent and safe for fetching resource representations."
            }
        ]
        created = []
        for q_data in preset_questions:
            q = TestQuestion.objects.create(test=test_obj, **q_data)
            created.append(q.id)

        return Response({
            'detail': f'Successfully seeded {len(created)} test questions seamlessly.',
            'questions_count': test_obj.questions.count()
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsStudent])
    def start_attempt(self, request, pk=None):
        test_obj = self.get_object()
        if not test_obj.is_published:
            return Response({'detail': 'This test is currently unpublished.'}, status=status.HTTP_400_BAD_REQUEST)

        # Security check: Late entry rule (Student CANNOT start test after 1/2 of allocated duration has passed)
        now = timezone.now()
        start_time = test_obj.scheduled_start or test_obj.created_at
        allowed_delay_minutes = test_obj.duration_minutes / 2.0
        elapsed_minutes = (now - start_time).total_seconds() / 60.0

        if elapsed_minutes > allowed_delay_minutes and test_obj.scheduled_start:
            return Response({
                'detail': f'Security Lockdown: Late entry policy prohibits starting this test after half (1/2) of allocated duration ({allowed_delay_minutes:.1f} mins) has elapsed.'
            }, status=status.HTTP_403_FORBIDDEN)

        # Allowed attempts check
        user_attempts = TestAttempt.objects.filter(student=request.user, test=test_obj)
        completed_count = user_attempts.filter(completed_at__isnull=False).count()

        if test_obj.allowed_attempts > 0 and completed_count >= test_obj.allowed_attempts:
            return Response({'detail': f'Maximum allowed attempts ({test_obj.allowed_attempts}) reached for this test.'}, status=status.HTTP_400_BAD_REQUEST)

        # Check for uncompleted active attempt
        active_attempt = user_attempts.filter(completed_at__isnull=True).first()
        if active_attempt:
            return Response(TestAttemptSerializer(active_attempt).data)

        attempt = TestAttempt.objects.create(
            student=request.user,
            test=test_obj,
            attempt_number=completed_count + 1
        )
        return Response(TestAttemptSerializer(attempt).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], permission_classes=[permissions.IsAuthenticated, IsStaffUser])
    def export_csv(self, request, pk=None):
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

# 10. NEW Test Attempt ViewSet
class TestAttemptViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TestAttemptSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == 'student':
            return TestAttempt.objects.filter(student=user).order_by('-started_at')
        elif user.role == 'lecturer':
            return TestAttempt.objects.filter(test__lecturer=user).order_by('-started_at')
        return TestAttempt.objects.all().order_by('-started_at')

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsStudent])
    def submit(self, request, pk=None):
        attempt = self.get_object()
        if attempt.student != request.user:
            return Response({'detail': 'Unauthorized.'}, status=status.HTTP_403_FORBIDDEN)
        if attempt.completed_at:
            return Response({'detail': 'This attempt has already been submitted.'}, status=status.HTTP_400_BAD_REQUEST)

        answers = request.data.get('answers', {})
        tab_switches = request.data.get('tab_switches', 0)
        auto_reason = request.data.get('auto_submitted_reason', '')

        attempt.answers = answers
        attempt.tab_switches_count = tab_switches
        attempt.auto_submitted_reason = auto_reason

        questions = attempt.test.questions.all()
        total_points = sum(q.points for q in questions)
        earned_points = 0.0

        for q in questions:
            user_ans = str(answers.get(str(q.id), '')).strip()
            correct_ans = str(q.correct_answer).strip()

            if q.question_type in ['mcq', 'tf']:
                if user_ans.upper() == correct_ans.upper():
                    earned_points += q.points
            elif q.question_type == 'short':
                if user_ans.lower() == correct_ans.lower():
                    earned_points += q.points

        score = (earned_points / total_points * 100.0) if total_points > 0 else 0.0
        score = round(score, 2)

        attempt.score = score
        attempt.passed = (score >= attempt.test.pass_percentage)
        attempt.completed_at = timezone.now()
        attempt.save()

        return Response(TestAttemptSerializer(attempt).data)

    @action(detail=True, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def results(self, request, pk=None):
        attempt = self.get_object()
        if attempt.student != request.user and request.user.role not in ['lecturer', 'dean', 'faculty_admin', 'registrar', 'dvc', 'admin']:
            return Response({'detail': 'Unauthorized.'}, status=status.HTTP_403_FORBIDDEN)
        if not attempt.completed_at:
            return Response({'detail': 'This test attempt is incomplete.'}, status=status.HTTP_400_BAD_REQUEST)

        attempt_data = TestAttemptSerializer(attempt).data
        questions = attempt.test.questions.all()
        
        # In test results, we return lecturer question details including explanation notes & correct answers!
        questions_data = TestQuestionLecturerSerializer(questions, many=True).data

        return Response({
            'attempt': attempt_data,
            'questions': questions_data
        })

# 11. Class Content ViewSet
class ClassContentViewSet(viewsets.ModelViewSet):
    serializer_class = ClassContentSerializer

    def get_queryset(self):
        return ClassContent.objects.all().order_by('-created_at')

    def perform_create(self, serializer):
        user = self.request.user
        if user.role == 'lecturer':
            course = serializer.validated_data.get('course')
            if course and not course.units.filter(lecturers=user).exists():
                raise generics.serializers.ValidationError({"detail": "Permission Denied: You are not an assigned lecturer for this course."})
        content = serializer.save(lecturer=user)
        log_system_event(user, f"Class Content Uploaded: {content.title}", level="INFO")

# 12. Attendance Session ViewSet
class AttendanceSessionViewSet(viewsets.ModelViewSet):
    serializer_class = AttendanceSessionSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == 'lecturer':
            return AttendanceSession.objects.filter(lecturer=user).order_by('-created_at')
        return AttendanceSession.objects.all().order_by('-created_at')

    def perform_create(self, serializer):
        user = self.request.user
        if user.role == 'lecturer':
            course = serializer.validated_data.get('course')
            if course and not course.units.filter(lecturers=user).exists():
                raise generics.serializers.ValidationError({"detail": "Permission Denied: You are not an assigned lecturer for this course."})
        code = str(random.randint(1000, 9999))
        session = serializer.save(lecturer=user, code=code, is_active=True)
        log_system_event(user, f"Attendance Session Started: {session.course.code}", level="INFO")

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsStudent])
    def check_in(self, request):
        session_id = request.data.get('session_id')
        code = request.data.get('code')

        if not session_id or not code:
            return Response({'detail': 'Session ID and Code are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            session = AttendanceSession.objects.get(id=session_id)
        except AttendanceSession.DoesNotExist:
            return Response({'detail': 'Attendance session not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not session.is_active:
            return Response({'detail': 'This attendance session has ended.'}, status=status.HTTP_400_BAD_REQUEST)

        if session.code != code:
            return Response({'detail': 'Invalid code. Please try again.'}, status=status.HTTP_400_BAD_REQUEST)

        record, created = AttendanceRecord.objects.get_or_create(
            session=session,
            student=request.user
        )

        if not created:
            return Response({'detail': 'You have already checked in for this class.'}, status=status.HTTP_400_BAD_REQUEST)

        return Response(AttendanceRecordSerializer(record).data, status=status.HTTP_201_CREATED)

# 13. Reports API Engine
class ReportsViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'])
    def summary(self, request):
        user = request.user
        
        # Student personal academic report
        if user.role == 'student':
            exam_attempts = ExamAttempt.objects.filter(student=user, completed_at__isnull=False)
            test_attempts = TestAttempt.objects.filter(student=user, completed_at__isnull=False)
            
            exams_passed = sum(1 for e in exam_attempts if e.score >= 50.0)
            tests_passed = sum(1 for t in test_attempts if t.passed)

            return Response({
                'role': 'student',
                'exams_done': exam_attempts.count(),
                'exams_passed': exams_passed,
                'exams_failed': exam_attempts.count() - exams_passed,
                'tests_done': test_attempts.count(),
                'tests_passed': tests_passed,
                'tests_failed': test_attempts.count() - tests_passed,
                'average_test_score': round(sum(t.score for t in test_attempts) / max(test_attempts.count(), 1), 2),
                'attendance_count': AttendanceRecord.objects.filter(student=user).count()
            })

        # Lecturer teaching report
        elif user.role == 'lecturer':
            my_exams = Exam.objects.filter(lecturer=user)
            my_tests = Test.objects.filter(lecturer=user)
            my_attempts = ExamAttempt.objects.filter(exam__in=my_exams, completed_at__isnull=False)
            test_attempts = TestAttempt.objects.filter(test__in=my_tests, completed_at__isnull=False)

            return Response({
                'role': 'lecturer',
                'exams_created': my_exams.count(),
                'tests_created': my_tests.count(),
                'total_exam_submissions': my_attempts.count(),
                'total_test_submissions': test_attempts.count(),
                'exam_pass_rate': round(sum(1 for a in my_attempts if a.score >= 50.0) / max(my_attempts.count(), 1) * 100, 1),
                'test_pass_rate': round(sum(1 for t in test_attempts if t.passed) / max(test_attempts.count(), 1) * 100, 1),
            })

        # General Executive / Faculty / Registrar / Admin summary
        all_exams = Exam.objects.all()
        all_tests = Test.objects.all()
        all_exam_attempts = ExamAttempt.objects.filter(completed_at__isnull=False)
        all_test_attempts = TestAttempt.objects.filter(completed_at__isnull=False)

        return Response({
            'role': user.role,
            'total_students': User.objects.filter(role='student').count(),
            'total_lecturers': User.objects.filter(role='lecturer').count(),
            'total_faculties': Faculty.objects.count(),
            'total_courses': Course.objects.count(),
            'total_course_units': CourseUnit.objects.count(),
            'total_exams': all_exams.count(),
            'approved_exams': all_exams.filter(is_approved_by_dean=True).count(),
            'total_tests': all_tests.count(),
            'published_tests': all_tests.filter(is_published=True).count(),
            'total_exam_attempts': all_exam_attempts.count(),
            'total_test_attempts': all_test_attempts.count(),
            'avg_exam_score': round(sum(a.score for a in all_exam_attempts) / max(all_exam_attempts.count(), 1), 2),
            'avg_test_score': round(sum(t.score for t in all_test_attempts) / max(all_test_attempts.count(), 1), 2),
            'total_class_timetables': ClassTimetable.objects.count(),
            'total_exam_timetables': ExamTimetable.objects.count(),
        })

class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

# 14. Class Timetable ViewSet (Faculty Secretary Management)
class ClassTimetableViewSet(viewsets.ModelViewSet):
    queryset = ClassTimetable.objects.all().order_by('day_of_week', 'start_time')
    serializer_class = ClassTimetableSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), IsFacultyAdmin | IsAdmin]

    def perform_create(self, serializer):
        user = self.request.user
        timetable = serializer.save(created_by=user)
        log_system_event(user, f"Class Timetable Created: {timetable.course.code} ({timetable.day_of_week})", level='INFO')

    def perform_destroy(self, instance):
        log_system_event(self.request.user, f"Class Timetable Deleted: {instance.course.code} ({instance.day_of_week})", level='WARNING')
        instance.delete()

# 15. Exam Timetable ViewSet (Academic Registrar Management)
class ExamTimetableViewSet(viewsets.ModelViewSet):
    queryset = ExamTimetable.objects.all().order_by('exam_date', 'start_time')
    serializer_class = ExamTimetableSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), IsRegistrar | IsAdmin]

    def perform_create(self, serializer):
        user = self.request.user
        timetable = serializer.save(created_by=user)
        log_system_event(user, f"Exam Timetable Created: {timetable.title} on {timetable.exam_date}", level='INFO')

    def perform_destroy(self, instance):
        log_system_event(self.request.user, f"Exam Timetable Deleted: {instance.title}", level='WARNING')
        instance.delete()

# 16. System Audit Log ViewSet (System Admin Only)
class SystemLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SystemLog.objects.all().order_by('-timestamp')
    serializer_class = SystemLogSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get_queryset(self):
        qs = super().get_queryset()
        level = self.request.query_params.get('level')
        search = self.request.query_params.get('search')
        if level:
            qs = qs.filter(level=level.upper())
        if search:
            qs = qs.filter(action__icontains=search) | qs.filter(details__icontains=search) | qs.filter(user__username__icontains=search)
        return qs

