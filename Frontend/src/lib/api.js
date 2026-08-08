export const API_BASE_URL = `http://${window.location.hostname}:8000`;

export const api = {
  async get(endpoint) {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
      }
    });
    return response.json();
  },
  
  async post(endpoint, data, isForm = false) {
    const token = localStorage.getItem('token');
    const headers = {
      'Authorization': token ? `Bearer ${token}` : '',
    };
    
    if (!isForm) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: isForm ? data : JSON.stringify(data)
    });
    
    return response.json();
  }
};
