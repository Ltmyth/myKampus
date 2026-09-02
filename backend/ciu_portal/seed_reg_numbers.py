from ciu_portal.models import User, Faculty

def seed_student_registration_numbers():
    students = User.objects.filter(role='student')
    updated = 0
    print(f"Starting seeding for {students.count()} student accounts...")

    for index, student in enumerate(students, start=1):
        f_code = (student.faculty.code if student.faculty else 'SOBAT').upper().replace(' ', '')
        formatted_reg = f"2026{f_code}-A{index:03d}"
        student.reg_number = formatted_reg
        # Set password to 'student123' so students can log in directly with reg_number + password
        student.set_password('student123')
        student.save()
        updated += 1
        print(f"Updated Student: {student.username} ({student.get_full_name()}) -> Reg No: {formatted_reg}")

    print(f"Seeding completed successfully! Total students updated: {updated}")

if __name__ == '__main__':
    seed_student_registration_numbers()
