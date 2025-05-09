const express = require("express");
const router = express.Router();
const {
    createOtc,
    getAllOtcs,
    getOtcById,
    updateOtc,
    deleteOtc,
    creditTransfer,
    creditAdjust,
    toggleUserStatus,
    getRoleCount,
    loadcredit
} = require("../controllers/otc.controller");


router.get("/loadcredit/:id", loadcredit);

// ✅ Create a new Players (POST)
router.post("/create", createOtc);

// ✅ Get all Playerss (GET)
router.get("/all", getAllOtcs);

// ✅ Get Players by ID (GET)
router.get("/:id", getOtcById);

// ✅ Update an Players (PUT)
router.put("/:id", updateOtc);

// ✅ Delete an Players (DELETE)
router.delete("/:id", deleteOtc);

// ✅ Credit Transfer (POST)
router.post("/credit-transfer", creditTransfer);

// ✅ Credit Adjustment (POST)
router.post("/credit-adjust", creditAdjust);

// ✅ Toggle Players Status (Activate/Deactivate) (PATCH)
router.patch("/toggle-status/:id/:action", toggleUserStatus);

// ✅ Get Role Count (GET) && GET role-based Players count
router.get("/role-count", getRoleCount);

module.exports = router;