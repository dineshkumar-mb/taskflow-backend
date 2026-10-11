/**
 * Express 5 compatible NoSQL injection sanitizer.
 * Recursively removes any object keys that begin with '$' or contain '.'
 * without reassigning read-only request properties like req.query.
 */
function cleanNoSqlInjection(obj) {
    if (!obj || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            cleanNoSqlInjection(obj[i]);
        }
        return obj;
    }

    for (const key of Object.keys(obj)) {
        if (key.startsWith('$') || key.includes('.')) {
            delete obj[key];
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            cleanNoSqlInjection(obj[key]);
        }
    }
    return obj;
}

const sanitizeInput = (req, res, next) => {
    if (req.body) cleanNoSqlInjection(req.body);
    if (req.params) cleanNoSqlInjection(req.params);
    if (req.query) cleanNoSqlInjection(req.query);
    next();
};

module.exports = sanitizeInput;
