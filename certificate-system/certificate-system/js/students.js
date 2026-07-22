/* ============================================
   STUDENTS MANAGEMENT
   ============================================ */
const Students = {
  students: [],
  filtered: [],
  currentPage: 1,
  perPage: 10,
  sortField: 'name',
  sortDir: 'asc',
  searchTerm: '',
  filterStatus: '',

  async init() {
    this.setupEventListeners();
    await this.loadStudents();
    this.render();
  },

  async loadStudents() {
    try {
      const data = await Api.students.list(this.searchTerm);
      this.students = data && data.content ? data.content : (Array.isArray(data) ? data : []);
      if (this.students.length === 0 && !this.searchTerm) {
        const defaults = this.getDefaultStudents();
        for (const s of defaults) {
          const sCopy = { ...s };
          delete sCopy.id;
          try {
            const created = await Api.students.create(sCopy);
            this.students.push(created);
          } catch (err) {
            console.error('Failed to seed default student:', err);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load students from database API:', err);
      this.students = [];
    }
    this.applyFilters();
  },

  getDefaultStudents() {
    return [
      { id: Utils.generateId(), name: 'Arun Kumar', registerNumber: 'STU2024001', studentType: 'Internship', college: 'MIT College', department: 'Computer Science', course: 'B.Tech CSE', email: 'arun@email.com', phone: '9876543210', internshipTitle: 'Full Stack Development', duration: '3 Months', startDate: '2024-06-01', endDate: '2024-08-31', status: 'Active', photo: '' },
      { id: Utils.generateId(), name: 'Priya Sharma', registerNumber: 'STU2024002', studentType: 'Internship', college: 'SRM University', department: 'Information Technology', course: 'B.Tech IT', email: 'priya@email.com', phone: '9876543211', internshipTitle: 'Data Science Intern', duration: '6 Months', startDate: '2024-01-15', endDate: '2024-07-15', status: 'Active', photo: '' },
      { id: Utils.generateId(), name: 'Rahul Verma', registerNumber: 'STU2024003', studentType: 'Course', college: 'VIT University', department: 'Electronics', course: 'B.Tech ECE', email: 'rahul@email.com', phone: '9876543212', internshipTitle: '', duration: '3 Months', startDate: '2024-03-01', endDate: '2024-05-31', status: 'Completed', photo: '' },
      { id: Utils.generateId(), name: 'Sneha Patel', registerNumber: 'STU2024004', studentType: 'Internship', college: 'Anna University', department: 'Mechanical Engineering', course: 'B.E Mech', email: 'sneha@email.com', phone: '9876543213', internshipTitle: 'CAD Design', duration: '2 Months', startDate: '2024-07-01', endDate: '2024-08-31', status: 'Active', photo: '' },
      { id: Utils.generateId(), name: 'Vikram Singh', registerNumber: 'STU2024005', studentType: 'Course', college: 'IIT Madras', department: 'Civil Engineering', course: 'B.Tech Civil', email: 'vikram@email.com', phone: '9876543214', internshipTitle: '', duration: '4 Months', startDate: '2024-02-01', endDate: '2024-05-31', status: 'Completed', photo: '' }
    ];
  },

  applyFilters() {
    let result = [...this.students];
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(term) ||
        s.registerNumber.toLowerCase().includes(term) ||
        s.email.toLowerCase().includes(term) ||
        s.college.toLowerCase().includes(term)
      );
    }
    if (this.filterStatus) {
      result = result.filter(s => s.status === this.filterStatus);
    }
    result.sort((a, b) => {
      let valA = (a[this.sortField] || '').toString().toLowerCase();
      let valB = (b[this.sortField] || '').toString().toLowerCase();
      if (this.sortField === 'startDate' || this.sortField === 'endDate') {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      }
      if (valA < valB) return this.sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return this.sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    this.filtered = result;
    this.currentPage = 1;
  },

  render() {
    this.renderTable();
    this.renderPagination();
    this.renderStats();
  },

  renderTable() {
    const container = document.getElementById('studentsTableBody');
    if (!container) return;
    const start = (this.currentPage - 1) * this.perPage;
    const end = start + this.perPage;
    const pageData = this.filtered.slice(start, end);

    if (!pageData.length) {
      container.innerHTML = `
        <tr><td colspan="9">
          <div class="empty-state">
            <div class="empty-state-icon"><i class="fas fa-users"></i></div>
            <h3>No Students Found</h3>
            <p>${this.searchTerm ? 'Try adjusting your search or filters.' : 'Add your first student to get started.'}</p>
            ${!this.searchTerm ? '<button class="btn btn-primary" onclick="Students.openAddModal()"><i class="fas fa-plus"></i> Add Student</button>' : ''}
          </div>
        </td></tr>`;
      return;
    }

    container.innerHTML = pageData.map(s => `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:12px">
            <div class="student-avatar" style="width:40px;height:40px;font-size:14px">${Utils.getInitials(s.name)}</div>
            <div>
              <div style="font-weight:500;color:var(--text-primary)">${s.name}</div>
              <div style="font-size:12px;color:var(--text-muted)">${s.email}</div>
            </div>
          </div>
        </td>
        <td>${s.studentType || 'Internship'}</td>
        <td>${Utils.truncate(s.college, 20)}</td>
        <td>${s.department || '-'}</td>
        <td>${s.internshipTitle || s.course || '-'}</td>
        <td>${s.duration || '-'}</td>
        <td><span class="badge badge-${s.status === 'Active' ? 'success' : 'warning'}">${s.status || 'Active'}</span></td>
        <td>
          <div class="dropdown">
            <button class="btn btn-sm btn-outline"><i class="fas fa-ellipsis-v"></i></button>
            <div class="dropdown-menu">
              <div class="dropdown-item" onclick="Students.viewProfile('${s.id}')"><i class="fas fa-eye"></i> View Profile</div>
              <div class="dropdown-item" onclick="Students.openEditModal('${s.id}')"><i class="fas fa-edit"></i> Edit</div>
              <div class="dropdown-divider"></div>
              <div class="dropdown-item danger" onclick="Students.confirmDelete('${s.id}')"><i class="fas fa-trash"></i> Delete</div>
            </div>
          </div>
        </td>
      </tr>
    `).join('');
  },

  renderPagination() {
    const container = document.getElementById('studentsPagination');
    if (!container) return;
    const totalPages = Math.ceil(this.filtered.length / this.perPage);
    if (totalPages <= 1) { container.innerHTML = ''; return; }

    let html = `<button class="page-btn" onclick="Students.goToPage(${this.currentPage - 1})" ${this.currentPage === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= this.currentPage - 1 && i <= this.currentPage + 1)) {
        html += `<button class="page-btn ${i === this.currentPage ? 'active' : ''}" onclick="Students.goToPage(${i})">${i}</button>`;
      } else if (i === this.currentPage - 2 || i === this.currentPage + 2) {
        html += `<button class="page-btn" disabled>...</button>`;
      }
    }
    html += `<button class="page-btn" onclick="Students.goToPage(${this.currentPage + 1})" ${this.currentPage === totalPages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;
    container.innerHTML = html;

    const info = document.getElementById('tableInfo');
    if (info) {
      const start = (this.currentPage - 1) * this.perPage + 1;
      const end = Math.min(this.currentPage * this.perPage, this.filtered.length);
      info.innerHTML = `Showing <strong>${start}</strong> to <strong>${end}</strong> of <strong>${this.filtered.length}</strong> students`;
    }
  },

  renderStats() {
    const el = document.getElementById('studentStats');
    if (!el) return;
    const active = this.students.filter(s => s.status === 'Active').length;
    const completed = this.students.filter(s => s.status === 'Completed').length;
    el.innerHTML = `
      <span class="badge badge-primary"><i class="fas fa-users"></i> Total: ${this.students.length}</span>
      <span class="badge badge-success"><i class="fas fa-check"></i> Active: ${active}</span>
      <span class="badge badge-info"><i class="fas fa-check-double"></i> Completed: ${completed}</span>
    `;
  },

  goToPage(page) {
    if (page < 1 || page > Math.ceil(this.filtered.length / this.perPage)) return;
    this.currentPage = page;
    this.renderTable();
    this.renderPagination();
  },

  toggleStudentFields() {
    const type = document.getElementById('studentType').value;
    const internshipGroup = document.getElementById('internshipTitleGroup');
    const courseGroup = document.getElementById('courseFieldGroup');
    if (type === 'Internship') {
      internshipGroup.style.display = 'block';
      courseGroup.style.display = 'none';
    } else if (type === 'Course') {
      internshipGroup.style.display = 'none';
      courseGroup.style.display = 'block';
    } else {
      internshipGroup.style.display = 'block';
      courseGroup.style.display = 'block';
    }
  },

  handleDurationSelectChange() {
    const durationSelect = document.getElementById('studentDurationSelect');
    const durationInput = document.getElementById('studentDuration');
    if (durationSelect && durationInput) {
      if (durationSelect.value === 'custom') {
        durationInput.value = '';
        durationInput.style.display = 'block';
        durationInput.focus();
      } else {
        durationInput.value = durationSelect.value;
        durationInput.style.display = 'none';
      }
    }
  },

  validateDepartment() {
    const dept = document.getElementById('studentDepartment');
    const error = document.getElementById('deptError');
    if (!dept || !error) return true;
    const val = dept.value.trim();
    if (val && !/^[A-Za-z\s]+$/.test(val)) {
      dept.classList.add('error');
      error.style.display = 'block';
      return false;
    }
    dept.classList.remove('error');
    error.style.display = 'none';
    return true;
  },

  setupEventListeners() {
    const search = document.getElementById('studentSearch');
    if (search) {
      search.addEventListener('input', Utils.debounce(async (e) => {
        this.searchTerm = e.target.value;
        await this.loadStudents();
        this.render();
      }));
    }
    const filter = document.getElementById('studentFilter');
    if (filter) {
      filter.addEventListener('change', (e) => {
        this.filterStatus = e.target.value;
        this.applyFilters();
        this.render();
      });
    }
    const sortSelect = document.getElementById('studentSort');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val) {
          const [field, dir] = val.split('-');
          this.sortField = field;
          this.sortDir = dir;
          this.applyFilters();
          this.render();
        }
      });
    }
    const dept = document.getElementById('studentDepartment');
    if (dept) {
      dept.addEventListener('input', () => this.validateDepartment());
      dept.addEventListener('blur', () => this.validateDepartment());
    }
  },

  openAddModal() {
    this.openStudentModal();
  },

  openEditModal(id) {
    const student = this.students.find(s => s.id === id);
    if (student) this.openStudentModal(student);
  },

  openStudentModal(student = null) {
    const modal = document.getElementById('studentModal');
    const title = document.getElementById('studentModalTitle');
    if (!modal) return;
    title.textContent = student ? 'Edit Student' : 'Add New Student';
    const fields = ['name', 'registerNumber', 'college', 'department', 'course', 'email', 'phone', 'internshipTitle', 'duration', 'startDate', 'endDate', 'status'];
    fields.forEach(f => {
      const el = document.getElementById(`student${Utils.capitalize(f)}`);
      if (el) el.value = student ? (student[f] || '') : '';
    });
    // Set student type
    const typeEl = document.getElementById('studentType');
    if (typeEl) {
      typeEl.value = student ? (student.studentType || 'Internship') : '';
    }
    // Set duration dropdown/input
    const durationSelect = document.getElementById('studentDurationSelect');
    const durationInput = document.getElementById('studentDuration');
    if (durationSelect && durationInput) {
      const val = student ? (student.duration || '') : '3 Months';
      const options = ['15 days', '1 Month', '2 Months', '3 Months', '4 Months', '6 Months'];
      if (options.includes(val)) {
        durationSelect.value = val;
        durationInput.value = val;
        durationInput.style.display = 'none';
      } else {
        durationSelect.value = 'custom';
        durationInput.value = val;
        durationInput.style.display = 'block';
      }
    }
    modal.dataset.editId = student ? student.id : '';
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    // Toggle fields based on type
    this.toggleStudentFields();
    // Clear department error
    const deptError = document.getElementById('deptError');
    const deptInput = document.getElementById('studentDepartment');
    if (deptError) deptError.style.display = 'none';
    if (deptInput) deptInput.classList.remove('error');
  },

  async saveStudent() {
    const modal = document.getElementById('studentModal');
    const id = modal.dataset.editId;
    const fields = ['name', 'registerNumber', 'college', 'department', 'course', 'email', 'phone', 'internshipTitle', 'duration', 'startDate', 'endDate', 'status'];
    const data = {};
    fields.forEach(f => {
      const el = document.getElementById(`student${Utils.capitalize(f)}`);
      data[f] = el ? el.value : '';
    });
    // Get student type
    const typeEl = document.getElementById('studentType');
    data.studentType = typeEl ? typeEl.value : 'Internship';
    data.photo = '';

    if (!data.name || !data.email || !data.studentType) {
      showToast('Validation Error', 'Name, Email and Student Type are required', 'error');
      return;
    }

    if (!data.registerNumber) {
      data.registerNumber = 'STU' + Date.now();
    }

    // Validate department
    if (!this.validateDepartment()) {
      showToast('Validation Error', 'Department contains invalid characters. Only letters and spaces allowed.', 'error');
      return;
    }

    // Clear dependent field based on type
    if (data.studentType === 'Internship') {
      data.course = '';
    } else if (data.studentType === 'Course') {
      data.internshipTitle = '';
    }

    try {
      if (id) {
        const updatedStudent = await Api.students.update(id, data);
        const idx = this.students.findIndex(s => s.id === id);
        if (idx >= 0) { this.students[idx] = updatedStudent; }
        showToast('Updated', 'Student information updated successfully', 'success');
      } else {
        const newStudent = await Api.students.create(data);
        this.students.unshift(newStudent);
        showToast('Added', 'New student added successfully', 'success');
      }

      modal.classList.remove('active');
      document.body.style.overflow = '';
      this.applyFilters();
      this.render();
    } catch (err) {
      console.error('Failed to save student:', err);
      showToast('Error', err.message || 'Failed to save student to database', 'error');
    }
  },

  viewProfile(id) {
    const student = this.students.find(s => s.id === id);
    if (!student) return;
    const modal = document.getElementById('profileViewModal');
    if (!modal) return;
    modal.querySelector('.modal-title').textContent = student.name;
    const typeLabel = student.studentType || 'Internship';
    const programLabel = typeLabel === 'Internship' ? 'Internship Title' : 'Course Name';
    const programValue = typeLabel === 'Internship' ? student.internshipTitle : student.course;
    modal.querySelector('.modal-body').innerHTML = `
      <div class="profile-detail-card">
        <div class="profile-detail-header">
          <div class="profile-detail-avatar">${Utils.getInitials(student.name)}</div>
          <div class="profile-detail-info">
            <h3>${student.name}</h3>
            <span class="badge badge-${student.status === 'Active' ? 'success' : 'warning'}" style="font-size:13px;padding:4px 14px">${student.status}</span>
            <span class="badge badge-primary" style="font-size:13px;padding:4px 14px;margin-left:8px">${typeLabel}</span>
          </div>
        </div>
        <div class="profile-detail-grid">
          <div class="profile-detail-item" style="display: none;">
            <div class="detail-label">Register Number</div>
            <div class="detail-value">${student.registerNumber || '-'}</div>
          </div>
          <div class="profile-detail-item">
            <div class="detail-label">College</div>
            <div class="detail-value">${student.college || '-'}</div>
          </div>
          <div class="profile-detail-item">
            <div class="detail-label">Department</div>
            <div class="detail-value">${student.department || '-'}</div>
          </div>
          <div class="profile-detail-item">
            <div class="detail-label">${programLabel}</div>
            <div class="detail-value">${programValue || '-'}</div>
          </div>
          <div class="profile-detail-item">
            <div class="detail-label">Email</div>
            <div class="detail-value">${student.email || '-'}</div>
          </div>
          <div class="profile-detail-item">
            <div class="detail-label">Phone</div>
            <div class="detail-value">${student.phone || '-'}</div>
          </div>
          <div class="profile-detail-item">
            <div class="detail-label">Duration</div>
            <div class="detail-value">${student.duration || '-'}</div>
          </div>
          <div class="profile-detail-item">
            <div class="detail-label">Start Date</div>
            <div class="detail-value">${student.startDate || '-'}</div>
          </div>
          <div class="profile-detail-item">
            <div class="detail-label">End Date</div>
            <div class="detail-value">${student.endDate || '-'}</div>
          </div>
        </div>
      </div>
    `;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  },

  confirmDelete(id) {
    const student = this.students.find(s => s.id === id);
    if (!student) return;
    const modal = document.getElementById('confirmModal');
    if (!modal) return;
    modal.querySelector('.modal-title').textContent = 'Delete Student';
    modal.querySelector('.modal-body').innerHTML = `
      <div style="text-align:center">
        <div style="font-size:48px;color:var(--error);margin-bottom:16px"><i class="fas fa-exclamation-triangle"></i></div>
        <h3 style="margin-bottom:8px">Are you sure?</h3>
        <p style="color:var(--text-muted)">This will permanently delete <strong>${student.name}</strong> (${student.registerNumber}). This action cannot be undone.</p>
      </div>
    `;
    modal.querySelector('.modal-footer').innerHTML = `
      <button class="btn btn-outline" onclick="document.getElementById('confirmModal').classList.remove('active');document.body.style.overflow=''">Cancel</button>
      <button class="btn btn-danger" onclick="Students.deleteStudent('${id}')"><i class="fas fa-trash"></i> Delete Permanently</button>
    `;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  },

  async deleteStudent(id) {
    try {
      await Api.students.remove(id);
      this.students = this.students.filter(s => s.id !== id);
      document.getElementById('confirmModal').classList.remove('active');
      document.body.style.overflow = '';
      this.applyFilters();
      this.render();
      showToast('Deleted', 'Student has been removed successfully', 'success');
    } catch (err) {
      console.error('Failed to delete student:', err);
      showToast('Error', err.message || 'Failed to delete student from database', 'error');
    }
  }
};

window.Students = Students;
