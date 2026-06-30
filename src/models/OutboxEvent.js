const mongoose = require('mongoose');

const outboxEventSchema = new mongoose.Schema({
    eventType: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    processed: { type: Boolean, default: false, index: true },
    processedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('OutboxEvent', outboxEventSchema);
