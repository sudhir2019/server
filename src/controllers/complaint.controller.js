const { Complaint } = require("../models/complaint.model");

// Create a new complaint
const createComplaint = async (req, res) => {
    try {
        const { enquiryType, fullName, email, mobile, complaintDetails } = req.body;

        const newComplaint = new Complaint({
            enquiryType,
            fullName,
            email,
            mobile,
            complaintDetails
            // status will be "Pending" by default
        });

        const savedComplaint = await newComplaint.save();
        return res.status(201).json({
            message: "Complaint submitted successfully.",
            complaint: savedComplaint
        });
    } catch (error) {
        console.error("Error creating complaint:", error);
        return res.status(500).json({ message: "Internal Server Error", error });
    }
};

// Get all complaints
const getAllComplaints = async (req, res) => {
    try {
        const complaints = await Complaint.find().sort({ createdAt: -1 });
        return res.status(200).json(complaints);
    } catch (error) {
        console.error("Error fetching complaints:", error);
        return res.status(500).json({ message: "Internal Server Error", error });
    }
};

// Get complaint by ID
const getComplaintById = async (req, res) => {
    try {
        const { id } = req.params;
        const complaint = await Complaint.findById(id);
        if (!complaint) {
            return res.status(404).json({ message: "Complaint not found" });
        }
        return res.status(200).json(complaint);
    } catch (error) {
        console.error("Error fetching complaint:", error);
        return res.status(500).json({ message: "Internal Server Error", error });
    }
};

// Delete complaint by ID
const deleteComplaintById = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedComplaint = await Complaint.findByIdAndDelete(id);
        if (!deletedComplaint) {
            return res.status(404).json({ message: "Complaint not found" });
        }
        return res.status(200).json({ message: "Complaint deleted successfully" });
    } catch (error) {
        console.error("Error deleting complaint:", error);
        return res.status(500).json({ message: "Internal Server Error", error });
    }
};

// Update complaint status (triggers deleteAt auto-set in model)
const updateComplaintStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!["Pending", "Completed", "Cancelled"].includes(status)) {
            return res.status(400).json({ message: "Invalid status value" });
        }

        const updatedComplaint = await Complaint.findByIdAndUpdate(
            id,
            { status },
            { new: true, runValidators: true }
        );

        if (!updatedComplaint) {
            return res.status(404).json({ message: "Complaint not found" });
        }

        // Return full updated list
        const allComplaints = await Complaint.find().sort({ createdAt: -1 });

        return res.status(200).json({
            message: "Complaint status updated successfully.",
            complaint: updatedComplaint,
            allComplaints, // 👈 add this
        });
    } catch (error) {
        console.error("Error updating status:", error);
        return res.status(500).json({ message: "Internal Server Error", error });
    }
};

module.exports = {
    createComplaint,
    getAllComplaints,
    getComplaintById,
    deleteComplaintById,
    updateComplaintStatus
};
