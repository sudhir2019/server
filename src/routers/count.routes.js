const express = require("express");
const countController = require("../controllers/count.controller");  // Adjust path if needed
const router = express.Router();

// Define the route
router.get("/usercount", countController.counusers);  // Route that calls counusers function

module.exports = router;
