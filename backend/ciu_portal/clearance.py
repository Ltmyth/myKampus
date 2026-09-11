import json
import urllib.request
import ssl
import logging
import time
from threading import Lock
from django.conf import settings
from django.utils import timezone
from .models import log_system_event, TemporaryClearance

logger = logging.getLogger(__name__)

EXTERNAL_CIU_API_URL = "https://eadmin.ciu.ac.ug/API/ClearedStudentsAPI.aspx?examtype=EXAMS&acad=2026/2027&sem=1"

# Thread-safe in-memory cache for external clearance payload
_CLEARANCE_CACHE = {}
_CACHE_LOCK = Lock()
_CACHE_TTL_SECONDS = 600  # 10 minutes cache TTL for 150+ user scalability

def fetch_external_cleared_students(examtype="EXAMS", acad="2026/2027", sem="1", force_refresh=False):
    """
    Fetches the list of cleared students from CIU's official API endpoint.
    Uses in-memory thread-safe TTL caching to scale for 150+ concurrent users.
    """
    cache_key = f"{examtype}_{acad}_{sem}"
    now_ts = time.time()

    if not force_refresh:
        with _CACHE_LOCK:
            if cache_key in _CLEARANCE_CACHE:
                cached_data, timestamp = _CLEARANCE_CACHE[cache_key]
                if now_ts - timestamp < _CACHE_TTL_SECONDS:
                    return cached_data

    url = f"https://eadmin.ciu.ac.ug/API/ClearedStudentsAPI.aspx?examtype={examtype}&acad={acad}&sem={sem}"
    try:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

        req = urllib.request.Request(
            url,
            headers={'User-Agent': 'CIU-MyKampus-Portal/2026'}
        )
        with urllib.request.urlopen(req, context=ctx, timeout=5) as response:
            raw_data = response.read().decode('utf-8')
            try:
                data = json.loads(raw_data)
            except json.JSONDecodeError:
                data = [{'raw': raw_data}]

            with _CACHE_LOCK:
                _CLEARANCE_CACHE[cache_key] = (data, now_ts)
            return data
    except Exception as e:
        logger.warning(f"Error connecting to CIU Cleared Students API ({url}): {str(e)}")
        # Fallback to expired cache if available during network error
        with _CACHE_LOCK:
            if cache_key in _CLEARANCE_CACHE:
                return _CLEARANCE_CACHE[cache_key][0]
        return None

def check_student_clearance(student_user, examtype="EXAMS", preloaded_api_data=None):
    """
    Evaluates whether a student is cleared to sit for an exam (100% required) or test (50% required).
    Checks:
    1. Active Temporary Clearances (Admin/Staff Overrides with valid duration).
    2. External CIU API payload match (Cached for high performance).
    3. Student's tuition_paid_percentage stored in database.
    """
    if not student_user or student_user.role != 'student':
        return {
            'is_exam_cleared': True,
            'is_test_cleared': True,
            'tuition_paid_percentage': 100.0,
            'is_api_cleared': False,
            'is_temp_cleared': False,
            'source': 'Non-student Role (Bypassed)'
        }

    reg_num = (student_user.reg_number or student_user.registration_number or "").strip().upper()
    username = (student_user.username or "").strip().upper()
    email = (student_user.email or "").strip().upper()
    db_percentage = student_user.tuition_paid_percentage

    # 1. Check Active Temporary Clearance Overrides
    now = timezone.now()
    active_temp_clearances = list(TemporaryClearance.objects.filter(
        student=student_user,
        is_active=True,
        valid_from__lte=now,
        expires_at__gte=now
    ).order_by('-expires_at'))

    is_temp_exam_cleared = any(tc.clearance_type in ['both', 'exams'] for tc in active_temp_clearances)
    is_temp_test_cleared = any(tc.clearance_type in ['both', 'tests'] for tc in active_temp_clearances)
    is_temp_cleared = is_temp_exam_cleared or is_temp_test_cleared

    temp_info = None
    if active_temp_clearances:
        latest_tc = active_temp_clearances[0]
        temp_info = {
            'id': latest_tc.id,
            'clearance_type': latest_tc.clearance_type,
            'expires_at': latest_tc.expires_at.isoformat(),
            'reason': latest_tc.reason,
            'granted_by': latest_tc.granted_by.username if latest_tc.granted_by else 'System'
        }

    # 2. External API check
    api_data = preloaded_api_data if preloaded_api_data is not None else fetch_external_cleared_students(examtype=examtype)
    is_api_cleared = False
    api_match_details = None

    if api_data:
        if isinstance(api_data, list):
            for item in api_data:
                if isinstance(item, dict):
                    val_str = str(item).upper()
                    if (reg_num and reg_num in val_str) or (username and username in val_str) or (email and email in val_str):
                        is_api_cleared = True
                        api_match_details = item
                        break
                elif isinstance(item, str):
                    item_str = item.upper()
                    if (reg_num and reg_num in item_str) or (username and username in item_str) or (email and email in item_str):
                        is_api_cleared = True
                        break
        elif isinstance(api_data, dict):
            val_str = str(api_data).upper()
            if (reg_num and reg_num in val_str) or (username and username in val_str) or (email and email in val_str):
                is_api_cleared = True

    effective_percentage = 100.0 if (is_api_cleared or is_temp_cleared) else db_percentage

    is_exam_cleared = is_temp_exam_cleared or (effective_percentage >= 100.0) or is_api_cleared
    is_test_cleared = is_temp_test_cleared or (effective_percentage >= 50.0) or is_api_cleared

    if is_temp_cleared:
        source = f"Temporary Clearance Override (Expires {active_temp_clearances[0].expires_at.strftime('%Y-%m-%d %H:%M')})"
    elif is_api_cleared:
        source = "External CIU Cleared API"
    else:
        source = f"Database Record ({db_percentage}%)"

    return {
        'is_exam_cleared': is_exam_cleared,
        'is_test_cleared': is_test_cleared,
        'tuition_paid_percentage': effective_percentage,
        'db_percentage': db_percentage,
        'is_api_cleared': is_api_cleared,
        'is_temp_cleared': is_temp_cleared,
        'temp_info': temp_info,
        'api_match_details': api_match_details,
        'source': source
    }

