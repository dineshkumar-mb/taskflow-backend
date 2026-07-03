const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const Organization = require('../models/Organization');
const User = require('../models/User');
const Coupon = require('../models/Coupon');
const Subscription = require('../models/Subscription');

// Middleware to restrict access to SuperAdmin
const requireSuperAdmin = async (req, res, next) => {
    try {
        const userRole = typeof req.user.role === 'object' ? req.user.role?.name : (req.user.role || req.user.roleName);
        
        if (userRole === 'SuperAdmin') {
            return next();
        }

        // Secondary check in case role object has SuperAdmin name
        if (req.user.role) {
            const Role = require('../models/Role');
            const roleObj = await Role.findById(req.user.role);
            if (roleObj && roleObj.name === 'SuperAdmin') {
                return next();
            }
        }

        return res.status(403).json({ message: 'Access denied. SuperAdmin role required.' });
    } catch (error) {
        console.error('SuperAdmin middleware error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Protect all admin routes
router.use(protect, requireSuperAdmin);

// 1. Get all organizations
router.get('/organizations', async (req, res) => {
    try {
        const organizations = await Organization.find({})
            .populate('owner', 'name email')
            .sort({ createdAt: -1 });
        res.json(organizations);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 2. Change organization's plan manually (override)
router.put('/organizations/:id/plan', async (req, res) => {
    try {
        const { plan, subscriptionStatus } = req.body;
        
        if (!['free', 'pro', 'team', 'starter', 'business', 'enterprise'].includes(plan)) {
            return res.status(400).json({ message: 'Invalid plan type' });
        }

        const org = await Organization.findById(req.id || req.params.id);
        if (!org) {
            return res.status(404).json({ message: 'Organization not found' });
        }

        org.plan = plan;
        org.currentPlan = plan;
        if (subscriptionStatus) {
            org.subscriptionStatus = subscriptionStatus;
        }
        await org.save();

        // Also sync subscription model
        await Subscription.findOneAndUpdate(
            { organization: org._id },
            {
                plan,
                status: subscriptionStatus || 'ACTIVE',
                paymentProvider: 'none',
                paymentProviderId: 'manual_override'
            },
            { upsert: true, new: true }
        );

        res.json({ message: 'Subscription plan updated successfully', organization: org });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 3. Get all coupons
router.get('/coupons', async (req, res) => {
    try {
        const coupons = await Coupon.find({}).sort({ createdAt: -1 });
        res.json(coupons);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 4. Generate a new coupon
router.post('/coupons', async (req, res) => {
    try {
        const { code, discountType, discountValue, expiryDate, maxRedemptions } = req.body;

        if (!code || !discountType || discountValue === undefined) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const uppercaseCode = code.toUpperCase().trim();
        const existingCoupon = await Coupon.findOne({ code: uppercaseCode });
        if (existingCoupon) {
            return res.status(400).json({ message: 'Coupon code already exists' });
        }

        const coupon = await Coupon.create({
            code: uppercaseCode,
            discountType,
            discountValue,
            expiryDate: expiryDate ? new Date(expiryDate) : null,
            maxRedemptions: maxRedemptions ? Number(maxRedemptions) : null
        });

        res.status(201).json(coupon);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 5. Delete/Deactivate a coupon
router.delete('/coupons/:id', async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);
        if (!coupon) {
            return res.status(404).json({ message: 'Coupon not found' });
        }

        // We can do hard delete or soft delete by deactivating
        await Coupon.findByIdAndDelete(req.params.id);
        res.json({ message: 'Coupon deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
