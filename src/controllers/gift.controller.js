const { default: mongoose } = require("mongoose");
const { User } = require("../models/user.model");
const UserTransaction = require("../models/userTransaction.model");
const ReferTransaction = require("../models/referTransaction.model");
const logUserActivity = require("../libs/userActivity");
const UserLog = require("../models/userLog.model");

const fetchGifts = async (query = {}, sort = "username", sortOrder = 1) => {
    try {
        const GiftQuery = {
            role: "gift",
            isDeleted: false,  // ✅ Ignore soft-deleted users
            ...query
        };

        return await User.find(GiftQuery)
            .populate("refId")
            .populate("parentId")
            .populate("subordinates",)
            .populate("games")
            .sort({ [sort]: sortOrder })
            .exec();
    } catch (error) {
        console.error("Error fetching Gifts:", error);
        throw new Error("Failed to fetch Gifts.");
    }
};

const createGift = async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            email,
            dateOfBirth,
            country,
            state,
            city,
            pinCode,
            address,
            occupation,
            phone,
            pin,
            password,
            role,
            refId,
            commissionAmount = 0,
            note,
            userStatus = true,
        } = req.body;

        // ✅ Validate required fields
        if (!firstName || !lastName || !phone || !email || !country || !state || !city || !address) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields. Please provide firstName, lastName, phone, email, country, state, city, and address."
            });
        }

        // ✅ Check for duplicate phone or email
        const existingUser = await User.findOne({
            $or: [{ phone }, { email }],
            isDeleted: false
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: `User with this ${existingUser.phone === phone ? "phone number" : "email"} already exists.`
            });
        }

        // ✅ Ensure correct role
        if (role && role !== "gift") {
            return res.status(400).json({
                success: false,
                message: "Only Area Managers can be created using this API."
            });
        }

        // ✅ Check if an active Gift already exists with the same email
        const existingGift = await User.findOne({ email, isDeleted: false });
        if (existingGift) {
            return res.status(400).json({
                success: false,
                message: "Gift with this email already exists."
            });
        }

        // ✅ Create New Gift
        const newGift = new User({
            firstName,
            lastName,
            email,
            phone,
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
            country,
            state,
            city,
            pinCode,
            address,
            occupation,
            role,
            note,
            pin,
            password,
            userStatus,
            commission: commissionAmount,
        });

        // ✅ Handle Referrer (if exists)
        let referrer = null;
        if (refId) {
            referrer = await User.findOne({ _id: refId, isDeleted: false });
            if (!referrer) {
                return res.status(404).json({ success: false, message: "Referrer not found." });
            }
            newGift.refId = referrer._id;
        }

        // ✅ Save Gift
        const savedUser = await newGift.save();

        // ✅ Referral Transaction (if refId exists)
        if (refId) {
            const referralTransaction = await ReferTransaction.create({
                referredUser: savedUser._id,
                referredBy: referrer._id,
                refUserType: role,
                commissionAmount,
                status: "pending",
            });

            referrer.referralTransaction.push(referralTransaction._id);
            referrer.subordinates.push(savedUser._id);
            await referrer.save();

            savedUser.referralTransaction.push(referralTransaction._id);
            savedUser.parentId = referrer._id;
            await savedUser.save();
        }

        // ✅ Fetch updated Gift list after creation
        const Gifts = await fetchGifts();

        return res.status(201).json({
            success: true,
            message: "Gift created successfully.",
            data: Gifts,
        });

    } catch (error) {
        console.error("Error creating Gift:", error);
        return res.status(500).json({
            success: false,
            message: "Error creating Gift",
            error: error.message,
        });
    }
};

const getAllGifts = async (req, res) => {
    try {
        const { search = "", sort = "username", order = "asc", role, id } = req.query;

        // ✅ Ensure only active Gifts are fetched
        const Gifts = await User.find({'role':'gift'}).populate('refId username').exec();
        return res.status(200).json({
            success: true,
            data: Gifts,
        });

    } catch (error) {
        console.error("Error fetching Gifts:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching Gifts",
            error: error.message,
        });
    }
};

const getGiftById = async (req, res) => {
    try {
        const { id } = req.params;

        // ✅ Validate Mongoose ObjectId format before querying DB
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid ID format." });
        }

        // ✅ Fetch Gift details, ensuring it's not soft-deleted
        const Gift = await User.findOne({ _id: id, role: "gift", isDeleted: false })
            .populate("refId", "username email role walletBalance")
            .populate("parentId", "username email role")
            .populate("subordinates", "username email role")
            .populate("games", "name type");

        // ✅ If Gift not found, return 404
        if (!Gift) {
            return res.status(404).json({ success: false, message: "Gift not found." });
        }

        return res.status(200).json({ success: true, data: Gift });

    } catch (error) {
        console.error("Error fetching Gift:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching Gift",
            error: error.message,
        });
    }
};

const updateGift = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            firstName,
            lastName,
            email,
            dateOfBirth,
            country,
            state,
            city,
            pinCode,
            address,
            occupation,
            phone,
            pin,
            password,
            role,
            refId,
            commissionAmount,
            note,
            userStatus,
        } = req.body;

        // ✅ Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid ID format." });
        }

        // ✅ Fetch existing Gift
        const existingGift = await User.findOne({ _id: id, role: "gift", isDeleted: false });
        if (!existingGift) {
            return res.status(404).json({ success: false, message: "Gift not found or has been deleted." });
        }

        // ✅ Check for duplicate email or phone (excluding the current Gift)
        if (email || phone) {
            const duplicateUser = await User.findOne({
                $or: [{ email }, { phone }],
                _id: { $ne: id }, // Exclude the user being updated
                isDeleted: false
            });

            if (duplicateUser) {
                return res.status(400).json({
                    success: false,
                    message: `User with this ${duplicateUser.email === email ? "email" : "phone number"} already exists.`
                });
            }
        }

        // ✅ Validate referrer (if updating refId)
        let referrer = null;
        if (refId) {
            referrer = await User.findOne({ _id: refId, isDeleted: false });
            if (!referrer) {
                return res.status(404).json({ success: false, message: "Referrer not found." });
            }
        }

        // ✅ Update the Gift record
        const updatedGift = await User.findByIdAndUpdate(
            id,
            {
                $set: {
                    firstName,
                    lastName,
                    email,
                    phone,
                    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : existingGift.dateOfBirth,
                    country,
                    state,
                    city,
                    pinCode,
                    address,
                    pin: pin || existingGift.pin,
                    password: password || existingGift.password,
                    occupation,
                    refId: referrer ? referrer._id : existingGift.refId,
                    commission: commissionAmount != null ? commissionAmount : existingGift.commission ?? 0,
                    note,
                    userStatus: userStatus ?? existingGift.userStatus,
                }
            },
            { new: true }
        );

        // ✅ Handle referral transactions if refId changed
        if (refId && refId !== existingGift.refId?.toString()) {
            const referralTransaction = await ReferTransaction.create({
                referredUser: updatedGift._id,
                referredBy: referrer._id,
                refUserType: role,
                commissionAmount,
                status: "pending",
            });

            referrer.referralTransaction.push(referralTransaction._id);
            referrer.subordinates.push(updatedGift._id);
            await referrer.save();

            updatedGift.referralTransaction.push(referralTransaction._id);
            updatedGift.parentId = referrer._id;
            await updatedGift.save();
        }

        // ✅ Fetch updated Gift list after update
        const Gifts = await fetchGifts();

        return res.status(200).json({
            success: true,
            message: "Gift updated successfully.",
            data: Gifts,
        });

    } catch (error) {
        console.error("Error updating Gift:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error. Could not update Gift.",
            error: error.message,
        });
    }
};

const deleteGift = async (req, res) => {
    try {
        const { id } = req.params;

        // ✅ Validate Mongoose ObjectId format before querying DB
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid ID format." });
        }

        // ✅ Check if the Gift exists and is not already deleted
        const Gift = await User.findOne({ _id: id, role: "gift", isDeleted: false });
        if (!Gift) {
            return res.status(404).json({ success: false, message: "Gift not found or already deleted." });
        }

        // ✅ Check if the Gift has subordinates (distributors, retailers, etc.)
        const hasSubordinates = await User.countDocuments({ refId: Gift._id, isDeleted: false });
        if (hasSubordinates > 0) {
            return res.status(400).json({ success: false, message: "Gift has subordinates. Cannot delete." });
        }

        // ✅ Soft delete associated records (wallet transactions, logs, referrals)
        await Promise.all([
            UserTransaction.updateMany({ _id: { $in: Gift.walletTransaction } }, { isDeleted: true, deletedAt: new Date() }),
            UserLog.updateMany({ _id: { $in: Gift.userLogs } }, { isDeleted: true, deletedAt: new Date() }),
            ReferTransaction.updateMany({ _id: { $in: Gift.referralTransaction } }, { isDeleted: true, deletedAt: new Date() }),
        ]);

        // ✅ Soft delete the Gift
        Gift.isDeleted = true;
        Gift.deletedAt = new Date();
        await Gift.save();

        // ✅ Remove Gift from referrer's subordinates list (if refId exists)
        if (Gift.refId) {
            await User.findByIdAndUpdate(Gift.refId, {
                $pull: { subordinates: Gift._id }
            });
        }

        // ✅ Fetch updated list of Gifts
        const Gifts = await fetchGifts();

        return res.status(200).json({
            success: true,
            message: "Gift deleted successfully.",
            data: Gifts,
        });

    } catch (error) {
        console.error("Error deleting Gift:", error);
        return res.status(500).json({
            success: false,
            message: "Error deleting Gift",
            error: error.message,
        });
    }
};

const creditTransfer = async (req, res) => {
    const { userId, password, transferAmount, toUserId } = req.body;

    // ✅ Validate required fields
    if (!userId || !toUserId || !transferAmount) {
        return res.status(400).json({ success: false, message: "All fields are required." });
    }

    // ✅ Validate Mongoose ObjectId format
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(toUserId)) {
        return res.status(400).json({ success: false, message: "Invalid user IDs." });
    }

    // ✅ Validate transfer amount
    if (transferAmount <= 0) {
        return res.status(400).json({ success: false, message: "Transfer amount must be greater than zero." });
    }

    try {
        // ✅ Fetch sender (Gift)
        const senderWallet = await User.findOne({ _id: userId, role: "gift", userStatus: true, isDeleted: false });
        if (!senderWallet) {
            return res.status(403).json({ success: false, message: "Only active Gifts can perform credit transfers." });
        }

        // ✅ Fetch receiver (Must be active and not deleted)
        const receiverWallet = await User.findOne({ _id: toUserId, isDeleted: false });
        if (!receiverWallet) {
            return res.status(404).json({ success: false, message: "Receiver not found or inactive." });
        }

        // ✅ Validate Gift's password
        const authUser = await User.findOne({ _id: req.userAuth._id, userStatus: true, isDeleted: false });
        if (!authUser) {
            return res.status(403).json({ success: false, message: "Unauthorized action." });
        }

        const matchPin = await authUser.comparePin(Number(password));
        const matchPassword = await authUser.comparePassword(password);
        const matchPinPassword = await authUser.comparePinPassword(password);

        if (!(matchPin || matchPassword || matchPinPassword)) {
            return res.status(400).json({ success: false, message: "Invalid password" });
        }

        // ✅ Check sender's balance
        if (senderWallet.walletBalance < transferAmount) {
            return res.status(400).json({ success: false, message: "Insufficient balance." });
        }

        // ✅ Create a new transaction record
        const transaction = new UserTransaction({
            userId,
            toUserId,
            amount: transferAmount,
            transactionType: "transfer",
            status: "pending",
            transactionMessage: `Gift ${senderWallet.username} transferred ${transferAmount} to ${receiverWallet.username} (pending)`,
        });

        await transaction.save();

        // ✅ Update sender & receiver transaction history
        senderWallet.walletTransaction.push(transaction._id);
        receiverWallet.walletTransaction.push(transaction._id);

        await senderWallet.save();
        await receiverWallet.save();

        // ✅ Log transaction activity
        await logUserActivity(req, userId, `${senderWallet.username} credited ${transferAmount} to ${receiverWallet.username} (pending)`, "not request", "credit", "not request", null);

        // ✅ Fetch updated Gifts list
        const Gifts = await fetchGifts();

        return res.status(200).json({
            success: true,
            message: `Successfully transferred ${transferAmount} to User ${receiverWallet.username}`,
            data: { Gifts, receiverWallet },
        });

    } catch (error) {
        console.error("Transaction Error:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
    }
};

const creditAdjust = async (req, res) => {
    const { userId, toUserId, password, adjustAmount, transactionType, transactionMessage } = req.body;

    // ✅ Validate required fields
    if (!userId || !toUserId || !adjustAmount || !transactionType || !password) {
        return res.status(400).json({ success: false, message: "All fields are required." });
    }

    // ✅ Validate Mongoose ObjectId format
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(toUserId)) {
        return res.status(400).json({ success: false, message: "Invalid user IDs." });
    }

    // ✅ Validate adjustment amount
    if (adjustAmount <= 0) {
        return res.status(400).json({ success: false, message: "Adjustment amount must be greater than zero." });
    }

    // ✅ Validate transaction type
    if (!["debit", "credit"].includes(transactionType)) {
        return res.status(400).json({ success: false, message: "Invalid transaction type. Use 'debit' or 'credit'." });
    }

    try {
        // ✅ Fetch sender (Gift)
        let sender = await User.findOne({ _id: userId, role: "gift", userStatus: true, isDeleted: false });
        if (!sender) {
            return res.status(403).json({
                success: false,
                message: "Only active Gifts can perform credit adjustments.",
            });
        }

        // ✅ Fetch receiver (Must be active and not deleted)
        let receiver = await User.findOne({ _id: toUserId, isDeleted: false });
        if (!receiver) {
            return res.status(404).json({ success: false, message: "Receiver not found or inactive." });
        }

        // ✅ Validate Gift's password
        const authUser = await User.findOne({ _id: req.userAuth._id, userStatus: true, isDeleted: false });
        if (!authUser) {
            return res.status(403).json({ success: false, message: "Unauthorized action." });
        }

        const matchPin = await authUser.comparePin(Number(password));
        const matchPassword = await authUser.comparePassword(password);
        const matchPinPassword = await authUser.comparePinPassword(password);

        if (!(matchPin || matchPassword || matchPinPassword)) {
            return res.status(400).json({ success: false, message: "Invalid password" });
        }

        // ✅ Process credit/debit adjustments
        if (transactionType === "debit") {
            if (sender.walletBalance < adjustAmount) {
                return res.status(400).json({ success: false, message: "Insufficient balance in Gift's wallet." });
            }
            sender.walletBalance -= adjustAmount;
            receiver.walletBalance += adjustAmount;
        } else if (transactionType === "credit") {
            if (receiver.walletBalance < adjustAmount) {
                return res.status(400).json({ success: false, message: "Insufficient balance in receiver's wallet." });
            }
            sender.walletBalance += adjustAmount;
            receiver.walletBalance -= adjustAmount;
        }

        // ✅ Create a new transaction record
        const transaction = new UserTransaction({
            userId,
            toUserId,
            amount: adjustAmount,
            transactionType,
            status: "completed",
            transactionMessage: transactionMessage || `Gift ${sender.username} adjusted ${adjustAmount} ${transactionType} to ${receiver.username}`,
        });

        await transaction.save();

        // ✅ Update sender & receiver transaction history
        sender.walletTransaction.push(transaction._id);
        receiver.walletTransaction.push(transaction._id);

        // ✅ Log adjustment activity
        await logUserActivity(req, userId, `${sender.username} adjusted ${adjustAmount} to ${receiver.username}`, "not request", "adjusted", "not request", null);

        // ✅ Save the updated wallets
        await sender.save();
        await receiver.save();

        // ✅ Fetch updated Gift list
        const Gifts = await fetchGifts();

        return res.status(200).json({
            success: true,
            message: `Successfully adjusted ${adjustAmount} ${transactionType} to User ${receiver.username}`,
            data: { Gifts, receiver },
        });

    } catch (error) {
        console.error("Error during credit adjustment:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
    }
};

const toggleUserStatus = async (req, res) => {
    const userId = req.params.id?.replace(/^:/, "");
    const action = req.params.action?.replace(/^:/, "");
    const GiftId = req.user?.id; // Assuming authentication middleware sets req.user

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: "Invalid user ID format." });
    }

    try {
        // ✅ Ensure only active Gifts can toggle user status
        const Gift = await User.findOne({ _id: userId, role: "gift", isDeleted: false });
        if (!Gift) {
            return res.status(403).json({
                success: false,
                message: "Only active Gift users can toggle user status.",
            });
        }

        // ✅ Fetch the target user (Ensure user is not deleted)
        const user = await User.findOne({ _id: userId, isDeleted: false });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found or deleted." });
        }

        // ✅ Activate or deactivate user
        if (action === "activate") {
            user.userStatus = true;
        } else if (action === "deactivate") {
            user.userStatus = false;
        } else {
            return res.status(400).json({
                success: false,
                message: "Invalid action. Use 'activate' or 'deactivate'.",
            });
        }

        await user.save();

        // ✅ Fetch updated Gift list
        const Gifts = await fetchGifts();

        return res.status(200).json({
            success: true,
            message: `User ${action}d successfully.`,
            data: Gifts,
        });

    } catch (error) {
        console.error(`Error occurred during user ${action}:`, error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message,
        });
    }
};

// Get user count by role (including active & deactivated users)
const getRoleCount = async (req, res) => {
    console.log("🚀 getRoleCount API called!"); // Debugging log

    try {
        const roleCounts = await User.aggregate([
            { $match: { isDeleted: false } }, // Exclude soft-deleted users
            {
                $group: {
                    _id: "$role",
                    total: { $sum: 1 },
                    active: { $sum: { $cond: [{ $eq: ["$userStatus", true] }, 1, 0] } },
                    inactive: { $sum: { $cond: [{ $eq: ["$userStatus", false] }, 1, 0] } }
                }
            }
        ]);

        console.log("✅ Role counts fetched:", roleCounts); // Debugging log

        const counts = {
            master: { total: 0, active: 0, inactive: 0 },
            user: { total: 0, active: 0, inactive: 0 },
        };

        roleCounts.forEach(role => {
            counts[role._id] = {
                total: role.total,
                active: role.active,
                inactive: role.inactive,
            };
        });

        res.status(200).json({
            success: true,
            roleCounts: counts,
        });

    } catch (error) {
        console.error("❌ Error in getRoleCount:", error); // Debugging log
        res.status(500).json({
            success: false,
            message: "Error fetching role counts",
            error: error.message,
        });
    }
};

const loadcredit = async (req, res) => {
    try {
        const { id } = req.params;
        // Try to find the user by id
        const foundeduser = await User.findById(id).exec();

        // If the user is not found, try to find users by refId
        const usersByRefId = await User.find({ _id: new mongoose.Types.ObjectId(foundeduser.refId) }).select("id username walletBalance").exec();

        // If no user is found by refId, send a 'not found' message
        if (usersByRefId.length === 0) {
            return res.send({
                success: false,
                message: "No users found for the given refId"
            });
        }

        // Return the users found by refId
        res.status(200).send({
            success: true,
            data: usersByRefId
        });

    } catch (error) {
        // Catch and send any errors
        res.send({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};

module.exports = {
    createGift,
    getAllGifts,
    getGiftById,
    updateGift,
    deleteGift,
    creditTransfer,
    creditAdjust,
    toggleUserStatus,
    getRoleCount,
    loadcredit
};