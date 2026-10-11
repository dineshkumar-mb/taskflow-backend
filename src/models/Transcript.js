const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const transcriptSchema = new Schema({
  meetingId: {
    type: Schema.Types.ObjectId,
    ref: 'Meeting',
    required: true
  },
  
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    index: true
  },
  organization: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    index: true
  },
  
  // Raw segments captured during meeting
  segments: [
    {
      timestamp: Date,
      speakerId: Schema.Types.ObjectId,  // ref to User
      speakerName: String,
      text: String,
      duration: Number  // in seconds
    }
  ],
  
  // Searchable fulltext (concatenated for search)
  fullText: String,
  
}, { timestamps: true });

// Indexes for search and tenant scoping
transcriptSchema.index({ meetingId: 1 });
transcriptSchema.index({ organizationId: 1, meetingId: 1 });
transcriptSchema.index({ fullText: 'text' });

module.exports = mongoose.model('Transcript', transcriptSchema);
