const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const { drawstatus } = require('../utils/drawstatus');

const drawmodel = new Schema({
    timeid: { type: Schema.Types.ObjectId, default: null, ref: "Result" },
    timeopen: { type: String, default: null },
    timeclose: { type: String, default: null },
    date: { type: Date, default: null },
    ticketid: { type: String },
    userid: { type: Schema.Types.ObjectId, ref: 'User' },
    drawno: { type: String, default: 0 },
    drawqty: { type: Number, default: 0 },
    drawtotal: { type: Number, default: 0 },  // Fixed this to Date.now
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
    label: { type: String, default: null },
    betok: { type: Boolean, default: false }
});

const Draw = mongoose.model("Draw", drawmodel);

module.exports = { Draw };