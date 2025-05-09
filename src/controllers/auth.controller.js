const { User } = require("../models/user.model");
require("dotenv").config({ path: ".env" });
const jwt = require("jsonwebtoken");
const { getCookieValueByName } = require("../utils/getCookieValueByName");
const logUserActivity = require("../libs/userActivity");
let expiryKey = process.env.EXPIRY_KEY;


// User login function
async function login(req, res) {
  try {
    const { username, password } = req.body;

    // Allowed roles
    const roles = ['superadmin', 'admin', 'superareamanager', 'areamanager', 'master', 'player','otc','gift','loan'];

    // Find user by username
    let userFound = await User.findOne({ username }).exec();
    if (!userFound) {
      return res.status(404).json({ message: "User Not Found" });
    }

    // Check if the user's role is valid
    if (!roles.includes(userFound.role)) {
      return res.status(403).json({ message: "User's role is not authorized" });
    }

    // ✅ Check if input matches PIN, Password, or PIN+Password
    const matchPin = await userFound.comparePin(Number(password)); // PIN entered
    const matchPassword = await userFound.comparePassword(password); // Password
    const matchPinPassword = await userFound.comparePinPassword(password); // PIN+Password

    if (matchPin || matchPassword || matchPinPassword) {
      // ✅ Login success, update last login status
   //   await userFound.login();
      await logUserActivity(req, userFound._id, "Login Successful", "User logged in", "not Request", "not Request", null);

      const oneDayInSeconds = 86400;
      const token = jwt.sign({ id: userFound._id }, process.env.JWT_SECRET_KEY, {
        expiresIn: oneDayInSeconds,
      });


      res.cookie(process.env.SESSION_TOKEN, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", // Only use secure in production
        partitioned: true,
        sameSite: "Strict",
        maxAge: oneDayInSeconds * 1000,
        priority: "high",
      });

      return res.status(200).json({
        success:"true",
        message: "Login successful",
        roles: userFound.role,
        user: userFound,
      });
    } else {
      return res.status(401).json({ message: "Invalid Credentials" });
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

// Get session function
async function getSession(req, res) {
  try {
    // Extract session token from cookies, headers, or query params
    let cookieToken =
      getCookieValueByName(req.cookies, process.env.SESSION_TOKEN || "session-token") ||
      req.headers.authorization?.split("Bearer ")[1] ||
      req.query.token;

    // console.log("Extracted Token:", cookieToken);

    if (!cookieToken) {
      return res.status(404).json({
        successful: false,
        message: "No session token was found",
      });
    }

    // Validate JWT format
    if (cookieToken.split(".").length !== 3) {
      return res.status(400).json({
        successful: false,
        message: "Invalid token format",
      });
    }

    // Verify the token
    let decoded;
    try {
      decoded = jwt.verify(cookieToken, process.env.JWT_SECRET_KEY);
    } catch (error) {
      // console.error("JWT Verification Error:", error);
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({ successful: false, message: "Token expired" });
      } else {
        return res.status(401).json({ successful: false, message: "Invalid token" });
      }
    }

    // console.log("Decoded Token:", decoded);

    // Find user (excluding deleted users and password field)
    const user = await User.findOne(
      { _id: decoded.id, isDeleted: { $ne: true } },
      { password: 0 }
    ).exec();

    // Find super admin (excluding deleted users and password field)
    const superAdmin = await User.findOne(
      { _id: decoded.id, isDeleted: { $ne: true } },
      { password: 0 }
    )

      .exec();

    // Determine the logged-in user
    let onlineUser = user || superAdmin;

    if (!onlineUser) {
      return res.status(404).json({ successful: false, message: "No user found" });
    }

    // Log user activity
    await logUserActivity(req, onlineUser._id, "Session Retrieved", "Session Retrieved Successfully", "not Requst", "not Requst", null);

    // Return user session data
    return res.status(200).json({ successful: true, user: onlineUser, token: cookieToken });
  } catch (error) {
    // console.error("Session retrieval error:", error);
    return res.status(500).json({ successful: false, message: "Internal server error" });
  }
}

async function logout(req, res) {
  try {
    const sessionToken = req.cookies[process.env?.SESSION_TOKEN || "session-token"];
    
   
  const { id } = req.query;

    // const updatedUser = await User.findOneAndUpdate(
    //   { _id: id },
    //   { isLoggedIn: false },
    //   { new: true }
    // );




    if (!sessionToken) {
      return res.status(400).json({ success: false, message: "Please login first." });
    }

    let decoded;
    try {
      decoded = jwt.verify(sessionToken, process.env.JWT_SECRET_KEY);
    } catch (err) {
      return res.status(401).json({ success: false, message: "Invalid session token." });
    }

    if (!decoded.id || !mongoose.Types.ObjectId.isValid(decoded.id)) {
      return res.status(400).json({ success: false, message: "Invalid user ID in token." });
    }

    const userId = decoded.id;
    const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } });

    
      user.isLoggedIn = false;
      await user.save();
    
    
    
   

    await logUserActivity(req, userId, "Logout Attempt Successful", "Logout Successful", "not Requst", "not Requst", null);

    res.clearCookie(process.env.SESSION_TOKEN);

    return res.status(200).json({ success: true, message: "User logged out successfully." });
  } catch (error) {
    // console.error("Logout error:", error);
    return res.status(500).json({ success: false, message: "An error occurred during logout." });
  }
}

//Get By ID anyUser
async function getUserById(req, res) {
  try {
    const userId = req.params.id;
    const user = await User.findOne({ _id: userId, isDeleted: false })
      .populate("refId")
      .populate("parentId")
      .populate("subordinates",)
      .populate("games")
      .exec();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    // console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  login,
  getSession,
  logout,
  getUserById
};
