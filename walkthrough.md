# Walkthrough: local setup & verification

I have successfully launched and verified the CIUExam Portal locally. Below is the summary of validation results, including screenshots and screen recording of the verified student flow.

## What Was Fixed
- **CSS Import Order**: Fixed a compile error in [globals.css](file:///Users/mark/Desktop/projects/2026/myKampus/frontend/src/app/globals.css#L1-L3) by moving the external font `@import url(...)` before the `@import "tailwindcss";` rule.

## Verification & Screenshots

### Browser Session Recording
Here is the recorded video showing the login, dashboard navigation, and logout process in action:
![Local Login Flow](file:///Users/mark/.gemini/antigravity-ide/brain/b92cb951-af24-4195-a9db-861b7acbf7b7/local_login_flow_1782723839478.webp)

---

### Step-by-Step UI Views

````carousel
![Login Page](file:///Users/mark/.gemini/antigravity-ide/brain/b92cb951-af24-4195-a9db-861b7acbf7b7/login_page_1782723874077.png)
<!-- slide -->
![Student Dashboard](file:///Users/mark/.gemini/antigravity-ide/brain/b92cb951-af24-4195-a9db-861b7acbf7b7/student_dashboard_1782724041960.png)
<!-- slide -->
![Classroom & Attendance](file:///Users/mark/.gemini/antigravity-ide/brain/b92cb951-af24-4195-a9db-861b7acbf7b7/classroom_attendance_1782724171590.png)
<!-- slide -->
![Exams Portal](file:///Users/mark/.gemini/antigravity-ide/brain/b92cb951-af24-4195-a9db-861b7acbf7b7/exams_portal_1782724316192.png)
<!-- slide -->
![Logout Page](file:///Users/mark/.gemini/antigravity-ide/brain/b92cb951-af24-4195-a9db-861b7acbf7b7/logout_page_1782724448439.png)
````

---

## Status
Both servers are running smoothly in the background:
- **Django backend server**: `http://localhost:8000/api/` (PID task-90)
- **Next.js frontend server**: `http://localhost:3000` (PID task-94)
