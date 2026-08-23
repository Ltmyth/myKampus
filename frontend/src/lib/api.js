const rawBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://examiner.ciu.ac.ug/api';
const API_BASE_URL = rawBaseUrl.replace(/\/$/, '');

export async function apiRequest(endpoint, options = {}) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${cleanEndpoint}`;

  // Set headers
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

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
    // If unauthorized and we have tokens, let's clear them or handle redirect in AuthContext
    if (response.status === 401 && typeof window !== 'undefined') {
      // LocalStorage is cleared if token is invalid/expired
      // Except if we are fetching login/verify token
      if (!endpoint.includes('/auth/login/')) {
        localStorage.removeItem('ciu_tokens');
        localStorage.removeItem('ciu_user');
      }
    }
    const errorMessage = data?.detail || data?.message || JSON.stringify(data) || 'Request failed';
    throw new Error(errorMessage);
  }

  return data;
}

export const api = {
  get: (endpoint, options) => apiRequest(endpoint, { method: 'GET', ...options }),
  post: (endpoint, body, options) => apiRequest(endpoint, { method: 'POST', body: JSON.stringify(body), ...options }),
  put: (endpoint, body, options) => apiRequest(endpoint, { method: 'PUT', body: JSON.stringify(body), ...options }),
  patch: (endpoint, body, options) => apiRequest(endpoint, { method: 'PATCH', body: JSON.stringify(body), ...options }),
  delete: (endpoint, options) => apiRequest(endpoint, { method: 'DELETE', ...options }),
};
