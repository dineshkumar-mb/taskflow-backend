const { Worker } = require('bullmq');
const { createRedisConnection, isRedisAvailable } = require('../config/redis');
const { QUEUE_NAMES } = require('../queues/queueManager');
const Meeting = require('../models/Meeting');
const Transcript = require('../models/Transcript');
const Issue = require('../models/Issue');
const Activity = require('../models/Activity');
const issueService = require('../services/issue.service');
const notificationService = require('../services/notification.service');
const sendEmail = require('../utils/sendEmail');
const DistributedLock = require('../security/distributedLock');

// Dynamic worker instances
const activeWorkers = {};

/**
 * Handles Transcription Jobs
 */
const handleTranscriptionJob = async (jobPayload) => {
    const { organizationId, resourceId: meetingId, payload } = jobPayload;
    console.log(`[Transcription Worker] Processing meeting ${meetingId} for org ${organizationId}`);

    const meeting = await Meeting.findOne({ _id: meetingId, organizationId });
    if (!meeting) {
        throw new Error(`Meeting ${meetingId} not found for organization ${organizationId}`);
    }

    let transcript = await Transcript.findOne({ meetingId, organizationId });
    if (!transcript) {
        transcript = new Transcript({
            meetingId,
            organizationId,
            organization: organizationId,
            segments: []
        });
    }

    if (payload.segments && Array.isArray(payload.segments)) {
        transcript.segments = payload.segments;
        transcript.fullText = payload.segments.map(s => s.text).join(' ');
    } else if (payload.fullText) {
        transcript.fullText = payload.fullText;
    }

    await transcript.save();
    meeting.transcriptRaw = transcript.fullText || '';
    meeting.status = 'transcribed';
    await meeting.save();

    console.log(`[Transcription Worker] Completed transcription for meeting ${meetingId}`);

    // Auto-enqueue MOM generation if configured
    if (payload.autoGenerateMOM) {
        const { enqueueJob } = require('../queues/queueManager');
        await enqueueJob(QUEUE_NAMES.MOM, 'GENERATE_MOM', {
            organizationId,
            meetingId,
            userId: jobPayload.userId
        });
    }

    return { meetingId, transcriptLength: transcript.fullText?.length || 0 };
};

/**
 * Handles MOM (Minutes of Meeting) Generation Jobs
 */
const handleMomJob = async (jobPayload) => {
    const { organizationId, resourceId: meetingId } = jobPayload;
    console.log(`[MOM Worker] Generating MOM for meeting ${meetingId} (Org: ${organizationId})`);

    const meeting = await Meeting.findOne({ _id: meetingId, organizationId })
        .populate('participantIds', 'name email')
        .populate('hostId', 'name email');

    if (!meeting) {
        throw new Error(`Meeting ${meetingId} not found in org ${organizationId}`);
    }

    const rawText = meeting.transcriptRaw && meeting.transcriptRaw.trim()
        ? meeting.transcriptRaw
        : `Meeting Title: ${meeting.title}. Agenda: ${meeting.agenda || 'General project update and task sync'}.`;

    const participants = [];
    if (Array.isArray(meeting.participantIds)) {
        meeting.participantIds.forEach(p => {
            if (p && p._id) participants.push({ _id: p._id, name: p.name, email: p.email });
        });
    }
    if (meeting.hostId && meeting.hostId._id) {
        if (!participants.some(p => p._id.toString() === meeting.hostId._id.toString())) {
            participants.push({ _id: meeting.hostId._id, name: meeting.hostId.name, email: meeting.hostId.email });
        }
    }

    // Call AI to generate MOM
    const { generateMOMFromTranscript } = require('../controllers/meeting.controller');
    const momData = await generateMOMFromTranscript(rawText, meeting.agenda, participants);

    const hostObjId = meeting.hostId?._id || meeting.hostId;
    const hostName = meeting.hostId?.name || 'Host';

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

    // Log Activity
    try {
        await Activity.create({
            organizationId,
            projectId: meeting.projectId,
            user: jobPayload.userId || hostObjId,
            meetingId: meeting._id,
            type: 'mom_generated',
            metadata: {
                meetingTitle: meeting.title,
                momSummary: momData.summary,
                actionItemsCount: (momData.actionItems || []).length
            }
        });
    } catch (_) {}

    console.log(`[MOM Worker] MOM successfully generated and stored for meeting ${meetingId}`);
    return { meetingId, actionItemsCount: meeting.mom.actionItems.length };
};

/**
 * Handles Email Jobs
 */
const handleEmailJob = async (jobPayload) => {
    const { payload } = jobPayload;
    console.log(`[Email Worker] Sending email to ${payload.email} (Subject: ${payload.subject})`);
    await sendEmail({
        email: payload.email,
        subject: payload.subject,
        message: payload.message || '',
        html: payload.html || undefined
    });
    console.log(`[Email Worker] Successfully delivered email to ${payload.email}`);
    return { delivered: true, recipient: payload.email };
};

/**
 * Handles Notification Jobs
 */
const handleNotificationJob = async (jobPayload) => {
    const { payload } = jobPayload;
    console.log(`[Notification Worker] Creating notification for user ${payload.user}`);
    const notification = await notificationService.createNotification(payload, global.io);
    return { notificationId: notification?._id };
};

/**
 * Unified Job Router used by both BullMQ Workers and direct async fallback
 */
const processJobDirectly = async (queueName, jobPayload) => {
    switch (queueName) {
        case QUEUE_NAMES.TRANSCRIPTION:
            return await handleTranscriptionJob(jobPayload);
        case QUEUE_NAMES.MOM:
            return await handleMomJob(jobPayload);
        case QUEUE_NAMES.EMAIL:
            return await handleEmailJob(jobPayload);
        case QUEUE_NAMES.NOTIFICATION:
            return await handleNotificationJob(jobPayload);
        default:
            console.warn(`[WorkerManager] No handler defined for queue '${queueName}'`);
            return null;
    }
};

/**
 * Initializes BullMQ Worker instances if Redis is available
 */
const initWorkers = () => {
    if (!isRedisAvailable()) {
        console.log('[WorkerManager] Redis offline: workers running in resilient direct-async mode.');
        return;
    }

    try {
        const queueConfigs = [
            { name: QUEUE_NAMES.TRANSCRIPTION, handler: handleTranscriptionJob, concurrency: 2 },
            { name: QUEUE_NAMES.MOM, handler: handleMomJob, concurrency: 3 },
            { name: QUEUE_NAMES.EMAIL, handler: handleEmailJob, concurrency: 5 },
            { name: QUEUE_NAMES.NOTIFICATION, handler: handleNotificationJob, concurrency: 10 },
        ];

        for (const config of queueConfigs) {
            const connection = createRedisConnection();
            const worker = new Worker(config.name, async (job) => {
                return await config.handler(job.data);
            }, {
                connection,
                concurrency: config.concurrency,
                removeOnComplete: { count: 1000 },
                removeOnFail: { count: 5000 }
            });

            worker.on('completed', (job) => {
                console.log(`[Worker - ${config.name}] Job ${job.id} completed successfully`);
            });

            worker.on('failed', (job, err) => {
                console.error(`[Worker - ${config.name}] Job ${job?.id} failed:`, err.message);
            });

            activeWorkers[config.name] = worker;
        }

        console.log('[WorkerManager] All BullMQ workers successfully initialized');
    } catch (err) {
        console.warn('[WorkerManager] Failed to start BullMQ workers:', err.message);
    }
};

/**
 * Graceful Worker Shutdown (Phase 57)
 */
const shutdownWorkers = async () => {
    console.log('[WorkerManager] Gracefully stopping all active workers...');
    const shutdownPromises = Object.values(activeWorkers).map(worker => worker.close());
    await Promise.allSettled(shutdownPromises);
    console.log('[WorkerManager] All workers closed cleanly');
};

module.exports = {
    initWorkers,
    shutdownWorkers,
    processJobDirectly
};
