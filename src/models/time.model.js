const mongoose = require("mongoose");

const Schema = mongoose.Schema

const timeSchema = new Schema({
    timecount: { type: Number, default: 60 }
});

// Create User model
const Time = mongoose.model("Time", timeSchema);

module.exports = { Time };