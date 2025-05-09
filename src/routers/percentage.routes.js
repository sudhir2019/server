const express = require("express");
const router = express.Router();
const { updateWinpercentageById, updateWinpercentageBulk, loadGamesByAdmin } = require("../controllers/percentage.controller");

// Update win percentage by id
// router.put("/:id/winpercentage", updateWinpercentageById);

// Update win percentage bulk

router.put("/bulk/winpercentage/:id", updateWinpercentageBulk);

// Load games by admin
router.get("/usergames/:id", loadGamesByAdmin);

module.exports = router;