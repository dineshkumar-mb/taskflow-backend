const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');

const attachmentSchema = new mongoose.Schema({
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true }, // size in bytes
    path: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

attachmentSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('Attachment', attachmentSchema);
