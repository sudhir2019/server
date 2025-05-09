const express = require("express");
const router = express.Router();
const {
    createPlayers,
    getAllPlayers,
    getPlayersById,
    updatePlayers,
    deletePlayers,
    creditTransfer,
    creditAdjust,
    getRoleCount,
    toggleUserStatus,
    loadcredit
} = require("../controllers/players.controller");
const { verifyToken } = require("../middlewares/authJwt");

router.get("/loadcredit/:id", loadcredit);
// ✅ Create a new Players (POST)
router.post("/create", createPlayers);

// ✅ Get all Playerss (GET)
router.get("/all", getAllPlayers);

// ✅ Get Players by ID (GET)
router.get("/:id", getPlayersById);

// ✅ Update an Players (PUT)
router.put("/:id", updatePlayers);

// ✅ Delete an Players (DELETE)
router.delete("/:id", deletePlayers);

// ✅ Credit Transfer (POST)
router.post("/credit-transfer", creditTransfer);

// ✅ Credit Adjustment (POST)
router.post("/credit-adjust", creditAdjust);

// ✅ Toggle Players Status (Activate/Deactivate) (PATCH)
router.patch("/toggle-status/:id/:action", toggleUserStatus);

// ✅ Get Role Count (GET) && GET role-based Players count
router.get("/role-count", getRoleCount);

module.exports = router;
