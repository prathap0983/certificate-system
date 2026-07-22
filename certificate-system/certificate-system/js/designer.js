const Designer = {
  activeTemplate: null,
  elements: [],
  selectedElementId: null,
  zoomLevel: 1.0,
  gridEnabled: false,
  snapEnabled: false,
  undoStack: [],
  redoStack: [],
  isDragging: false,
  isResizing: false,
  isRotating: false,
  dragStart: { x: 0, y: 0 },
  activeHandle: null,
  initialElementRect: null,
  initialAngle: 0,
  initialRotation: 0,

  brandElementIds: {
    logo: 'el_logo',
    signature: 'el_signature',
    seal: 'el_seal'
  },

  fonts: [
    'Poppins', 'Inter', 'Roboto', 'Open Sans', 'Montserrat', 'Lato',
    'Nunito', 'Playfair Display', 'Merriweather', 'Times New Roman',
    'Georgia', 'Arial', 'Verdana', 'Tahoma'
  ],

  // ========== INIT ==========
  init(template) {
    this.activeTemplate = template;
    this.elements = template.elements && template.elements.length > 0 ? template.elements : Utils.getDefaultElements(template);
    
    // Auto-populate empty image elements from settings if they are empty
    const settings = Utils.getFromStorage('settings') || {};
    this.elements.forEach(el => {
      if (el.type === 'image' && !el.content) {
        const role = Utils.getImageRole(el);
        if (role === 'signature') {
          el.content = settings.signature || '';
        } else if (role === 'seal') {
          el.content = settings.seal || '';
        } else if (role === 'logo') {
          el.content = settings.logo || '';
        }
      }
    });

    this.syncBackgroundElement();

    this.selectedElementId = null;
    this.zoomLevel = 1.0;
    this.gridEnabled = false;
    this.snapEnabled = false;
    this.undoStack = [];
    this.redoStack = [];

    const container = document.getElementById('designerContainer');
    if (!container) return;
    container.classList.add('active');
    document.body.style.overflow = 'hidden';

    const titleInput = document.getElementById('designerTemplateName');
    if (titleInput) titleInput.value = template.name || 'Untitled Template';

    this.populateSidebarDropdowns();
    this.setupSectionEvents();
    this.setupEventListeners();
    this.updateCanvasSpecifications();
    this.renderCanvas();
    this.loadAllSectionSettings();
    this.saveState();
  },

  async close() {
    const container = document.getElementById('designerContainer');
    if (container) container.classList.remove('active');
    document.body.style.overflow = '';
    if (typeof Templates !== 'undefined') {
      await Templates.loadTemplates();
      Templates.render();
    }
  },

  // ========== SIDEBAR ==========
  populateSidebarDropdowns() {
    const familySelect = document.getElementById('textFontFamily');
    if (familySelect) {
      familySelect.innerHTML = this.fonts.map(f =>
        `<option value="${f}" style="font-family:'${f}'">${f}</option>`
      ).join('');
    }
  },

  toggleCollapsible(header) {
    header.classList.toggle('collapsed');
  },

  // ========== SECTION SAVE/LOAD ==========
  saveSection(section) {
    switch (section) {
      case 'background': this.saveBackground(); break;
      case 'logo': this.saveBrandElement('logo'); break;
      case 'signature': this.saveBrandElement('signature'); break;
      case 'seal': this.saveBrandElement('seal'); break;
      case 'borders': this.saveBorderSettings(); break;
      case 'watermark': this.saveWatermark(); break;
    }
  },

  saveBackground() {
    const bg = this.activeTemplate.bgConfig || {};
    bg.color = document.getElementById('bgColorInput').value;
    bg.opacity = parseInt(document.getElementById('bgOpacityRange').value) / 100;
    bg.size = document.getElementById('bgSizeSelect').value;
    this.activeTemplate.bgConfig = bg;
    this.persistTemplate();
    showToast('Background', 'Background settings saved', 'success');
  },

  saveBrandElement(type) {
    const id = this.brandElementIds[type];
    const el = this.elements.find(e => e.id === id);
    if (!el) {
      showToast('Warning', `No ${type} element on canvas to save`, 'warning');
      return;
    }
    const wId = type === 'logo' ? 'logoWidth' : type === 'signature' ? 'sigWidth' : 'sealWidth';
    const hId = type === 'logo' ? 'logoHeight' : type === 'signature' ? 'sigHeight' : 'sealHeight';
    const w = parseInt(document.getElementById(wId).value) || el.width;
    const h = parseInt(document.getElementById(hId).value) || el.height;
    if (el.locked) {
      showToast('Warning', `${type} is locked, unlock to resize`, 'warning');
      return;
    }
    el.width = w;
    el.height = h;
    const lockId = type === 'logo' ? 'logoLockToggle' : type === 'signature' ? 'sigLockToggle' : 'sealLockToggle';
    el.locked = document.getElementById(lockId).checked;
    this.persistTemplate();
    this.renderCanvas();
    showToast('Saved', `${type.charAt(0).toUpperCase() + type.slice(1)} settings saved`, 'success');
  },

  saveTextElement() {
    if (!this.selectedElementId) {
      showToast('Info', 'Select a text element on canvas first', 'info');
      return;
    }
    const item = this.elements.find(el => el.id === this.selectedElementId);
    if (!item || item.type !== 'text') {
      showToast('Info', 'Select a text element first', 'info');
      return;
    }
    this.saveState();
    item.content = document.getElementById('textInputContent').value;
    item.fontFamily = document.getElementById('textFontFamily').value;
    item.fontSize = parseInt(document.getElementById('textFontSize').value) || 16;
    item.fontWeight = document.getElementById('textFontWeight').value;
    item.color = document.getElementById('textColorInput').value;
    item.letterSpacing = parseFloat(document.getElementById('textLetterSpacing').value) || 0;
    item.lineHeight = parseFloat(document.getElementById('textLineHeight').value) || 1.5;
    item.textShadow = document.getElementById('textShadowSelect').value;
    item.borderWidth = parseInt(document.getElementById('textBorderRange').value) || 0;
    item.borderColor = document.getElementById('textBorderColorInput').value;
    item.borderRadius = parseInt(document.getElementById('textBorderRadiusRange').value) || 0;
    item.opacity = parseInt(document.getElementById('textOpacityRange').value) / 100;
    item.x = parseInt(document.getElementById('textPosX').value) || item.x;
    item.y = parseInt(document.getElementById('textPosY').value) || item.y;
    item.width = parseInt(document.getElementById('textSizeW').value) || item.width;
    item.height = parseInt(document.getElementById('textSizeH').value) || item.height;
    item.rotation = parseFloat(document.getElementById('textRotationRange').value) || 0;
    const activeAlign = document.querySelector('.align-toggle.active');
    if (activeAlign) item.textAlign = activeAlign.dataset.align;
    const activeTransform = document.querySelector('.text-transform-btn.active');
    if (activeTransform) item.textTransform = activeTransform.dataset.transform;
    this.persistTemplate();
    this.renderCanvas();
    showToast('Saved', 'Text element properties saved', 'success');
  },

  saveImageElement() {
    if (!this.selectedElementId) {
      showToast('Info', 'Select an image/signature element on canvas first', 'info');
      return;
    }
    const item = this.elements.find(el => el.id === this.selectedElementId);
    if (!item || item.type !== 'image') {
      showToast('Info', 'Select an image/signature element first', 'info');
      return;
    }
    this.saveState();
    item.placeholder = document.getElementById('imageInputLabel').value || item.placeholder;
    item.width = parseInt(document.getElementById('imageSizeW').value) || item.width;
    item.height = parseInt(document.getElementById('imageSizeH').value) || item.height;
    item.x = parseInt(document.getElementById('imagePosX').value) || item.x;
    item.y = parseInt(document.getElementById('imagePosY').value) || item.y;
    item.opacity = parseInt(document.getElementById('imageOpacityRange').value) / 100;
    item.rotation = parseFloat(document.getElementById('imageRotationRange').value) || 0;
    this.persistTemplate();
    this.renderCanvas();
    showToast('Saved', 'Image element properties saved', 'success');
  },

  saveBorderSettings() {
    const bg = this.activeTemplate.bgConfig || {};
    const enabled = document.getElementById('borderEnableToggle').checked;
    bg.borderWidth = enabled ? (parseInt(document.getElementById('borderWidthRange').value) || 4) : 0;
    bg.borderColor = document.getElementById('borderColorInput').value;
    bg.borderStyle = document.getElementById('borderStyleSelect').value;
    bg.borderRadius = parseInt(document.getElementById('borderRadiusRange').value) || 0;
    this.activeTemplate.bgConfig = bg;
    this.applyBackgroundConfig();
    this.persistTemplate();
    showToast('Borders', 'Border settings saved', 'success');
  },

  saveWatermark() {
    if (!this.activeTemplate.bgConfig) this.activeTemplate.bgConfig = {};
    const bg = this.activeTemplate.bgConfig;
    bg.watermarkOpacity = parseInt(document.getElementById('wmOpacityRange').value) / 100;
    bg.watermarkWidth = parseInt(document.getElementById('wmWidth').value) || 200;
    bg.watermarkHeight = parseInt(document.getElementById('wmHeight').value) || 200;
    bg.watermarkScale = parseInt(document.getElementById('wmScaleRange').value) || 100;
    bg.watermarkAspectRatio = document.getElementById('wmAspectToggle').checked;
    bg.watermarkX = parseInt(document.getElementById('wmPosX').value) || null;
    bg.watermarkY = parseInt(document.getElementById('wmPosY').value) || null;
    bg.watermarkRotation = parseFloat(document.getElementById('wmRotationRange').value) || 0;
    bg.watermarkVisible = true;
    bg.watermarkLocked = false;
    this.persistTemplate();
    this.applyBackgroundConfig();
    showToast('Watermark', 'Watermark settings saved', 'success');
  },

  loadAllSectionSettings() {
    const bg = this.activeTemplate.bgConfig || {
      type: 'color', color: '#FFFFFF', opacity: 1.0, image: '',
      size: 'cover', borderWidth: 0, borderColor: '#1565C0',
      borderStyle: 'solid', borderRadius: 0,
      watermark: '', watermarkOpacity: 0.15, watermarkWidth: 200, watermarkHeight: 200,
      watermarkScale: 100, watermarkAspectRatio: true, watermarkX: null, watermarkY: null,
      watermarkRotation: 0, watermarkVisible: true, watermarkLocked: false
    };
    if (!this.activeTemplate.bgConfig) this.activeTemplate.bgConfig = bg;

    // Background
    const bgColorInput = document.getElementById('bgColorInput');
    if (bgColorInput) bgColorInput.value = bg.color || '#FFFFFF';
    const bgOpacityRange = document.getElementById('bgOpacityRange');
    if (bgOpacityRange) bgOpacityRange.value = Math.round((bg.opacity || 1) * 100);
    const bgSizeSelect = document.getElementById('bgSizeSelect');
    if (bgSizeSelect) bgSizeSelect.value = bg.size || 'cover';

    // Background image
    if (bg.image) {
      this.showBgPreview(bg.image);
    }

    // Borders
    const borderToggle = document.getElementById('borderEnableToggle');
    if (borderToggle) {
      borderToggle.checked = (bg.borderWidth || 0) > 0;
      this.toggleBorderControls(borderToggle.checked);
    }
    const borderWidthRange = document.getElementById('borderWidthRange');
    if (borderWidthRange) borderWidthRange.value = bg.borderWidth || 4;
    const borderColorInput = document.getElementById('borderColorInput');
    if (borderColorInput) borderColorInput.value = bg.borderColor || '#1565C0';
    const borderStyleSelect = document.getElementById('borderStyleSelect');
    if (borderStyleSelect) borderStyleSelect.value = bg.borderStyle || 'solid';
    const borderRadiusRange = document.getElementById('borderRadiusRange');
    if (borderRadiusRange) borderRadiusRange.value = bg.borderRadius || 0;

    // Watermark
    if (bg.watermark) {
      this.showWmPreview(bg.watermark);
    }
    const wmOpacity = document.getElementById('wmOpacityRange');
    if (wmOpacity) wmOpacity.value = Math.round((bg.watermarkOpacity || 0.15) * 100);
    const wmOpacityLabel = document.getElementById('wmOpacityLabel');
    if (wmOpacityLabel) wmOpacityLabel.textContent = `${Math.round((bg.watermarkOpacity || 0.15) * 100)}%`;
    const wmWidth = document.getElementById('wmWidth');
    if (wmWidth) wmWidth.value = bg.watermarkWidth || 200;
    const wmHeight = document.getElementById('wmHeight');
    if (wmHeight) wmHeight.value = bg.watermarkHeight || 200;
    const wmScale = document.getElementById('wmScaleRange');
    if (wmScale) wmScale.value = bg.watermarkScale || 100;
    const wmScaleLabel = document.getElementById('wmScaleLabel');
    if (wmScaleLabel) wmScaleLabel.textContent = `${bg.watermarkScale || 100}%`;
    const wmAspect = document.getElementById('wmAspectToggle');
    if (wmAspect) wmAspect.checked = bg.watermarkAspectRatio !== false;
    const wmPosX = document.getElementById('wmPosX');
    if (wmPosX) wmPosX.value = bg.watermarkX !== null ? bg.watermarkX : '';
    const wmPosY = document.getElementById('wmPosY');
    if (wmPosY) wmPosY.value = bg.watermarkY !== null ? bg.watermarkY : '';
    const wmRot = document.getElementById('wmRotationRange');
    if (wmRot) wmRot.value = bg.watermarkRotation || 0;
    const wmRotLabel = document.getElementById('wmRotationLabel');
    if (wmRotLabel) wmRotLabel.textContent = `${bg.watermarkRotation || 0}°`;
    const wmVisBtn = document.getElementById('wmToggleVisibility');
    const wmVisText = document.getElementById('wmVisibilityText');
    if (wmVisBtn && wmVisText) {
      const isVis = bg.watermarkVisible !== false;
      wmVisBtn.innerHTML = isVis ? '<i class="fas fa-eye"></i> <span id="wmVisibilityText">Hide</span>' : '<i class="fas fa-eye-slash"></i> <span id="wmVisibilityText">Show</span>';
    }
    const wmLockBtn = document.getElementById('wmToggleLock');
    const wmLockText = document.getElementById('wmLockText');
    if (wmLockBtn && wmLockText) {
      const isLocked = bg.watermarkLocked || false;
      wmLockBtn.innerHTML = isLocked ? '<i class="fas fa-lock"></i> <span id="wmLockText">Unlock</span>' : '<i class="fas fa-lock-open"></i> <span id="wmLockText">Lock</span>';
    }

    // Brand elements
    this.loadBrandElementPreview('logo');
    this.loadBrandElementPreview('signature');
    this.loadBrandElementPreview('seal');

    this.applyBackgroundConfig();
  },

  loadBrandElementPreview(type) {
    const id = this.brandElementIds[type];
    const el = this.elements.find(e => e.id === id);
    if (el && el.content) {
      const cardId = type === 'logo' ? 'logoPreviewCard' : type === 'signature' ? 'sigPreviewCard' : 'sealPreviewCard';
      const imgId = type === 'logo' ? 'logoPreviewImg' : type === 'signature' ? 'sigPreviewImg' : 'sealPreviewImg';
      const fnId = type === 'logo' ? 'logoFileName' : type === 'signature' ? 'sigFileName' : 'sealFileName';
      const wId = type === 'logo' ? 'logoWidth' : type === 'signature' ? 'sigWidth' : 'sealWidth';
      const hId = type === 'logo' ? 'logoHeight' : type === 'signature' ? 'sigHeight' : 'sealHeight';
      const card = document.getElementById(cardId);
      const img = document.getElementById(imgId);
      const fn = document.getElementById(fnId);
      const wInput = document.getElementById(wId);
      const hInput = document.getElementById(hId);
      if (card) card.style.display = 'flex';
      if (img) img.src = el.content;
      if (fn) fn.textContent = el.placeholder || type;
      if (wInput) wInput.value = el.width || 120;
      if (hInput) hInput.value = el.height || 60;
      if (type === 'logo') {
        const lockToggle = document.getElementById('logoLockToggle');
        if (lockToggle) lockToggle.checked = el.locked || false;
      }
      if (type === 'signature') {
        const lockToggle = document.getElementById('sigLockToggle');
        if (lockToggle) lockToggle.checked = el.locked || false;
      }
      if (type === 'seal') {
        const lockToggle = document.getElementById('sealLockToggle');
        if (lockToggle) lockToggle.checked = el.locked || false;
      }
    }
  },

  // ========== BACKGROUND IMAGE ==========
  setupBgUpload() {
    const dropZone = document.getElementById('bgDropZone');
    const input = document.getElementById('customBgUpload');
    if (!dropZone || !input) return;

    const handleFile = (file) => {
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        showToast('Error', 'Image exceeds 5MB limit', 'error');
        return;
      }
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        showToast('Error', 'Only JPG, JPEG, PNG, WebP allowed', 'error');
        return;
      }
      const r = new FileReader();
      r.onload = (ev) => {
        this.saveState();
        this.activeTemplate.bgConfig.image = ev.target.result;
        this.syncBackgroundElement();
        this.persistTemplate();
        this.showBgPreview(ev.target.result);
        this.applyBackgroundConfig();
        this.renderCanvas();
        showToast('Background', 'Background image uploaded', 'success');
      };
      r.readAsDataURL(file);
    };

    input.addEventListener('change', (e) => {
      handleFile(e.target.files[0]);
      input.value = '';
    });

    dropZone.addEventListener('click', () => input.click());

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });
  },

  showBgPreview(src) {
    const preview = document.getElementById('bgDropPreview');
    const content = document.getElementById('bgDropContent');
    const img = document.getElementById('bgPreviewImg');
    const actions = document.getElementById('bgActions');
    if (preview) preview.classList.add('active');
    if (content) content.style.display = 'none';
    if (img) img.src = src;
    if (actions) actions.style.display = 'flex';
  },

  replaceBgImage() {
    document.getElementById('customBgUpload').click();
  },

  removeBgImage() {
    this.saveState();
    this.activeTemplate.bgConfig.image = '';
    const preview = document.getElementById('bgDropPreview');
    const content = document.getElementById('bgDropContent');
    const actions = document.getElementById('bgActions');
    if (preview) preview.classList.remove('active');
    if (content) content.style.display = '';
    if (actions) actions.style.display = 'none';
    this.syncBackgroundElement();
    this.applyBackgroundConfig();
    this.renderCanvas();
    this.persistTemplate();
    showToast('Background', 'Background image removed', 'info');
  },

  resetBgImage() {
    this.removeBgImage();
  },

  // ========== BRAND ELEMENT DRAG-DROP ==========
  setupBrandDropZone(type) {
    const dropZoneId = type === 'logo' ? 'logoDropZone' : type === 'signature' ? 'sigDropZone' : 'sealDropZone';
    const inputId = type === 'logo' ? 'logoUploadInput' : type === 'signature' ? 'sigUploadInput' : 'sealUploadInput';
    const elId = this.brandElementIds[type];

    const dropZone = document.getElementById(dropZoneId);
    const input = document.getElementById(inputId);
    if (!dropZone || !input) return;

    const handleFile = (file) => {
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        showToast('Error', 'Image exceeds 5MB limit', 'error');
        return;
      }
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        showToast('Error', 'Only JPG, JPEG, PNG, WebP allowed', 'error');
        return;
      }
      const r = new FileReader();
      r.onload = (ev) => {
        this.saveState();
        let el = this.elements.find(e => e.id === elId);
        if (!el) {
          const isPortrait = this.activeTemplate.orientation && this.activeTemplate.orientation.toLowerCase() === 'portrait';
          const cx = isPortrait ? 794 / 2 : 1123 / 2;
          
          let targetX = cx;
          let targetY = 300;
          let targetW = 120;
          let targetH = 60;

          if (type === 'logo') {
            targetX = cx - 60;
            targetY = 60;
          } else if (type === 'signature') {
            targetX = isPortrait ? cx - 300 : cx - 350;
            targetY = isPortrait ? 850 : 500;
          } else if (type === 'seal') {
            targetX = isPortrait ? cx + 150 : cx + 180;
            targetY = isPortrait ? 840 : 490;
            targetW = 100;
            targetH = 100;
          }

          el = {
            id: elId, type: 'image', role: type, imageType: type, content: '', placeholder: type.charAt(0).toUpperCase() + type.slice(1),
            x: targetX, y: targetY, width: targetW, height: targetH, rotation: 0,
            opacity: 1.0, locked: false, visible: true, zIndex: 2
          };
          this.elements.push(el);
        }
        el.content = ev.target.result;
        this.persistTemplate();
        this.renderCanvas();

        // Show preview card
        this.showBrandPreviewCard(type, ev.target.result, file.name, file.size);
        showToast('Uploaded', `${type.charAt(0).toUpperCase() + type.slice(1)} uploaded`, 'success');
      };
      r.readAsDataURL(file);
    };

    input.addEventListener('change', (e) => {
      handleFile(e.target.files[0]);
      input.value = '';
    });

    dropZone.addEventListener('click', () => input.click());

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });
  },

  showBrandPreviewCard(type, src, fileName, fileSize) {
    const cardId = type === 'logo' ? 'logoPreviewCard' : type === 'signature' ? 'sigPreviewCard' : 'sealPreviewCard';
    const imgId = type === 'logo' ? 'logoPreviewImg' : type === 'signature' ? 'sigPreviewImg' : 'sealPreviewImg';
    const fnId = type === 'logo' ? 'logoFileName' : type === 'signature' ? 'sigFileName' : 'sealFileName';
    const fsId = type === 'logo' ? 'logoFileSize' : type === 'signature' ? 'sigFileSize' : 'sealFileSize';
    const wId = type === 'logo' ? 'logoWidth' : type === 'signature' ? 'sigWidth' : 'sealWidth';
    const hId = type === 'logo' ? 'logoHeight' : type === 'signature' ? 'sigHeight' : 'sealHeight';

    const card = document.getElementById(cardId);
    const img = document.getElementById(imgId);
    const fn = document.getElementById(fnId);
    const fs = document.getElementById(fsId);
    const wInput = document.getElementById(wId);
    const hInput = document.getElementById(hId);
    if (card) card.style.display = 'flex';
    if (img) img.src = src;
    if (fn) fn.textContent = fileName || (type + '.png');
    if (fs) fs.textContent = fileSize ? (fileSize / 1024).toFixed(1) + ' KB' : '';

    const el = this.elements.find(e => e.id === this.brandElementIds[type]);
    if (el) {
      if (wInput) wInput.value = el.width || 120;
      if (hInput) hInput.value = el.height || 60;
    }
  },

  removeBrandElement(type) {
    const id = this.brandElementIds[type];
    this.saveState();
    this.elements = this.elements.filter(e => e.id !== id);
    const cardId = type === 'logo' ? 'logoPreviewCard' : type === 'signature' ? 'sigPreviewCard' : 'sealPreviewCard';
    const card = document.getElementById(cardId);
    if (card) card.style.display = 'none';
    this.persistTemplate();
    this.renderCanvas();
    showToast('Removed', `${type.charAt(0).toUpperCase() + type.slice(1)} removed from template`, 'info');
  },

  // ========== WATERMARK ==========
  setupWmUpload() {
    const dropZone = document.getElementById('wmDropZone');
    const input = document.getElementById('wmUploadInput');
    if (!dropZone || !input) return;

    const handleFile = (file) => {
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        showToast('Error', 'Image exceeds 5MB limit', 'error');
        return;
      }
      const r = new FileReader();
      r.onload = (ev) => {
        this.saveState();
        if (!this.activeTemplate.bgConfig) this.activeTemplate.bgConfig = {};
        const bg = this.activeTemplate.bgConfig;
        bg.watermark = ev.target.result;
        bg.watermarkVisible = true;
        // Set default dimensions from image natural size
        const img = new Image();
        img.onload = () => {
          const maxDim = 400;
          let w = img.naturalWidth;
          let h = img.naturalHeight;
          if (w > maxDim || h > maxDim) {
            const ratio = Math.min(maxDim / w, maxDim / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          bg.watermarkWidth = w;
          bg.watermarkHeight = h;
          const wmW = document.getElementById('wmWidth');
          const wmH = document.getElementById('wmHeight');
          if (wmW) wmW.value = w;
          if (wmH) wmH.value = h;
          this.applyBackgroundConfig();
        };
        img.src = ev.target.result;
        this.showWmPreview(ev.target.result, file.name, file.size);
        this.applyBackgroundConfig();
        showToast('Watermark', 'Watermark image uploaded', 'success');
      };
      r.readAsDataURL(file);
    };

    input.addEventListener('change', (e) => {
      handleFile(e.target.files[0]);
      input.value = '';
    });

    dropZone.addEventListener('click', () => input.click());

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });
  },

  showWmPreview(src, fileName, fileSize) {
    const card = document.getElementById('wmPreviewCard');
    const img = document.getElementById('wmPreviewImg');
    const fn = document.getElementById('wmFileName');
    const fs = document.getElementById('wmFileSize');
    if (card) card.style.display = 'flex';
    if (img) img.src = src;
    if (fn && fileName) fn.textContent = fileName;
    if (fs && fileSize) fs.textContent = (fileSize / 1024).toFixed(1) + ' KB';
  },

  removeWatermark() {
    this.saveState();
    if (this.activeTemplate.bgConfig) {
      const bg = this.activeTemplate.bgConfig;
      bg.watermark = '';
      bg.watermarkVisible = false;
      bg.watermarkX = null;
      bg.watermarkY = null;
    }
    const card = document.getElementById('wmPreviewCard');
    if (card) card.style.display = 'none';
    this.applyBackgroundConfig();
    showToast('Watermark', 'Watermark removed', 'info');
  },

  resetWatermark() {
    if (!this.activeTemplate.bgConfig) this.activeTemplate.bgConfig = {};
    const bg = this.activeTemplate.bgConfig;
    bg.watermarkOpacity = 0.15;
    bg.watermarkWidth = 200;
    bg.watermarkHeight = 200;
    bg.watermarkScale = 100;
    bg.watermarkAspectRatio = true;
    bg.watermarkX = null;
    bg.watermarkY = null;
    bg.watermarkRotation = 0;
    bg.watermarkVisible = bg.watermark ? true : false;
    bg.watermarkLocked = false;
    this.applyBackgroundConfig();
    if (bg.watermark) {
      const img = new Image();
      img.onload = () => {
        const maxDim = 400;
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        bg.watermarkWidth = w;
        bg.watermarkHeight = h;
        this.loadAllSectionSettings();
        this.applyBackgroundConfig();
      };
      img.src = bg.watermark;
    }
    this.loadAllSectionSettings();
    showToast('Watermark', 'Watermark settings reset', 'info');
  },

  // ========== BORDER TOGGLE ==========
  toggleBorderControls(enabled) {
    const controls = document.getElementById('borderControls');
    if (controls) controls.style.display = enabled ? 'block' : 'none';
  },

  // ========== CANVAS ==========
  syncBackgroundElement() {
    const isPortrait = this.activeTemplate.orientation && this.activeTemplate.orientation.toLowerCase() === 'portrait';
    const paperSize = this.activeTemplate.paperSize || 'A4';
    const isLetter = paperSize.toLowerCase() === 'letter';
    
    let canvasW, canvasH;
    if (isLetter) {
      canvasW = isPortrait ? 850 : 1100;
      canvasH = isPortrait ? 1100 : 850;
    } else {
      canvasW = isPortrait ? 794 : 1123;
      canvasH = isPortrait ? 1123 : 794;
    }

    const bgImage = this.activeTemplate.bgConfig && this.activeTemplate.bgConfig.image;
    const bgIndex = this.elements.findIndex(e => e.id === 'el_bg' || e.type === 'background');

    if (bgImage) {
      const bgOpacity = this.activeTemplate.bgConfig.opacity !== undefined ? this.activeTemplate.bgConfig.opacity : 1.0;
      const bgEl = {
        id: 'el_bg',
        type: 'background',
        src: bgImage,
        x: 0,
        y: 0,
        width: canvasW,
        height: canvasH,
        rotation: 0,
        opacity: bgOpacity,
        locked: true,
        zIndex: 0
      };
      if (bgIndex >= 0) {
        this.elements[bgIndex] = bgEl;
      } else {
        this.elements.unshift(bgEl); // Add to the bottom
      }
    } else {
      if (bgIndex >= 0) {
        this.elements.splice(bgIndex, 1);
      }
    }
  },

  updateCanvasSpecifications() {
    const canvas = document.getElementById('designerCanvas');
    if (!canvas) return;
    canvas.className = 'designer-canvas';
    const size = this.activeTemplate.paperSize || 'A4';
    const orient = this.activeTemplate.orientation || 'Landscape';
    canvas.classList.add(`${orient.toLowerCase()}-${size.toLowerCase()}`);

    if (!this.activeTemplate.bgConfig) {
      this.activeTemplate.bgConfig = {
        type: 'color', color: '#FFFFFF', opacity: 1.0, image: '',
        size: 'cover', borderWidth: 0, borderColor: '#1565C0',
        borderStyle: 'solid', borderRadius: 0,
        watermark: '', watermarkOpacity: 0.15, watermarkWidth: 200, watermarkHeight: 200,
        watermarkScale: 100, watermarkAspectRatio: true, watermarkX: null, watermarkY: null,
        watermarkRotation: 0, watermarkVisible: true, watermarkLocked: false
      };
    }
    this.syncBackgroundElement();
    this.applyBackgroundConfig();
  },

  applyBackgroundConfig() {
    const canvas = document.getElementById('designerCanvas');
    if (!canvas) return;
    const bg = this.activeTemplate.bgConfig || {};
    if (bg.type === 'gradient' && bg.gradient) {
      canvas.style.background = bg.gradient;
    } else {
      canvas.style.background = bg.color || '#FFFFFF';
    }
    const hasBgElement = this.elements && this.elements.some(e => e.type === 'background');
    if (bg.image && !hasBgElement) {
      canvas.style.backgroundImage = `url(${bg.image})`;
      canvas.style.backgroundSize = bg.size || 'cover';
      canvas.style.backgroundPosition = 'center';
      canvas.style.backgroundRepeat = bg.size === 'repeat' ? 'repeat' : 'no-repeat';
    } else {
      canvas.style.backgroundImage = 'none';
    }
    canvas.style.opacity = bg.opacity || 1;

    let borderEl = canvas.querySelector('.canvas-border');
    if (!borderEl) {
      borderEl = document.createElement('div');
      borderEl.className = 'canvas-border';
      canvas.appendChild(borderEl);
    }
    if ((bg.borderWidth || 0) > 0) {
      borderEl.style.borderWidth = `${bg.borderWidth}px`;
      borderEl.style.borderColor = bg.borderColor || '#1565C0';
      borderEl.style.borderStyle = bg.borderStyle || 'solid';
      borderEl.style.borderRadius = `${bg.borderRadius || 0}px`;
      borderEl.style.display = 'block';
    } else {
      borderEl.style.borderWidth = '0px';
      borderEl.style.display = 'none';
    }

    let wmEl = canvas.querySelector('.designer-watermark');
    if (!wmEl) {
      wmEl = document.createElement('img');
      wmEl.className = 'designer-watermark';
      wmEl.draggable = false;
      canvas.appendChild(wmEl);
    }
    if (bg.watermark && bg.watermarkVisible !== false) {
      wmEl.src = bg.watermark;
      wmEl.style.opacity = bg.watermarkOpacity || 0.15;
      const wmW = bg.watermarkWidth || 200;
      const wmH = bg.watermarkHeight || 200;
      const scale = (bg.watermarkScale || 100) / 100;
      wmEl.style.width = `${wmW}px`;
      wmEl.style.height = `${wmH}px`;
      wmEl.style.transform = `translate(-50%, -50%) rotate(${bg.watermarkRotation || 0}deg) scale(${scale})`;
      if (bg.watermarkX !== null && bg.watermarkY !== null) {
        wmEl.style.left = `${bg.watermarkX}px`;
        wmEl.style.top = `${bg.watermarkY}px`;
      } else {
        wmEl.style.left = '50%';
        wmEl.style.top = '50%';
      }
      wmEl.classList.add('active');
      wmEl.style.pointerEvents = bg.watermarkLocked ? 'none' : 'auto';
    } else {
      wmEl.classList.remove('active');
    }

    // Watermark drag support (attach once)
    if (!wmEl.dataset.wmDragInit) {
      wmEl.dataset.wmDragInit = '1';
      wmEl.addEventListener('mousedown', (e) => {
        const bg = this.activeTemplate.bgConfig || {};
        if (!bg.watermark || bg.watermarkLocked) return;
        e.stopPropagation();
        this.selectedElementId = null;
        this.renderCanvas();
        const canvasRect = canvas.getBoundingClientRect();
        const startX = e.clientX;
        const startY = e.clientY;
        const origX = bg.watermarkX !== null ? bg.watermarkX : canvas.offsetWidth / 2;
        const origY = bg.watermarkY !== null ? bg.watermarkY : canvas.offsetHeight / 2;
        bg.watermarkX = origX;
        bg.watermarkY = origY;

        const onMove = (ev) => {
          const dx = (ev.clientX - startX) / this.zoomLevel;
          const dy = (ev.clientY - startY) / this.zoomLevel;
          bg.watermarkX = origX + dx;
          bg.watermarkY = origY + dy;
          this.applyBackgroundConfig();
        };
        const onUp = () => {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          const wmX = document.getElementById('wmPosX');
          const wmY = document.getElementById('wmPosY');
          if (wmX) wmX.value = Math.round(bg.watermarkX);
          if (wmY) wmY.value = Math.round(bg.watermarkY);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    }
  },

  renderCanvas() {
    const canvas = document.getElementById('designerCanvas');
    if (!canvas) return;
    
    // Remove old elements
    const elementsToRemove = canvas.querySelectorAll('.designer-element');
    elementsToRemove.forEach(el => el.remove());

    const settings = Utils.getFromStorage('settings') || {};

    this.elements.forEach(item => {
      if (item.visible === false) return;

      const handlesHTML = `
        <div class="resize-handle handle-nw" data-handle="nw"></div>
        <div class="resize-handle handle-ne" data-handle="ne"></div>
        <div class="resize-handle handle-sw" data-handle="sw"></div>
        <div class="resize-handle handle-se" data-handle="se"></div>
        <div class="resize-handle handle-n" data-handle="n"></div>
        <div class="resize-handle handle-s" data-handle="s"></div>
        <div class="resize-handle handle-e" data-handle="e"></div>
        <div class="resize-handle handle-w" data-handle="w"></div>
        <div class="rotate-handle"><i class="fas fa-redo"></i></div>
        <div class="lock-indicator"><i class="fas fa-lock"></i></div>
      `;

      const elementHTML = Utils.renderElementHTML(item, null, settings, {
        isDesigner: true,
        selectedElementId: this.selectedElementId,
        handlesHTML: handlesHTML
      });

      // Create a temporary container to parse HTML string into DOM node
      const temp = document.createElement('div');
      temp.innerHTML = elementHTML.trim();
      const el = temp.firstElementChild;

      // Add event listener for selection
      el.addEventListener('mousedown', (e) => this.handleElementSelect(e, item.id));

      // Add double click listener for contenteditable focus
      if (item.type === 'text') {
        const innerText = el.querySelector('.designer-text-editable');
        if (innerText) {
          innerText.addEventListener('blur', (e) => {
            this.saveState();
            item.content = e.target.innerHTML;
          });
          innerText.addEventListener('dblclick', (e) => {
            if (item.locked) return;
            e.stopPropagation();
            document.execCommand('selectAll', false, null);
          });
        }
      }

      canvas.appendChild(el);
    });

    this.renderLayersPanel();
  },

  renderLayersPanel() {
    const list = document.getElementById('layersList');
    if (!list) return;
    list.innerHTML = this.elements.map((el, index) => {
      const isSelected = el.id === this.selectedElementId;
      const typeIcon = el.type === 'text' ? 'fas fa-font' : 'fas fa-image';
      const label = el.type === 'text'
        ? Utils.truncate(el.content.replace(/<[^>]*>/g, ''), 20) || 'Text Element'
        : el.placeholder || 'Image Asset';
      return `<div class="object-list-item ${isSelected ? 'selected' : ''}" data-id="${el.id}">
        <div class="object-list-info" onclick="Designer.selectElement('${el.id}')">
          <i class="${typeIcon}"></i><span>${label}</span>
        </div>
        <div class="object-list-actions">
          <button class="designer-tool-btn" onclick="Designer.toggleLockElement('${el.id}')" title="Lock/Unlock"><i class="fas ${el.locked ? 'fa-lock' : 'fa-lock-open'}"></i></button>
          <button class="designer-tool-btn" onclick="Designer.deleteElement('${el.id}')" title="Delete"><i class="fas fa-trash" style="color:var(--error)"></i></button>
        </div>
      </div>`;
    }).reverse().join('');
  },

  selectElement(id) {
    this.selectedElementId = id;
    this.renderCanvas();
    this.syncSidebarToSelectedElement();
  },

  handleElementSelect(e, id) {
    if (this.isResizing || this.isRotating) return;
    e.stopPropagation();
    this.selectedElementId = id;
    this.syncSidebarToSelectedElement();
    const item = this.elements.find(el => el.id === id);
    if (!item || item.locked) { this.renderCanvas(); return; }
    document.querySelectorAll('.designer-element').forEach(el => el.classList.remove('selected'));
    const domEl = document.getElementById(id);
    if (domEl) domEl.classList.add('selected');
    const target = e.target;
    if (target.classList.contains('resize-handle')) {
      this.isResizing = true;
      this.activeHandle = target.dataset.handle;
      this.dragStart = { x: e.clientX, y: e.clientY };
      this.initialElementRect = { ...item };
      this.saveState();
      e.preventDefault();
      return;
    }
    if (target.closest('.rotate-handle')) {
      this.isRotating = true;
      this.saveState();
      const rect = domEl.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      this.dragStart = { x: cx, y: cy };
      this.initialAngle = Math.atan2(e.clientY - cy, e.clientX - cx);
      this.initialRotation = item.rotation || 0;
      e.preventDefault();
      return;
    }
    this.isDragging = true;
    this.dragStart = { x: e.clientX, y: e.clientY };
    this.initialElementRect = { x: item.x, y: item.y };
    this.saveState();
  },

  syncSidebarToSelectedElement() {
    const textSection = document.getElementById('textPropertiesSection');
    const imgSection = document.getElementById('imagePropertiesSection');
    const item = this.elements.find(el => el.id === this.selectedElementId);

    // Hide both sections first
    if (textSection) {
      textSection.style.display = 'none';
      textSection.classList.remove('text-properties-visible');
    }
    if (imgSection) {
      imgSection.style.display = 'none';
    }

    if (!item) return;

    if (item.type === 'text') {
      if (textSection) {
        textSection.style.display = 'block';
        textSection.classList.add('text-properties-visible');
      }
      const contentInput = document.getElementById('textInputContent');
      if (contentInput) contentInput.value = item.content.replace(/<[^>]*>/g, '');
      const familySelect = document.getElementById('textFontFamily');
      if (familySelect) familySelect.value = item.fontFamily;
      const sizeInput = document.getElementById('textFontSize');
      if (sizeInput) sizeInput.value = item.fontSize;
      const weightSelect = document.getElementById('textFontWeight');
      if (weightSelect) weightSelect.value = item.fontWeight;
      const letterSp = document.getElementById('textLetterSpacing');
      if (letterSp) letterSp.value = item.letterSpacing || 0;
      const lineH = document.getElementById('textLineHeight');
      if (lineH) lineH.value = item.lineHeight || 1.5;
      const colorInput = document.getElementById('textColorInput');
      if (colorInput) colorInput.value = item.color;
      const borderRange = document.getElementById('textBorderRange');
      if (borderRange) borderRange.value = item.borderWidth || 0;
      const borderColorInput = document.getElementById('textBorderColorInput');
      if (borderColorInput) borderColorInput.value = item.borderColor || '#000000';
      const borderRad = document.getElementById('textBorderRadiusRange');
      if (borderRad) borderRad.value = item.borderRadius || 0;
      const opacityRange = document.getElementById('textOpacityRange');
      if (opacityRange) opacityRange.value = (item.opacity !== undefined ? item.opacity : 1.0) * 100;
      const shadowSelect = document.getElementById('textShadowSelect');
      if (shadowSelect) shadowSelect.value = item.textShadow || 'none';
      const posX = document.getElementById('textPosX');
      if (posX) posX.value = item.x;
      const posY = document.getElementById('textPosY');
      if (posY) posY.value = item.y;
      const sizeW = document.getElementById('textSizeW');
      if (sizeW) sizeW.value = item.width;
      const sizeH = document.getElementById('textSizeH');
      if (sizeH) sizeH.value = item.height;
      const rotationRange = document.getElementById('textRotationRange');
      if (rotationRange) rotationRange.value = item.rotation || 0;
      const rotLabel = document.getElementById('rotationDegreeLabel');
      if (rotLabel) rotLabel.textContent = `${item.rotation || 0}°`;
      const visibilityBtn = document.getElementById('tpBtnToggleVisibility');
      const visibilityText = document.getElementById('visibilityBtnText');
      if (visibilityBtn && visibilityText) {
        const isVisible = item.visible !== false;
        visibilityBtn.innerHTML = isVisible ? '<i class="fas fa-eye"></i> <span id="visibilityBtnText">Hide</span>' : '<i class="fas fa-eye-slash"></i> <span id="visibilityBtnText">Show</span>';
        visibilityBtn.classList.toggle('active', !isVisible);
      }
      const lockBtn = document.getElementById('tpBtnLockObject');
      const lockText = document.getElementById('lockBtnText');
      if (lockBtn && lockText) {
        lockBtn.innerHTML = item.locked ? '<i class="fas fa-lock"></i> <span id="lockBtnText">Unlock</span>' : '<i class="fas fa-lock-open"></i> <span id="lockBtnText">Lock</span>';
        lockBtn.classList.toggle('active', item.locked);
      }
      const setToggle = (id, active) => {
        const btn = document.getElementById(id);
        if (btn) btn.classList.toggle('active', active);
      };
      setToggle('btnBold', item.fontWeight === '700' || item.fontWeight === 'bold');
      setToggle('btnItalic', item.fontStyle === 'italic');
      setToggle('btnUnderline', item.textDecoration === 'underline');
      document.querySelectorAll('.align-toggle').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.align === item.textAlign);
      });
      document.querySelectorAll('.text-transform-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.transform === (item.textTransform || 'none'));
      });
    } else if (item.type === 'image') {
      if (imgSection) imgSection.style.display = 'block';

      const labelInput = document.getElementById('imageInputLabel');
      if (labelInput) labelInput.value = item.placeholder || 'Image Asset';

      const sizeW = document.getElementById('imageSizeW');
      if (sizeW) sizeW.value = item.width;
      const sizeH = document.getElementById('imageSizeH');
      if (sizeH) sizeH.value = item.height;

      const posX = document.getElementById('imagePosX');
      if (posX) posX.value = item.x;
      const posY = document.getElementById('imagePosY');
      if (posY) posY.value = item.y;

      const opacityRange = document.getElementById('imageOpacityRange');
      if (opacityRange) opacityRange.value = Math.round((item.opacity !== undefined ? item.opacity : 1.0) * 100);

      const rotationRange = document.getElementById('imageRotationRange');
      if (rotationRange) rotationRange.value = item.rotation || 0;
      const rotLabel = document.getElementById('imageRotationDegreeLabel');
      if (rotLabel) rotLabel.textContent = `${item.rotation || 0}°`;

      const visibilityBtn = document.getElementById('imgBtnToggleVisibility');
      const visibilityText = document.getElementById('imgVisibilityBtnText');
      if (visibilityBtn && visibilityText) {
        const isVisible = item.visible !== false;
        visibilityBtn.innerHTML = isVisible ? '<i class="fas fa-eye"></i> <span id="imgVisibilityBtnText">Hide</span>' : '<i class="fas fa-eye-slash"></i> <span id="imgVisibilityBtnText">Show</span>';
        visibilityBtn.classList.toggle('active', !isVisible);
      }

      const lockBtn = document.getElementById('imgBtnLockObject');
      const lockText = document.getElementById('imgLockBtnText');
      if (lockBtn && lockText) {
        lockBtn.innerHTML = item.locked ? '<i class="fas fa-lock"></i> <span id="imgLockBtnText">Unlock</span>' : '<i class="fas fa-lock-open"></i> <span id="imgLockBtnText">Lock</span>';
        lockBtn.classList.toggle('active', item.locked);
      }
    }
  },

  updateSelectedTextAttribute(attr, val) {
    if (!this.selectedElementId) return;
    const item = this.elements.find(el => el.id === this.selectedElementId);
    if (!item || item.locked) return;
    this.saveState();
    item[attr] = val;
    this.renderCanvas();
  },

  toggleLockElement(id) {
    const item = this.elements.find(el => el.id === id);
    if (item) {
      this.saveState();
      item.locked = !item.locked;
      if (item.locked && this.selectedElementId === id) this.selectedElementId = null;
      this.renderCanvas();
      this.syncSidebarToSelectedElement();
    }
  },

  setLockElement(id, locked) {
    const item = this.elements.find(el => el.id === id);
    if (item) {
      this.saveState();
      item.locked = locked;
      if (item.locked && this.selectedElementId === id) this.selectedElementId = null;
      this.renderCanvas();
      this.syncSidebarToSelectedElement();
    }
  },

  deleteElement(id) {
    if (!confirm('Are you sure you want to delete this element?')) return;
    this.saveState();
    this.elements = this.elements.filter(el => el.id !== id);
    if (this.selectedElementId === id) this.selectedElementId = null;
    this.renderCanvas();
    showToast('Deleted', 'Element removed from template', 'info');
  },

  duplicateElement(id) {
    const item = this.elements.find(el => el.id === id);
    if (!item) return;
    this.saveState();
    const copy = { ...item, id: Utils.generateId(), x: item.x + 20, y: item.y + 20, locked: false, visible: true };
    this.elements.push(copy);
    this.selectedElementId = copy.id;
    this.renderCanvas();
    this.syncSidebarToSelectedElement();
    showToast('Duplicated', 'Element duplicated', 'success');
  },

  addNewTextElement(text) {
    this.saveState();
    text = text || 'Double-click to edit text';
    const isPortrait = this.activeTemplate.orientation && this.activeTemplate.orientation.toLowerCase() === 'portrait';
    const cx = isPortrait ? 794 / 2 : 1123 / 2;
    const cy = isPortrait ? 1123 / 2 : 794 / 2;
    const el = {
      id: Utils.generateId(), type: 'text', content: text,
      x: cx - 150, y: cy - 25, width: 300, height: 50, rotation: 0,
      fontFamily: 'Poppins', fontSize: 16, fontWeight: '400',
      fontStyle: 'normal', textDecoration: 'none', color: '#1A1A2E',
      textAlign: 'center', letterSpacing: 0, lineHeight: 1.5,
      textTransform: 'none', opacity: 1.0, textShadow: 'none',
      borderWidth: 0, borderColor: 'transparent',
      borderRadius: 0, locked: false, visible: true
    };
    this.elements.push(el);
    this.selectedElementId = el.id;
    this.renderCanvas();
    this.syncSidebarToSelectedElement();
  },

  addNewSignatureElement() {
    this.saveState();
    const isPortrait = this.activeTemplate.orientation && this.activeTemplate.orientation.toLowerCase() === 'portrait';
    const cx = isPortrait ? 794 / 2 : 1123 / 2;
    const cy = isPortrait ? 1123 / 2 : 794 / 2;
    
    // Auto-calculate label number for new signature
    const sigCount = this.elements.filter(e => e.id.startsWith('el_sig_') || e.id === 'el_signature').length;
    const placeholderText = 'Signature ' + (sigCount + 1);

    const el = {
      id: 'el_sig_' + Utils.generateId(),
      type: 'image', role: 'signature', imageType: 'signature',
      content: '', // Start empty, will fallback to settings signature or custom image
      placeholder: placeholderText,
      x: cx - 60,
      y: cy - 30,
      width: 120,
      height: 60,
      rotation: 0,
      opacity: 1.0,
      locked: false,
      visible: true, zIndex: 2
    };
    this.elements.push(el);
    this.selectedElementId = el.id;
    this.persistTemplate();
    this.renderCanvas();
    this.syncSidebarToSelectedElement();
    showToast('Success', 'Signature element added', 'success');
  },

  addNewLogoElement() {
    this.saveState();
    const isPortrait = this.activeTemplate.orientation && this.activeTemplate.orientation.toLowerCase() === 'portrait';
    const cx = isPortrait ? 794 / 2 : 1123 / 2;
    const cy = isPortrait ? 1123 / 2 : 794 / 2;
    
    const logoCount = this.elements.filter(e => e.id.startsWith('el_logo_') || e.id === 'el_logo').length;
    const placeholderText = 'Logo ' + (logoCount + 1);

    const el = {
      id: 'el_logo_' + Utils.generateId(),
      type: 'image', role: 'logo', imageType: 'logo',
      content: '', // Start empty, will fallback to settings logo or custom image
      placeholder: placeholderText,
      x: cx - 60,
      y: cy - 30,
      width: 120,
      height: 60,
      rotation: 0,
      opacity: 1.0,
      locked: false,
      visible: true, zIndex: 2
    };
    this.elements.push(el);
    this.selectedElementId = el.id;
    this.persistTemplate();
    this.renderCanvas();
    this.syncSidebarToSelectedElement();
    showToast('Success', 'Logo element added', 'success');
  },

  addNewSealElement() {
    this.saveState();
    const isPortrait = this.activeTemplate.orientation && this.activeTemplate.orientation.toLowerCase() === 'portrait';
    const cx = isPortrait ? 794 / 2 : 1123 / 2;
    const cy = isPortrait ? 1123 / 2 : 794 / 2;
    
    const sealCount = this.elements.filter(e => e.id.startsWith('el_seal_') || e.id === 'el_seal').length;
    const placeholderText = 'Seal ' + (sealCount + 1);

    const el = {
      id: 'el_seal_' + Utils.generateId(),
      type: 'image', role: 'seal', imageType: 'seal',
      content: '', // Start empty, will fallback to settings seal or custom image
      placeholder: placeholderText,
      x: cx - 50,
      y: cy - 50,
      width: 100,
      height: 100,
      rotation: 0,
      opacity: 1.0,
      locked: false,
      visible: true, zIndex: 2
    };
    this.elements.push(el);
    this.selectedElementId = el.id;
    this.persistTemplate();
    this.renderCanvas();
    this.syncSidebarToSelectedElement();
    showToast('Success', 'Seal element added', 'success');
  },

  // ========== SECTION EVENTS ==========
  setupSectionEvents() {
    // Background color live
    const bgColor = document.getElementById('bgColorInput');
    if (bgColor) bgColor.addEventListener('input', (e) => {
      this.activeTemplate.bgConfig.color = e.target.value;
      this.applyBackgroundConfig();
    });

    const bgOpacity = document.getElementById('bgOpacityRange');
    if (bgOpacity) bgOpacity.addEventListener('input', (e) => {
      this.activeTemplate.bgConfig.opacity = parseInt(e.target.value) / 100;
      this.applyBackgroundConfig();
    });

    const bgSize = document.getElementById('bgSizeSelect');
    if (bgSize) bgSize.addEventListener('change', (e) => {
      this.activeTemplate.bgConfig.size = e.target.value;
      this.applyBackgroundConfig();
    });

    // Gradient presets
    document.querySelectorAll('.gradient-preset-box').forEach(box => {
      box.addEventListener('click', () => {
        document.querySelectorAll('.gradient-preset-box').forEach(b => b.classList.remove('active'));
        box.classList.add('active');
        this.saveState();
        this.activeTemplate.bgConfig.type = 'gradient';
        this.activeTemplate.bgConfig.gradient = box.dataset.gradient;
        this.applyBackgroundConfig();
      });
    });

    // Border toggle
    const borderToggle = document.getElementById('borderEnableToggle');
    if (borderToggle) {
      borderToggle.addEventListener('change', (e) => {
        this.toggleBorderControls(e.target.checked);
      });
    }
    const borderWidthRange = document.getElementById('borderWidthRange');
    if (borderWidthRange) borderWidthRange.addEventListener('input', (e) => {
      if (document.getElementById('borderEnableToggle').checked) {
        this.activeTemplate.bgConfig.borderWidth = parseInt(e.target.value);
        this.applyBackgroundConfig();
      }
    });
    const borderColorInput = document.getElementById('borderColorInput');
    if (borderColorInput) borderColorInput.addEventListener('input', (e) => {
      this.activeTemplate.bgConfig.borderColor = e.target.value;
      if (document.getElementById('borderEnableToggle').checked) this.applyBackgroundConfig();
    });
    const borderStyleSelect = document.getElementById('borderStyleSelect');
    if (borderStyleSelect) borderStyleSelect.addEventListener('change', (e) => {
      this.activeTemplate.bgConfig.borderStyle = e.target.value;
      if (document.getElementById('borderEnableToggle').checked) this.applyBackgroundConfig();
    });
    const borderRadiusRange = document.getElementById('borderRadiusRange');
    if (borderRadiusRange) borderRadiusRange.addEventListener('input', (e) => {
      this.activeTemplate.bgConfig.borderRadius = parseInt(e.target.value);
      if (document.getElementById('borderEnableToggle').checked) this.applyBackgroundConfig();
    });

    // Watermark opacity live (old event listener now handled below)

    // Font size input live
    const fontSizeInput = document.getElementById('textFontSize');
    if (fontSizeInput) fontSizeInput.addEventListener('input', (e) => this.updateSelectedTextAttribute('fontSize', parseInt(e.target.value) || 12));
    const familySelect = document.getElementById('textFontFamily');
    if (familySelect) familySelect.addEventListener('change', (e) => this.updateSelectedTextAttribute('fontFamily', e.target.value));
    const weightSelect = document.getElementById('textFontWeight');
    if (weightSelect) weightSelect.addEventListener('change', (e) => this.updateSelectedTextAttribute('fontWeight', e.target.value));

    // Bold / Italic / Underline
    const bBtn = document.getElementById('btnBold');
    if (bBtn) bBtn.addEventListener('click', () => {
      const active = bBtn.classList.toggle('active');
      this.updateSelectedTextAttribute('fontWeight', active ? '700' : '400');
    });
    const iBtn = document.getElementById('btnItalic');
    if (iBtn) iBtn.addEventListener('click', () => {
      const active = iBtn.classList.toggle('active');
      this.updateSelectedTextAttribute('fontStyle', active ? 'italic' : 'normal');
    });
    const uBtn = document.getElementById('btnUnderline');
    if (uBtn) uBtn.addEventListener('click', () => {
      const active = uBtn.classList.toggle('active');
      this.updateSelectedTextAttribute('textDecoration', active ? 'underline' : 'none');
    });

    // Alignment
    document.querySelectorAll('.align-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.align-toggle').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.updateSelectedTextAttribute('textAlign', btn.dataset.align);
      });
    });

    // Text spacing/color live
    const letterSp = document.getElementById('textLetterSpacing');
    if (letterSp) letterSp.addEventListener('input', (e) => this.updateSelectedTextAttribute('letterSpacing', parseFloat(e.target.value) || 0));
    const lineH = document.getElementById('textLineHeight');
    if (lineH) lineH.addEventListener('input', (e) => this.updateSelectedTextAttribute('lineHeight', parseFloat(e.target.value) || 1.5));
    const textCol = document.getElementById('textColorInput');
    if (textCol) textCol.addEventListener('input', (e) => this.updateSelectedTextAttribute('color', e.target.value));
    const textShadow = document.getElementById('textShadowSelect');
    if (textShadow) textShadow.addEventListener('change', (e) => this.updateSelectedTextAttribute('textShadow', e.target.value));

    // Text content live
    const textContent = document.getElementById('textInputContent');
    if (textContent) textContent.addEventListener('input', (e) => this.updateSelectedTextAttribute('content', e.target.value));

    // Text box styling live
    const textBorderW = document.getElementById('textBorderRange');
    if (textBorderW) textBorderW.addEventListener('input', (e) => this.updateSelectedTextAttribute('borderWidth', parseInt(e.target.value)));
    const textBorderC = document.getElementById('textBorderColorInput');
    if (textBorderC) textBorderC.addEventListener('input', (e) => this.updateSelectedTextAttribute('borderColor', e.target.value));
    const textBorderR = document.getElementById('textBorderRadiusRange');
    if (textBorderR) textBorderR.addEventListener('input', (e) => this.updateSelectedTextAttribute('borderRadius', parseInt(e.target.value)));
    const textOp = document.getElementById('textOpacityRange');
    if (textOp) textOp.addEventListener('input', (e) => this.updateSelectedTextAttribute('opacity', parseFloat(e.target.value) / 100));

    // Text Transform buttons
    document.querySelectorAll('.text-transform-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.text-transform-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.updateSelectedTextAttribute('textTransform', btn.dataset.transform);
      });
    });

    // Position inputs
    const posX = document.getElementById('textPosX');
    if (posX) posX.addEventListener('input', (e) => this.updateSelectedTextAttribute('x', parseInt(e.target.value) || 0));
    const posY = document.getElementById('textPosY');
    if (posY) posY.addEventListener('input', (e) => this.updateSelectedTextAttribute('y', parseInt(e.target.value) || 0));

    // Size inputs
    const sizeW = document.getElementById('textSizeW');
    if (sizeW) sizeW.addEventListener('input', (e) => this.updateSelectedTextAttribute('width', Math.max(20, parseInt(e.target.value) || 20)));
    const sizeH = document.getElementById('textSizeH');
    if (sizeH) sizeH.addEventListener('input', (e) => this.updateSelectedTextAttribute('height', Math.max(20, parseInt(e.target.value) || 20)));

    // Image properties inputs
    const imgPosX = document.getElementById('imagePosX');
    if (imgPosX) imgPosX.addEventListener('input', (e) => this.updateSelectedTextAttribute('x', parseInt(e.target.value) || 0));
    const imgPosY = document.getElementById('imagePosY');
    if (imgPosY) imgPosY.addEventListener('input', (e) => this.updateSelectedTextAttribute('y', parseInt(e.target.value) || 0));

    const imgSizeW = document.getElementById('imageSizeW');
    if (imgSizeW) imgSizeW.addEventListener('input', (e) => this.updateSelectedTextAttribute('width', Math.max(20, parseInt(e.target.value) || 20)));
    const imgSizeH = document.getElementById('imageSizeH');
    if (imgSizeH) imgSizeH.addEventListener('input', (e) => this.updateSelectedTextAttribute('height', Math.max(20, parseInt(e.target.value) || 20)));

    const imgOpacity = document.getElementById('imageOpacityRange');
    if (imgOpacity) imgOpacity.addEventListener('input', (e) => this.updateSelectedTextAttribute('opacity', (parseInt(e.target.value) || 0) / 100));

    const imgLabel = document.getElementById('imageInputLabel');
    if (imgLabel) imgLabel.addEventListener('input', (e) => {
      this.updateSelectedTextAttribute('placeholder', e.target.value);
      this.renderLayersPanel();
    });

    // Rotation slider
    const rotRange = document.getElementById('textRotationRange');
    if (rotRange) rotRange.addEventListener('input', (e) => {
      const deg = parseFloat(e.target.value) || 0;
      const label = document.getElementById('rotationDegreeLabel');
      if (label) label.textContent = `${deg}°`;
      this.updateSelectedTextAttribute('rotation', deg);
    });

    // Visibility toggle
    const visBtn = document.getElementById('tpBtnToggleVisibility');
    if (visBtn) visBtn.addEventListener('click', () => {
      const item = this.elements.find(el => el.id === this.selectedElementId);
      if (!item) return;
      this.saveState();
      item.visible = item.visible === false ? true : false;
      this.renderCanvas();
      this.syncSidebarToSelectedElement();
    });

    // Brand element resize inputs update canvas live (respect locked)
    ['logo', 'signature', 'seal'].forEach(type => {
      const wId = type === 'logo' ? 'logoWidth' : type === 'signature' ? 'sigWidth' : 'sealWidth';
      const hId = type === 'logo' ? 'logoHeight' : type === 'signature' ? 'sigHeight' : 'sealHeight';
      const wInput = document.getElementById(wId);
      const hInput = document.getElementById(hId);
      if (wInput) wInput.addEventListener('input', (e) => {
        const el = this.elements.find(el => el.id === this.brandElementIds[type]);
        if (el && !el.locked) { el.width = parseInt(e.target.value) || el.width; this.renderCanvas(); }
      });
      if (hInput) hInput.addEventListener('input', (e) => {
        const el = this.elements.find(el => el.id === this.brandElementIds[type]);
        if (el && !el.locked) { el.height = parseInt(e.target.value) || el.height; this.renderCanvas(); }
      });
    });

    // Logo lock toggle
    const logoLock = document.getElementById('logoLockToggle');
    if (logoLock) logoLock.addEventListener('change', (e) => {
      this.setLockElement(this.brandElementIds.logo, e.target.checked);
    });

    // Signature lock toggle
    const sigLock = document.getElementById('sigLockToggle');
    if (sigLock) sigLock.addEventListener('change', (e) => {
      this.setLockElement(this.brandElementIds.signature, e.target.checked);
    });

    // Seal lock toggle
    const sealLock = document.getElementById('sealLockToggle');
    if (sealLock) sealLock.addEventListener('change', (e) => {
      this.setLockElement(this.brandElementIds.seal, e.target.checked);
    });

    // Watermark controls
    const wmWidth = document.getElementById('wmWidth');
    if (wmWidth) wmWidth.addEventListener('input', (e) => {
      if (!this.activeTemplate.bgConfig) this.activeTemplate.bgConfig = {};
      const bg = this.activeTemplate.bgConfig;
      const val = parseInt(e.target.value) || 200;
      bg.watermarkWidth = val;
      if (bg.watermarkAspectRatio !== false && bg.watermarkHeight) {
        const origRatio = bg.watermarkWidth / bg.watermarkHeight;
        // Recalculate height based on width
      }
      this.applyBackgroundConfig();
    });
    const wmHeight = document.getElementById('wmHeight');
    if (wmHeight) wmHeight.addEventListener('input', (e) => {
      if (!this.activeTemplate.bgConfig) this.activeTemplate.bgConfig = {};
      const bg = this.activeTemplate.bgConfig;
      bg.watermarkHeight = parseInt(e.target.value) || 200;
      this.applyBackgroundConfig();
    });
    const wmScale = document.getElementById('wmScaleRange');
    if (wmScale) wmScale.addEventListener('input', (e) => {
      if (!this.activeTemplate.bgConfig) this.activeTemplate.bgConfig = {};
      const bg = this.activeTemplate.bgConfig;
      bg.watermarkScale = parseInt(e.target.value) || 100;
      const label = document.getElementById('wmScaleLabel');
      if (label) label.textContent = `${bg.watermarkScale}%`;
      this.applyBackgroundConfig();
    });
    const wmPosX = document.getElementById('wmPosX');
    if (wmPosX) wmPosX.addEventListener('input', (e) => {
      if (!this.activeTemplate.bgConfig) this.activeTemplate.bgConfig = {};
      this.activeTemplate.bgConfig.watermarkX = parseInt(e.target.value) || 0;
      this.applyBackgroundConfig();
    });
    const wmPosY = document.getElementById('wmPosY');
    if (wmPosY) wmPosY.addEventListener('input', (e) => {
      if (!this.activeTemplate.bgConfig) this.activeTemplate.bgConfig = {};
      this.activeTemplate.bgConfig.watermarkY = parseInt(e.target.value) || 0;
      this.applyBackgroundConfig();
    });
    const wmRot = document.getElementById('wmRotationRange');
    if (wmRot) wmRot.addEventListener('input', (e) => {
      if (!this.activeTemplate.bgConfig) this.activeTemplate.bgConfig = {};
      const deg = parseFloat(e.target.value) || 0;
      this.activeTemplate.bgConfig.watermarkRotation = deg;
      const label = document.getElementById('wmRotationLabel');
      if (label) label.textContent = `${deg}°`;
      this.applyBackgroundConfig();
    });
    const wmOp = document.getElementById('wmOpacityRange');
    if (wmOp) wmOp.addEventListener('input', (e) => {
      if (!this.activeTemplate.bgConfig) this.activeTemplate.bgConfig = {};
      const val = parseInt(e.target.value) || 0;
      this.activeTemplate.bgConfig.watermarkOpacity = val / 100;
      const label = document.getElementById('wmOpacityLabel');
      if (label) label.textContent = `${val}%`;
      this.applyBackgroundConfig();
    });
    const wmVis = document.getElementById('wmToggleVisibility');
    if (wmVis) wmVis.addEventListener('click', () => {
      if (!this.activeTemplate.bgConfig) this.activeTemplate.bgConfig = {};
      const bg = this.activeTemplate.bgConfig;
      if (!bg.watermark) { showToast('Info', 'No watermark to show/hide', 'info'); return; }
      bg.watermarkVisible = bg.watermarkVisible === false ? true : false;
      this.applyBackgroundConfig();
      this.loadAllSectionSettings();
    });
    const wmLock = document.getElementById('wmToggleLock');
    if (wmLock) wmLock.addEventListener('click', () => {
      if (!this.activeTemplate.bgConfig) this.activeTemplate.bgConfig = {};
      const bg = this.activeTemplate.bgConfig;
      if (!bg.watermark) { showToast('Info', 'No watermark to lock', 'info'); return; }
      bg.watermarkLocked = !bg.watermarkLocked;
      this.applyBackgroundConfig();
      this.loadAllSectionSettings();
    });
    const wmFwd = document.getElementById('wmBringForward');
    if (wmFwd) wmFwd.addEventListener('click', () => {
      const wmEl = document.querySelector('.designer-watermark');
      if (wmEl) {
        const parent = wmEl.parentElement;
        if (parent) parent.appendChild(wmEl);
      }
    });
    const wmBwd = document.getElementById('wmSendBackward');
    if (wmBwd) wmBwd.addEventListener('click', () => {
      const wmEl = document.querySelector('.designer-watermark');
      if (wmEl) {
        const parent = wmEl.parentElement;
        if (parent && parent.firstChild !== wmEl) {
          parent.insertBefore(wmEl, parent.firstChild);
        }
      }
    });
    const wmReset = document.getElementById('wmResetBtn');
    if (wmReset) wmReset.addEventListener('click', () => this.resetWatermark());

    // Setup uploads
    this.setupBgUpload();
    this.setupBrandDropZone('logo');
    this.setupBrandDropZone('signature');
    this.setupBrandDropZone('seal');
    this.setupWmUpload();
  },

  // ========== EVENT LISTENERS ==========
  setupEventListeners() {
    document.removeEventListener('mousemove', this.globalMouseMove);
    document.removeEventListener('mouseup', this.globalMouseUp);
    this.globalMouseMove = (e) => this.handleGlobalMouseMove(e);
    this.globalMouseUp = () => this.handleGlobalMouseUp();
    document.addEventListener('mousemove', this.globalMouseMove);
    document.addEventListener('mouseup', this.globalMouseUp);

    const viewport = document.getElementById('canvasViewport');
    if (viewport) {
      viewport.addEventListener('mousedown', (e) => {
        if (e.target === viewport || e.target.id === 'designerCanvas') {
          this.selectedElementId = null;
          this.renderCanvas();
          const section = document.getElementById('textPropertiesSection');
          if (section) section.classList.remove('text-properties-visible');
        }
      });
    }

    // Tab switching
    document.querySelectorAll('.designer-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.designer-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.designer-tab-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const pane = document.getElementById(btn.dataset.tab);
        if (pane) pane.classList.add('active');
      });
    });

    // Variable badges
    document.querySelectorAll('.variable-badge').forEach(badge => {
      badge.addEventListener('click', () => {
        this.addNewTextElement(badge.dataset.variable);
        showToast('Inserted', `Dynamic variable ${badge.dataset.variable} added`, 'success');
      });
    });

    // Toolbar
    const zoomIn = document.getElementById('btnZoomIn');
    if (zoomIn) zoomIn.addEventListener('click', () => this.adjustZoom(0.1));
    const zoomOut = document.getElementById('btnZoomOut');
    if (zoomOut) zoomOut.addEventListener('click', () => this.adjustZoom(-0.1));
    const zoomReset = document.getElementById('btnZoomReset');
    if (zoomReset) zoomReset.addEventListener('click', () => { this.zoomLevel = 1.0; this.applyZoom(); });
    const toggleGrid = document.getElementById('btnToggleGrid');
    if (toggleGrid) toggleGrid.addEventListener('click', () => {
      this.gridEnabled = !this.gridEnabled;
      toggleGrid.classList.toggle('active', this.gridEnabled);
      const gridOverlay = document.getElementById('gridOverlay');
      if (gridOverlay) gridOverlay.classList.toggle('active', this.gridEnabled);
    });
    const toggleSnap = document.getElementById('btnToggleSnap');
    if (toggleSnap) toggleSnap.addEventListener('click', () => {
      this.snapEnabled = !this.snapEnabled;
      toggleSnap.classList.toggle('active', this.snapEnabled);
    });
    const undoBtn = document.getElementById('btnUndo');
    if (undoBtn) undoBtn.addEventListener('click', () => this.undo());
    const redoBtn = document.getElementById('btnRedo');
    if (redoBtn) redoBtn.addEventListener('click', () => this.redo());
    const btnForward = document.getElementById('btnBringForward');
    if (btnForward) btnForward.addEventListener('click', () => this.changeLayerOrder(1));
    const btnBackward = document.getElementById('btnSendBackward');
    if (btnBackward) btnBackward.addEventListener('click', () => this.changeLayerOrder(-1));
    const btnDup = document.getElementById('btnDuplicateObject');
    if (btnDup) btnDup.addEventListener('click', () => { if (this.selectedElementId) this.duplicateElement(this.selectedElementId); });
    const btnDel = document.getElementById('btnDeleteObject');
    if (btnDel) btnDel.addEventListener('click', () => { if (this.selectedElementId) this.deleteElement(this.selectedElementId); });
    const btnLock = document.getElementById('btnLockObject');
    if (btnLock) btnLock.addEventListener('click', () => {
      if (this.selectedElementId) {
        this.toggleLockElement(this.selectedElementId);
        this.syncSidebarToSelectedElement();
      }
    });

    // Text properties panel buttons
    const tpForward = document.getElementById('tpBtnBringForward');
    if (tpForward) tpForward.addEventListener('click', () => this.changeLayerOrder(1));
    const tpBackward = document.getElementById('tpBtnSendBackward');
    if (tpBackward) tpBackward.addEventListener('click', () => this.changeLayerOrder(-1));
    const tpDup = document.getElementById('tpBtnDuplicateObject');
    if (tpDup) tpDup.addEventListener('click', () => { if (this.selectedElementId) this.duplicateElement(this.selectedElementId); });
    const tpDel = document.getElementById('tpBtnDeleteObject');
    if (tpDel) tpDel.addEventListener('click', () => { if (this.selectedElementId) this.deleteElement(this.selectedElementId); });
    const tpLock = document.getElementById('tpBtnLockObject');
    if (tpLock) tpLock.addEventListener('click', () => {
      if (this.selectedElementId) {
        this.toggleLockElement(this.selectedElementId);
        this.syncSidebarToSelectedElement();
      }
    });

    // Selected image properties panel buttons & uploader
    const imgForward = document.getElementById('imgBtnBringForward');
    if (imgForward) imgForward.addEventListener('click', () => this.changeLayerOrder(1));
    const imgBackward = document.getElementById('imgBtnSendBackward');
    if (imgBackward) imgBackward.addEventListener('click', () => this.changeLayerOrder(-1));
    const imgDup = document.getElementById('imgBtnDuplicateObject');
    if (imgDup) imgDup.addEventListener('click', () => { if (this.selectedElementId) this.duplicateElement(this.selectedElementId); });
    const imgDel = document.getElementById('imgBtnDeleteObject');
    if (imgDel) imgDel.addEventListener('click', () => { if (this.selectedElementId) this.deleteElement(this.selectedElementId); });
    const imgLock = document.getElementById('imgBtnLockObject');
    if (imgLock) imgLock.addEventListener('click', () => {
      if (this.selectedElementId) {
        this.toggleLockElement(this.selectedElementId);
        this.syncSidebarToSelectedElement();
      }
    });
    const imgVisibility = document.getElementById('imgBtnToggleVisibility');
    if (imgVisibility) imgVisibility.addEventListener('click', () => {
      if (this.selectedElementId) {
        const item = this.elements.find(el => el.id === this.selectedElementId);
        if (item) {
          this.saveState();
          item.visible = item.visible === false ? true : false;
          this.renderCanvas();
          this.syncSidebarToSelectedElement();
        }
      }
    });

    const imgRotation = document.getElementById('imageRotationRange');
    if (imgRotation) imgRotation.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value) || 0;
      const rotLabel = document.getElementById('imageRotationDegreeLabel');
      if (rotLabel) rotLabel.textContent = `${val}°`;
      if (this.selectedElementId) {
        const item = this.elements.find(el => el.id === this.selectedElementId);
        if (item && !item.locked) {
          item.rotation = val;
          const domEl = document.getElementById(item.id);
          if (domEl) domEl.style.transform = `rotate(${val}deg)`;
        }
      }
    });

    // File upload specifically for the selected image element
    const imgDropZone = document.getElementById('selectedImageDropZone');
    const imgInput = document.getElementById('selectedImageUploadInput');
    if (imgDropZone && imgInput) {
      const handleSelectedFile = (file) => {
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
          showToast('Error', 'Image exceeds 5MB limit', 'error');
          return;
        }
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
          showToast('Error', 'Only JPG, JPEG, PNG, WebP allowed', 'error');
          return;
        }
        const r = new FileReader();
        r.onload = (ev) => {
          if (this.selectedElementId) {
            const item = this.elements.find(el => el.id === this.selectedElementId);
            if (item && item.type === 'image') {
              this.saveState();
              item.content = ev.target.result;
              this.renderCanvas();
              showToast('Uploaded', 'Custom image uploaded successfully', 'success');
            }
          }
        };
        r.readAsDataURL(file);
      };

      imgInput.addEventListener('change', (e) => {
        handleSelectedFile(e.target.files[0]);
        imgInput.value = '';
      });
      imgDropZone.addEventListener('click', () => imgInput.click());
      imgDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        imgDropZone.classList.add('drag-over');
      });
      imgDropZone.addEventListener('dragleave', () => {
        imgDropZone.classList.remove('drag-over');
      });
      imgDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        imgDropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length) handleSelectedFile(e.dataTransfer.files[0]);
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (!this.selectedElementId) return;
      const item = this.elements.find(el => el.id === this.selectedElementId);
      if (!item || item.locked) return;
      const activeElement = document.activeElement;
      if (activeElement && activeElement.classList.contains('designer-text-editable')) return;
      const nudge = e.shiftKey ? 10 : 1;
      let handled = false;
      if (e.key === 'ArrowUp') { this.saveState(); item.y -= nudge; handled = true; }
      else if (e.key === 'ArrowDown') { this.saveState(); item.y += nudge; handled = true; }
      else if (e.key === 'ArrowLeft') { this.saveState(); item.x -= nudge; handled = true; }
      else if (e.key === 'ArrowRight') { this.saveState(); item.x += nudge; handled = true; }
      else if (e.key === 'Delete') { this.deleteElement(item.id); handled = true; }
      else if (e.ctrlKey && e.key === 'd') { e.preventDefault(); this.duplicateElement(item.id); handled = true; }
      else if (e.ctrlKey && e.key === 'z') { e.preventDefault(); this.undo(); handled = true; }
      else if (e.ctrlKey && e.key === 'y') { e.preventDefault(); this.redo(); handled = true; }
      if (handled) { this.renderCanvas(); this.syncSidebarToSelectedElement(); }
    });
  },

  // ========== DRAG & RESIZE ==========
  handleGlobalMouseMove(e) {
    if (!this.selectedElementId) return;
    const item = this.elements.find(el => el.id === this.selectedElementId);
    if (!item || item.locked) return;
    if (this.isDragging) {
      const dx = (e.clientX - this.dragStart.x) / this.zoomLevel;
      const dy = (e.clientY - this.dragStart.y) / this.zoomLevel;
      let newX = this.initialElementRect.x + dx;
      let newY = this.initialElementRect.y + dy;
      if (this.snapEnabled) { newX = Math.round(newX / 10) * 10; newY = Math.round(newY / 10) * 10; }
      item.x = newX;
      item.y = newY;
      const domEl = document.getElementById(item.id);
      if (domEl) { domEl.style.left = `${item.x}px`; domEl.style.top = `${item.y}px`; }
    } else if (this.isResizing) {
      const dx = (e.clientX - this.dragStart.x) / this.zoomLevel;
      const dy = (e.clientY - this.dragStart.y) / this.zoomLevel;
      const init = this.initialElementRect;
      const h = this.activeHandle;
      let newWidth = init.width, newHeight = init.height, newX = init.x, newY = init.y;
      if (h.includes('e')) newWidth = Math.max(20, init.width + dx);
      if (h.includes('s')) newHeight = Math.max(20, init.height + dy);
      if (h.includes('w')) { const offset = init.width - dx; if (offset > 20) { newWidth = offset; newX = init.x + dx; } }
      if (h.includes('n')) { const offset = init.height - dy; if (offset > 20) { newHeight = offset; newY = init.y + dy; } }
      if (this.snapEnabled) { newWidth = Math.round(newWidth / 10) * 10; newHeight = Math.round(newHeight / 10) * 10; newX = Math.round(newX / 10) * 10; newY = Math.round(newY / 10) * 10; }
      item.width = newWidth; item.height = newHeight; item.x = newX; item.y = newY;
      const domEl = document.getElementById(item.id);
      if (domEl) { domEl.style.left = `${item.x}px`; domEl.style.top = `${item.y}px`; domEl.style.width = `${item.width}px`; domEl.style.height = `${item.height}px`; }
    } else if (this.isRotating) {
      const angle = Math.atan2(e.clientY - this.dragStart.y, e.clientX - this.dragStart.x);
      let degDiff = (angle - this.initialAngle) * (180 / Math.PI);
      let newRot = (this.initialRotation + degDiff) % 360;
      if (newRot < 0) newRot += 360;
      if (this.snapEnabled) newRot = Math.round(newRot / 15) * 15;
      item.rotation = newRot;
      const domEl = document.getElementById(item.id);
      if (domEl) domEl.style.transform = `rotate(${item.rotation}deg)`;
    }
  },

  handleGlobalMouseUp() {
    if (this.isDragging || this.isResizing || this.isRotating) {
      this.isDragging = false;
      this.isResizing = false;
      this.isRotating = false;
      this.activeHandle = null;
      this.renderCanvas();
      this.syncSidebarToSelectedElement();
    }
  },

  // ========== ZOOM ==========
  adjustZoom(delta) {
    this.zoomLevel = Math.max(0.4, Math.min(2.0, this.zoomLevel + delta));
    this.applyZoom();
  },

  applyZoom() {
    const canvas = document.getElementById('designerCanvas');
    if (canvas) canvas.style.transform = `scale(${this.zoomLevel})`;
    const zoomText = document.getElementById('zoomText');
    if (zoomText) zoomText.textContent = `${Math.round(this.zoomLevel * 100)}%`;
  },

  changeLayerOrder(direction) {
    if (!this.selectedElementId) return;
    const index = this.elements.findIndex(el => el.id === this.selectedElementId);
    if (index === -1) return;
    this.saveState();
    const newIndex = index + direction;
    if (newIndex >= 0 && newIndex < this.elements.length) {
      const temp = this.elements[index];
      this.elements[index] = this.elements[newIndex];
      this.elements[newIndex] = temp;
      this.renderCanvas();
    }
  },

  // ========== UNDO/REDO ==========
  saveState() {
    const currentElements = JSON.parse(JSON.stringify(this.elements));
    const currentBg = JSON.parse(JSON.stringify(this.activeTemplate.bgConfig));
    if (this.undoStack.length >= 30) this.undoStack.shift();
    this.undoStack.push({ elements: currentElements, bg: currentBg });
    this.redoStack = [];
    this.updateUndoRedoButtons();
  },

  undo() {
    if (this.undoStack.length <= 1) return;
    const popState = this.undoStack.pop();
    this.redoStack.push(popState);
    const prev = this.undoStack[this.undoStack.length - 1];
    if (prev) {
      this.elements = JSON.parse(JSON.stringify(prev.elements));
      this.activeTemplate.bgConfig = JSON.parse(JSON.stringify(prev.bg));
      this.renderCanvas();
      this.applyBackgroundConfig();
      this.updateUndoRedoButtons();
      showToast('Undo', 'Action reversed', 'info');
    }
  },

  redo() {
    if (!this.redoStack.length) return;
    const next = this.redoStack.pop();
    this.undoStack.push(next);
    this.elements = JSON.parse(JSON.stringify(next.elements));
    this.activeTemplate.bgConfig = JSON.parse(JSON.stringify(next.bg));
    this.renderCanvas();
    this.applyBackgroundConfig();
    this.updateUndoRedoButtons();
    showToast('Redo', 'Action re-applied', 'info');
  },

  updateUndoRedoButtons() {
    const btnUndo = document.getElementById('btnUndo');
    const btnRedo = document.getElementById('btnRedo');
    if (btnUndo) btnUndo.disabled = this.undoStack.length <= 1;
    if (btnRedo) btnRedo.disabled = this.redoStack.length === 0;
  },

  // ========== PERSIST ==========
  async persistTemplate() {
    this.activeTemplate.elements = this.elements;
    
    try {
      if (this.activeTemplate.id && !this.activeTemplate.id.startsWith('tpl_')) {
        await Api.templates.update(this.activeTemplate.id, this.activeTemplate);
      } else {
        const created = await Api.templates.create(this.activeTemplate);
        if (created && created.id) {
          this.activeTemplate.id = created.id;
        }
      }
      return true;
    } catch (err) {
      console.error('Failed to persist template to database API:', err);
      return false;
    }
  },

  async saveTemplate(status) {
    this.activeTemplate.elements = this.elements;
    this.activeTemplate.name = document.getElementById('designerTemplateName').value.trim() || 'Untitled Template';
    this.activeTemplate.status = status || this.activeTemplate.status || 'Draft';
    this.activeTemplate.lastUpdated = new Date().toISOString().split('T')[0];
    const saved = await this.persistTemplate();
    if (!saved) {
      showToast('Save failed', 'The template could not be stored. Please free browser storage and try again.', 'error');
      return;
    }
    showToast('Saved', `Template saved as ${status}`, 'success');
    await this.close();
  }
};

window.Designer = Designer;
