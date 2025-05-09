const router = require("express").Router();

const {
  login,
  logout,
  getSession,
  getUserById
} = require("../controllers/auth.controller");




router.post("/login", login); // Login route

router.get("/session", getSession); // Get session information route

router.get("/logout", logout); // Logout route

router.get("/userauth/:id", getUserById); // Get user by ID route
module.exports = router;
