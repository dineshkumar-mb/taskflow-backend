const mongoose = require('mongoose');

module.exports = function softDeletePlugin(schema) {
    schema.add({
        deletedAt: { type: Date, default: null, index: true },
        deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
    });

    const excludeDeleted = function() {
        const currentQuery = this.getQuery();
        // If the query does not explicitly filter deletedAt, default to excluding deleted records
        if (currentQuery.deletedAt === undefined) {
            this.where({ deletedAt: null });
        }
    };

    schema.pre('find', excludeDeleted);
    schema.pre('findOne', excludeDeleted);
    schema.pre('findOneAndUpdate', excludeDeleted);
    schema.pre('countDocuments', excludeDeleted);

    schema.pre('aggregate', function() {
        // In aggregate, check if $match for deletedAt is already present in any stage
        const hasDeletedAtFilter = this.pipeline().some(stage => 
            stage.$match && (stage.$match.deletedAt !== undefined)
        );
        if (!hasDeletedAtFilter) {
            this.pipeline().unshift({ $match: { deletedAt: null } });
        }
    });

    schema.methods.softDelete = async function(userId) {
        this.deletedAt = new Date();
        this.deletedBy = userId;
        return this.save();
    };
};
