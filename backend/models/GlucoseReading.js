const { getDb } = require('../database');

const db = {
    prepare: (...args) => getDb().prepare(...args),
};

function transform(row) {
    if (!row) return null;
    return { ...row, _id: row.id };
}

const GlucoseReading = {
    findByPatient(patientId, { days } = {}) {
        let sql = 'SELECT * FROM glucose_readings WHERE patient = ?';
        const params = [patientId];

        if (days) {
            const since = new Date();
            since.setDate(since.getDate() - parseInt(days, 10));
            sql += ' AND recordedAt >= ?';
            params.push(since.toISOString());
        }

        sql += ' ORDER BY recordedAt DESC';
        return db.prepare(sql).all(...params).map(transform);
    },

    create(data) {
        const result = db.prepare(`
            INSERT INTO glucose_readings (patient, value, type, notes, recordedAt)
            VALUES (?, ?, ?, ?, ?)
        `).run(
            data.patient,
            data.value,
            data.type,
            data.notes || null,
            data.recordedAt ? new Date(data.recordedAt).toISOString() : new Date().toISOString(),
        );
        return transform(db.prepare('SELECT * FROM glucose_readings WHERE id = ?').get(result.lastInsertRowid));
    },

    findLatestByPatient(patientId) {
        const row = db.prepare(
            'SELECT * FROM glucose_readings WHERE patient = ? ORDER BY recordedAt DESC LIMIT 1'
        ).get(patientId);
        return transform(row);
    },

    findCriticalByPatients(patientIds, limit = 10) {
        if (patientIds.length === 0) return [];
        const placeholders = patientIds.map(() => '?').join(',');
        const rows = db.prepare(`
            SELECT gr.*, u.fullName as patientFullName
            FROM glucose_readings gr
            JOIN users u ON gr.patient = u.id
            WHERE gr.patient IN (${placeholders})
            AND (gr.value > 200 OR gr.value < 70)
            ORDER BY gr.recordedAt DESC
            LIMIT ?
        `).all(...patientIds, limit);
        return rows.map(row => ({
            ...row,
            _id: row.id,
            patient: { _id: row.patient, fullName: row.patientFullName },
        }));
    },

    findRecentByPatient(patientId, days) {
        const since = new Date();
        since.setDate(since.getDate() - days);
        return db.prepare(`
            SELECT * FROM glucose_readings
            WHERE patient = ? AND recordedAt >= ?
            ORDER BY recordedAt ASC
        `).all(patientId, since.toISOString()).map(transform);
    },
};

module.exports = GlucoseReading;
