const mongoose = require('mongoose');

const Schema = mongoose.Schema;


const userBalanceModel = new Schema({
    winBalance: { type: Number, default: 0 },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    gameId: { type: String, default: 0 },
    adminId:{ type: Schema.Types.ObjectId, ref: 'User' },
});

const UserBalance = mongoose.model("UserBalance", userBalanceModel);

module.exports = UserBalance;