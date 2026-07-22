/* ==========================================================================
   TEMPLATES MANAGEMENT WITH VISUAL DESIGNER INTEGRATION (js/templates.js)
   ========================================================================== */

const Templates = {
  templates: [],
  filtered: [],
  searchTerm: '',
  filterCategory: '',
  sortBy: 'newest',

  async init() {
    await this.loadTemplates();
    this.setupEventListeners();
  },

  async loadTemplates() {
    try {
      const data = await Api.templates.list();
      this.templates = data && data.content ? data.content : (Array.isArray(data) ? data : []);
      if (this.templates.length === 0) {
        const defaults = Utils.getDefaultTemplates();
        for (const t of defaults) {
          const tCopy = { ...t };
          delete tCopy.id;
          tCopy.elements = Utils.getDefaultElements(tCopy);
          try {
            const created = await Api.templates.create(tCopy);
            this.templates.push(created);
          } catch (err) {
            console.error('Failed to create default template:', err);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load templates from API:', err);
      this.templates = [];
    }
    this.applyFilters();
    this.render();
  },

  applyFilters() {
    let result = [...this.templates];
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(t => 
        t.name.toLowerCase().includes(term) || 
        t.category.toLowerCase().includes(term) || 
        t.description.toLowerCase().includes(term)
      );
    }
    if (this.filterCategory) {
      result = result.filter(t => t.category === this.filterCategory);
    }
    if (this.sortBy === 'newest') result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    else if (this.sortBy === 'oldest') result.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    else if (this.sortBy === 'alpha') result.sort((a, b) => a.name.localeCompare(b.name));
    this.filtered = result;
  },

  render() {
    this.renderGrid();
    this.renderCategories();
  },

  renderGrid() {
    const container = document.getElementById('templateGrid');
    if (!container) return;

    if (!this.filtered.length) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-state-icon"><i class="fas fa-layer-group"></i></div>
          <h3>No Certificate Templates Available</h3>
          <p>${this.searchTerm ? 'Try adjusting your search or filters.' : 'Create your first template to get started.'}</p>
          ${!this.searchTerm ? '<button class="btn btn-primary" onclick="Templates.openAddModal()"><i class="fas fa-plus"></i> Create Template</button>' : ''}
        </div>`;
      return;
    }

    const categoryIcons = { 
      Internship: 'fas fa-briefcase', 
      Course: 'fas fa-graduation-cap'
    };

    container.innerHTML = this.filtered.map(t => {
      const orientIcon = t.orientation && t.orientation.toLowerCase() === 'portrait' ? 'fa-portrait' : 'fa-image';
      
      let badgeClass = 'badge-primary';
      if (t.status === 'Active') badgeClass = 'badge-success';
      else if (t.status === 'Draft') badgeClass = 'badge-warning';
      else if (t.status === 'Archived') badgeClass = 'badge-error';

      const previewStyle = t.bgConfig && t.bgConfig.type === 'gradient' ? 
        `background: ${t.bgConfig.gradient}` : 
        `background: ${t.bgConfig ? t.bgConfig.color : '#E3F2FD'}`;

      return `
        <div class="template-card animate-on-load">
          <div class="template-preview" style="${previewStyle}">
            ${t.bgConfig && t.bgConfig.image ? `<img src="${t.bgConfig.image}" class="template-preview-bg" alt="">` : ''}
            <div class="template-preview-content">
              <i class="${categoryIcons[t.category] || 'fas fa-file-alt'}"></i>
            </div>
          </div>
          <div class="template-body">
            <div class="template-name">${t.name}</div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <span class="badge badge-primary">${t.category}</span>
              <span style="font-size:12px; color:var(--text-muted);"><i class="fas ${orientIcon}"></i> ${t.orientation} (${t.paperSize || 'A4'})</span>
            </div>
            <div class="template-meta" style="margin-top:8px;">
              <span>Updated: ${Utils.formatDate(t.lastUpdated || t.createdAt)}</span>
              <span class="badge ${badgeClass}">${t.status}</span>
            </div>
          </div>
          <div class="template-actions">
            <button class="btn btn-sm btn-secondary" onclick="Templates.previewTemplate('${t.id}')" title="Preview"><i class="fas fa-eye"></i></button>
            <button class="btn btn-sm btn-primary" onclick="Templates.openDesigner('${t.id}')" title="Customize Canvas / Design Template"><i class="fas fa-magic"></i> Design</button>
            <button class="btn btn-sm btn-outline" onclick="Templates.duplicateTemplate('${t.id}')" title="Duplicate"><i class="fas fa-copy"></i></button>
            <button class="btn btn-sm btn-outline" style="margin-left:auto" onclick="Templates.confirmDelete('${t.id}')" title="Delete"><i class="fas fa-trash" style="color:var(--error)"></i></button>
          </div>
        </div>
      `;
    }).join('');
  },

  renderCategories() {
    const container = document.getElementById('templateCategories');
    if (!container) return;
    const cats = [...new Set(this.templates.map(t => t.category))];
    container.innerHTML = `
      <div class="tabs">
        <button class="tab ${!this.filterCategory ? 'active' : ''}" onclick="Templates.filterByCategory('')">All</button>
        ${cats.map(c => `
          <button class="tab ${this.filterCategory === c ? 'active' : ''}" onclick="Templates.filterByCategory('${c}')">${c}</button>
        `).join('')}
      </div>
    `;
  },

  filterByCategory(cat) {
    this.filterCategory = cat;
    this.applyFilters();
    this.render();
  },

  setupEventListeners() {
    const search = document.getElementById('templateSearch');
    if (search) {
      search.addEventListener('input', Utils.debounce((e) => {
        this.searchTerm = e.target.value;
        this.applyFilters();
        this.render();
      }));
    }
    const sort = document.getElementById('templateSort');
    if (sort) {
      sort.addEventListener('change', (e) => {
        this.sortBy = e.target.value;
        this.applyFilters();
        this.render();
      });
    }
  },

  openAddModal() { 
    this.openTemplateModal(); 
  },

  openEditModal(id) {
    // We direct edits straight to the full-screen interactive visual canvas editor
    this.openDesigner(id);
  },

  openDesigner(id) {
    const tpl = this.templates.find(t => t.id === id);
    if (tpl) {
      Designer.init(tpl);
    }
  },

  openTemplateModal(template = null) {
    const modal = document.getElementById('templateModal');
    const title = document.getElementById('templateModalTitle');
    if (!modal) return;
    title.textContent = template ? 'Edit Template' : 'Create Custom Template';
    const fields = ['name', 'category', 'description', 'orientation', 'paperSize', 'status'];
    fields.forEach(f => {
      const el = document.getElementById(`template${Utils.capitalize(f)}`);
      if (el) el.value = template ? (template[f] || '') : '';
    });
    modal.dataset.editId = template ? template.id : '';
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  },

  async saveTemplate() {
    const modal = document.getElementById('templateModal');
    const id = modal.dataset.editId;
    const fields = ['name', 'category', 'description', 'orientation', 'paperSize', 'status'];
    const data = {};
    fields.forEach(f => {
      const el = document.getElementById(`template${Utils.capitalize(f)}`);
      data[f] = el ? el.value : '';
    });

    if (!data.name || !data.category) {
      showToast('Validation Error', 'Template name and category are required', 'error');
      return;
    }

    let targetTemplate;

    try {
      if (id) {
        const idx = this.templates.findIndex(t => t.id === id);
        if (idx >= 0) {
          this.templates[idx] = { ...this.templates[idx], ...data };
          targetTemplate = this.templates[idx];
        }
        const updated = await Api.templates.update(id, targetTemplate);
        if (updated) this.templates[idx] = updated;
        showToast('Updated', 'Template details saved successfully', 'success');
      } else {
        data.createdAt = new Date().toISOString().split('T')[0];
        data.lastUpdated = data.createdAt;
        data.status = 'Draft';
        
        data.bgConfig = {
          type: 'gradient',
          color: '#FFFFFF',
          gradient: 'linear-gradient(135deg, #F5F9FF 0%, #E3F2FD 100%)',
          opacity: 1.0,
          image: '',
          size: 'cover',
          borderWidth: 0,
          borderColor: '#1565C0',
          borderStyle: 'double',
          watermark: '', watermarkOpacity: 0.15,
          watermarkWidth: 200, watermarkHeight: 200, watermarkScale: 100,
          watermarkAspectRatio: true, watermarkRotation: 0,
          watermarkX: null, watermarkY: null,
          watermarkVisible: true, watermarkLocked: false
        };
        data.elements = [];

        const created = await Api.templates.create(data);
        if (created) {
          data.id = created.id;
          data.elements = created.elements || [];
        }
        this.templates.unshift(created || data);
        targetTemplate = created || data;
        showToast('Created', 'New template registered', 'success');
      }

      modal.classList.remove('active');
      document.body.style.overflow = '';
      
      this.applyFilters();
      this.render();

      if (targetTemplate && !id) {
        setTimeout(() => {
          this.openDesigner(targetTemplate.id);
        }, 500);
      }
    } catch (err) {
      console.error('Failed to save template:', err);
      showToast('Error', err.message || 'Failed to save template to database', 'error');
    }
  },

  _fitCanvasToViewport(canvas, scaler, w, h) {
    const doFit = () => {
      const parentW = scaler.clientWidth || 800;
      const viewH = window.innerHeight * 0.7;
      const scale = Math.min(parentW / w, viewH / h, 1.0);
      canvas.style.transform = `scale(${scale})`;
      canvas.style.transformOrigin = 'top center';
      scaler.style.height = `${Math.ceil(h * scale)}px`;
    };
    doFit();
    if (this._fitHandler) window.removeEventListener('resize', this._fitHandler);
    this._fitHandler = doFit;
    window.addEventListener('resize', this._fitHandler);
  },

  previewTemplate(id) {
    const tpl = this.templates.find(t => t.id === id);
    if (!tpl) return;
    const modal = document.getElementById('templatePreviewModal');
    if (!modal) return;
    modal.querySelector('.modal-title').textContent = tpl.name;

    const settings = Utils.getFromStorage('settings') || { companyName: 'Samudhra Tech Solutions' };
    
    // Create a mock data object for variables rendering in template preview
    const mockData = {
      studentName: 'John Doe',
      registerNumber: 'STS1001',
      college: 'Samudhra College of Engineering',
      department: 'Computer Science',
      course: 'Full Stack Development',
      internshipTitle: 'Software Engineering Intern',
      duration: '3 Months',
      startDate: '2026-01-01',
      endDate: '2026-03-31',
      issueDate: '2026-04-01',
      certificateNumber: 'CERT-2026-0001',
      studentType: 'Internship'
    };

    // Deep clone template and ensure default elements are loaded if empty
    let templateToRender = JSON.parse(JSON.stringify(tpl));
    if (!templateToRender.elements || templateToRender.elements.length === 0) {
      templateToRender.elements = Utils.getDefaultElements(templateToRender);
    }

    const canvasHTML = Utils.renderCanvasHTML(templateToRender, mockData, settings, { isDesigner: false });

    modal.querySelector('.modal-body').innerHTML = `
      <div class="certificate-preview-modal-scaler" style="position:relative;width:100%;overflow:hidden;background:var(--designer-bg);padding:20px;display:flex;justify-content:center;align-items:flex-start;">
        ${canvasHTML}
      </div>
    `;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    const scaler = modal.querySelector('.certificate-preview-modal-scaler');
    const a4canvas = modal.querySelector('.certificate-a4-canvas');
    if (scaler && a4canvas) {
      const orientation = templateToRender.orientation || 'Landscape';
      const isPortrait = orientation.toLowerCase() === 'portrait';
      const paperSize = templateToRender.paperSize || 'A4';
      const isLetter = paperSize.toLowerCase() === 'letter';
      let canvasW, canvasH;
      if (isLetter) {
        canvasW = isPortrait ? 850 : 1100;
        canvasH = isPortrait ? 1100 : 850;
      } else {
        canvasW = isPortrait ? 794 : 1123;
        canvasH = isPortrait ? 1123 : 794;
      }
      this._fitCanvasToViewport(a4canvas, scaler, canvasW, canvasH);
    }
  },

  async duplicateTemplate(id) {
    const tpl = this.templates.find(t => t.id === id);
    if (!tpl) return;
    
    const copy = JSON.parse(JSON.stringify(tpl));
    delete copy.id; // Let database generate new ID
    copy.name = `${tpl.name} (Copy)`;
    copy.createdAt = new Date().toISOString().split('T')[0];
    copy.lastUpdated = copy.createdAt;
    
    try {
      const created = await Api.templates.create(copy);
      this.templates.unshift(created);
      this.applyFilters();
      this.render();
      showToast('Duplicated', 'Template duplicated successfully', 'success');
    } catch (err) {
      console.error('Failed to duplicate template:', err);
      showToast('Error', err.message || 'Failed to duplicate template', 'error');
    }
  },

  confirmDelete(id) {
    const tpl = this.templates.find(t => t.id === id);
    if (!tpl) return;
    const modal = document.getElementById('confirmModal');
    if (!modal) return;
    modal.querySelector('.modal-title').textContent = 'Delete Template';
    modal.querySelector('.modal-body').innerHTML = `
      <div style="text-align:center">
        <div style="font-size:48px;color:var(--error);margin-bottom:16px"><i class="fas fa-exclamation-triangle"></i></div>
        <h3 style="margin-bottom:8px">Delete "${tpl.name}"?</h3>
        <p style="color:var(--text-muted)">This action cannot be undone. The template and all associated data will be permanently removed.</p>
      </div>
    `;
    modal.querySelector('.modal-footer').innerHTML = `
      <button class="btn btn-outline" onclick="document.getElementById('confirmModal').classList.remove('active');document.body.style.overflow=''">Cancel</button>
      <button class="btn btn-danger" onclick="Templates.deleteTemplate('${id}')"><i class="fas fa-trash"></i> Delete Permanently</button>
    `;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  },

  async deleteTemplate(id) {
    try {
      await Api.templates.remove(id);
      this.templates = this.templates.filter(t => t.id !== id);
      document.getElementById('confirmModal').classList.remove('active');
      document.body.style.overflow = '';
      this.applyFilters();
      this.render();
      showToast('Deleted', 'Template has been removed', 'success');
    } catch (err) {
      console.error('Failed to delete template:', err);
      showToast('Error', err.message || 'Failed to delete template from database', 'error');
    }
  }
};

window.Templates = Templates;
