const Certificate = {
  certificates: [],
  templates: [],

  async init() {
    try {
      const data = await Api.templates.list();
      this.templates = data && data.content ? data.content : (Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load templates from API:', err);
      this.templates = [];
    }
    
    try {
      this.certificates = await Api.certificates.list() || [];
    } catch (err) {
      console.error('Failed to load certificates from API:', err);
      this.certificates = [];
    }

    await this.setupForm();
    this.setupLivePreview();
    this.setupTemplateSelector();
    this.setupGenerate();
    this.autoFillCertificateNumber();
    this.setupTemplatePreviewSync();
  },

  setupTemplatePreviewSync() {
    const templateSelect = document.getElementById('certTemplate');
    if (templateSelect) {
      templateSelect.addEventListener('change', () => {
        if (document.getElementById('livePreview')) {
          this.updateLivePreview();
        }
      });
    }
  },

  async initPreview() {
    try {
      const data = await Api.templates.list();
      this.templates = data && data.content ? data.content : (Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load templates:', err);
      this.templates = [];
    }
    const params = new URLSearchParams(window.location.search);
    const certId = params.get('id');
    let loaded = false;
    if (certId) {
      loaded = await this.loadCertificate(certId);
    } else {
      const data = Utils.getFromStorage('previewData');
      if (data) {
        this.renderPreview(data);
        Utils.removeFromStorage('previewData');
        loaded = true;
      }
    }

    if (!loaded) {
      this.showNotFoundError();
    }
    this.setupPreviewButtons();
  },

  async setupForm() {
    const form = document.getElementById('certificateForm');
    if (!form) return;
    
    let students = [];
    try {
      const data = await Api.students.list();
      students = data && data.content ? data.content : (Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch students from API:', err);
      students = [];
    }
    this.students = students;

    const studentSelect = document.getElementById('certStudentSelect');
    if (studentSelect && students.length) {
      studentSelect.innerHTML = `<option value="">Select existing student...</option>
        ${students.map(s => `<option value="${s.id}">${s.name} (${s.studentType || 'Internship'}) - [${s.status || 'Active'}]</option>`).join('')}`;
      studentSelect.addEventListener('change', (e) => {
        const student = students.find(s => s.id === e.target.value);
        if (student) {
          document.getElementById('certStudentName').value = student.name || '';
          document.getElementById('certRegisterNumber').value = student.registerNumber || '';
          document.getElementById('certCollege').value = student.college || '';
          document.getElementById('certDepartment').value = student.department || '';
          document.getElementById('certDuration').value = student.duration || '';
          document.getElementById('certStartDate').value = student.startDate || '';
          document.getElementById('certEndDate').value = student.endDate || '';
          const type = student.studentType || 'Internship';
          const internshipGroup = document.getElementById('certInternshipGroup');
          const courseGroup = document.getElementById('certCourseGroup');
          if (type === 'Internship') {
            document.getElementById('certInternshipTitle').value = student.internshipTitle || '';
            document.getElementById('certCourse').value = '';
            if (courseGroup) courseGroup.style.display = 'none';
            if (internshipGroup) internshipGroup.style.display = 'block';
          } else {
            document.getElementById('certCourse').value = student.course || '';
            document.getElementById('certInternshipTitle').value = '';
            if (internshipGroup) internshipGroup.style.display = 'none';
            if (courseGroup) courseGroup.style.display = 'block';
          }
          this.updateLivePreview();
        } else {
          const internshipGroup = document.getElementById('certInternshipGroup');
          const courseGroup = document.getElementById('certCourseGroup');
          if (internshipGroup) internshipGroup.style.display = 'block';
          if (courseGroup) courseGroup.style.display = 'block';
        }
      });
    }
  },

  setupTemplateSelector() {
    const template = document.getElementById('certTemplate');
    if (!template) return;
    template.innerHTML = `<option value="">Select template...</option>
      ${this.templates.filter(t => t.status === 'Active' || t.status === 'Draft').map(t => `<option value="${t.id}">${t.name} (${t.orientation})</option>`).join('')}`;
    template.addEventListener('change', () => {
      this.updateLivePreview();
    });
  },

  setupLivePreview() {
    const fields = ['studentName', 'registerNumber', 'college', 'department', 'course', 'internshipTitle', 'duration', 'startDate', 'endDate', 'issueDate', 'certificateNumber'];
    fields.forEach(f => {
      const el = document.getElementById(`cert${f.charAt(0).toUpperCase() + f.slice(1)}`);
      if (el) {
        el.addEventListener('input', () => this.updateLivePreview());
        el.addEventListener('change', () => this.updateLivePreview());
      }
    });
    const internshipInput = document.getElementById('certInternshipTitle');
    if (internshipInput) {
      internshipInput.addEventListener('input', () => this.updateLivePreview());
      internshipInput.addEventListener('change', () => this.updateLivePreview());
    }
    const courseInput = document.getElementById('certCourse');
    if (courseInput) {
      courseInput.addEventListener('input', () => this.updateLivePreview());
      courseInput.addEventListener('change', () => this.updateLivePreview());
    }
  },

  updateLivePreview() {
    const data = this.getFormData();
    this.renderPreview(data);
  },

  getFormData() {
    const get = (id) => (document.getElementById(id) || {}).value || '';
    const studentType = (() => {
      const sel = document.getElementById('certStudentSelect');
      if (sel && sel.value) {
        const students = this.students || [];
        const s = students.find(st => st.id === sel.value);
        if (s) return s.studentType || 'Internship';
      }
      // Infer based on which field is filled if entering manually
      const course = get('certCourse');
      const internship = get('certInternshipTitle');
      if (course && !internship) return 'Course';
      return 'Internship';
    })();
    return {
      studentName: get('certStudentName'),
      registerNumber: get('certRegisterNumber'),
      college: get('certCollege'),
      department: get('certDepartment'),
      course: get('certCourse'),
      internshipTitle: get('certInternshipTitle'),
      duration: get('certDuration'),
      startDate: get('certStartDate'),
      endDate: get('certEndDate'),
      issueDate: get('certIssueDate'),
      certificateNumber: get('certCertificateNumber'),
      templateId: get('certTemplate'),
      studentType: studentType
    };
  },

  getTemplateById(id) {
    if (!id) return null;
    return this.templates.find(t => t.id === id) || null;
  },

  replaceVariables(text, data, company) {
    return Utils.replaceVariables(text, data, company);
  },

  renderPreview(data) {
    const container = document.getElementById('livePreview');
    if (!container) return;

    // Get template with fallback chain
    let tpl = data.templateSnapshot || null;
    if (!tpl || !tpl.elements || tpl.elements.length === 0) {
      const liveTpl = this.getTemplateById(data.templateId);
      if (liveTpl) {
        tpl = liveTpl;
      }
    }
    if (!tpl) {
      tpl = data.templateSnapshot || this.getTemplateById(data.templateId);
    }
    if (!tpl) return;

    if (!tpl.elements || tpl.elements.length === 0) {
      tpl.elements = Utils.getDefaultElements(tpl);
    }

    const orientation = tpl.orientation || 'Landscape';
    const isPortrait = orientation.toLowerCase() === 'portrait';
    const settings = Utils.getFromStorage('settings') || { companyName: 'Samudhra Tech Solutions' };

    const paperSize = tpl.paperSize || 'A4';
    const isLetter = paperSize.toLowerCase() === 'letter';
    let canvasW, canvasH;
    if (isLetter) {
      canvasW = isPortrait ? 850 : 1100;
      canvasH = isPortrait ? 1100 : 850;
    } else {
      canvasW = isPortrait ? 794 : 1123;
      canvasH = isPortrait ? 1123 : 794;
    }

    const validElements = tpl.elements ? tpl.elements.filter(el => el.visible !== false) : [];
    const canRenderDesigner = validElements.length > 0;

    if (canRenderDesigner) {
      // Use the unified rendering engine
      const canvasHTML = Utils.renderCanvasHTML(tpl, data, settings, { isDesigner: false });

      // Wrap in a container that scales the A4 canvas to fit the viewport
      container.innerHTML = `
        <div class="certificate-preview" style="position:relative;width:100%;overflow:hidden;background:transparent;box-shadow:none;border-radius:0;">
          <div class="certificate-scaler" style="display:flex;justify-content:center;align-items:flex-start;overflow:hidden;">
            ${canvasHTML}
          </div>
        </div>`;

      // Apply automatic scaling so the A4 canvas fits the preview area
      const scaler = container.querySelector('.certificate-scaler');
      const a4canvas = container.querySelector('.certificate-a4-canvas');
      this._fitCanvasToViewport(a4canvas, scaler, canvasW, canvasH);
      return;
    }

    // Fallback default preview (no designer template)
    container.innerHTML = `
      <div class="certificate-preview" id="certificateDisplay"
        data-paper-size="${paperSize}"
        data-orientation="${orientation}"
        data-width="${canvasW}"
        data-height="${canvasH}"
      >
        <div class="certificate-inner ${isPortrait ? 'portrait' : 'landscape'}">
          <div class="certificate-company">${settings.companyName || 'SAMUDHRA TECH SOLUTIONS'}</div>
          <div class="certificate-title">${tpl ? tpl.name : 'Certificate of Completion'}</div>
          <div class="certificate-text">This is to certify that</div>
          <div class="certificate-student-name">${data.studentName || 'Student Name'}</div>
          <div class="certificate-text">
            has successfully completed the internship program in
            <strong>${data.internshipTitle || 'Program'}</strong>
            from ${Utils.formatDate(data.startDate) || 'Start Date'} to ${Utils.formatDate(data.endDate) || 'End Date'}
          </div>
          <div class="certificate-details">
            ${[['Register No', data.registerNumber], ['College', data.college], ['Department', data.department], ['Course', data.course], ['Duration', data.duration]].map(([l, v]) => v ? `
              <div class="certificate-detail-item">
                <div class="certificate-detail-label">${l}</div>
                <div class="certificate-detail-value">${v}</div>
              </div>` : '').join('')}
          </div>
          <div class="certificate-footer">
            <div class="certificate-signature">
              <div class="certificate-signature-line"></div>
              <div class="certificate-signature-name">Authorized Signature</div>
              <div class="certificate-signature-role">${settings.companyName || 'Samudhra Tech Solutions'}</div>
            </div>
            <div class="certificate-qr">
              <i class="fas fa-qrcode"></i>
            </div>
          </div>
          <div class="certificate-issue-date">Issue Date: ${Utils.formatDate(data.issueDate) || 'Today'}</div>
          <div class="certificate-number">#${data.certificateNumber || 'STC20260001'}</div>
        </div>
      </div>
    `;
  },

  _fitCanvasToViewport(canvas, scaler, w, h) {
    const doFit = () => {
      const parentW = scaler.clientWidth || 800;
      const viewH = window.innerHeight * 0.65;
      const scale = Math.min(parentW / w, viewH / h, 1.0);
      canvas.style.transform = `scale(${scale})`;
      canvas.style.transformOrigin = 'top center';
      // Adjust scaler height to match visual canvas height (prevent layout gap)
      scaler.style.height = `${Math.ceil(h * scale)}px`;
    };
    doFit();
    if (this._fitHandler) window.removeEventListener('resize', this._fitHandler);
    this._fitHandler = doFit;
    window.addEventListener('resize', this._fitHandler);
  },

  setupGenerate() {
    const btn = document.getElementById('generateCertificate');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const data = this.getFormData();
      if (!data.studentName || !data.certificateNumber) {
        showToast('Validation Error', 'Student name and certificate number are required', 'error');
        return;
      }
      if (!data.templateId) {
        showToast('Validation Error', 'Please select a template', 'error');
        return;
      }

      // Capture a snapshot of the selected template at generation time
      const tpl = this.getTemplateById(data.templateId);
      if (!tpl) {
        showToast('Validation Error', 'Selected template not found', 'error');
        return;
      }

      if (!tpl.elements || tpl.elements.length === 0) {
        tpl.elements = Utils.getDefaultElements(tpl);
      }

      // LAYOUT VALIDATION: Compare template elements properties with snapshot to prevent alignment bugs
      const snapshot = JSON.parse(JSON.stringify(tpl));
      let validationError = null;
      if (tpl.elements && tpl.elements.length > 0) {
        for (let i = 0; i < tpl.elements.length; i++) {
          const original = tpl.elements[i];
          const snap = snapshot.elements[i];
          if (!snap || 
              original.x !== snap.x || 
              original.y !== snap.y || 
              original.width !== snap.width || 
              original.height !== snap.height || 
              original.rotation !== snap.rotation) {
            validationError = `Element layout mismatch: "${original.content || original.id}" has modified positions.`;
            break;
          }
        }
      }

      if (validationError) {
        showToast('Alignment Validation Failed', validationError, 'error');
        alert('Generation prevented: ' + validationError);
        return;
      }

      // Find or create student in the backend database
      let studentId = (document.getElementById('certStudentSelect') || {}).value;
      if (!studentId && this.students) {
        const regNum = data.registerNumber;
        const existingStudent = this.students.find(s => s.registerNumber === regNum);
        if (existingStudent) {
          studentId = existingStudent.id;
        }
      }
      
      if (studentId && this.students) {
        const student = this.students.find(s => s.id === studentId);
        if (student && (student.status === 'Active' || student.status === 'ACTIVE')) {
          showToast('Validation Error', 'Student is still Active (has not completed the course). Certificate cannot be generated.', 'error');
          alert('Generation prevented: Student is still Active and has not completed the course.');
          return;
        }
      }

      if (!studentId) {
        try {
          const newStudentData = {
            name: data.studentName,
            registerNumber: data.registerNumber || Utils.generateId(),
            studentType: data.studentType,
            college: data.college,
            department: data.department,
            course: data.course || '',
            internshipTitle: data.internshipTitle || '',
            duration: data.duration,
            startDate: data.startDate || new Date().toISOString().split('T')[0],
            endDate: data.endDate || new Date().toISOString().split('T')[0],
            email: `${data.registerNumber || 'student'}@samudhratech.com`,
            phone: '0000000000',
            status: 'Completed'
          };
          const createdStudent = await Api.students.create(newStudentData);
          if (createdStudent && createdStudent.id) {
            studentId = createdStudent.id;
            if (!this.students) this.students = [];
            this.students.push(createdStudent);
          }
        } catch (err) {
          console.error('Failed to create student in backend:', err);
          showToast('Error', 'Failed to save student info to database', 'error');
          return;
        }
      }

      let createdCert = null;
      try {
        const requestData = {
          studentId: studentId,
          templateId: data.templateId,
          certificateNumber: data.certificateNumber,
          issueDate: data.issueDate || new Date().toISOString().split('T')[0],
          templateSnapshot: snapshot
        };
        createdCert = await Api.certificates.generate(requestData);
        showToast('Success', 'Certificate generated successfully', 'success');
      } catch (err) {
        console.error('Failed to generate certificate via API:', err);
        let errMsg = err.message || 'Failed to save certificate to database';
        if (errMsg.includes('Duplicate entry')) {
          errMsg = 'This Certificate Number already exists in the database. Please use a new unique number.';
        }
        showToast('Error', errMsg, 'error');
        return;
      }

      const queryParams = new URLSearchParams({
        id: createdCert.id,
        studentName: createdCert.studentName || data.studentName || '',
        registerNumber: createdCert.registerNumber || data.registerNumber || '',
        college: createdCert.college || data.college || '',
        department: createdCert.department || data.department || '',
        course: createdCert.course || data.course || '',
        internshipTitle: createdCert.internshipTitle || data.internshipTitle || '',
        duration: createdCert.duration || data.duration || '',
        startDate: createdCert.startDate || data.startDate || '',
        endDate: createdCert.endDate || data.endDate || '',
        issueDate: createdCert.issueDate || data.issueDate || '',
        certificateNumber: createdCert.certificateNumber || data.certificateNumber || '',
        templateId: createdCert.templateId || data.templateId || '',
        studentType: createdCert.studentType || data.studentType || 'Internship'
      });
      setTimeout(() => Utils.navigateTo(`preview.html?${queryParams.toString()}`), 1000);
    });
  },

  async loadCertificate(id) {
    try {
      const data = await Api.templates.list();
      this.templates = data && data.content ? data.content : (Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load templates:', err);
      this.templates = [];
    }
    
    // 1. Try to load from API
    let cert = null;
    try {
      const list = await Api.certificates.list() || [];
      cert = list.find(c => c.id === id);
    } catch (err) {
      console.error('Failed to fetch certificate from API:', err);
    }
    
    // 3. Fallback: Reconstruct from URL search parameters (useful for file:// isolation)
    if (!cert) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('studentName') || params.get('studentSelect') || params.get('certificateNumber')) {
        cert = {
          id: id,
          studentName: params.get('studentName') || '',
          registerNumber: params.get('registerNumber') || '',
          college: params.get('college') || '',
          department: params.get('department') || '',
          course: params.get('course') || '',
          internshipTitle: params.get('internshipTitle') || '',
          duration: params.get('duration') || '',
          startDate: params.get('startDate') || '',
          endDate: params.get('endDate') || '',
          issueDate: params.get('issueDate') || '',
          certificateNumber: params.get('certificateNumber') || '',
          templateId: params.get('templateId') || '',
          studentType: params.get('studentType') || 'Internship'
        };
      }
    }

    if (cert) {
      this.renderPreview(cert);
      return true;
    }
    return false;
  },

  showNotFoundError() {
    const container = document.getElementById('livePreview');
    if (!container) return;
    
    const isFileProtocol = window.location.protocol === 'file:';
    const protocolWarning = isFileProtocol ? `
      <div style="margin-top:16px;padding:12px;background:#FFFDE7;border:1px solid #FFE082;border-radius:6px;text-align:left;font-size:13px;color:#7F5F00;line-height:1.5;">
        <i class="fas fa-info-circle" style="margin-right:6px;color:#F57F17"></i>
        <strong>Running on Local Files (file://):</strong> Modern browsers isolate storage between local files. 
        To share templates and certificates across pages, please run a local web server (e.g. click "Go Live" in VS Code, or run <code>npx serve</code> in the project directory) and open the app via <code>http://localhost:...</code>.
      </div>
    ` : '';

    container.innerHTML = `
      <div style="text-align:center;padding:48px;color:var(--error);background:white;border-radius:var(--radius-lg);box-shadow:var(--shadow);border:1px solid #FFCDD2">
        <i class="fas fa-exclamation-circle" style="font-size:48px;margin-bottom:16px;color:#D32F2F"></i>
        <h3 style="color:#D32F2F;font-size:20px;font-weight:600">Certificate Not Found</h3>
        <p style="margin-top:8px;color:var(--text-muted)">The requested certificate ID does not exist in the database or templates storage.</p>
        ${protocolWarning}
        <button class="btn btn-primary" onclick="window.history.back()" style="margin-top:24px"><i class="fas fa-arrow-left"></i> Back</button>
      </div>
    `;
    const printBtn = document.getElementById('printCertificate');
    if (printBtn) printBtn.disabled = true;
    const downloadBtn = document.getElementById('downloadCertificate');
    if (downloadBtn) downloadBtn.disabled = true;
  },

  setupPreviewButtons() {
    const printBtn = document.getElementById('printCertificate');
    if (printBtn) {
      printBtn.addEventListener('click', () => Utils.printElement('certificateDisplay'));
    }
    const downloadBtn = document.getElementById('downloadCertificate');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        const num = (document.querySelector('.certificate-number') || {}).textContent || 'certificate';
        Utils.downloadPDF('certificateDisplay', num.replace('#', ''));
      });
    }
  },

  autoFillCertificateNumber() {
    const el = document.getElementById('certCertificateNumber');
    if (el && !el.value) el.value = Utils.generateCertificateNumber();
    const issueEl = document.getElementById('certIssueDate');
    if (issueEl && !issueEl.value) issueEl.value = new Date().toISOString().split('T')[0];
  },

  /* === Bulk Generation === */
  initBulk() {
    this.setupBulkUpload();
  },

  setupBulkUpload() {
    const area = document.getElementById('bulkUploadArea');
    if (!area) return;
    area.addEventListener('click', () => {
      showToast('Info', 'Upload Excel file (placeholder). Backend integration required for actual file processing.', 'info');
    });
  }
};

/* === Verification Page === */
const Verification = {
  certificates: [],

  async init() {
    try {
      this.certificates = await Api.certificates.list() || [];
    } catch (err) {
      console.warn('Failed to load certificates from API, falling back to local storage:', err);
      this.certificates = Utils.getCertificates();
    }
    this.setupVerification();
  },

  setupVerification() {
    const btn = document.getElementById('verifyBtn');
    const input = document.getElementById('verifyInput');
    if (!btn || !input) return;
    btn.addEventListener('click', () => this.verify(input.value.trim()));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.verify(input.value.trim()); });
  },

  async verify(query) {
    const result = document.getElementById('verificationResult');
    if (!query) {
      showToast('Info', 'Please enter a certificate number or student name', 'warning');
      return;
    }
    if (!result) return;

    let cert = null;
    try {
      cert = await Api.certificates.verify(query);
    } catch (err) {
      cert = this.certificates.find(c =>
        c.certificateNumber === query ||
        (c.studentName && c.studentName.toLowerCase().includes(query.toLowerCase()))
      );
    }

    if (cert) {
      const certType = cert.studentType || 'Internship';
      const programField = certType === 'Internship' ? cert.internshipTitle : cert.course;
      result.className = 'verification-result valid';
      
      const settings = Utils.getFromStorage('settings') || { companyName: 'Samudhra Tech Solutions' };
      const hiddenCanvasHTML = cert.templateSnapshot ? Utils.renderCanvasHTML(cert.templateSnapshot, cert, settings, { isDesigner: false }) : '';

      result.innerHTML = `
        <div class="verification-icon"><i class="fas fa-check-circle"></i></div>
        <div class="verification-status">Valid Certificate</div>
        <p style="color:var(--text-secondary);margin-bottom:16px">This certificate has been verified and is authentic.</p>
        <div class="verification-details">
          <div><strong>Student:</strong> ${cert.studentName}</div>
          <div><strong>Certificate No:</strong> ${cert.certificateNumber}</div>
          <div><strong>Program:</strong> ${programField || 'N/A'}</div>
          <div><strong>Type:</strong> ${certType}</div>
          <div><strong>Issue Date:</strong> ${Utils.formatDate(cert.issueDate)}</div>
          <div><strong>College:</strong> ${cert.college || 'N/A'}</div>
          <div><strong>Status:</strong> <span class="badge badge-success">Verified</span></div>
        </div>
        ${hiddenCanvasHTML ? `
          <div id="hiddenVerificationCanvas" style="position: absolute; left: -9999px; top: -9999px;">
            ${hiddenCanvasHTML}
          </div>
        ` : ''}
        <button class="btn btn-primary" style="margin-top:24px" onclick="Utils.downloadPDF(document.getElementById('hiddenVerificationCanvas') ? 'certificateDisplay' : 'verificationResult', '${cert.certificateNumber}')">
          <i class="fas fa-download"></i> Download Certificate
        </button>
      `;
    } else {
      result.className = 'verification-result invalid';
      result.innerHTML = `
        <div class="verification-icon"><i class="fas fa-times-circle"></i></div>
        <div class="verification-status">Invalid Certificate</div>
        <p style="color:var(--text-secondary)">No certificate found matching "<strong>${query}</strong>". Please verify the information and try again.</p>
      `;
    }
  }
};

window.Certificate = Certificate;
window.Verification = Verification;
