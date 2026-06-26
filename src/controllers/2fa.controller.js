const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');

// @desc    Generate 2FA Secret and QR Code
// @route   POST /api/auth/2fa/generate
// @access  Private
const generate2FA = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (user.isTwoFactorEnabled) {
            return res.status(400).json({ message: '2FA is already enabled' });
        }

        const secret = speakeasy.generateSecret({
            name: `TaskFlow (${user.email})`
        });

        // We temporarily store the secret on the user object but do not enable 2FA yet
        user.twoFactorSecret = secret.base32;
        await user.save();

        qrcode.toDataURL(secret.otpauth_url, (err, dataUrl) => {
            if (err) {
                return res.status(500).json({ message: 'Error generating QR code' });
            }
            res.status(200).json({
                secret: secret.base32,
                qrCode: dataUrl
            });
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Enable 2FA by verifying token
// @route   POST /api/auth/2fa/enable
// @access  Private
const enable2FA = async (req, res) => {
    try {
        const { token } = req.body;
        const user = await User.findById(req.user._id);

        if (!user.twoFactorSecret) {
            return res.status(400).json({ message: '2FA secret not generated yet' });
        }

        const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token
        });

        if (verified) {
            user.isTwoFactorEnabled = true;
            await user.save();
            res.status(200).json({ message: '2FA has been successfully enabled' });
        } else {
            res.status(400).json({ message: 'Invalid 2FA token' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Verify 2FA token during login
// @route   POST /api/auth/2fa/verify
// @access  Public
const verify2FALogin = async (req, res) => {
    try {
        const { userId, token } = req.body;

        const user = await User.findById(userId).populate('role');

        if (!user || !user.isTwoFactorEnabled) {
            return res.status(400).json({ message: '2FA is not enabled for this user' });
        }

        const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token
        });

        if (verified) {
            const { accessToken } = generateToken(res, user);
            res.status(200).json({
                _id: user._id,
                name: user.name,
                email: user.email,
                organizationId: user.organizationId,
                role: user.role?.name || user.roleName || user.role,
                isTwoFactorEnabled: user.isTwoFactorEnabled,
                token: accessToken,
            });
        } else {
            res.status(400).json({ message: 'Invalid 2FA token' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Disable 2FA
// @route   POST /api/auth/2fa/disable
// @access  Private
const disable2FA = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        user.isTwoFactorEnabled = false;
        user.twoFactorSecret = undefined;
        await user.save();

        res.status(200).json({ message: '2FA has been disabled' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    generate2FA,
    enable2FA,
    verify2FALogin,
    disable2FA
};
