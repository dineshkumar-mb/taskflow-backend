const { z } = require('zod');

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const createMeetingSchema = z.object({
    title: z.string().min(2, 'Title must be at least 2 characters').max(200),
    description: z.string().max(1000).optional(),
    agenda: z.string().max(2000).optional(),
    scheduledAt: z.string().datetime({ message: 'Invalid ISO date-time string' }),
    projectId: z.string().regex(objectIdRegex, 'Invalid Project ID format'),
    sprintId: z.string().regex(objectIdRegex, 'Invalid Sprint ID format').nullable().optional(),
    participantIds: z.array(z.string().regex(objectIdRegex, 'Invalid Participant ID format')).min(1, 'At least one participant is required')
});

const endMeetingSchema = z.object({
    attendeeIds: z.array(z.string().regex(objectIdRegex, 'Invalid Attendee ID format')),
    transcriptSegments: z.array(z.object({
        timestamp: z.string().datetime().optional().or(z.date().optional()),
        speakerId: z.string().regex(objectIdRegex, 'Invalid Speaker ID format'),
        speakerName: z.string(),
        text: z.string(),
    }))
});

module.exports = {
    createMeetingSchema,
    endMeetingSchema,
};
