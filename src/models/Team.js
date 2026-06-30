const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');

const teamSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

teamSchema.index({ name: 1, organization: 1 }, { unique: true });

teamSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('Team', teamSchema);
