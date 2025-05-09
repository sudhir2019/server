const { default: mongoose } = require("mongoose");
const { User } = require("../models/user.model");
const UserTransaction = require("../models/userTransaction.model");
const ReferTransaction = require("../models/referTransaction.model");
const logUserActivity = require("../libs/userActivity");
const UserLog = require("../models/userLog.model");

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

const fetchAreamanagers = async (query = {}, sort = "username", sortOrder = 1) => {
    try {
        const AreamanagerQuery = {
            role: "areamanager",
            isDeleted: false,  // ✅ Ignore soft-deleted users
            ...query
        };

        return await User.find(AreamanagerQuery)
            .populate("refId")
            .populate("parentId")
            .populate("subordinates",)
            .populate("games")
            .sort({ [sort]: sortOrder })
            .exec();
    } catch (error) {
        console.error("Error fetching Areamanagers:", error);
        throw new Error("Failed to fetch Areamanagers.");
    }
};

const createAreamanager = async (req, res) => {
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
            commissionAmount,
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
        if (role && role !== "areamanager") {
            return res.status(400).json({
                success: false,
                message: "Only Area Managers can be created using this API."
            });
        }

        // ✅ Check if an active Areamanager already exists with the same email
        const existingAreamanager = await User.findOne({ email, isDeleted: false });
        if (existingAreamanager) {
            return res.status(400).json({
                success: false,
                message: "Areamanager with this email already exists."
            });
        }

        // ✅ Create New Areamanager
        const newAreamanager = new User({
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
            newAreamanager.refId = referrer._id;
        }

        // ✅ Save Areamanager
        const savedUser = await newAreamanager.save();

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

        // ✅ Fetch updated Areamanager list after creation
        const Areamanagers = await fetchAreamanagers();

        return res.status(201).json({
            success: true,
            message: "Areamanager created successfully.",
            data: Areamanagers,
        });

    } catch (error) {
        console.error("Error creating Areamanager:", error);
        return res.status(500).json({
            success: false,
            message: "Error creating Areamanager",
            error: error.message,
        });
    }
};

const getAllAreamanagers = async (req, res) => {
    try {
        const { search = "", sort = "username", order = "asc", role, id } = req.query;

        // ✅ Ensure only active Areamanagers are fetched
        let query = { isDeleted: false };

        // ✅ Optimized search across indexed fields
        if (search) {
            query.$or = [
                { username: new RegExp(search, "i") },
                { email: new RegExp(search, "i") },
                { uniqueId: new RegExp(search, "i") },
            ];
        }

        // ✅ Sorting order
        let Areamanagers;
        const sortOrder = order === "desc" ? -1 : 1;

        if (role === "superadmin") {
            query.$and = [
                { role: "areamanager" }
            ];

            Areamanagers = await User.find(query).populate('refId', 'username').exec();
        }

        if (role === "admin") {

            query.$and = [
                { role: 'superareamanager' },
                { 'refId': new mongoose.Types.ObjectId(id) }
            ];
            let supers = await User.find(query)
                .populate('refId', 'username')

                .set('strictPopulate', false)
                .exec();

            // Fetch Areamanagers for each superAreamanager
            let AreamanagersList = [];
            for (let superd of supers) {
                let Areamanagers = await User.find({
                    role: 'areamanager',
                    refId: superd._id  // Match superAreamanager's _id to refId of Areamanagers
                })
                    .populate('refId', 'username')

                    .exec();

                AreamanagersList.push(...Areamanagers);  // Use push for better performance
            }
            Areamanagers = AreamanagersList

        }

        if (role === "superareamanager") {
            query.$and = [
                { role: 'areamanager' },
                { 'refId': new mongoose.Types.ObjectId(id) }
            ];
            let superAreamanagers = await User.find(query)
                .populate('refId', 'username')

                .set('strictPopulate', false)
                .exec();

            Areamanagers = superAreamanagers;  // Assign superAreamanagers to users
        }


        if (role === "areamanager") {
            query.$and = [
                { role: 'areamanager' },
                { _id: new mongoose.Types.ObjectId(id) }
            ];
            let superAreamanagers = await User.find(query)
                .populate('refId', 'username')

                .set('strictPopulate', false)
                .exec();

            Areamanagers = superAreamanagers;  // Assign superAreamanagers to users
        }

        // ✅ Fetch Areamanagers with populated references
        //  const Areamanagers = await fetchAreamanagers(query, sort, sortOrder);

        return res.status(200).json({
            success: true,
            data: Areamanagers,
        });

    } catch (error) {
        console.error("Error fetching Areamanagers:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching Areamanagers",
            error: error.message,
        });
    }
};

const getAreamanagerById = async (req, res) => {
    try {
        const { id } = req.params;

        // ✅ Validate Mongoose ObjectId format before querying DB
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid ID format." });
        }

        // ✅ Fetch Areamanager details, ensuring it's not soft-deleted
        const Areamanager = await User.findOne({ _id: id, role: "areamanager", isDeleted: false })
            .populate("refId", "username email role walletBalance")
            .populate("parentId", "username email role")
            .populate("subordinates", "username email role")
            .populate("games", "name type");

        // ✅ If Areamanager not found, return 404
        if (!Areamanager) {
            return res.status(404).json({ success: false, message: "Areamanager not found." });
        }

        return res.status(200).json({ success: true, data: Areamanager });

    } catch (error) {
        console.error("Error fetching Areamanager:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching Areamanager",
            error: error.message,
        });
    }
};

const updateAreamanager = async (req, res) => {
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
            commission,
            note,
            userStatus,
        } = req.body;

        // ✅ Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid ID format." });
        }

        // ✅ Fetch existing Areamanager
        const existingAreamanager = await User.findOne({ _id: id, role: "areamanager", isDeleted: false });
        if (!existingAreamanager) {
            return res.status(404).json({ success: false, message: "Areamanager not found or has been deleted." });
        }

        // ✅ Check for duplicate email or phone (excluding the current Areamanager)
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

        // ✅ Update the Areamanager record
        const updatedAreamanager = await User.findByIdAndUpdate(
            id,
            {
                $set: {
                    firstName,
                    lastName,
                    email,
                    phone,
                    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : existingAreamanager.dateOfBirth,
                    country,
                    state,
                    city,
                    pinCode,
                    address,
                    pin: pin || existingAreamanager.pin,
                    password: password || existingAreamanager.password,
                    occupation,
                    refId: referrer ? referrer._id : existingAreamanager.refId,
                    commission: commission != null ? commission : existingAreamanager.commission ?? 0,
                    note,
                    userStatus: userStatus ?? existingAreamanager.userStatus,
                }
            },
            { new: true }
        );

        // ✅ Handle referral transactions if refId changed
        if (refId && refId !== existingAreamanager.refId?.toString()) {
            const referralTransaction = await ReferTransaction.create({
                referredUser: updatedAreamanager._id,
                referredBy: referrer._id,
                refUserType: role,
                commissionAmount,
                status: "pending",
            });

            referrer.referralTransaction.push(referralTransaction._id);
            referrer.subordinates.push(updatedAreamanager._id);
            await referrer.save();

            updatedAreamanager.referralTransaction.push(referralTransaction._id);
            updatedAreamanager.parentId = referrer._id;
            await updatedAreamanager.save();
        }

        // ✅ Fetch updated Areamanager list after update
        const Areamanagers = await fetchAreamanagers();

        return res.status(200).json({
            success: true,
            message: "Areamanager updated successfully.",
            data: Areamanagers,
        });

    } catch (error) {
        console.error("Error updating Areamanager:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error. Could not update Areamanager.",
            error: error.message,
        });
    }
};

const deleteAreamanager = async (req, res) => {
    try {
        const { id } = req.params;

        // ✅ Validate Mongoose ObjectId format before querying DB
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid ID format." });
        }

        // ✅ Check if the Areamanager exists and is not already deleted
        const areamanager = await User.findOne({ _id: id, role: "areamanager", isDeleted: false });
        if (!areamanager) {
            return res.status(404).json({ success: false, message: "Areamanager not found or already deleted." });
        }

        // ✅ Check if the Areamanager has subordinates (distributors, retailers, etc.)
        const hasSubordinates = await User.countDocuments({ refId: areamanager._id, isDeleted: false });
        if (hasSubordinates > 0) {
            return res.status(400).json({ success: false, message: "Areamanager has subordinates. Cannot delete." });
        }

        // ✅ Soft delete associated records (wallet transactions, logs, referrals)
        await Promise.all([
            UserTransaction.updateMany({ _id: { $in: areamanager.walletTransaction } }, { isDeleted: true, deletedAt: new Date() }),
            UserLog.updateMany({ _id: { $in: areamanager.userLogs } }, { isDeleted: true, deletedAt: new Date() }),
            ReferTransaction.updateMany({ _id: { $in: areamanager.referralTransaction } }, { isDeleted: true, deletedAt: new Date() }),
        ]);

        // ✅ Soft delete the Areamanager
        areamanager.isDeleted = true;
        areamanager.deletedAt = new Date();
        await areamanager.save();

        // ✅ Remove Areamanager from referrer's subordinates list (if refId exists)
        if (areamanager.refId) {
            await User.findByIdAndUpdate(areamanager.refId, {
                $pull: { subordinates: areamanager._id }
            });
        }

        // ✅ Fetch updated list of Areamanagers
        const Areamanagers = await fetchAreamanagers();

        return res.status(200).json({
            success: true,
            message: "Areamanager deleted successfully.",
            data: Areamanagers,
        });

    } catch (error) {
        console.error("Error deleting Areamanager:", error);
        return res.status(500).json({
            success: false,
            message: "Error deleting Areamanager",
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
        // ✅ Fetch sender (Areamanager)
        const senderWallet = await User.findOne({ _id: userId, userStatus: true, isDeleted: false });
        if (!senderWallet) {
            return res.status(403).json({ success: false, message: "Only active Areamanagers can perform credit transfers." });
        }

        // ✅ Fetch receiver (Must be active and not deleted)
        const receiverWallet = await User.findOne({ _id: toUserId, isDeleted: false });
        if (!receiverWallet) {
            return res.status(404).json({ success: false, message: "Receiver not found or inactive." });
        }

        // ✅ Validate Areamanager's password
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
        senderWallet.walletBalance -= transferAmount;

        // ✅ Create a new transaction record
        const transaction = new UserTransaction({
            userId,
            toUserId,
            amount: transferAmount,
            transactionType: "transfer",
            status: "pending",
            transactionMessage: `Areamanager ${senderWallet.username} transferred ${transferAmount} to ${receiverWallet.username} (pending)`,
        });

        await transaction.save();

        // ✅ Update sender & receiver transaction history
        senderWallet.walletTransaction.push(transaction._id);
        receiverWallet.walletTransaction.push(transaction._id);

        await senderWallet.save();
        await receiverWallet.save();

        // ✅ Log transaction activity
        await logUserActivity(req, userId, `${senderWallet.username} credited ${transferAmount} to ${receiverWallet.username} (pending)`, "not request", "credit", "not request", null);

        // ✅ Fetch updated Areamanagers list
        const Areamanagers = await fetchAreamanagers();

        return res.status(200).json({
            success: true,
            message: `Successfully transferred ${transferAmount} to User ${receiverWallet.username}`,
            data: { Areamanagers, receiverWallet },
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
        // ✅ Fetch sender (Areamanager)
        let sender = await User.findOne({ _id: userId, userStatus: true, isDeleted: false });
        if (!sender) {
            return res.status(403).json({
                success: false,
                message: "Only active Areamanagers can perform credit adjustments.",
            });
        }

        // ✅ Fetch receiver (Must be active and not deleted)
        let receiver = await User.findOne({ _id: toUserId, isDeleted: false });
        if (!receiver) {
            return res.status(404).json({ success: false, message: "Receiver not found or inactive." });
        }

        // ✅ Validate Areamanager's password
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
                return res.status(400).json({ success: false, message: "Insufficient balance in Areamanager's wallet." });
            }
            sender.walletBalance -= adjustAmount;
        } else if (transactionType === "credit") {
            if (receiver.walletBalance < adjustAmount) {
                return res.status(400).json({ success: false, message: "Insufficient balance in receiver's wallet." });
            }
            receiver.walletBalance -= adjustAmount;
        }

        // ✅ Create a new transaction record
        const transaction = new UserTransaction({
            userId,
            toUserId,
            amount: adjustAmount,
            transactionType,
            status: "pending",
            transactionMessage: transactionMessage || `Areamanager ${sender.username} adjusted ${adjustAmount} ${transactionType} to ${receiver.username}`,
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

        // ✅ Fetch updated Areamanager list
        const Areamanagers = await fetchAreamanagers();

        return res.status(200).json({
            success: true,
            message: `Successfully adjusted ${adjustAmount} ${transactionType} to User ${receiver.username}`,
            data: { Areamanagers, receiver },
        });

    } catch (error) {
        console.error("Error during credit adjustment:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
    }
};

const toggleUserStatus = async (req, res) => {
    const userId = req.params.id?.replace(/^:/, "");
    const action = req.params.action?.replace(/^:/, "");
    const AreamanagerId = req.user?.id; // Assuming authentication middleware sets req.user

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: "Invalid user ID format." });
    }

    try {
        // ✅ Ensure only active Areamanagers can toggle user status
        const Areamanager = await User.findOne({ _id: userId, role: "areamanager", isDeleted: false });
        if (!Areamanager) {
            return res.status(403).json({
                success: false,
                message: "Only active Areamanager users can toggle user status.",
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

        // ✅ Fetch updated Areamanager list
        const Areamanagers = await fetchAreamanagers();

        return res.status(200).json({
            success: true,
            message: `User ${action}d successfully.`,
            data: Areamanagers,
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

// Helper function to fetch a user by ID with deep population
const fetchAreamanagerById = async (id) => {
    return await User.findOne({ _id: id, isDeleted: false })
        .populate("refId")
        .populate("parentId")
        .populate("subordinates")
        .populate("games")
        .lean();
};

// Helper function to fetch child users (refId) with sorting
const fetchAreamanagerChildren = async (id, sort, sortOrder) => {
    return await User.find({ refId: id, isDeleted: false })
        .populate("refId")
        .populate("parentId")
        .populate("subordinates")
        .populate("games")
        .sort({ [sort]: sortOrder === "asc" ? 1 : -1 })
        .lean();
};

// Main controller function
const getAreamanagerByIdChildren = async (req, res) => {
    try {
        const { id } = req.params;
        const { sort = "username", sortOrder = "asc" } = req.query;
        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid user ID" });
        }
        // Fetch user & child users
        const masters = await fetchAreamanagerById(id);
        if (!masters) {
            return res.status(404).json({ success: false, message: "User not found or has been deleted" });
        }
        const children = await fetchAreamanagerChildren(id, sort, sortOrder);
        // Return user and associated users
        return res.status(200).json({
            success: true,
            data: { masters, children }
        });

    } catch (error) {
        console.error("Error fetching user by ID:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const createAreamanagerByIdChildren = async (req, res) => {
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
        const { id } = req.params;

        // ✅ Validate required fields
        if (!firstName || !lastName || !phone || !password) {
            return res.status(400).json({
                success: false,
                message: "First name, last name, phone, and password are required.",
            });
        }

        // ✅ Ensure only 'Areamanager' role is allowed
        if (role && role !== "master") {
            return res.status(400).json({
                success: false,
                message: "Only areamanager users can be created using this API.",
            });
        }

        // ✅ Check if parent Areamanager exists
        const parentAreamanager = await User.findOne({ _id: id, role: "areamanager", isDeleted: false });
        if (!parentAreamanager) {
            return res.status(404).json({
                success: false,
                message: "Parent Areamanager not found or has been deleted.",
            });
        }

        // ✅ Check if an active Areamanager already exists with the same phone number
        const existingAreamanager = await User.findOne({ phone, isDeleted: false });
        if (existingAreamanager) {
            return res.status(400).json({
                success: false,
                message: "Areamanager with this phone number already exists.",
            });
        }

        // ✅ Create New Areamanager
        const newAreamanager = new User({
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
            refId: parentAreamanager._id, // Set parent reference
        });

        // ✅ Save Areamanager
        const savedAreamanager = await newAreamanager.save();

        // ✅ Add the new Areamanager under the parent Areamanager's subordinates list
        parentAreamanager.subordinates.push(savedAreamanager._id);
        await parentAreamanager.save();

        // ✅ Referral Transaction (if refId exists)
        if (refId) {
            const referrer = await User.findOne({ _id: refId, isDeleted: false });
            if (referrer) {
                const referralTransaction = await ReferTransaction.create({
                    referredUser: savedAreamanager._id,
                    referredBy: referrer._id,
                    refUserType: role,
                    commissionAmount,
                    status: "pending",
                });

                referrer.referralTransaction.push(referralTransaction._id);
                referrer.subordinates.push(savedAreamanager._id);
                await referrer.save();

                savedAreamanager.referralTransaction.push(referralTransaction._id);
                savedAreamanager.parentId = referrer._id;
                await savedAreamanager.save();
            }
        }

        // ✅ Fetch updated list of child users (Masters under this Areamanager)
        const areamanagerChildren = await fetchAreamanagerChildren(id);

        return res.status(201).json({
            success: true,
            message: "Areamanager created successfully.",
            data: areamanagerChildren,
        });

    } catch (error) {
        console.error("Error creating Areamanager:", error);
        return res.status(500).json({
            success: false,
            message: "Error creating Areamanager",
            error: error.message,
        });
    }
};

const updateAreamanagerChildren = async (req, res) => {
    try {
        const { id, childrenId } = req.params;
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
        if (![id, childrenId].every(mongoose.Types.ObjectId.isValid)) {
            return res.status(400).json({ success: false, message: "Invalid ID format." });
        }

        // ✅ Fetch existing Area Manager Master
        const existingMaster = await User.findOne({ _id: childrenId, role: "master", isDeleted: false });
        if (!existingMaster) {
            return res.status(404).json({ success: false, message: "Master not found or has been deleted." });
        }

        // ✅ Check for duplicate email or phone
        if (email || phone) {
            const duplicateUser = await User.findOne({
                $or: [{ email }, { phone }],
                _id: { $ne: childrenId },
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
        if (refId && refId !== existingMaster.refId?.toString()) {
            referrer = await User.findOne({ _id: refId, isDeleted: false });
            if (!referrer) {
                return res.status(404).json({ success: false, message: "Referrer not found." });
            }
        }

        // ✅ Prepare update object
        const updateFields = {
            firstName,
            lastName,
            email,
            phone,
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : existingMaster.dateOfBirth,
            country,
            state,
            city,
            pinCode,
            address,
            pin: pin || existingMaster.pin,
            password: password || existingMaster.password,
            occupation,
            refId: referrer ? referrer._id : existingMaster.refId,
            commission: commissionAmount != null ? commissionAmount : existingMaster.commission ?? 0,
            note,
            userStatus: userStatus ?? existingMaster.userStatus,
        };

        // ✅ Update Master record
        const updatedMaster = await User.findByIdAndUpdate(childrenId, { $set: updateFields }, { new: true });

        // ✅ Handle referral transactions if refId changed
        if (referrer) {
            const referralTransaction = await ReferTransaction.create({
                referredUser: updatedMaster._id,
                referredBy: referrer._id,
                refUserType: role,
                commissionAmount,
                status: "pending",
            });

            // ✅ Update relationships
            await Promise.all([
                User.findByIdAndUpdate(referrer._id, {
                    $push: { referralTransaction: referralTransaction._id, subordinates: updatedMaster._id }
                }),
                User.findByIdAndUpdate(updatedMaster._id, {
                    $push: { referralTransaction: referralTransaction._id },
                    parentId: referrer._id
                })
            ]);
        }

        // ✅ Fetch updated Master children data
        const MasterChildren = await fetchAreamanagerChildren(id);
        return res.status(200).json({
            success: true,
            message: "Master updated successfully.",
            data: MasterChildren,
        });

    } catch (error) {
        console.error("Error updating Master:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error. Could not update Master.",
            error: error.message,
        });
    }
};

const deleteAreamanagerChildren = async (req, res) => {
    try {
        const { id, childrenId } = req.params;

        // ✅ Validate Mongoose ObjectId format before querying DB
        if (![id, childrenId].every(mongoose.Types.ObjectId.isValid)) {
            return res.status(400).json({ success: false, message: "Invalid ID format." });
        }

        // ✅ Check if the Area Manager (Master) exists and is not already deleted
        const areaManager = await User.findOne({ _id: childrenId, role: "master", isDeleted: false });
        if (!areaManager) {
            return res.status(404).json({ success: false, message: "Master not found or already deleted." });
        }

        // ✅ Check if the Area Manager (Master) has subordinates (Distributors, Retailers, etc.)
        const hasSubordinates = await User.countDocuments({ refId: areaManager._id, isDeleted: false });
        if (hasSubordinates > 0) {
            return res.status(400).json({ success: false, message: "Master has subordinates. Cannot delete." });
        }

        // ✅ Soft delete associated records (wallet transactions, logs, referrals, percentages)
        await Promise.all([
            UserTransaction.updateMany({ _id: { $in: areaManager.walletTransaction } }, { isDeleted: true, deletedAt: new Date() }),
            UserLog.updateMany({ _id: { $in: areaManager.userLogs } }, { isDeleted: true, deletedAt: new Date() }),
            ReferTransaction.updateMany({ _id: { $in: areaManager.referralTransaction } }, { isDeleted: true, deletedAt: new Date() }),
        ]);

        // ✅ Soft delete the Area Manager (Master)
        areaManager.isDeleted = true;
        areaManager.deletedAt = new Date();
        await areaManager.save();

        // ✅ Remove Area Manager (Master) from referrer's subordinates list (if refId exists)
        if (areaManager.refId) {
            await User.findByIdAndUpdate(areaManager.refId, {
                $pull: { subordinates: areaManager._id }
            });
        }

        // ✅ Fetch updated list of admin's children (remaining Masters)
        const AdminChildren = await fetchAreamanagerChildren(id);

        return res.status(200).json({
            success: true,
            message: "Master deleted successfully.",
            data: AdminChildren,
        });

    } catch (error) {
        console.error("Error deleting Master:", error);
        return res.status(500).json({
            success: false,
            message: "Error deleting Master",
            error: error.message,
        });
    }
};

const toggleAreamanagerChildrenStatus = async (req, res) => {
    const userId = req.params.childrenId?.replace(/^:/, "");
    const action = req.params.action?.replace(/^:/, "");
    const mastersId = req.params.id?.replace(/^:/, ""); // Assuming authentication middleware sets req.user

    if (!mongoose.Types.ObjectId.isValid(mastersId)) {
        return res.status(400).json({ success: false, message: "Invalid masters ID format." });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: "Invalid user ID format." });
    }

    try {
        // ✅ Ensure only active masterss can toggle user status
        const masters = await User.findOne({ _id: userId, role: "master", isDeleted: false });
        if (!masters) {
            return res.status(403).json({
                success: false,
                message: "Only active masters users can toggle user status.",
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

        // ✅ Fetch updated list of masterss
        const mastersChildren = await fetchAreamanagerChildren(mastersId);

        return res.status(200).json({
            success: true,
            message: `User ${action}d successfully.`,
            data: mastersChildren,
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

const creditTransferAreamanagerChildren = async (req, res) => {
    const { id, childrenId } = req.params;
    const { userId, password, transferAmount, toUserId } = req.body;

    // ✅ Validate required fields
    if (!userId || !toUserId || !transferAmount) {
        return res.status(400).json({ success: false, message: "All fields are required." });
    }

    // ✅ Validate ObjectIds
    if (![userId, toUserId].every(mongoose.Types.ObjectId.isValid)) {
        return res.status(400).json({ success: false, message: "Invalid user IDs." });
    }

    // ✅ Validate transfer amount
    if (transferAmount <= 0) {
        return res.status(400).json({ success: false, message: "Transfer amount must be greater than zero." });
    }

    try {
        // ✅ Fetch sender (Areamanager)
        const sender = await User.findOne({ _id: userId, userStatus: true, isDeleted: false });
        if (!sender) {
            return res.status(403).json({ success: false, message: "Sender not authorized or inactive." });
        }

        // ✅ Fetch receiver (Must be active and not deleted)
        const receiver = await User.findOne({ _id: toUserId, isDeleted: false });
        if (!receiver) {
            return res.status(404).json({ success: false, message: "Receiver not found or inactive." });
        }

        // ✅ Validate sender's password
        const senderAuth = await User.findById(req.userAuth._id);
        const matchPin = await senderAuth.comparePin(Number(password));
        const matchPassword = await senderAuth.comparePassword(password);
        const matchPinPassword = await senderAuth.comparePinPassword(password);

        if (!matchPin && !matchPassword && !matchPinPassword) {
            return res.status(400).json({ success: false, message: "Invalid password" });
        }

        // ✅ Check sender's balance
        if (sender.walletBalance < transferAmount) {
            return res.status(400).json({ success: false, message: "Insufficient balance." });
        }
        sender.walletBalance -= transferAmount;
        // ✅ Create a new transaction record
        const transaction = new UserTransaction({
            userId,
            toUserId,
            amount: transferAmount,
            transactionType: "transfer",
            status: "pending",
            transactionMessage: `Master ${sender.username} transferred ${transferAmount} to ${receiver.username} (pending).`,
        });
        await transaction.save();

        // ✅ Update sender and receiver's wallet transaction history
        sender.walletTransaction.push(transaction._id);
        receiver.walletTransaction.push(transaction._id);

        // ✅ Log user activity
        await logUserActivity(req, userId, `${sender.username} credited ${transferAmount} to ${receiver.username} (pending)`, "credit");

        // ✅ Save updated user data
        await Promise.all([sender.save(), receiver.save()]);

        // ✅ Fetch updated admin children data
        const AdminChildren = await fetchAreamanagerChildren(id);

        return res.status(200).json({
            success: true,
            message: `Successfully transferred ${transferAmount} to User ${receiver.username}`,
            data: { AdminChildren, receiver },
        });

    } catch (error) {
        console.error("Transaction Error:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

const creditAdjustAreamanagerChildren = async (req, res) => {
    const { userId, toUserId, password, adjustAmount, transactionType, transactionMessage } = req.body;
    const { id, childrenId } = req.params;

    // ✅ Validate required fields
    if (!userId || !toUserId || !adjustAmount || !transactionType || !password) {
        return res.status(400).json({ success: false, message: "All fields are required." });
    }

    // ✅ Validate ObjectIds
    if (![userId, toUserId].every(mongoose.Types.ObjectId.isValid)) {
        return res.status(400).json({ success: false, message: "Invalid user IDs." });
    }

    // ✅ Validate adjustAmount
    if (adjustAmount <= 0) {
        return res.status(400).json({ success: false, message: "Adjustment amount must be greater than zero." });
    }

    // ✅ Validate transactionType
    if (!["debit", "credit"].includes(transactionType)) {
        return res.status(400).json({ success: false, message: "Invalid transaction type. Use 'debit' or 'credit'." });
    }

    try {
        // ✅ Fetch sender (Areamanager)
        let sender = await User.findOne({ _id: userId, userStatus: true, isDeleted: false });
        if (!sender) {
            return res.status(403).json({ success: false, message: "Sender not authorized or inactive." });
        }

        // ✅ Fetch receiver (Must be active and not deleted)
        let receiver = await User.findOne({ _id: toUserId, isDeleted: false });
        if (!receiver) {
            return res.status(404).json({ success: false, message: "Receiver not found or inactive." });
        }

        // ✅ Validate sender's password
        const senderAuth = await User.findById(req.userAuth._id);
        const matchPin = await senderAuth.comparePin(Number(password));
        const matchPassword = await senderAuth.comparePassword(password);
        const matchPinPassword = await senderAuth.comparePinPassword(password);

        if (!matchPin && !matchPassword && !matchPinPassword) {
            return res.status(400).json({ success: false, message: "Invalid password" });
        }

        // ✅ Process credit/debit adjustments
        if (transactionType === "debit") {
            if (sender.walletBalance < adjustAmount) {
                return res.status(400).json({ success: false, message: "Insufficient balance in sender's wallet." });
            }
            sender.walletBalance -= adjustAmount;
        } else if (transactionType === "credit") {
            if (receiver.walletBalance < adjustAmount) {
                return res.status(400).json({ success: false, message: "Insufficient balance in receiver's wallet." });
            }
            receiver.walletBalance -= adjustAmount;
        }

        // ✅ Create a new transaction record
        const transaction = new UserTransaction({
            userId,
            toUserId,
            amount: adjustAmount,
            transactionType,
            status: "pending",
            transactionMessage: transactionMessage ||
                `Master ${sender.username} adjusted ${adjustAmount} ${transactionType} to ${receiver.username} (pending).`,
        });

        await transaction.save();

        // ✅ Update sender and receiver's wallet transaction history
        sender.walletTransaction.push(transaction._id);
        receiver.walletTransaction.push(transaction._id);

        // ✅ Log user activity
        await logUserActivity(req, userId, `${sender.username} adjusted ${adjustAmount} ${transactionType} to ${receiver.username} (pending)`, "adjusted");

        // ✅ Save updated user data
        await Promise.all([sender.save(), receiver.save()]);

        // ✅ Fetch updated admin children data
        const AdminChildren = await fetchAreamanagerChildren(id);

        return res.status(200).json({
            success: true,
            message: `Successfully adjusted ${adjustAmount} ${transactionType} to User ${receiver.username}`,
            data: { AdminChildren, sender, receiver },
        });

    } catch (error) {
        console.error("Error during credit adjustment:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

const getAreamanagerChildrenById = async (req, res) => {
    try {
        const { childrenId } = req.params;

        // ✅ Validate Mongoose ObjectId format before querying DB
        if (!mongoose.Types.ObjectId.isValid(childrenId)) {
            return res.status(400).json({ success: false, message: "Invalid ID format." });
        }

        // ✅ Fetch masters details, ensuring it's not softmasters-deleted
        const children = await User.findOne({ _id: childrenId, role: "master", isDeleted: false })
            .populate("refId")
            .populate("parentId")
            .populate("subordinates",)
            .populate("games")
            .exec();
        // ✅ If masters not found, return 404
        if (!children) {
            return res.status(404).json({ success: false, message: "masters not found." });
        }

        return res.status(200).json({ success: true, data: children });

    } catch (error) {
        console.error("Error fetching masters:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching masters",
            error: error.message,
        });
    }
};

module.exports = {
    createAreamanager,
    getAllAreamanagers,
    getAreamanagerById,
    updateAreamanager,
    deleteAreamanager,
    creditTransfer,
    creditAdjust,
    toggleUserStatus,
    getRoleCount,
    loadcredit,
    getAreamanagerChildrenById,
    getAreamanagerByIdChildren,
    createAreamanagerByIdChildren,
    updateAreamanagerChildren,
    creditTransferAreamanagerChildren,
    creditAdjustAreamanagerChildren,
    toggleAreamanagerChildrenStatus,
    deleteAreamanagerChildren
};