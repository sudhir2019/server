const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const UserTransactionSchema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Reference to the sender user
      required: true,
    },
    toUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Reference to the receiver user
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    transactionType: {
      type: String,
      enum: ["transfer", "credit", "debit", "deposit", "withdrawal"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },
    transactionMessage: {
      type: String,
      default: "No message provided.",
    },
    isDeleted: { type: Boolean, default: false }, // ✅ Soft delete support
    deletedAt: { type: Date, default: null }, // ✅ Stores deletion timestamp
  },
  {
    timestamps: true, // ✅ Automatically adds `createdAt` and `updatedAt`
    strict: true, // ✅ Ensures only defined fields are stored
  }
);

// ✅ Soft delete method
UserTransactionSchema.methods.softDelete = async function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  await this.save();
};

// ✅ Restore soft-deleted record
UserTransactionSchema.methods.restore = async function () {
  this.isDeleted = false;
  this.deletedAt = null;
  await this.save();
};

// ✅ Permanently delete record
UserTransactionSchema.methods.permanentDelete = async function () {
  await this.deleteOne();
};

// ✅ Find only non-deleted transactions
UserTransactionSchema.statics.findNonDeleted = function () {
  return this.find({ isDeleted: false });
};

// ✅ Find only soft-deleted transactions
UserTransactionSchema.statics.findDeleted = function () {
  return this.find({ isDeleted: true });
};

// ✅ Add indexes for performance
UserTransactionSchema.index({ userId: 1 });
UserTransactionSchema.index({ toUserId: 1 });
UserTransactionSchema.index({ status: 1 });
UserTransactionSchema.index({ transactionType: 1 });

const UserTransaction = mongoose.model("UserTransaction", UserTransactionSchema);

module.exports = UserTransaction;
