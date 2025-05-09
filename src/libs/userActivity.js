const UserLog = require("../models/userLog.model");
const { User } = require("../models/user.model");
require("dotenv").config({ path: ".env" });
const jwt = require("jsonwebtoken"); // Import the jwt library
const { getCookieValueByName } = require("../utils/getCookieValueByName");

/**
 * Logs user activity with minimal parameters, including optional error details.
 * @param {Object} req - The Express request object.
 * @param {String} userId - User ID associated with the log.
 * @param {String} activityType - The type or description of the activity.
 * @param {Error} [error] - Optional error object to include in the log.
 * @returns {Promise<void>} - Resolves when the log entry is saved.
 */
const logUserActivity = async (req, userId, subject, activityType, transactionType, referTransactionType, error = null) => {
  try {
    // Get client IP address
    const ipAddress = getClientIp(req);
    // Construct base activity description
    let activityDescription = `${req.method} ${req.originalUrl}`;
    switch (req.method) {
      case "POST":
        activityDescription += " - Created Resource";
        break;
      case "PUT":
        activityDescription += " - Updated Resource";
        break;
      case "DELETE":
        activityDescription += " - Deleted Resource";
        break;
      case "GET":
        activityDescription += " - Retrieved Data";
        break;
      default:
        activityDescription += " - General Activity";
    }

    const cookieToken = getCookieValueByName(req.cookies, process.env.SESSION_TOKEN);
    let username = "Unknown", email = "Unknown", userRole = "Unknown";

    if (userId) {
      const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } });
      if (user) {
        username = user.username || "Unknown";
        email = user.email || "Unknown";
        userRole = user.role || "Unknown";
      }
    }

    const logEntry = new UserLog({
      userId: userId || null,
      username,
      email,
      userRole,
      activity: activityDescription,
      logType: activityType || "not Requst",  // Added logType
      transactionType: transactionType || "not Requst",  // Added transactionType
      referTransaction: referTransactionType || "not Requst",  // Added referTransaction
      ipAddress,
      userAgent: req.get("User-Agent"),
      requestUrl: req.originalUrl,
      method: req.method,
      headers: req.headers,
      body: req.body,
      subject: subject || null,
      params: req.params,
      query: req.query,
      errorDetails: error ? {
        errorCode: error.code || "UNKNOWN_ERROR",
        message: error.message || error.toString(),
      } : null,
    });

    const savedLogEntry = await logEntry.save();

    // Link the log entry to the user
    await User.findByIdAndUpdate(userId, {
      $push: { userLogs: savedLogEntry._id },
    });
  } catch (loggingError) {
    // console.error("Failed to log user activity:", loggingError);
    // You can also handle errors here by responding with an error message if needed.
  }
};

const getClientIp = (req) => {
  let ipAddress = req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.headers["cf-connecting-ip"] || // Cloudflare
    req.headers["fastly-client-ip"] || // Fastly CDN
    req.headers["true-client-ip"] || // Akamai
    req.headers["x-real-ip"] || // Nginx proxy
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip;

  // Convert IPv6 "::1" (localhost) to "127.0.0.1"
  if (ipAddress === "::1" || ipAddress === "0.0.0.0") {
    ipAddress = "127.0.0.1";
  }

  return ipAddress;
}

module.exports = logUserActivity;
