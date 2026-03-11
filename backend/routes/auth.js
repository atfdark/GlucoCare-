const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { sanitize, isValidEmail } = require('../middleware/validate');
const { logAudit } = require('../services/audit');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const fullName = sanitize(req.body.fullName);
        const email = sanitize(req.body.email).toLowerCase();
        const phone = sanitize(req.body.phone || '');
        const password = req.body.password;   // don't sanitize passwords (may contain control chars intentionally)
        const role = sanitize(req.body.role);
        const medicalRegistrationNumber = sanitize(req.body.medicalRegistrationNumber || '');
        const specialization = sanitize(req.body.specialization || '');
        const clinicName = sanitize(req.body.clinicName || '');

        // Check required fields
        if (!fullName || !email || !password || !role) {
            return res.status(400).json({ error: 'Full name, email, password, and role are required.' });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ error: 'Please provide a valid email address.' });
        }

        if (!['patient', 'doctor'].includes(role)) {
            return res.status(400).json({ error: 'Role must be "patient" or "doctor".' });
        }

        if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
            return res.status(400).json({ error: 'Password must be 8–128 characters.' });
        }

        if (fullName.length > 100) {
            return res.status(400).json({ error: 'Full name must be 100 characters or fewer.' });
        }

        // Doctor-specific validation
        if (role === 'doctor') {
            if (!medicalRegistrationNumber || !specialization || !clinicName) {
                return res.status(400).json({ error: 'Doctors must provide registration number, specialization, and clinic name.' });
            }
        }

        // Check if email already exists
        const existingUser = User.findByEmail(email);
        if (existingUser) {
            return res.status(409).json({ error: 'An account with this email already exists.' });
        }

        const user = await User.create({
            fullName,
            email,
            phone: phone || undefined,
            password,
            role,
            medicalRegistrationNumber: role === 'doctor' ? medicalRegistrationNumber : undefined,
            specialization: role === 'doctor' ? specialization : undefined,
            clinicName: role === 'doctor' ? clinicName : undefined,
        });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        User.createSession(user._id, {
            deviceInfo: req.get('user-agent'),
            ipAddress: req.ip,
        });

        logAudit({
            userId: user._id,
            action: 'register',
            actorRole: role,
            meta: { ip: req.ip, ua: req.get('user-agent') },
        });

        res.status(201).json({
            message: 'Account created successfully',
            token,
            user,
        });
    } catch (err) {
        console.error('Register error:', err.message);
        res.status(500).json({ error: 'Server error. Please try again.' });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const email = sanitize(req.body.email || '').toLowerCase();
        const password = req.body.password;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format.' });
        }

        const user = User.findByEmail(email);
        if (!user) {
            logAudit({ userId: 0, action: 'login_failed', meta: { ip: req.ip, email, reason: 'unknown_email' } });
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            logAudit({ userId: user._id, action: 'login_failed', actorRole: user.role, meta: { ip: req.ip, reason: 'wrong_password' } });
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        User.createSession(user._id, {
            deviceInfo: req.get('user-agent'),
            ipAddress: req.ip,
        });

        logAudit({
            userId: user._id,
            action: 'login',
            actorRole: user.role,
            meta: { ip: req.ip, ua: req.get('user-agent') },
        });

        res.json({
            message: 'Login successful',
            token,
            user,
        });
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({ error: 'Server error. Please try again.' });
    }
});

// GET /api/auth/me — get current user
router.get('/me', auth, async (req, res) => {
    res.json({ user: req.user });
});

module.exports = router;
