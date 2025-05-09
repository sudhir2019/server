const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const { drawstatus } = require('../utils/drawstatus');


const values = [5, 10, 15];


const resultModel = new Schema({
    timeid: { type: Schema.Types.ObjectId, ref: "Time" },
    timeopen: { type: String, default: null },
    timeclose: { type: String, default: null },
    date: { type: Date, default: null },
    drawno: { type: String, default: null },
    color:{ type: String, default: null },
    joker:{ type: String, default: null },
    type:{ type: String, default: null },
    booster:{ type: Number, default: 1 },
    status: { type: Number, default: drawstatus.PENDING }, // Using enum for status
    created_at: {
        type: Date,
        default: Date.now,
    },
    updated_at: {
        type: Date,
        default: Date.now,
    },
    gameid: { type: String, default: 0 },
    adminid: { type: Schema.Types.ObjectId, ref: 'User' },
      randomValues: {
        type: Number,
        default: () => values[Math.floor(Math.random() * values.length)]
      }
});

const Result = mongoose.model("Result", resultModel);

module.exports = Result;