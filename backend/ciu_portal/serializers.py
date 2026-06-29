from rest_framework import serializers
from .models import User, Invitation, Course, Application, Exam, Question, ExamAttempt, ClassContent, AttendanceSession, AttendanceRecord

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'role', 'phone')
        read_only_fields = ('role',)

class AdminUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'role', 'phone')

class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    invitation_code = serializers.UUIDField(required=False, write_only=True)

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'first_name', 'last_name', 'role', 'phone', 'invitation_code')

    def validate(self, attrs):
        invitation_code = attrs.get('invitation_code')
        role = attrs.get('role', 'student')
        
        # If invitation code is provided, validate it
        if invitation_code:
            try:
                invite = Invitation.objects.get(id=invitation_code, is_used=False)
                # Override role to the one defined in invitation
                attrs['role'] = invite.role
                attrs['email'] = invite.email
            except Invitation.DoesNotExist:
                raise serializers.ValidationError({"invitation_code": "Invalid or already used invitation code."})
        else:
            # If no invitation code, only allow 'student' role by default unless created by an admin.
            # We will handle Admin creating arbitrary users in the view by bypassing this or passing context.
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
        user.save()

        # Mark invitation as used
        if invitation_code:
            invite = Invitation.objects.get(id=invitation_code)
            invite.is_used = True
            invite.save()

        return user

class InvitationSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = Invitation
        fields = ('id', 'email', 'role', 'created_by', 'created_by_username', 'is_used', 'created_at')
        read_only_fields = ('id', 'created_by', 'is_used', 'created_at')

class CourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = '__all__'

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

# Separate questions serializers for lecturers vs students
class QuestionLecturerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = '__all__'

class QuestionStudentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        # Exclude correct_option to prevent students from finding it in API responses
        fields = ('id', 'exam', 'question_text', 'option_a', 'option_b', 'option_c', 'option_d')

class ExamSerializer(serializers.ModelSerializer):
    course_name = serializers.CharField(source='course.name', read_only=True)
    course_code = serializers.CharField(source='course.code', read_only=True)
    lecturer_name = serializers.CharField(source='lecturer.username', read_only=True)
    questions_count = serializers.IntegerField(source='questions.count', read_only=True)

    class Meta:
        model = Exam
        fields = '__all__'
        read_only_fields = ('lecturer',)

class ExamAttemptSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.username', read_only=True)
    exam_title = serializers.CharField(source='exam.title', read_only=True)
    exam_course_code = serializers.CharField(source='exam.course.code', read_only=True)
    duration_minutes = serializers.IntegerField(source='exam.duration_minutes', read_only=True)

    class Meta:
        model = ExamAttempt
        fields = '__all__'
        read_only_fields = ('student', 'started_at', 'completed_at', 'score')

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
    student_name = serializers.CharField(source='student.username', read_only=True)
    course_code = serializers.CharField(source='session.course.code', read_only=True)

    class Meta:
        model = AttendanceRecord
        fields = '__all__'
        read_only_fields = ('student',)
