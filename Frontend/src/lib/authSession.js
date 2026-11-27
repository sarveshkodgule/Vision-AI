export function getAuthToken() {
  return sessionStorage.getItem('token');
}

export function getAuthRole() {
  return sessionStorage.getItem('role');
}

export function setAuthSession(token, role) {
  sessionStorage.setItem('token', token);
  sessionStorage.setItem('role', role);
  localStorage.removeItem('token');
  localStorage.removeItem('role');
}

export function clearAuthSession() {
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('role');
  localStorage.removeItem('token');
  localStorage.removeItem('role');
}
