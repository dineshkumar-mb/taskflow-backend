const mongoose = require('mongoose');

const invitationSchema = new mongoose.Schema({
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    email: { type: String, required: true },
    role: { type: String, enum: ['OrgOwner', 'Owner', 'Admin', 'Member', 'Viewer'], default: 'Member' },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, index: true },
    status: { type: String, enum: ['pending', 'accepted', 'expired', 'revoked'], default: 'pending', index: true }
}, { timestamps: true });

module.exports = mongoose.model('Invitation', invitationSchema);
