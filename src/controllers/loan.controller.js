const { default: mongoose } = require("mongoose");
const { User } = require("../models/user.model");
const UserTransaction = require("../models/userTransaction.model");
const ReferTransaction = require("../models/referTransaction.model");
const logUserActivity = require("../libs/userActivity");
const UserLog = require("../models/userLog.model");

const fetchLoans = async (query = {}, sort = "username", sortOrder = 1) => {
    try {
        const LoanQuery = {
            role: "loan",
            isDeleted: false,  // ✅ Ignore soft-deleted users
            ...query
        };

        return await User.find(LoanQuery)
            .populate("refId")
            .populate("parentId")
            .populate("subordinates",)
            .populate("games")
            .sort({ [sort]: sortOrder })
            .exec();
    } catch (error) {
        console.error("Error fetching Loans:", error);
        throw new Error("Failed to fetch Loans.");
    }
};

const createLoan = async (req, res) => {
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
        if (role && role !== "loan") {
            return res.status(400).json({
                success: false,
                message: "Only Area Managers can be created using this API."
            });
        }

        // ✅ Check if an active Loan already exists with the same email
        const existingLoan = await User.findOne({ email, isDeleted: false });
        if (existingLoan) {
            return res.status(400).json({
                success: false,
                message: "Loan with this email already exists."
            });
        }

        // ✅ Create New Loan
        const newLoan = new User({
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
            newLoan.refId = referrer._id;
        }

        // ✅ Save Loan
        const savedUser = await newLoan.save();

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

        // ✅ Fetch updated Loan list after creation
        const Loans = await fetchLoans();

        return res.status(201).json({
            success: true,
            message: "Loan created successfully.",
            data: Loans,
        });

    } catch (error) {
        console.error("Error creating Loan:", error);
        return res.status(500).json({
            success: false,
            message: "Error creating Loan",
            error: error.message,
        });
    }
};

const getAllLoans = async (req, res) => {
    try {
        const { search = "", sort = "username", order = "asc", role, id } = req.query;

        const Loans = await User.find({'role':'loan'}).populate('refId username').exec();

        return res.status(200).json({
            success: true,
            data: Loans,
        });

    } catch (error) {
        console.error("Error fetching Loans:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching Loans",
            error: error.message,
        });
    }
};

const getLoanById = async (req, res) => {
    try {
        const { id } = req.params;

        // ✅ Validate Mongoose ObjectId format before querying DB
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid ID format." });
        }

        // ✅ Fetch Loan details, ensuring it's not soft-deleted
        const Loan = await User.findOne({ _id: id, role: "loan", isDeleted: false })
            .populate("refId", "username email role walletBalance")
            .populate("parentId", "username email role")
            .populate("subordinates", "username email role")
            .populate("games", "name type");

        // ✅ If Loan not found, return 404
        if (!Loan) {
            return res.status(404).json({ success: false, message: "Loan not found." });
        }

        return res.status(200).json({ success: true, data: Loan });

    } catch (error) {
        console.error("Error fetching Loan:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching Loan",
            error: error.message,
        });
    }
};

const updateLoan = async (req, res) => {
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

        // ✅ Fetch existing Loan
        const existingLoan = await User.findOne({ _id: id, role: "loan", isDeleted: false });
        if (!existingLoan) {
            return res.status(404).json({ success: false, message: "Loan not found or has been deleted." });
        }

        // ✅ Check for duplicate email or phone (excluding the current Loan)
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

        // ✅ Update the Loan record
        const updatedLoan = await User.findByIdAndUpdate(
            id,
            {
                $set: {
                    firstName,
                    lastName,
                    email,
                    phone,
                    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : existingLoan.dateOfBirth,
                    country,
                    state,
                    city,
                    pinCode,
                    address,
                    pin: pin || existingLoan.pin,
                    password: password || existingLoan.password,
                    occupation,
                    refId: referrer ? referrer._id : existingLoan.refId,
                    commission: commissionAmount != null ? commissionAmount : existingLoan.commission ?? 0,
                    note,
                    userStatus: userStatus ?? existingLoan.userStatus,
                }
            },
            { new: true }
        );

        // ✅ Handle referral transactions if refId changed
        if (refId && refId !== existingLoan.refId?.toString()) {
            const referralTransaction = await ReferTransaction.create({
                referredUser: updatedLoan._id,
                referredBy: referrer._id,
                refUserType: role,
                commissionAmount,
                status: "pending",
            });

            referrer.referralTransaction.push(referralTransaction._id);
            referrer.subordinates.push(updatedLoan._id);
            await referrer.save();

            updatedLoan.referralTransaction.push(referralTransaction._id);
            updatedLoan.parentId = referrer._id;
            await updatedLoan.save();
        }

        // ✅ Fetch updated Loan list after update
        const Loans = await fetchLoans();

        return res.status(200).json({
            success: true,
            message: "Loan updated successfully.",
            data: Loans,
        });

    } catch (error) {
        console.error("Error updating Loan:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error. Could not update Loan.",
            error: error.message,
        });
    }
};

const deleteLoan = async (req, res) => {
    try {
        const { id } = req.params;

        // ✅ Validate Mongoose ObjectId format before querying DB
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid ID format." });
        }

        // ✅ Check if the Loan exists and is not already deleted
        const Loan = await User.findOne({ _id: id, role: "loan", isDeleted: false });
        if (!Loan) {
            return res.status(404).json({ success: false, message: "Loan not found or already deleted." });
        }

        // ✅ Check if the Loan has subordinates (distributors, retailers, etc.)
        const hasSubordinates = await User.countDocuments({ refId: Loan._id, isDeleted: false });
        if (hasSubordinates > 0) {
            return res.status(400).json({ success: false, message: "Loan has subordinates. Cannot delete." });
        }

        // ✅ Soft delete associated records (wallet transactions, logs, referrals)
        await Promise.all([
            UserTransaction.updateMany({ _id: { $in: Loan.walletTransaction } }, { isDeleted: true, deletedAt: new Date() }),
            UserLog.updateMany({ _id: { $in: Loan.userLogs } }, { isDeleted: true, deletedAt: new Date() }),
            ReferTransaction.updateMany({ _id: { $in: Loan.referralTransaction } }, { isDeleted: true, deletedAt: new Date() }),
        ]);

        // ✅ Soft delete the Loan
        Loan.isDeleted = true;
        Loan.deletedAt = new Date();
        await Loan.save();

        // ✅ Remove Loan from referrer's subordinates list (if refId exists)
        if (Loan.refId) {
            await User.findByIdAndUpdate(Loan.refId, {
                $pull: { subordinates: Loan._id }
            });
        }

        // ✅ Fetch updated list of Loans
        const Loans = await fetchLoans();

        return res.status(200).json({
            success: true,
            message: "Loan deleted successfully.",
            data: Loans,
        });

    } catch (error) {
        console.error("Error deleting Loan:", error);
        return res.status(500).json({
            success: false,
            message: "Error deleting Loan",
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
        // ✅ Fetch sender (Loan)
        const senderWallet = await User.findOne({ _id: userId, role: "loan", userStatus: true, isDeleted: false });
        if (!senderWallet) {
            return res.status(403).json({ success: false, message: "Only active Loans can perform credit transfers." });
        }

        // ✅ Fetch receiver (Must be active and not deleted)
        const receiverWallet = await User.findOne({ _id: toUserId, isDeleted: false });
        if (!receiverWallet) {
            return res.status(404).json({ success: false, message: "Receiver not found or inactive." });
        }

        // ✅ Validate Loan's password
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
            transactionMessage: `Loan ${senderWallet.username} transferred ${transferAmount} to ${receiverWallet.username} (pending)`,
        });

        await transaction.save();

        // ✅ Update sender & receiver transaction history
        senderWallet.walletTransaction.push(transaction._id);
        receiverWallet.walletTransaction.push(transaction._id);

        await senderWallet.save();
        await receiverWallet.save();

        // ✅ Log transaction activity
        await logUserActivity(req, userId, `${senderWallet.username} credited ${transferAmount} to ${receiverWallet.username} (pending)`, "not request", "credit", "not request", null);

        // ✅ Fetch updated Loans list
        const Loans = await fetchLoans();

        return res.status(200).json({
            success: true,
            message: `Successfully transferred ${transferAmount} to User ${receiverWallet.username}`,
            data: { Loans, receiverWallet },
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
        // ✅ Fetch sender (Loan)
        let sender = await User.findOne({ _id: userId, role: "loan", userStatus: true, isDeleted: false });
        if (!sender) {
            return res.status(403).json({
                success: false,
                message: "Only active Loans can perform credit adjustments.",
            });
        }

        // ✅ Fetch receiver (Must be active and not deleted)
        let receiver = await User.findOne({ _id: toUserId, isDeleted: false });
        if (!receiver) {
            return res.status(404).json({ success: false, message: "Receiver not found or inactive." });
        }

        // ✅ Validate Loan's password
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
                return res.status(400).json({ success: false, message: "Insufficient balance in Loan's wallet." });
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
            transactionMessage: transactionMessage || `Loan ${sender.username} adjusted ${adjustAmount} ${transactionType} to ${receiver.username}`,
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

        // ✅ Fetch updated Loan list
        const Loans = await fetchLoans();

        return res.status(200).json({
            success: true,
            message: `Successfully adjusted ${adjustAmount} ${transactionType} to User ${receiver.username}`,
            data: { Loans, receiver },
        });

    } catch (error) {
        console.error("Error during credit adjustment:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
    }
};

const toggleUserStatus = async (req, res) => {
    const userId = req.params.id?.replace(/^:/, "");
    const action = req.params.action?.replace(/^:/, "");
    const LoanId = req.user?.id; // Assuming authentication middleware sets req.user

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: "Invalid user ID format." });
    }

    try {
        // ✅ Ensure only active Loans can toggle user status
        const Loan = await User.findOne({ _id: userId, role: "loan", isDeleted: false });
        if (!Loan) {
            return res.status(403).json({
                success: false,
                message: "Only active Loan users can toggle user status.",
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

        // ✅ Fetch updated Loan list
        const Loans = await fetchLoans();

        return res.status(200).json({
            success: true,
            message: `User ${action}d successfully.`,
            data: Loans,
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
    createLoan,
    getAllLoans,
    getLoanById,
    updateLoan,
    deleteLoan,
    creditTransfer,
    creditAdjust,
    toggleUserStatus,
    getRoleCount,
    loadcredit
};