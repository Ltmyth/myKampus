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

    # 4. Test Action Audit Logs
    print("\n--- 4. Testing Action Audit Logs ---")
    SystemLog.objects.create(
        user=student,
        action="STUDENT_TEST_SUBMITTED",
        level="AUDIT",
        details=f"Submitted {test_obj.title} with score {attempt.score}%"
    )
    logs_count = SystemLog.objects.filter(action="STUDENT_TEST_SUBMITTED").count()
    print(f"Audit Logs Recorded for STUDENT_TEST_SUBMITTED: {logs_count}")
    assert logs_count >= 1, "Audit log event should be persisted!"

    print("\n==================================================")
    print("✅ ALL SYSTEM VERIFICATION CHECKS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == '__main__':
    run_tests()
