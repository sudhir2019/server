const jwt = require("jsonwebtoken");
const { default: mongoose } = require('mongoose');
const { User } = require("../models/user.model");
const UserTransaction = require("../models/userTransaction.model");
const { Complaint } = require("../models/complaint.model");
const Result = require("../models/result.models");
const Game = require("../models/game.model");

async function loadBalance(req, res) {
    try {
        const { id } = req.query;
        const data = await User.findById(id).exec();
        return res.status(200).json({ success: true, data: data });
    } catch (error) {
        console.error("Error fetching load balance data:", error);
        return res.status(500).json({ success: false, error: "Internal Server Error" });
    }
}

async function loadTransferable(req, res) {
    try {
        const { id } = req.query;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, error: "Invalid user ID" });
        }

        // ✅ Get list of subordinates
        const user = await User.findById(id).select("subordinates").lean();

        if (!user) {
            return res.status(404).json({ success: false, error: "User not found" });
        }

        const subordinateIds = user.subordinates || [];

        // ✅ Only include transfers from subordinate users
        const query = {
            userId: new mongoose.Types.ObjectId(id),
            status: "pending",
            transactionType: "transfer"
        };

        const results = await UserTransaction.find(query)
            .populate({
                path: "toUserId",
                select: "username firstName lastName role",
            })
            .lean();

        return res.status(200).json({ success: true, data: results });

    } catch (error) {
        console.error("Error loading transferable data:", error);
        return res.status(500).json({ success: false, error: "Internal Server Error" });
    }
}

async function loadReceivable(req, res) {
    try {
        const { id } = req.query;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, error: "Invalid user ID" });
        }

        const user = await User.findById(id).select("subordinates").lean();

        if (!user) {
            return res.status(404).json({ success: false, error: "User not found" });
        }

        const subordinateIds = user.subordinates || [];

        const query = {
            toUserId: new mongoose.Types.ObjectId(id),
            status: "pending",
            transactionType: "transfer"
        };

        const results = await UserTransaction.find(query)
            .populate({
                path: "userId",
                select: "username firstName lastName role"
            })
            .lean();
        return res.status(200).json({ success: true, data: results });

    } catch (error) {
        console.error("Error loading receivable data:", error);
        return res.status(500).json({ success: false, error: "Internal Server Error" });
    }
}


async function receive(req, res) {
    try {
        const { id, receiveData } = req.body;

        // Find user's wallet balance
        const findWallet = await User.findById(id).exec();
        if (!findWallet) {
            return res.status(404).json({ success: false, error: "User not found" });
        }

        let mainWalletBalance = findWallet.walletBalance;
        let sum = 0;

        // Use for...of to handle async properly
        for (const object of receiveData) {
            const findTransaction = await UserTransaction.findOne({
                _id: object, // Ensure `object` contains a valid MongoDB ObjectId
                status: "pending"
            }).exec();


            if (findTransaction) {
                sum += parseFloat(findTransaction.amount, 2);

                // Update transaction status
                await UserTransaction.updateOne(
                    { _id: object },
                    { $set: { status: "completed" } }
                );
            }
        }

        // Update user's wallet balance
        const newBalance = mainWalletBalance + sum;
        const updatedData = await User.updateOne(
            { _id: id },
            { $set: { walletBalance: newBalance } }
        );

        return res.status(200).json({ success: true, data: updatedData });
    } catch (error) {
        console.error("Error processing receive request:", error);
        return res.status(500).json({ success: false, error: "Internal Server Error" });
    }
}

async function reject(req, res) {
    try {
        const { id, receiveData } = req.body;

        if (!receiveData || receiveData.length === 0) {
            return res.status(400).json({ success: false, error: "No transactions to reject" });
        }

        let updatedUsers = []; // Store updated user balances

        // Use `Promise.all()` for parallel execution
        await Promise.all(receiveData.map(async (object) => {
            const findTransaction = await UserTransaction.findOne({
                _id: object,
                status: "pending"
            }).exec();

            if (findTransaction) {
                const { userId, toUserId, amount } = findTransaction;

                const findWallet = await User.findById(userId).exec();
                if (!findWallet) {
                    console.warn(`Wallet not found for user ID: ${toUserId}`);
                    return;
                }

                let mainWalletBalance = findWallet.walletBalance;
                const parsedAmount = parseFloat(amount);

                // Update transaction status to "rejected"
                await UserTransaction.updateOne(
                    { _id: object },
                    { $set: { status: "rejected" } }
                );

                // Update receiver's wallet balance
                const newBalance = mainWalletBalance + parsedAmount;
                const updatedData = await User.updateOne(
                    { _id: userId },
                    { $set: { walletBalance: newBalance } }
                );

                updatedUsers.push(updatedData);
            }
        }));

        return res.status(200).json({ success: true, data: updatedUsers });
    } catch (error) {
        console.error("Error processing reject request:", error);
        return res.status(500).json({ success: false, error: "Internal Server Error" });
    }
}

async function cancel(req, res) {
    try {
        const { id, transferData } = req.body;


        const findWallet = await User.findById(id).exec();
        if (!findWallet) {
            return res.status(404).json({ success: false, error: "User not found" });
        }

        let mainWalletBalance = findWallet.walletBalance;
        let sum = 0;


        if (!transferData || transferData.length === 0) {
            return res.status(400).json({ success: false, error: "No transactions to reject" });
        }

        let updatedUsers = []; // Store updated user balances

        for (const object of transferData) {
            const findTransaction = await UserTransaction.findOne({
                _id: object, // Ensure `object` contains a valid MongoDB ObjectId
                status: "pending"
            }).exec();


            if (findTransaction) {
                sum += parseFloat(findTransaction.amount, 2);

                // Update transaction status
                await UserTransaction.updateOne(
                    { _id: object },
                    { $set: { status: "cancelled" } }
                );
            }
        }

        const newBalance = mainWalletBalance + sum;
        const updatedData = await User.updateOne(
            { _id: id },
            { $set: { walletBalance: newBalance } }
        );


        return res.status(200).json({ success: true, data: updatedUsers });
    } catch (error) {
        console.error("Error processing reject request:", error);
        return res.status(500).json({ success: false, error: "Internal Server Error" });
    }
}

async function pointtransfer(req, res) {
    try {
        const { id, amount, pin, password, receiver_id } = req.body;

        // Validate sender

        const sender = await User.findById(id).exec();
        // console.log(sender.role);
        if (!sender) {
            return res.status(404).json({ success: false, error: "Sender not found" });
        }

        // Validate receiver
        const receiver = await User.findOne({ username: receiver_id }).exec();
        if (!receiver) {
            return res.status(404).json({ success: false, error: "Receiver not found" });
        }

        // Match pin
        if (Number(pin) !== Number(sender.pin)) {
            return res.status(401).json({ success: false, error: "Incorrect PIN" });
        }

        // Prevent self-transfer
        if (sender._id.toString() === receiver._id.toString()) {
            return res.status(400).json({ success: false, error: "Cannot transfer to self" });
        }



        // ✅ Check if receiver is a subordinate of sender
        if (sender.role !== "otc" && sender.role !== "gift" && sender.role !== "loan") {
            const isSubordinate = sender.subordinates.some(
                subId => subId.toString() === receiver._id.toString()
            );
            if (!isSubordinate) {
                return res.status(403).json({ success: false, error: "Receiver is not your subordinate" });
            }
        }

        // ✅ Check balance for non-admin roles
        if (sender.role !== "admin" && sender.role !== "otc" && sender.role !== "gift" && sender.role !== "loan" && (!sender.walletBalance || sender.walletBalance < amount)) {
            return res.status(400).json({ success: false, error: "Insufficient balance" });
        }

        // Deduct from sender
        const updatedSenderBalance = sender.walletBalance - amount;
        await User.findByIdAndUpdate(sender._id, { walletBalance: updatedSenderBalance });

        // Note: Receiver does NOT get balance yet — transaction is pending

        // Save transaction (status: pending)
        const transaction = new UserTransaction({
            userId: sender._id,
            toUserId: receiver._id,
            amount: amount,
            transactionType: "transfer",
            status: "pending",
            transactionMessage: `${sender.role} ${sender.username} initiated transfer of ${amount} to ${receiver.username} (pending)`,
        });

        await transaction.save();

        return res.status(200).json({ success: true, data: transaction });
    } catch (error) {
        console.error("Error processing transfer:", error);
        return res.status(500).json({ success: false, error: "Internal Server Error" });
    }
}

async function changePassword(req, res) {
    try {
        const { id, newPassword, pin } = req.body;

        // Check if user exists
        const userFound = await User.findById(id).exec();
        if (!userFound) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Check if the provided PIN is correct
        if (Number(userFound.pin) !== Number(pin)) {
            return res.status(400).json({ success: false, message: "Invalid PIN" });
        }

        // Update password
        const updateQuery = await User.updateOne(
            { _id: new mongoose.Types.ObjectId(id), pin: pin }, // ✅ Ensuring the correct PIN is provided
            { $set: { password: newPassword } }
        );

        return res.status(200).json({
            success: true,
            message: "Password updated successfully",
            data: updateQuery,
        });
    } catch (error) {
        console.error("Error updating password:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
}

async function chnagepin(req, res) {
    try {
        const { id, newPin } = req.body;

        // Check if user exists
        const userFound = await User.findById(id).exec();
        if (!userFound) {
            return res.status(404).json({ success: false, message: "User not found" });
        }



        // Update password
        const updateQuery = await User.updateOne(
            { _id: new mongoose.Types.ObjectId(id) }, // ✅ Ensuring the correct PIN is provided
            { $set: { pin: newPin } }
        );

        return res.status(200).json({
            success: true,
            message: "Pin updated successfully",
            data: updateQuery,
        });
    } catch (error) {
        console.error("Error updating password:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
}
const fetchChildren = async (id, role) => {
    return await User.find({ parentId: id }).select("id username pin password")
        .populate({
            path: "refId",
            select: "id username pin password",
        })
        .populate({
            path: "subordinates",
            select: "id username pin password",
        });
}

async function loadUsers(req, res) {
    try {
        const { id } = req.query;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, error: "Invalid ID" });
        }
        // Check if the user exists
        const user = await User.findById(id).exec();
        if (!user) {
            return res.status(404).json({ success: false, error: "User not found" });
        }
        // console.log(user);
        const data = await fetchChildren(id, user.role)
        // const data = await User.find({
        //     refId: new mongoose.Types.ObjectId(id),
        //     isDeleted: false,
        //     userStatus: true,
        // }).select("id username pin password");
        return res.status(200).json({ success: true, data });
    } catch (error) {
        console.error("Error fetching load balance data:", error);
        return res.status(500).json({ success: false, error: "Internal Server Error" });
    }
}

async function resetPinPassword(req, res) {
    try {
        const { userList } = req.body;

        for (const list of userList) {
            const updateFields = {};

            if (list.settingType === "pin") {
                updateFields.pin = list.pin;
            }

            if (list.settingType === "password") {
                updateFields.password = list.password;
            }

            if (list.settingType === "pinpassword") {
                updateFields.password = list.password;
                updateFields.pin = list.pin;
            }

            await User.updateOne(
                { _id: new mongoose.Types.ObjectId(list.id) },
                { $set: updateFields }
            );
        }

        return res.status(200).json({ success: true, message: "User settings updated successfully." });
    } catch (error) {
        console.error("Error resetting pin/password:", error);
        return res.status(500).json({ success: false, error: "Internal Server Error" });
    }
}

async function complaint(req, res) {
    try {
        const { fullName, email, mobile, complaintDetails, captcha, enquiryType } = req.body.form;

        // Validate required fields
        if (!fullName || !email || !mobile || !complaintDetails || !captcha) {
            return res.status(400).json({ success: false, error: "All fields are required" });
        }


        // Create new complaint
        const newComplaint = new Complaint({ enquiryType, fullName, email, mobile, complaintDetails, captcha });
        await newComplaint.save();

        res.status(200).json({ success: true, message: "Complaint submitted successfully!" });
    } catch (error) {
        console.error("Error submitting complaint:", error);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
}


async function drawdetails(req, res) {
    try {
        const gameIds = ["MNOQqWWi", "vwRORrGO", "zuuhVbBM", "qZicXikM"];
        const result = {};

        for (const gameId of gameIds) {
            const [results, game] = await Promise.all([
                Result.find({ gameid: gameId, status: 1 })
                    .sort({ _id: -1 })
                    .limit(100)
                    .exec(),
                Game.findOne({ gameId: gameId }).exec()
            ]);

            result[gameId] = {
                gameId: game ? game.gameId : null,
                gameName: game ? game.gameName : null,
                results
            };
        }

        res.status(200).send({
            message: true,
            data: result
        });

    } catch (error) {
        console.error('Error fetching draw details:', error);
        res.status(500).send({
            message: false,
            error: 'Internal Server Error in drawdetails'
        });
    }
}


module.exports = {
    loadBalance,
    loadTransferable,
    loadReceivable,
    receive,
    reject,
    pointtransfer,
    cancel,
    changePassword,
    chnagepin,
    loadUsers,
    resetPinPassword,
    complaint,
    drawdetails
};
