from rest_framework import permissions

class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role in ['admin', 'platform_coordinator']

class IsPlatformCoordinator(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'platform_coordinator'

class IsDVC(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'dvc'

class IsDean(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'dean'

class IsFacultyAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role in ['faculty_admin', 'faculty_secretary']

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

class IsAccountsPersonnel(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'accounts'

class IsStrictSystemAdmin(permissions.BasePermission):
    """
    Strictly checks that request.user is authenticated and has role == 'admin' (or is_superuser).
    Platform coordinators, deans, faculty secretaries, etc. are NOT allowed.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and (request.user.role == 'admin' or request.user.is_superuser))

class CanIssueTemporaryClearance(permissions.BasePermission):
    """
    Temporary clearance can ONLY be issued/revoked/extended by an Accounts Personnel or the System Admin.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and (request.user.role in ['admin', 'accounts'] or request.user.is_superuser))

class IsStaffUser(permissions.BasePermission):
    """
    Allows access to Admin, Platform Coordinator, Accounts, DVC, VC, Dean, Faculty Admin, Registrar, and Lecturer
    """
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated and
            request.user.role in ['admin', 'platform_coordinator', 'accounts', 'dvc', 'vc', 'dean', 'faculty_admin', 'faculty_secretary', 'registrar', 'lecturer']
        )

