const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const percentageSchema = new Schema({
    gameId: { type: String, ref: 'Game' }, // ✅ Now correctly references the Game model
    winpercentage: { type: Number, default: 100 },
    adminId: { type: Schema.Types.ObjectId, ref: 'User' }, // ✅ Ensures correct referencing
    nextDrawNo: { type: Number, default: null },
    isDeleted: { type: Boolean, default: false }, // ✅ Soft delete support
    deletedAt: { type: Date, default: null },
    gameBalance: { type: Number, default: 0 }
}, { timestamps: true });

// ✅ Soft delete method
percentageSchema.methods.softDelete = async function () {
    this.isDeleted = true;
    this.deletedAt = new Date();
    await this.save();
};

// ✅ Restore soft-deleted record
percentageSchema.methods.restore = async function () {
    this.isDeleted = false;
    this.deletedAt = null;
    await this.save();
};

// ✅ Permanently delete record
percentageSchema.methods.permanentDelete = async function () {
    await this.deleteOne();
};

// ✅ Get all active (non-deleted) percentages
percentageSchema.statics.findNonDeleted = function () {
    return this.find({ isDeleted: false });
};

// ✅ Get all deleted percentages
percentageSchema.statics.findDeleted = function () {
    return this.find({ isDeleted: true });
};

const Percentage = mongoose.model("Percentage", percentageSchema);

module.exports = Percentage;
