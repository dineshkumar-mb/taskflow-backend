const Meeting = require('../models/Meeting');
const Transcript = require('../models/Transcript');
const Issue = require('../models/Issue');
const Activity = require('../models/Activity');
const User = require('../models/User');
const issueService = require('../services/issue.service');
const { sendEmail } = require('../services/email.service');
const { generateMOMFromTranscript } = require('../services/ai.service');
const {
  assertMeetingAccess,
  assertProjectAccess,
  assertTranscriptAccess,
  getActiveOrganizationId
} = require('../security/tenantAccess');
const DistributedLock = require('../security/distributedLock');
const { enqueueJob, QUEUE_NAMES } = require('../queues/queueManager');

// Create (schedule) meeting
exports.createMeeting = async (req, res) => {
  try {
    const { title, description, agenda, scheduledAt, projectId, sprintId, participantIds } = req.body;
    const hostId = req.user._id;
    const orgId = await getActiveOrganizationId(req);

    // Validate project belongs to organization
    await assertProjectAccess(req, projectId);

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
      organizationId: orgId,
      organization: orgId,
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
    const orgId = await getActiveOrganizationId(req);
    const meetings = await Meeting.find({
      $and: [
        { $or: [{ organizationId: orgId }, { organization: orgId }] },
        { $or: [{ hostId: userId }, { participantIds: userId }] }
      ]
    })
      .populate('hostId', 'name email')
      .populate('projectId', 'name key')
      .populate('participantIds', 'name email')
      .sort({ scheduledAt: -1 });

    res.json({ success: true, meetings });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
};

// Get meetings by project
exports.getMeetingsByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const orgId = await getActiveOrganizationId(req);
    await assertProjectAccess(req, projectId);

    const meetings = await Meeting.find({
      projectId,
      $or: [{ organizationId: orgId }, { organization: orgId }]
    })
      .populate('hostId', 'name email')
      .populate('participantIds', 'name email')
      .sort({ scheduledAt: -1 });

    res.json({ success: true, meetings });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
};

// Get single meeting
exports.getMeetingById = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const meeting = await assertMeetingAccess(req, meetingId, { populate: true });

    res.json({ success: true, meeting });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
};

// Update meeting (before it starts)
exports.updateMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { title, agenda, participantIds, scheduledAt } = req.body;

    const meeting = await assertMeetingAccess(req, meetingId);

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
    res.status(error.statusCode || 500).json({ error: error.message });
  }
};

// Start meeting
exports.startMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const meeting = await assertMeetingAccess(req, meetingId);

    if (meeting.hostId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only host can start meeting' });
    }

    meeting.status = 'live';
    await meeting.save();

    // Create empty transcript record with tenant linkage
    await Transcript.create({
      meetingId: meeting._id,
      organizationId: meeting.organizationId,
      organization: meeting.organizationId,
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
    res.status(error.statusCode || 500).json({ error: error.message });
  }
};

// End meeting
exports.endMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { transcriptSegments, attendeeIds } = req.body;

    const meeting = await assertMeetingAccess(req, meetingId);

    // Filter valid mongo IDs for attendedIds
    const validAttendeeIds = (attendeeIds || [])
      .filter(id => id && typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/));
    
    if (validAttendeeIds.length === 0 && req.user && req.user._id) {
      validAttendeeIds.push(req.user._id);
    }

    // Update meeting
    meeting.status = 'ended';
    meeting.attendedIds = validAttendeeIds;
    const now = new Date();
    const duration = Math.max(0, Math.floor((now - new Date(meeting.scheduledAt)) / 60000)); // minutes
    meeting.duration = duration;

    // Save transcript segments with tenant scoping
    let transcript = await Transcript.findOne({ meetingId });
    if (!transcript) {
      transcript = new Transcript({
        meetingId,
        organizationId: meeting.organizationId,
        organization: meeting.organizationId,
        segments: []
      });
    }
    
    if (transcriptSegments && Array.isArray(transcriptSegments) && transcriptSegments.length > 0) {
      transcript.segments = transcriptSegments;
      transcript.fullText = transcriptSegments.map(s => s.text).join(' ');
    } else if (!transcript.fullText) {
      transcript.fullText = '';
    }
    
    await transcript.save();
    meeting.transcriptRaw = transcript.fullText || '';
    await meeting.save();

    // Log activity safely
    try {
      await Activity.create({
        organizationId: meeting.organizationId || req.user.organizationId,
        projectId: meeting.projectId,
        user: req.user._id,
        meetingId: meeting._id,
        type: 'meeting_ended',
        metadata: {
          meetingTitle: meeting.title,
          duration: duration,
          attendeeCount: validAttendeeIds.length
        }
      });
    } catch (actErr) {
      console.warn('Activity logging warning on end meeting:', actErr.message);
    }

    return res.status(200).json({ success: true, message: 'Meeting ended successfully', meeting });
  } catch (error) {
    console.error('Error ending meeting:', error);
    res.status(500).json({ error: error.message });
  }
};

// Generate MOM
exports.generateMOM = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const meeting = await assertMeetingAccess(req, meetingId, { populate: true });

    const rawText = meeting.transcriptRaw && meeting.transcriptRaw.trim() 
      ? meeting.transcriptRaw 
      : `Meeting Title: ${meeting.title}. Agenda: ${meeting.agenda || 'General project update and task sync'}.`;

    const participants = [];
    if (meeting.participantIds && Array.isArray(meeting.participantIds)) {
      meeting.participantIds.forEach(p => {
        if (p && p._id) participants.push({ _id: p._id, name: p.name, email: p.email });
      });
    }
    if (meeting.hostId && meeting.hostId._id) {
      if (!participants.some(p => p._id.toString() === meeting.hostId._id.toString())) {
        participants.push({ _id: meeting.hostId._id, name: meeting.hostId.name, email: meeting.hostId.email });
      }
    }

    // Call AI service to generate MOM
    const momData = await generateMOMFromTranscript(
      rawText,
      meeting.agenda,
      participants
    );

    // Store MOM in meeting record (not confirmed yet)
    meeting.mom = {
      summary: momData.summary,
      decisions: momData.decisions,
      actionItems: (momData.actionItems || []).map(item => {
        let assigneeId = item.assigneeId;
        let matchedPart = null;
        if (assigneeId) {
          matchedPart = participants.find(p => p._id.toString() === assigneeId.toString());
        }
        if (!matchedPart && item.assigneeName) {
          matchedPart = participants.find(p => p.name && p.name.toLowerCase().includes(item.assigneeName.toLowerCase()));
        }
        const hostObjId = meeting.hostId?._id || meeting.hostId;
        const hostName = meeting.hostId?.name || 'Host';
        const finalAssignee = matchedPart ? matchedPart._id : hostObjId;
        const finalName = matchedPart ? matchedPart.name : (item.assigneeName || hostName);

        return {
          title: item.title,
          description: item.description,
          assigneeId: finalAssignee,
          assigneeName: finalName,
          priority: item.priority || 'Medium',
          dueDate: item.dueDate ? new Date(item.dueDate) : null,
          completed: false
        };
      }),
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
        actionItemsCount: (momData.actionItems || []).length
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

    const meeting = await assertMeetingAccess(req, meetingId, { populate: true });

    if (!meeting || !meeting.mom) {
      return res.status(400).json({ error: 'Meeting or MOM not found' });
    }

    const hostId = meeting.hostId?._id || meeting.hostId;

    // Use Distributed Lock to prevent duplicate issue creation and race conditions (Phase 17 & Phase 8)
    await DistributedLock.withLock(`mom_confirm:${meeting._id}`, async () => {
      // Update MOM if edited
      if (updatedMOM) {
        meeting.mom.summary = updatedMOM.summary || meeting.mom.summary;
        meeting.mom.decisions = updatedMOM.decisions || meeting.mom.decisions;
        if (updatedMOM.actionItems) {
          meeting.mom.actionItems = updatedMOM.actionItems.map(item => {
            const rawAssignee = item.assigneeId?._id || item.assigneeId || hostId;
            return {
              title: item.title,
              description: item.description,
              assigneeId: rawAssignee,
              assigneeName: item.assigneeName || '',
              priority: item.priority || 'Medium',
              dueDate: item.dueDate ? new Date(item.dueDate) : null,
              completed: false,
              createdIssueId: item.createdIssueId || null
            };
          });
        }
      }

      meeting.mom.confirmedAt = new Date();
      await meeting.save();

      // 1. Queue MOM emails asynchronously to background workers (Phase 29)
      const allAttendeesMap = new Map();
      if (Array.isArray(meeting.participantIds)) {
        meeting.participantIds.forEach(p => { if (p && p.email) allAttendeesMap.set(p._id.toString(), p); });
      }
      if (meeting.hostId && meeting.hostId.email) {
        allAttendeesMap.set(meeting.hostId._id.toString(), meeting.hostId);
      }
      const uniqueAttendees = Array.from(allAttendeesMap.values());

      for (const participant of uniqueAttendees) {
        try {
          const emailHtml = generateMOMEmailHTML(meeting, participant);
          await enqueueJob(QUEUE_NAMES.EMAIL, 'SEND_MOM_EMAIL', {
            organizationId: meeting.organizationId,
            userId: participant._id,
            email: participant.email,
            subject: `📋 Minutes of Meeting: ${meeting.title}`,
            html: emailHtml
          });
        } catch (queueErr) {
          console.warn(`[MOM Queue Notice] Enqueue email failed, sending directly:`, queueErr.message);
          sendMOMEmail(meeting, participant).catch(e => console.warn(e.message));
        }
      }

      // 2. Create Issues for each action item idempotently using issueService
      const orgId = meeting.organizationId;

      for (const actionItem of meeting.mom.actionItems) {
        if (!actionItem.createdIssueId) {
          try {
            const targetAssignee = actionItem.assigneeId?._id || actionItem.assigneeId || hostId;
            const createdIssue = await issueService.createIssue(
              hostId,
              orgId,
              {
                title: actionItem.title || 'Meeting Action Item',
                description: actionItem.description || `Action item from meeting: ${meeting.title}`,
                project: meeting.projectId,
                sprint: meeting.sprintId || undefined,
                assignee: targetAssignee,
                priority: actionItem.priority ? actionItem.priority.toLowerCase() : 'medium',
                dueDate: actionItem.dueDate || undefined,
                status: 'todo',
                type: 'task'
              },
              req.io
            );
            actionItem.createdIssueId = createdIssue._id;
          } catch (err) {
            console.error('Error creating issue for action item:', err);
          }
        }
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
          attendeeCount: uniqueAttendees.length
        }
      });
    });

    res.json({
      success: true,
      message: 'MOM confirmed, emails queued, and action items created successfully',
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
    const { meeting, transcript } = await assertTranscriptAccess(req, meetingId);

    res.json({ success: true, transcript });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
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

function generateMOMEmailHTML(meeting, recipient) {
  // ✅ Check if recipient is the host
  const isHost = recipient._id.toString() === meeting.hostId._id.toString();

  const recipientLabel = isHost ? ' (Meeting Host)' : '';

  return `
    <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">

        <div style="background: #1a1a2e; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 20px;">📋 Minutes of Meeting</h1>
          <p style="color: #a0a0b0; margin: 4px 0 0;">${meeting.title}</p>
        </div>

        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none;">

          <p>Hi <strong>${recipient.name}${recipientLabel}</strong>,</p>
          <p>Here are the minutes from your recent meeting.</p>

          <table style="width: 100%; margin: 16px 0; font-size: 13px;">
            <tr>
              <td style="color: #6b7280; padding: 4px 0;">📅 Date</td>
              <td style="font-weight: 500;">${new Date(meeting.scheduledAt).toLocaleString()}</td>
            </tr>
            <tr>
              <td style="color: #6b7280; padding: 4px 0;">⏱ Duration</td>
              <td style="font-weight: 500;">${meeting.duration || 'N/A'} minutes</td>
            </tr>
            <tr>
              <td style="color: #6b7280; padding: 4px 0;">👤 Host</td>
              <td style="font-weight: 500;">${meeting.hostId.name}</td>
            </tr>
          </table>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />

          <h2 style="font-size: 16px; color: #111;">📝 Summary</h2>
          <p style="color: #374151; line-height: 1.6;">${meeting.mom.summary}</p>

          <h2 style="font-size: 16px; color: #111;">✅ Decisions Made</h2>
          <ul style="color: #374151; line-height: 1.8;">
            ${meeting.mom.decisions.map(d => `<li>${d}</li>`).join('')}
          </ul>

          <h2 style="font-size: 16px; color: #111;">🎯 Action Items</h2>
          ${meeting.mom.actionItems.map(item => `
            <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin: 8px 0;">
              <strong>${item.title}</strong>
              <p style="margin: 4px 0; color: #6b7280; font-size: 13px;">${item.description || ''}</p>
              <div style="display: flex; gap: 16px; font-size: 12px; margin-top: 8px;">
                <span style="background: ${item.priority === 'High' ? '#fef2f2' : item.priority === 'Medium' ? '#fefce8' : '#f0fdf4'}; 
                             color: ${item.priority === 'High' ? '#dc2626' : item.priority === 'Medium' ? '#ca8a04' : '#16a34a'}; 
                             padding: 2px 8px; border-radius: 4px;">
                  ${item.priority}
                </span>
                ${item.dueDate ? `<span style="color: #6b7280;">Due: ${new Date(item.dueDate).toLocaleDateString()}</span>` : ''}
              </div>
            </div>
          `).join('')}

          <div style="text-align: center; margin-top: 32px;">
            <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/meetings/${meeting._id}/mom"
               style="background: #4f46e5; color: white; padding: 12px 28px; 
                      border-radius: 6px; text-decoration: none; font-weight: 500;">
              View Full Meeting in TaskFlow
            </a>
          </div>

          <p style="margin-top: 24px; font-size: 12px; color: #9ca3af; text-align: center;">
            Action items have been automatically added to your project board.
          </p>
        </div>

      </body>
    </html>
  `;
}
