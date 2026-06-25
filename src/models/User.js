const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
        },
        password: {
            type: String,
            required: true,
        },
        authProvider: {
            type: String,
            enum: ['local', 'google'],
            default: 'local'
        },
        avatar: {
            type: String,
        },
        organizationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
        },
        role: {
            type: String,
            enum: ['SuperAdmin', 'OrgOwner', 'Admin', 'Member', 'Viewer'],
            default: 'Member',
        },
        isVerified: {
            type: Boolean,
            default: false,
        },
        verificationToken: String,
        resetPasswordToken: String,
        resetPasswordExpire: Date,
    },
    {
        timestamps: true,
    }
);

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Encrypt password using bcrypt
userSchema.pre('save', async function () {
    if (!this.isModified('password')) {
        return;
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

const jwt = require('jsonwebtoken');

// Sign JWT and return (Short-lived 15 mins)
userSchema.methods.getSignedJwtToken = function () {
    return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
        expiresIn: '15m',
    });
};

// Sign Refresh Token (Long-lived 7 days)
userSchema.methods.getRefreshToken = function () {
    return jwt.sign({ id: this._id }, process.env.JWT_SECRET + '_REFRESH', {
        expiresIn: '7d',
    });
};

// Generate and hash password token
userSchema.methods.getResetPasswordToken = function () {
    const crypto = require('crypto');
    // Generate token
    const resetToken = crypto.randomBytes(20).toString('hex');

    // Hash token and set to resetPasswordToken field
    this.resetPasswordToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

    // Set expire (10 mins)
    this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

    return resetToken;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
