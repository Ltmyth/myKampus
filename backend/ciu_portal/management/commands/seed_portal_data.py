from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import date, time, timedelta
from ciu_portal.models import (
    User, Faculty, Course, CourseUnit, Exam, Question, ExamAttempt,
    Test, TestQuestion, TestAttempt, ClassTimetable, ExamTimetable,
    ProctoringSetting, SystemLog, log_system_event
)

class Command(BaseCommand):
    help = 'Populates Clarke International University (CIU) production-grade seed data (Roles, Faculties, Executive Officers, Deans, Secretaries, Courses, Course Units, Real Date Timetables, Exams, Tests, Tuition Clearances, and Audit Logs).'

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE('Seeding production portal data for Clarke International University...'))

        # 1. System Administrative & Executive Officers
        admin, _ = User.objects.get_or_create(username='admin', defaults={
            'email': 'admin@ciu.ac.ug', 'first_name': 'System', 'last_name': 'Administrator', 'role': 'admin', 'tuition_paid_percentage': 100.0
        })
        admin.set_password('admin123')
        admin.role = 'admin'
        admin.save()

        vc, _ = User.objects.get_or_create(username='vc_nanyonga', defaults={
            'email': 'vc@ciu.ac.ug', 'first_name': 'Ass. Prof. Rose Clarke', 'last_name': 'Nanyonga', 'role': 'vc', 'tuition_paid_percentage': 100.0
        })
        vc.set_password('vc123')
        vc.role = 'vc'
        vc.save()

        dvc, _ = User.objects.get_or_create(username='dvc_singh', defaults={
            'email': 'dvc@ciu.ac.ug', 'first_name': 'Dr. Milka', 'last_name': 'Singh', 'role': 'dvc', 'tuition_paid_percentage': 100.0
        })
        dvc.set_password('dvc123')
        dvc.role = 'dvc'
        dvc.save()

        registrar, _ = User.objects.get_or_create(username='registrar_ayot', defaults={
            'email': 'registrar@ciu.ac.ug', 'first_name': 'Evelyn Grace', 'last_name': 'Ayot', 'role': 'registrar', 'tuition_paid_percentage': 100.0
        })
        registrar.set_password('registrar123')
        registrar.role = 'registrar'
        registrar.save()

        # 2. Deans & Faculty Secretaries for all 4 CIU Faculties
        # SOBAT: School of Business and Applied Technology
        dean_sobat, _ = User.objects.get_or_create(username='dean_sobat', defaults={
            'email': 'margaret.kareyo@ciu.ac.ug', 'first_name': 'Ass. Prof. Margaret', 'last_name': 'Kareyo', 'role': 'dean', 'tuition_paid_percentage': 100.0
        })
        dean_sobat.set_password('dean123')
        dean_sobat.role = 'dean'
        dean_sobat.save()

        sec_sobat, _ = User.objects.get_or_create(username='sec_sobat', defaults={
            'email': 'lillian.achola@ciu.ac.ug', 'first_name': 'Lillian', 'last_name': 'Achola', 'role': 'faculty_admin', 'tuition_paid_percentage': 100.0
        })
        sec_sobat.set_password('sec123')
        sec_sobat.role = 'faculty_admin'
        sec_sobat.save()

        # SONM: School of Nursing and Midwifery
        dean_sonm, _ = User.objects.get_or_create(username='dean_sonm', defaults={
            'email': 'agnes.agwang@ciu.ac.ug', 'first_name': 'Agnes', 'last_name': 'Agwang', 'role': 'dean', 'tuition_paid_percentage': 100.0
        })
        dean_sonm.set_password('dean123')
        dean_sonm.role = 'dean'
        dean_sonm.save()

        sec_sonm, _ = User.objects.get_or_create(username='sec_sonm', defaults={
            'email': 'doreen.basemera@ciu.ac.ug', 'first_name': 'Doreen Agnes', 'last_name': 'Basemera', 'role': 'faculty_admin', 'tuition_paid_percentage': 100.0
        })
        sec_sonm.set_password('sec123')
        sec_sonm.role = 'faculty_admin'
        sec_sonm.save()

        # SOPH: School of Public Health
        dean_soph, _ = User.objects.get_or_create(username='dean_soph', defaults={
            'email': 'john.alege@ciu.ac.ug', 'first_name': 'John Bosco', 'last_name': 'Alege', 'role': 'dean', 'tuition_paid_percentage': 100.0
        })
        dean_soph.set_password('dean123')
        dean_soph.role = 'dean'
        dean_soph.save()

        sec_soph, _ = User.objects.get_or_create(username='sec_soph', defaults={
            'email': 'anitah.mwebaze@ciu.ac.ug', 'first_name': 'Anitah', 'last_name': 'Mwebaze', 'role': 'faculty_admin', 'tuition_paid_percentage': 100.0
        })
        sec_soph.set_password('sec123')
        sec_soph.role = 'faculty_admin'
        sec_soph.save()

        # IAH: Institute of Allied Health
        dean_iah, _ = User.objects.get_or_create(username='dean_iah', defaults={
            'email': 'john.okiria@ciu.ac.ug', 'first_name': 'Prof. John Charles', 'last_name': 'Okiria', 'role': 'dean', 'tuition_paid_percentage': 100.0
        })
        dean_iah.set_password('dean123')
        dean_iah.role = 'dean'
        dean_iah.save()

        sec_iah, _ = User.objects.get_or_create(username='sec_iah', defaults={
            'email': 'emilly.naiwumbwe@ciu.ac.ug', 'first_name': 'Emilly', 'last_name': 'Naiwumbwe', 'role': 'faculty_admin', 'tuition_paid_percentage': 100.0
        })
        sec_iah.set_password('sec123')
        sec_iah.role = 'faculty_admin'
        sec_iah.save()

        # Lecturers
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

        # 3. Seed Official CIU Faculties
        sobat, _ = Faculty.objects.get_or_create(code='SOBAT', defaults={
            'name': 'School of Business and Applied Technology',
            'description': 'Department of Computing, Software Engineering, Information Technology, and Business Management.',
            'dean': dean_sobat,
            'secretary': sec_sobat
        })
        sobat.dean = dean_sobat
        sobat.secretary = sec_sobat
        sobat.save()

        sonm, _ = Faculty.objects.get_or_create(code='SONM', defaults={
            'name': 'School of Nursing and Midwifery',
            'description': 'Department of Clinical Nursing, Patient Care, General Midwifery, and Maternal Health.',
            'dean': dean_sonm,
            'secretary': sec_sonm
        })
        sonm.dean = dean_sonm
        sonm.secretary = sec_sonm
        sonm.save()

        soph, _ = Faculty.objects.get_or_create(code='SOPH', defaults={
            'name': 'School of Public Health',
            'description': 'Department of Epidemiology, Biostatistics, Environmental Health, and Health Policy.',
            'dean': dean_soph,
            'secretary': sec_soph
        })
        soph.dean = dean_soph
        soph.secretary = sec_soph
        soph.save()

        iah, _ = Faculty.objects.get_or_create(code='IAH', defaults={
            'name': 'Institute of Allied Health',
            'description': 'Department of Medical Laboratory Technology, Clinical Pharmacy, and Radiography.',
            'dean': dean_iah,
            'secretary': sec_iah
        })
        iah.dean = dean_iah
        iah.secretary = sec_iah
        iah.save()

        # Assign students to default faculty SOBAT
        student1.faculty = sobat
        student1.save()
        student2.faculty = sobat
        student2.save()
        student3.faculty = sonm
        student3.save()

        # 4. Courses
        cs_course, _ = Course.objects.get_or_create(code='BIT2026', defaults={
            'name': 'BSc. Computer Information Technology',
            'faculty': sobat,
            'department': 'Applied Computing',
            'description': 'Undergraduate degree program in Information Technology, Enterprise Systems, and Web Engineering.'
        })

        se_course, _ = Course.objects.get_or_create(code='BSE2026', defaults={
            'name': 'BSc. Software Engineering',
            'faculty': sobat,
            'department': 'Software Engineering',
            'description': 'Advanced degree focusing on cloud systems, algorithmic computing, and software quality assurance.'
        })

        nursing_course, _ = Course.objects.get_or_create(code='BSN2026', defaults={
            'name': 'BSc. Nursing Sciences',
            'faculty': sonm,
            'department': 'Nursing Care',
            'description': 'Professional degree program in Clinical Nursing, Patient Care, and Epidemiology.'
        })

        ph_course, _ = Course.objects.get_or_create(code='BPH2026', defaults={
            'name': 'BSc. Public Health',
            'faculty': soph,
            'department': 'Community Health',
            'description': 'Degree program in Epidemiology, Preventive Medicine, and Biostatistics.'
        })

        bml_course, _ = Course.objects.get_or_create(code='BML2026', defaults={
            'name': 'BSc. Medical Laboratory Science',
            'faculty': iah,
            'department': 'Laboratory Medicine',
            'description': 'Degree in Diagnostic Pathology, Clinical Microbiology, and Hematology.'
        })

        # 5. Course Units & Lecturer Assignments
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

        cu5, _ = CourseUnit.objects.get_or_create(code='BPH1101', course=ph_course, defaults={
            'name': 'Principles of Epidemiology',
            'credit_units': 3
        })
        cu5.lecturers.add(lecturer2)

        cu6, _ = CourseUnit.objects.get_or_create(code='BML1101', course=bml_course, defaults={
            'name': 'Clinical Biochemistry',
            'credit_units': 4
        })
        cu6.lecturers.add(lecturer2)

        # 6. Class Timetables WITH REAL SPECIFIC CALENDAR DATES
        base_monday = date(2026, 8, 31) # Monday, August 31, 2026
        
        ClassTimetable.objects.get_or_create(course=cs_course, day_of_week='Monday', start_time=time(9, 0), room='Lab 3 - SOBAT IT Complex', defaults={
            'faculty': sobat,
            'course_unit': cu1,
            'lecturer': lecturer1,
            'class_date': base_monday,
            'end_time': time(11, 0),
            'class_type': 'lab',
            'created_by': sec_sobat
        })

        ClassTimetable.objects.get_or_create(course=cs_course, day_of_week='Wednesday', start_time=time(11, 30), room='Lecture Hall A', defaults={
            'faculty': sobat,
            'course_unit': cu2,
            'lecturer': lecturer1,
            'class_date': base_monday + timedelta(days=2), # 2026-09-02
            'end_time': time(13, 30),
            'class_type': 'lecture',
            'created_by': sec_sobat
        })

        ClassTimetable.objects.get_or_create(course=se_course, day_of_week='Tuesday', start_time=time(14, 0), room='Lab 5 - SE Hub', defaults={
            'faculty': sobat,
            'course_unit': cu3,
            'lecturer': lecturer1,
            'class_date': base_monday + timedelta(days=1), # 2026-09-01
            'end_time': time(16, 0),
            'class_type': 'workshop',
            'created_by': sec_sobat
        })

        ClassTimetable.objects.get_or_create(course=nursing_course, day_of_week='Thursday', start_time=time(8, 30), room='Health Complex Lab B', defaults={
            'faculty': sonm,
            'course_unit': cu4,
            'lecturer': lecturer2,
            'class_date': base_monday + timedelta(days=3), # 2026-09-03
            'end_time': time(11, 30),
            'class_type': 'lab',
            'created_by': sec_sonm
        })

        ClassTimetable.objects.get_or_create(course=ph_course, day_of_week='Friday', start_time=time(10, 0), room='Auditorium 2 - SOPH Building', defaults={
            'faculty': soph,
            'course_unit': cu5,
            'lecturer': lecturer2,
            'class_date': base_monday + timedelta(days=4), # 2026-09-04
            'end_time': time(12, 0),
            'class_type': 'lecture',
            'created_by': sec_soph
        })

        ClassTimetable.objects.get_or_create(course=bml_course, day_of_week='Monday', start_time=time(14, 0), room='Pathology Lab 1 - IAH', defaults={
            'faculty': iah,
            'course_unit': cu6,
            'lecturer': lecturer2,
            'class_date': base_monday + timedelta(days=7), # 2026-09-07
            'end_time': time(16, 30),
            'class_type': 'lab',
            'created_by': sec_iah
        })

        # 7. Exam Timetables WITH REAL DATES
        ExamTimetable.objects.get_or_create(title='BIT2101 Final Practical Exam', course=cs_course, exam_date=date(2026, 9, 14), defaults={
            'faculty': sobat,
            'course_unit': cu1,
            'start_time': time(9, 0),
            'end_time': time(12, 0),
            'venue': 'Main Computer Complex Lab 1',
            'invigilator': lecturer1,
            'created_by': registrar
        })

        ExamTimetable.objects.get_or_create(title='BSN1101 Human Anatomy Final Exam', course=nursing_course, exam_date=date(2026, 9, 16), defaults={
            'faculty': sonm,
            'course_unit': cu4,
            'start_time': time(9, 0),
            'end_time': time(12, 0),
            'venue': 'Clinical Simulation Center',
            'invigilator': lecturer2,
            'created_by': registrar
        })

        # 8. Global Proctoring Setting
        ProctoringSetting.objects.get_or_create(id=1, defaults={
            'is_proctoring_enabled': True,
            'require_webcam': True,
            'strict_tab_switch_limit': 3,
            'updated_by': admin
        })

        # 9. Seed Official Exam Paper with Real Scheduled Date
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

        # 10. Seed Official Test Paper (TEST101) with Real Scheduled Date & Due Date
        test_item, _ = Test.objects.get_or_create(title='TEST101: Web Application Development CAT', course=cs_course, defaults={
            'course_unit': cu1,
            'lecturer': lecturer1,
            'category': 'unit_test',
            'duration_minutes': 30,
            'scheduled_start': timezone.now() - timedelta(minutes=5),
            'due_date': timezone.now() + timedelta(days=7),
            'pass_percentage': 50.0,
            'allowed_attempts': 5,
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
            TestQuestion.objects.create(
                test=test_item,
                question_text='What is the primary role of Django View function in MVT architecture?',
                question_type='mcq',
                option_a='Executes HTTP request handling and business logic processing',
                option_b='Directly manages CSS styles',
                option_c='Stores database tables',
                option_d='Compiles Python binaries',
                correct_answer='A',
                points=2.0,
                explanation='Views contain business logic and process incoming HTTP requests.'
            )

        # 11. Seed Completed Student Attempt & System Logs
        TestAttempt.objects.get_or_create(student=student1, test=test_item, attempt_number=1, defaults={
            'score': 100.0,
            'passed': True,
            'completed_at': timezone.now(),
            'tab_switches_count': 0
        })

        log_system_event(admin, "Production Portal Data Seeded & Initialized", level="AUDIT", details="Full CIU faculties (SOBAT, SONM, SOPH, IAH), executive officers (VC, DVC, AR), timetables with real dates, fee thresholds, and proctoring controls loaded.")

        self.stdout.write(self.style.SUCCESS('\n================================================================='))
        self.stdout.write(self.style.SUCCESS('  Clarke International University Portal Production Data Ready!'))
        self.stdout.write(self.style.SUCCESS('================================================================='))
        self.stdout.write(self.style.NOTICE('Executive & Administrative Accounts:'))
        self.stdout.write('  • System Admin:             admin / admin123')
        self.stdout.write('  • Vice-Chancellor (VC):     vc_nanyonga / vc123 (Ass. Prof. Rose Clarke Nanyonga)')
        self.stdout.write('  • Chancellor / DVC:         dvc_singh / dvc123 (Dr. Milka Singh)')
        self.stdout.write('  • Academic Registrar:       registrar_ayot / registrar123 (Evelyn Grace Ayot)')
        self.stdout.write(self.style.NOTICE('Faculty Deans & Secretaries:'))
        self.stdout.write('  • SOBAT Dean (Business & IT): dean_sobat / dean123 (Ass. Prof. Margaret Kareyo)')
        self.stdout.write('  • SOBAT Secretary:          sec_sobat / sec123 (Lillian Achola)')
        self.stdout.write('  • SONM Dean (Nursing):      dean_sonm / dean123 (Agnes Agwang)')
        self.stdout.write('  • SONM Secretary:           sec_sonm / sec123 (Doreen Agnes Basemera)')
        self.stdout.write('  • SOPH Dean (Public Health):dean_soph / dean123 (John Bosco Alege)')
        self.stdout.write('  • SOPH Secretary:           sec_soph / sec123 (Anitah Mwebaze)')
        self.stdout.write('  • IAH Dean (Allied Health): dean_iah / dean123 (Prof. John Charles Okiria)')
        self.stdout.write('  • IAH Secretary:            sec_iah / sec123 (Emilly Naiwumbwe)')
        self.stdout.write(self.style.NOTICE('Demonstration Students:'))
        self.stdout.write('  • Student (100% Fees):      student1 / student123 (Full Access)')
        self.stdout.write('  • Student (75% Fees):       student2 / student123 (Tests Only, Exam Barred)')
        self.stdout.write('  • Student (35% Fees):       student3 / student123 (Barred from Tests & Exams)')
        self.stdout.write(self.style.SUCCESS('=================================================================\n'))
