const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    discountType: {
        type: String,
        enum: ['percentage', 'flat'],
        required: true
    },
    discountValue: {
        type: Number,
        required: true,
        min: 0
    },
    active: {
        type: Boolean,
        default: true
    },
    expiryDate: {
        type: Date
    },
    maxRedemptions: {
        type: Number,
        default: null
    },
    redemptionsCount: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

// Check if coupon is valid
couponSchema.methods.isValid = function() {
    if (!this.active) return false;
    if (this.expiryDate && new Date() > this.expiryDate) return false;
    if (this.maxRedemptions !== null && this.redemptionsCount >= this.maxRedemptions) return false;
    return true;
};

module.exports = mongoose.model('Coupon', couponSchema);
