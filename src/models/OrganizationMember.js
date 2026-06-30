const mongoose = require('mongoose');

const organizationMemberSchema = new mongoose.Schema({
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ['OrgOwner', 'Owner', 'Admin', 'Member', 'Viewer'], default: 'Member' },
    status: { type: String, enum: ['active', 'invited', 'suspended'], default: 'active', index: true },
    joinedAt: { type: Date, default: Date.now }
}, { timestamps: true });

organizationMemberSchema.index({ organization: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('OrganizationMember', organizationMemberSchema);
