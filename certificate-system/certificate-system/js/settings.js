/* ============================================
   SETTINGS PAGE
   ============================================ */
const Settings = {
  settings: {},

  init() {
    this.loadSettings();
    this.populateForm();
    this.setupEventListeners();
    this.setupProfile();
  },

  loadSettings() {
    this.settings = Utils.getFromStorage('settings') || this.getDefaults();
  },

  getDefaults() {
    return {
      companyName: 'Samudhra Tech Solutions',
      companyEmail: 'contact@samudhratech.com',
      companyPhone: '+91 98765 43210',
      companyAddress: '123 Tech Park, Whitefield, Bangalore - 560066',
      companyWebsite: 'www.samudhratech.com',
      logo: '',
      signature: '',
      seal: '',
      theme: 'light',
      notifications: {
        email: true,
        browser: true,
        certificateGeneration: true,
        studentAdded: true
      }
    };
  },

  populateForm() {
    const s = this.settings;
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || '';
    };
    setVal('companyName', s.companyName);
    setVal('companyEmail', s.companyEmail);
    setVal('companyPhone', s.companyPhone);
    setVal('companyAddress', s.companyAddress);
    setVal('companyWebsite', s.companyWebsite);

    const logoPreview = document.getElementById('logoPreview');
    if (logoPreview && s.logo) logoPreview.innerHTML = `<img src="${s.logo}" alt="Logo">`;
    const sigPreview = document.getElementById('signaturePreview');
    if (sigPreview && s.signature) sigPreview.innerHTML = `<img src="${s.signature}" alt="Signature">`;
    const sealPreview = document.getElementById('sealPreview');
    if (sealPreview && s.seal) sealPreview.innerHTML = `<img src="${s.seal}" alt="Seal">`;

    if (s.notifications) {
      Object.keys(s.notifications).forEach(k => {
        const el = document.getElementById(`notif${Utils.capitalize(k)}`);
        if (el) el.checked = s.notifications[k];
      });
    }

    const logoLetter = document.getElementById('companyLogoLetter');
    if (logoLetter) logoLetter.textContent = Utils.getInitials(s.companyName || 'ST');
  },

  setupEventListeners() {
    const form = document.getElementById('settingsForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveSettings();
      });
    }
    document.querySelectorAll('.settings-save-btn').forEach(btn => {
      btn.addEventListener('click', () => this.saveSettings());
    });
    this.setupImageUpload('logoUpload', 'logoPreview');
    this.setupImageUpload('signatureUpload', 'signaturePreview');
    this.setupImageUpload('sealUpload', 'sealPreview');
  },

  setupImageUpload(inputId, previewId) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    if (!input || !preview) return;
    
    preview.addEventListener('click', () => input.click());
    
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        preview.innerHTML = `<img src="${ev.target.result}" alt="Preview">`;
        if (inputId === 'logoUpload') this.settings.logo = ev.target.result;
        else if (inputId === 'signatureUpload') this.settings.signature = ev.target.result;
        else if (inputId === 'sealUpload') this.settings.seal = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  },

  saveSettings() {
    const getVal = (id) => (document.getElementById(id) || {}).value || '';
    this.settings.companyName = getVal('companyName');
    this.settings.companyEmail = getVal('companyEmail');
    this.settings.companyPhone = getVal('companyPhone');
    this.settings.companyAddress = getVal('companyAddress');
    this.settings.companyWebsite = getVal('companyWebsite');

    if (this.settings.notifications) {
      Object.keys(this.settings.notifications).forEach(k => {
        const el = document.getElementById(`notif${Utils.capitalize(k)}`);
        if (el) this.settings.notifications[k] = el.checked;
      });
    }

    Utils.setToStorage('settings', this.settings);
    Utils.setToStorage('companySettings', this.settings);
    showToast('Saved', 'Settings updated successfully', 'success');

    const logoLetter = document.getElementById('companyLogoLetter');
    if (logoLetter) logoLetter.textContent = Utils.getInitials(this.settings.companyName || 'ST');
  },

  setupProfile() {
    const user = Utils.getFromStorage('currentUser') || { name: 'Admin User', email: 'admin@samudhratech.com' };
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || '';
    };
    setVal('profileName', user.name);
    setVal('profileEmail', user.email);

    const form = document.getElementById('profileForm');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('profileName').value.trim();
        const email = document.getElementById('profileEmail').value.trim();
        if (!name) { showToast('Error', 'Name is required', 'error'); return; }
        if (!email) { showToast('Error', 'Email is required', 'error'); return; }
        if (!Utils.isValidEmail(email)) { showToast('Error', 'Invalid email address', 'error'); return; }

        const submitBtn = form.querySelector('button[type="submit"]');
        await this.doProfileUpdate({
          name,
          email,
          currentPassword: '',
          newPassword: ''
        }, submitBtn);
      });
    }

    const passForm = document.getElementById('passwordForm');
    if (passForm) {
      passForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('profileName').value.trim();
        const email = document.getElementById('profileEmail').value.trim();
        const current = document.getElementById('currentPassword').value;
        const newPass = document.getElementById('newPassword').value;
        const confirm = document.getElementById('confirmPassword').value;

        if (!current || !newPass || !confirm) {
          showToast('Error', 'All password fields are required', 'error');
          return;
        }
        if (newPass !== confirm) {
          showToast('Error', 'New passwords do not match', 'error');
          return;
        }
        if (newPass.length < 6) {
          showToast('Error', 'Password must be at least 6 characters', 'error');
          return;
        }

        const submitBtn = passForm.querySelector('button[type="submit"]');
        await this.doProfileUpdate({
          name,
          email,
          currentPassword: current,
          newPassword: newPass
        }, submitBtn);

        passForm.reset();
      });
    }
  },

  async doProfileUpdate(payload, submitBtn) {
    const originalHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';

    try {
      const response = await Api.updateProfile(payload);
      Utils.setToStorage('authToken', response.token);
      Utils.setToStorage('currentUser', {
        id: response.id,
        name: response.name,
        email: response.email,
        role: 'ADMIN'
      });
      if (typeof App !== 'undefined') App.updateUserUI({ name: response.name, email: response.email });
      if (typeof Profile !== 'undefined') Profile.loadProfile();
      showToast('Success', 'Profile updated successfully', 'success');
    } catch (error) {
      showToast('Error', error.message || 'Failed to update profile', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalHtml;
    }
  }
};

/* === Profile Page === */
const Profile = {
  init() {
    this.loadProfile();
    this.setupEvents();
    if (typeof Settings !== 'undefined' && Settings.setupProfile) {
      Settings.setupProfile();
    }
  },

  loadProfile() {
    const user = Utils.getFromStorage('currentUser') || { name: 'Admin User', email: 'admin@samudhratech.com' };
    const settings = Utils.getFromStorage('settings') || {};
    const nameEl = document.getElementById('profileDisplayName');
    const emailEl = document.getElementById('profileDisplayEmail');
    const phoneEl = document.getElementById('profileDisplayPhone');
    const avatarEl = document.getElementById('profileAvatar');
    if (nameEl) nameEl.textContent = user.name;
    if (emailEl) emailEl.textContent = user.email;
    if (phoneEl) phoneEl.textContent = settings.companyPhone || user.phone || '+91 98765 43210';
    if (avatarEl) avatarEl.textContent = Utils.getInitials(user.name);
  },

  setupEvents() {
    const editBtn = document.getElementById('editProfileBtn');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        const form = document.getElementById('profileForm');
        if (form) {
          form.scrollIntoView({ behavior: 'smooth' });
          const nameInput = document.getElementById('profileName');
          if (nameInput) nameInput.focus();
        }
      });
    }
  }
};

/* === Reports Page === */
const Reports = {
  certificates: [],

  async init() {
    try {
      this.certificates = await Api.certificates.list() || [];
    } catch (err) {
      console.error('Failed to load certificates for reports:', err);
      this.certificates = [];
    }
    await this.renderCharts();
    this.setupExports();
    this.renderStats();
  },

  renderStats() {
    const container = document.getElementById('reportStats');
    if (!container) return;
    const total = this.certificates.length;
    container.innerHTML = `
      <div class="stat-card blue"><div class="stat-card-label">Total Generated</div><div class="stat-card-value">${total}</div></div>
      <div class="stat-card green"><div class="stat-card-label">Verified</div><div class="stat-card-value">${this.certificates.filter(c => c.status === 'Verified' || c.status === 'Valid').length}</div></div>
      <div class="stat-card orange"><div class="stat-card-label">Pending</div><div class="stat-card-value">${this.certificates.filter(c => c.status === 'Pending').length}</div></div>
    `;
  },

  async renderCharts() {
    this.renderMonthlyChart();
    this.renderCollegeChart();
    await this.renderTemplateChart();
  },

  renderMonthlyChart() {
    const container = document.getElementById('monthlyReportChart');
    if (!container) return;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const data = months.map(() => Math.floor(Math.random() * 50) + 5);
    const max = Math.max(...data);
    container.innerHTML = data.map((v, i) => `
      <div class="chart-bar-wrapper">
        <div class="chart-bar" style="height:${(v/max)*100}%;background:linear-gradient(to top,var(--primary),var(--primary-light))">
          <span class="chart-bar-value">${v}</span>
        </div>
        <span class="chart-bar-label">${months[i]}</span>
      </div>
    `).join('');
  },

  renderCollegeChart() {
    const container = document.getElementById('collegeChart');
    if (!container) return;
    const colleges = {};
    this.certificates.forEach(c => { const clg = c.college || 'Unknown'; colleges[clg] = (colleges[clg] || 0) + 1; });
    const entries = Object.entries(colleges).sort((a, b) => b[1] - a[1]);
    if (!entries.length) { container.innerHTML = '<p style="color:var(--text-muted);padding:20px">No data available</p>'; return; }
    const max = entries[0][1];
    container.innerHTML = entries.map(([name, count]) => `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
        <span style="font-size:13px;min-width:120px;color:var(--text-secondary)">${Utils.truncate(name, 18)}</span>
        <div class="progress-bar" style="flex:1"><div class="progress-bar-fill" style="width:${(count/max)*100}%"></div></div>
        <span style="font-size:13px;font-weight:600;min-width:30px;text-align:right">${count}</span>
      </div>
    `).join('');
  },

  async renderTemplateChart() {
    const container = document.getElementById('templateReportChart');
    if (!container) return;
    const templatesCount = {};
    this.certificates.forEach(c => { const t = c.templateId || 'Unknown'; templatesCount[t] = (templatesCount[t] || 0) + 1; });
    
    let allTemplates = [];
    try {
      const data = await Api.templates.list();
      allTemplates = data && data.content ? data.content : (Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
    
    const entries = Object.entries(templatesCount).sort((a, b) => b[1] - a[1]);
    if (!entries.length) { container.innerHTML = '<p style="color:var(--text-muted);padding:20px">No data available</p>'; return; }
    const max = entries[0][1];
    container.innerHTML = entries.map(([id, count]) => {
      const name = (allTemplates.find(t => t.id === id) || {}).name || 'Unknown';
      return `<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
        <span style="font-size:13px;min-width:140px;color:var(--text-secondary)">${name}</span>
        <div class="progress-bar" style="flex:1"><div class="progress-bar-fill" style="width:${(count/max)*100}%"></div></div>
        <span style="font-size:13px;font-weight:600;min-width:30px;text-align:right">${count}</span>
      </div>`;
    }).join('');
  },

  setupExports() {
    document.querySelectorAll('[data-export]').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.export;
        const data = this.certificates.length ? this.certificates : [{ Message: 'No certificate data available' }];
        if (type === 'pdf') {
          Utils.downloadPDF('', 'certificate-report');
        } else {
          Utils.exportToCSV(data, `certificate-report-${new Date().toISOString().split('T')[0]}`);
        }
        showToast('Exported', `Report exported as ${type.toUpperCase()}`, 'success');
      });
    });
  }
};

window.Settings = Settings;
window.Profile = Profile;
window.Reports = Reports;
