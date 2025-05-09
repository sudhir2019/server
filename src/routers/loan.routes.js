const express = require("express");
const router = express.Router();
const {
    createLoan,
    getAllLoans,
    getLoanById,
    updateLoan,
    deleteLoan,
    creditTransfer,
    creditAdjust,
    toggleUserStatus,
    getRoleCount,
    loadcredit
} = require("../controllers/loan.controller");


router.get("/loadcredit/:id", loadcredit);

// ✅ Create a new Players (POST)
router.post("/create",createLoan);

// ✅ Get all Playerss (GET)
router.get("/all", getAllLoans);

// ✅ Get Players by ID (GET)
router.get("/:id", getLoanById);

// ✅ Update an Players (PUT)
router.put("/:id", updateLoan);

// ✅ Delete an Players (DELETE)
router.delete("/:id", deleteLoan);

// ✅ Credit Transfer (POST)
router.post("/credit-transfer", creditTransfer);

// ✅ Credit Adjustment (POST)
router.post("/credit-adjust", creditAdjust);

// ✅ Toggle Players Status (Activate/Deactivate) (PATCH)
router.patch("/toggle-status/:id/:action", toggleUserStatus);

// ✅ Get Role Count (GET) && GET role-based Players count
router.get("/role-count", getRoleCount);

module.exports = router;