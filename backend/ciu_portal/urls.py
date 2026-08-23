from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    MyTokenObtainPairView, RegisterView, ProfileView,
    AdminUserViewSet, InvitationViewSet, FacultyViewSet, CourseViewSet, CourseUnitViewSet, 
    ApplicationViewSet, ExamViewSet, ExamAttemptViewSet, TestViewSet, TestAttemptViewSet,
    ClassContentViewSet, AttendanceSessionViewSet, ReportsViewSet,
    ClassTimetableViewSet, ExamTimetableViewSet, SystemLogViewSet
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

urlpatterns = [
    path('auth/login/', MyTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/register/', RegisterView.as_view(), name='auth_register'),
    path('auth/profile/', ProfileView.as_view(), name='auth_profile'),
    path('', include(router.urls)),
]
