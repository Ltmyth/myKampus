import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mykampus_backend.settings')

import django
django.setup()

from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIRequestFactory, force_authenticate
from ciu_portal.models import User, Faculty, Course, CourseUnit, Exam, Test, ExamAttempt, TestAttempt, ProctorSnapshot, SystemLog
from ciu_portal.views import (
    AdminUserViewSet, ExamViewSet, TestViewSet, VerifyPasswordView, ProctoringMonitorViewSet
)

def test_all():
    print("==================================================")
    print("🚀 RUNNING NEW INSTITUTIONAL & ASSESSMENT FEATURES TEST SUITE")
    print("==================================================")
    factory = APIRequestFactory()

    # Setup faculties
    fac_sci, _ = Faculty.objects.get_or_create(code="FST", defaults={"name": "Faculty of Science & Tech"})
    fac_bus, _ = Faculty.objects.get_or_create(code="FBM", defaults={"name": "Faculty of Business & Mgmt"})
    fac_med, _ = Faculty.objects.get_or_create(code="FOMS", defaults={"name": "Faculty of Medicine"})

    # Setup courses & course units
    course_cs, _ = Course.objects.get_or_create(code="BCS", defaults={"name": "Bachelor of Computer Science", "faculty": fac_sci})
    course_bba, _ = Course.objects.get_or_create(code="BBA", defaults={"name": "Bachelor of Business Admin", "faculty": fac_bus})
    course_med, _ = Course.objects.get_or_create(code="MBChB", defaults={"name": "Medicine & Surgery", "faculty": fac_med})

    cu_prog, _ = CourseUnit.objects.get_or_create(code="CS101", defaults={"name": "Intro to Programming", "course": course_cs})
    cu_acct, _ = CourseUnit.objects.get_or_create(code="BBA101", defaults={"name": "Principles of Accounting", "course": course_bba})
    cu_anat, _ = CourseUnit.objects.get_or_create(code="MED101", defaults={"name": "Human Anatomy", "course": course_med})

    # 1. Multi-faculty lecturer assignment & scoping
    print("\n--- 1. Testing Multiple Faculty & Course Unit Assignment for Lecturers ---")
    lecturer, _ = User.objects.get_or_create(
        username="CIU006",
        defaults={
            "role": "lecturer",
            "email": "ciu006@ciu.ac.ug",
            "first_name": "Dr. Sarah",
            "last_name": "Namaganda",
            "faculty": fac_sci
        }
    )
    lecturer.set_password("SecurePass123!")
    lecturer.save()
    lecturer.assigned_faculties.set([fac_sci, fac_bus])
    lecturer.assigned_course_units.set([cu_prog, cu_acct])
    lecturer.save()

    assert lecturer.assigned_faculties.count() == 2, "Lecturer should have 2 assigned faculties"
    assert lecturer.assigned_course_units.count() == 2, "Lecturer should have 2 assigned course units"
    print("✓ Lecturer CIU006 successfully assigned to multiple faculties (FST, FBM) and course units.")

    # Check that lecturer can only see content from assigned faculties (FST, FBM) and NOT FOMS
    exam_view = ExamViewSet.as_view({'get': 'list'})
    req = factory.get('/exams/')
    force_authenticate(req, user=lecturer)

    # Create exam in FST, FBM, and FOMS
    exam_fst, _ = Exam.objects.get_or_create(title="Exam FST - Intro to Programming", defaults={"course": course_cs, "course_unit": cu_prog, "duration_minutes": 60, "is_published": True, "lecturer": lecturer})
    exam_fbm, _ = Exam.objects.get_or_create(title="Exam FBM - Principles of Accounting", defaults={"course": course_bba, "course_unit": cu_acct, "duration_minutes": 60, "is_published": True, "lecturer": lecturer})
    exam_foms, _ = Exam.objects.get_or_create(title="Exam FOMS - Human Anatomy", defaults={"course": course_med, "course_unit": cu_anat, "duration_minutes": 60, "is_published": True, "lecturer": lecturer})

    resp = exam_view(req)
    data = resp.data.get('results', resp.data) if isinstance(resp.data, dict) else resp.data
    exam_titles = [e['title'] for e in data]
    assert exam_fst.title in exam_titles, "Lecturer should see FST exam"
    assert exam_fbm.title in exam_titles, "Lecturer should see FBM exam"
    assert exam_foms.title not in exam_titles, "Lecturer must NOT see FOMS exam"
    print("✓ Lecturer strictly scopes content to assigned faculties (saw FST and FBM, FOMS strictly excluded).")

    # 2. Lecturer search by username and name
    print("\n--- 2. Testing Lecturer Filtering by Name and Username (e.g. CIU006) ---")
    admin_user, _ = User.objects.get_or_create(username="sysadmin_test", defaults={"role": "admin", "email": "admin@ciu.ac.ug"})
    user_view = AdminUserViewSet.as_view({'get': 'list'})

    # Search by username CIU006
    req = factory.get('/admin/users/?search=CIU006')
    force_authenticate(req, user=admin_user)
    resp = user_view(req)
    results = resp.data.get('results', resp.data) if isinstance(resp.data, dict) else resp.data
    usernames = [u['username'] for u in results]
    assert "CIU006" in usernames, "Searching CIU006 should return Dr. Sarah"
    print("✓ Filtering lecturers by username 'CIU006' succeeded.")

    # Search by name "Namaganda"
    req = factory.get('/admin/users/?search=Namaganda')
    force_authenticate(req, user=admin_user)
    resp = user_view(req)
    results = resp.data.get('results', resp.data) if isinstance(resp.data, dict) else resp.data
    usernames = [u['username'] for u in results]
    assert "CIU006" in usernames, "Searching 'Namaganda' should return Dr. Sarah"
    print("✓ Filtering lecturers by name 'Namaganda' succeeded.")

    # 3. Automatic Course Unit name attached to Exam & Test titles
    print("\n--- 3. Testing Automatic Course Unit Name Attachment to Titles ---")
    exam_create_view = ExamViewSet.as_view({'post': 'create'})
    req = factory.post('/exams/', {
        "title": "Final Assessment",
        "course": course_cs.id,
        "course_unit": cu_prog.id,
        "duration_minutes": 120,
        "total_marks": 100,
        "pass_marks": 50,
        "is_published": True,
        "exam_type": "exam"
    }, format='json')
    force_authenticate(req, user=admin_user)
    resp = exam_create_view(req)
    assert resp.status_code == 201, f"Exam creation failed: {resp.data}"
    created_exam = Exam.objects.get(id=resp.data['id'])
    assert "Intro to Programming" in created_exam.title, f"Expected CU name in title, got: {created_exam.title}"
    print(f"✓ Exam title automatically attached course unit: '{created_exam.title}'")

    test_create_view = TestViewSet.as_view({'post': 'create'})
    req = factory.post('/tests/', {
        "title": "Midterm Quiz 1",
        "course": course_bba.id,
        "course_unit": cu_acct.id,
        "duration_minutes": 45,
        "total_marks": 50,
        "pass_marks": 25,
        "is_published": True
    }, format='json')
    force_authenticate(req, user=admin_user)
    resp = test_create_view(req)
    assert resp.status_code == 201, f"Test creation failed: {resp.data}"
    created_test = Test.objects.get(id=resp.data['id'])
    assert "Principles of Accounting" in created_test.title, f"Expected CU name in title, got: {created_test.title}"
    print(f"✓ Test title automatically attached course unit: '{created_test.title}'")

    # 4. Tuition clearance enforcement
    print("\n--- 4. Testing Strict Tuition Clearance Enforcement (Tests >= 50%, Exams = 100%) ---")
    student_uncleared, _ = User.objects.get_or_create(username="stu_0pct", defaults={"role": "student", "faculty": fac_sci, "tuition_paid_percentage": 0.0})
    student_50pct, _ = User.objects.get_or_create(username="stu_50pct", defaults={"role": "student", "faculty": fac_sci, "tuition_paid_percentage": 50.0})
    student_100pct, _ = User.objects.get_or_create(username="stu_100pct", defaults={"role": "student", "faculty": fac_sci, "tuition_paid_percentage": 100.0})

    # Prepare open exam and test
    test_gate, _ = Test.objects.get_or_create(title="Gate Test - Intro to Programming", defaults={"course": course_cs, "course_unit": cu_prog, "duration_minutes": 30, "is_published": True, "lecturer": lecturer})
    exam_gate, _ = Exam.objects.get_or_create(title="Gate Exam - Intro to Programming", defaults={"course": course_cs, "course_unit": cu_prog, "duration_minutes": 60, "is_published": True, "is_approved_by_dean": True, "lecturer": lecturer})

    test_start = TestViewSet.as_view({'post': 'start_attempt'})
    exam_start = ExamViewSet.as_view({'post': 'start_attempt'})

    # 0% student
    req = factory.post(f'/tests/{test_gate.id}/start_attempt/')
    force_authenticate(req, user=student_uncleared)
    assert test_start(req, pk=test_gate.id).status_code == 403, "0% student should be barred from tests"

    req = factory.post(f'/exams/{exam_gate.id}/start_attempt/')
    force_authenticate(req, user=student_uncleared)
    assert exam_start(req, pk=exam_gate.id).status_code == 403, "0% student should be barred from exams"
    print("✓ Student with 0% clearance barred from both tests and exams (403 Forbidden).")

    # 50% student
    req = factory.post(f'/tests/{test_gate.id}/start_attempt/')
    force_authenticate(req, user=student_50pct)
    assert test_start(req, pk=test_gate.id).status_code in [200, 201], "50% student should be allowed to take tests"

    req = factory.post(f'/exams/{exam_gate.id}/start_attempt/')
    force_authenticate(req, user=student_50pct)
    assert exam_start(req, pk=exam_gate.id).status_code == 403, "50% student should be barred from exams"
    print("✓ Student with 50% clearance allowed to take tests, strictly barred from final exams (403 Forbidden).")

    # 100% student
    req = factory.post(f'/exams/{exam_gate.id}/start_attempt/')
    force_authenticate(req, user=student_100pct)
    assert exam_start(req, pk=exam_gate.id).status_code in [200, 201], "100% student should be allowed to take exams"
    print("✓ Student with 100% clearance successfully launches final exam.")

    # 5. Proctoring real-time tab switch logging
    print("\n--- 5. Testing Proctoring Real-Time Tab Switch Security Alerts ---")
    proc_view = ProctoringMonitorViewSet.as_view({'post': 'log_tab_switch'})
    req = factory.post('/proctoring-monitor/log_tab_switch/', {
        "exam_id": exam_gate.id,
        "tab_switches": 2,
        "title": "Gate Exam - Intro to Programming"
    }, format='json')
    force_authenticate(req, user=student_100pct)
    resp = proc_view(req)
    assert resp.status_code == 200, f"Failed to log tab switch: {resp.data}"
    assert resp.data['tab_switches'] == 2
    # Verify SystemLog was created
    event = SystemLog.objects.filter(action="TAB_SWITCH_SECURITY_ALERT", user=student_100pct).latest('timestamp')
    assert "switched browser tab/window" in event.details
    print("✓ Proctoring tab switch logged in real time and recorded to institutional audit log.")

    # 6. Idle 5-minute password prompt re-verification
    print("\n--- 6. Testing Non-Student Idle Password Re-Authentication View ---")
    verify_view = VerifyPasswordView.as_view()

    # Wrong password
    req = factory.post('/auth/verify_password/', {"password": "WrongPassword!"}, format='json')
    force_authenticate(req, user=lecturer)
    resp = verify_view(req)
    assert resp.status_code == 400
    assert resp.data['verified'] is False

    # Correct password
    req = factory.post('/auth/verify_password/', {"password": "SecurePass123!"}, format='json')
    force_authenticate(req, user=lecturer)
    resp = verify_view(req)
    assert resp.status_code == 200
    assert resp.data['verified'] is True
    print("✓ Idle session password re-authentication successfully validates authorized users.")

    print("\n==================================================")
    print("✅ ALL 6 NEW FEATURE VERIFICATION SUITES PASSED PERFECTLY!")
    print("==================================================")

if __name__ == "__main__":
    test_all()
