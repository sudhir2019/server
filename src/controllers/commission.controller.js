const { Ticket } = require('../models/ticket.model'); // Corrected import
const { Draw } = require('../models/draw.model'); // Corrected import
const drawstatus = require('../utils/drawstatus');
const { User } = require('../models/user.model');
const Percentage = require('../models/percentage.model');
const Game = require('../models/game.model');
const logUserActivity = require('../libs/userActivity');
const jwt = require("jsonwebtoken");
const { default: mongoose } = require('mongoose');
const Result = require('../models/result.models');
const UserTransaction = require('../models/userTransaction.model');
const UserBalance = require('../models/userbalance.model');
const moment = require("moment-timezone");

const timezone = "Asia/Kolkata";
async function sendcommission(req, res) {
    try {

        const fromDate = moment.tz(timezone).subtract(1, 'day').startOf('day');
        const toDate = moment.tz(timezone).subtract(1, 'day').endOf('day');

        // const fromDate = moment.tz(timezone).startOf('day');
        // const toDate = moment.tz(timezone).endOf('day');

        // console.log("IST Previous Day Start:", fromDate.format());
        // console.log("IST Previous Day End:", toDate.format());

        // Convert to JavaScript Date if needed:
        const fromDateJS = fromDate.toDate();
        const toDateJS = toDate.toDate();


        const roles = ["admin", "superareamanager", "areamanager", "master"];
        const usersById = await User.find({
            role: { $in: roles }
        }).sort({ _id: 1 });  // Sort by _id in ascending order

        // console.log(usersById);


        const commissionData = await Promise.all(
            usersById.map(async (user) => {
                const revenue = await findProfitFromDownline(user._id, user.role, fromDate, toDate);
                let profit = 0;
                if (user.role === "admin") {
                    profit = parseFloat(parseFloat(revenue).toFixed(2));
                } else {
                    profit = parseFloat((revenue * user.commission / 100).toFixed(2));
                }
                await sendCommissionToWallet(user.username, "GK00500055", profit);
                return {
                    userId: user._id,
                    username: user.username,
                    role: user.role,
                    commissionRate: user.commission,
                    revenue: revenue,
                    profit: profit
                };
            })
        );

        res.status(200).send({
            status: true,
            message: "Commission distribution completed successfully.",
            commissionData
        });

    } catch (error) {
        console.error("Error sending commission:", error);
        res.status(500).send({ status: false, message: "Internal server error" });
    }
}




async function findProfitFromDownline(userId, role, fromDate, toDate) {
    // console.log(role);
    let revenue = 0;
    if (role === "admin") {
        const superManagers = await User.find({ refId: userId });

        for (const superManager of superManagers) {
            const areaManagers = await User.find({ refId: superManager._id });

            for (const areaManager of areaManagers) {
                const masters = await User.find({ refId: areaManager._id });

                for (const master of masters) {
                    const players = await User.find({ refId: master._id });

                    let downlineProfit = 0;
                    for (const player of players) {
                        downlineProfit += await findTotal(player._id, fromDate, toDate);
                    }

                    const masterCommission = master.commission || 0;
                    const areaCommission = areaManager.commission || 0;
                    const superCommission = superManager.commission || 0;

                    const masterProfit = downlineProfit * (masterCommission / 100);
                    const areaProfit = masterProfit * (areaCommission / 100);
                    const superProfit = areaProfit * (superCommission / 100);

                    const adminProfit = downlineProfit - (masterProfit + areaProfit + superProfit);
                    revenue += adminProfit;
                }
            }
        }
    }

    else if (role === "superareamanager") {
        const areaManagers = await User.find({ refId: userId });

        for (const areaManager of areaManagers) {
            const masters = await User.find({ refId: areaManager._id });

            for (const master of masters) {
                const players = await User.find({ refId: master._id });

                let downlineProfit = 0;
                for (const player of players) {
                    downlineProfit += await findTotal(player._id, fromDate, toDate);
                }

                const masterCommission = master.commission || 0;
                const areaCommission = areaManager.commission || 0;

                const masterProfit = downlineProfit * (masterCommission / 100);
                const areaProfit = masterProfit * (areaCommission / 100);

                revenue += areaProfit;
            }
        }
    }
    else if (role === "areamanager") {
        const masters = await User.find({ refId: userId });

        for (const master of masters) {
            const players = await User.find({ refId: master._id });

            let downlineProfit = 0;
            for (const player of players) {
                downlineProfit += await findTotal(player._id, fromDate, toDate);
            }

            const masterCommission = master.commission || 0;
            const masterProfit = downlineProfit * (masterCommission / 100);

            revenue += masterProfit;
        }
    }

    else if (role === "master") {
        const players = await User.find({ 'refId': new mongoose.Types.ObjectId(userId) });

        let downlineProfit = 0;
        for (const player of players) {
            downlineProfit += await findTotal(player._id, fromDate, toDate);

        }

        revenue += downlineProfit;
    }

    return revenue;
}

async function findTotal(userId, fromDate, toDate) {
    const result = await Ticket.aggregate([
        {
            $match: {
                date: { $gte: new Date(fromDate), $lte: new Date(toDate) },
                userid: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $group: {
                _id: null,
                playpoints: { $sum: { $ifNull: ["$playpoints", 0] } },
                winpoints: { $sum: { $ifNull: ["$winpoints", 0] } }
            }
        }
    ]);

    if (!result || result.length === 0) return 0; // Return 1 if no tickets found

    const { playpoints, winpoints } = result[0];
    const diff = playpoints - winpoints;

    return diff > 0 ? diff : 0; // Ensure a positive value is returned
}

async function sendCommissionToWallet(toUserId, userId, profit) {
    try {
        // Check if profit is zero or less
        if (profit <= 0) {
            return { success: false, error: "Profit is zero or negative, no transaction made." };
        }

        const receiverUser = await User.findOne({ username: toUserId }).exec();
        if (!receiverUser) return { success: false, error: "Receiver not found" };

        const senderUser = await User.findOne({ username: userId }).exec();
        if (!senderUser) return { success: false, error: "Sender not found" };

        // if (receiverUser._id.equals(senderUser._id)) {
        //     return { success: false, error: "Sender and receiver cannot be the same user." };
        // }

        // if (senderUser.walletBalance < profit) {
        //     return { success: false, error: "Insufficient balance in sender's wallet." };
        // }

        // Deduct from sender
        const updatedSenderBalance = senderUser.walletBalance - profit;
        await User.findByIdAndUpdate(senderUser._id, { walletBalance: updatedSenderBalance });

        // Add to receiver
        const updatedReceiverBalance = receiverUser.walletBalance + profit;
        await User.findByIdAndUpdate(receiverUser._id, { walletBalance: updatedReceiverBalance });

        // Save transaction
        const transaction = new UserTransaction({
            userId: senderUser._id,
            toUserId: receiverUser._id,
            amount: profit,
            transactionType: "transfer",
            status: "pending", // You can later mark it "completed" upon approval
            transactionMessage: `${senderUser.firstName} ${senderUser.lastName} (${senderUser.username}) transferred commission ${profit} to ${receiverUser.username} [PENDING]`,
        });

        await transaction.save();

        return { success: true, data: transaction };

    } catch (error) {
        console.error("Error in sendCommissionToWallet:", error);
        return { success: false, error: "Internal server error" };
    }
}


module.exports = { sendcommission }