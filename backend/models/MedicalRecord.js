const { getDb } = require('../database');

const db = {
    prepare: (...args) => getDb().prepare(...args),
};

function transform(row) {
    if (!row) return null;
    const obj = { ...row, _id: row.id };
    if (row.doctorFullName !== undefined) {
        obj.doctor = row.doctor ? { _id: row.doctor, fullName: row.doctorFullName } : null;
        delete obj.doctorFullName;
    }
    return obj;
}

const MedicalRecord = {
    findByPatient(patientId, { type } = {}) {
        let sql = `
            SELECT mr.*, u.fullName as doctorFullName
            FROM medical_records mr
            LEFT JOIN users u ON mr.doctor = u.id
            WHERE mr.patient = ?`;
        const params = [patientId];

        if (type) {
            sql += ' AND mr.type = ?';
            params.push(type);
        }

        sql += ' ORDER BY mr.date DESC';
        return db.prepare(sql).all(...params).map(transform);
    },

    create(data) {
        const result = db.prepare(`
            INSERT INTO medical_records (patient, title, type, date, doctor, description, facility)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            data.patient,
            data.title,
            data.type,
            data.date,
            data.doctor || null,
            data.description || null,
            data.facility || null,
        );
        return { ...db.prepare('SELECT * FROM medical_records WHERE id = ?').get(result.lastInsertRowid), _id: result.lastInsertRowid };
    },
};

module.exports = MedicalRecord;
