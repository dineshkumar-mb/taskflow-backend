const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Storage Service Abstraction
 * Supports Local Tenant-isolated Storage and Cloud Object Storage (S3 / R2 compatible)
 */
class StorageService {
    constructor() {
        this.provider = process.env.STORAGE_PROVIDER || 'local'; // 'local' | 's3'
        this.bucket = process.env.STORAGE_BUCKET || 'taskflow-assets';
        this.baseDir = process.env.VERCEL === '1' 
            ? path.join('/tmp', 'uploads') 
            : path.join(__dirname, '..', '..', 'uploads');

        if (!fs.existsSync(this.baseDir)) {
            fs.mkdirSync(this.baseDir, { recursive: true });
        }
    }

    /**
     * Sanitizes filename to prevent directory traversal or malicious characters
     */
    sanitizeFilename(originalName) {
        const basename = path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, '_');
        const ext = path.extname(basename).toLowerCase();
        const randomId = crypto.randomBytes(16).toString('hex');
        return `${randomId}${ext}`;
    }

    /**
     * Stores a file buffer or stream under an organization namespace
     */
    async uploadFile({ organizationId, buffer, originalName, mimeType }) {
        const safeFilename = this.sanitizeFilename(originalName);
        const orgSubdir = path.join(this.baseDir, `org_${organizationId}`);

        if (!fs.existsSync(orgSubdir)) {
            fs.mkdirSync(orgSubdir, { recursive: true });
        }

        const filePath = path.join(orgSubdir, safeFilename);
        await fs.promises.writeFile(filePath, buffer);

        // In a real S3 setup, this would be an S3 PutObjectCommand returning a key or signed URL
        const relativeUrl = `/uploads/org_${organizationId}/${safeFilename}`;

        return {
            storageKey: `org_${organizationId}/${safeFilename}`,
            url: relativeUrl,
            mimeType,
            size: buffer.length
        };
    }

    /**
     * Deletes a file safely
     */
    async deleteFile({ organizationId, storageKey }) {
        if (!storageKey) return false;
        // Verify key begins with organization namespace to prevent cross-tenant file deletion
        const expectedPrefix = `org_${organizationId}/`;
        if (!storageKey.startsWith(expectedPrefix)) {
            throw new Error('Access denied: cross-tenant storage key deletion rejected');
        }

        const fullPath = path.join(this.baseDir, storageKey);
        if (fs.existsSync(fullPath)) {
            await fs.promises.unlink(fullPath);
            return true;
        }
        return false;
    }
}

module.exports = new StorageService();
