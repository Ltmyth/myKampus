import random
from django.utils import timezone
from rest_framework import viewsets, status, permissions, generics
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import (
    User, Invitation, Course, Application, Exam, Question, 
    ExamAttempt, ClassContent, AttendanceSession, AttendanceRecord
)
from .serializers import (
    UserSerializer, UserCreateSerializer, AdminUserSerializer, InvitationSerializer, 
    CourseSerializer, ApplicationSerializer, ApplicationReviewSerializer,
    ExamSerializer, QuestionLecturerSerializer, QuestionStudentSerializer,
    ExamAttemptSerializer, ClassContentSerializer, AttendanceSessionSerializer,
    AttendanceRecordSerializer
)
from .permissions import IsAdmin, IsDVC, IsDean, IsLecturer, IsStudent, IsStaffUser

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
        # Allow Admin to directly create users
        serializer = UserCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)

# 4. Invitation ViewSet
class InvitationViewSet(viewsets.ModelViewSet):
    queryset = Invitation.objects.all().order_by('-created_at')
    serializer_class = InvitationSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

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

# 5. Course ViewSet
class CourseViewSet(viewsets.ModelViewSet):
    queryset = Course.objects.all().order_by('code')
    serializer_class = CourseSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), IsAdmin | IsDVC | IsDean]

# 6. Applications ViewSet
class ApplicationViewSet(viewsets.ModelViewSet):
    serializer_class = ApplicationSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role in ['admin', 'dvc', 'dean']:
            return Application.objects.all().order_by('-applied_at')
        return Application.objects.filter(student=user).order_by('-applied_at')

    def perform_create(self, serializer):
        serializer.save(student=self.request.user, status='pending')

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsDean | IsDVC])
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
            # Students only see active exams
            return Exam.objects.filter(is_active=True).order_by('-created_at')
        elif user.role == 'lecturer':
            # Lecturers see their own exams
            return Exam.objects.filter(lecturer=user).order_by('-created_at')
        # Admins, Deans, DVCs see all exams
        return Exam.objects.all().order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(lecturer=self.request.user)

    # Manage Questions for an Exam
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
            if user.role != 'lecturer' and user.role != 'admin':
                return Response({'detail': 'Only lecturers can add questions.'}, status=status.HTTP_403_FORBIDDEN)
            
            # Make sure exam belongs to this lecturer or admin
            if user.role == 'lecturer' and exam.lecturer != user:
                return Response({'detail': 'You cannot manage questions for this exam.'}, status=status.HTTP_403_FORBIDDEN)

            data = request.data.copy()
            data['exam'] = exam.id
            serializer = QuestionLecturerSerializer(data=data)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)

    # Manage Attempts
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsStudent])
    def start_attempt(self, request, pk=None):
        exam = self.get_object()
        if not exam.is_active:
            return Response({'detail': 'This exam is not active.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if attempt already exists
        existing = ExamAttempt.objects.filter(student=request.user, exam=exam)
        if existing.exists():
            attempt = existing.first()
            if attempt.completed_at:
                return Response({'detail': 'You have already completed this exam.'}, status=status.HTTP_400_BAD_REQUEST)
            return Response(ExamAttemptSerializer(attempt).data)

        # Create new attempt
        attempt = ExamAttempt.objects.create(student=request.user, exam=exam)
        return Response(ExamAttemptSerializer(attempt).data, status=status.HTTP_201_CREATED)

# 8. Exam Attempt Details & Submit (Separate endpoint or viewset for flexibility)
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
        attempt.answers = answers
        
        # Autograding logic
        questions = attempt.exam.questions.all()
        total_questions = questions.count()
        
        if total_questions == 0:
            score = 0.0
        else:
            correct_count = 0
            for q in questions:
                # Compare student's answer (string keys since JSON dict has string keys)
                student_ans = answers.get(str(q.id))
                if student_ans and student_ans.upper() == q.correct_option.upper():
                    correct_count += 1
            
            score = (correct_count / total_questions) * 100.0

        attempt.score = round(score, 2)
        attempt.completed_at = timezone.now()
        attempt.save()

        return Response(ExamAttemptSerializer(attempt).data)

    @action(detail=True, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def results(self, request, pk=None):
        attempt = self.get_object()
        if attempt.student != request.user and request.user.role not in ['lecturer', 'dean', 'dvc', 'admin']:
            return Response({'detail': 'Unauthorized.'}, status=status.HTTP_403_FORBIDDEN)
        if not attempt.completed_at:
            return Response({'detail': 'This attempt has not been completed yet.'}, status=status.HTTP_400_BAD_REQUEST)
        
        attempt_data = ExamAttemptSerializer(attempt).data
        questions = attempt.exam.questions.all()
        questions_data = QuestionLecturerSerializer(questions, many=True).data
        
        return Response({
            'attempt': attempt_data,
            'questions': questions_data
        })


# 9. Class Content ViewSet
class ClassContentViewSet(viewsets.ModelViewSet):
    serializer_class = ClassContentSerializer

    def get_queryset(self):
        return ClassContent.objects.all().order_by('-created_at')

    def perform_create(self, serializer):
        if self.request.user.role not in ['lecturer', 'admin']:
            return Response({'detail': 'Only lecturers or admins can create content.'}, status=status.HTTP_403_FORBIDDEN)
        serializer.save(lecturer=self.request.user)

# 10. Attendance Session ViewSet
class AttendanceSessionViewSet(viewsets.ModelViewSet):
    serializer_class = AttendanceSessionSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == 'lecturer':
            return AttendanceSession.objects.filter(lecturer=user).order_by('-created_at')
        return AttendanceSession.objects.all().order_by('-created_at')

    def perform_create(self, serializer):
        if self.request.user.role not in ['lecturer', 'admin']:
            return Response({'detail': 'Only lecturers or admins can open attendance.'}, status=status.HTTP_403_FORBIDDEN)
        
        # Generate random 4-digit code
        code = str(random.randint(1000, 9999))
        serializer.save(lecturer=self.request.user, code=code, is_active=True)

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

        # Record attendance
        record, created = AttendanceRecord.objects.get_or_create(
            session=session,
            student=request.user
        )

        if not created:
            return Response({'detail': 'You have already checked in for this class.'}, status=status.HTTP_400_BAD_REQUEST)

        return Response(AttendanceRecordSerializer(record).data, status=status.HTTP_201_CREATED)


class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user
