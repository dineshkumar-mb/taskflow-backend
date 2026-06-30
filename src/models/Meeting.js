const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');
const Schema = mongoose.Schema;

const meetingSchema = new Schema({
  // Metadata
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  
  // Scheduling
  scheduledAt: {
    type: Date,
    required: true
  },
  duration: {
    type: Number,
    default: null  // minutes, calculated when meeting ends
  },
  
  // Relationships
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  organization: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  sprintId: {
    type: Schema.Types.ObjectId,
    ref: 'Sprint',
    default: null
  },
  hostId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  
  // Participants
  participantIds: [
    {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  ],
  attendedIds: [
    {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  ],
  
  // Content
  agenda: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  transcriptRaw: {
    type: String,
    default: null
  },
  
  // MOM
  mom: {
    summary: String,
    decisions: [String],
    actionItems: [
      {
        title: String,
        description: String,
        assigneeId: { type: Schema.Types.ObjectId, ref: 'User' },
        priority: { type: String, enum: ['Low', 'Medium', 'High'] },
        dueDate: Date,
        createdIssueId: { type: Schema.Types.ObjectId, ref: 'Issue' },
        completed: Boolean
      }
    ],
    generatedAt: Date,
    confirmedAt: Date
  },
  
  // Status
  status: {
    type: String,
    enum: ['scheduled', 'live', 'ended', 'archived'],
    default: 'scheduled'
  },
  
  // References
  activityId: Schema.Types.ObjectId,  // ref to Activity log entry
  recordingUrl: String,  // optional; for future recording storage
  searchText: {
    type: String,
    index: true,
  }
}, { timestamps: true });

// Indexes
meetingSchema.index({ organization: 1 });
meetingSchema.index({ organizationId: 1, projectId: 1 });
meetingSchema.index({ hostId: 1 });
meetingSchema.index({ scheduledAt: 1 });

// Middleware to populate searchText for future search index
meetingSchema.pre('save', function(next) {
  this.searchText = `${this.title} ${this.description || ''} ${this.agenda || ''}`.trim().toLowerCase();
  next();
});

meetingSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('Meeting', meetingSchema);

