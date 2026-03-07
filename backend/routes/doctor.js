const express = require('express');
const { auth, requireRole } = require('../middleware/auth');
const User = require('../models/User');
const GlucoseReading = require('../models/GlucoseReading');
const HealthMetric = require('../models/HealthMetric');
const Report = require('../models/Report');
const Appointment = require('../models/Appointment');

const router = express.Router();

// All routes require authentication + doctor role
router.use(auth, requireRole('doctor'));

// ─── Patients ───────────────────────────────────────────────────────

// GET /api/doctor/patients - list patients assigned to this doctor
router.get('/patients', async (req, res) => {
    try {
        const assignedOnly = String(req.query.assignedOnly || 'false') === 'true';
        const search = req.query.search ? String(req.query.search) : undefined;

        const patients = assignedOnly
            ? User.findPatientsByDoctor(req.user._id)
            : User.findAllPatients({ search });

        res.json(patients);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch patients.' });
    }
});

// GET /api/doctor/patients/:patientId - get a single patient's details
router.get('/patients/:patientId', async (req, res) => {
    try {
        const patient = User.findById(req.params.patientId);

        if (!patient || patient.role !== 'patient') {
            return res.status(404).json({ error: 'Patient not found.' });
        }

        res.json(patient);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch patient details.' });
    }
});

// GET /api/doctor/patients/:patientId/glucose
router.get('/patients/:patientId/glucose', async (req, res) => {
    try {
        const patient = User.findById(req.params.patientId);

        if (!patient || patient.role !== 'patient') {
            return res.status(404).json({ error: 'Patient not found.' });
        }

        const { days } = req.query;
        const readings = GlucoseReading.findByPatient(req.params.patientId, { days });
        res.json(readings);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch glucose readings.' });
    }
});

// GET /api/doctor/patients/:patientId/health-metrics
router.get('/patients/:patientId/health-metrics', async (req, res) => {
    try {
        const patient = User.findById(req.params.patientId);

        if (!patient || patient.role !== 'patient') {
            return res.status(404).json({ error: 'Patient not found.' });
        }

        const metrics = HealthMetric.findByPatient(req.params.patientId);
        res.json(metrics);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch health metrics.' });
    }
});

// GET /api/doctor/patients/:patientId/reports
router.get('/patients/:patientId/reports', async (req, res) => {
    try {
        const patient = User.findById(req.params.patientId);

        if (!patient || patient.role !== 'patient') {
            return res.status(404).json({ error: 'Patient not found.' });
        }

        const reports = Report.findByPatientForDoctor(req.params.patientId);
        res.json(reports);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch reports.' });
    }
});

// ─── Appointments ───────────────────────────────────────────────────

// GET /api/doctor/appointments
router.get('/appointments', async (req, res) => {
    try {
        const appointments = Appointment.findByDoctor(req.user._id);
        res.json(appointments);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch appointments.' });
    }
});

// PUT /api/doctor/appointments/:id - update appointment status/notes
router.put('/appointments/:id', async (req, res) => {
    try {
        const { status, notes } = req.body;
        const appointment = Appointment.updateByIdAndDoctor(req.params.id, req.user._id, { status, notes });

        if (!appointment) {
            return res.status(404).json({ error: 'Appointment not found.' });
        }

        res.json(appointment);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update appointment.' });
    }
});

// ─── Doctor Dashboard Summary ───────────────────────────────────────

// GET /api/doctor/dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const doctorId = req.user._id;

        // Count of assigned patients
        const patientCount = User.countPatientsByDoctor(doctorId);

        // Today's appointments
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const todayAppointments = Appointment.findByDoctorAndDateRange(
            doctorId, startOfDay.toISOString(), endOfDay.toISOString(), { populatePatient: true }
        );

        // Upcoming appointments (next 7 days)
        const sevenDaysLater = new Date();
        sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

        const upcomingAppointments = Appointment.findUpcomingByDoctor(
            doctorId, sevenDaysLater.toISOString(), 10
        );

        // Recent patients with critical glucose (last reading above 200 or below 70)
        const patients = User.findPatientsByDoctor(doctorId);
        const patientIds = patients.map(p => p._id);

        const criticalReadings = GlucoseReading.findCriticalByPatients(patientIds, 10);

        res.json({
            patientCount,
            todayAppointments,
            upcomingAppointments,
            criticalReadings,
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load dashboard data.' });
    }
});

// ─── Doctor Profile ─────────────────────────────────────────────────

// GET /api/doctor/profile
router.get('/profile', async (req, res) => {
    res.json(req.user);
});

// PUT /api/doctor/profile
router.put('/profile', async (req, res) => {
    try {
        const allowed = ['fullName', 'phone', 'specialization', 'clinicName'];
        const updates = {};

        for (const key of allowed) {
            if (req.body[key] !== undefined) {
                updates[key] = req.body[key];
            }
        }

        const user = User.findByIdAndUpdate(req.user._id, updates);
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update profile.' });
    }
});

module.exports = router;
