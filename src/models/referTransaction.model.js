const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ReferTransactionSchema = new Schema(
  {
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Reference to the User who referred
      required: true,
    },
    referredUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Reference to the referred user
      required: true,
    },
    commissionAmount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "paid", "cancelled"],
      default: "pending",
    },
    isDeleted: { type: Boolean, default: false }, // ✅ Soft delete support
    deletedAt: { type: Date, default: null }, // ✅ Stores deletion timestamp
  },
  { timestamps: true } // ✅ Automatically adds `createdAt` & `updatedAt`
);

// ✅ Middleware to update `updatedAt` before saving
ReferTransactionSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// ✅ Soft delete method
ReferTransactionSchema.methods.softDelete = async function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  await this.save();
};

// ✅ Restore soft-deleted record
ReferTransactionSchema.methods.restore = async function () {
  this.isDeleted = false;
  this.deletedAt = null;
  await this.save();
};

// ✅ Permanently delete record
ReferTransactionSchema.methods.permanentDelete = async function () {
  await this.deleteOne();
};

// ✅ Find only non-deleted transactions
ReferTransactionSchema.statics.findNonDeleted = function () {
  return this.find({ isDeleted: false });
};

// ✅ Find only soft-deleted transactions
ReferTransactionSchema.statics.findDeleted = function () {
  return this.find({ isDeleted: true });
};

const ReferTransaction = mongoose.model("ReferTransaction", ReferTransactionSchema);

module.exports = ReferTransaction;
