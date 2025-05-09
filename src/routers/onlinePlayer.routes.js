const express = require("express");
const router = express.Router();
const { getUserStats } = require("../controllers/onlineUser.controller");

router.get("/", getUserStats);

module.exports = router;