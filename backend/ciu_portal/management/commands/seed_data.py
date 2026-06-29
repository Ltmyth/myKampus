import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from ciu_portal.models import Course, Application, Exam, Question, Invitation, ClassContent, AttendanceSession

User = get_user_model()

class Command(BaseCommand):
    help = 'Seeds Clarke International University database with initial dummy data.'

    def handle(self, *args, **kwargs):
        self.stdout.write("Seeding data...")

        # 1. Create Default Users for all Roles
        roles_data = [
            {'username': 'admin', 'email': 'admin@ciu.ac.ug', 'role': 'admin', 'first_name': 'System', 'last_name': 'Admin'},
            {'username': 'dvc', 'email': 'dvc@ciu.ac.ug', 'role': 'dvc', 'first_name': 'Chancellor', 'last_name': 'DVC'},
            {'username': 'dean', 'email': 'dean@ciu.ac.ug', 'role': 'dean', 'first_name': 'School', 'last_name': 'Dean'},
            {'username': 'lecturer', 'email': 'lecturer@ciu.ac.ug', 'role': 'lecturer', 'first_name': 'Dr. Sarah', 'last_name': 'Mukasa'},
            {'username': 'student', 'email': 'student@ciu.ac.ug', 'role': 'student', 'first_name': 'John', 'last_name': 'Ssewankambo'},
        ]

        users = {}
        for ud in roles_data:
            user, created = User.objects.get_or_create(
                username=ud['username'],
                defaults={
                    'email': ud['email'],
                    'role': ud['role'],
                    'first_name': ud['first_name'],
                    'last_name': ud['last_name'],
                    'is_staff': ud['role'] == 'admin',
                    'is_superuser': ud['role'] == 'admin',
                }
            )
            if created:
                user.set_password(f"{ud['username']}123")
                user.save()
                self.stdout.write(f"Created user: {ud['username']} with password: {ud['username']}123")
            else:
                self.stdout.write(f"User {ud['username']} already exists.")
            users[ud['role']] = user

        # 2. Create Courses
        courses_data = [
            {'name': 'Introduction to Nursing Care', 'code': 'BNS1101', 'department': 'School of Nursing'},
            {'name': 'Principles of Public Health', 'code': 'MPH2102', 'department': 'School of Public Health'},
            {'name': 'Computer Applications in Healthcare', 'code': 'CS1201', 'department': 'School of Business & IT'},
        ]

        courses = {}
        for cd in courses_data:
            course, created = Course.objects.get_or_create(
                code=cd['code'],
                defaults={
                    'name': cd['name'],
                    'department': cd['department'],
                    'description': f"Comprehensive course on {cd['name']} at Clarke International University."
                }
            )
            if created:
                self.stdout.write(f"Created course: {cd['code']}")
            courses[cd['code']] = course

        # 3. Create active invitations
        invites_data = [
            {'email': 'invited_lecturer@ciu.ac.ug', 'role': 'lecturer'},
            {'email': 'invited_dean@ciu.ac.ug', 'role': 'dean'},
            {'email': 'invited_student@ciu.ac.ug', 'role': 'student'},
        ]
        for idata in invites_data:
            invite, created = Invitation.objects.get_or_create(
                email=idata['email'],
                defaults={
                    'role': idata['role'],
                    'created_by': users['admin'],
                    'is_used': False
                }
            )
            if created:
                self.stdout.write(f"Created invitation token: {invite.id} for {invite.email} ({invite.role})")

        # 4. Create an Application for our Student
        app, created = Application.objects.get_or_create(
            student=users['student'],
            course=courses['BNS1101'],
            defaults={
                'status': 'pending',
                'transcript_details': 'GPA: 3.8/4.0 from High School. Highly motivated to join Nursing Program.',
            }
        )
        if created:
            self.stdout.write("Created student application for BNS1101 (Pending).")

        # 5. Create a Class Content for Nursing
        content, created = ClassContent.objects.get_or_create(
            course=courses['BNS1101'],
            title='Lecture 1: Basics of Patient Hygiene',
            defaults={
                'lecturer': users['lecturer'],
                'description': 'Introduction lecture covering essential hygiene techniques and nurse-patient communications.',
                'attachment_url': 'https://www.ciu.ac.ug/files/Basics_of_Patient_Hygiene.pdf'
            }
        )
        if created:
            self.stdout.write("Created class content resource for BNS1101.")

        # 6. Create active Exams and Questions
        exam, created = Exam.objects.get_or_create(
            course=courses['BNS1101'],
            title='Mid-Semester Assessment',
            defaults={
                'lecturer': users['lecturer'],
                'duration_minutes': 30,
                'is_active': True
            }
        )

        if created:
            self.stdout.write("Created exam: Mid-Semester Assessment")
            
            # Question 1
            Question.objects.create(
                exam=exam,
                question_text='What is the primary function of white blood cells in the human body?',
                option_a='Carry oxygen to vital organs',
                option_b='Fight infections and foreign pathogens',
                option_c='Clot blood at the site of injuries',
                option_d='Regulate temperature and pH levels',
                correct_option='B'
            )

            # Question 2
            Question.objects.create(
                exam=exam,
                question_text='Which human organ is primarily responsible for filtering metabolic waste from blood?',
                option_a='The Lungs',
                option_b='The Liver',
                option_c='The Kidneys',
                option_d='The Spleen',
                correct_option='C'
            )

            # Question 3
            Question.objects.create(
                exam=exam,
                question_text='What is considered the normal average oral body temperature for a healthy adult?',
                option_a='35.6°C',
                option_b='37.0°C',
                option_c='38.5°C',
                option_d='39.1°C',
                correct_option='B'
            )
            self.stdout.write("Added 3 multiple choice questions for Mid-Semester Assessment.")

        self.stdout.write("Database successfully seeded.")
