from django.core.management.base import BaseCommand
from django.utils import timezone
from ciu_portal.models import User, Faculty, Course, CourseUnit, Exam, Question, Test, TestQuestion

class Command(BaseCommand):
    help = 'Populates Clarke International University portal seed data (Faculties, Courses, Course Units, Roles, Exams, and Tests).'

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE('Seeding portal data...'))

        # 1. System Users
        admin, _ = User.objects.get_or_create(username='admin', defaults={
            'email': 'admin@ciu.ac.ug', 'first_name': 'System', 'last_name': 'Admin', 'role': 'admin'
        })
        admin.set_password('admin123')
        admin.role = 'admin'
        admin.save()

        registrar, _ = User.objects.get_or_create(username='registrar', defaults={
            'email': 'registrar@ciu.ac.ug', 'first_name': 'Academic', 'last_name': 'Registrar', 'role': 'registrar'
        })
        registrar.set_password('registrar123')
        registrar.role = 'registrar'
        registrar.save()

        dean, _ = User.objects.get_or_create(username='dean_fst', defaults={
            'email': 'dean.fst@ciu.ac.ug', 'first_name': 'Dr. Sarah', 'last_name': 'Nabukeera', 'role': 'dean'
        })
        dean.set_password('dean123')
        dean.role = 'dean'
        dean.save()

        secretary, _ = User.objects.get_or_create(username='sec_fst', defaults={
            'email': 'sec.fst@ciu.ac.ug', 'first_name': 'Jane', 'last_name': 'Namatovu', 'role': 'faculty_admin'
        })
        secretary.set_password('sec123')
        secretary.role = 'faculty_admin'
        secretary.save()

        lecturer, _ = User.objects.get_or_create(username='lecturer1', defaults={
            'email': 'john.mugisha@ciu.ac.ug', 'first_name': 'John', 'last_name': 'Mugisha', 'role': 'lecturer'
        })
        lecturer.set_password('lecturer123')
        lecturer.role = 'lecturer'
        lecturer.save()

        student, _ = User.objects.get_or_create(username='student1', defaults={
            'email': 'alex.kato@ciu.ac.ug', 'first_name': 'Alex', 'last_name': 'Kato', 'role': 'student'
        })
        student.set_password('student123')
        student.role = 'student'
        student.save()

        # 2. Faculties
        fst, _ = Faculty.objects.get_or_create(code='FST', defaults={
            'name': 'Faculty of Science & Technology',
            'description': 'Department of Computer Science, IT, and Software Engineering.',
            'dean': dean,
            'secretary': secretary
        })

        fbm, _ = Faculty.objects.get_or_create(code='FBM', defaults={
            'name': 'Faculty of Business & Management',
            'description': 'Department of Accounting, Finance, and Business Analytics.',
        })

        fhs, _ = Faculty.objects.get_or_create(code='FHS', defaults={
            'name': 'Faculty of Health Sciences',
            'description': 'School of Nursing, Public Health, and Allied Health Sciences.',
        })

        # 3. Courses
        cs_course, _ = Course.objects.get_or_create(code='BIT2026', defaults={
            'name': 'BSc. Computer Information Technology',
            'faculty': fst,
            'department': 'Computer Science',
            'description': 'Undergraduate degree program in Information Technology and Modern Computing.'
        })

        se_course, _ = Course.objects.get_or_create(code='BSE2026', defaults={
            'name': 'BSc. Software Engineering',
            'faculty': fst,
            'department': 'Software Engineering',
            'description': 'Advanced degree focusing on software design, algorithms, and web architectures.'
        })

        # 4. Course Units
        cu1, _ = CourseUnit.objects.get_or_create(code='BIT2101', course=cs_course, defaults={
            'name': 'Web Application Development',
            'credit_units': 4
        })
        cu1.lecturers.add(lecturer)

        cu2, _ = CourseUnit.objects.get_or_create(code='BIT2102', course=cs_course, defaults={
            'name': 'Data Structures & Algorithms',
            'credit_units': 3
        })
        cu2.lecturers.add(lecturer)

        # 5. Seed Exam Paper
        exam, _ = Exam.objects.get_or_create(title='End of Semester Examination 2026', course=cs_course, defaults={
            'course_unit': cu1,
            'lecturer': lecturer,
            'duration_minutes': 60,
            'scheduled_start': timezone.now(),
            'is_active': True,
            'is_approved_by_dean': True,
            'is_results_released': False
        })

        if exam.questions.count() == 0:
            Question.objects.create(
                exam=exam,
                question_text='Which HTTP status code signifies that a resource was created successfully?',
                option_a='200 OK',
                option_b='201 Created',
                option_c='404 Not Found',
                option_d='500 Server Error',
                correct_option='B'
            )
            Question.objects.create(
                exam=exam,
                question_text='What is the primary function of Django URL Router?',
                option_a='Styling HTML elements',
                option_b='Directing incoming HTTP requests to corresponding view functions',
                option_c='Encrypting user passwords',
                option_d='Storing data in database tables',
                correct_option='B'
            )

        # 6. Seed Test
        test_item, _ = Test.objects.get_or_create(title='Continuous Assessment Test 1 (CAT)', course=cs_course, defaults={
            'course_unit': cu1,
            'lecturer': lecturer,
            'category': 'unit_test',
            'duration_minutes': 20,
            'scheduled_start': timezone.now(),
            'pass_percentage': 50.0,
            'allowed_attempts': 2,
            'is_published': True
        })

        if test_item.questions.count() == 0:
            TestQuestion.objects.create(
                test=test_item,
                question_text='REST APIs use standard HTTP verbs such as GET, POST, PUT, and DELETE.',
                question_type='tf',
                option_a='True',
                option_b='False',
                correct_answer='True',
                points=1.0,
                explanation='RESTful architectures map CRUD actions directly to standard HTTP methods.'
            )
            TestQuestion.objects.create(
                test=test_item,
                question_text='Which frontend framework uses JSX syntax for component templating?',
                question_type='mcq',
                option_a='Angular',
                option_b='React / Next.js',
                option_c='Django',
                option_d='Laravel',
                correct_answer='B',
                points=2.0,
                explanation='React and Next.js use JSX syntax (JavaScript XML) to describe user interfaces.'
            )

        self.stdout.write(self.style.SUCCESS('Portal seed data populated successfully!'))
        self.stdout.write(self.style.SUCCESS('Accounts created: admin/admin123, registrar/registrar123, dean_fst/dean123, sec_fst/sec123, lecturer1/lecturer123, student1/student123'))
