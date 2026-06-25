const express = require('express');
const router = express.Router();
const passport = require('passport');
const {
    registerUser,
    loginUser,
    logoutUser,
    refreshSession,
    forgotPassword,
    resetPassword
} = require('../controllers/auth.controller');

const { protect } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { registerSchema, loginSchema } = require('../validations/auth.validation');

router.post('/register', validate(registerSchema), registerUser);
router.post('/login', validate(loginSchema), loginUser);
router.post('/logout', logoutUser);
router.get('/refresh', refreshSession); // New refresh endpoint
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword/:resettoken', resetPassword);

// --- Google OAuth Routes ---
// Initiates the OAuth flow
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Callback URL for Google to redirect to after successful authentication
router.get(
    '/google/callback',
    passport.authenticate('google', { failureRedirect: '/login?error=oauth_failed', session: false }),
    (req, res) => {
        // Successful authentication.
        // We need to generate our own JWT tokens and set them as cookies just like regular login
        const generateToken = require('../utils/generateToken');
        generateToken(res, req.user);

        // Redirect back to the frontend dashboard
        res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}`);
    }
);

module.exports = router;
