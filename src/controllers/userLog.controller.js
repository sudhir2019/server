const mongoose = require("mongoose");
const UserLog = require("../models/userLog.model");
const { User } = require("../models/user.model");

/**
 * Controller to get all user logs
 */


async function getAllUserLogs(req, res) {
  try {
    const {
      search,
      logType,
      ipAddress,
      userAgent,
      startDate,
      endDate
    } = req.query;

    const currentUser = req.user; // Assume middleware attaches authenticated user
    const query = {};

    // 🔹 Search filter (case-insensitive)
    if (search) {
      const regex = new RegExp(search, "i");
      query.$or = [
        { activity: regex },
        { logType: regex },
        { ipAddress: regex },
        { userAgent: regex }
      ];
    }

    // 🔹 Direct filters
    if (logType) query.logType = logType;
    if (ipAddress) query.ipAddress = ipAddress;
    if (userAgent) query.userAgent = userAgent;

    // 🔹 Date range filtering
    if (startDate || endDate) {
      query.created_at = {};
      if (startDate) query.created_at.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.created_at.$lte = end;
      }
    }

    // 🔹 Fetch logs
    const logs = await UserLog.find(query)
      .populate("userId")
      .sort({ created_at: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: logs
    });

  } catch (error) {
    console.error("Error fetching user logs:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching user logs."
    });
  }
}


/**
 * Controller to log user activity
 */
async function logUserActivity(req, res) {
  const { userId, activity, logType, errorDetails } = req.body;

  try {
    // Validate input
    if (!activity || !logType) {
      return res.status(400).json({
        success: false,
        message: "Activity and logType are required.",
      });
    }

    // Optional: Validate user existence if userId is provided
    if (userId && !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId format.",
      });
    }

    if (userId) {
      const userExists = await User.exists({ _id: userId });
      if (!userExists) {
        return res.status(404).json({
          success: false,
          message: "User not found.",
        });
      }
    }

    // Create and save the log entry
    const logEntry = new UserLog({
      userId: userId || null,
      activity,
      logType,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get("User-Agent"),
      errorDetails: errorDetails || null,
    });

    await logEntry.save();

    return res.status(201).json({
      success: true,
      message: "User activity logged successfully.",
      data: logEntry,
    });
  } catch (error) {
    console.error("Error logging user activity:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while logging user activity.",
    });
  }
}

/**
 * Controller to get user logs by userId
 */
async function getUserLogsByUserId(req, res) {
  const userId = req.params.userId?.replace(/^:/, "");

  try {
    // Validate userId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId format.",
      });
    }

    const logs = await UserLog.find({ userId })
      .populate("userId", "name email")
      .sort({ created_at: -1 });

    if (!logs.length) {
      return res.status(404).json({
        success: false,
        message: "No logs found for the specified user.",
      });
    }

    return res.status(200).json({
      success: true,
      data: logs,
    });
  } catch (error) {
    console.error("Error fetching user logs for userId:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching user logs.",
    });
  }
}

/**
 * Controller to get user log by logId
 */
async function getUserLogById(req, res) {
  const logId = req.params.logId?.replace(/^:/, "");
  try {
    // Validate logId format
    if (!mongoose.Types.ObjectId.isValid(logId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid logId format.",
      });
    }

    const log = await UserLog.findById(logId).populate("userId", "name email");

    if (!log) {
      return res.status(404).json({
        success: false,
        message: "Log not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: log,
    });
  } catch (error) {
    console.error("Error fetching user log by logId:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching the user log.",
    });
  }
}

module.exports = {
  logUserActivity,
  getAllUserLogs,
  getUserLogsByUserId,
  getUserLogById,
};
