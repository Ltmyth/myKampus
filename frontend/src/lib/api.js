const rawBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
const API_BASE_URL = rawBaseUrl.replace(/\/$/, '');

export async function apiRequest(endpoint, options = {}) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${cleanEndpoint}`;

  const isFormData = options.body instanceof FormData;
  const headers = { ...options.headers };

  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  } else if (isFormData) {
    delete headers['Content-Type']; // Let browser set multipart boundary automatically
  }

  // Inject Bearer token if present
  if (typeof window !== 'undefined') {
    const tokensStr = localStorage.getItem('ciu_tokens');
    if (tokensStr) {
      try {
        const tokens = JSON.parse(tokensStr);
        if (tokens && tokens.access) {
          headers['Authorization'] = `Bearer ${tokens.access}`;
        }
      } catch (e) {
        console.error("Error reading auth tokens", e);
      }
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { detail: text };
    }
  }

  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined') {
      if (!endpoint.includes('/auth/login/')) {
        localStorage.removeItem('ciu_tokens');
        localStorage.removeItem('ciu_user');
      }
    }
    let errorMessage = 'Request failed';
    if (data?.detail) {
      errorMessage = Array.isArray(data.detail) ? data.detail.join(' ') : data.detail;
    } else if (data?.message) {
      errorMessage = Array.isArray(data.message) ? data.message.join(' ') : data.message;
    } else if (data?.non_field_errors) {
      errorMessage = Array.isArray(data.non_field_errors) ? data.non_field_errors.join(' ') : data.non_field_errors;
    } else if (typeof data === 'object' && data !== null) {
      const values = Object.values(data).flat();
      errorMessage = values.length ? values.join(' ') : JSON.stringify(data);
    }
    throw new Error(errorMessage);
  }

  return data;
}

export const api = {
  get: (endpoint, options) => apiRequest(endpoint, { method: 'GET', ...options }),
  post: (endpoint, body, options) => apiRequest(endpoint, { 
    method: 'POST', 
    body: body instanceof FormData ? body : (body !== undefined ? JSON.stringify(body) : undefined), 
    ...options 
  }),
  put: (endpoint, body, options) => apiRequest(endpoint, { 
    method: 'PUT', 
    body: body instanceof FormData ? body : JSON.stringify(body), 
    ...options 
  }),
  patch: (endpoint, body, options) => apiRequest(endpoint, { 
    method: 'PATCH', 
    body: body instanceof FormData ? body : JSON.stringify(body), 
    ...options 
  }),
  delete: (endpoint, options) => apiRequest(endpoint, { method: 'DELETE', ...options }),
};

export function formatUgandanTime(dateString) {
  if (!dateString) return 'Open Anytime';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleString('en-UG', {
    timeZone: 'Africa/Kampala',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }) + ' (EAT)';
}

// Convert input string from <input type="datetime-local"> ("YYYY-MM-DDTHH:mm")
// explicitly interpreting it as Ugandan Time (UTC+3 / Africa/Kampala)
export function getUgandanISOString(datetimeLocalStr) {
  if (!datetimeLocalStr) return null;
  const clean = datetimeLocalStr.trim();
  if (clean.length === 16) {
    return `${clean}:00+03:00`;
  }
  if (clean.length === 19) {
    return `${clean}+03:00`;
  }
  return new Date(clean).toISOString();
}

// Convert ISO string from backend into "YYYY-MM-DDTHH:mm" for <input type="datetime-local">
// formatted in Ugandan Time (UTC+3 / Africa/Kampala)
export function toUgandanDatetimeLocal(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Kampala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(date);
  const getPart = (type) => parts.find(p => p.type === type)?.value || '00';
  return `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour')}:${getPart('minute')}`;
}

// Get current Ugandan Time formatted as "YYYY-MM-DDTHH:mm"
export function getUgandanNowDatetimeLocal() {
  return toUgandanDatetimeLocal(new Date().toISOString());
}

