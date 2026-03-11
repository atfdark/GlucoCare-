// ── Shared input validation & sanitization helpers ──

/**
 * Sanitize a plain-text string: trim, collapse whitespace, strip control chars.
 * Returns empty string if input is not a string.
 */
function sanitize(value) {
    if (typeof value !== 'string') return '';
    // Remove ASCII control characters (except \n, \r, \t) then trim
    return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
}

/**
 * Validate email format (basic RFC-5322 compatible).
 */
function isValidEmail(email) {
    if (typeof email !== 'string') return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

/**
 * Validate a date string is ISO-like (YYYY-MM-DD or full ISO-8601).
 * Returns true only for parseable, realistic dates.
 */
function isValidDate(str) {
    if (typeof str !== 'string') return false;
    const d = new Date(str);
    return !Number.isNaN(d.getTime());
}

/**
 * Validate a time string (HH:MM or HH:MM:SS, 24-hour).
 */
function isValidTime(str) {
    if (typeof str !== 'string') return false;
    return /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(str.trim());
}

/**
 * Ensure a number is finite and within min/max bounds.
 */
function isFiniteInRange(value, min, max) {
    const num = Number(value);
    return Number.isFinite(num) && num >= min && num <= max;
}

/**
 * Ensure a value is a positive integer.
 */
function isPositiveInt(value) {
    const num = Number(value);
    return Number.isInteger(num) && num > 0;
}

/**
 * Validate that a value is one of an allowed set (case-sensitive).
 */
function isOneOf(value, allowed) {
    return allowed.includes(value);
}

/**
 * Clamp a number between min and max.
 */
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number(value)));
}

/**
 * Express middleware: enforce JSON Content-Type on mutating requests.
 */
function requireJsonContentType(req, res, next) {
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && !req.is('json')) {
        return res.status(415).json({ error: 'Content-Type must be application/json.' });
    }
    next();
}

module.exports = {
    sanitize,
    isValidEmail,
    isValidDate,
    isValidTime,
    isFiniteInRange,
    isPositiveInt,
    isOneOf,
    clamp,
    requireJsonContentType,
};
