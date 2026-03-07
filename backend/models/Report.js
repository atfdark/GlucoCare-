const { getDb } = require('../database');

const db = {
    prepare: (...args) => getDb().prepare(...args),
};

function transform(row) {
    if (!row) return null;
    const obj = { ...row, _id: row.id };
    if (row.doctorFullName !== undefined) {
        obj.doctor = row.doctor ? { _id: row.doctor, fullName: row.doctorFullName, specialization: row.doctorSpecialization } : null;
        delete obj.doctorFullName;
        delete obj.doctorSpecialization;
    }
    return obj;
}

const Report = {
    findByPatient(patientId, { type } = {}) {
        let sql = `
            SELECT r.*, u.fullName as doctorFullName, u.specialization as doctorSpecialization
            FROM reports r
            LEFT JOIN users u ON r.doctor = u.id
            WHERE r.patient = ?`;
        const params = [patientId];

        if (type) {
            sql += ' AND r.type = ?';
            params.push(type);
        }

        sql += ' ORDER BY r.date DESC';
        return db.prepare(sql).all(...params).map(transform);
    },

    findByPatientForDoctor(patientId) {
        const rows = db.prepare(`
            SELECT r.*, u.fullName as doctorFullName
            FROM reports r
            LEFT JOIN users u ON r.doctor = u.id
            WHERE r.patient = ?
            ORDER BY r.date DESC
        `).all(patientId);
        return rows.map(row => {
            const obj = { ...row, _id: row.id };
            obj.doctor = row.doctor ? { _id: row.doctor, fullName: row.doctorFullName } : null;
            delete obj.doctorFullName;
            return obj;
        });
    },

    create(data) {
        const result = db.prepare(`
            INSERT INTO reports (patient, reportName, type, date, doctor, status, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            data.patient,
            data.reportName,
            data.type,
            data.date,
            data.doctor || null,
            data.status || 'Pending',
            data.notes || null,
        );
        return { ...db.prepare('SELECT * FROM reports WHERE id = ?').get(result.lastInsertRowid), _id: result.lastInsertRowid };
    },
};

module.exports = Report;
