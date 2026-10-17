import uuid
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.utils.translation import gettext_lazy as _

class SingleSessionJWTAuthentication(JWTAuthentication):
    """
    Enforces single user session policy to prevent concurrent logins across multiple devices.
    Every login generates a new active_session_key on the user.
    If an existing token's embedded session_key does not match the user's active_session_key,
    the request is rejected with AuthenticationFailed.
    """
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        token_session_key = validated_token.get('session_key')

        # If user has an active_session_key, ensure the token's session_key matches it
        if user and user.active_session_key:
            if not token_session_key or str(user.active_session_key).strip() != str(token_session_key).strip():
                raise AuthenticationFailed(
                    _("Session Terminated: You have signed in from another device or browser session. Concurrent multiple device logins are strictly prohibited."),
                    code="multiple_device_session_invalidated"
                )
        return user
