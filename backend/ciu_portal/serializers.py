from django.utils import timezone
from rest_framework import serializers
from .models import (
    User, Faculty, Invitation, Course, CourseUnit, Application, Exam, Question, ExamAttempt, 
    Test, TestQuestion, TestAttempt, ClassContent, AttendanceSession, AttendanceRecord,
    ClassTimetable, ExamTimetable, SystemLog, ProctoringSetting,
    TemporaryClearance, QuestionBank, QuestionBankItem, ProctorSnapshot
)


def resolve_user_faculty(user):
    if not user:
        return None
    if getattr(user, 'faculty_id', None):
        return user.faculty
    if getattr(user, 'role', '') == 'student':
        course = user.assigned_courses.select_related('faculty').filter(faculty__isnull=False).first()
        if course and course.faculty:
            return course.faculty
        app = user.course_applications.filter(status='approved').select_related('course__faculty').first()
        if app and app.course and app.course.faculty:
            return app.course.faculty
    elif getattr(user, 'role', '') == 'lecturer':
        if hasattr(user, 'assigned_faculties') and user.assigned_faculties.exists():
            return user.assigned_faculties.first()
        unit = user.assigned_course_units.select_related('course__faculty').filter(course__faculty__isnull=False).first()
        if unit and unit.course and unit.course.faculty:
            return unit.course.faculty
        course = user.assigned_courses.select_related('faculty').filter(faculty__isnull=False).first()
        if course and course.faculty:
            return course.faculty
    return None


class UserListSerializer(serializers.ListSerializer):
    def to_representation(self, data):
        iterable = data.all() if hasattr(data, 'all') else data
        items = list(iterable) if iterable is not None else []
        try:
            from .clearance import batch_preload_clearance
            batch_preload_clearance(items)
        except Exception:
            pass
        return super().to_representation(items)


class UserSerializer(serializers.ModelSerializer):
    faculty_name = serializers.SerializerMethodField()
    faculty_code = serializers.SerializerMethodField()
    registration_number = serializers.ReadOnlyField()
    assigned_course_codes = serializers.SerializerMethodField()
    assigned_faculty_details = serializers.SerializerMethodField()
    assigned_course_unit_details = serializers.SerializerMethodField()
    gender_display = serializers.CharField(source='get_gender_display', read_only=True)
    is_test_cleared = serializers.SerializerMethodField()
    is_exam_cleared = serializers.SerializerMethodField()
    clearance_source = serializers.SerializerMethodField()
    clearance_mode = serializers.SerializerMethodField()
    is_temp_cleared = serializers.SerializerMethodField()
    temp_clearance_info = serializers.SerializerMethodField()
    effective_tuition_percentage = serializers.SerializerMethodField()
    clearance_level = serializers.SerializerMethodField()

    class Meta:
        model = User
        list_serializer_class = UserListSerializer
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'role', 'phone', 'gender', 'gender_display', 'tuition_paid_percentage', 'effective_tuition_percentage', 'faculty', 'faculty_name', 'faculty_code', 'assigned_faculties', 'assigned_faculty_details', 'assigned_courses', 'assigned_course_codes', 'assigned_course_unit_details', 'reg_number', 'registration_number', 'year_of_study', 'semester', 'academic_year', 'entry_year', 'intake', 'must_change_password', 'is_active', 'is_test_cleared', 'is_exam_cleared', 'is_temp_cleared', 'clearance_source', 'clearance_mode', 'temp_clearance_info', 'clearance_level')
        read_only_fields = ('role', 'registration_number', 'is_active')

    def get_faculty_name(self, obj):
        fac = resolve_user_faculty(obj)
        return fac.name if fac else None

    def get_faculty_code(self, obj):
        fac = resolve_user_faculty(obj)
        return fac.code if fac else None

    def get_assigned_faculty_details(self, obj):
        facs = list(obj.assigned_faculties.all())
        if not facs and obj.faculty:
            facs = [obj.faculty]
        return [{'id': f.id, 'code': f.code, 'name': f.name} for f in facs]

    def get_assigned_course_unit_details(self, obj):
        if obj.role != 'lecturer':
            return []
        units = list(obj.assigned_course_units.select_related('course', 'course__faculty').all())
        return [{
            'id': u.id,
            'code': u.code,
            'name': u.name,
            'course_code': u.course.code if u.course else '',
            'course_name': u.course.name if u.course else '',
            'faculty_code': u.course.faculty.code if (u.course and u.course.faculty) else ''
        } for u in units]

    def validate_gender(self, value):
        if not value:
            return 'other'
        val = str(value).strip().lower()
        if val in ['m', 'male', 'man', 'boy']:
            return 'male'
        elif val in ['f', 'female', 'woman', 'girl']:
            return 'female'
        return 'other'

    def get_assigned_course_codes(self, obj):
        codes = set(c.code for c in obj.assigned_courses.all())
        if obj.role == 'lecturer':
            for unit in obj.assigned_course_units.select_related('course').all():
                if unit.course:
                    codes.add(unit.course.code)
        return sorted(list(codes))

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not data.get('faculty'):
            fac = resolve_user_faculty(instance)
            if fac:
                data['faculty'] = fac.id
        if instance.role == 'lecturer':
            unit_course_ids = list(instance.assigned_course_units.filter(course__isnull=False).values_list('course_id', flat=True).distinct())
            existing = set(data.get('assigned_courses') or [])
            data['assigned_courses'] = sorted(list(existing.union(unit_course_ids)))
            data['assigned_course_units'] = list(instance.assigned_course_units.values_list('id', flat=True))
        return data

    def _get_clearance(self, obj):
        if not hasattr(obj, '_cached_clearance'):
            if obj.role != 'student':
                obj._cached_clearance = {
                    'is_exam_cleared': True,
                    'is_test_cleared': True,
                    'tuition_paid_percentage': 100.0,
                    'clearance_mode': 'staff',
                    'is_temp_cleared': False,
                    'temp_info': None,
                    'source': 'Staff / Faculty Role'
                }
            else:
                from .clearance import check_student_clearance
                acad = getattr(obj, 'academic_year', '2026/2027') or '2026/2027'
                sem = str(getattr(obj, 'semester', 1) or 1)
                obj._cached_clearance = check_student_clearance(obj, acad=acad, sem=sem)
        return obj._cached_clearance

    def get_is_test_cleared(self, obj):
        return self._get_clearance(obj).get('is_test_cleared', True)

    def get_is_exam_cleared(self, obj):
        return self._get_clearance(obj).get('is_exam_cleared', True)

    def get_clearance_source(self, obj):
        return self._get_clearance(obj).get('source', 'Staff')

    def get_clearance_mode(self, obj):
        return self._get_clearance(obj).get('clearance_mode', 'staff' if obj.role != 'student' else 'uncleared')

    def get_is_temp_cleared(self, obj):
        return self._get_clearance(obj).get('is_temp_cleared', False)

    def get_temp_clearance_info(self, obj):
        return self._get_clearance(obj).get('temp_info', None)

    def get_effective_tuition_percentage(self, obj):
        return self._get_clearance(obj).get('tuition_paid_percentage', float(obj.tuition_paid_percentage or 0.0))

    def get_clearance_level(self, obj):
        if obj.role != 'student':
            return 100
        clr = self._get_clearance(obj)
        pct = clr.get('tuition_paid_percentage', float(obj.tuition_paid_percentage or 0.0))
        if clr.get('is_exam_cleared') or pct >= 100.0:
            return 100
        elif clr.get('is_test_cleared') or pct >= 50.0:
            return 50
        return 0

class AdminUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True, allow_null=True)
    faculty_name = serializers.SerializerMethodField()
    faculty_code = serializers.SerializerMethodField()
    gender_display = serializers.CharField(source='get_gender_display', read_only=True)
    registration_number = serializers.ReadOnlyField()
    assigned_course_codes = serializers.SerializerMethodField()
    assigned_faculty_details = serializers.SerializerMethodField()
    assigned_course_unit_details = serializers.SerializerMethodField()
    gender_display = serializers.CharField(source='get_gender_display', read_only=True)
    is_test_cleared = serializers.SerializerMethodField()
    is_exam_cleared = serializers.SerializerMethodField()
    clearance_source = serializers.SerializerMethodField()
    clearance_mode = serializers.SerializerMethodField()
    is_temp_cleared = serializers.SerializerMethodField()
    temp_clearance_info = serializers.SerializerMethodField()
    effective_tuition_percentage = serializers.SerializerMethodField()
    clearance_level = serializers.SerializerMethodField()

    class Meta:
        model = User
        list_serializer_class = UserListSerializer
        fields = ('id', 'username', 'email', 'password', 'first_name', 'last_name', 'role', 'phone', 'gender', 'gender_display', 'tuition_paid_percentage', 'effective_tuition_percentage', 'faculty', 'faculty_name', 'faculty_code', 'assigned_faculties', 'assigned_faculty_details', 'assigned_courses', 'assigned_course_codes', 'assigned_course_unit_details', 'reg_number', 'registration_number', 'year_of_study', 'semester', 'academic_year', 'entry_year', 'intake', 'must_change_password', 'is_active', 'is_test_cleared', 'is_exam_cleared', 'is_temp_cleared', 'clearance_source', 'clearance_mode', 'temp_clearance_info', 'clearance_level')

    def get_faculty_name(self, obj):
        fac = resolve_user_faculty(obj)
        return fac.name if fac else None

    def get_faculty_code(self, obj):
        fac = resolve_user_faculty(obj)
        return fac.code if fac else None

    def get_assigned_faculty_details(self, obj):
        facs = list(obj.assigned_faculties.all())
        if not facs and obj.faculty:
            facs = [obj.faculty]
        return [{'id': f.id, 'code': f.code, 'name': f.name} for f in facs]

    def get_assigned_course_unit_details(self, obj):
        if obj.role != 'lecturer':
            return []
        units = list(obj.assigned_course_units.select_related('course', 'course__faculty').all())
        return [{
            'id': u.id,
            'code': u.code,
            'name': u.name,
            'course_code': u.course.code if u.course else '',
            'course_name': u.course.name if u.course else '',
            'faculty_code': u.course.faculty.code if (u.course and u.course.faculty) else ''
        } for u in units]

    def validate_phone(self, value):
        if value:
            return str(value).strip()[:20]
        return value

    def validate_gender(self, value):
        if not value:
            return 'other'
        val = str(value).strip().lower()
        if val in ['m', 'male', 'man', 'boy']:
            return 'male'
        elif val in ['f', 'female', 'woman', 'girl']:
            return 'female'
        return 'other'

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        assigned_courses = validated_data.pop('assigned_courses', None)
        assigned_faculties = validated_data.pop('assigned_faculties', None)
        assigned_unit_ids = self.initial_data.get('assigned_course_units') or self.initial_data.get('course_units')

        user = super().create(validated_data)
        if assigned_courses is not None:
            user.assigned_courses.set(assigned_courses)
        if assigned_faculties is not None:
            user.assigned_faculties.set(assigned_faculties)
        if assigned_unit_ids is not None:
            from .models import CourseUnit
            units = CourseUnit.objects.filter(id__in=assigned_unit_ids)
            user.assigned_course_units.set(units)
        if password and str(password).strip():
            user.set_password(str(password).strip())
            user.must_change_password = True
            user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        assigned_courses = validated_data.pop('assigned_courses', None)
        assigned_faculties = validated_data.pop('assigned_faculties', None)
        assigned_unit_ids = self.initial_data.get('assigned_course_units') or self.initial_data.get('course_units')

        user = super().update(instance, validated_data)
        if assigned_courses is not None:
            user.assigned_courses.set(assigned_courses)
        if assigned_faculties is not None:
            user.assigned_faculties.set(assigned_faculties)
        if assigned_unit_ids is not None:
            from .models import CourseUnit
            units = CourseUnit.objects.filter(id__in=assigned_unit_ids)
            user.assigned_course_units.set(units)
        if password and str(password).strip():
            user.set_password(str(password).strip())
            user.save()
        return user

    def get_assigned_course_codes(self, obj):
        codes = set(c.code for c in obj.assigned_courses.all())
        if obj.role == 'lecturer':
            for unit in obj.assigned_course_units.select_related('course').all():
                if unit.course:
                    codes.add(unit.course.code)
        return sorted(list(codes))

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not data.get('faculty'):
            fac = resolve_user_faculty(instance)
            if fac:
                data['faculty'] = fac.id
        if instance.role == 'lecturer':
            unit_course_ids = list(instance.assigned_course_units.filter(course__isnull=False).values_list('course_id', flat=True).distinct())
            existing = set(data.get('assigned_courses') or [])
            data['assigned_courses'] = sorted(list(existing.union(unit_course_ids)))
            data['assigned_course_units'] = list(instance.assigned_course_units.values_list('id', flat=True))
        return data

    def _get_clearance(self, obj):
        if not hasattr(obj, '_cached_clearance'):
            if obj.role != 'student':
                obj._cached_clearance = {
                    'is_exam_cleared': True,
                    'is_test_cleared': True,
                    'tuition_paid_percentage': 100.0,
                    'clearance_mode': 'staff',
                    'is_temp_cleared': False,
                    'temp_info': None,
                    'source': 'Staff / Faculty Role'
                }
            else:
                from .clearance import check_student_clearance
                acad = getattr(obj, 'academic_year', '2026/2027') or '2026/2027'
                sem = str(getattr(obj, 'semester', 1) or 1)
                obj._cached_clearance = check_student_clearance(obj, acad=acad, sem=sem)
        return obj._cached_clearance

    def get_is_test_cleared(self, obj):
        return self._get_clearance(obj).get('is_test_cleared', True)

    def get_is_exam_cleared(self, obj):
        return self._get_clearance(obj).get('is_exam_cleared', True)

    def get_clearance_source(self, obj):
        return self._get_clearance(obj).get('source', 'Staff')

    def get_clearance_mode(self, obj):
        return self._get_clearance(obj).get('clearance_mode', 'staff' if obj.role != 'student' else 'uncleared')

    def get_is_temp_cleared(self, obj):
        return self._get_clearance(obj).get('is_temp_cleared', False)

    def get_temp_clearance_info(self, obj):
        return self._get_clearance(obj).get('temp_info', None)

    def get_effective_tuition_percentage(self, obj):
        return self._get_clearance(obj).get('tuition_paid_percentage', float(obj.tuition_paid_percentage or 0.0))

    def get_clearance_level(self, obj):
        if obj.role != 'student':
            return 100
        clr = self._get_clearance(obj)
        pct = clr.get('tuition_paid_percentage', float(obj.tuition_paid_percentage or 0.0))
        if clr.get('is_exam_cleared') or pct >= 100.0:
            return 100
        elif clr.get('is_test_cleared') or pct >= 50.0:
            return 50
        return 0


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    invitation_code = serializers.UUIDField(required=False, write_only=True)

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'first_name', 'last_name', 'role', 'phone', 'gender', 'faculty', 'assigned_courses', 'invitation_code', 'reg_number', 'year_of_study', 'semester', 'intake')

    def validate_gender(self, value):
        if not value:
            return 'other'
        val = str(value).strip().lower()
        if val in ['m', 'male', 'man', 'boy']:
            return 'male'
        elif val in ['f', 'female', 'woman', 'girl']:
            return 'female'
        return 'other'

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
            is_admin = request and request.user and request.user.is_authenticated and request.user.role in ['admin', 'platform_coordinator']
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
    faculty_name = serializers.CharField(source='faculty.name', read_only=True, allow_null=True)
    faculty_code = serializers.CharField(source='faculty.code', read_only=True, allow_null=True)
    units_count = serializers.IntegerField(source='units.count', read_only=True)

    class Meta:
        model = Course
        fields = '__all__'

class CourseUnitSerializer(serializers.ModelSerializer):
    course_code = serializers.CharField(source='course.code', read_only=True)
    course_name = serializers.CharField(source='course.name', read_only=True)
    faculty_id = serializers.IntegerField(source='course.faculty.id', read_only=True, allow_null=True)
    faculty_code = serializers.CharField(source='course.faculty.code', read_only=True, allow_null=True)
    faculty_name = serializers.CharField(source='course.faculty.name', read_only=True, allow_null=True)
    semester_display = serializers.CharField(source='get_semester_display', read_only=True)
    year_of_study_display = serializers.CharField(source='get_year_of_study_display', read_only=True)
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
    faculty_id = serializers.SerializerMethodField()
    faculty_name = serializers.SerializerMethodField()
    faculty_code = serializers.SerializerMethodField()
    course_unit_name = serializers.CharField(source='course_unit.name', read_only=True, allow_null=True)
    course_unit_code = serializers.CharField(source='course_unit.code', read_only=True, allow_null=True)
    course_unit_year = serializers.IntegerField(source='course_unit.year_of_study', read_only=True, allow_null=True)
    course_unit_semester = serializers.IntegerField(source='course_unit.semester', read_only=True, allow_null=True)
    lecturer_name = serializers.CharField(source='lecturer.get_full_name', read_only=True)
    questions_count = serializers.IntegerField(source='questions.count', read_only=True)
    additional_courses = serializers.PrimaryKeyRelatedField(many=True, queryset=Course.objects.all(), required=False)
    additional_course_units = serializers.PrimaryKeyRelatedField(many=True, queryset=CourseUnit.objects.all(), required=False)
    additional_course_details = serializers.SerializerMethodField()
    additional_course_unit_details = serializers.SerializerMethodField()
    special_students_details = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = Exam
        fields = '__all__'
        read_only_fields = ('lecturer', 'is_approved_by_dean', 'is_results_released')

    def get_special_students_details(self, obj):
        return [
            {
                'id': s.id,
                'username': s.username,
                'name': s.get_full_name() or s.username,
                'reg_number': s.reg_number or s.registration_number or 'N/A',
                'email': s.email
            }
            for s in obj.special_students.all()
        ]

    def get_status(self, obj):
        now = timezone.now()
        if obj.due_date and now > obj.due_date:
            return 'Ended'
        if obj.scheduled_start and now < obj.scheduled_start:
            return 'Scheduled'
        return 'In Progress'

    def get_faculty_id(self, obj):
        if obj.course and obj.course.faculty_id:
            return obj.course.faculty_id
        if obj.course_unit and obj.course_unit.course and obj.course_unit.course.faculty_id:
            return obj.course_unit.course.faculty_id
        return None

    def get_faculty_name(self, obj):
        if obj.course and obj.course.faculty:
            return obj.course.faculty.name
        if obj.course_unit and obj.course_unit.course and obj.course_unit.course.faculty:
            return obj.course_unit.course.faculty.name
        return None

    def get_faculty_code(self, obj):
        if obj.course and obj.course.faculty:
            return obj.course.faculty.code
        if obj.course_unit and obj.course_unit.course and obj.course_unit.course.faculty:
            return obj.course_unit.course.faculty.code
        return None

    def get_additional_course_details(self, obj):
        return [{'id': c.id, 'name': c.name, 'code': c.code} for c in obj.additional_courses.all()]

    def get_additional_course_unit_details(self, obj):
        return [{'id': u.id, 'name': u.name, 'code': u.code, 'course_id': u.course_id, 'course_code': u.course.code if u.course else ''} for u in obj.additional_course_units.select_related('course').all()]

class ExamAttemptSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    student_username = serializers.CharField(source='student.username', read_only=True)
    student_email = serializers.CharField(source='student.email', read_only=True)
    student_reg_number = serializers.SerializerMethodField()
    registration_number = serializers.SerializerMethodField()
    student_faculty = serializers.SerializerMethodField()
    student_faculty_code = serializers.SerializerMethodField()
    student_phone = serializers.CharField(source='student.phone', read_only=True)
    student_gender = serializers.CharField(source='student.gender', read_only=True)
    academic_year = serializers.SerializerMethodField()
    semester = serializers.SerializerMethodField()
    year_of_study = serializers.SerializerMethodField()
    year = serializers.SerializerMethodField()
    lecturer_name = serializers.SerializerMethodField()
    start_time = serializers.DateTimeField(source='started_at', read_only=True)
    submission_time = serializers.DateTimeField(source='completed_at', read_only=True)
    submission_type_display = serializers.SerializerMethodField()
    exam_title = serializers.CharField(source='exam.title', read_only=True)
    exam_course_code = serializers.CharField(source='exam.course.code', read_only=True)
    exam_course_name = serializers.CharField(source='exam.course.name', read_only=True)
    exam_course_id = serializers.IntegerField(source='exam.course.id', read_only=True)
    duration_minutes = serializers.IntegerField(source='exam.duration_minutes', read_only=True)
    is_results_released = serializers.BooleanField(source='exam.is_results_released', read_only=True)
    exam_scheduled_start = serializers.DateTimeField(source='exam.scheduled_start', read_only=True)
    exam_due_date = serializers.DateTimeField(source='exam.due_date', read_only=True)

    class Meta:
        model = ExamAttempt
        fields = '__all__'
        read_only_fields = ('student', 'started_at', 'completed_at', 'score')

    def get_student_name(self, obj):
        name = obj.student.get_full_name()
        return name if name and name.strip() else obj.student.username

    def get_student_reg_number(self, obj):
        return obj.student.reg_number or obj.student.registration_number or ''

    def get_registration_number(self, obj):
        return obj.student.reg_number or obj.student.registration_number or ''

    def get_student_faculty(self, obj):
        if obj.student and obj.student.faculty:
            return obj.student.faculty.name
        if obj.exam and obj.exam.course and obj.exam.course.faculty:
            return obj.exam.course.faculty.name
        return 'Clarke International University'

    def get_student_faculty_code(self, obj):
        if obj.student and obj.student.faculty:
            return obj.student.faculty.code
        if obj.exam and obj.exam.course and obj.exam.course.faculty:
            return obj.exam.course.faculty.code
        return ''

    def get_academic_year(self, obj):
        return obj.student.academic_year or obj.exam.academic_year or '2026/2027'

    def get_semester(self, obj):
        return obj.student.semester or obj.exam.semester or 1

    def get_year_of_study(self, obj):
        return obj.student.year_of_study or obj.exam.year_of_study or 1

    def get_year(self, obj):
        return obj.student.year_of_study or obj.exam.year_of_study or 1

    def get_submission_type_display(self, obj):
        return obj.get_submission_type_display_safe()

    def get_lecturer_name(self, obj):
        if obj.exam and obj.exam.lecturer:
            name = obj.exam.lecturer.get_full_name()
            return name if name and name.strip() else obj.exam.lecturer.username
        return 'N/A'

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        if not data.get('submission_type'):
            data['submission_type'] = instance.submission_type or ('security logs' if instance.auto_submitted_reason and any(k in instance.auto_submitted_reason.lower() for k in ['tab switch', 'security', 'lockdown']) else ('system' if instance.auto_submitted_reason else 'manual'))
        data['submission_type_display'] = instance.get_submission_type_display_safe()
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
    faculty_id = serializers.SerializerMethodField()
    faculty_name = serializers.SerializerMethodField()
    faculty_code = serializers.SerializerMethodField()
    course_unit_name = serializers.CharField(source='course_unit.name', read_only=True, allow_null=True)
    course_unit_code = serializers.CharField(source='course_unit.code', read_only=True, allow_null=True)
    course_unit_year = serializers.IntegerField(source='course_unit.year_of_study', read_only=True, allow_null=True)
    course_unit_semester = serializers.IntegerField(source='course_unit.semester', read_only=True, allow_null=True)
    lecturer_name = serializers.CharField(source='lecturer.get_full_name', read_only=True)
    questions_count = serializers.IntegerField(source='questions.count', read_only=True)
    attempts_count = serializers.IntegerField(source='attempts.count', read_only=True)
    additional_courses = serializers.PrimaryKeyRelatedField(many=True, queryset=Course.objects.all(), required=False)
    additional_course_units = serializers.PrimaryKeyRelatedField(many=True, queryset=CourseUnit.objects.all(), required=False)
    additional_course_details = serializers.SerializerMethodField()
    additional_course_unit_details = serializers.SerializerMethodField()
    special_students_details = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = Test
        fields = '__all__'
        read_only_fields = ('lecturer',)

    def get_special_students_details(self, obj):
        return [
            {
                'id': s.id,
                'username': s.username,
                'name': s.get_full_name() or s.username,
                'reg_number': s.reg_number or s.registration_number or 'N/A',
                'email': s.email
            }
            for s in obj.special_students.all()
        ]

    def get_status(self, obj):
        now = timezone.now()
        if obj.due_date and now > obj.due_date:
            return 'Ended'
        if obj.scheduled_start and now < obj.scheduled_start:
            return 'Scheduled'
        return 'In Progress'

    def get_faculty_id(self, obj):
        if obj.course and obj.course.faculty_id:
            return obj.course.faculty_id
        if obj.course_unit and obj.course_unit.course and obj.course_unit.course.faculty_id:
            return obj.course_unit.course.faculty_id
        return None

    def get_faculty_name(self, obj):
        if obj.course and obj.course.faculty:
            return obj.course.faculty.name
        if obj.course_unit and obj.course_unit.course and obj.course_unit.course.faculty:
            return obj.course_unit.course.faculty.name
        return None

    def get_faculty_code(self, obj):
        if obj.course and obj.course.faculty:
            return obj.course.faculty.code
        if obj.course_unit and obj.course_unit.course and obj.course_unit.course.faculty:
            return obj.course_unit.course.faculty.code
        return None

    def get_additional_course_details(self, obj):
        return [{'id': c.id, 'name': c.name, 'code': c.code} for c in obj.additional_courses.all()]

    def get_additional_course_unit_details(self, obj):
        return [{'id': u.id, 'name': u.name, 'code': u.code, 'course_id': u.course_id, 'course_code': u.course.code if u.course else ''} for u in obj.additional_course_units.select_related('course').all()]

class TestAttemptSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    student_username = serializers.CharField(source='student.username', read_only=True)
    student_email = serializers.CharField(source='student.email', read_only=True)
    student_reg_number = serializers.SerializerMethodField()
    registration_number = serializers.SerializerMethodField()
    student_faculty = serializers.SerializerMethodField()
    student_faculty_code = serializers.SerializerMethodField()
    student_phone = serializers.CharField(source='student.phone', read_only=True)
    student_gender = serializers.CharField(source='student.gender', read_only=True)
    academic_year = serializers.SerializerMethodField()
    semester = serializers.SerializerMethodField()
    year_of_study = serializers.SerializerMethodField()
    year = serializers.SerializerMethodField()
    lecturer_name = serializers.SerializerMethodField()
    start_time = serializers.DateTimeField(source='started_at', read_only=True)
    submission_time = serializers.DateTimeField(source='completed_at', read_only=True)
    submission_type_display = serializers.SerializerMethodField()
    test_title = serializers.CharField(source='test.title', read_only=True)
    test_course_code = serializers.CharField(source='test.course.code', read_only=True)
    test_course_name = serializers.CharField(source='test.course.name', read_only=True)
    test_course_id = serializers.IntegerField(source='test.course.id', read_only=True)
    test_category = serializers.CharField(source='test.category', read_only=True)
    duration_minutes = serializers.IntegerField(source='test.duration_minutes', read_only=True)
    pass_percentage = serializers.FloatField(source='test.pass_percentage', read_only=True)
    is_results_released = serializers.BooleanField(source='test.is_results_released', read_only=True)
    test_scheduled_start = serializers.DateTimeField(source='test.scheduled_start', read_only=True)
    test_due_date = serializers.DateTimeField(source='test.due_date', read_only=True)

    class Meta:
        model = TestAttempt
        fields = '__all__'
        read_only_fields = ('student', 'started_at', 'completed_at', 'score', 'passed')

    def get_student_name(self, obj):
        name = obj.student.get_full_name()
        return name if name and name.strip() else obj.student.username

    def get_student_reg_number(self, obj):
        return obj.student.reg_number or obj.student.registration_number or ''

    def get_registration_number(self, obj):
        return obj.student.reg_number or obj.student.registration_number or ''

    def get_student_faculty(self, obj):
        if obj.student and obj.student.faculty:
            return obj.student.faculty.name
        if obj.test and obj.test.course and obj.test.course.faculty:
            return obj.test.course.faculty.name
        return 'Clarke International University'

    def get_student_faculty_code(self, obj):
        if obj.student and obj.student.faculty:
            return obj.student.faculty.code
        if obj.test and obj.test.course and obj.test.course.faculty:
            return obj.test.course.faculty.code
        return ''

    def get_academic_year(self, obj):
        return obj.student.academic_year or obj.test.academic_year or '2026/2027'

    def get_semester(self, obj):
        return obj.student.semester or obj.test.semester or 1

    def get_year_of_study(self, obj):
        return obj.student.year_of_study or obj.test.year_of_study or 1

    def get_year(self, obj):
        return obj.student.year_of_study or obj.test.year_of_study or 1

    def get_submission_type_display(self, obj):
        return obj.get_submission_type_display_safe()

    def get_lecturer_name(self, obj):
        if obj.test and obj.test.lecturer:
            name = obj.test.lecturer.get_full_name()
            return name if name and name.strip() else obj.test.lecturer.username
        return 'N/A'

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        if not data.get('submission_type'):
            data['submission_type'] = instance.submission_type or ('security logs' if instance.auto_submitted_reason and any(k in instance.auto_submitted_reason.lower() for k in ['tab switch', 'security', 'lockdown']) else ('system' if instance.auto_submitted_reason else 'manual'))
        data['submission_type_display'] = instance.get_submission_type_display_safe()
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


class TemporaryClearanceSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.get_full_name', read_only=True)
    student_reg_number = serializers.CharField(source='student.registration_number', read_only=True)
    student_email = serializers.CharField(source='student.email', read_only=True)
    faculty_code = serializers.CharField(source='student.faculty.code', read_only=True, allow_null=True)
    granted_by_username = serializers.CharField(source='granted_by.username', read_only=True, allow_null=True)
    is_currently_valid = serializers.BooleanField(read_only=True)

    class Meta:
        model = TemporaryClearance
        fields = '__all__'
        read_only_fields = ('granted_by', 'valid_from', 'expires_at', 'created_at')


class QuestionBankItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionBankItem
        fields = '__all__'


class QuestionBankSerializer(serializers.ModelSerializer):
    course_code = serializers.CharField(source='course.code', read_only=True)
    course_name = serializers.CharField(source='course.name', read_only=True)
    course_unit_name = serializers.CharField(source='course_unit.name', read_only=True, allow_null=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    items_count = serializers.IntegerField(source='items.count', read_only=True)
    items = QuestionBankItemSerializer(many=True, read_only=True)

    class Meta:
        model = QuestionBank
        fields = '__all__'
        read_only_fields = ('created_by', 'created_at')


class ProctorSnapshotSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.get_full_name', read_only=True)
    student_reg_number = serializers.CharField(source='student.registration_number', read_only=True)
    faculty_code = serializers.CharField(source='student.faculty.code', read_only=True, allow_null=True)
    test_title = serializers.CharField(source='test.title', read_only=True, allow_null=True)
    exam_title = serializers.CharField(source='exam.title', read_only=True, allow_null=True)

    class Meta:
        model = ProctorSnapshot
        fields = '__all__'
        read_only_fields = ('captured_at',)

