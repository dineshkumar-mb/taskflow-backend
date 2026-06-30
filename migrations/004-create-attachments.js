const Issue = require('../src/models/Issue');
const Attachment = require('../src/models/Attachment');
const path = require('path');

const up = async () => {
    console.log('[Migration 004] Migrating legacy issue attachments to Attachment collection...');
    
    const issues = await Issue.find({ attachments: { $exists: true, $not: { $size: 0 } } });
    for (const issue of issues) {
        for (const fileUrl of issue.attachments) {
            if (!fileUrl) continue;
            
            // Check if this URL is already migrated
            const exists = await Attachment.findOne({
                organization: issue.organization,
                path: fileUrl
            });

            if (!exists) {
                const fileName = path.basename(fileUrl) || 'attachment';
                await Attachment.create({
                    organization: issue.organization,
                    uploadedBy: issue.reporter || issue.createdBy || null,
                    fileName: fileName,
                    mimeType: 'application/octet-stream', // Fallback
                    size: 1024 * 100, // Default 100kb mock size for old attachments
                    path: fileUrl,
                    createdBy: issue.reporter || null,
                    updatedBy: issue.reporter || null
                });
                console.log(`[Migration 004] Created Attachment metadata for file: ${fileName}`);
            }
        }
    }

    console.log('[Migration 004] Completed successfully.');
};

const down = async () => {
    console.log('[Migration 004] Rollback not implemented.');
};

module.exports = { up, down };
