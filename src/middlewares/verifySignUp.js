const { User } = require("../models/user.model");

const checkDuplicatedEmail = async (req, res, next) => {
  try {
    // Check if the email exists in the User collection
    const username = await User.findOne({ username: req.body.username });
    if (username)
      return res.status(400).json({ message: "The username already exists" });

    // Proceed to the next middleware/handler
    next();
  } catch (error) {
    // Handle errors and return a 500 response if something goes wrong
    res
      .status(500)
      .json({ success: false, message: "Something went wrong, signup failed" });
  }
};

const checkRolesExisted = (req, res, next) => {
  if (req.body.roles) {
    const rolesToCheck = Array.isArray(req.body.roles)
      ? req.body.roles
      : [req.body.roles]; // Convert to an array if it's a string

    for (let i = 0; i < rolesToCheck.length; i++) {
      if (!ROLES.includes(rolesToCheck[i])) {
        return res.status(400).json({
          message: `Role ${rolesToCheck[i]} does not exist`,
        });
      }
    }
  }
  next();
};

module.exports = { checkDuplicatedEmail, checkRolesExisted };
