/* ============================================
   DASHBOARD
   ============================================ */
const Dashboard = {
  data: {},

  async init() {
    await this.loadData();
    this.renderStats();
    this.renderChart();
    this.renderRecentActivities();
    this.renderRecentStudents();
    this.renderQuickActions();
    this.setupRefresh();
  },

  async loadData() {
    let students = [];
    let certificates = [];
    let templates = [];
    
    try {
      const data = await Api.students.list();
      students = data && data.content ? data.content : (Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load students:', err);
    }
    
    try {
      certificates = await Api.certificates.list() || [];
    } catch (err) {
      console.error('Failed to load certificates:', err);
    }

    try {
      const data = await Api.templates.list();
      templates = data && data.content ? data.content : (Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load templates:', err);
    }

    const today = new Date().toDateString();

    this.data = {
      totalStudents: students.length,
      totalCertificates: certificates.length,
      todayCertificates: certificates.filter(c => new Date(c.issueDate).toDateString() === today).length,
      activeTemplates: templates.filter(t => t.status === 'Active' || t.status === 'Draft').length,
      pendingCertificates: certificates.filter(c => c.status === 'Pending').length,
      verifiedCertificates: certificates.filter(c => c.status === 'Verified' || c.status === 'Valid').length,
      students,
      certificates,
      templates
    };
  },

  renderStats() {
    const container = document.getElementById('statsRow');
    if (!container) return;
    const stats = [
      { label: 'Total Students', value: this.data.totalStudents, icon: 'fas fa-users', color: 'blue' },
      { label: 'Total Certificates', value: this.data.totalCertificates, icon: 'fas fa-certificate', color: 'green' },
      { label: "Today's Certificates", value: this.data.todayCertificates, icon: 'fas fa-calendar-day', color: 'orange' },
      { label: 'Active Templates', value: this.data.activeTemplates, icon: 'fas fa-layer-group', color: 'purple' },
      { label: 'Pending', value: this.data.pendingCertificates, icon: 'fas fa-clock', color: 'orange' },
      { label: 'Verified', value: this.data.verifiedCertificates, icon: 'fas fa-check-circle', color: 'green' }
    ];

    container.innerHTML = stats.map(s => `
      <div class="stat-card ${s.color} animate-on-load">
        <div class="stat-card-header">
          <span class="stat-card-label">${s.label}</span>
          <div class="stat-card-icon"><i class="${s.icon}"></i></div>
        </div>
        <div class="stat-card-value stat-counter" data-target="${s.value}">0</div>
      </div>
    `).join('');

    setTimeout(() => {
      document.querySelectorAll('.stat-counter').forEach(el => {
        Utils.animateCounter(el, parseInt(el.dataset.target));
      });
    }, 400);
  },

  renderChart() {
    const container = document.getElementById('monthlyChart');
    if (!container) return;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const data = months.map(() => Math.floor(Math.random() * 80) + 10);
    const max = Math.max(...data);

    container.innerHTML = data.map((val, i) => `
      <div class="chart-bar-wrapper">
        <div class="chart-bar" style="height: ${(val / max) * 100}%; background: linear-gradient(to top, var(--primary), var(--primary-light));">
          <span class="chart-bar-value">${val}</span>
        </div>
        <span class="chart-bar-label">${months[i]}</span>
      </div>
    `).join('');
  },

  renderRecentActivities() {
    const container = document.getElementById('recentActivities');
    if (!container) return;
    const activities = [
      { icon: 'green', iconClass: 'fas fa-check', text: '<strong>John Doe</strong> certificate generated', time: '2 min ago' },
      { icon: 'blue', iconClass: 'fas fa-user-plus', text: '<strong>Jane Smith</strong> added as student', time: '15 min ago' },
      { icon: 'orange', iconClass: 'fas fa-edit', text: '<strong>Internship Template</strong> updated', time: '1 hour ago' },
      { icon: 'red', iconClass: 'fas fa-trash', text: '<strong>Old Template</strong> deleted', time: '2 hours ago' },
      { icon: 'green', iconClass: 'fas fa-check-circle', text: '<strong>Cert#STC2026001</strong> verified', time: '3 hours ago' },
      { icon: 'blue', iconClass: 'fas fa-download', text: '<strong>Monthly Report</strong> exported', time: '5 hours ago' }
    ];

    container.innerHTML = activities.map(a => `
      <div class="activity-item animate-on-load">
        <div class="activity-icon ${a.icon}"><i class="${a.iconClass}"></i></div>
        <div class="activity-content">
          <div class="activity-text">${a.text}</div>
          <div class="activity-time">${a.time}</div>
        </div>
      </div>
    `).join('');
  },

  renderRecentStudents() {
    const container = document.getElementById('recentStudents');
    if (!container) return;
    const students = this.data.students.slice(-5).reverse();
    if (!students.length) {
      container.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:24px;color:var(--text-muted)">No students yet</td></tr>';
      return;
    }
    container.innerHTML = students.map(s => `
      <tr>
        <td>
          <div class="recent-student-avatar">${Utils.getInitials(s.name)}</div>
          <div>
            <div style="font-weight:500;color:var(--text-primary)">${s.name}</div>
            <div style="font-size:12px;color:var(--text-muted)">${s.registerNumber || ''}</div>
          </div>
        </td>
        <td>${s.course || '-'}</td>
        <td><span class="badge badge-${s.status === 'Active' ? 'success' : 'warning'}">${s.status || 'Active'}</span></td>
      </tr>
    `).join('');
  },

  renderQuickActions() {
    const container = document.getElementById('quickActions');
    if (!container) return;
    const actions = [
      { icon: 'fas fa-user-graduate', label: 'Add Student', href: 'students.html' },
      { icon: 'fas fa-file-alt', label: 'New Template', href: 'templates.html' },
      { icon: 'fas fa-certificate', label: 'Generate', href: 'generate.html' },
      { icon: 'fas fa-check-double', label: 'Verify', href: 'verification.html' },
      { icon: 'fas fa-upload', label: 'Bulk Upload', href: 'students.html' },
      { icon: 'fas fa-chart-bar', label: 'Reports', href: 'reports.html' }
    ];

    container.innerHTML = actions.map(a => `
      <a href="${a.href}" class="quick-action-card animate-on-load">
        <i class="${a.icon}"></i>
        <span>${a.label}</span>
      </a>
    `).join('');
  },

  setupRefresh() {
    const btn = document.getElementById('refreshDashboard');
    if (!btn) return;
    btn.addEventListener('click', () => {
      this.init();
      showToast('Refreshed', 'Dashboard data updated', 'success');
    });
  }
};

window.Dashboard = Dashboard;
