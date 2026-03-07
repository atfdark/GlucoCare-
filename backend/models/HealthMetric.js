const { getDb } = require('../database');

const db = {
    prepare: (...args) => getDb().prepare(...args),
};

function transform(row) {
    if (!row) return null;
    return { ...row, _id: row.id };
}

const HealthMetric = {
    findByPatient(patientId, { days } = {}) {
        let sql = 'SELECT * FROM health_metrics WHERE patient = ?';
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
            INSERT INTO health_metrics (patient, weight, systolic, diastolic, hba1c, recordedAt)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            data.patient,
            data.weight || null,
            data.systolic || null,
            data.diastolic || null,
            data.hba1c || null,
            data.recordedAt ? new Date(data.recordedAt).toISOString() : new Date().toISOString(),
        );
        return transform(db.prepare('SELECT * FROM health_metrics WHERE id = ?').get(result.lastInsertRowid));
    },

    findLatestByPatient(patientId) {
        const row = db.prepare(
            'SELECT * FROM health_metrics WHERE patient = ? ORDER BY recordedAt DESC LIMIT 1'
        ).get(patientId);
        return transform(row);
    },

    findRecentByPatient(patientId, days) {
        const since = new Date();
        since.setDate(since.getDate() - days);
        return db.prepare(`
            SELECT * FROM health_metrics
            WHERE patient = ? AND recordedAt >= ?
            ORDER BY recordedAt ASC
        `).all(patientId, since.toISOString()).map(transform);
    },
};

module.exports = HealthMetric;
