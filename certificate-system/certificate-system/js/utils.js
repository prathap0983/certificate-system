/* ============================================
   UTILITY FUNCTIONS
   ============================================ */
const Utils = {
  templateCache: null,
  certificateCache: null,
  storageReady: null,
  assetDatabaseName: 'certificate-generator-assets',

  isDataUrl(value) {
    return typeof value === 'string' && /^data:image\//i.test(value);
  },

  getImageRole(element) {
    if (!element) return '';
    if (element.imageType || element.role) return element.imageType || element.role;
    const id = element.id || '';
    if (element.type === 'signature' || id === 'el_signature' || id.startsWith('el_sig_')) return 'signature';
    if (element.type === 'seal' || id === 'el_seal' || id.startsWith('el_seal_')) return 'seal';
    if (element.type === 'logo' || id === 'el_logo' || id.startsWith('el_logo_')) return 'logo';
    return '';
  },

  openAssetDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.assetDatabaseName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('assets', { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async initializeStorage() {
    if (this.storageReady) return this.storageReady;
    this.storageReady = (async () => {
      const storedTemplates = this.getFromStorage('templates') || [];
      try {
        const db = await this.openAssetDatabase();
        const assets = await new Promise((resolve, reject) => {
          const request = db.transaction('assets', 'readonly').objectStore('assets').getAll();
          request.onsuccess = () => resolve(new Map(request.result.map(asset => [asset.id, asset.data])));
          request.onerror = () => reject(request.error);
        });
        const hydrated = storedTemplates.map(template => this.hydrateTemplateAssets(template, assets));
        const storedCertificates = this.getFromStorage('certificates') || [];
        const hydratedCertificates = storedCertificates.map(certificate => this.hydrateCertificateAssets(certificate, assets));
        this.templateCache = hydrated;
        this.certificateCache = hydratedCertificates;
        // Migrate legacy data-URL templates on first load without losing existing designs.
        if (storedTemplates.some(template => (template.elements || []).some(element => this.isDataUrl(element.content) || this.isDataUrl(element.src)))) {
          await this.saveTemplates(hydrated);
        }
        if (storedCertificates.some(certificate => (certificate.templateSnapshot && certificate.templateSnapshot.elements || []).some(element => this.isDataUrl(element.content) || this.isDataUrl(element.src)))) {
          await this.saveCertificates(hydratedCertificates);
        }
      } catch (error) {
        console.warn('Persistent image storage is unavailable; using legacy template storage.', error);
        this.templateCache = storedTemplates;
      }
    })();
    return this.storageReady;
  },

  hydrateTemplateAssets(template, assets) {
    const copy = JSON.parse(JSON.stringify(template));
    (copy.elements || []).forEach(element => {
      if (element.assetId && assets.has(element.assetId)) element.content = assets.get(element.assetId);
      if (element.type === 'image') {
        const role = this.getImageRole(element);
        if (role) {
          element.role = role;
          element.imageType = role;
        }
      }
    });
    return copy;
  },

  hydrateCertificateAssets(certificate, assets) {
    const copy = JSON.parse(JSON.stringify(certificate));
    if (copy.templateSnapshot) copy.templateSnapshot = this.hydrateTemplateAssets(copy.templateSnapshot, assets);
    return copy;
  },

  async saveCertificates(certificates) {
    const cachedCertificates = JSON.parse(JSON.stringify(certificates));
    this.certificateCache = cachedCertificates;
    const metadata = JSON.parse(JSON.stringify(certificates));
    try {
      const db = await this.openAssetDatabase();
      const transaction = db.transaction('assets', 'readwrite');
      metadata.forEach(certificate => (certificate.templateSnapshot && certificate.templateSnapshot.elements || []).forEach(element => {
        if (element.type !== 'image') return;
        const sourceKey = this.isDataUrl(element.content) ? 'content' : (this.isDataUrl(element.src) ? 'src' : '');
        if (!sourceKey) return;
        const assetId = element.assetId || `certificate:${certificate.id}:element:${element.id}`;
        transaction.objectStore('assets').put({ id: assetId, data: element[sourceKey] });
        element.assetId = assetId;
        element[sourceKey] = '';
      }));
      await new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
      if (!this.setToStorage('certificates', metadata)) throw new Error('Certificate metadata could not be saved');
      return true;
    } catch (error) {
      console.error('Failed to save certificate assets', error);
      return false;
    }
  },

  async saveTemplates(templates) {
    const cachedTemplates = JSON.parse(JSON.stringify(templates));
    this.templateCache = cachedTemplates;
    const metadata = JSON.parse(JSON.stringify(templates));
    try {
      const db = await this.openAssetDatabase();
      const transaction = db.transaction('assets', 'readwrite');
      metadata.forEach(template => (template.elements || []).forEach(element => {
        if (element.type !== 'image') return;
        const role = this.getImageRole(element);
        if (role) {
          element.role = role;
          element.imageType = role;
          const cachedElement = (cachedTemplates.find(item => item.id === template.id).elements || []).find(item => item.id === element.id);
          if (cachedElement) {
            cachedElement.role = role;
            cachedElement.imageType = role;
          }
        }
        const sourceKey = this.isDataUrl(element.content) ? 'content' : (this.isDataUrl(element.src) ? 'src' : '');
        if (!sourceKey) return;
        const assetId = element.assetId || `template:${template.id}:element:${element.id}`;
        transaction.objectStore('assets').put({ id: assetId, data: element[sourceKey] });
        element.assetId = assetId;
        element[sourceKey] = '';
      }));
      await new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
      if (!this.setToStorage('templates', metadata)) throw new Error('Template metadata could not be saved');
      return true;
    } catch (error) {
      console.error('Failed to save template assets', error);
      // Keep the current editor state intact; legacy storage is only used when it fits.
      return false;
    }
  },
  generateId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  },

  generateCertificateNumber() {
    const prefix = 'STC';
    const year = new Date().getFullYear();
    const num = Math.floor(Math.random() * 90000) + 10000;
    return `${prefix}${year}${num}`;
  },

  formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  },

  formatDateTime(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  truncate(str, len = 50) {
    if (!str) return '';
    return str.length > len ? str.substring(0, len) + '...' : str;
  },

  capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  isValidPhone(phone) {
    return /^[\d\s\-+()]{7,15}$/.test(phone);
  },

  debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  getFromStorage(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch { return null; }
  },

  setToStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch { return false; }
  },

  removeFromStorage(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch { return false; }
  },

  getQueryParam(param) {
    const url = new URL(window.location.href);
    return url.searchParams.get(param);
  },

  navigateTo(page) {
    window.location.href = page;
  },

  getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(w => w.charAt(0)).join('').toUpperCase().substring(0, 2);
  },

  exportToCSV(data, filename) {
    if (!data || !data.length) return;
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => {
        const val = row[h] || '';
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  },

  exportToExcel(data, filename) {
    this.exportToCSV(data, filename);
  },

  printElement(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const paperSize = el.dataset.paperSize || 'A4';
    const orientation = el.dataset.orientation || 'Landscape';
    const isPortrait = orientation.toLowerCase() === 'portrait';
    const canvasW = el.dataset.width || (isPortrait ? '794' : '1123');
    const canvasH = el.dataset.height || (isPortrait ? '1123' : '794');

    const clone = el.cloneNode(true);
    clone.style.transform = 'none';
    clone.style.margin = '0';
    const html = clone.outerHTML;
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head>
        <title>Print Certificate</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600;700&family=Roboto:wght@300;400;500;700&family=Open+Sans:wght@300;400;500;600;700&family=Montserrat:wght@300;400;500;600;700;800&family=Lato:wght@300;400;700&family=Nunito:wght@300;400;600;700&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Merriweather:ital,wght@0,300;0,400;0,700;1,300&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
        <link rel="stylesheet" href="css/style.css">
        <link rel="stylesheet" href="css/components.css">
        <style>
          @page {
            size: ${paperSize.toLowerCase()} ${orientation.toLowerCase()};
            margin: 0;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            width: ${canvasW}px !important;
            height: ${canvasH}px !important;
            overflow: hidden !important;
          }
          .certificate-a4-canvas {
            margin: 0 !important;
            border: none !important;
            box-sizing: border-box !important;
            box-shadow: none !important;
            transform: none !important;
            width: ${canvasW}px !important;
            height: ${canvasH}px !important;
          }
        </style>
      </head><body>
        ${html}
        <script>
          window.onload = () => {
            const imgs = document.querySelectorAll('img');
            const promises = Array.from(imgs).map(img => {
              if (img.complete) return Promise.resolve();
              return new Promise(resolve => {
                img.onload = resolve;
                img.onerror = resolve;
              });
            });
            Promise.all(promises).then(() => {
              setTimeout(() => {
                window.print();
                window.close();
              }, 300);
            });
          };
        </script>
      </body></html>
    `);
    win.document.close();
  },

  async downloadPDF(elementId, filename) {
    const el = document.getElementById(elementId);
    if (!el) return;

    const loadScript = (url) => new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${url}"]`)) {
        resolve();
        return;
      }
      const s = document.createElement('script');
      s.src = url;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Failed to load script " + url));
      document.head.appendChild(s);
    });

    if (typeof showToast === 'function') {
      showToast('Generating PDF', 'Preparing certificate download...', 'info');
    }

    try {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');

      const paperSize = el.dataset.paperSize || 'A4';
      const orientation = el.dataset.orientation || 'Landscape';
      const isPortrait = orientation.toLowerCase() === 'portrait';
      const isLetter = paperSize.toLowerCase() === 'letter';
      const canvasW = parseInt(el.dataset.width) || (isPortrait ? 794 : 1123);
      const canvasH = parseInt(el.dataset.height) || (isPortrait ? 1123 : 794);

      let pdfW, pdfH;
      if (isLetter) {
        pdfW = isPortrait ? 612 : 792;
        pdfH = isPortrait ? 792 : 612;
      } else {
        pdfW = isPortrait ? 595.28 : 841.89;
        pdfH = isPortrait ? 841.89 : 595.28;
      }

      const clone = el.cloneNode(true);
      clone.style.position = 'absolute';
      clone.style.left = '-9999px';
      clone.style.top = '-9999px';
      clone.style.transform = 'none';
      clone.style.transformOrigin = 'initial';
      clone.style.margin = '0';
      clone.style.display = 'block';

      document.body.appendChild(clone);

      // Wait for all images in the clone to finish loading to prevent blank images in PDF
      const cloneImgs = clone.querySelectorAll('img');
      const imgPromises = Array.from(cloneImgs).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      });
      await Promise.all(imgPromises);

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        width: canvasW,
        height: canvasH,
        scrollX: 0,
        scrollY: 0
      });

      document.body.removeChild(clone);

      const imgData = canvas.toDataURL('image/png');
      const { jsPDF } = window.jspdf;
      
      const pdf = new jsPDF({
        orientation: orientation.toLowerCase(),
        unit: 'pt',
        format: paperSize.toLowerCase()
      });

      pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH);
      pdf.save(`${filename}.pdf`);
      
      if (typeof showToast === 'function') {
        showToast('Download Complete', 'PDF generated successfully', 'success');
      }
    } catch (err) {
      console.error(err);
      if (typeof showToast === 'function') {
        showToast('Error', 'Failed to generate PDF. Check console.', 'error');
      }
    }
  },

  showSkeleton(containerId, count = 3) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const skeleton = document.createElement('div');
      skeleton.className = 'skeleton-card-item';
      skeleton.innerHTML = `
        <div class="skeleton skeleton-avatar"></div>
        <div class="skeleton-lines">
          <div class="skeleton skeleton-line"></div>
          <div class="skeleton skeleton-line"></div>
          <div class="skeleton skeleton-line"></div>
        </div>
      `;
      container.appendChild(skeleton);
    }
  },

  animateCounter(el, target, duration = 1000) {
    let start = 0;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        el.textContent = target;
        clearInterval(timer);
      } else {
        el.textContent = Math.floor(start);
      }
    }, 16);
  },

  replaceVariables(text, data, company) {
    if (!text) return '';
    const studentType = data.studentType || 'Internship';
    const programTitle = studentType === 'Internship' ? (data.internshipTitle || 'Internship Program') : (data.course || 'Course Program');
    const vars = {
      '{{StudentName}}': data.studentName || 'Student Name',
      '{{RegisterNumber}}': data.registerNumber || 'REG-001',
      '{{College}}': data.college || 'College Name',
      '{{Department}}': data.department || 'Department',
      '{{Course}}': data.course || 'Course',
      '{{InternshipTitle}}': data.internshipTitle || 'Internship Program',
      '{{Duration}}': data.duration || '3 Months',
      '{{StartDate}}': Utils.formatDate(data.startDate) || 'Start Date',
      '{{EndDate}}': Utils.formatDate(data.endDate) || 'End Date',
      '{{IssueDate}}': Utils.formatDate(data.issueDate) || new Date().toLocaleDateString(),
      '{{CertificateID}}': data.certificateNumber || 'STC20260001',
      '{{CompanyName}}': company,
      '{{GuideName}}': '',
      '{{StudentType}}': studentType,
      '{{ProgramTitle}}': programTitle,
      '{{QR}}': '<div class="certificate-qr" style="display:inline-flex;width:70px;height:70px;background:#F3F4F6;border-radius:8px;align-items:center;justify-content:center;font-size:32px;color:#9CA3AF"><i class="fas fa-qrcode"></i></div>'
    };
    let result = text;
    Object.keys(vars).forEach(key => {
      result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), vars[key]);
    });
    return result;
  },

  renderElementHTML(item, data, settings, options = {}) {
    const isDesigner = options.isDesigner || false;
    const replacedContent = isDesigner ? item.content : Utils.replaceVariables(item.content || '', data, settings.companyName);
    
    const zIndex = item.zIndex !== undefined ? item.zIndex : (item.type === 'background' ? 0 : 1);

    const outerStyle = [
      `position: absolute`,
      `left: ${item.x}px`,
      `top: ${item.y}px`,
      `width: ${item.width}px`,
      `height: ${item.height}px`,
      `transform: rotate(${item.rotation || 0}deg)`,
      `opacity: ${item.opacity !== undefined ? item.opacity : 1.0}`,
      `z-index: ${zIndex}`,
      `box-sizing: border-box`
    ].join('; ');

    if (item.type === 'text') {
      const innerStyle = [
        `width: 100%`,
        `height: 100%`,
        `margin: 0`,
        `padding: 0`,
        `box-sizing: border-box`,
        `font-family: '${item.fontFamily}', sans-serif`,
        `font-size: ${item.fontSize}px`,
        `font-weight: ${item.fontWeight}`,
        `font-style: ${item.fontStyle}`,
        `text-decoration: ${item.textDecoration}`,
        `color: ${item.color}`,
        `text-align: ${item.textAlign}`,
        `letter-spacing: ${item.letterSpacing}px`,
        `line-height: ${item.lineHeight}`,
        `text-transform: ${item.textTransform}`,
        `text-shadow: ${item.textShadow || 'none'}`,
        `border: ${item.borderWidth ? `${item.borderWidth}px solid ${item.borderColor || '#000'}` : 'none'}`,
        `border-radius: ${item.borderRadius || 0}px`,
        `word-break: break-word`,
        `white-space: pre-wrap`,
        `overflow: hidden`
      ].join('; ');

      if (isDesigner) {
        return `
          <div id="${item.id}" class="designer-element ${item.locked ? 'locked' : ''} ${item.id === options.selectedElementId ? 'selected' : ''}" style="${outerStyle}">
            <div class="designer-text-editable" contenteditable="${!item.locked}" style="${innerStyle}">${replacedContent}</div>
            ${options.handlesHTML || ''}
          </div>`;
      } else {
        return `
          <div id="${item.id}" style="${outerStyle}">
            <div style="${innerStyle}">${replacedContent}</div>
          </div>`;
      }
    } else if (['image', 'logo', 'signature', 'seal', 'background'].includes(item.type)) {
      let imgSrc = item.src || item.content || '';
      if (!imgSrc && !isDesigner) {
        if (item.type === 'signature' || item.id === 'el_signature' || (item.id && item.id.startsWith('el_sig_'))) {
          imgSrc = settings.signature || '';
        } else if (item.type === 'seal' || item.id === 'el_seal' || (item.id && item.id.startsWith('el_seal_'))) {
          imgSrc = settings.seal || '';
        } else if (item.type === 'logo' || item.id === 'el_logo' || (item.id && item.id.startsWith('el_logo_'))) {
          imgSrc = settings.logo || '';
        } else if (item.type === 'background') {
          imgSrc = settings.background || '';
        }
      }
      
      const finalSrc = imgSrc || 'https://via.placeholder.com/' + item.width + 'x' + item.height + '?text=' + (item.placeholder || item.type || 'Image');
      const objectFit = item.type === 'background' ? 'cover' : 'contain';
      
      const innerStyle = [
        `width: 100%`,
        `height: 100%`,
        `object-fit: ${objectFit}`,
        `display: block`
      ].join('; ');

      if (isDesigner) {
        return `
          <div id="${item.id}" class="designer-element ${item.locked ? 'locked' : ''} ${item.id === options.selectedElementId ? 'selected' : ''}" style="${outerStyle}">
            <img class="designer-image-element" src="${finalSrc}" style="${innerStyle}; pointer-events: none;" />
            ${options.handlesHTML || ''}
          </div>`;
      } else {
        return `
          <div id="${item.id}" style="${outerStyle}">
            <img src="${finalSrc}" style="${innerStyle}" />
          </div>`;
      }
    }
    return '';
  },

  renderCanvasHTML(tpl, data, settings, options = {}) {
    const isDesigner = options.isDesigner || false;
    const orientation = tpl && tpl.orientation ? tpl.orientation : 'Landscape';
    const isPortrait = orientation.toLowerCase() === 'portrait';
    const paperSize = tpl && tpl.paperSize ? tpl.paperSize : 'A4';
    const isLetter = paperSize.toLowerCase() === 'letter';
    
    let canvasW, canvasH;
    if (isLetter) {
      canvasW = isPortrait ? 850 : 1100;
      canvasH = isPortrait ? 1100 : 850;
    } else {
      canvasW = isPortrait ? 794 : 1123;
      canvasH = isPortrait ? 1123 : 794;
    }

    const bg = tpl.bgConfig || {};
    const bgStyle = bg.type === 'gradient' && bg.gradient ? bg.gradient : bg.color || '#FFFFFF';

    // Border HTML
    let borderHTML = '';
    if ((bg.borderWidth || 0) > 0) {
      const borderStyle = [
        `position: absolute`,
        `left: 0`,
        `top: 0`,
        `right: 0`,
        `bottom: 0`,
        `border: ${bg.borderWidth}px ${bg.borderStyle || 'solid'} ${bg.borderColor || '#1565C0'}`,
        `border-radius: ${bg.borderRadius || 0}px`,
        `pointer-events: none`,
        `box-sizing: border-box`,
        `z-index: 999`
      ].join('; ');
      borderHTML = `<div class="canvas-border" style="${borderStyle}"></div>`;
    }

    // Watermark HTML
    let watermarkHTML = '';
    if (bg.watermark && bg.watermarkVisible !== false) {
      const wmW = bg.watermarkWidth || 200;
      const wmH = bg.watermarkHeight || 200;
      const wmScale = (bg.watermarkScale || 100) / 100;
      const wmX = bg.watermarkX != null ? bg.watermarkX + 'px' : '50%';
      const wmY = bg.watermarkY != null ? bg.watermarkY + 'px' : '50%';
      const wmStyle = [
        `position: absolute`,
        `left: ${wmX}`,
        `top: ${wmY}`,
        `width: ${wmW}px`,
        `height: ${wmH}px`,
        `opacity: ${bg.watermarkOpacity || 0.15}`,
        `transform: translate(-50%, -50%) rotate(${bg.watermarkRotation || 0}deg) scale(${wmScale})`,
        `pointer-events: none`,
        `user-select: none`,
        `z-index: 1`,
        `display: block`
      ].join('; ');
      watermarkHTML = `<img class="designer-watermark" src="${bg.watermark}" style="${wmStyle}" draggable="false">`;
    }

    // Elements HTML
    const validElements = tpl && tpl.elements ? [...tpl.elements].filter(el => el.visible !== false) : [];
    
    // Sort elements by zIndex (layer order)
    validElements.sort((a, b) => {
      const az = a.zIndex !== undefined ? a.zIndex : (a.type === 'background' ? 0 : 1);
      const bz = b.zIndex !== undefined ? b.zIndex : (b.type === 'background' ? 0 : 1);
      return az - bz;
    });

    let elementsHTML = '';
    validElements.forEach(item => {
      elementsHTML += Utils.renderElementHTML(item, data, settings, options);
    });

    const hasBgElement = validElements.some(el => el.type === 'background');
    const finalBgImageStyle = (bg.image && !hasBgElement) ? `background-image: url('${bg.image}')` : `background-image: none`;

    const canvasStyle = [
      `width: ${canvasW}px`,
      `height: ${canvasH}px`,
      `min-width: ${canvasW}px`,
      `min-height: ${canvasH}px`,
      `flex-shrink: 0`,
      `position: relative`,
      `overflow: hidden`,
      `background: ${bgStyle}`,
      `background-size: ${bg.size || 'cover'}`,
      `background-position: center`,
      `background-repeat: ${bg.size === 'repeat' ? 'repeat' : 'no-repeat'}`,
      finalBgImageStyle,
      `opacity: ${bg.opacity || 1.0}`,
      `box-sizing: border-box`
    ].join('; ');

    const canvasId = isDesigner ? 'designerCanvas' : 'certificateDisplay';
    const canvasClass = isDesigner ? 'designer-canvas' : 'certificate-a4-canvas';

    return `
      <div class="${canvasClass} ${orientation.toLowerCase()}-${paperSize.toLowerCase()}" 
        id="${canvasId}" 
        style="${canvasStyle}"
        data-paper-size="${paperSize}"
        data-orientation="${orientation}"
        data-width="${canvasW}"
        data-height="${canvasH}"
      >
        ${isDesigner ? '<div class="canvas-grid-overlay" id="gridOverlay"></div>' : ''}
        ${watermarkHTML}
        ${elementsHTML}
        ${borderHTML}
      </div>`;
  },

  getDefaultElements(template) {
    const isPortrait = template && template.orientation && template.orientation.toLowerCase() === 'portrait';
    const cx = isPortrait ? 794 / 2 : 1123 / 2;
    return [
      {
        id: 'el_company_name', type: 'text',
        content: 'SAMUDHRA TECH SOLUTIONS',
        x: cx - 450, y: 80, width: 900, height: 35, rotation: 0,
        fontFamily: 'Poppins', fontSize: 14, fontWeight: '600',
        fontStyle: 'normal', textDecoration: 'none', color: '#1565C0',
        textAlign: 'center', letterSpacing: 3, lineHeight: 1.5,
        textTransform: 'uppercase', opacity: 1.0, textShadow: 'none',
        borderWidth: 0, borderColor: 'transparent',
        borderRadius: 0, locked: false
      },
      {
        id: 'el_title', type: 'text',
        content: 'CERTIFICATE OF APPRECIATION',
        x: cx - 450, y: 130, width: 900, height: 60, rotation: 0,
        fontFamily: 'Playfair Display', fontSize: 32, fontWeight: '700',
        fontStyle: 'normal', textDecoration: 'none', color: '#111827',
        textAlign: 'center', letterSpacing: 1, lineHeight: 1.2,
        textTransform: 'none', opacity: 1.0, textShadow: 'none',
        borderWidth: 0, borderColor: 'transparent',
        borderRadius: 0, locked: false
      },
      {
        id: 'el_presents_to', type: 'text',
        content: 'This certificate is proudly presented to',
        x: cx - 350, y: 220, width: 700, height: 30, rotation: 0,
        fontFamily: 'Montserrat', fontSize: 14, fontWeight: '400',
        fontStyle: 'italic', textDecoration: 'none', color: '#6B7280',
        textAlign: 'center', letterSpacing: 1, lineHeight: 1.5,
        textTransform: 'none', opacity: 1.0, textShadow: 'none',
        borderWidth: 0, borderColor: 'transparent',
        borderRadius: 0, locked: false
      },
      {
        id: 'el_student_name', type: 'text',
        content: '{{StudentName}}',
        x: cx - 400, y: 270, width: 800, height: 70, rotation: 0,
        fontFamily: 'Playfair Display', fontSize: 36, fontWeight: '700',
        fontStyle: 'normal', textDecoration: 'none', color: '#1565C0',
        textAlign: 'center', letterSpacing: 0, lineHeight: 1.2,
        textTransform: 'none', opacity: 1.0, textShadow: 'none',
        borderWidth: 0, borderColor: 'transparent',
        borderRadius: 0, locked: false
      },
      {
        id: 'el_description', type: 'text',
        content: 'for successfully completing the program from {{StartDate}} to {{EndDate}} with outstanding performance.',
        x: cx - 400, y: 360, width: 800, height: 80, rotation: 0,
        fontFamily: 'Poppins', fontSize: 13, fontWeight: '400',
        fontStyle: 'normal', textDecoration: 'none', color: '#4B5563',
        textAlign: 'center', letterSpacing: 0.5, lineHeight: 1.8,
        textTransform: 'none', opacity: 1.0, textShadow: 'none',
        borderWidth: 0, borderColor: 'transparent',
        borderRadius: 0, locked: false
      },
      {
        id: 'el_signature', type: 'image',
        role: 'signature', imageType: 'signature', content: '', placeholder: 'Signature',
        x: cx - 350, y: 500, width: 160, height: 60, rotation: 0,
        opacity: 1.0, locked: false, visible: true, zIndex: 2
      },
      {
        id: 'el_sig_label', type: 'text',
        content: 'Authorized Signatory\nSamudhra Tech Solutions',
        x: cx - 350, y: 565, width: 160, height: 40, rotation: 0,
        fontFamily: 'Poppins', fontSize: 10, fontWeight: '500',
        fontStyle: 'normal', textDecoration: 'none', color: '#6B7280',
        textAlign: 'center', letterSpacing: 0, lineHeight: 1.4,
        textTransform: 'none', opacity: 1.0, textShadow: 'none',
        borderWidth: 0, borderColor: 'transparent',
        borderRadius: 0, locked: false
      },
      {
        id: 'el_seal', type: 'image',
        role: 'seal', imageType: 'seal', content: '', placeholder: 'Company Seal',
        x: cx + 180, y: 490, width: 100, height: 100, rotation: 0,
        opacity: 0.9, locked: false, visible: true, zIndex: 2
      },
      {
        id: 'el_qrcode', type: 'image',
        content: '', placeholder: 'QR Code',
        x: cx - 50, y: 480, width: 90, height: 90, rotation: 0,
        opacity: 1.0, locked: false
      },
      {
        id: 'el_cert_id', type: 'text',
        content: 'Certificate ID: {{CertificateID}}',
        x: cx - 150, y: 580, width: 300, height: 20, rotation: 0,
        fontFamily: 'Poppins', fontSize: 10, fontWeight: '400',
        fontStyle: 'normal', textDecoration: 'none', color: '#9CA3AF',
        textAlign: 'center', letterSpacing: 1, lineHeight: 1.2,
        textTransform: 'none', opacity: 1.0, textShadow: 'none',
        borderWidth: 0, borderColor: 'transparent',
        borderRadius: 0, locked: false
      }
    ];
  },

  getDefaultTemplates() {
    return [
      {
        id: 'tpl_1',
        name: 'Internship Certificate',
        category: 'Internship',
        description: 'Standard internship completion certificate',
        orientation: 'Landscape',
        paperSize: 'A4',
        status: 'Active',
        createdAt: '2026-01-15',
        lastUpdated: '2026-01-15',
        bgConfig: {
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
        },
        elements: []
      },
      {
        id: 'tpl_2',
        name: 'Course Certificate',
        category: 'Course',
        description: 'Course completion certificate',
        orientation: 'Landscape',
        paperSize: 'A4',
        status: 'Active',
        createdAt: '2026-02-20',
        lastUpdated: '2026-02-20',
        bgConfig: {
          type: 'color',
          color: '#FFF9E6',
          opacity: 1.0,
          image: '',
          size: 'cover',
          borderWidth: 0,
          borderColor: '#F59E0B',
          borderStyle: 'solid',
          watermark: '', watermarkOpacity: 0.1,
          watermarkWidth: 200, watermarkHeight: 200, watermarkScale: 100,
          watermarkAspectRatio: true, watermarkRotation: 0,
          watermarkX: null, watermarkY: null,
          watermarkVisible: true, watermarkLocked: false
        },
        elements: []
      }
    ];
  },

  getTemplates() {
    if (this.templateCache && this.templateCache.length) return this.templateCache;
    let templates = Utils.getFromStorage('templates') || [];
    if (!templates.length) {
      templates = Utils.getDefaultTemplates();
      this.templateCache = templates;
      this.saveTemplates(templates);
    }
    return templates;
  },

  getCertificates() {
    return this.certificateCache || this.getFromStorage('certificates') || [];
  }
};

/* === API Service (ready for Spring Boot backend) === */
class ApiService {
  constructor(baseUrl = 'http://localhost:8080/api') {
    this.baseUrl = baseUrl;
  }

  async get(endpoint) {
    try {
      const res = await fetch(`${this.baseUrl}${endpoint}`);
      if (!res.ok) throw new Error(`GET ${endpoint} failed`);
      return await res.json();
    } catch (err) {
      console.warn(`API GET ${endpoint} failed, using local data:`, err.message);
      return null;
    }
  }

  async post(endpoint, data) {
    try {
      const res = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(`POST ${endpoint} failed`);
      return await res.json();
    } catch (err) {
      console.warn(`API POST ${endpoint} failed, using local data:`, err.message);
      return null;
    }
  }

  async put(endpoint, data) {
    try {
      const res = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(`PUT ${endpoint} failed`);
      return await res.json();
    } catch (err) {
      console.warn(`API PUT ${endpoint} failed, using local data:`, err.message);
      return null;
    }
  }

  async delete(endpoint) {
    try {
      const res = await fetch(`${this.baseUrl}${endpoint}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`DELETE ${endpoint} failed`);
      return true;
    } catch (err) {
      console.warn(`API DELETE ${endpoint} failed, using local data:`, err.message);
      return null;
    }
  }
}

const API = new ApiService();
