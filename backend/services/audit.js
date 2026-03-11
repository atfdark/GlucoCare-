// ── Lightweight audit logging utility ──

const { getDb } = require('../database');

/**
 * Log a security/access-relevant event to the access_audit_logs table.
 *
 * @param {object} opts
 * @param {number} opts.userId      - The user the action pertains to
 * @param {number} [opts.actorId]   - Who performed the action (defaults to userId)
 * @param {string} [opts.actorRole] - Role of the actor
 * @param {string} opts.action      - Short verb: 'login', 'login_failed', 'register', 'read', 'update', etc.
 * @param {string} [opts.resourceType] - e.g. 'glucose_reading', 'message_thread'
 * @param {string|number} [opts.resourceId]
 * @param {object} [opts.meta]      - Extra context (IP, user-agent, etc.)
 */
function logAudit(opts) {
    try {
        const db = getDb();
        db.prepare(`
            INSERT INTO access_audit_logs
                (user_id, actor_id, actor_role, action, resource_type, resource_id, meta_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            opts.userId,
            opts.actorId ?? opts.userId,
            opts.actorRole ?? null,
            opts.action,
            opts.resourceType ?? null,
            opts.resourceId != null ? String(opts.resourceId) : null,
            opts.meta ? JSON.stringify(opts.meta) : null,
        );
    } catch (err) {
        // Never let audit failures break the main request
        console.error('[audit] write failed:', err.message);
    }
}

module.exports = { logAudit };
