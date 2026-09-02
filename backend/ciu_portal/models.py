from django.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings
import uuid

class User(AbstractUser):
    ROLE_CHOICES = (
        ('student', 'Student'),
        ('lecturer', 'Lecturer'),
        ('dean', 'Faculty Dean'),
        ('faculty_admin', 'Faculty Secretary (Admin)'),
        ('registrar', 'Academic Registrar'),
        ('dvc', 'Chancellor (DVC)'),
        ('vc', 'Vice-Chancellor (VC)'),
        ('admin', 'System Admin'),
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='student')
    phone = models.CharField(max_length=20, blank=True, null=True)
    tuition_paid_percentage = models.FloatField(default=100.0, help_text="Tuition clearance percentage (0.0 to 100.0)")
    faculty = models.ForeignKey('Faculty', on_delete=models.SET_NULL, null=True, blank=True, related_name='students')
    assigned_courses = models.ManyToManyField('Course', blank=True, related_name='assigned_students')
    reg_number = models.CharField(max_length=50, blank=True, null=True, help_text="Official Registration Number (e.g. 2026SOBAT-A001)")

    @property
    def registration_number(self):
        if self.reg_number:
            return self.reg_number
        if self.role == 'student':
            f_code = (self.faculty.code if self.faculty else 'SOBAT').upper().replace(' ', '')
            return f"2026{f_code}-A{self.id:03d}"
        return None

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"

class Faculty(models.Model):
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=20, unique=True)
    description = models.TextField(blank=True)
    dean = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, limit_choices_to={'role': 'dean'}, related_name='managed_faculties')
    secretary = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, limit_choices_to={'role': 'faculty_admin'}, related_name='administered_faculties')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.code} - {self.name}"

class Invitation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField()
    role = models.CharField(max_length=20, choices=User.ROLE_CHOICES)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_invitations')
    is_used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Invite {self.email} as {self.role} (Used: {self.is_used})"

class Course(models.Model):
    faculty = models.ForeignKey(Faculty, on_delete=models.SET_NULL, null=True, blank=True, related_name='courses')
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=20, unique=True)
    description = models.TextField(blank=True)
    department = models.CharField(max_length=100, blank=True)

    def __str__(self):
        return f"{self.code} - {self.name}"

class CourseUnit(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='units')
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=20)
    credit_units = models.IntegerField(default=3)
    lecturers = models.ManyToManyField(User, limit_choices_to={'role': 'lecturer'}, related_name='assigned_course_units', blank=True)

    def __str__(self):
        return f"{self.code} - {self.name} ({self.course.code})"

class Application(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending Review'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    )
    student = models.ForeignKey(User, on_delete=models.CASCADE, limit_choices_to={'role': 'student'}, related_name='course_applications')
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='applications')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    transcript_details = models.TextField(help_text="Academic details, GPA, previous school, etc.")
    applied_at = models.DateTimeField(auto_now_add=True)
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, limit_choices_to={'role__in': ['dean', 'dvc', 'vc']}, related_name='reviewed_applications')
    reviewer_feedback = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.student.username} application for {self.course.code}"

class Exam(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='exams')
    course_unit = models.ForeignKey(CourseUnit, on_delete=models.CASCADE, null=True, blank=True, related_name='exams')
    lecturer = models.ForeignKey(User, on_delete=models.CASCADE, limit_choices_to={'role': 'lecturer'}, related_name='created_exams')
    title = models.CharField(max_length=150)
    duration_minutes = models.IntegerField(default=60)
    scheduled_start = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=False)
    is_approved_by_dean = models.BooleanField(default=False)
    is_results_released = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} ({self.course.code})"

class Question(models.Model):
    OPTION_CHOICES = (
        ('A', 'Option A'),
        ('B', 'Option B'),
        ('C', 'Option C'),
        ('D', 'Option D'),
    )
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name='questions')
    question_text = models.TextField()
    option_a = models.CharField(max_length=255)
    option_b = models.CharField(max_length=255)
    option_c = models.CharField(max_length=255)
    option_d = models.CharField(max_length=255)
    correct_option = models.CharField(max_length=1, choices=OPTION_CHOICES)

    def __str__(self):
        return f"Q: {self.question_text[:50]} (Exam: {self.exam.title})"

class ExamAttempt(models.Model):
    student = models.ForeignKey(User, on_delete=models.CASCADE, limit_choices_to={'role': 'student'}, related_name='exam_attempts')
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name='attempts')
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    answers = models.JSONField(default=dict, blank=True, help_text="Format: {'question_id': 'A/B/C/D'}")
    score = models.FloatField(default=0.0, help_text="Percentage score from 0 to 100")
    tab_switches_count = models.IntegerField(default=0)
    auto_submitted_reason = models.CharField(max_length=255, null=True, blank=True)

    def __str__(self):
        return f"{self.student.username} - {self.exam.title} (Score: {self.score}%)"

class Test(models.Model):
    CATEGORY_CHOICES = (
        ('quiz', 'Quiz'),
        ('practice', 'Practice Test'),
        ('unit_test', 'Unit Test'),
        ('midterm', 'Midterm Test'),
        ('assignment', 'Assignment Test'),
    )
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='tests')
    course_unit = models.ForeignKey(CourseUnit, on_delete=models.CASCADE, null=True, blank=True, related_name='tests')
    lecturer = models.ForeignKey(User, on_delete=models.CASCADE, limit_choices_to={'role': 'lecturer'}, related_name='created_tests')
    title = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='quiz')
    duration_minutes = models.IntegerField(default=30)
    scheduled_start = models.DateTimeField(null=True, blank=True)
    total_marks = models.IntegerField(default=100)
    pass_percentage = models.FloatField(default=50.0)
    allowed_attempts = models.IntegerField(default=1, help_text="Set to 0 or -1 for unlimited attempts")
    is_published = models.BooleanField(default=False)
    is_results_released = models.BooleanField(default=True, help_text="Whether test results & scorecards are released to students")
    due_date = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"[{self.get_category_display()}] {self.title} ({self.course.code})"

class TestQuestion(models.Model):
    TYPE_CHOICES = (
        ('mcq', 'Multiple Choice'),
        ('tf', 'True / False'),
        ('short', 'Short Answer'),
    )
    test = models.ForeignKey(Test, on_delete=models.CASCADE, related_name='questions')
    question_text = models.TextField()
    question_type = models.CharField(max_length=10, choices=TYPE_CHOICES, default='mcq')
    option_a = models.CharField(max_length=255, blank=True, null=True)
    option_b = models.CharField(max_length=255, blank=True, null=True)
    option_c = models.CharField(max_length=255, blank=True, null=True)
    option_d = models.CharField(max_length=255, blank=True, null=True)
    correct_answer = models.CharField(max_length=255, help_text="Option letter (A/B/C/D), True/False, or exact text")
    points = models.FloatField(default=1.0)
    explanation = models.TextField(blank=True, null=True, help_text="Explanation shown after attempt submission")

    def __str__(self):
        return f"Q: {self.question_text[:50]} (Test: {self.test.title})"

class TestAttempt(models.Model):
    student = models.ForeignKey(User, on_delete=models.CASCADE, limit_choices_to={'role': 'student'}, related_name='test_attempts')
    test = models.ForeignKey(Test, on_delete=models.CASCADE, related_name='attempts')
    attempt_number = models.IntegerField(default=1)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    answers = models.JSONField(default=dict, blank=True)
    score = models.FloatField(default=0.0)
    passed = models.BooleanField(default=False)
    tab_switches_count = models.IntegerField(default=0)
    auto_submitted_reason = models.CharField(max_length=255, null=True, blank=True)
    feedback = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.student.username} - Attempt #{self.attempt_number} for {self.test.title} (Score: {self.score}%)"

class ClassContent(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='contents')
    lecturer = models.ForeignKey(User, on_delete=models.CASCADE, limit_choices_to={'role': 'lecturer'}, related_name='uploaded_contents')
    title = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    attachment_url = models.URLField(blank=True, null=True, help_text="URL to file or resource")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} for {self.course.code}"

class AttendanceSession(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='attendance_sessions')
    lecturer = models.ForeignKey(User, on_delete=models.CASCADE, limit_choices_to={'role': 'lecturer'}, related_name='attendance_sessions')
    code = models.CharField(max_length=6, help_text="Verification code (e.g. 4 digits)")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Attendance session for {self.course.code} at {self.created_at}"

class AttendanceRecord(models.Model):
    session = models.ForeignKey(AttendanceSession, on_delete=models.CASCADE, related_name='records')
    student = models.ForeignKey(User, on_delete=models.CASCADE, limit_choices_to={'role': 'student'}, related_name='attendance_records')
    marked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('session', 'student')

    def __str__(self):
        return f"{self.student.username} attended {self.session.course.code} on {self.marked_at}"

class ClassTimetable(models.Model):
    DAY_CHOICES = (
        ('Monday', 'Monday'),
        ('Tuesday', 'Tuesday'),
        ('Wednesday', 'Wednesday'),
        ('Thursday', 'Thursday'),
        ('Friday', 'Friday'),
        ('Saturday', 'Saturday'),
    )
    CLASS_TYPE_CHOICES = (
        ('lecture', 'Lecture'),
        ('tutorial', 'Tutorial'),
        ('lab', 'Practical Lab'),
        ('workshop', 'Workshop'),
    )
    faculty = models.ForeignKey(Faculty, on_delete=models.CASCADE, related_name='class_timetables')
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='class_timetables')
    course_unit = models.ForeignKey(CourseUnit, on_delete=models.CASCADE, null=True, blank=True, related_name='class_timetables')
    lecturer = models.ForeignKey(User, on_delete=models.CASCADE, limit_choices_to={'role': 'lecturer'}, related_name='class_timetables')
    class_date = models.DateField(null=True, blank=True, help_text="Specific calendar date for the class slot")
    day_of_week = models.CharField(max_length=15, choices=DAY_CHOICES)
    start_time = models.TimeField()
    end_time = models.TimeField()
    room = models.CharField(max_length=100)
    class_type = models.CharField(max_length=20, choices=CLASS_TYPE_CHOICES, default='lecture')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_class_timetables')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        date_str = f" on {self.class_date}" if self.class_date else ""
        return f"{self.course.code} ({self.day_of_week}{date_str} {self.start_time}-{self.end_time} in {self.room})"

class ExamTimetable(models.Model):
    faculty = models.ForeignKey(Faculty, on_delete=models.CASCADE, related_name='exam_timetables')
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='exam_timetables')
    course_unit = models.ForeignKey(CourseUnit, on_delete=models.CASCADE, null=True, blank=True, related_name='exam_timetables')
    exam = models.ForeignKey(Exam, on_delete=models.SET_NULL, null=True, blank=True, related_name='timetables')
    title = models.CharField(max_length=150)
    exam_date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    venue = models.CharField(max_length=100)
    invigilator = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, limit_choices_to={'role': 'lecturer'}, related_name='invigilated_exams')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_exam_timetables')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} on {self.exam_date} ({self.start_time}-{self.end_time} at {self.venue})"

class SystemLog(models.Model):
    LEVEL_CHOICES = (
        ('INFO', 'Information'),
        ('WARNING', 'Warning'),
        ('ERROR', 'Error'),
        ('AUDIT', 'Security Audit'),
    )
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='system_logs')
    action = models.CharField(max_length=150)
    level = models.CharField(max_length=10, choices=LEVEL_CHOICES, default='INFO')
    details = models.TextField(blank=True, null=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"[{self.timestamp.strftime('%Y-%m-%d %H:%M:%S')}] [{self.level}] {self.action} by {self.user.username if self.user else 'System'}"

class ProctoringSetting(models.Model):
    is_proctoring_enabled = models.BooleanField(default=True, help_text="Global live assessment proctoring toggle controlled by System Admin")
    require_webcam = models.BooleanField(default=True, help_text="Requires webcam / camera stream monitoring during assessment")
    strict_tab_switch_limit = models.IntegerField(default=3, help_text="Max tab switches allowed before auto-submit")
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Proctoring Active: {self.is_proctoring_enabled}"

def log_system_event(user, action, level='INFO', details='', ip_address=None):
    try:
        SystemLog.objects.create(
            user=user if user and user.is_authenticated else None,
            action=action,
            level=level,
            details=str(details),
            ip_address=ip_address
        )
    except Exception:
        pass
