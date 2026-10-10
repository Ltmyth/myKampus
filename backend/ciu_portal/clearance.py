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

# Thread-safe in-memory cache for external clearance payloads
_CLEARANCE_CACHE = {}
_CACHE_LOCK = Lock()
_CACHE_TTL_SECONDS = 600  # 10 minutes cache TTL for 150+ user scalability

def fetch_external_cleared_students(examtype="EXAMS", acad="2026/2027", sem="1", force_refresh=False):
    """
    Fetches the list of cleared students from CIU's official API endpoint.
    Endpoints:
      - EXAMS: https://eadmin.ciu.ac.ug/API/ClearedStudentsAPI.aspx?examtype=EXAMS&acad=${acad}&sem=${sem} (100% Tuition required)
      - TESTS: https://eadmin.ciu.ac.ug/API/ClearedStudentsAPI.aspx?examtype=TESTS&acad=${acad}&sem=${sem} (50% Tuition required)
    Uses in-memory thread-safe TTL caching to scale for 150+ concurrent users.
    """
    cache_key = f"{str(examtype).upper()}_{acad}_{sem}"
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
        with urllib.request.urlopen(req, context=ctx, timeout=6) as response:
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

def _match_student_in_payload(records, reg_num, username, email):
    """
    Helper to check if student identifiers exist in external API payload records.
    """
    if not records:
        return False, None
    clean_reg = reg_num.strip().upper() if reg_num else ""
    clean_user = username.strip().upper() if username else ""
    clean_email = email.strip().upper() if email else ""

    if isinstance(records, list):
        for item in records:
            if isinstance(item, dict):
                r_no = str(item.get('RegistrationNo') or item.get('RegNo') or item.get('reg_no') or item.get('StudentNo') or '').strip().upper()
                s_user = str(item.get('username') or '').strip().upper()
                s_email = str(item.get('email') or '').strip().upper()
                val_str = str(item).upper()

                if (clean_reg and (clean_reg == r_no or clean_reg in val_str)) or \
                   (clean_user and (clean_user == s_user or clean_user in val_str)) or \
                   (clean_email and (clean_email == s_email or clean_email in val_str)):
                    return True, item
            elif isinstance(item, str):
                item_str = item.upper()
                if (clean_reg and clean_reg in item_str) or \
                   (clean_user and clean_user in item_str) or \
                   (clean_email and clean_email in item_str):
                    return True, {'name': item}
    elif isinstance(records, dict):
        val_str = str(records).upper()
        if (clean_reg and clean_reg in val_str) or \
           (clean_user and clean_user in val_str) or \
           (clean_email and clean_email in val_str):
            return True, records
    return False, None

def check_student_clearance(student_user, examtype="EXAMS", preloaded_api_data=None, acad="2026/2027", sem="1"):
    """
    Evaluates whether a student is cleared to sit for:
    - Final Exams: Requires 100% full tuition clearance, EXAMS API verification, or valid Temporary Clearance override.
    - Quizzes & Tests: Requires at least 50% tuition clearance, TESTS API verification, or valid Temporary Clearance override.

    Consumes:
    1. Active Temporary Clearances (Accounts Personnel or System Admin overrides).
    2. External CIU EXAMS API (100% tuition gate for tests & exams).
    3. External CIU TESTS API (50% tuition gate for tests ONLY, NOT exams).
    4. Database tuition_paid_percentage record.
    """
    if not student_user or student_user.role != 'student':
        return {
            'is_exam_cleared': True,
            'is_test_cleared': True,
            'tuition_paid_percentage': 100.0,
            'is_api_cleared': False,
            'is_api_exam_cleared': False,
            'is_api_test_cleared': False,
            'is_temp_cleared': False,
            'source': 'Non-student Role (Bypassed)'
        }

    reg_num = (student_user.reg_number or student_user.registration_number or "").strip().upper()
    username = (student_user.username or "").strip().upper()
    email = (student_user.email or "").strip().upper()
    db_percentage = float(student_user.tuition_paid_percentage or 0.0)

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
            'granted_by': latest_tc.granted_by.username if latest_tc.granted_by else 'Accounts / Admin'
        }

    # 2. Check External CIU API Endpoints (EXAMS and TESTS)
    is_api_exam_cleared = False
    is_api_test_cleared = False
    api_match_details = None

    if preloaded_api_data is not None:
        # Preloaded dataset passed directly (can be single list or dict with exams/tests)
        if isinstance(preloaded_api_data, dict) and ('exams' in preloaded_api_data or 'tests' in preloaded_api_data):
            matched_ex, d_ex = _match_student_in_payload(preloaded_api_data.get('exams'), reg_num, username, email)
            matched_ts, d_ts = _match_student_in_payload(preloaded_api_data.get('tests'), reg_num, username, email)
            if matched_ex:
                is_api_exam_cleared = True
                is_api_test_cleared = True
                api_match_details = d_ex
            elif matched_ts:
                is_api_test_cleared = True
                api_match_details = d_ts
        else:
            matched, details = _match_student_in_payload(preloaded_api_data, reg_num, username, email)
            if matched:
                if str(examtype).upper() == "TESTS":
                    is_api_test_cleared = True
                    api_match_details = details
                else:
                    is_api_exam_cleared = True
                    is_api_test_cleared = True
                    api_match_details = details
    else:
        # Fetch from cached CIU endpoints
        exams_data = fetch_external_cleared_students(examtype="EXAMS", acad=acad, sem=sem)
        matched_ex, d_ex = _match_student_in_payload(exams_data, reg_num, username, email)
        if matched_ex:
            is_api_exam_cleared = True
            is_api_test_cleared = True
            api_match_details = d_ex
        else:
            # Check TESTS API (students cleared 50% for tests, but NOT exams)
            tests_data = fetch_external_cleared_students(examtype="TESTS", acad=acad, sem=sem)
            matched_ts, d_ts = _match_student_in_payload(tests_data, reg_num, username, email)
            if matched_ts:
                is_api_test_cleared = True
                api_match_details = d_ts

    # 3. Calculate Effective Tuition Percentage & Final Clearance Gates
    if is_temp_cleared:
        effective_percentage = 100.0 if is_temp_exam_cleared else max(50.0, db_percentage)
    elif is_api_exam_cleared:
        effective_percentage = 100.0
    elif is_api_test_cleared:
        effective_percentage = max(50.0, db_percentage)
    else:
        effective_percentage = db_percentage

    # EXAMS GATE: 100% required (Exams API, Temp Exam Override, or Manual DB >= 100%)
    is_exam_cleared = is_temp_exam_cleared or is_api_exam_cleared or (db_percentage >= 100.0)

    # TESTS GATE: 50% required (Tests API, Exams API, Temp Test/Exam Override, or Manual DB >= 50%)
    is_test_cleared = is_temp_test_cleared or is_temp_exam_cleared or is_api_test_cleared or is_api_exam_cleared or (effective_percentage >= 50.0) or (db_percentage >= 50.0)

    # Clearance Mode & Source Attribution
    if is_temp_cleared:
        clearance_mode = 'temporary'
        tc = active_temp_clearances[0]
        source = f"Temporary Clearance Override ({tc.clearance_type.upper()}, Expires {tc.expires_at.strftime('%Y-%m-%d %H:%M')})"
    elif is_api_exam_cleared:
        clearance_mode = 'api_100'
        source = "CIU Live Exams API (100% Cleared - Exams & Tests)"
    elif is_api_test_cleared:
        clearance_mode = 'api_50'
        source = "CIU Live Tests API (50% Cleared - Tests Only)"
    elif db_percentage >= 100.0:
        clearance_mode = 'manual_100'
        source = f"Manual Clearance ({db_percentage}% Tuition Record - Exams & Tests)"
    elif db_percentage >= 50.0:
        clearance_mode = 'manual_50'
        source = f"Manual Clearance ({db_percentage}% Tuition Record - Tests Only)"
    else:
        clearance_mode = 'uncleared'
        source = f"Tuition Record ({db_percentage}% - Uncleared)"

    return {
        'is_exam_cleared': is_exam_cleared,
        'is_test_cleared': is_test_cleared,
        'tuition_paid_percentage': effective_percentage,
        'db_percentage': db_percentage,
        'clearance_mode': clearance_mode,
        'is_api_cleared': is_api_exam_cleared or is_api_test_cleared,
        'is_api_exam_cleared': is_api_exam_cleared,
        'is_api_test_cleared': is_api_test_cleared,
        'is_temp_cleared': is_temp_cleared,
        'is_temp_exam_cleared': is_temp_exam_cleared,
        'is_temp_test_cleared': is_temp_test_cleared,
        'temp_info': temp_info,
        'api_match_details': api_match_details,
        'source': source
    }
