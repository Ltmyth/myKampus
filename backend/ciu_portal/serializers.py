from rest_framework import serializers
from .models import (
    User, Faculty, Invitation, Course, CourseUnit, Application, Exam, Question, ExamAttempt, 
    Test, TestQuestion, TestAttempt, ClassContent, AttendanceSession, AttendanceRecord,
    ClassTimetable, ExamTimetable, SystemLog, ProctoringSetting
)

class UserSerializer(serializers.ModelSerializer):
    faculty_name = serializers.CharField(source='faculty.name', read_only=True, allow_null=True)
    faculty_code = serializers.CharField(source='faculty.code', read_only=True, allow_null=True)
    registration_number = serializers.ReadOnlyField()

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'role', 'phone', 'tuition_paid_percentage', 'faculty', 'faculty_name', 'faculty_code', 'assigned_courses', 'reg_number', 'registration_number')
        read_only_fields = ('role', 'registration_number')

class AdminUserSerializer(serializers.ModelSerializer):
    faculty_name = serializers.CharField(source='faculty.name', read_only=True, allow_null=True)
    faculty_code = serializers.CharField(source='faculty.code', read_only=True, allow_null=True)
    registration_number = serializers.ReadOnlyField()
    assigned_course_codes = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'role', 'phone', 'tuition_paid_percentage', 'faculty', 'faculty_name', 'faculty_code', 'assigned_courses', 'assigned_course_codes', 'reg_number', 'registration_number')

    def get_assigned_course_codes(self, obj):
        return [c.code for c in obj.assigned_courses.all()]

class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    invitation_code = serializers.UUIDField(required=False, write_only=True)

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'first_name', 'last_name', 'role', 'phone', 'faculty', 'assigned_courses', 'invitation_code', 'reg_number')

    def validate(self, attrs):
        invitation_code = attrs.get('invitation_code')
        role = attrs.get('role', 'student')
        
        if invitation_code:
            try:
                invite = Invitation.objects.get(id=invitation_code, is_used=False)
                attrs['role'] = invite.role
                attrs['email'] = invite.email
            except Invitation.DoesNotExist:
                raise serializers.ValidationError({"invitation_code": "Invalid or already used invitation code."})
        else:
            request = self.context.get('request')
            is_admin = request and request.user and request.user.is_authenticated and request.user.role == 'admin'
            if not is_admin and role != 'student':
                raise serializers.ValidationError({"role": "Only administrators can register users with non-student roles directly."})
                
        return attrs

    def create(self, validated_data):
        invitation_code = validated_data.pop('invitation_code', None)
        password = validated_data.pop('password')
        
        user = User.objects.create(**validated_data)
        user.set_password(password)
        if user.role == 'student' and not user.reg_number:
            user.reg_number = user.registration_number
        user.save()

        if invitation_code:
            try:
                invite = Invitation.objects.get(id=invitation_code)
                invite.is_used = True
                invite.save()
            except Invitation.DoesNotExist:
                pass

        return user

class FacultySerializer(serializers.ModelSerializer):
    dean_name = serializers.CharField(source='dean.get_full_name', read_only=True)
    secretary_name = serializers.CharField(source='secretary.get_full_name', read_only=True)

    class Meta:
        model = Faculty
        fields = '__all__'

class CourseSerializer(serializers.ModelSerializer):
    faculty_name = serializers.CharField(source='faculty.name', read_only=True)
    faculty_code = serializers.CharField(source='faculty.code', read_only=True)

    class Meta:
        model = Course
        fields = '__all__'

class CourseUnitSerializer(serializers.ModelSerializer):
    course_code = serializers.CharField(source='course.code', read_only=True)
    course_name = serializers.CharField(source='course.name', read_only=True)
    lecturer_details = UserSerializer(source='lecturers', many=True, read_only=True)

    class Meta:
        model = CourseUnit
        fields = '__all__'

class InvitationSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = Invitation
        fields = ('id', 'email', 'role', 'created_by', 'created_by_username', 'is_used', 'created_at')
        read_only_fields = ('id', 'created_by', 'is_used', 'created_at')

class ApplicationSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.username', read_only=True)
    course_name = serializers.CharField(source='course.name', read_only=True)
    course_code = serializers.CharField(source='course.code', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.username', read_only=True)

    class Meta:
        model = Application
        fields = '__all__'
        read_only_fields = ('student', 'reviewed_by', 'status')

class ApplicationReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Application
        fields = ('status', 'reviewer_feedback')

    def update(self, instance, validated_data):
        instance.status = validated_data.get('status', instance.status)
        instance.reviewer_feedback = validated_data.get('reviewer_feedback', instance.reviewer_feedback)
        instance.reviewed_by = self.context['request'].user
        instance.save()
        return instance

class QuestionLecturerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = '__all__'

class QuestionStudentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = ('id', 'exam', 'question_text', 'option_a', 'option_b', 'option_c', 'option_d')

class ExamSerializer(serializers.ModelSerializer):
    course_name = serializers.CharField(source='course.name', read_only=True)
    course_code = serializers.CharField(source='course.code', read_only=True)
    faculty_id = serializers.IntegerField(source='course.faculty.id', read_only=True, allow_null=True)
    faculty_name = serializers.CharField(source='course.faculty.name', read_only=True, allow_null=True)
    faculty_code = serializers.CharField(source='course.faculty.code', read_only=True, allow_null=True)
    course_unit_name = serializers.CharField(source='course_unit.name', read_only=True, allow_null=True)
    lecturer_name = serializers.CharField(source='lecturer.get_full_name', read_only=True)
    questions_count = serializers.IntegerField(source='questions.count', read_only=True)

    class Meta:
        model = Exam
        fields = '__all__'
        read_only_fields = ('lecturer', 'is_approved_by_dean', 'is_results_released')

class ExamAttemptSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.get_full_name', read_only=True)
    exam_title = serializers.CharField(source='exam.title', read_only=True)
    exam_course_code = serializers.CharField(source='exam.course.code', read_only=True)
    duration_minutes = serializers.IntegerField(source='exam.duration_minutes', read_only=True)
    is_results_released = serializers.BooleanField(source='exam.is_results_released', read_only=True)

    class Meta:
        model = ExamAttempt
        fields = '__all__'
        read_only_fields = ('student', 'started_at', 'completed_at', 'score')

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        # Mask score for student users if results are NOT released by the Academic Registrar yet!
        if request and request.user and request.user.role == 'student':
            if not instance.exam.is_results_released:
                data['score'] = None
                data['answers'] = {}
                data['results_released'] = False
            else:
                data['results_released'] = True
        else:
            data['results_released'] = True
        return data

# New Test Serializers
class TestQuestionLecturerSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestQuestion
        fields = '__all__'

class TestQuestionStudentSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestQuestion
        fields = ('id', 'test', 'question_text', 'question_type', 'option_a', 'option_b', 'option_c', 'option_d', 'points')

class TestSerializer(serializers.ModelSerializer):
    course_name = serializers.CharField(source='course.name', read_only=True)
    course_code = serializers.CharField(source='course.code', read_only=True)
    faculty_id = serializers.IntegerField(source='course.faculty.id', read_only=True, allow_null=True)
    faculty_name = serializers.CharField(source='course.faculty.name', read_only=True, allow_null=True)
    faculty_code = serializers.CharField(source='course.faculty.code', read_only=True, allow_null=True)
    course_unit_name = serializers.CharField(source='course_unit.name', read_only=True, allow_null=True)
    lecturer_name = serializers.CharField(source='lecturer.get_full_name', read_only=True)
    questions_count = serializers.IntegerField(source='questions.count', read_only=True)
    attempts_count = serializers.IntegerField(source='attempts.count', read_only=True)

    class Meta:
        model = Test
        fields = '__all__'
        read_only_fields = ('lecturer',)

class TestAttemptSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.get_full_name', read_only=True)
    test_title = serializers.CharField(source='test.title', read_only=True)
    test_course_code = serializers.CharField(source='test.course.code', read_only=True)
    test_category = serializers.CharField(source='test.category', read_only=True)
    duration_minutes = serializers.IntegerField(source='test.duration_minutes', read_only=True)
    pass_percentage = serializers.FloatField(source='test.pass_percentage', read_only=True)
    is_results_released = serializers.BooleanField(source='test.is_results_released', read_only=True)

    class Meta:
        model = TestAttempt
        fields = '__all__'
        read_only_fields = ('student', 'started_at', 'completed_at', 'score', 'passed')

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        if request and request.user and request.user.role == 'student':
            if not instance.test.is_results_released:
                data['score'] = None
                data['answers'] = {}
                data['feedback'] = None
                data['passed'] = None
                data['results_released'] = False
            else:
                data['results_released'] = True
        else:
            data['results_released'] = True
        return data

class ClassContentSerializer(serializers.ModelSerializer):
    course_code = serializers.CharField(source='course.code', read_only=True)
    course_name = serializers.CharField(source='course.name', read_only=True)
    lecturer_name = serializers.CharField(source='lecturer.username', read_only=True)

    class Meta:
        model = ClassContent
        fields = '__all__'
        read_only_fields = ('lecturer',)

class AttendanceSessionSerializer(serializers.ModelSerializer):
    course_code = serializers.CharField(source='course.code', read_only=True)
    lecturer_name = serializers.CharField(source='lecturer.username', read_only=True)
    records_count = serializers.IntegerField(source='records.count', read_only=True)

    class Meta:
        model = AttendanceSession
        fields = '__all__'
        read_only_fields = ('lecturer', 'code')

class AttendanceRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.get_full_name', read_only=True)
    course_code = serializers.CharField(source='session.course.code', read_only=True)

    class Meta:
        model = AttendanceRecord
        fields = '__all__'
        read_only_fields = ('student',)

class ClassTimetableSerializer(serializers.ModelSerializer):
    faculty_code = serializers.CharField(source='faculty.code', read_only=True)
    faculty_name = serializers.CharField(source='faculty.name', read_only=True)
    course_code = serializers.CharField(source='course.code', read_only=True)
    course_name = serializers.CharField(source='course.name', read_only=True)
    course_unit_code = serializers.CharField(source='course_unit.code', read_only=True, allow_null=True)
    course_unit_name = serializers.CharField(source='course_unit.name', read_only=True, allow_null=True)
    lecturer_name = serializers.CharField(source='lecturer.get_full_name', read_only=True)

    class Meta:
        model = ClassTimetable
        fields = '__all__'
        read_only_fields = ('created_by', 'created_at')

class ExamTimetableSerializer(serializers.ModelSerializer):
    faculty_code = serializers.CharField(source='faculty.code', read_only=True)
    faculty_name = serializers.CharField(source='faculty.name', read_only=True)
    course_code = serializers.CharField(source='course.code', read_only=True)
    course_name = serializers.CharField(source='course.name', read_only=True)
    course_unit_code = serializers.CharField(source='course_unit.code', read_only=True, allow_null=True)
    invigilator_name = serializers.CharField(source='invigilator.get_full_name', read_only=True, allow_null=True)

    class Meta:
        model = ExamTimetable
        fields = '__all__'
        read_only_fields = ('created_by', 'created_at')

class SystemLogSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True, allow_null=True)
    user_role = serializers.CharField(source='user.role', read_only=True, allow_null=True)

    class Meta:
        model = SystemLog
        fields = '__all__'

class ProctoringSettingSerializer(serializers.ModelSerializer):
    updated_by_name = serializers.CharField(source='updated_by.username', read_only=True, allow_null=True)

    class Meta:
        model = ProctoringSetting
        fields = '__all__'
