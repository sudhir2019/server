const jwt = require("jsonwebtoken");
const { User } = require("../models/user.model");

// Middleware to verify the user's token
async function verifyToken(req, res, next) {
  try {
    let token;

    // ✅ Ensure Authorization Header Exists
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1]; // Extract token
    }

    // ✅ If no token is found, return an error
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    // console.log("Received Token:", token); // Debugging

    // ✅ Verify and decode the JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

    // ✅ Check if the user exists
    let userAuth = await User.findById(decoded.id, { password: 0 });

    if (!userAuth) {
      return res.status(404).json({ message: "User not found or token expired" });
    }
    // ✅ Store user object in `req.userAuth`
    req.userAuth = userAuth;
    next();
  } catch (err) {
    console.error("Token verification error:", err);

    // ✅ Handle specific JWT errors
    if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: "Token has expired" });
    } else if (err instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: "Invalid token" });
    }

    return res.status(401).json({ message: "Unauthorized" });
  }
}

module.exports = { verifyToken };
