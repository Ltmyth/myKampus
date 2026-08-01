from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import (
    User, Invitation, Course, Application, Exam, 
    Question, ExamAttempt, ClassContent, AttendanceSession, AttendanceRecord
)

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ('Custom Fields', {'fields': ('role', 'phone')}),
    )
    list_display = ('username', 'email', 'first_name', 'last_name', 'role', 'is_staff')
    list_filter = ('role', 'is_staff', 'is_superuser')

@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = ('email', 'role', 'created_by', 'is_used', 'created_at')
    list_filter = ('role', 'is_used')
    search_fields = ('email',)

@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'department')
    search_fields = ('code', 'name', 'department')

@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = ('student', 'course', 'status', 'applied_at', 'reviewed_by')
    list_filter = ('status',)
    search_fields = ('student__username', 'course__code')

@admin.register(Exam)
class ExamAdmin(admin.ModelAdmin):
    list_display = ('title', 'course', 'lecturer', 'duration_minutes', 'is_active', 'created_at')
    list_filter = ('is_active', 'course')

@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ('question_text', 'exam', 'correct_option')
    list_filter = ('exam',)

@admin.register(ExamAttempt)
class ExamAttemptAdmin(admin.ModelAdmin):
    list_display = ('student', 'exam', 'score', 'started_at', 'completed_at')
    list_filter = ('exam', 'score')

@admin.register(ClassContent)
class ClassContentAdmin(admin.ModelAdmin):
    list_display = ('title', 'course', 'lecturer', 'created_at')
    list_filter = ('course',)

@admin.register(AttendanceSession)
class AttendanceSessionAdmin(admin.ModelAdmin):
    list_display = ('course', 'lecturer', 'code', 'is_active', 'created_at')
    list_filter = ('is_active', 'course')

@admin.register(AttendanceRecord)
class AttendanceRecordAdmin(admin.ModelAdmin):
    list_display = ('student', 'session', 'marked_at')
    list_filter = ('session__course',)

