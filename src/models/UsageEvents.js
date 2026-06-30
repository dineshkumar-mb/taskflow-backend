const mongoose = require('mongoose');

const usageEventSchema = new mongoose.Schema({
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    type: { type: String, enum: ['TASK_CREATED', 'TASK_DELETED', 'AI_ACTION', 'MEETING_CREATED', 'FILE_UPLOAD', 'FILE_DELETED'], required: true },
    quantity: { type: Number, default: 1 },
    timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('UsageEvent', usageEventSchema);
