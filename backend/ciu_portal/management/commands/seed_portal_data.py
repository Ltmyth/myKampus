from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import date, time, timedelta
from ciu_portal.models import (
    User, Faculty, Course, CourseUnit, Exam, Question, ExamAttempt,
    Test, TestQuestion, TestAttempt, ClassTimetable, ExamTimetable,
    ProctoringSetting, SystemLog, log_system_event
)

class Command(BaseCommand):
    help = 'Populates Clarke International University (CIU) production-grade seed data (Roles, Faculties, Courses, Course Units, Timetables, Exams, Tests, Tuition Clearances, and Audit Logs).'

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE('Seeding production portal data for Clarke International University...'))

        # 1. System Users & Roles
        admin, _ = User.objects.get_or_create(username='admin', defaults={
            'email': 'admin@ciu.ac.ug', 'first_name': 'System', 'last_name': 'Administrator', 'role': 'admin', 'tuition_paid_percentage': 100.0
        })
        admin.set_password('admin123')
        admin.role = 'admin'
        admin.save()

        dvc, _ = User.objects.get_or_create(username='dvc_nanyonga', defaults={
            'email': 'dvc@ciu.ac.ug', 'first_name': 'Dr. Rose', 'last_name': 'Nanyonga', 'role': 'dvc', 'tuition_paid_percentage': 100.0
        })
        dvc.set_password('dvc123')
        dvc.role = 'dvc'
        dvc.save()

        registrar, _ = User.objects.get_or_create(username='registrar', defaults={
            'email': 'registrar@ciu.ac.ug', 'first_name': 'Mr. Peter', 'last_name': 'Okello', 'role': 'registrar', 'tuition_paid_percentage': 100.0
        })
        registrar.set_password('registrar123')
        registrar.role = 'registrar'
        registrar.save()

        dean, _ = User.objects.get_or_create(username='dean_fst', defaults={
            'email': 'dean.fst@ciu.ac.ug', 'first_name': 'Dr. Sarah', 'last_name': 'Nabukeera', 'role': 'dean', 'tuition_paid_percentage': 100.0
        })
        dean.set_password('dean123')
        dean.role = 'dean'
        dean.save()

        secretary, _ = User.objects.get_or_create(username='sec_fst', defaults={
            'email': 'sec.fst@ciu.ac.ug', 'first_name': 'Jane', 'last_name': 'Namatovu', 'role': 'faculty_admin', 'tuition_paid_percentage': 100.0
        })
        secretary.set_password('sec123')
        secretary.role = 'faculty_admin'
        secretary.save()

        lecturer1, _ = User.objects.get_or_create(username='lecturer1', defaults={
            'email': 'john.mugisha@ciu.ac.ug', 'first_name': 'Dr. John', 'last_name': 'Mugisha', 'role': 'lecturer', 'tuition_paid_percentage': 100.0
        })
        lecturer1.set_password('lecturer123')
        lecturer1.role = 'lecturer'
        lecturer1.save()

        lecturer2, _ = User.objects.get_or_create(username='lecturer2', defaults={
            'email': 'david.kintu@ciu.ac.ug', 'first_name': 'Prof. David', 'last_name': 'Kintu', 'role': 'lecturer', 'tuition_paid_percentage': 100.0
        })
        lecturer2.set_password('lecturer123')
        lecturer2.role = 'lecturer'
        lecturer2.save()

        # Students with Tuition Clearances (100%, 75%, 35%)
        student1, _ = User.objects.get_or_create(username='student1', defaults={
            'email': 'alex.kato@ciu.ac.ug', 'first_name': 'Alex', 'last_name': 'Kato', 'role': 'student', 'tuition_paid_percentage': 100.0
        })
        student1.set_password('student123')
        student1.tuition_paid_percentage = 100.0
        student1.role = 'student'
        student1.save()

        student2, _ = User.objects.get_or_create(username='student2', defaults={
            'email': 'grace.akello@ciu.ac.ug', 'first_name': 'Grace', 'last_name': 'Akello', 'role': 'student', 'tuition_paid_percentage': 75.0
        })
        student2.set_password('student123')
        student2.tuition_paid_percentage = 75.0
        student2.role = 'student'
        student2.save()

        student3, _ = User.objects.get_or_create(username='student3', defaults={
            'email': 'brian.mukasa@ciu.ac.ug', 'first_name': 'Brian', 'last_name': 'Mukasa', 'role': 'student', 'tuition_paid_percentage': 35.0
        })
        student3.set_password('student123')
        student3.tuition_paid_percentage = 35.0
        student3.role = 'student'
        student3.save()

        # 2. Faculties
        fst, _ = Faculty.objects.get_or_create(code='FST', defaults={
            'name': 'Faculty of Science & Technology',
            'description': 'Department of Computer Science, Software Engineering, and Information Technology.',
            'dean': dean,
            'secretary': secretary
        })

        fhs, _ = Faculty.objects.get_or_create(code='FHS', defaults={
            'name': 'Faculty of Health Sciences',
            'description': 'School of Nursing, Public Health, Clinical Medicine, and Allied Health Sciences.',
        })

        fbm, _ = Faculty.objects.get_or_create(code='FBM', defaults={
            'name': 'Faculty of Business & Management',
            'description': 'Department of Accounting, Finance, Marketing, and Healthcare Management.',
        })

        # 3. Courses
        cs_course, _ = Course.objects.get_or_create(code='BIT2026', defaults={
            'name': 'BSc. Computer Information Technology',
            'faculty': fst,
            'department': 'Computer Science',
            'description': 'Undergraduate degree program in Information Technology, Enterprise Systems, and Web Engineering.'
        })

        se_course, _ = Course.objects.get_or_create(code='BSE2026', defaults={
            'name': 'BSc. Software Engineering',
            'faculty': fst,
            'department': 'Software Engineering',
            'description': 'Advanced degree focusing on cloud systems, algorithmic computing, and software quality assurance.'
        })

        nursing_course, _ = Course.objects.get_or_create(code='BSN2026', defaults={
            'name': 'BSc. Nursing Sciences',
            'faculty': fhs,
            'department': 'Nursing',
            'description': 'Professional degree program in Clinical Nursing, Patient Care, and Epidemiology.'
        })

        # 4. Course Units & Lecturer Assignments
        cu1, _ = CourseUnit.objects.get_or_create(code='BIT2101', course=cs_course, defaults={
            'name': 'Web Application Development',
            'credit_units': 4
        })
        cu1.lecturers.add(lecturer1)

        cu2, _ = CourseUnit.objects.get_or_create(code='BIT2102', course=cs_course, defaults={
            'name': 'Data Structures & Algorithms',
            'credit_units': 3
        })
        cu2.lecturers.add(lecturer1)

        cu3, _ = CourseUnit.objects.get_or_create(code='BSE2201', course=se_course, defaults={
            'name': 'Agile Software Architecture',
            'credit_units': 4
        })
        cu3.lecturers.add(lecturer1)

        cu4, _ = CourseUnit.objects.get_or_create(code='BSN1101', course=nursing_course, defaults={
            'name': 'Human Anatomy & Physiology',
            'credit_units': 5
        })
        cu4.lecturers.add(lecturer2)

        # 5. Class Timetables
        ClassTimetable.objects.get_or_create(course=cs_course, day_of_week='Monday', start_time=time(9, 0), room='Lab 3 - IT Complex', defaults={
            'faculty': fst,
            'course_unit': cu1,
            'lecturer': lecturer1,
            'end_time': time(11, 0),
            'class_type': 'lab',
            'created_by': secretary
        })

        ClassTimetable.objects.get_or_create(course=cs_course, day_of_week='Wednesday', start_time=time(11, 30), room='Lecture Hall A', defaults={
            'faculty': fst,
            'course_unit': cu2,
            'lecturer': lecturer1,
            'end_time': time(13, 30),
            'class_type': 'lecture',
            'created_by': secretary
        })

        ClassTimetable.objects.get_or_create(course=se_course, day_of_week='Tuesday', start_time=time(14, 0), room='Lab 5 - SE Hub', defaults={
            'faculty': fst,
            'course_unit': cu3,
            'lecturer': lecturer1,
            'end_time': time(16, 0),
            'class_type': 'workshop',
            'created_by': secretary
        })

        ClassTimetable.objects.get_or_create(course=nursing_course, day_of_week='Thursday', start_time=time(8, 30), room='Health Complex Lab B', defaults={
            'faculty': fhs,
            'course_unit': cu4,
            'lecturer': lecturer2,
            'end_time': time(11, 30),
            'class_type': 'lab',
            'created_by': secretary
        })

        # 6. Exam Timetables
        ExamTimetable.objects.get_or_create(title='BIT2101 Final Practical Exam', course=cs_course, exam_date=date.today() + timedelta(days=14), defaults={
            'faculty': fst,
            'course_unit': cu1,
            'start_time': time(9, 0),
            'end_time': time(12, 0),
            'venue': 'Main Computer Complex Lab 1',
            'invigilator': lecturer1,
            'created_by': registrar
        })

        # 7. Global Proctoring Setting
        ProctoringSetting.objects.get_or_create(id=1, defaults={
            'is_proctoring_enabled': True,
            'require_webcam': True,
            'strict_tab_switch_limit': 3,
            'updated_by': admin
        })

        # 8. Seed Official Exam Paper
        exam, _ = Exam.objects.get_or_create(title='End of Semester Examination 2026', course=cs_course, defaults={
            'course_unit': cu1,
            'lecturer': lecturer1,
            'duration_minutes': 60,
            'scheduled_start': timezone.now() - timedelta(minutes=5),
            'is_active': True,
            'is_approved_by_dean': True,
            'is_results_released': True
        })

        if exam.questions.count() == 0:
            Question.objects.create(
                exam=exam,
                question_text='Which HTTP status code signifies that a new server resource was created successfully?',
                option_a='200 OK',
                option_b='201 Created',
                option_c='404 Not Found',
                option_d='500 Internal Server Error',
                correct_option='B'
            )
            Question.objects.create(
                exam=exam,
                question_text='What is the primary architectural responsibility of Django URL Router?',
                option_a='Styling frontend HTML elements',
                option_b='Directing incoming HTTP requests to target view functions',
                option_c='Encrypting user credentials in database',
                option_d='Compiling client JavaScript assets',
                correct_option='B'
            )
            Question.objects.create(
                exam=exam,
                question_text='In relational database design, what does Third Normal Form (3NF) enforce?',
                option_a='Eliminates transitive dependencies',
                option_b='Allows duplicate rows',
                option_c='Disables foreign key indexing',
                option_d='Encrypts column values',
                correct_option='A'
            )

        # 9. Seed Official Test Paper
        test_item, _ = Test.objects.get_or_create(title='Continuous Assessment Test 1 (CAT)', course=cs_course, defaults={
            'course_unit': cu1,
            'lecturer': lecturer1,
            'category': 'unit_test',
            'duration_minutes': 30,
            'scheduled_start': timezone.now() - timedelta(minutes=10),
            'pass_percentage': 50.0,
            'allowed_attempts': 2,
            'is_published': True,
            'is_results_released': True
        })

        if test_item.questions.count() == 0:
            TestQuestion.objects.create(
                test=test_item,
                question_text='RESTful APIs map standard CRUD actions directly to HTTP methods GET, POST, PUT, and DELETE.',
                question_type='tf',
                option_a='True',
                option_b='False',
                correct_answer='True',
                points=1.0,
                explanation='REST API design leverages standard HTTP verbs for standardized client-server communication.'
            )
            TestQuestion.objects.create(
                test=test_item,
                question_text='Which JavaScript rendering library utilizes JSX for component layout declarations?',
                question_type='mcq',
                option_a='Angular',
                option_b='React / Next.js',
                option_c='Django Templates',
                option_d='Laravel Blade',
                correct_answer='B',
                points=2.0,
                explanation='React and Next.js use JSX syntax to express UI component rendering.'
            )

        # 10. Seed Completed Student Attempt & System Logs
        TestAttempt.objects.get_or_create(student=student1, test=test_item, attempt_number=1, defaults={
            'score': 100.0,
            'passed': True,
            'completed_at': timezone.now(),
            'tab_switches_count': 0
        })

        log_system_event(admin, "Production Portal Data Seeded & Initialized", level="AUDIT", details="Full CIU faculties, courses, timetables, fee thresholds, and proctoring controls loaded.")

        self.stdout.write(self.style.SUCCESS('\n================================================================='))
        self.stdout.write(self.style.SUCCESS('  Clarke International University Portal Production Data Ready!'))
        self.stdout.write(self.style.SUCCESS('================================================================='))
        self.stdout.write(self.style.NOTICE('Demonstration Accounts:'))
        self.stdout.write('  • System Admin:        admin / admin123')
        self.stdout.write('  • DVC / Chancellor:    dvc_nanyonga / dvc123')
        self.stdout.write('  • Academic Registrar:  registrar / registrar123')
        self.stdout.write('  • Faculty Dean (FST):  dean_fst / dean123')
        self.stdout.write('  • Faculty Secretary:   sec_fst / sec123')
        self.stdout.write('  • Senior Lecturer:     lecturer1 / lecturer123')
        self.stdout.write('  • Student (100% Fees): student1 / student123 (Full Access)')
        self.stdout.write('  • Student (75% Fees):  student2 / student123 (Tests Only, Exam Barred)')
        self.stdout.write('  • Student (35% Fees):  student3 / student123 (Barred from Tests & Exams)')
        self.stdout.write(self.style.SUCCESS('=================================================================\n'))
