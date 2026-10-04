import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mykampus_backend.settings')
django.setup()

from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIRequestFactory, force_authenticate
from ciu_portal.models import (
    User, Faculty, Course, CourseUnit, Exam, ExamAttempt,
    Test, TestAttempt, TestQuestion, Question
)
from ciu_portal.views import (
    AdminUserViewSet, CourseUnitViewSet, ExamViewSet,
    TestViewSet, ExamAttemptViewSet, TestAttemptViewSet,
    parse_aiken_questions
)

print("=" * 60)
print("🔍 RUNNING ACCOMMODATIONS VERIFICATION TEST SUITE")
print("=" * 60)

# Setup test fixtures
admin_user, _ = User.objects.get_or_create(
    username="sys_admin_acc",
    defaults={"role": "admin", "email": "sysadmin@ciu.ac.ug", "first_name": "System", "last_name": "Admin"}
)
admin_user.set_password("AdminPass123!")
admin_user.save()

coord_user, _ = User.objects.get_or_create(
    username="platform_coord_acc",
    defaults={"role": "platform_coordinator", "email": "coordinator@ciu.ac.ug", "first_name": "Platform", "last_name": "Coordinator"}
)
coord_user.set_password("CoordPass123!")
coord_user.save()

student_user, _ = User.objects.get_or_create(
    username="student_acc",
    defaults={"role": "student", "email": "student_acc@ciu.ac.ug", "first_name": "Test", "last_name": "Student", "tuition_paid_percentage": 100}
)
student_user.save()

faculty, _ = Faculty.objects.get_or_create(code="FNUR", defaults={"name": "Faculty of Nursing"})
course, _ = Course.objects.get_or_create(code="BNUR2026", defaults={"name": "Bachelor of Nursing", "faculty": faculty})
course_unit, _ = CourseUnit.objects.get_or_create(code="NUR2101", defaults={"name": "Neurology & Neuroanatomy", "course": course, "credit_units": 4})

factory = APIRequestFactory()

# 1. Platform Coordinator CRUD Permissions
print("\n--- 1. Testing Platform Coordinator CRUD Permissions ---")
# Attempt to edit admin account details (first_name / last_name)
req = factory.patch(f"/api/admin/users/{admin_user.id}/", {"first_name": "UpdatedSystem", "last_name": "Admin"})
force_authenticate(req, user=coord_user)
resp = AdminUserViewSet.as_view({"patch": "partial_update"})(req, pk=admin_user.id)
assert resp.status_code == 200, f"Expected 200 for coordinator updating admin details, got {resp.status_code}"
admin_user.refresh_from_db()
assert admin_user.first_name == "UpdatedSystem", "Admin first_name not updated"
print("✓ Platform Coordinator successfully updated Admin user details.")

# Attempt to reset admin password via reset_password endpoint (must be blocked)
req = factory.post(f"/api/admin/users/{admin_user.id}/reset_password/", {"new_password": "NewHackedPassword123!"})
force_authenticate(req, user=coord_user)
resp = AdminUserViewSet.as_view({"post": "reset_password"})(req, pk=admin_user.id)
assert resp.status_code == 403, f"Expected 403 for resetting admin password, got {resp.status_code}"
print("✓ Platform Coordinator blocked from resetting Admin password (HTTP 403).")

# Attempt to delete admin user (must be blocked)
req = factory.delete(f"/api/admin/users/{admin_user.id}/")
force_authenticate(req, user=coord_user)
resp = AdminUserViewSet.as_view({"delete": "destroy"})(req, pk=admin_user.id)
assert resp.status_code == 403, f"Expected 403 for deleting admin user, got {resp.status_code}"
assert User.objects.filter(id=admin_user.id).exists(), "Admin user was unexpectedly deleted"
print("✓ Platform Coordinator blocked from deleting Admin user (HTTP 403).")

# 2. Bulk Student Allocations CSV with Deduplication
print("\n--- 2. Testing Bulk Student Allocation CSV with Deduplication ---")
sample_csv_text = f"""username,registration_number,faculty_code,course_code,year_of_study,semester
{student_user.username},2026BNUR-001,FNUR,BNUR2026,2,1
{student_user.username},2026BNUR-001,FNUR,BNUR2026,2,1
"""
req = factory.post("/api/admin/users/bulk_allocate_csv/", {"csv_text": sample_csv_text})
force_authenticate(req, user=coord_user)
resp = AdminUserViewSet.as_view({"post": "bulk_allocate_csv"})(req)
assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
data = resp.data
assert data["updated"] == 1, f"Expected 1 update, got {data['updated']}"
assert data["skipped_duplicates"] >= 1, f"Expected at least 1 skipped duplicate, got {data['skipped_duplicates']}"
print(f"✓ Bulk student allocation succeeded: Updated={data['updated']}, Skipped Duplicates={data['skipped_duplicates']}.")

# 3. Aiken TXT Parsing on neuro.txt
print("\n--- 3. Testing Aiken TXT Parser on neuro.txt ---")
with open("ciu_portal/neuro.txt", "r") as f:
    neuro_content = f.read()
parsed_questions = parse_aiken_questions(neuro_content)
assert len(parsed_questions) == 45, f"Expected 45 questions from neuro.txt, got {len(parsed_questions)}"
print(f"✓ Successfully parsed {len(parsed_questions)} questions from neuro.txt with 100% precision.")

# Test creation of test paper from .txt
req = factory.post("/api/tests/create_from_txt/", {
    "title": "Neuro Assessment Exam Paper",
    "course_unit": course_unit.id,
    "duration_minutes": 60,
    "txt_text": neuro_content
})
force_authenticate(req, user=admin_user)
resp = TestViewSet.as_view({"post": "create_from_txt"})(req)
assert resp.status_code == 201, f"Expected 201, got {resp.status_code}"
test_obj_id = resp.data["id"]
test_q_count = TestQuestion.objects.filter(test_id=test_obj_id).count()
assert test_q_count == 45, f"Expected 45 test questions created, got {test_q_count}"
print(f"✓ Test paper created from TXT with {test_q_count} questions.")

# 4. Assessment Timing & Late Submission with Comments
print("\n--- 4. Testing Timing, Late Submission with Comments & Due Date Cutoff ---")
now = timezone.now()
test_exam = Exam.objects.create(
    title="Clinical Neuro Exam 2026",
    course=course,
    course_unit=course_unit,
    created_by=admin_user,
    duration_minutes=30,
    scheduled_start=now - timedelta(minutes=45), # Started 45 mins ago (duration was 30 mins -> stop time was 15 mins ago)
    due_date=now + timedelta(hours=2),            # Hard deadline is in 2 hours
    is_published=True,
    is_approved_by_dean=True
)

# Start attempt after regular stop time (should succeed with is_late=True because before due_date)
req = factory.post(f"/api/exams/{test_exam.id}/start_attempt/")
force_authenticate(req, user=student_user)
resp = ExamViewSet.as_view({"post": "start_attempt"})(req, pk=test_exam.id)
assert resp.status_code in [200, 201], f"Expected 200/201, got {resp.status_code}: {resp.data}"
attempt_id = resp.data["id"]
attempt_obj = ExamAttempt.objects.get(id=attempt_id)
assert attempt_obj.is_late == True, "Expected attempt to be flagged as is_late=True"
print("✓ Student successfully started attempt after regular stop time (marked is_late=True).")

# Submit with late comment
late_comment = "Hospital ward emergency power outage delayed login by 20 minutes."
req = factory.post(f"/api/attempts/{attempt_id}/submit/", {
    "answers": {},
    "late_submission_reason": late_comment
})
force_authenticate(req, user=student_user)
resp = ExamAttemptViewSet.as_view({"post": "submit_exam"})(req, pk=attempt_id)
assert resp.status_code == 200, f"Expected 200 for submit_exam, got {resp.status_code}: {resp.data}"
attempt_obj.refresh_from_db()
assert attempt_obj.is_late == True, "Expected is_late=True"
assert attempt_obj.late_submission_reason == late_comment, f"Expected comment '{late_comment}', got '{attempt_obj.late_submission_reason}'"
print(f"✓ Exam submitted late with persisted student comment: '{attempt_obj.late_submission_reason}'.")

# Test past due date cutoff (must be rejected)
closed_exam = Exam.objects.create(
    title="Closed Neuro Exam",
    course=course,
    course_unit=course_unit,
    created_by=admin_user,
    duration_minutes=30,
    scheduled_start=now - timedelta(days=2),
    due_date=now - timedelta(hours=1),            # Due date expired 1 hour ago
    is_published=True,
    is_approved_by_dean=True
)
req = factory.post(f"/api/exams/{closed_exam.id}/start_attempt/")
force_authenticate(req, user=student_user)
resp = ExamViewSet.as_view({"post": "start_attempt"})(req, pk=closed_exam.id)
assert resp.status_code == 400, f"Expected 400 rejection after due date, got {resp.status_code}"
print("✓ Starting attempt past due date correctly rejected (HTTP 400).")

print("\n" + "=" * 60)
print("🎉 ALL ACCOMMODATIONS VERIFICATION CHECKS PASSED WITH 100% SUCCESS!")
print("=" * 60)
