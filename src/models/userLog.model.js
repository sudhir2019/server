const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const UserLogSchema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    username: { type: String, required: true },
    email: { type: String, required: true },
    userRole: { type: String, required: true }, // Store user's role
    activity: { type: String, required: true }, // Description of the activity
    logType: {
      type: String,
      enum: ["Login Attempt", "Password Change", "Logout", "Login Successful", "not Requst"],
      required: true,
      default: "not Requst"
    },
    transactionType: {
      type: String,
      enum: ["transfer", "credit", "adjusted", "deposit", "withdrawal", "not Requst"],
      required: true,
      default: "not Requst"
    },
    referTransaction: {
      type: String,
      enum: ["transfer", "credit", "debit", "deposit", "withdrawal", "not Requst"],
      required: true,
      default: "not Requst"
    },
    // Log level
    requestUrl: { type: String, required: true }, // API endpoint
    method: { type: String, required: true }, // HTTP method (GET, POST, etc.)
    headers: { type: Object, default: {} },
    body: { type: Object, default: {} },
    params: { type: Object, default: {} },
    query: { type: Object, default: {} },
    subject: { type: String, required: true },
    ipAddress: { type: String, required: true },
    userAgent: { type: String, required: true },
    errorDetails: {
      errorCode: { type: String, default: null },
      message: { type: String, default: null },
    },
    isDeleted: { type: Boolean, default: false }, // ✅ Soft delete support
    deletedAt: { type: Date, default: null }, // ✅ Timestamp for deletion
    createdAt: { type: Date, default: Date.now, expires: "30d" }, // ✅ Auto-delete after 30 days
  },
  {
    timestamps: true, // ✅ Automatically manages createdAt & updatedAt
    versionKey: false, // ✅ Removes `__v` field
  }
);

// ✅ Pre-save middleware to update `updatedAt`
UserLogSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

// ✅ Soft delete method
UserLogSchema.methods.softDelete = async function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  await this.save();
};

// ✅ Restore soft-deleted log
UserLogSchema.methods.restore = async function () {
  this.isDeleted = false;
  this.deletedAt = null;
  await this.save();
};

// ✅ Permanently delete log
UserLogSchema.methods.permanentDelete = async function () {
  await this.deleteOne();
};

// ✅ Find only non-deleted logs
UserLogSchema.statics.findNonDeleted = function () {
  return this.find({ isDeleted: false });
};

// ✅ Find only soft-deleted logs
UserLogSchema.statics.findDeleted = function () {
  return this.find({ isDeleted: true });
};

// ✅ Create the UserLog model
const UserLog = mongoose.model("UserLog", UserLogSchema);

module.exports = UserLog;
