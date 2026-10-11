const { Queue } = require('bullmq');
const crypto = require('crypto');
const { createRedisConnection, isRedisAvailable } = require('../config/redis');

// Registry of BullMQ Queues
const queues = {};

// Queue names
const QUEUE_NAMES = {
    TRANSCRIPTION: 'transcription-queue',
    MOM: 'mom-queue',
    AI: 'ai-queue',
    EMAIL: 'email-queue',
    NOTIFICATION: 'notification-queue',
    WEBHOOK: 'webhook-queue',
};

// Standard retry backoff policy (Phase 7)
const DEFAULT_JOB_OPTIONS = {
    attempts: 4,
    backoff: {
        type: 'exponential',
        delay: 5000 // 5s, 30s, 2m, 10m
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 }
};

/**
 * Initializes BullMQ Queues with a dedicated Redis connection
 */
const initQueues = () => {
    try {
        const connection = createRedisConnection();

        for (const [key, name] of Object.entries(QUEUE_NAMES)) {
            queues[name] = new Queue(name, {
                connection,
                defaultJobOptions: DEFAULT_JOB_OPTIONS
            });
        }
        console.log('[QueueManager] BullMQ queues initialized successfully');
    } catch (err) {
        console.warn('[QueueManager] Could not initialize BullMQ queues, fallback active:', err.message);
    }
};

/**
 * Enqueues a job with full multi-tenant context (Phase 6)
 */
const enqueueJob = async (queueName, jobType, data, options = {}) => {
    const organizationId = data.organizationId || data.organization;
    if (!organizationId) {
        throw new Error(`Tenant context missing: cannot enqueue job '${jobType}' without organizationId`);
    }

    const jobPayload = {
        jobId: data.jobId || crypto.randomUUID(),
        organizationId: organizationId.toString(),
        userId: data.userId || data.requestedBy || null,
        resourceId: data.resourceId || data.meetingId || data.issueId || null,
        type: jobType,
        payload: data,
        createdAt: new Date().toISOString(),
        priority: options.priority || 'normal',
        status: 'QUEUED'
    };

    // 1. Try BullMQ Redis Queue if available
    if (isRedisAvailable() && queues[queueName]) {
        try {
            const job = await queues[queueName].add(jobType, jobPayload, {
                jobId: jobPayload.jobId,
                ...DEFAULT_JOB_OPTIONS,
                ...options
            });
            console.log(`[QueueManager] Job '${jobType}' enqueued to BullMQ (Job ID: ${job.id}, Org: ${organizationId})`);
            return {
                jobId: job.id,
                status: 'QUEUED',
                backend: 'bullmq'
            };
        } catch (err) {
            console.warn(`[QueueManager] Failed to add job to BullMQ, falling back:`, err.message);
        }
    }

    // 2. Direct asynchronous worker execution fallback (survives when Redis is not running locally)
    setImmediate(async () => {
        try {
            console.log(`[QueueManager Fallback] Processing '${jobType}' asynchronously (Job ID: ${jobPayload.jobId})`);
            const { processJobDirectly } = require('../workers/workerManager');
            await processJobDirectly(queueName, jobPayload);
        } catch (execErr) {
            console.error(`[QueueManager Fallback Error] Execution failed for '${jobType}':`, execErr.message);
        }
    });

    return {
        jobId: jobPayload.jobId,
        status: 'QUEUED',
        backend: 'local_async'
    };
};

module.exports = {
    initQueues,
    enqueueJob,
    QUEUE_NAMES,
    DEFAULT_JOB_OPTIONS
};
