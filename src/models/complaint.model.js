const mongoose = require("mongoose");

const ComplaintSchema = new mongoose.Schema({
    enquiryType:{
        type: String,
        required: true,
        trim: true
    },
    fullName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    mobile: {
        type: String,
        required: true,
        trim: true,
        match: [/^\d{10}$/, "Invalid mobile number"]
    },
    complaintDetails: {
        type: String,
        required: true,
        trim: true
    },
    captcha: {
        type: String,
        required: true
    },
}, { timestamps: true }); // Automatically adds `createdAt` and `updatedAt` fields



const Complaint = mongoose.model("Complaint", ComplaintSchema);

module.exports = { Complaint }