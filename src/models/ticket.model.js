const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const { drawstatus } = require('../utils/drawstatus');




const ticketmodel = new Schema({
    timeid: { type: String, ref: 'Time' },
    timeopen: { type: String, default: null },
    timeclose: { type: String, default: null },
    date: { type: Date, default: null },
    ticketid: { type: String, default: null },
    userid: { type: Schema.Types.ObjectId, ref: 'User' },
    playpoints: { type: Number, default: 0 },
    winpoints: { type: Number, default: 0 },
    claimdate: { type: Date, default: Date.now },  // Fixed this to Date.now
    status: { type: Number, default: drawstatus.PENDING }, // Using enum for status
    created_at: {
        type: Date,
        default: Date.now,
    },
    isDeleted: {
        type: Boolean,
        default: false,
    },
    updated_at: {
        type: Date,
        default: Date.now,
    },
    gameid: { type: String, default: 0 },
    adminid: { type: Schema.Types.ObjectId, ref: 'User' },
    result: { type: Schema.Types.ObjectId, ref: 'Result', default: null },
});

const Ticket = mongoose.model("Ticket", ticketmodel);

module.exports = { Ticket };