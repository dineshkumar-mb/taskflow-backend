const Meeting = require('../models/Meeting');
const Transcript = require('../models/Transcript');
const Issue = require('../models/Issue');
const Activity = require('../models/Activity');
const User = require('../models/User');
const { sendEmail } = require('../services/email.service');
const { generateMOMFromTranscript } = require('../services/ai.service');

// Create (schedule) meeting
exports.createMeeting = async (req, res) => {
  try {
    const { title, description, agenda, scheduledAt, projectId, sprintId, participantIds } = req.body;
    const hostId = req.user._id;

    // Validate scheduled time is in future
    if (new Date(scheduledAt) < new Date()) {
      return res.status(400).json({ error: 'Meeting time must be in the future' });
    }

    // Validate participants exist
    const participants = await User.find({ _id: { $in: participantIds } });
    if (participants.length !== participantIds.length) {
      return res.status(400).json({ error: 'One or more participants not found' });
    }

    const meeting = new Meeting({
      title,
      description,
      agenda,
      scheduledAt,
      organizationId: req.user.organizationId,
      projectId,
      sprintId,
      hostId,
      participantIds,
      status: 'scheduled'
    });

    await meeting.save();

    // Send invites to all participants
    for (const participant of participants) {
      await sendMeetingInviteEmail(meeting, participant, req.user);
    }

    // Log activity
    await Activity.create({
      organizationId: req.user.organizationId,
      projectId,
      user: hostId,
      meetingId: meeting._id,
      type: 'meeting_scheduled',
      metadata: {
        meetingTitle: meeting.title,
        attendeeCount: participantIds.length
      }
    });

    res.status(201).json({ success: true, meeting });
  } catch (error) {
    console.error('Error creating meeting:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get all meetings for user (global)
exports.getGlobalMeetings = async (req, res) => {
  try {
    const userId = req.user._id;
    const meetings = await Meeting.find({
      organizationId: req.user.organizationId,
      $or: [{ hostId: userId }, { participantIds: userId }]
    })
      .populate('hostId', 'name email')
      .populate('projectId', 'name key')
      .populate('participantIds', 'name email')
      .sort({ scheduledAt: -1 });

    res.json({ success: true, meetings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get meetings by project
exports.getMeetingsByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const meetings = await Meeting.find({ projectId })
      .populate('hostId', 'name email')
      .populate('participantIds', 'name email')
      .sort({ scheduledAt: -1 });

    res.json({ success: true, meetings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get single meeting
exports.getMeetingById = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const meeting = await Meeting.findById(meetingId)
      .populate('hostId', 'name email')
      .populate('participantIds', 'name email')
      .populate('mom.actionItems.assigneeId', 'name');

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    res.json({ success: true, meeting });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update meeting (before it starts)
exports.updateMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { title, agenda, participantIds, scheduledAt } = req.body;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    if (meeting.status !== 'scheduled') {
      return res.status(400).json({ error: 'Can only update scheduled meetings' });
    }

    // Update fields
    if (title) meeting.title = title;
    if (agenda) meeting.agenda = agenda;
    if (participantIds) meeting.participantIds = participantIds;
    if (scheduledAt) meeting.scheduledAt = scheduledAt;

    await meeting.save();

    res.json({ success: true, meeting });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Start meeting
exports.startMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const meeting = await Meeting.findById(meetingId);

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    if (meeting.hostId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only host can start meeting' });
    }

    meeting.status = 'live';
    await meeting.save();

    // Create empty transcript record
    await Transcript.create({
      meetingId: meeting._id,
      segments: []
    });

    // Log activity
    await Activity.create({
      organizationId: meeting.organizationId,
      projectId: meeting.projectId,
      user: req.user._id,
      meetingId: meeting._id,
      type: 'meeting_started'
    });

    res.json({ success: true, message: 'Meeting started' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// End meeting
exports.endMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { transcriptSegments, attendeeIds } = req.body;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Update meeting
    meeting.status = 'ended';
    meeting.attendedIds = attendeeIds;
    const now = new Date();
    const duration = Math.floor((now - meeting.scheduledAt) / 60000); // minutes
    meeting.duration = duration;

    // Save transcript segments
    const transcript = await Transcript.findOne({ meetingId });
    if (transcript) {
      transcript.segments = transcriptSegments;
      transcript.fullText = transcriptSegments.map(s => s.text).join(' ');
      await transcript.save();
      meeting.transcriptRaw = transcript.fullText;
    }

    await meeting.save();

    // Log activity
    await Activity.create({
      organizationId: meeting.organizationId,
      projectId: meeting.projectId,
      user: req.user._id,
      meetingId: meeting._id,
      type: 'meeting_ended',
      metadata: {
        meetingTitle: meeting.title,
        duration: duration,
        attendeeCount: attendeeIds.length
      }
    });

    res.json({ success: true, message: 'Meeting ended', meeting });
  } catch (error) {
    console.error('Error ending meeting:', error);
    res.status(500).json({ error: error.message });
  }
};

// Generate MOM
exports.generateMOM = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const meeting = await Meeting.findById(meetingId);

    if (!meeting || !meeting.transcriptRaw) {
      return res.status(400).json({ error: 'Meeting or transcript not found' });
    }

    // Call AI service to generate MOM
    const momData = await generateMOMFromTranscript(
      meeting.transcriptRaw,
      meeting.agenda,
      meeting.participantIds
    );

    // Store MOM in meeting record (not confirmed yet)
    meeting.mom = {
      summary: momData.summary,
      decisions: momData.decisions,
      actionItems: momData.actionItems.map(item => ({
        title: item.title,
        description: item.description,
        assigneeId: item.assigneeId || meeting.hostId,
        priority: item.priority || 'Medium',
        dueDate: item.dueDate,
        completed: false
      })),
      generatedAt: new Date()
    };

    await meeting.save();

    // Log activity
    await Activity.create({
      organizationId: meeting.organizationId,
      projectId: meeting.projectId,
      user: req.user._id,
      meetingId: meeting._id,
      type: 'mom_generated',
      metadata: {
        meetingTitle: meeting.title,
        momSummary: momData.summary,
        actionItemsCount: momData.actionItems.length
      }
    });

    res.json({ success: true, mom: meeting.mom });
  } catch (error) {
    console.error('Error generating MOM:', error);
    res.status(500).json({ error: error.message });
  }
};

// Confirm and send MOM
exports.confirmAndSendMOM = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { updatedMOM } = req.body;

    const meeting = await Meeting.findById(meetingId)
      .populate('hostId', 'name email')
      .populate('participantIds', 'name email');

    if (!meeting || !meeting.mom) {
      return res.status(400).json({ error: 'Meeting or MOM not found' });
    }

    // Update MOM if edited
    if (updatedMOM) {
      meeting.mom.summary = updatedMOM.summary || meeting.mom.summary;
      meeting.mom.decisions = updatedMOM.decisions || meeting.mom.decisions;
      meeting.mom.actionItems = updatedMOM.actionItems || meeting.mom.actionItems;
    }

    meeting.mom.confirmedAt = new Date();
    await meeting.save();

    // 1. Send MOM email to all participants
    const emailPromises = meeting.participantIds.map(participant =>
      sendMOMEmail(meeting, participant)
    );
    await Promise.all(emailPromises);

    // 2. Create Issues for each action item
    for (const actionItem of meeting.mom.actionItems) {
      const issue = new Issue({
        title: actionItem.title,
        description: actionItem.description,
        project: meeting.projectId, // It seems taskflow uses project instead of projectId for Issue model, let me verify this. I will use project
        sprint: meeting.sprintId, // taskflow uses sprint, not sprintId. 
        assignee: actionItem.assigneeId,
        priority: actionItem.priority,
        dueDate: actionItem.dueDate,
        status: 'to-do',
      });
      const savedIssue = await issue.save();
      actionItem.createdIssueId = savedIssue._id;
    }

    await meeting.save();

    // 3. Log activity
    await Activity.create({
      organizationId: meeting.organizationId,
      projectId: meeting.projectId,
      user: req.user._id,
      meetingId: meeting._id,
      type: 'mom_sent',
      metadata: {
        meetingTitle: meeting.title,
        actionItemsCount: meeting.mom.actionItems.length,
        attendeeCount: meeting.participantIds.length
      }
    });

    res.json({
      success: true,
      message: 'MOM sent to all participants and action items created',
      meeting
    });
  } catch (error) {
    console.error('Error confirming MOM:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get transcript
exports.getTranscript = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const transcript = await Transcript.findOne({ meetingId });

    if (!transcript) {
      return res.status(404).json({ error: 'Transcript not found' });
    }

    res.json({ success: true, transcript });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ============ Helper Functions ============

async function sendMeetingInviteEmail(meeting, participant, host) {
  const subject = `You're invited: ${meeting.title}`;
  const html = `
    <h2>${meeting.title}</h2>
    <p><strong>Host:</strong> ${host.name}</p>
    <p><strong>Time:</strong> ${meeting.scheduledAt.toLocaleString()}</p>
    <p><strong>Agenda:</strong> ${meeting.agenda || 'No agenda provided'}</p>
    <p>
      <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/meetings/${meeting._id}/join" 
         style="padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; display: inline-block;">
        Join Meeting
      </a>
    </p>
  `;

  await sendEmail({
    to: participant.email,
    subject,
    html
  });
}

async function sendMOMEmail(meeting, participant) {
  const subject = `Minutes of Meeting: ${meeting.title}`;
  const html = generateMOMEmailHTML(meeting, participant);

  await sendEmail({
    to: participant.email,
    subject,
    html
  });
}

function generateMOMEmailHTML(meeting, participant) {
  const actionItemsHTML = meeting.mom.actionItems
    .map(item => `
      <div style="border: 1px solid #ddd; padding: 10px; margin: 8px 0; border-radius: 4px;">
        <h4>${item.title}</h4>
        <p>${item.description}</p>
        <small>
          <strong>Priority:</strong> ${item.priority} | 
          <strong>Due:</strong> ${item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'TBD'}
        </small>
      </div>
    `)
    .join('');

  const decisionsHTML = meeting.mom.decisions
    .map(decision => `<li>${decision}</li>`)
    .join('');

  return `
    <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1>${meeting.title}</h1>
        <p><strong>Date:</strong> ${meeting.scheduledAt.toLocaleDateString()} at ${meeting.scheduledAt.toLocaleTimeString()}</p>
        <p><strong>Duration:</strong> ${meeting.duration} minutes</p>
        
        <h2>Summary</h2>
        <p>${meeting.mom.summary}</p>
        
        <h2>Decisions Made</h2>
        <ul>${decisionsHTML}</ul>
        
        <h2>Action Items</h2>
        ${actionItemsHTML}
        
        <hr/>
        <p style="color: #666; font-size: 12px;">
          <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/meetings/${meeting._id}/mom">
            View full meeting in TaskFlow
          </a> | 
          Action items have been automatically added to your project board.
        </p>
      </body>
    </html>
  `;
}
