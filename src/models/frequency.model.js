const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const frequency = new Schema({
    gameid: { type: String, default: 0 },
    adminid: { type: Schema.Types.ObjectId, ref: 'User' },
    fcount: { type: Number, default: 0 },
});

const Frequency = mongoose.model("Frequency", frequency);

module.exports = { Frequency };