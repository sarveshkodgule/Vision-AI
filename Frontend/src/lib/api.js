export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:8000`).replace(/\/$/, '');

async function request(method, endpoint, data, isForm = false) {
  const token = localStorage.getItem('token');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (data !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  let response;
  try { response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers,
    ...(data !== undefined ? { body: isForm ? data : JSON.stringify(data) } : {}),
  }); } catch { throw new Error('Unable to reach the hospital service. Check your connection and try again.'); }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/google')) {
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    const detail = Array.isArray(body.detail)
      ? body.detail.map(item => item.msg).join('; ')
      : typeof body.detail === 'string' ? body.detail : body.message || (response.status === 401 ? 'Your session has expired. Please sign in again.' : 'The hospital service could not complete your request. Please try again.');
    const error = new Error(detail);
    error.response = { status: response.status, data: { ...body, detail } };
    throw error;
  }
  return body;
}

export const api = {
  get: endpoint => request('GET', endpoint),
  post: (endpoint, data, isForm = false) => request('POST', endpoint, data, isForm),
  put: (endpoint, data) => request('PUT', endpoint, data),
};
