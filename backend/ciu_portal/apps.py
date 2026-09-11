from django.apps import AppConfig
from django.db.backends.signals import connection_created
from django.dispatch import receiver

@receiver(connection_created)
def configure_sqlite_wal(sender, connection, **kwargs):
    if connection.vendor == 'sqlite':
        try:
            cursor = connection.cursor()
            cursor.execute('PRAGMA journal_mode=WAL;')
            cursor.execute('PRAGMA synchronous=NORMAL;')
            cursor.execute('PRAGMA busy_timeout=10000;')
        except Exception:
            pass

class CiuPortalConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'ciu_portal'

    def ready(self):
        pass

