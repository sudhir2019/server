const express = require("express");
const router = express.Router();

const {
    createComplaint,
    getAllComplaints,
    getComplaintById,
    deleteComplaintById,
    updateComplaintStatus
} = require("../controllers/complaint.controller");

// 👉 Create a new complaint
router.post("/", createComplaint);

// 👉 Get all complaints
router.get("/", getAllComplaints);

// 👉 Get complaint by ID
router.get("/:id", getComplaintById);

// 👉 Delete complaint by ID
router.delete("/:id", deleteComplaintById);

// 👉 Update status of a complaint
router.patch("/:id/status", updateComplaintStatus);

module.exports = router;
