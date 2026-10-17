from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    MyTokenObtainPairView, RegisterView, ProfileView, ChangePasswordView, VerifyPasswordView,
    ServerTimeView, AdminUserViewSet, InvitationViewSet, FacultyViewSet, CourseViewSet, CourseUnitViewSet, 
    ApplicationViewSet, ExamViewSet, ExamAttemptViewSet, TestViewSet, TestAttemptViewSet,
    ClassContentViewSet, AttendanceSessionViewSet, ReportsViewSet,
    ClassTimetableViewSet, ExamTimetableViewSet, SystemLogViewSet, ProctoringSettingViewSet,
    TemporaryClearanceViewSet, QuestionBankViewSet, QuestionBankItemViewSet, ProctoringMonitorViewSet,
    TestQuestionViewSet, QuestionViewSet, DashboardOverviewView
)

router = DefaultRouter()
router.register('admin/users', AdminUserViewSet, basename='admin-users')
router.register('invitations', InvitationViewSet, basename='invitations')
router.register('faculties', FacultyViewSet, basename='faculties')
router.register('courses', CourseViewSet, basename='courses')
router.register('course-units', CourseUnitViewSet, basename='course-units')
router.register('applications', ApplicationViewSet, basename='applications')
router.register('exams', ExamViewSet, basename='exams')
router.register('attempts', ExamAttemptViewSet, basename='attempts')
router.register('tests', TestViewSet, basename='tests')
router.register('test-attempts', TestAttemptViewSet, basename='test-attempts')
router.register('contents', ClassContentViewSet, basename='contents')
router.register('attendance/sessions', AttendanceSessionViewSet, basename='attendance-sessions')
router.register('reports', ReportsViewSet, basename='reports')
router.register('class-timetables', ClassTimetableViewSet, basename='class-timetables')
router.register('exam-timetables', ExamTimetableViewSet, basename='exam-timetables')
router.register('system-logs', SystemLogViewSet, basename='system-logs')
router.register('proctoring-settings', ProctoringSettingViewSet, basename='proctoring-settings')
router.register('temporary-clearances', TemporaryClearanceViewSet, basename='temporary-clearances')
router.register('question-banks', QuestionBankViewSet, basename='question-banks')
router.register('question-bank-items', QuestionBankItemViewSet, basename='question-bank-items')
router.register('proctoring-monitor', ProctoringMonitorViewSet, basename='proctoring-monitor')
router.register('test-questions', TestQuestionViewSet, basename='test-questions')
router.register('exam-questions', QuestionViewSet, basename='exam-questions')

urlpatterns = [
    path('auth/login/', MyTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/register/', RegisterView.as_view(), name='auth_register'),
    path('auth/profile/', ProfileView.as_view(), name='auth_profile'),
    path('auth/change_password/', ChangePasswordView.as_view(), name='auth_change_password'),
    path('auth/verify_password/', VerifyPasswordView.as_view(), name='auth_verify_password'),
    path('server-time/', ServerTimeView.as_view(), name='server_time'),
    path('dashboard/overview/', DashboardOverviewView.as_view(), name='dashboard_overview'),
    path('auth/change-password/', ChangePasswordView.as_view()),
    path('change-password/', ChangePasswordView.as_view()),
    path('change_password/', ChangePasswordView.as_view()),
    path('', include(router.urls)),
]

