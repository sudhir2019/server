const mongoose = require("mongoose");
const UserLog = require("../models/userLog.model");
const { User } = require("../models/user.model");


async function activityLogs(req, res) {
    try {
      const { id, date } = req.query;  // Extract the `id` and `date` from query parameters
      
      // Initialize the query object
      let query = {};
  
      // If an `id` is provided, filter based on the `userId`
      if (id) {
        query.userId = id;  // Assuming `userId` is a field in your UserLog model
      }
  
      // If a `date` is provided, filter based on the created date
      if (date) {
        const created_at = new Date(date);
        created_at.setHours(0, 0, 0, 0); // Set the time to midnight to avoid time issues
  
        // Use `$gte` and `$lt` to include logs for the entire day
        query.createdAt = {
          $gte: created_at,
          $lt: new Date(created_at.getTime() + 24 * 60 * 60 * 1000),  // Add 1 day to get to the next day
        };
      }
  
      // Query the UserLog collection using the built query object
      const logs = await UserLog.find(query)
        .populate("userId", "name email")  // Populate user details
        .exec();  // Execute the query
  
      return res.status(200).json({
        success: true,
        data: logs,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "An error occurred while fetching user logs.",
        error: error.message,
      });
    }
  }
  
module.exports = {
    activityLogs,

};
