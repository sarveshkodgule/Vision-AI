export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:8000`).replace(/\/$/, '');

async function request(method, endpoint, data, isForm = false) {
  const token = localStorage.getItem('token');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (data !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers,
    ...(data !== undefined ? { body: isForm ? data : JSON.stringify(data) } : {}),
  });
  const body = await response.json();
  if (!response.ok) {
    const detail = Array.isArray(body.detail)
      ? body.detail.map(item => item.msg).join('; ')
      : body.detail || body.message || `Request failed (${response.status})`;
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
