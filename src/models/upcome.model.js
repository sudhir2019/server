const mongoose = require("mongoose");

const Schema = mongoose.Schema;


const upcomeSchema = new Schema({
    adminId: { type: Schema.Types.ObjectId, ref: "User" },
    gameId: { type: String, default: null },
    drawno: { type: String, default: null },
    color: { type: String, default: null },
    type: { type: String, default: null },
    booster: { type: Number, default: 1 },
    status: { type: Number, deafult: 0 }
})

const Upcome = mongoose.model("Upcome", upcomeSchema);

module.exports = Upcome;
