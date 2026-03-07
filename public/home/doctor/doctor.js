var doctorState = {
    patients: [],
    appointments: [],
    doctorProfile: null,
};

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatDate(value) {
    if (!value) return '--';
    var d = new Date(value);
    if (Number.isNaN(d.getTime())) return '--';
    return d.toLocaleDateString();
}

function initials(name) {
    var parts = String(name || '').trim().split(/\s+/).slice(0, 2);
    if (parts.length === 0) return 'PT';
    return parts.map(function (part) { return part[0] ? part[0].toUpperCase() : ''; }).join('') || 'PT';
}

function renderPatients(patients) {
    var tbody = document.getElementById('doctor-patients-body');
    var info = document.getElementById('doctor-patient-table-info');
    if (!tbody) return;

    if (!Array.isArray(patients) || patients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--gray-500);">No patients found.</td></tr>';
        if (info) info.textContent = 'Showing 0 patients';
        return;
    }

    tbody.innerHTML = patients.map(function (p) {
        return [
            '<tr>',
            '<td>',
            '<div class="patient-info">',
            '<div class="patient-avatar" style="background: linear-gradient(135deg, #0D9488, #14B8A6);">' + escapeHtml(initials(p.fullName)) + '</div>',
            '<div>',
            '<div class="patient-name">' + escapeHtml(p.fullName || 'Unknown') + '</div>',
            '<div class="patient-id">ID: ' + Number(p._id) + '</div>',
            '</div>',
            '</div>',
            '</td>',
            '<td>' + escapeHtml(p.email || '--') + '</td>',
            '<td>' + escapeHtml(p.phone || '--') + '</td>',
            '<td class="hide-mobile">' + escapeHtml(p.bloodType || '--') + '</td>',
            '<td class="hide-mobile" style="color: var(--gray-500); font-size: 13px;">' + escapeHtml((p.chronicConditions || []).join(', ') || '--') + '</td>',
            '<td>',
            '<button class="table-action-btn" title="View Details" onclick="viewPatient(' + Number(p._id) + ')">',
            '<svg viewBox="0 0 24 24"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z"/></svg>',
            '</button>',
            '</td>',
            '</tr>',
        ].join('');
    }).join('');

    if (info) info.textContent = 'Showing ' + patients.length + ' patients';
}

function renderUpcomingAppointments(appointments) {
    var container = document.getElementById('upcoming-appointments');
    if (!container) return;

    if (!Array.isArray(appointments) || appointments.length === 0) {
        container.innerHTML = '<div class="appointment-item"><div class="appointment-details"><div class="appointment-name">No appointments found</div></div></div>';
        return;
    }

    container.innerHTML = appointments.slice(0, 8).map(function (appt) {
        var date = new Date(appt.date);
        var time = appt.time || '--';
        var status = String(appt.status || 'Scheduled').toLowerCase();
        var statusClass = status.indexOf('complete') >= 0 ? 'confirmed' : 'upcoming';
        return [
            '<div class="appointment-item">',
            '<div class="appointment-time-block">',
            '<span class="time">' + escapeHtml(time) + '</span>',
            '<span class="period">' + escapeHtml(formatDate(date)) + '</span>',
            '</div>',
            '<div class="appointment-details">',
            '<div class="appointment-name">' + escapeHtml(appt.patient && appt.patient.fullName ? appt.patient.fullName : 'Patient') + '</div>',
            '<div class="appointment-type">' + escapeHtml(appt.reason || 'Consultation') + '</div>',
            '</div>',
            '<span class="appointment-status ' + statusClass + '">' + escapeHtml(appt.status || 'Scheduled') + '</span>',
            '</div>',
        ].join('');
    }).join('');
}

function renderCriticalAlerts(alerts) {
    var container = document.getElementById('critical-alerts');
    if (!container) return;

    if (!Array.isArray(alerts) || alerts.length === 0) {
        container.innerHTML = '<div class="alert-item"><div class="alert-content"><div class="alert-title">No critical alerts</div></div></div>';
        return;
    }

    container.innerHTML = alerts.slice(0, 8).map(function (reading) {
        var isCritical = Number(reading.value) > 200 || Number(reading.value) < 70;
        var severityClass = isCritical ? 'critical' : 'warning';
        var title = (reading.patient && reading.patient.fullName ? reading.patient.fullName : 'Patient') + ' • ' + Number(reading.value).toFixed(0) + ' mg/dL';
        var desc = 'Type: ' + (reading.type || 'reading') + ' • ' + formatDate(reading.recordedAt);
        return [
            '<div class="alert-item">',
            '<div class="alert-icon ' + severityClass + '">',
            '<svg viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>',
            '</div>',
            '<div class="alert-content">',
            '<div class="alert-title">' + escapeHtml(title) + '</div>',
            '<div class="alert-desc">' + escapeHtml(desc) + '</div>',
            '</div>',
            '</div>',
        ].join('');
    }).join('');
}

function applyLocalSearch(query) {
    var q = String(query || '').toLowerCase().trim();
    if (!q) {
        renderPatients(doctorState.patients);
        return;
    }

    var filtered = doctorState.patients.filter(function (p) {
        var name = String(p.fullName || '').toLowerCase();
        var email = String(p.email || '').toLowerCase();
        return name.indexOf(q) >= 0 || email.indexOf(q) >= 0;
    });
    renderPatients(filtered);
}

function bindSearch() {
    var input = document.getElementById('doctor-patient-search');
    if (!input) return;

    input.addEventListener('input', function () {
        applyLocalSearch(this.value);
    });
}

function openModal(modalId) {
    var modal = document.getElementById(modalId);
    var overlay = document.getElementById('doctorModalOverlay');
    if (!modal) return;
    modal.style.display = 'flex';
    if (overlay) overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
    var modal = document.getElementById(modalId);
    var overlay = document.getElementById('doctorModalOverlay');
    if (!modal) return;
    modal.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = 'auto';
}

function setDoctorHeader(user) {
    var profileName = document.querySelector('.profile-name');
    var titleMsg = document.querySelector('.page-title p');
    var profileRole = document.querySelector('.profile-role');

    if (profileName) profileName.textContent = user.fullName || 'Doctor';
    if (titleMsg) titleMsg.textContent = 'Welcome back, ' + (user.fullName || 'Doctor');
    if (profileRole) profileRole.textContent = user.specialization || 'Doctor';
}

async function loadDashboard() {
    var result = await API.get('/api/doctor/dashboard');
    if (!result.ok) return;

    var d = result.data || {};
    var patientCountEl = document.getElementById('patient-count');
    var todayCountEl = document.getElementById('today-appointments');
    var criticalCountEl = document.getElementById('critical-alert-count');

    if (patientCountEl) patientCountEl.textContent = Number(d.patientCount || 0);
    if (todayCountEl) todayCountEl.textContent = Array.isArray(d.todayAppointments) ? d.todayAppointments.length : 0;
    if (criticalCountEl) criticalCountEl.textContent = Array.isArray(d.criticalReadings) ? d.criticalReadings.length : 0;

    renderUpcomingAppointments(d.upcomingAppointments || []);
    renderCriticalAlerts(d.criticalReadings || []);
}

async function loadPatients() {
    var result = await API.get('/api/doctor/patients');
    if (!result.ok) {
        renderPatients([]);
        return;
    }

    doctorState.patients = Array.isArray(result.data) ? result.data : [];
    renderPatients(doctorState.patients);
}

function renderPatientSummary(patient) {
    var box = document.getElementById('doctor-patient-summary');
    if (!box) return;
    box.innerHTML = [
        '<strong>' + escapeHtml(patient.fullName || '--') + '</strong>',
        ' • ' + escapeHtml(patient.email || '--'),
        ' • Phone: ' + escapeHtml(patient.phone || '--'),
        ' • Blood Type: ' + escapeHtml(patient.bloodType || '--'),
    ].join('');
}

function renderPatientGlucose(glucose) {
    var box = document.getElementById('doctor-patient-glucose');
    if (!box) return;
    if (!Array.isArray(glucose) || glucose.length === 0) {
        box.textContent = 'No glucose readings found.';
        return;
    }

    box.innerHTML = glucose.slice(0, 12).map(function (g) {
        return '<div style="padding:6px 0; border-bottom:1px solid var(--gray-100);">' +
            '<strong>' + Number(g.value).toFixed(0) + ' mg/dL</strong> (' + escapeHtml(g.type || 'reading') + ') - ' + formatDate(g.recordedAt) +
            '</div>';
    }).join('');
}

function renderPatientMetrics(metrics) {
    var box = document.getElementById('doctor-patient-metrics');
    if (!box) return;
    if (!Array.isArray(metrics) || metrics.length === 0) {
        box.textContent = 'No health metrics found.';
        return;
    }

    box.innerHTML = metrics.slice(0, 10).map(function (m) {
        var parts = [];
        if (m.weight !== null && m.weight !== undefined && m.weight !== '') parts.push('Weight: ' + m.weight + ' kg');
        if (m.systolic && m.diastolic) parts.push('BP: ' + m.systolic + '/' + m.diastolic);
        if (m.hba1c !== null && m.hba1c !== undefined && m.hba1c !== '') parts.push('HbA1c: ' + m.hba1c + '%');
        return '<div style="padding:6px 0; border-bottom:1px solid var(--gray-100);">' +
            '<strong>' + formatDate(m.recordedAt) + '</strong> - ' + escapeHtml(parts.join(' | ') || 'No values') +
            '</div>';
    }).join('');
}

function renderPatientReports(reports) {
    var box = document.getElementById('doctor-patient-reports');
    if (!box) return;
    if (!Array.isArray(reports) || reports.length === 0) {
        box.textContent = 'No reports found.';
        return;
    }

    box.innerHTML = reports.slice(0, 12).map(function (r) {
        return '<div style="padding:6px 0; border-bottom:1px solid var(--gray-100);">' +
            '<strong>' + escapeHtml(r.reportName || 'Report') + '</strong> (' + escapeHtml(r.type || '--') + ') - ' + formatDate(r.date) +
            ' <span style="color:var(--gray-500);">[' + escapeHtml(r.status || 'Pending') + ']</span>' +
            '</div>';
    }).join('');
}

async function openPatientDetails(patientId) {
    var id = Number(patientId);
    var title = document.getElementById('doctor-patient-modal-title');
    if (title) title.textContent = 'Patient Details';
    openModal('doctor-patient-modal');

    try {
        var [patientRes, glucoseRes, metricsRes, reportsRes] = await Promise.all([
            API.get('/api/doctor/patients/' + id),
            API.get('/api/doctor/patients/' + id + '/glucose?days=30'),
            API.get('/api/doctor/patients/' + id + '/health-metrics'),
            API.get('/api/doctor/patients/' + id + '/reports'),
        ]);

        if (!patientRes.ok) {
            alert((patientRes.data && patientRes.data.error) || 'Failed to load patient details.');
            closeModal('doctor-patient-modal');
            return;
        }

        if (title) title.textContent = 'Patient Details - ' + (patientRes.data.fullName || 'Patient');
        renderPatientSummary(patientRes.data || {});
        renderPatientGlucose(glucoseRes.ok ? (glucoseRes.data || []) : []);
        renderPatientMetrics(metricsRes.ok ? (metricsRes.data || []) : []);
        renderPatientReports(reportsRes.ok ? (reportsRes.data || []) : []);
    } catch (err) {
        alert('Network error while loading patient details.');
        closeModal('doctor-patient-modal');
    }
}

function renderAppointmentsManager() {
    var box = document.getElementById('doctor-all-appointments');
    if (!box) return;

    if (!Array.isArray(doctorState.appointments) || doctorState.appointments.length === 0) {
        box.innerHTML = '<div style="color:var(--gray-500);">No appointments found.</div>';
        return;
    }

    box.innerHTML = doctorState.appointments.map(function (a) {
        var id = Number(a.id || a._id);
        var doctorName = a.patient && a.patient.fullName ? a.patient.fullName : 'Patient';
        return [
            '<div class="card" style="margin:0;">',
            '<div class="card-body" style="padding:14px 16px;">',
            '<div style="display:flex; justify-content:space-between; gap:12px; align-items:center; margin-bottom:10px;">',
            '<div><strong>' + escapeHtml(doctorName) + '</strong><div style="font-size:12px; color:var(--gray-500);">' + formatDate(a.date) + ' ' + escapeHtml(a.time || '') + '</div></div>',
            '<div style="font-size:12px; color:var(--gray-500);">ID: ' + id + '</div>',
            '</div>',
            '<div style="display:grid; grid-template-columns: 180px 1fr 140px; gap:10px; align-items:center;">',
            '<select id="appt-status-' + id + '" class="form-input">',
            '<option value="Scheduled" ' + (a.status === 'Scheduled' ? 'selected' : '') + '>Scheduled</option>',
            '<option value="Completed" ' + (a.status === 'Completed' ? 'selected' : '') + '>Completed</option>',
            '<option value="Cancelled" ' + (a.status === 'Cancelled' ? 'selected' : '') + '>Cancelled</option>',
            '</select>',
            '<input id="appt-notes-' + id + '" class="form-input" type="text" placeholder="Clinical notes" value="' + escapeHtml(a.notes || '') + '">',
            '<button class="card-btn card-btn-primary" onclick="saveAppointmentUpdate(' + id + ')">Save</button>',
            '</div>',
            '</div>',
            '</div>',
        ].join('');
    }).join('');
}

async function openAppointmentsManager() {
    openModal('doctor-appointments-modal');
    var res = await API.get('/api/doctor/appointments');
    doctorState.appointments = res.ok && Array.isArray(res.data) ? res.data : [];
    renderAppointmentsManager();
}

async function saveAppointmentUpdate(appointmentId) {
    var id = Number(appointmentId);
    var statusEl = document.getElementById('appt-status-' + id);
    var notesEl = document.getElementById('appt-notes-' + id);
    if (!statusEl || !notesEl) return;

    var res = await API.put('/api/doctor/appointments/' + id, {
        status: statusEl.value,
        notes: notesEl.value || null,
    });

    if (!res.ok) {
        alert((res.data && res.data.error) || 'Failed to update appointment.');
        return;
    }

    await loadDashboard();
    await openAppointmentsManager();
}

async function openDoctorProfileModal() {
    openModal('doctor-profile-modal');
    var res = await API.get('/api/doctor/profile');
    if (!res.ok) return;

    doctorState.doctorProfile = res.data;
    var p = res.data || {};
    var name = document.getElementById('doctor-profile-name');
    var phone = document.getElementById('doctor-profile-phone');
    var specialization = document.getElementById('doctor-profile-specialization');
    var clinic = document.getElementById('doctor-profile-clinic');
    if (name) name.value = p.fullName || '';
    if (phone) phone.value = p.phone || '';
    if (specialization) specialization.value = p.specialization || '';
    if (clinic) clinic.value = p.clinicName || '';
}

async function saveDoctorProfile() {
    var payload = {
        fullName: (document.getElementById('doctor-profile-name').value || '').trim(),
        phone: (document.getElementById('doctor-profile-phone').value || '').trim(),
        specialization: (document.getElementById('doctor-profile-specialization').value || '').trim(),
        clinicName: (document.getElementById('doctor-profile-clinic').value || '').trim(),
    };

    if (!payload.fullName) {
        alert('Full name is required.');
        return;
    }

    var res = await API.put('/api/doctor/profile', payload);
    if (!res.ok) {
        alert((res.data && res.data.error) || 'Failed to update profile.');
        return;
    }

    localStorage.setItem('user', JSON.stringify(res.data));
    setDoctorHeader(res.data);
    alert('Profile updated successfully.');
    closeModal('doctor-profile-modal');
}

function bindActions() {
    var settingsBtn = document.getElementById('doctor-settings-btn');
    var navSettingsBtn = document.getElementById('doctor-nav-settings');
    var editProfileBtn = document.getElementById('doctor-open-profile-btn');
    var viewAppointmentsBtn = document.getElementById('doctor-view-appointments-btn');
    var quickAppointmentsBtn = document.getElementById('doctor-quick-appointments-btn');
    var filterBtn = document.getElementById('doctor-patient-filter-btn');
    var viewAlertsBtn = document.getElementById('doctor-view-alerts-btn');
    var overlay = document.getElementById('doctorModalOverlay');

    if (settingsBtn) settingsBtn.addEventListener('click', openDoctorProfileModal);
    if (navSettingsBtn) navSettingsBtn.addEventListener('click', function (e) { e.preventDefault(); openDoctorProfileModal(); });
    if (editProfileBtn) editProfileBtn.addEventListener('click', openDoctorProfileModal);
    if (viewAppointmentsBtn) viewAppointmentsBtn.addEventListener('click', openAppointmentsManager);
    if (quickAppointmentsBtn) quickAppointmentsBtn.addEventListener('click', openAppointmentsManager);
    if (filterBtn) filterBtn.addEventListener('click', function () {
        var input = document.getElementById('doctor-patient-search');
        applyLocalSearch(input ? input.value : '');
    });
    if (viewAlertsBtn) viewAlertsBtn.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    if (overlay) overlay.addEventListener('click', function () {
        closeModal('doctor-patient-modal');
        closeModal('doctor-appointments-modal');
        closeModal('doctor-profile-modal');
    });
}

function toggleSidebar() {
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('sidebarOverlay');
    if (!sidebar || !overlay) return;
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show');
}

function closeSidebar() {
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('sidebarOverlay');
    if (!sidebar || !overlay) return;
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
}

function viewPatient(patientId) {
    return openPatientDetails(Number(patientId));
}

(function bootstrapDoctorDashboard() {
    if (typeof API === 'undefined' || !requireAuth('doctor')) return;

    var user = API.getUser() || {};
    setDoctorHeader(user);
    bindSearch();
    bindActions();

    Promise.all([
        loadDashboard(),
        loadPatients(),
    ]).catch(function () {
        console.error('Failed to load doctor dashboard data.');
    });
})();

window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
window.viewPatient = viewPatient;
window.openAppointmentsManager = openAppointmentsManager;
window.saveAppointmentUpdate = saveAppointmentUpdate;
window.closeDoctorPatientModal = function () { closeModal('doctor-patient-modal'); };
window.closeDoctorAppointmentsModal = function () { closeModal('doctor-appointments-modal'); };
window.closeDoctorProfileModal = function () { closeModal('doctor-profile-modal'); };
window.saveDoctorProfile = saveDoctorProfile;
