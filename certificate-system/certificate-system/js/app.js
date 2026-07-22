/* ============================================
   APP - CORE APPLICATION
   ============================================ */
const App = {
  currentUser: null,

  async init() {
    await this.ensureAuth();
    this.loadUser();
    this.setupSidebar();
    this.setupNavbar();
    this.setupTheme();
    this.setupLoadingScreen();
    this.setupRevealAnimations();
    this.setupRippleButtons();
    this.setupDropdowns();
    this.setupModals();
    this.setupToasts();
    this.setupMobileMenu();
    this.highlightActiveNav();
    this.initPageSpecific();
    this.setupLogout();
  },

  async ensureAuth() {
    const user = Utils.getFromStorage('currentUser');
    const token = Utils.getFromStorage('authToken');
    const page = window.location.pathname.split('/').pop() || 'dashboard.html';
    const publicPages = ['login.html', 'verification.html', 'index.html'];
    if (publicPages.includes(page)) {
      return;
    }
    if (!user || !token) {
      window.location.href = 'login.html';
    }
  },

  setupLogout() {
    document.querySelectorAll('a[href="login.html"]').forEach(link => {
      link.addEventListener('click', () => {
        Utils.removeFromStorage('currentUser');
        Utils.removeFromStorage('authToken');
      });
    });
  },

  loadUser() {
    const user = Utils.getFromStorage('currentUser');
    if (user) {
      this.currentUser = user;
      this.updateUserUI(user);
    }
  },

  updateUserUI(user) {
    document.querySelectorAll('.navbar-profile-name').forEach(el => {
      el.textContent = user.name || 'Admin';
    });
    document.querySelectorAll('.navbar-profile-role').forEach(el => {
      el.textContent = user.role || 'Administrator';
    });
    document.querySelectorAll('.avatar-placeholder').forEach(el => {
      if (el) el.textContent = Utils.getInitials(user.name || 'Admin');
    });
    document.querySelectorAll('.profile-name-display').forEach(el => {
      el.textContent = user.name || 'Admin User';
    });
    document.querySelectorAll('.profile-email-display').forEach(el => {
      el.textContent = user.email || 'admin@samudhratech.com';
    });
  },

  setupSidebar() {
    const toggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');

    if (toggle && sidebar) {
      toggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        if (mainContent) mainContent.classList.toggle('expanded');
        const navbar = document.getElementById('navbar');
        if (navbar) navbar.classList.toggle('expanded');
      });
    }
  },

  setupNavbar() {
    const searchToggle = document.getElementById('mobileSearchToggle');
    const navbar = document.getElementById('navbar');
    if (searchToggle && navbar) {
      searchToggle.addEventListener('click', () => {
        navbar.classList.toggle('mobile-search-visible');
      });
    }
  },

  setupTheme() {
    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;
    const saved = localStorage.getItem('darkMode') === 'true';
    if (saved) {
      document.body.classList.add('dark-mode');
      toggle.classList.add('active');
    }
    toggle.addEventListener('click', () => {
      const isDark = document.body.classList.toggle('dark-mode');
      toggle.classList.toggle('active');
      localStorage.setItem('darkMode', isDark);
    });
  },

  setupLoadingScreen() {
    const loader = document.getElementById('loadingScreen');
    if (!loader) return;
    window.addEventListener('load', () => {
      setTimeout(() => loader.classList.add('hidden'), 600);
    });
    setTimeout(() => loader.classList.add('hidden'), 2000);
  },

  setupRevealAnimations() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  },

  setupRippleButtons() {
    document.querySelectorAll('.btn').forEach(btn => {
      btn.classList.add('ripple');
    });
  },

  setupDropdowns() {
    document.addEventListener('click', (e) => {
      const dropdown = e.target.closest('.dropdown');
      document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
        if (!dropdown || !menu.closest('.dropdown').contains(e.target)) {
          menu.classList.remove('show');
        }
      });
      if (dropdown) {
        const menu = dropdown.querySelector('.dropdown-menu');
        if (menu) menu.classList.toggle('show');
      }
    });
  },

  setupModals() {
    document.addEventListener('click', (e) => {
      const closeBtn = e.target.closest('.modal-close');
      const overlay = e.target.closest('.modal-overlay');
      if (closeBtn || (overlay && e.target === overlay)) {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  },

  setupToasts() {
    window.showToast = (title, message, type = 'info') => {
      const container = document.getElementById('toastContainer');
      if (!container) return;
      const icons = { success: 'fas fa-check-circle', error: 'fas fa-times-circle', warning: 'fas fa-exclamation-triangle', info: 'fas fa-info-circle' };
      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.innerHTML = `
        <i class="${icons[type] || icons.info} toast-icon"></i>
        <div class="toast-content">
          <div class="toast-title">${title}</div>
          <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.closest('.toast').remove()">&times;</button>
      `;
      container.appendChild(toast);
      setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
      }, 4000);
    };
  },

  setupMobileMenu() {
    const hamburger = document.getElementById('mobileMenuToggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (hamburger && sidebar) {
      hamburger.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
        if (overlay) overlay.classList.toggle('active');
      });
    }
    if (overlay) {
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('mobile-open');
        overlay.classList.remove('active');
      });
    }
  },

  highlightActiveNav() {
    const page = window.location.pathname.split('/').pop() || 'dashboard.html';
    document.querySelectorAll('.sidebar-link').forEach(link => {
      const href = link.getAttribute('href');
      if (href === page) link.classList.add('active');
    });
  },

  initPageSpecific() {
    const page = window.location.pathname.split('/').pop() || 'dashboard.html';
    if (page === 'dashboard.html' && typeof Dashboard !== 'undefined') Dashboard.init();
    else if (page === 'students.html' && typeof Students !== 'undefined') Students.init();
    else if (page === 'templates.html' && typeof Templates !== 'undefined') Templates.init();
    else if (page === 'generate.html' && typeof Certificate !== 'undefined') Certificate.init();
    else if (page === 'preview.html' && typeof Certificate !== 'undefined') Certificate.initPreview();
    else if (page === 'verification.html' && typeof Verification !== 'undefined') Verification.init();
    else if (page === 'reports.html' && typeof Reports !== 'undefined') Reports.init();
    else if (page === 'settings.html' && typeof Settings !== 'undefined') Settings.init();
    else if (page === 'profile.html' && typeof Profile !== 'undefined') Profile.init();
    else if (page === 'login.html' && typeof Login !== 'undefined') Login.init();
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  // Hydrate durable image assets before any page renders a template.
  if (typeof Utils !== 'undefined' && Utils.initializeStorage) await Utils.initializeStorage();
  await App.init();
});
