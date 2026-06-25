const authService = require('../services/auth.service');
const generateToken = require('../utils/generateToken');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const crypto = require('crypto');

const registerUser = async (req, res) => {
    try {
        const user = await authService.registerUser(req.body);
        const { accessToken } = generateToken(res, user);
        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            organizationId: user.organizationId,
            role: user.role,
            token: accessToken, // Still sending access token string for legacy fallback if needed
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const loginUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await authService.loginUser(email, password);
        const { accessToken } = generateToken(res, user);
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            organizationId: user.organizationId,
            role: user.role,
            token: accessToken,
        });
    } catch (error) {
        res.status(401).json({ message: error.message });
    }
};

const logoutUser = (req, res) => {
    // Clear both tokens
    res.cookie('accessToken', 'none', {
        httpOnly: true,
        expires: new Date(Date.now() + 5 * 1000), // Expires in 5 seconds
    });
    res.cookie('refreshToken', 'none', {
        httpOnly: true,
        expires: new Date(Date.now() + 5 * 1000),
    });

    res.status(200).json({ success: true, message: 'Logged out successfully' });
};

// @desc    Refresh Token
// @route   GET /api/auth/refresh
// @access  Public (via cookie)
const refreshSession = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;

        if (!refreshToken || refreshToken === 'none') {
            return res.status(401).json({ message: 'No refresh token provided' });
        }

        const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET + '_REFRESH');
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({ message: 'Invalid refresh token payload' });
        }

        const { accessToken } = generateToken(res, user);

        res.status(200).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            organizationId: user.organizationId,
            role: user.role,
            token: accessToken,
        });
    } catch (error) {
        console.error('Refresh error:', error);
        res.status(401).json({ message: 'Refresh token expired or invalid' });
    }
};

// @desc    Forgot Password
// @route   POST /api/auth/forgotpassword
// @access  Public
const forgotPassword = async (req, res) => {
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
        return res.status(404).json({ message: 'User not found with this email' });
    }

    // Get reset token
    const resetToken = user.getResetPasswordToken();

    await user.save({ validateBeforeSave: false });

    // Create reset url
    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

    const message = `
        <h1>You have requested a password reset</h1>
        <p>Please click on the link below to reset your password:</p>
        <a href="${resetUrl}">${resetUrl}</a>
        <p>This link will expire in 10 minutes.</p>
    `;

    try {
        await sendEmail({
            email: user.email,
            subject: 'Password Reset Token',
            html: message,
        });

        res.status(200).json({ success: true, data: 'Email sent' });
    } catch (err) {
        console.error(err);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;

        await user.save({ validateBeforeSave: false });

        res.status(500).json({ message: 'Email could not be sent' });
    }
};

// @desc    Reset Password
// @route   PUT /api/auth/resetpassword/:resettoken
// @access  Public
const resetPassword = async (req, res) => {
    // Get hashed token
    const resetPasswordToken = crypto
        .createHash('sha256')
        .update(req.params.resettoken)
        .digest('hex');

    const user = await User.findOne({
        resetPasswordToken,
        resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
        return res.status(400).json({ message: 'Invalid or expired token' });
    }

    // Set new password
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    res.status(200).json({ success: true, message: 'Password reset successfully' });
};

module.exports = {
    registerUser,
    loginUser,
    logoutUser,
    refreshSession,
    forgotPassword,
    resetPassword,
};
