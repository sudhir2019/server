const express = require("express");
const router = express.Router();
const {
    createGift,
    getAllGifts,
    getGiftById,
    updateGift,
    deleteGift,
    creditTransfer,
    creditAdjust,
    toggleUserStatus,
    getRoleCount,
    loadcredit
} = require("../controllers/gift.controller");

router.get("/loadcredit/:id", loadcredit);

// ✅ Create a new Players (POST)
router.post("/create",createGift);

// ✅ Get all Playerss (GET)
router.get("/all", getAllGifts);

// ✅ Get Players by ID (GET)
router.get("/:id", getGiftById);

// ✅ Update an Players (PUT)
router.put("/:id", updateGift);

// ✅ Delete an Players (DELETE)
router.delete("/:id", deleteGift);

// ✅ Credit Transfer (POST)
router.post("/credit-transfer", creditTransfer);

// ✅ Credit Adjustment (POST)
router.post("/credit-adjust", creditAdjust);

// ✅ Toggle Players Status (Activate/Deactivate) (PATCH)
router.patch("/toggle-status/:id/:action", toggleUserStatus);

// ✅ Get Role Count (GET) && GET role-based Players count
router.get("/role-count", getRoleCount);

module.exports = router;
