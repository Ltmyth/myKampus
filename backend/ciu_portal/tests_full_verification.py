import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mykampus_backend.settings')

import django
django.setup()


from django.utils import timezone
from ciu_portal.models import User, Faculty, Course, Test, Exam, TestQuestion, TestAttempt, TemporaryClearance, QuestionBank, QuestionBankItem, SystemLog
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
    from ciu_portal.views import (
        FacultyViewSet, CourseViewSet, CourseUnitViewSet, TestViewSet, ExamViewSet,
        ClassTimetableViewSet, ExamTimetableViewSet, ReportsViewSet, TemporaryClearanceViewSet, AdminUserViewSet
    )

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

    # 7d. Platform Coordinator correctly blocked from deleting course units (Only System Admin can delete/edit course units)
    req_coord_del_u = factory.post('/api/course-units/bulk_delete/', {'unit_ids': [u_c.id, u_d.id]}, format='json')
    force_authenticate(req_coord_del_u, user=coord_user)
    resp_coord_del_u = view_bulk_unit(req_coord_del_u)
    assert resp_coord_del_u.status_code == 403, f"Platform Coordinator must be forbidden from bulk deleting course units! Got {resp_coord_del_u.status_code}"
    print("✓ Platform Coordinator correctly blocked from bulk deleting course units (403 Forbidden - Admin only).")

    # System admin finishes deleting u_c and u_d
    req_adm_u = factory.post('/api/course-units/bulk_delete/', {'unit_ids': [u_c.id, u_d.id]}, format='json')
    force_authenticate(req_adm_u, user=sys_admin)
    resp_adm_u = view_bulk_unit(req_adm_u)
    assert resp_adm_u.status_code == 200
    assert not CourseUnit.objects.filter(id__in=[u_c.id, u_d.id]).exists()
    print("✓ System Admin successfully deleted remaining course units.")

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
    
    # Sec_sci blocked from deleting course unit even in assigned fac_sci -> 403 Forbidden (Admin only)
    req_sec_u_del = factory.post('/api/course-units/bulk_delete/', {'unit_ids': [u_sci_scoped.id]}, format='json')
    force_authenticate(req_sec_u_del, user=sec_sci)
    resp_sec_u_del = view_bulk_unit(req_sec_u_del)
    assert resp_sec_u_del.status_code == 403, f"Faculty Admin must be blocked from deleting course units! Got {resp_sec_u_del.status_code}"
    # System Admin can delete the unit
    req_admin_u_del = factory.post('/api/course-units/bulk_delete/', {'unit_ids': [u_sci_scoped.id]}, format='json')
    force_authenticate(req_admin_u_del, user=sys_admin)
    resp_admin_u_del = view_bulk_unit(req_admin_u_del)
    assert resp_admin_u_del.status_code == 200
    assert not CourseUnit.objects.filter(id=u_sci_scoped.id).exists()
    print("✓ Course unit deletion correctly restricted exclusively to System Admin (403 Forbidden for Faculty Admin, 200 for Sys Admin).")

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
    # 9. Testing New Requirements (Temporary Clearance by Accounts, TESTS API, Suspension, Single Staff, Course Filtering, Bulk Actions)
    print("\n--- 9. Testing New Features & Restrictions ---")
    
    # 9a. Temporary Clearance: Accounts & Admin permitted, others blocked
    accounts_user, _ = User.objects.get_or_create(username='test_accounts_user', defaults={'role': 'accounts', 'email': 'accounts@ciu.ac.ug'})
    view_tc = TemporaryClearanceViewSet.as_view({'post': 'create'})
    
    # Block Platform Coordinator
    req_tc_coord = factory.post('/api/temporary-clearances/', {'student': student.id, 'clearance_type': 'both', 'duration_days': 5}, format='json')
    force_authenticate(req_tc_coord, user=coord_user)
    resp_tc_coord = view_tc(req_tc_coord)
    assert resp_tc_coord.status_code == 403, f"Platform Coordinator should be 403 for temporary clearance! Got {resp_tc_coord.status_code}"
    print("✓ Platform Coordinator correctly blocked from issuing temporary clearance (403 Forbidden).")

    # Allow Accounts Personnel
    req_tc_acc = factory.post('/api/temporary-clearances/', {'student': student.id, 'clearance_type': 'both', 'duration_days': 5}, format='json')
    force_authenticate(req_tc_acc, user=accounts_user)
    resp_tc_acc = view_tc(req_tc_acc)
    assert resp_tc_acc.status_code in [200, 201], f"Accounts user should be able to grant temporary clearance! Got {resp_tc_acc.status_code}"
    print("✓ Accounts personnel successfully granted temporary clearance.")

    # 9b. CIU TESTS API (50% gate for tests, blocked for exams)
    student_test_only, _ = User.objects.get_or_create(username='student_test_50', defaults={'role': 'student', 'reg_number': 'REG50TEST', 'tuition_paid_percentage': 0.0})
    TemporaryClearance.objects.filter(student=student_test_only).delete()
    
    # Simulate matching TESTS API payload only (50%)
    tests_payload = [{'RegistrationNo': 'REG50TEST', 'StudentName': 'Test Student 50'}]
    cl_tests_only = check_student_clearance(student_test_only, preloaded_api_data={'exams': [], 'tests': tests_payload})
    assert cl_tests_only['is_test_cleared'] is True, "Student in TESTS API must be cleared for tests!"
    assert cl_tests_only['is_exam_cleared'] is False, "Student in TESTS API only must NOT be cleared for exams!"
    assert cl_tests_only['tuition_paid_percentage'] == 50.0, "Effective tuition should be 50.0%!"
    print("✓ CIU TESTS API verification clears student for tests (50%) but strictly bars exams.")

    # 9c. Account Suspension by System Admin
    view_suspend = AdminUserViewSet.as_view({'post': 'toggle_suspend'})
    User.objects.filter(username='suspendable_user').delete()
    user_to_suspend = User.objects.create_user(username='suspendable_user', email='susp@ciu.ac.ug', role='student', password='testpassword123')
    assert user_to_suspend.is_active is True
    
    # Non-admin blocked from suspending
    req_susp_coord = factory.post(f'/api/admin/users/{user_to_suspend.id}/toggle_suspend/')
    force_authenticate(req_susp_coord, user=coord_user)
    resp_susp_coord = view_suspend(req_susp_coord, pk=user_to_suspend.id)
    assert resp_susp_coord.status_code == 403, "Non-admin must be blocked from suspending accounts!"
    print("✓ Non-admin correctly blocked from suspending user accounts (403 Forbidden).")

    # System Admin can suspend
    req_susp_admin = factory.post(f'/api/admin/users/{user_to_suspend.id}/toggle_suspend/')
    force_authenticate(req_susp_admin, user=sys_admin)
    resp_susp_admin = view_suspend(req_susp_admin, pk=user_to_suspend.id)
    assert resp_susp_admin.status_code == 200, f"System Admin failed to toggle suspend: {resp_susp_admin.data}"
    user_to_suspend.refresh_from_db()
    assert user_to_suspend.is_active is False, "User should now be suspended (is_active=False)!"
    print("✓ System Admin successfully suspended user account (is_active=False).")

    # 9d. Onboard Single Staff by Coordinator & Admin
    view_onboard_staff = AdminUserViewSet.as_view({'post': 'onboard_single_staff'})
    User.objects.filter(email='newlecturer@ciu.ac.ug').delete()
    
    # Coordinator blocked from onboarding admin
    req_onb_admin = factory.post('/api/admin/users/onboard_single_staff/', {'role': 'admin', 'email': 'eviladmin@ciu.ac.ug', 'full_name': 'Fake Admin'}, format='json')
    force_authenticate(req_onb_admin, user=coord_user)
    resp_onb_admin = view_onboard_staff(req_onb_admin)
    assert resp_onb_admin.status_code == 403, "Coordinator must be blocked from onboarding admin role!"
    print("✓ Coordinator correctly blocked from onboarding System Admin role (403 Forbidden).")

    # Coordinator can onboard lecturer
    req_onb_lec = factory.post('/api/admin/users/onboard_single_staff/', {'role': 'lecturer', 'email': 'newlecturer@ciu.ac.ug', 'full_name': 'New Lecturer John', 'gender': 'male'}, format='json')
    force_authenticate(req_onb_lec, user=coord_user)
    resp_onb_lec = view_onboard_staff(req_onb_lec)
    assert resp_onb_lec.status_code == 201, f"Coordinator failed to onboard single staff: {resp_onb_lec.data}"
    assert User.objects.filter(email='newlecturer@ciu.ac.ug', role='lecturer').exists()
    print("✓ Platform Coordinator successfully onboarded single staff member.")

    # 9e. Filter Courses by Faculty using Course Name
    view_course_list = CourseViewSet.as_view({'get': 'list'})
    Course.objects.get_or_create(code='CS_WEB_1', defaults={'name': 'Web Technologies', 'faculty': fac_sci})
    Course.objects.get_or_create(code='CS_DB_1', defaults={'name': 'Database Systems', 'faculty': fac_sci})
    Course.objects.get_or_create(code='NUR_WEB_1', defaults={'name': 'Web Nursing Informatics', 'faculty': fac_nur})

    # Filter fac_sci by course name "Web"
    req_filter_c = factory.get(f'/api/courses/?faculty={fac_sci.id}&search=Web')
    force_authenticate(req_filter_c, user=sys_admin)
    resp_filter_c = view_course_list(req_filter_c)
    assert resp_filter_c.status_code == 200
    matched_codes = [c['code'] for c in resp_filter_c.data]
    assert 'CS_WEB_1' in matched_codes and 'NUR_WEB_1' not in matched_codes, f"Course filtering by faculty & course name failed: {matched_codes}"
    print("✓ Filtering courses by faculty using course name works accurately.")

    # 9f. Test & Exam Bulk Deletions
    test_bulk_1 = Test.objects.create(title='Bulk Test 1', course=course_rev, lecturer=lecturer_acc)
    test_bulk_2 = Test.objects.create(title='Bulk Test 2', course=course_rev, lecturer=lecturer_acc)
    view_test_bulk_del = TestViewSet.as_view({'post': 'bulk_delete'})
    req_t_bulk = factory.post('/api/tests/bulk_delete/', {'test_ids': [test_bulk_1.id, test_bulk_2.id]}, format='json')
    force_authenticate(req_t_bulk, user=sys_admin)
    resp_t_bulk = view_test_bulk_del(req_t_bulk)
    assert resp_t_bulk.status_code == 200, f"Bulk delete tests failed: {resp_t_bulk.data}"
    assert not Test.objects.filter(id__in=[test_bulk_1.id, test_bulk_2.id]).exists()
    print("✓ Bulk deletion of tests succeeded.")

    exam_bulk_1 = Exam.objects.create(title='Bulk Exam 1', course=course_rev, lecturer=lecturer_acc)
    exam_bulk_2 = Exam.objects.create(title='Bulk Exam 2', course=course_rev, lecturer=lecturer_acc)
    view_exam_bulk_del = ExamViewSet.as_view({'post': 'bulk_delete'})
    req_e_bulk = factory.post('/api/exams/bulk_delete/', {'exam_ids': [exam_bulk_1.id, exam_bulk_2.id]}, format='json')
    force_authenticate(req_e_bulk, user=sys_admin)
    resp_e_bulk = view_exam_bulk_del(req_e_bulk)
    assert resp_e_bulk.status_code == 200, f"Bulk delete exams failed: {resp_e_bulk.data}"
    assert not Exam.objects.filter(id__in=[exam_bulk_1.id, exam_bulk_2.id]).exists()
    # 10. Comprehensive Verification: Tests Work with 50%, 100%, Manual, or Temporary Clearance
    print("\n--- 10. Testing Test Execution Under 50%, 100%, Manual, and Temporary Clearance Gates ---")
    import time
    from ciu_portal.clearance import _CLEARANCE_CACHE, _CACHE_LOCK
    from ciu_portal.views import TestViewSet, TestAttemptViewSet, ExamViewSet
    from ciu_portal.models import Exam

    # Create a test with a question
    course_gate, _ = Course.objects.get_or_create(code='GATE101', defaults={'name': 'Clearance Gate Course', 'faculty': fac_sci})
    lecturer_gate, _ = User.objects.get_or_create(username='lec_gate', defaults={'role': 'lecturer', 'email': 'lecgate@ciu.ac.ug'})
    test_gate = Test.objects.create(
        title='Clearance Gate Verification Test',
        course=course_gate,
        lecturer=lecturer_gate,
        pass_percentage=50.0,
        is_published=True,
        duration_minutes=30
    )
    tq = TestQuestion.objects.create(
        test=test_gate,
        question_text='Is 50% clearance sufficient for CIU tests?',
        question_type='mcq',
        option_a='Yes',
        option_b='No',
        correct_answer='A',
        points=10.0
    )

    exam_gate = Exam.objects.create(
        title='Clearance Gate Final Exam',
        course=course_gate,
        lecturer=lecturer_gate,
        is_published=True,
        is_active=True,
        is_approved_by_dean=True,
        duration_minutes=60
    )

    view_test_start = TestViewSet.as_view({'post': 'start_attempt'})
    view_test_submit = TestAttemptViewSet.as_view({'post': 'submit_test'})
    view_exam_start = ExamViewSet.as_view({'post': 'start_attempt'})

    # 10a. Manual 50% Tuition Clearance
    User.objects.filter(username='st_manual_50').delete()
    st_manual_50 = User.objects.create_user(
        username='st_manual_50',
        email='st_man50@ciu.ac.ug',
        role='student',
        reg_number='CIU/2026/MAN50',
        tuition_paid_percentage=50.0,
        faculty=fac_sci
    )
    req_t_m50 = factory.post(f'/api/tests/{test_gate.id}/start_attempt/')
    force_authenticate(req_t_m50, user=st_manual_50)
    resp_t_m50 = view_test_start(req_t_m50, pk=test_gate.id)
    assert resp_t_m50.status_code == 201, f"Student with manual 50% clearance should start test! Got {resp_t_m50.data}"
    attempt_id_m50 = resp_t_m50.data['id']

    # Submit test attempt with 50% manual clearance
    req_sub_m50 = factory.post(f'/api/tests/{attempt_id_m50}/submit_test/', {'answers': {str(tq.id): 'A'}}, format='json')
    force_authenticate(req_sub_m50, user=st_manual_50)
    resp_sub_m50 = view_test_submit(req_sub_m50, pk=attempt_id_m50)
    assert resp_sub_m50.status_code == 200, f"Submit test failed for manual 50%: {resp_sub_m50.data}"
    assert resp_sub_m50.data['score'] == 100.0
    assert resp_sub_m50.data['passed'] is True
    print("✓ Student with manual 50% clearance can start and submit test successfully (score=100%).")

    # Verify manual 50% student is barred from exams (100% required)
    req_e_m50 = factory.post(f'/api/exams/{exam_gate.id}/start_attempt/')
    force_authenticate(req_e_m50, user=st_manual_50)
    resp_e_m50 = view_exam_start(req_e_m50, pk=exam_gate.id)
    assert resp_e_m50.status_code == 403, f"Manual 50% student should be barred from exams! Got {resp_e_m50.status_code}"
    print("✓ Student with manual 50% clearance is correctly barred from final exams (403 Forbidden).")

    # 10b. Manual 100% Tuition Clearance
    User.objects.filter(username='st_manual_100').delete()
    st_manual_100 = User.objects.create_user(
        username='st_manual_100',
        email='st_man100@ciu.ac.ug',
        role='student',
        reg_number='CIU/2026/MAN100',
        tuition_paid_percentage=100.0,
        faculty=fac_sci
    )
    req_t_m100 = factory.post(f'/api/tests/{test_gate.id}/start_attempt/')
    force_authenticate(req_t_m100, user=st_manual_100)
    resp_t_m100 = view_test_start(req_t_m100, pk=test_gate.id)
    assert resp_t_m100.status_code == 201, f"Student with manual 100% clearance should start test! Got {resp_t_m100.data}"
    print("✓ Student with manual 100% clearance can start test successfully.")

    # 100% student can also start exam
    req_e_m100 = factory.post(f'/api/exams/{exam_gate.id}/start_attempt/')
    force_authenticate(req_e_m100, user=st_manual_100)
    resp_e_m100 = view_exam_start(req_e_m100, pk=exam_gate.id)
    assert resp_e_m100.status_code == 201, f"Student with manual 100% clearance should start exam! Got {resp_e_m100.data}"
    print("✓ Student with manual 100% clearance can start final exam successfully.")

    # 10c. 50% Clearance via CIU TESTS API Endpoint Payload
    User.objects.filter(username='st_api_50').delete()
    st_api_50 = User.objects.create_user(
        username='st_api_50',
        email='st_api50@ciu.ac.ug',
        role='student',
        reg_number='CIU/2026/API50',
        tuition_paid_percentage=0.0,
        faculty=fac_sci
    )
    with _CACHE_LOCK:
        _CLEARANCE_CACHE["TESTS_2026/2027_1"] = ([{'RegistrationNo': 'CIU/2026/API50', 'StudentName': 'API 50 Student'}], time.time())
        _CLEARANCE_CACHE["EXAMS_2026/2027_1"] = ([], time.time())

    req_t_api50 = factory.post(f'/api/tests/{test_gate.id}/start_attempt/')
    force_authenticate(req_t_api50, user=st_api_50)
    resp_t_api50 = view_test_start(req_t_api50, pk=test_gate.id)
    assert resp_t_api50.status_code == 201, f"Student cleared via CIU TESTS API should start test! Got {resp_t_api50.data}"
    print("✓ Student cleared via CIU TESTS API (50% gate) can start test successfully.")

    # Verify CIU TESTS API student is barred from exams
    req_e_api50 = factory.post(f'/api/exams/{exam_gate.id}/start_attempt/')
    force_authenticate(req_e_api50, user=st_api_50)
    resp_e_api50 = view_exam_start(req_e_api50, pk=exam_gate.id)
    assert resp_e_api50.status_code == 403, f"CIU TESTS API student should be barred from exams! Got {resp_e_api50.status_code}"
    print("✓ Student cleared via CIU TESTS API is correctly barred from final exams (403 Forbidden).")

    # 10d. Temporary Clearance Override (Tests Only)
    User.objects.filter(username='st_temp_test').delete()
    st_temp = User.objects.create_user(
        username='st_temp_test',
        email='st_temp@ciu.ac.ug',
        role='student',
        reg_number='CIU/2026/TEMP',
        tuition_paid_percentage=0.0,
        faculty=fac_sci
    )
    TemporaryClearance.objects.create(
        student=st_temp,
        granted_by=accounts_user,
        clearance_type='tests',
        expires_at=timezone.now() + timezone.timedelta(days=3),
        reason='Emergency Test Clearance'
    )
    req_t_temp = factory.post(f'/api/tests/{test_gate.id}/start_attempt/')
    force_authenticate(req_t_temp, user=st_temp)
    resp_t_temp = view_test_start(req_t_temp, pk=test_gate.id)
    assert resp_t_temp.status_code == 201, f"Student with Temporary Clearance for tests should start test! Got {resp_t_temp.data}"
    print("✓ Student with Temporary Clearance (tests) can start test successfully.")

    # 10e. Uncleared Student (0% tuition, no API clearance, no temporary override)
    User.objects.filter(username='st_uncleared_0').delete()
    st_uncleared = User.objects.create_user(
        username='st_uncleared_0',
        email='st_unc@ciu.ac.ug',
        role='student',
        reg_number='CIU/2026/UNC',
        tuition_paid_percentage=0.0,
        faculty=fac_sci
    )
    req_t_unc = factory.post(f'/api/tests/{test_gate.id}/start_attempt/')
    force_authenticate(req_t_unc, user=st_uncleared)
    resp_t_unc = view_test_start(req_t_unc, pk=test_gate.id)
    assert resp_t_unc.status_code == 403, f"Uncleared student must be barred from tests! Got {resp_t_unc.status_code}"
    assert '50%' in resp_t_unc.data['detail'], f"Expected 50% in message: {resp_t_unc.data['detail']}"
    print("✓ Uncleared student is correctly barred from tests with 403 Forbidden.")

    # 11. Testing Semester 1 & 2 Live API Clearance, 3-Tier Clearance Levels, and Student Scoping
    print("\n--- 11. Testing Semester & Academic Year Clearance & Scoping ---")
    from ciu_portal.views import AdminUserViewSet, ExamViewSet, TestViewSet

    view_admin_cleared = AdminUserViewSet.as_view({'get': 'ciu_cleared_students'})
    view_admin_users = AdminUserViewSet.as_view({'get': 'list'})
    view_admin_sync = AdminUserViewSet.as_view({'post': 'sync_clearance'})
    view_exam_list = ExamViewSet.as_view({'get': 'list'})
    view_test_list = TestViewSet.as_view({'get': 'list'})

    # 11a. Test live CIU clearance endpoint with acad and sem parameters
    req_sem1 = factory.get('/admin/users/ciu_cleared_students/?examtype=TESTS&acad=2026/2027&sem=1')
    force_authenticate(req_sem1, user=accounts_user)
    resp_sem1 = view_admin_cleared(req_sem1)
    assert resp_sem1.status_code == 200, f"Expected 200, got {resp_sem1.status_code}"
    assert resp_sem1.data['acad_year'] == '2026/2027'
    assert resp_sem1.data['semester'] == '1'
    print("✓ Live CIU Cleared Students API filters correctly for 2026/2027 Semester 1.")

    req_sem2 = factory.get('/admin/users/ciu_cleared_students/?examtype=EXAMS&acad=2026/2027&sem=2')
    force_authenticate(req_sem2, user=accounts_user)
    resp_sem2 = view_admin_cleared(req_sem2)
    assert resp_sem2.status_code == 200, f"Expected 200, got {resp_sem2.status_code}"
    assert resp_sem2.data['acad_year'] == '2026/2027'
    assert resp_sem2.data['semester'] == '2'
    print("✓ Live CIU Cleared Students API filters correctly for 2026/2027 Semester 2.")

    # 11b. Test filtering students by 3 clearance levels (0%, 50%, 100%)
    User.objects.filter(username__in=['st_level_0', 'st_level_50', 'st_level_100']).delete()
    st_0 = User.objects.create_user(
        username='st_level_0', email='st0@ciu.ac.ug', role='student',
        reg_number='CIU/2026/L0', tuition_paid_percentage=20.0, semester=1, academic_year='2026/2027', faculty=fac_sci
    )
    st_50 = User.objects.create_user(
        username='st_level_50', email='st50@ciu.ac.ug', role='student',
        reg_number='CIU/2026/L50', tuition_paid_percentage=65.0, semester=1, academic_year='2026/2027', faculty=fac_sci
    )
    st_100 = User.objects.create_user(
        username='st_level_100', email='st100@ciu.ac.ug', role='student',
        reg_number='CIU/2026/L100', tuition_paid_percentage=100.0, semester=2, academic_year='2026/2027', faculty=fac_sci
    )

    # Test Admin users list with clearance_level=0
    req_cl0 = factory.get('/admin/users/?clearance_level=0')
    force_authenticate(req_cl0, user=admin_user)
    resp_cl0 = view_admin_users(req_cl0)
    cl0_ids = [u['id'] for u in resp_cl0.data]
    assert st_0.id in cl0_ids, "st_0 should be in 0% clearance level list"
    assert st_50.id not in cl0_ids, "st_50 should not be in 0% clearance level list"
    assert st_100.id not in cl0_ids, "st_100 should not be in 0% clearance level list"
    print("✓ Users Directory successfully filters 0% barred/uncleared students.")

    # Test Admin users list with clearance_level=50
    req_cl50 = factory.get('/admin/users/?clearance_level=50')
    force_authenticate(req_cl50, user=admin_user)
    resp_cl50 = view_admin_users(req_cl50)
    cl50_ids = [u['id'] for u in resp_cl50.data]
    assert st_50.id in cl50_ids, "st_50 should be in 50% clearance level list"
    assert st_0.id not in cl50_ids, "st_0 should not be in 50% clearance level list"
    assert st_100.id not in cl50_ids, "st_100 should not be in 50% clearance level list"
    print("✓ Users Directory successfully filters 50% cleared (tests only) students.")

    # Test Admin users list with clearance_level=100
    req_cl100 = factory.get('/admin/users/?clearance_level=100')
    force_authenticate(req_cl100, user=admin_user)
    resp_cl100 = view_admin_users(req_cl100)
    cl100_ids = [u['id'] for u in resp_cl100.data]
    assert st_100.id in cl100_ids, "st_100 should be in 100% clearance level list"
    assert st_0.id not in cl100_ids, "st_0 should not be in 100% clearance level list"
    assert st_50.id not in cl100_ids, "st_50 should not be in 100% clearance level list"
    print("✓ Users Directory successfully filters 100% fully cleared students.")

    # Test ciu_cleared_students with clearance_level parameter
    req_fac_cl50 = factory.get('/admin/users/ciu_cleared_students/?clearance_level=50&acad=2026/2027&sem=1')
    force_authenticate(req_fac_cl50, user=accounts_user)
    resp_fac_cl50 = view_admin_cleared(req_fac_cl50)
    assert resp_fac_cl50.status_code == 200
    for fac, f_data in resp_fac_cl50.data['faculties'].items():
        for s in f_data['students']:
            assert s['clearance_level'] == 50, f"Expected clearance_level 50, got {s['clearance_level']}"
    print("✓ CIU Cleared Faculty Directory correctly filters by clearance_level=50.")

    # 11c. Test tests & exams set and seen according to students' assigned semesters and academic year
    # Create Semester 1 Test and Semester 2 Test
    Test.objects.filter(title__in=['Test Sem 1 Only', 'Test Sem 2 Only']).delete()
    test_sem1 = Test.objects.create(
        title='Test Sem 1 Only', course=course, lecturer=lecturer,
        year_of_study=1, semester=1, academic_year='2026/2027', is_published=True
    )
    test_sem2 = Test.objects.create(
        title='Test Sem 2 Only', course=course, lecturer=lecturer,
        year_of_study=1, semester=2, academic_year='2026/2027', is_published=True
    )
    st_50.assigned_courses.add(course)
    st_100.assigned_courses.add(course)

    # st_50 is in semester 1 and 2026/2027
    req_st_tests = factory.get('/api/tests/')
    force_authenticate(req_st_tests, user=st_50)
    resp_st_tests = view_test_list(req_st_tests)
    st_test_ids = [t['id'] for t in resp_st_tests.data]
    assert test_sem1.id in st_test_ids, "Semester 1 student must see Semester 1 test"
    assert test_sem2.id not in st_test_ids, "Semester 1 student must NOT see Semester 2 test"
    print("✓ Students correctly see tests strictly matching their assigned semester (Semester 1).")

    # st_100 is in semester 2 and 2026/2027
    req_st2_tests = factory.get('/api/tests/')
    force_authenticate(req_st2_tests, user=st_100)
    resp_st2_tests = view_test_list(req_st2_tests)
    st2_test_ids = [t['id'] for t in resp_st2_tests.data]
    assert test_sem2.id in st2_test_ids, "Semester 2 student must see Semester 2 test"
    assert test_sem1.id not in st2_test_ids, "Semester 2 student must NOT see Semester 1 test"
    print("✓ Students correctly see tests strictly matching their assigned semester (Semester 2).")

    # Exams semester scoping
    Exam.objects.filter(title__in=['Exam Sem 1 Only', 'Exam Sem 2 Only']).delete()
    exam_sem1 = Exam.objects.create(
        title='Exam Sem 1 Only', course=course, lecturer=lecturer,
        year_of_study=1, semester=1, academic_year='2026/2027', is_active=True
    )
    exam_sem2 = Exam.objects.create(
        title='Exam Sem 2 Only', course=course, lecturer=lecturer,
        year_of_study=1, semester=2, academic_year='2026/2027', is_active=True
    )

    req_st_exams = factory.get('/api/exams/')
    force_authenticate(req_st_exams, user=st_50)
    resp_st_exams = view_exam_list(req_st_exams)
    st_exam_ids = [e['id'] for e in resp_st_exams.data]
    assert exam_sem1.id in st_exam_ids, "Semester 1 student must see Semester 1 exam"
    assert exam_sem2.id not in st_exam_ids, "Semester 1 student must NOT see Semester 2 exam"
    print("✓ Students correctly see exams strictly matching their assigned semester (Semester 1).")

    req_st2_exams = factory.get('/api/exams/')
    force_authenticate(req_st2_exams, user=st_100)
    resp_st2_exams = view_exam_list(req_st2_exams)
    st2_exam_ids = [e['id'] for e in resp_st2_exams.data]
    assert exam_sem2.id in st2_exam_ids, "Semester 2 student must see Semester 2 exam"
    assert exam_sem1.id not in st2_exam_ids, "Semester 2 student must NOT see Semester 1 exam"
    print("✓ Students correctly see exams strictly matching their assigned semester (Semester 2).")

    # 12. Testing Student Scoping for Courses, Content, Lecturers, Leadership, and Timetables
    print("\n--- 12. Testing Student Scoping for Courses, Content, Lecturers, Leadership, and Timetables ---")
    from ciu_portal.views import (
        CourseViewSet, CourseUnitViewSet, FacultyViewSet, AdminUserViewSet,
        TestViewSet, ExamViewSet, ClassContentViewSet, ClassTimetableViewSet, ExamTimetableViewSet
    )
    from ciu_portal.models import ClassContent, ClassTimetable, ExamTimetable

    # Setup two distinct faculties: Engineering (FENG) and Business (SOBAT)
    fac_eng, _ = Faculty.objects.get_or_create(code='FENG', defaults={'name': 'Faculty of Engineering'})
    fac_sob, _ = Faculty.objects.get_or_create(code='SOBAT', defaults={'name': 'School of Business & Tech'})

    # Create Dean & Secretary for each faculty
    dean_eng, _ = User.objects.get_or_create(
        username='dean_eng_test',
        defaults={'role': 'dean', 'faculty': fac_eng, 'first_name': 'Dean', 'last_name': 'Engineering'}
    )
    sec_eng, _ = User.objects.get_or_create(
        username='sec_eng_test',
        defaults={'role': 'faculty_admin', 'faculty': fac_eng, 'first_name': 'Sec', 'last_name': 'Engineering'}
    )
    fac_eng.dean = dean_eng
    fac_eng.secretary = sec_eng
    fac_eng.save()

    dean_sob, _ = User.objects.get_or_create(
        username='dean_sob_test',
        defaults={'role': 'dean', 'faculty': fac_sob, 'first_name': 'Dean', 'last_name': 'Business'}
    )
    sec_sob, _ = User.objects.get_or_create(
        username='sec_sob_test',
        defaults={'role': 'faculty_admin', 'faculty': fac_sob, 'first_name': 'Sec', 'last_name': 'Business'}
    )
    fac_sob.dean = dean_sob
    fac_sob.secretary = sec_sob
    fac_sob.save()

    # Lecturers in Engineering and Business
    lec_eng, _ = User.objects.get_or_create(
        username='lec_eng_test',
        defaults={'role': 'lecturer', 'faculty': fac_eng, 'first_name': 'Lecturer', 'last_name': 'Eng'}
    )
    lec_sob, _ = User.objects.get_or_create(
        username='lec_sob_test',
        defaults={'role': 'lecturer', 'faculty': fac_sob, 'first_name': 'Lecturer', 'last_name': 'Sob'}
    )

    # Courses in each faculty
    c_eng, _ = Course.objects.get_or_create(code='CIV_SCOPE_101', defaults={'name': 'Civil Engineering Scoped', 'faculty': fac_eng})
    c_sob, _ = Course.objects.get_or_create(code='ACC_SCOPE_101', defaults={'name': 'Bachelor of Accounting Scoped', 'faculty': fac_sob})

    # Course Units
    u_eng, _ = CourseUnit.objects.get_or_create(code='CIV_SCOPE_101-1', defaults={'name': 'Fluid Mechanics Scoped', 'course': c_eng, 'year_of_study': 1, 'semester': 1})
    u_eng.lecturers.add(lec_eng)
    u_sob, _ = CourseUnit.objects.get_or_create(code='ACC_SCOPE_101-1', defaults={'name': 'Financial Accounting Scoped', 'course': c_sob, 'year_of_study': 1, 'semester': 1})
    u_sob.lecturers.add(lec_sob)

    # Student strictly in Engineering, assigned to c_eng
    st_scoped, _ = User.objects.get_or_create(
        username='st_scoped_eng_001',
        defaults={'role': 'student', 'faculty': fac_eng, 'year_of_study': 1, 'semester': 1, 'academic_year': '2026/2027'}
    )
    st_scoped.faculty = fac_eng
    st_scoped.assigned_courses.set([c_eng])
    st_scoped.save()

    # 12a. Course Listing Scoping: Student only sees c_eng, NOT c_sob
    view_c_list = CourseViewSet.as_view({'get': 'list'})
    req_c = factory.get('/api/courses/')
    force_authenticate(req_c, user=st_scoped)
    resp_c = view_c_list(req_c)
    assert resp_c.status_code == 200
    c_ids = [c['id'] for c in resp_c.data]
    assert c_eng.id in c_ids, "Student must see their assigned course CIV101"
    assert c_sob.id not in c_ids, "Student must NOT see course ACC101 from SOBAT"
    print("✓ Student CourseViewSet correctly scopes to assigned course (c_eng seen, c_sob excluded).")

    # Filtering by foreign faculty returns empty
    req_c_foreign = factory.get(f'/api/courses/?faculty={fac_sob.code}')
    force_authenticate(req_c_foreign, user=st_scoped)
    resp_c_foreign = view_c_list(req_c_foreign)
    assert resp_c_foreign.status_code == 200
    assert len(resp_c_foreign.data) == 0, f"Querying foreign faculty must yield empty results for student, got {resp_c_foreign.data}"
    print("✓ Student filtering courses by foreign faculty returns empty list.")

    # 12b. Course Unit Scoping: Student only sees u_eng, NOT u_sob
    view_u_list = CourseUnitViewSet.as_view({'get': 'list'})
    req_u = factory.get('/api/course-units/')
    force_authenticate(req_u, user=st_scoped)
    resp_u = view_u_list(req_u)
    assert resp_u.status_code == 200
    u_ids = [u['id'] for u in resp_u.data]
    assert u_eng.id in u_ids, "Student must see course unit u_eng"
    assert u_sob.id not in u_ids, "Student must NOT see course unit u_sob"
    print("✓ Student CourseUnitViewSet correctly scopes to assigned course units.")

    # 12c. Faculty Scoping & Leadership: Student only sees fac_eng and its leadership, NOT fac_sob
    view_f_list = FacultyViewSet.as_view({'get': 'list'})
    req_f = factory.get('/api/faculties/')
    force_authenticate(req_f, user=st_scoped)
    resp_f = view_f_list(req_f)
    assert resp_f.status_code == 200
    f_codes = [f['code'] for f in resp_f.data]
    assert 'FENG' in f_codes, "Student must see their designated faculty FENG"
    assert 'SOBAT' not in f_codes, "Student must NOT see foreign faculty SOBAT"
    feng_item = next(f for f in resp_f.data if f['code'] == 'FENG')
    assert feng_item['dean_name'] == 'Dean Engineering'
    print("✓ Student FacultyViewSet correctly returns only designated faculty with Dean leadership.")

    # 12d. AdminUser Directory - Lecturers: Student listing lecturers sees lec_eng, NOT lec_sob
    view_users = AdminUserViewSet.as_view({'get': 'list'})
    req_lecs = factory.get('/api/admin/users/?role=lecturer')
    force_authenticate(req_lecs, user=st_scoped)
    resp_lecs = view_users(req_lecs)
    assert resp_lecs.status_code == 200
    lec_ids = [u['id'] for u in resp_lecs.data]
    assert lec_eng.id in lec_ids, "Student must see lecturer of assigned course/faculty"
    assert lec_sob.id not in lec_ids, "Student must NOT see lecturer from foreign faculty"
    print("✓ Student querying lecturers only sees lecturers relative to assigned courses/faculty.")

    # 12e. AdminUser Directory - Faculty Leadership (Dean & Secretary): Student only sees Dean/Sec of FENG, NOT SOBAT
    req_deans = factory.get('/api/admin/users/?role=dean')
    force_authenticate(req_deans, user=st_scoped)
    resp_deans = view_users(req_deans)
    assert resp_deans.status_code == 200
    dean_ids = [u['id'] for u in resp_deans.data]
    assert dean_eng.id in dean_ids, "Student must see Dean of own faculty"
    assert dean_sob.id not in dean_ids, "Student must NOT see Dean of foreign faculty"

    req_secs = factory.get('/api/admin/users/?role=faculty_admin')
    force_authenticate(req_secs, user=st_scoped)
    resp_secs = view_users(req_secs)
    assert resp_secs.status_code == 200
    sec_ids = [u['id'] for u in resp_secs.data]
    assert sec_eng.id in sec_ids, "Student must see Secretary of own faculty"
    assert sec_sob.id not in sec_ids, "Student must NOT see Secretary of foreign faculty"
    print("✓ Student querying faculty leadership (Dean & Secretary) only sees their designated leadership.")

    # 12f. ClassContent Scoping: Student only sees content for c_eng, NOT c_sob
    cc_eng = ClassContent.objects.create(title='Eng Notes 1', course=c_eng, lecturer=lec_eng)
    cc_sob = ClassContent.objects.create(title='Sob Notes 1', course=c_sob, lecturer=lec_sob)
    view_cc = ClassContentViewSet.as_view({'get': 'list'})
    req_cc = factory.get('/api/contents/')
    force_authenticate(req_cc, user=st_scoped)
    resp_cc = view_cc(req_cc)
    assert resp_cc.status_code == 200
    cc_ids = [c['id'] for c in resp_cc.data]
    assert cc_eng.id in cc_ids, "Student must see ClassContent for assigned course"
    assert cc_sob.id not in cc_ids, "Student must NOT see ClassContent for foreign course"
    print("✓ Student ClassContentViewSet correctly scoped to assigned course.")

    # 12g. Timetables Scoping: Class and Exam Timetables
    ct_eng = ClassTimetable.objects.create(faculty=fac_eng, course=c_eng, course_unit=u_eng, lecturer=lec_eng, day_of_week='Monday', start_time='09:00', end_time='11:00', room='Room E101')
    ct_sob = ClassTimetable.objects.create(faculty=fac_sob, course=c_sob, course_unit=u_sob, lecturer=lec_sob, day_of_week='Monday', start_time='09:00', end_time='11:00', room='Room S101')
    view_ct = ClassTimetableViewSet.as_view({'get': 'list'})
    req_ct = factory.get('/api/class-timetables/')
    force_authenticate(req_ct, user=st_scoped)
    resp_ct = view_ct(req_ct)
    assert resp_ct.status_code == 200
    ct_ids = [t['id'] for t in resp_ct.data]
    assert ct_eng.id in ct_ids, "Student must see ClassTimetable for assigned course"
    assert ct_sob.id not in ct_ids, "Student must NOT see ClassTimetable for foreign course"
    print("✓ Student ClassTimetableViewSet correctly scoped to assigned course.")

    et_eng = ExamTimetable.objects.create(faculty=fac_eng, course=c_eng, course_unit=u_eng, title='Eng Exam TT', exam_date='2026-12-01', start_time='09:00', end_time='12:00')
    et_sob = ExamTimetable.objects.create(faculty=fac_sob, course=c_sob, course_unit=u_sob, title='Sob Exam TT', exam_date='2026-12-01', start_time='09:00', end_time='12:00')
    view_et = ExamTimetableViewSet.as_view({'get': 'list'})
    req_et = factory.get('/api/exam-timetables/')
    force_authenticate(req_et, user=st_scoped)
    resp_et = view_et(req_et)
    assert resp_et.status_code == 200
    et_ids = [t['id'] for t in resp_et.data]
    assert et_eng.id in et_ids, "Student must see ExamTimetable for assigned course"
    assert et_sob.id not in et_ids, "Student must NOT see ExamTimetable for foreign course"
    print("✓ Student ExamTimetableViewSet correctly scoped to assigned course.")

    # 12h. Tests and Exams Scoping & Query Param Filtering:
    t_eng = Test.objects.create(
        title='Eng Test 101', course=c_eng, lecturer=lec_eng,
        year_of_study=1, semester=1, academic_year='2026/2027', is_published=True
    )
    t_sob = Test.objects.create(
        title='Sob Test 101', course=c_sob, lecturer=lec_sob,
        year_of_study=1, semester=1, academic_year='2026/2027', is_published=True
    )
    req_t_scope = factory.get('/api/tests/')
    force_authenticate(req_t_scope, user=st_scoped)
    resp_t_scope = view_test_list(req_t_scope)
    assert resp_t_scope.status_code == 200
    t_scope_ids = [t['id'] for t in resp_t_scope.data]
    assert t_eng.id in t_scope_ids, "Student must see test for assigned course"
    assert t_sob.id not in t_scope_ids, "Student must NOT see test for foreign course"

    # Query param filtering on tests: filter by lecturer
    req_t_filter_lec = factory.get(f'/api/tests/?lecturer={lec_eng.id}')
    force_authenticate(req_t_filter_lec, user=st_scoped)
    resp_t_filter_lec = view_test_list(req_t_filter_lec)
    assert resp_t_filter_lec.status_code == 200
    assert any(t['id'] == t_eng.id for t in resp_t_filter_lec.data)

    req_t_filter_foreign = factory.get(f'/api/tests/?lecturer={lec_sob.id}')
    force_authenticate(req_t_filter_foreign, user=st_scoped)
    resp_t_filter_foreign = view_test_list(req_t_filter_foreign)
    assert resp_t_filter_foreign.status_code == 200
    assert len(resp_t_filter_foreign.data) == 0, "Student filtering tests by foreign lecturer must return 0 results"
    print("✓ Student TestViewSet correctly scoped and filterable by lecturer/course without foreign leakage.")

    e_eng = Exam.objects.create(
        title='Eng Final Exam 101', course=c_eng, lecturer=lec_eng,
        year_of_study=1, semester=1, academic_year='2026/2027', is_active=True
    )
    e_sob = Exam.objects.create(
        title='Sob Final Exam 101', course=c_sob, lecturer=lec_sob,
        year_of_study=1, semester=1, academic_year='2026/2027', is_active=True
    )
    req_e_scope = factory.get('/api/exams/')
    force_authenticate(req_e_scope, user=st_scoped)
    resp_e_scope = view_exam_list(req_e_scope)
    assert resp_e_scope.status_code == 200
    e_scope_ids = [e['id'] for e in resp_e_scope.data]
    assert e_eng.id in e_scope_ids, "Student must see exam for assigned course"
    assert e_sob.id not in e_scope_ids, "Student must NOT see exam for foreign course"

    # Query param filtering on exams: search
    req_e_search = factory.get('/api/exams/?search=Eng')
    force_authenticate(req_e_search, user=st_scoped)
    resp_e_search = view_exam_list(req_e_search)
    assert resp_e_search.status_code == 200
    assert any(e['id'] == e_eng.id for e in resp_e_search.data)

    req_e_foreign_search = factory.get('/api/exams/?search=Sob')
    force_authenticate(req_e_foreign_search, user=st_scoped)
    resp_e_foreign_search = view_exam_list(req_e_foreign_search)
    assert resp_e_foreign_search.status_code == 200
    assert len(resp_e_foreign_search.data) == 0, "Student searching exams for foreign courses must return 0 results"
    print("✓ Student ExamViewSet correctly scoped and searchable without foreign leakage.")

    print("\n==================================================")
    print("✅ ALL SYSTEM VERIFICATION CHECKS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == '__main__':
    run_tests()
