/* REST client used by the existing vanilla-JS pages.  UI code remains unchanged. */
const Api = {
  baseUrl: window.location.origin.startsWith('http') ? window.location.origin : 'http://localhost:8080',
  async request(path, options = {}) {
    const headers = { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(options.headers || {}) };
    const token = Utils.getFromStorage('authToken');
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(this.baseUrl + path, { ...options, headers });
    
    if (response.status === 401 || response.status === 403) {
      Utils.removeFromStorage('authToken');
      Utils.removeFromStorage('currentUser');
      if (!window.location.pathname.endsWith('login.html')) {
        window.location.href = 'login.html?expired=true';
        return null;
      }
    }

    const text = await response.text();
    const body = text ? JSON.parse(text) : null;
    if (!response.ok || (body && body.success === false)) throw new Error(body?.message || 'Request failed');
    return body?.data;
  },
  login(email, password) { return this.request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }); },
  updateProfile(data) { return this.request('/api/users/profile', { method: 'PUT', body: JSON.stringify(data) }); },
  upload(purpose, file) { const form = new FormData(); form.append('file', file); return this.request(`/api/upload/${purpose}`, { method: 'POST', body: form }); },
  templates: { list: () => Api.request('/api/templates'), get: id => Api.request(`/api/templates/${id}`), create: data => Api.request('/api/templates', { method:'POST', body:JSON.stringify(data) }), update: (id,data) => Api.request(`/api/templates/${id}`, { method:'PUT', body:JSON.stringify(data) }), publish: id => Api.request(`/api/templates/${id}/publish`, { method:'POST' }), remove: id => Api.request(`/api/templates/${id}`, { method:'DELETE' }) },
  students: {
    list: (search = '') => Api.request(`/api/students?search=${encodeURIComponent(search)}`),
    create: data => Api.request('/api/students', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => Api.request(`/api/students/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: id => Api.request(`/api/students/${id}`, { method: 'DELETE' })
  },
  certificates: {
    generate: data => Api.request('/api/certificates/generate', { method: 'POST', body: JSON.stringify(data) }),
    list: () => Api.request('/api/certificates'),
    verify: number => Api.request(`/api/certificates/verify/${number}`)
  }
};
