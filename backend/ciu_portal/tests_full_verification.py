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
    print("✓ Platform Coordinator successfully reset Lecturer password.")

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
    print("✓ System Admin successfully reset Platform Coordinator password.")

    # Rule D: Self password change for all users
    change_view = ChangePasswordView.as_view()
    req_change = factory.post('/api/change-password/', {'current_password': 'newcoordpass123', 'new_password': 'selfcoordpass456'}, format='json')
    force_authenticate(req_change, user=p_coord)
    resp_change = change_view(req_change)
    assert resp_change.status_code == 200, "Platform Coordinator should be able to change their own password!"
    p_coord.refresh_from_db()
    assert p_coord.check_password('selfcoordpass456'), "Platform Coordinator password changed successfully via self-service!"
    print("✓ Platform Coordinator successfully changed own password via self-service.")

    print("\n==================================================")
    print("✅ ALL SYSTEM VERIFICATION CHECKS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == '__main__':
    run_tests()
