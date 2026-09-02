from rest_framework import permissions

class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'admin'

class IsDVC(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'dvc'

class IsDean(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'dean'

class IsFacultyAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'faculty_admin'

class IsRegistrar(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'registrar'

class IsLecturer(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'lecturer'

class IsStudent(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'student'

class IsExecutiveReadOnly(permissions.BasePermission):
    """
    Ensures DVC, VC, and Deans can only perform SAFE methods (read-only: GET, HEAD, OPTIONS)
    and cannot perform edit or delete actions (POST, PUT, PATCH, DELETE).
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.role in ['dvc', 'vc', 'dean']:
            return request.method in permissions.SAFE_METHODS
        return True

class IsStaffUser(permissions.BasePermission):
    """
    Allows access to Admin, DVC, VC, Dean, Faculty Admin, Registrar, and Lecturer
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role in ['admin', 'dvc', 'vc', 'dean', 'faculty_admin', 'registrar', 'lecturer']
