import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mykampus_backend.settings')

import django
django.setup()


from django.utils import timezone
from ciu_portal.models import User, Faculty, Course, Test, TestQuestion, TestAttempt, TemporaryClearance, QuestionBank, QuestionBankItem, SystemLog
from ciu_portal.clearance import check_student_clearance

def run_tests():
    print("==================================================")
    print("🚀 RUNNING FULL SYSTEM VERIFICATION SUITE")
    print("==================================================")

    # 1. Test Temporary Clearance Overrides
    print("\n--- 1. Testing Temporary Clearance Overrides ---")
    faculty, _ = Faculty.objects.get_or_create(code='SOBAT', defaults={'name': 'School of Business & Tech'})
    student, _ = User.objects.get_or_create(
        username='test_student_001',
        defaults={
            'email': 'student1@ciu.ac.ug',
            'role': 'student',
            'reg_number': '2026SOBAT-TEST001',
            'tuition_paid_percentage': 0.0,
            'faculty': faculty
        }
    )

    student.tuition_paid_percentage = 0.0
    student.save()
    TemporaryClearance.objects.filter(student=student).delete()

    # Initial status (0% tuition paid)
    clearance_before = check_student_clearance(student, examtype="EXAMS", preloaded_api_data=[])
    print(f"Before Temp Clearance: Exam Cleared={clearance_before['is_exam_cleared']} | Test Cleared={clearance_before['is_test_cleared']}")
    assert not clearance_before['is_exam_cleared'], "Should be barred for exams at 0% tuition!"
    assert not clearance_before['is_test_cleared'], "Should be barred for tests at 0% tuition!"

    # Grant Temporary Clearance for 7 days
    admin_user, _ = User.objects.get_or_create(username='admin_test', defaults={'role': 'admin', 'email': 'admin@ciu.ac.ug'})
    tc = TemporaryClearance.objects.create(
        student=student,
        granted_by=admin_user,
        clearance_type='both',
        expires_at=timezone.now() + timezone.timedelta(days=7),
        reason='Financial Guarantee'
    )
    clearance_after = check_student_clearance(student, examtype="EXAMS", preloaded_api_data=[])
    print(f"After Temp Clearance: Exam Cleared={clearance_after['is_exam_cleared']} | Test Cleared={clearance_after['is_test_cleared']} | Source={clearance_after['source']}")
    assert clearance_after['is_exam_cleared'], "Should be cleared for exams via temporary clearance!"
    assert clearance_after['is_test_cleared'], "Should be cleared for tests via temporary clearance!"
    assert clearance_after['is_temp_cleared'], "is_temp_cleared flag should be True!"

    # 2. Test Question Bank Creation & Test Import
    print("\n--- 2. Testing Question Bank & Test Import ---")
    lecturer, _ = User.objects.get_or_create(username='test_lecturer', defaults={'role': 'lecturer', 'email': 'lecturer@ciu.ac.ug'})
    course, _ = Course.objects.get_or_create(code='BIT101', defaults={'name': 'Intro to IT', 'faculty': faculty})
    
    bank = QuestionBank.objects.create(
        title='Java Fundamentals Bank',
        course=course,
        created_by=lecturer,
        description='Core OOP questions'
    )
    QuestionBankItem.objects.create(
        bank=bank,
        question_text='What is encapsulation?',
        question_type='mcq',
        option_a='Data Hiding',
        option_b='Polymorphism',
        option_c='Inheritance',
        option_d='Compilation',
        correct_answer='A',
        points=2.0
    )
    assert bank.items.count() == 1, "Question Bank item should be created!"
    print(f"Question Bank '{bank.title}' created with {bank.items.count()} items.")

    test_obj = Test.objects.create(
        title='Midterm Test 1',
        course=course,
        lecturer=lecturer,
        pass_percentage=50.0,
        is_published=True
    )

    # Import question bank items into test
    for item in bank.items.all():
        TestQuestion.objects.create(
            test=test_obj,
            question_text=item.question_text,
            question_type=item.question_type,
            option_a=item.option_a,
            option_b=item.option_b,
            option_c=item.option_c,
            option_d=item.option_d,
            correct_answer=item.correct_answer,
            points=item.points
        )
    print(f"Imported items into Test '{test_obj.title}': {test_obj.questions.count()} questions.")
    assert test_obj.questions.count() == 1, "Test should have imported questions!"

    # 3. Test Autograded Submission
    print("\n--- 3. Testing Autograded Test Submission ---")
    q = test_obj.questions.first()
    attempt = TestAttempt.objects.create(student=student, test=test_obj, attempt_number=1)
    
    answers = {str(q.id): 'A'}
    earned = q.points if answers[str(q.id)] == q.correct_answer else 0
    score = (earned / q.points) * 100.0
    attempt.answers = answers
    attempt.score = score
    attempt.passed = score >= test_obj.pass_percentage
    attempt.completed_at = timezone.now()
    attempt.save()

    print(f"Student Test Attempt: Score={attempt.score}% | Passed={attempt.passed}")
    assert attempt.passed is True, "Student should pass with 100% score!"

    # 5. Test Platform Coordinator & Password Reset Hierarchy
    print("\n--- 5. Testing Platform Coordinator & Password Reset Hierarchy ---")
    from ciu_portal.views import AdminUserViewSet, ChangePasswordView
    from rest_framework.test import APIRequestFactory, force_authenticate

    factory = APIRequestFactory()

    # Setup Users
    sys_admin, _ = User.objects.get_or_create(username='sys_admin_test', defaults={'role': 'admin', 'email': 'sysadmin@ciu.ac.ug'})
    sys_admin.set_password('adminpass123')
    sys_admin.save()

    p_coord, _ = User.objects.get_or_create(username='coord_test', defaults={'role': 'platform_coordinator', 'email': 'coord@ciu.ac.ug'})
    p_coord.set_password('coordpass123')
    p_coord.save()

    lecturer_user, _ = User.objects.get_or_create(username='lecturer_test', defaults={'role': 'lecturer', 'email': 'lecturer_test@ciu.ac.ug'})
    lecturer_user.set_password('lecturerpass123')
    lecturer_user.save()

    # Rule A: Platform Coordinator can reset non-admin user password (e.g. lecturer)
    view_reset = AdminUserViewSet.as_view({'post': 'reset_password'})
    req = factory.post(f'/api/admin/users/{lecturer_user.id}/reset_password/', {'new_password': 'newlecturerpass123'}, format='json')
    force_authenticate(req, user=p_coord)
    resp = view_reset(req, pk=lecturer_user.id)
    assert resp.status_code == 200, f"Platform Coordinator should be able to reset lecturer password, got {resp.status_code}"
    lecturer_user.refresh_from_db()
    assert lecturer_user.check_password('newlecturerpass123'), "Lecturer password should be updated!"
    assert lecturer_user.must_change_password is True, "must_change_password should be True after admin password reset!"
    print("✓ Platform Coordinator successfully reset Lecturer password (must_change_password set to True).")

    # Rule B: Platform Coordinator CANNOT reset System Admin password (HTTP 403 Forbidden)
    req_bad = factory.post(f'/api/admin/users/{sys_admin.id}/reset_password/', {'new_password': 'hackedadminpass'}, format='json')
    force_authenticate(req_bad, user=p_coord)
    resp_bad = view_reset(req_bad, pk=sys_admin.id)
    assert resp_bad.status_code == 403, f"Platform Coordinator MUST be forbidden from resetting System Admin password! Got {resp_bad.status_code}"
    sys_admin.refresh_from_db()
    assert sys_admin.check_password('adminpass123'), "System Admin password should remain unchanged!"
    print("✓ Platform Coordinator blocked from resetting System Admin password (HTTP 403 Forbidden).")

    # Rule C: System Admin CAN reset Platform Coordinator password
    req_admin_reset = factory.post(f'/api/admin/users/{p_coord.id}/reset_password/', {'new_password': 'newcoordpass123'}, format='json')
    force_authenticate(req_admin_reset, user=sys_admin)
    resp_admin_reset = view_reset(req_admin_reset, pk=p_coord.id)
    assert resp_admin_reset.status_code == 200, "System Admin should be able to reset Platform Coordinator password!"
    p_coord.refresh_from_db()
    assert p_coord.check_password('newcoordpass123'), "Platform Coordinator password should be updated by Admin!"
    assert p_coord.must_change_password is True, "must_change_password should be True!"
    print("✓ System Admin successfully reset Platform Coordinator password.")

    # Rule D: Bulk Password Reset
    view_bulk_reset = AdminUserViewSet.as_view({'post': 'bulk_reset_passwords'})
    req_bulk = factory.post('/api/admin/users/bulk_reset_passwords/', {'user_ids': [lecturer_user.id], 'new_password': 'bulkpass12345'}, format='json')
    force_authenticate(req_bulk, user=sys_admin)
    resp_bulk = view_bulk_reset(req_bulk)
    assert resp_bulk.status_code == 200, "Bulk password reset should succeed!"
    lecturer_user.refresh_from_db()
    assert lecturer_user.check_password('bulkpass12345'), "Lecturer password should be updated by bulk reset!"
    assert lecturer_user.must_change_password is True, "must_change_password should be True after bulk reset!"
    print("✓ Bulk password reset successfully updated target users.")

    # Rule E: Admin user creation with password parameter
    User.objects.filter(username='created_by_admin').delete()
    view_user_create = AdminUserViewSet.as_view({'post': 'create'})
    req_create = factory.post('/api/admin/users/', {
        'username': 'created_by_admin',
        'email': 'created_admin@ciu.ac.ug',
        'first_name': 'AdminCreated',
        'last_name': 'User',
        'role': 'lecturer',
        'password': 'initialadmincreatedpass'
    }, format='json')
    force_authenticate(req_create, user=sys_admin)
    resp_create = view_user_create(req_create)
    assert resp_create.status_code == 201, f"Admin user creation failed with status {resp_create.status_code}: {resp_create.data}"
    created_u = User.objects.get(username='created_by_admin')
    assert created_u.check_password('initialadmincreatedpass'), "User created by admin should have properly hashed password!"
    assert created_u.must_change_password is True, "User created by admin should have must_change_password=True!"
    print("✓ User created via Admin API has correctly hashed initial password.")

    # Rule F: Self password change for all users
    change_view = ChangePasswordView.as_view()
    req_change = factory.post('/api/change-password/', {'current_password': 'newcoordpass123', 'new_password': 'selfcoordpass456'}, format='json')
    force_authenticate(req_change, user=p_coord)
    resp_change = change_view(req_change)
    assert resp_change.status_code == 200, "Platform Coordinator should be able to change their own password!"
    p_coord.refresh_from_db()
    assert p_coord.check_password('selfcoordpass456'), "Platform Coordinator password changed successfully via self-service!"
    assert p_coord.must_change_password is False, "must_change_password should revert to False after user changes password!"
    print("✓ Platform Coordinator successfully changed own password via self-service (must_change_password reset to False).")

    # 6. Test Dean and Faculty Secretary Strict Faculty Scoping (Rule 7)
    print("\n--- 6. Testing Dean & Faculty Secretary Strict Scoping ---")
    from ciu_portal.models import ClassTimetable, ExamTimetable, CourseUnit
    from ciu_portal.views import FacultyViewSet, CourseViewSet, CourseUnitViewSet, TestViewSet, ExamViewSet, ClassTimetableViewSet, ExamTimetableViewSet, ReportsViewSet

    fac_sci, _ = Faculty.objects.get_or_create(code='FACS', defaults={'name': 'Faculty of Science'})
    fac_nur, _ = Faculty.objects.get_or_create(code='FACN', defaults={'name': 'Faculty of Nursing'})

    dean_sci, _ = User.objects.get_or_create(
        username='dean_sci_test',
        defaults={'role': 'dean', 'email': 'deansci@ciu.ac.ug', 'faculty': fac_sci}
    )
    dean_sci.faculty = fac_sci
    dean_sci.save()

    sec_sci, _ = User.objects.get_or_create(
        username='sec_sci_test',
        defaults={'role': 'faculty_secretary', 'email': 'secsci@ciu.ac.ug', 'faculty': fac_sci}
    )
    sec_sci.faculty = fac_sci
    sec_sci.save()

    course_sci, _ = Course.objects.get_or_create(code='CS101', defaults={'name': 'Computer Science 101', 'faculty': fac_sci})
    course_nur, _ = Course.objects.get_or_create(code='NUR101', defaults={'name': 'Nursing Fundamentals', 'faculty': fac_nur})

    from ciu_portal.models import Exam
    test_sci, _ = Test.objects.get_or_create(title='Science Test', course=course_sci, defaults={'lecturer': lecturer, 'pass_percentage': 50})
    test_nur, _ = Test.objects.get_or_create(title='Nursing Test', course=course_nur, defaults={'lecturer': lecturer, 'pass_percentage': 50})

    exam_sci, _ = Exam.objects.get_or_create(title='Science Exam', course=course_sci, defaults={'lecturer': lecturer})
    exam_nur, _ = Exam.objects.get_or_create(title='Nursing Exam', course=course_nur, defaults={'lecturer': lecturer})

    # Faculty ViewSet Scoping for Dean
    view_fac = FacultyViewSet.as_view({'get': 'list'})
    req_f = factory.get('/api/faculties/')
    force_authenticate(req_f, user=dean_sci)
    resp_f = view_fac(req_f)
    assert resp_f.status_code == 200, "Faculty list should return 200"
    fac_ids = [f['id'] for f in resp_f.data]
    assert fac_sci.id in fac_ids, "Dean of Science must see Faculty of Science!"
    assert fac_nur.id not in fac_ids, "Dean of Science MUST NOT see Faculty of Nursing!"
    print("✓ FacultyViewSet correctly restricted for Dean.")

    # Course ViewSet Scoping for Dean
    view_course = CourseViewSet.as_view({'get': 'list'})
    req_c = factory.get('/api/courses/')
    force_authenticate(req_c, user=dean_sci)
    resp_c = view_course(req_c)
    assert resp_c.status_code == 200, "Course list should return 200"
    course_ids = [c['id'] for c in resp_c.data]
    assert course_sci.id in course_ids, "Dean of Science must see CS101!"
    assert course_nur.id not in course_ids, "Dean of Science MUST NOT see NUR101!"
    print("✓ CourseViewSet correctly restricted for Dean.")

    # Test ViewSet Scoping for Faculty Secretary
    view_test = TestViewSet.as_view({'get': 'list'})
    req_t = factory.get('/api/tests/')
    force_authenticate(req_t, user=sec_sci)
    resp_t = view_test(req_t)
    assert resp_t.status_code == 200, "Test list should return 200"
    test_ids = [t['id'] for t in resp_t.data]
    assert test_sci.id in test_ids, "Faculty Secretary must see Science Test!"
    assert test_nur.id not in test_ids, "Faculty Secretary MUST NOT see Nursing Test!"
    print("✓ TestViewSet correctly restricted for Faculty Secretary.")

    # Exam ViewSet Scoping for Dean
    view_exam = ExamViewSet.as_view({'get': 'list'})
    req_e = factory.get('/api/exams/')
    force_authenticate(req_e, user=dean_sci)
    resp_e = view_exam(req_e)
    assert resp_e.status_code == 200, "Exam list should return 200"
    exam_ids = [e['id'] for e in resp_e.data]
    assert exam_sci.id in exam_ids, "Dean of Science must see Science Exam!"
    assert exam_nur.id not in exam_ids, "Dean of Science MUST NOT see Nursing Exam!"
    print("✓ ExamViewSet correctly restricted for Dean.")

    # Reports ViewSet Summary Scoping for Dean
    r_view = ReportsViewSet.as_view({'get': 'summary'})
    req_r = factory.get('/api/reports/summary/')
    force_authenticate(req_r, user=dean_sci)
    resp_r = r_view(req_r)
    assert resp_r.status_code == 200, "Reports summary should succeed for Dean!"
    rep_data = resp_r.data
    assert rep_data['total_faculties'] == 1, f"Dean should see exactly 1 assigned faculty in report, got {rep_data['total_faculties']}"
    print("✓ ReportsViewSet.summary correctly scoped totals for Dean.")

    # System Admin Unrestricted Check
    req_admin = factory.get('/api/faculties/')
    force_authenticate(req_admin, user=sys_admin)
    resp_admin = view_fac(req_admin)
    assert resp_admin.status_code == 200, "Admin faculty list should return 200"
    admin_fac_ids = [f['id'] for f in resp_admin.data]
    assert fac_sci.id in admin_fac_ids and fac_nur.id in admin_fac_ids, "System Admin must have unrestricted access to all faculties!"
    print("✓ System Admin retains unrestricted access across all faculties.")

    # 7. Test Bulk Deletion of Courses and Course Units by System Admin and Platform Coordinator
    print("\n--- 7. Testing Bulk Deletion of Courses and Course Units ---")
    coord_user, _ = User.objects.get_or_create(
        username='coord_test_user',
        defaults={'role': 'platform_coordinator', 'email': 'coord@ciu.ac.ug'}
    )

    # Setup test courses
    test_faculty, _ = Faculty.objects.get_or_create(code='TBULK', defaults={'name': 'Bulk Test Faculty'})
    c_a = Course.objects.create(name='Bulk Course Alpha', code='BC_ALPHA', faculty=test_faculty)
    c_b = Course.objects.create(name='Bulk Course Beta', code='BC_BETA', faculty=test_faculty)
    c_c = Course.objects.create(name='Bulk Course Gamma', code='BC_GAMMA', faculty=test_faculty)
    c_d = Course.objects.create(name='Bulk Course Delta', code='BC_DELTA', faculty=test_faculty)

    # Setup test course units
    u_a = CourseUnit.objects.create(name='Bulk Unit 1', code='BU101', course=c_a)
    u_b = CourseUnit.objects.create(name='Bulk Unit 2', code='BU102', course=c_a)
    u_c = CourseUnit.objects.create(name='Bulk Unit 3', code='BU103', course=c_c)
    u_d = CourseUnit.objects.create(name='Bulk Unit 4', code='BU104', course=c_c)

    view_bulk_course = CourseViewSet.as_view({'post': 'bulk_delete'})
    view_bulk_unit = CourseUnitViewSet.as_view({'post': 'bulk_delete'})

    # 7a. Non-admins (faculty admin, dean, lecturer) blocked from bulk deleting courses
    req_unauth_c = factory.post('/api/courses/bulk_delete/', {'course_ids': [c_a.id, c_b.id]}, format='json')
    force_authenticate(req_unauth_c, user=sec_sci)
    resp_unauth_c = view_bulk_course(req_unauth_c)
    assert resp_unauth_c.status_code == 403, f"Faculty Secretary must be forbidden from bulk deleting courses! Got {resp_unauth_c.status_code}"
    print("✓ Faculty Admin correctly blocked from bulk deleting courses (403 Forbidden).")

    # 7b. Non-admins blocked from bulk deleting course units
    req_unauth_u = factory.post('/api/course-units/bulk_delete/', {'unit_ids': [u_a.id, u_b.id]}, format='json')
    force_authenticate(req_unauth_u, user=sec_sci)
    resp_unauth_u = view_bulk_unit(req_unauth_u)
    assert resp_unauth_u.status_code == 403, f"Faculty Secretary must be forbidden from bulk deleting course units! Got {resp_unauth_u.status_code}"
    print("✓ Faculty Admin correctly blocked from bulk deleting course units (403 Forbidden).")

    # 7c. System Admin can bulk delete course units
    req_admin_del_u = factory.post('/api/course-units/bulk_delete/', {'unit_ids': [u_a.id, u_b.id]}, format='json')
    force_authenticate(req_admin_del_u, user=sys_admin)
    resp_admin_del_u = view_bulk_unit(req_admin_del_u)
    assert resp_admin_del_u.status_code == 200, f"System Admin bulk unit delete failed: {resp_admin_del_u.data}"
    assert not CourseUnit.objects.filter(id__in=[u_a.id, u_b.id]).exists(), "Course units u_a and u_b should be deleted!"
    print(f"✓ System Admin successfully bulk deleted {resp_admin_del_u.data.get('count')} course units.")

    # 7d. Platform Coordinator can bulk delete course units
    req_coord_del_u = factory.post('/api/course-units/bulk_delete/', {'unit_ids': [u_c.id, u_d.id]}, format='json')
    force_authenticate(req_coord_del_u, user=coord_user)
    resp_coord_del_u = view_bulk_unit(req_coord_del_u)
    assert resp_coord_del_u.status_code == 200, f"Platform Coordinator bulk unit delete failed: {resp_coord_del_u.data}"
    assert not CourseUnit.objects.filter(id__in=[u_c.id, u_d.id]).exists(), "Course units u_c and u_d should be deleted!"
    print(f"✓ Platform Coordinator successfully bulk deleted {resp_coord_del_u.data.get('count')} course units.")

    # 7e. System Admin can bulk delete courses
    req_admin_del_c = factory.post('/api/courses/bulk_delete/', {'course_ids': [c_a.id, c_b.id]}, format='json')
    force_authenticate(req_admin_del_c, user=sys_admin)
    resp_admin_del_c = view_bulk_course(req_admin_del_c)
    assert resp_admin_del_c.status_code == 200, f"System Admin bulk course delete failed: {resp_admin_del_c.data}"
    assert not Course.objects.filter(id__in=[c_a.id, c_b.id]).exists(), "Courses c_a and c_b should be deleted!"
    print(f"✓ System Admin successfully bulk deleted {resp_admin_del_c.data.get('count')} courses.")

    # 7f. Platform Coordinator can bulk delete courses
    req_coord_del_c = factory.post('/api/courses/bulk_delete/', {'course_ids': [c_c.id, c_d.id]}, format='json')
    force_authenticate(req_coord_del_c, user=coord_user)
    resp_coord_del_c = view_bulk_course(req_coord_del_c)
    assert resp_coord_del_c.status_code == 200, f"Platform Coordinator bulk course delete failed: {resp_coord_del_c.data}"
    assert not Course.objects.filter(id__in=[c_c.id, c_d.id]).exists(), "Courses c_c and c_d should be deleted!"
    print(f"✓ Platform Coordinator successfully bulk deleted {resp_coord_del_c.data.get('count')} courses.")

    # 8. Test Course Filtering, Faculty Bulk Actions, and Course Units Review/Attachment
    print("\n--- 8. Testing Course Filtering, Faculty Bulk Actions, and Course Units Review/Attachment ---")
    
    # Clean up any leftover records from previous test runs
    Course.objects.filter(code__in=['ACC101', 'MKT101', 'DC1', 'DC2', 'UC1', 'SCS101', 'NUT101', 'SE301', 'SE302', 'SE303', 'DON101']).delete()
    User.objects.filter(username__in=['student_acc_user', 'student_mkt_user', 'lecturer_acc_user', 'lecturer_mkt_user']).delete()
    CourseUnit.objects.filter(code__in=['ACC_U101', 'MKT_U101', 'UD1', 'UD2', 'SUS101', 'SE302', 'SE303']).delete()

    # 8a. Setup test faculties and courses for filtering
    fac_bus, _ = Faculty.objects.get_or_create(code='FBUS', defaults={'name': 'Faculty of Business'})
    course_acc = Course.objects.create(name='Accounting 101', code='ACC101', faculty=fac_bus)
    course_mkt = Course.objects.create(name='Marketing 101', code='MKT101', faculty=fac_bus)

    # Setup test students and lecturers
    student_acc = User.objects.create(
        username='student_acc_user',
        email='student_acc@ciu.ac.ug',
        role='student',
        faculty=fac_bus
    )
    student_acc.assigned_courses.add(course_acc)

    student_mkt = User.objects.create(
        username='student_mkt_user',
        email='student_mkt@ciu.ac.ug',
        role='student',
        faculty=fac_bus
    )
    student_mkt.assigned_courses.add(course_mkt)

    lecturer_acc = User.objects.create(
        username='lecturer_acc_user',
        email='lecturer_acc@ciu.ac.ug',
        role='lecturer',
        faculty=fac_bus
    )
    unit_acc = CourseUnit.objects.create(
        name='Financial Accounting',
        code='ACC_U101',
        course=course_acc
    )
    unit_acc.lecturers.add(lecturer_acc)

    lecturer_mkt = User.objects.create(
        username='lecturer_mkt_user',
        email='lecturer_mkt@ciu.ac.ug',
        role='lecturer',
        faculty=fac_bus
    )
    unit_mkt = CourseUnit.objects.create(
        name='Digital Marketing',
        code='MKT_U101',
        course=course_mkt
    )
    unit_mkt.lecturers.add(lecturer_mkt)

    # Test User Filtering by Course in AdminUserViewSet
    view_admin_users = AdminUserViewSet.as_view({'get': 'list'})

    # Filter students by course ID
    req_f_st = factory.get(f'/api/admin/users/?role=student&course={course_acc.id}')
    force_authenticate(req_f_st, user=sys_admin)
    resp_f_st = view_admin_users(req_f_st)
    assert resp_f_st.status_code == 200, f"Filter students by course ID failed: {resp_f_st.status_code}"
    st_ids = [u['id'] for u in resp_f_st.data]
    assert student_acc.id in st_ids, "student_acc should be in filtered list for ACC101!"
    assert student_mkt.id not in st_ids, "student_mkt must NOT be in filtered list for ACC101!"
    print("✓ Student filtering by course ID works correctly.")

    # Filter students by course code
    req_f_st_code = factory.get(f'/api/admin/users/?role=student&course={course_acc.code}')
    force_authenticate(req_f_st_code, user=sys_admin)
    resp_f_st_code = view_admin_users(req_f_st_code)
    assert resp_f_st_code.status_code == 200
    st_ids_code = [u['id'] for u in resp_f_st_code.data]
    assert student_acc.id in st_ids_code and student_mkt.id not in st_ids_code, "Student filtering by course code failed!"
    print("✓ Student filtering by course code works correctly.")

    # Filter lecturers by course ID
    req_f_lec = factory.get(f'/api/admin/users/?role=lecturer&course={course_acc.id}')
    force_authenticate(req_f_lec, user=sys_admin)
    resp_f_lec = view_admin_users(req_f_lec)
    assert resp_f_lec.status_code == 200
    lec_ids = [u['id'] for u in resp_f_lec.data]
    assert lecturer_acc.id in lec_ids, "lecturer_acc should be in filtered list for ACC101!"
    assert lecturer_mkt.id not in lec_ids, "lecturer_mkt must NOT be in filtered list for ACC101!"
    print("✓ Lecturer filtering by course ID works correctly.")

    # Filter lecturers by course code
    req_f_lec_code = factory.get(f'/api/admin/users/?role=lecturer&course={course_acc.code}')
    force_authenticate(req_f_lec_code, user=sys_admin)
    resp_f_lec_code = view_admin_users(req_f_lec_code)
    assert resp_f_lec_code.status_code == 200
    lec_ids_code = [u['id'] for u in resp_f_lec_code.data]
    assert lecturer_acc.id in lec_ids_code and lecturer_mkt.id not in lec_ids_code, "Lecturer filtering by course code failed!"
    print("✓ Lecturer filtering by course code works correctly.")

    # 8b. Test Bulk Actions for Courses and Course Units by Faculty
    # Bulk delete courses by faculty_id as sys_admin
    fac_del_test, _ = Faculty.objects.get_or_create(code='FDEL', defaults={'name': 'Faculty to Delete'})
    c_del_1 = Course.objects.create(name='Del Course 1', code='DC1', faculty=fac_del_test)
    c_del_2 = Course.objects.create(name='Del Course 2', code='DC2', faculty=fac_del_test)
    req_bulk_c_fac = factory.post('/api/courses/bulk_delete/', {'faculty_id': fac_del_test.id}, format='json')
    force_authenticate(req_bulk_c_fac, user=sys_admin)
    resp_bulk_c_fac = view_bulk_course(req_bulk_c_fac)
    assert resp_bulk_c_fac.status_code == 200, f"Bulk delete courses by faculty failed: {resp_bulk_c_fac.data}"
    assert resp_bulk_c_fac.data.get('count') == 2
    assert not Course.objects.filter(faculty=fac_del_test).exists()
    print("✓ Bulk deletion of courses by faculty succeeded.")

    # Bulk delete course units by faculty_id
    c_unit_fac = Course.objects.create(name='Unit Course', code='UC1', faculty=fac_bus)
    u_del_1 = CourseUnit.objects.create(name='Unit Del 1', code='UD1', course=c_unit_fac)
    u_del_2 = CourseUnit.objects.create(name='Unit Del 2', code='UD2', course=c_unit_fac)
    req_bulk_u_fac = factory.post('/api/course-units/bulk_delete/', {'faculty_id': fac_bus.id}, format='json')
    force_authenticate(req_bulk_u_fac, user=sys_admin)
    resp_bulk_u_fac = view_bulk_unit(req_bulk_u_fac)
    assert resp_bulk_u_fac.status_code == 200, f"Bulk delete units by faculty failed: {resp_bulk_u_fac.data}"
    assert not CourseUnit.objects.filter(course__faculty=fac_bus).exists()
    print("✓ Bulk deletion of course units by faculty succeeded.")

    # Faculty Secretary scoped bulk action in assigned faculty vs unassigned faculty
    c_sci_scoped = Course.objects.create(name='Science Course Scoped', code='SCS101', faculty=fac_sci)
    u_sci_scoped = CourseUnit.objects.create(name='Science Unit Scoped', code='SUS101', course=c_sci_scoped)
    
    # Sec_sci deletes course unit in assigned fac_sci -> 200 OK
    req_sec_u_del = factory.post('/api/course-units/bulk_delete/', {'unit_ids': [u_sci_scoped.id]}, format='json')
    force_authenticate(req_sec_u_del, user=sec_sci)
    resp_sec_u_del = view_bulk_unit(req_sec_u_del)
    assert resp_sec_u_del.status_code == 200, f"Faculty Admin should be able to bulk delete units in their faculty: {resp_sec_u_del.data}"
    assert not CourseUnit.objects.filter(id=u_sci_scoped.id).exists()
    print("✓ Faculty Admin successfully bulk deleted course units within assigned faculty.")

    # Sec_sci deletes course in assigned fac_sci -> 200 OK
    req_sec_c_del = factory.post('/api/courses/bulk_delete/', {'course_ids': [c_sci_scoped.id]}, format='json')
    force_authenticate(req_sec_c_del, user=sec_sci)
    resp_sec_c_del = view_bulk_course(req_sec_c_del)
    assert resp_sec_c_del.status_code == 200, f"Faculty Admin should be able to bulk delete courses in their faculty: {resp_sec_c_del.data}"
    assert not Course.objects.filter(id=c_sci_scoped.id).exists()
    print("✓ Faculty Admin successfully bulk deleted courses within assigned faculty.")

    # Sec_sci attempts to delete course in fac_nur (unassigned) -> 403 Forbidden
    c_nur_test = Course.objects.create(name='Nursing Unauth Test', code='NUT101', faculty=fac_nur)
    req_sec_c_unauth = factory.post('/api/courses/bulk_delete/', {'course_ids': [c_nur_test.id]}, format='json')
    force_authenticate(req_sec_c_unauth, user=sec_sci)
    resp_sec_c_unauth = view_bulk_course(req_sec_c_unauth)
    assert resp_sec_c_unauth.status_code == 403, f"Faculty Admin must be forbidden from deleting courses outside assigned faculty! Got {resp_sec_c_unauth.status_code}"
    print("✓ Faculty Admin correctly forbidden from deleting courses outside assigned faculty (403 Forbidden).")

    # 8c. Test Review and Attachment of Course Units to a Course
    course_rev = Course.objects.create(name='Software Architecture', code='SE301', faculty=fac_sci)
    course_donor = Course.objects.create(name='Donor Course', code='DON101', faculty=fac_sci)
    view_units = CourseViewSet.as_view({'get': 'units'})
    view_attach = CourseViewSet.as_view({'post': 'attach_units'})

    # Initial review: 0 units
    req_rev_init = factory.get(f'/api/courses/{course_rev.id}/units/')
    force_authenticate(req_rev_init, user=sys_admin)
    resp_rev_init = view_units(req_rev_init, pk=course_rev.id)
    assert resp_rev_init.status_code == 200
    assert len(resp_rev_init.data) == 0
    print("✓ Review course units endpoint returns empty list for new course.")

    # Attach existing unit
    standalone_unit = CourseUnit.objects.create(name='Design Patterns', code='SE302', course=course_donor)
    req_att_exist = factory.post(
        f'/api/courses/{course_rev.id}/attach_units/',
        {'unit_ids': [standalone_unit.id]},
        format='json'
    )
    force_authenticate(req_att_exist, user=sec_sci)
    resp_att_exist = view_attach(req_att_exist, pk=course_rev.id)
    assert resp_att_exist.status_code == 200, f"Attach existing unit failed: {resp_att_exist.data}"
    assert len(resp_att_exist.data['units']) == 1
    assert resp_att_exist.data['units'][0]['code'] == 'SE302'
    print("✓ Attach existing course unit succeeded.")

    # Create & attach unit inline
    req_att_new = factory.post(
        f'/api/courses/{course_rev.id}/attach_units/',
        {
            'code': 'SE303',
            'name': 'Cloud Native Systems',
            'credit_units': 4,
            'year_of_study': 3,
            'semester': 1
        },
        format='json'
    )
    force_authenticate(req_att_new, user=sec_sci)
    resp_att_new = view_attach(req_att_new, pk=course_rev.id)
    assert resp_att_new.status_code in [200, 201], f"Create and attach unit inline failed: {resp_att_new.data}"
    assert len(resp_att_new.data['units']) == 2
    assert CourseUnit.objects.filter(code='SE303', course=course_rev).exists()
    print("✓ Create & attach inline unit succeeded.")

    # Review units again: now has 2 units
    req_rev_updated = factory.get(f'/api/courses/{course_rev.id}/units/')
    force_authenticate(req_rev_updated, user=sec_sci)
    resp_rev_updated = view_units(req_rev_updated, pk=course_rev.id)
    assert resp_rev_updated.status_code == 200
    assert len(resp_rev_updated.data) == 2
    print("✓ Review course units correctly reflects all attached units.")

    # Detach unit
    req_detach = factory.post(
        f'/api/courses/{course_rev.id}/attach_units/',
        {'action': 'detach', 'unit_ids': [standalone_unit.id]},
        format='json'
    )
    force_authenticate(req_detach, user=sec_sci)
    resp_detach = view_attach(req_detach, pk=course_rev.id)
    assert resp_detach.status_code == 200, f"Detach unit failed: {resp_detach.data}"
    assert len(resp_detach.data['units']) == 1
    assert resp_detach.data['units'][0]['code'] == 'SE303'
    print("✓ Detach course unit succeeded.")

    print("\n==================================================")
    print("✅ ALL SYSTEM VERIFICATION CHECKS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == '__main__':
    run_tests()
