import json
import urllib.request
import ssl
import logging
from django.conf import settings
from .models import log_system_event

logger = logging.getLogger(__name__)

EXTERNAL_CIU_API_URL = "https://eadmin.ciu.ac.ug/API/ClearedStudentsAPI.aspx?examtype=EXAMS&acad=2026/2027&sem=1"

def fetch_external_cleared_students(examtype="EXAMS", acad="2026/2027", sem="1"):
    """
    Fetches the list of cleared students from CIU's official API endpoint.
    URL: https://eadmin.ciu.ac.ug/API/ClearedStudentsAPI.aspx?examtype=EXAMS&acad=2026/2027&sem=1
    """
    url = f"https://eadmin.ciu.ac.ug/API/ClearedStudentsAPI.aspx?examtype={examtype}&acad={acad}&sem={sem}"
    try:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

        req = urllib.request.Request(
            url,
            headers={'User-Agent': 'CIU-MyKampus-Portal/2026'}
        )
        with urllib.request.urlopen(req, context=ctx, timeout=8) as response:
            raw_data = response.read().decode('utf-8')
            try:
                data = json.loads(raw_data)
                return data
            except json.JSONDecodeError:
                return [{'raw': raw_data}]
    except Exception as e:
        logger.warning(f"Error connecting to CIU Cleared Students API ({url}): {str(e)}")
        return None

def check_student_clearance(student_user, examtype="EXAMS"):
    """
    Evaluates whether a student is cleared to sit for an exam (100% required) or test (50% required).
    Checks:
    1. External CIU API payload match against reg_number, username, or email.
    2. Student's tuition_paid_percentage stored in database (Admin override).
    """
    if not student_user or student_user.role != 'student':
        return {
            'is_exam_cleared': True,
            'is_test_cleared': True,
            'tuition_paid_percentage': 100.0,
            'is_api_cleared': False,
            'source': 'Non-student Role (Bypassed)'
        }

    reg_num = (student_user.reg_number or student_user.registration_number or "").strip().upper()
    username = (student_user.username or "").strip().upper()
    email = (student_user.email or "").strip().upper()
    db_percentage = student_user.tuition_paid_percentage

    # Fetch external API data
    api_data = fetch_external_cleared_students(examtype=examtype)
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

    effective_percentage = 100.0 if is_api_cleared else db_percentage

    is_exam_cleared = (effective_percentage >= 100.0) or is_api_cleared
    is_test_cleared = (effective_percentage >= 50.0) or is_api_cleared

    source = "External CIU Cleared API" if is_api_cleared else f"Database Record ({db_percentage}%)"

    return {
        'is_exam_cleared': is_exam_cleared,
        'is_test_cleared': is_test_cleared,
        'tuition_paid_percentage': effective_percentage,
        'db_percentage': db_percentage,
        'is_api_cleared': is_api_cleared,
        'api_match_details': api_match_details,
        'source': source
    }
