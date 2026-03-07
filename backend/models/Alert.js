const { getDb } = require('../database');

const db = {
    prepare: (...args) => getDb().prepare(...args),
};

function toBool(value) {
    return value === 1 || value === true;
}

function parseMetadata(metadata) {
    if (!metadata) return null;
    try {
        return JSON.parse(metadata);
    } catch {
        return null;
    }
}

const Alert = {
    getSettings(patientId) {
        let row = db.prepare('SELECT * FROM alert_settings WHERE patient_id = ?').get(patientId);

        if (!row) {
            db.prepare(`
                INSERT INTO alert_settings (patient_id, low_threshold, high_threshold, missed_log_hours, notify_push, notify_email)
                VALUES (?, 70, 180, 24, 1, 0)
            `).run(patientId);
            row = db.prepare('SELECT * FROM alert_settings WHERE patient_id = ?').get(patientId);
        }

        return {
            patientId: row.patient_id,
            lowThreshold: Number(row.low_threshold),
            highThreshold: Number(row.high_threshold),
            missedLogHours: Number(row.missed_log_hours),
            notifyPush: toBool(row.notify_push),
            notifyEmail: toBool(row.notify_email),
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    },

    upsertSettings(patientId, updates) {
        const current = Alert.getSettings(patientId);
        const next = {
            lowThreshold: updates.lowThreshold ?? current.lowThreshold,
            highThreshold: updates.highThreshold ?? current.highThreshold,
            missedLogHours: updates.missedLogHours ?? current.missedLogHours,
            notifyPush: updates.notifyPush ?? current.notifyPush,
            notifyEmail: updates.notifyEmail ?? current.notifyEmail,
        };

        db.prepare(`
            UPDATE alert_settings
            SET low_threshold = ?, high_threshold = ?, missed_log_hours = ?,
                notify_push = ?, notify_email = ?, updatedAt = datetime('now')
            WHERE patient_id = ?
        `).run(
            next.lowThreshold,
            next.highThreshold,
            next.missedLogHours,
            next.notifyPush ? 1 : 0,
            next.notifyEmail ? 1 : 0,
            patientId,
        );

        return Alert.getSettings(patientId);
    },

    listByPatient(patientId, { limit = 50, status } = {}) {
        let sql = 'SELECT * FROM alerts WHERE patient_id = ?';
        const params = [patientId];

        if (status) {
            sql += ' AND status = ?';
            params.push(status);
        }

        sql += ' ORDER BY triggered_at DESC LIMIT ?';
        params.push(limit);

        return db.prepare(sql).all(...params).map((row) => ({
            id: row.id,
            patientId: row.patient_id,
            type: row.type,
            severity: row.severity,
            title: row.title,
            message: row.message,
            status: row.status,
            metadata: parseMetadata(row.metadata),
            triggeredAt: row.triggered_at,
            readAt: row.read_at,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        }));
    },

    create(payload) {
        const result = db.prepare(`
            INSERT INTO alerts (patient_id, type, severity, title, message, status, metadata, triggered_at)
            VALUES (?, ?, ?, ?, ?, 'unread', ?, ?)
        `).run(
            payload.patientId,
            payload.type,
            payload.severity,
            payload.title,
            payload.message,
            payload.metadata ? JSON.stringify(payload.metadata) : null,
            payload.triggeredAt || new Date().toISOString(),
        );

        const row = db.prepare('SELECT * FROM alerts WHERE id = ?').get(result.lastInsertRowid);
        return {
            id: row.id,
            patientId: row.patient_id,
            type: row.type,
            severity: row.severity,
            title: row.title,
            message: row.message,
            status: row.status,
            metadata: parseMetadata(row.metadata),
            triggeredAt: row.triggered_at,
            readAt: row.read_at,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    },

    markAsRead(patientId, alertId) {
        const result = db.prepare(`
            UPDATE alerts
            SET status = 'read', read_at = datetime('now'), updatedAt = datetime('now')
            WHERE id = ? AND patient_id = ?
        `).run(alertId, patientId);

        if (result.changes === 0) return null;

        const row = db.prepare('SELECT * FROM alerts WHERE id = ?').get(alertId);
        return {
            id: row.id,
            patientId: row.patient_id,
            type: row.type,
            severity: row.severity,
            title: row.title,
            message: row.message,
            status: row.status,
            metadata: parseMetadata(row.metadata),
            triggeredAt: row.triggered_at,
            readAt: row.read_at,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    },

    evaluateGlucoseReading(patientId, reading) {
        const settings = Alert.getSettings(patientId);
        const value = Number(reading.value);

        if (value < settings.lowThreshold) {
            return Alert.create({
                patientId,
                type: 'glucose_low',
                severity: 'critical',
                title: 'Low Glucose Alert',
                message: `Your glucose reading (${value} mg/dL) is below your threshold (${settings.lowThreshold} mg/dL).`,
                metadata: {
                    readingId: reading.id,
                    value,
                    threshold: settings.lowThreshold,
                    readingType: reading.type,
                },
                triggeredAt: reading.recordedAt,
            });
        }

        if (value > settings.highThreshold) {
            return Alert.create({
                patientId,
                type: 'glucose_high',
                severity: value >= settings.highThreshold + 40 ? 'critical' : 'warning',
                title: 'High Glucose Alert',
                message: `Your glucose reading (${value} mg/dL) is above your threshold (${settings.highThreshold} mg/dL).`,
                metadata: {
                    readingId: reading.id,
                    value,
                    threshold: settings.highThreshold,
                    readingType: reading.type,
                },
                triggeredAt: reading.recordedAt,
            });
        }

        return null;
    },
};

module.exports = Alert;
