const validate = (schema) => (req, res, next) => {
    try {
        schema.parse(req.body);
        next();
    } catch (err) {
        return res.status(400).json({
            message: 'Validation Error',
            errors: err.errors.map((e) => e.message),
        });
    }
};

module.exports = validate;
