const { getDb } = require('../database');

const db = {
    prepare: (...args) => getDb().prepare(...args),
};

const Appointment = {
    findByDoctor(doctorId) {
        const rows = db.prepare(`
            SELECT a.*, u.fullName as patientFullName, u.email as patientEmail, u.phone as patientPhone
            FROM appointments a
            JOIN users u ON a.patient = u.id
            WHERE a.doctor = ?
            ORDER BY a.date DESC
        `).all(doctorId);
        return rows.map(row => ({
            ...row,
            _id: row.id,
            patient: { _id: row.patient, fullName: row.patientFullName, email: row.patientEmail, phone: row.patientPhone },
            patientFullName: undefined, patientEmail: undefined, patientPhone: undefined,
        }));
    },

    findByPatient(patientId) {
        const rows = db.prepare(`
            SELECT a.*, u.fullName as doctorFullName, u.specialization as doctorSpecialization, u.clinicName as doctorClinicName
            FROM appointments a
            JOIN users u ON a.doctor = u.id
            WHERE a.patient = ?
            ORDER BY a.date DESC
        `).all(patientId);
        return rows.map(row => ({
            ...row,
            _id: row.id,
            doctor: { _id: row.doctor, fullName: row.doctorFullName, specialization: row.doctorSpecialization, clinicName: row.doctorClinicName },
            doctorFullName: undefined, doctorSpecialization: undefined, doctorClinicName: undefined,
        }));
    },

    create(data) {
        const result = db.prepare(`
            INSERT INTO appointments (patient, doctor, date, time, reason)
            VALUES (?, ?, ?, ?, ?)
        `).run(
            data.patient,
            data.doctor,
            data.date,
            data.time,
            data.reason || null,
        );
        const row = db.prepare('SELECT * FROM appointments WHERE id = ?').get(result.lastInsertRowid);
        return { ...row, _id: row.id };
    },

    updateByIdAndDoctor(id, doctorId, { status, notes }) {
        const result = db.prepare(`
            UPDATE appointments SET status = ?, notes = ?, updatedAt = datetime('now')
            WHERE id = ? AND doctor = ?
        `).run(status, notes, id, doctorId);
        if (result.changes === 0) return null;
        const row = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);
        return { ...row, _id: row.id };
    },

    findByDoctorAndDateRange(doctorId, startDate, endDate, { populatePatient = false } = {}) {
        if (populatePatient) {
            const rows = db.prepare(`
                SELECT a.*, u.fullName as patientFullName
                FROM appointments a
                JOIN users u ON a.patient = u.id
                WHERE a.doctor = ? AND a.date >= ? AND a.date <= ?
            `).all(doctorId, startDate, endDate);
            return rows.map(row => ({
                ...row,
                _id: row.id,
                patient: { _id: row.patient, fullName: row.patientFullName },
                patientFullName: undefined,
            }));
        }
        return db.prepare(`
            SELECT * FROM appointments WHERE doctor = ? AND date >= ? AND date <= ?
        `).all(doctorId, startDate, endDate).map(r => ({ ...r, _id: r.id }));
    },

    findUpcomingByDoctor(doctorId, endDate, limit = 10) {
        const rows = db.prepare(`
            SELECT a.*, u.fullName as patientFullName
            FROM appointments a
            JOIN users u ON a.patient = u.id
            WHERE a.doctor = ? AND a.date >= ? AND a.date <= ? AND a.status = 'Scheduled'
            ORDER BY a.date ASC
            LIMIT ?
        `).all(doctorId, new Date().toISOString(), endDate, limit);
        return rows.map(row => ({
            ...row,
            _id: row.id,
            patient: { _id: row.patient, fullName: row.patientFullName },
            patientFullName: undefined,
        }));
    },

    findUpcomingByPatient(patientId, limit = 5) {
        const rows = db.prepare(`
            SELECT a.*, u.fullName as doctorFullName, u.specialization as doctorSpecialization
            FROM appointments a
            JOIN users u ON a.doctor = u.id
            WHERE a.patient = ? AND a.date >= ? AND a.status = 'Scheduled'
            ORDER BY a.date ASC
            LIMIT ?
        `).all(patientId, new Date().toISOString(), limit);
        return rows.map(row => ({
            ...row,
            _id: row.id,
            doctor: { _id: row.doctor, fullName: row.doctorFullName, specialization: row.doctorSpecialization },
            doctorFullName: undefined, doctorSpecialization: undefined,
        }));
    },
};

module.exports = Appointment;
