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

// Get all Superareamanager with filtering, pagination, search, and nested population for hierarchy
const fetchSuperareamanager = async (query = {}, sort = "username", sortOrder = 1) => {
    try {
        const SuperareamanagerQuery = {
            role: "superareamanager",
            isDeleted: false,  // ✅ Ignore soft-deleted users
            ...query
        };

        return await User.find(SuperareamanagerQuery)
            .populate("refId")
            .populate("parentId")
            .populate("subordinates",)
            .sort({ [sort]: sortOrder })
            .exec();
    } catch (error) {
        console.error("Error fetching Superareamanager:", error);
        throw new Error("Failed to fetch Superareamanager.");
    }
};

const getAllSuperareamanager = async (req, res) => {
    try {
        const { search = "", sort = "username", order = "asc", id, role } = req.query;

        // console.log(role,id);

        // ✅ Ensure only active Superareamanagers are fetched
        let query = { isDeleted: false };

        // ✅ Optimized search across indexed fields
        // if (search) {
        //     query.$or = [
        //         { username: new RegExp(search, "i") },
        //         { email: new RegExp(search, "i") },
        //         { uniqueId: new RegExp(search, "i") },
        //     ];
        // }

        // ✅ Sorting order
        let Superareamanagers;
        const sortOrder = order === "desc" ? -1 : 1;
        if (role === "superadmin") {
            query.$and = [
                { role: "superareamanager" },

            ];
            Superareamanagers = await User.find(query)
                .populate('refId', 'username')
                .populate('games')
                .set('strictPopulate', false)
                .exec();
        }

        if (role === "admin") {
            query.$and = [
                { role: "superareamanager" },
                { 'refId': new mongoose.Types.ObjectId(id) }
            ];
            Superareamanagers = await User.find(query)
                .populate('refId', 'username')
                .exec();
        }


        if (role === "superareamanager") {
            query.$and = [
                { role: "superareamanager" },
                { _id: new mongoose.Types.ObjectId(id) }
            ];
            Superareamanagers = await User.find(query)
                .populate('refId', 'username')
                .exec();
        }



        // ✅ Fetch Superareamanagers with populated references
        // const Superareamanagers = await fetchSuperareamanager(query, sort, sortOrder);

        return res.status(200).json({
            success: true,
            data: Superareamanagers,
        });

    } catch (error) {
        console.error("Error fetching Superareamanager:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching Superareamanagers",
            error: error.message,
        });
    }
};

const getSuperareamanagerById = async (req, res) => {
    try {
        const { id } = req.params;

        // ✅ Validate Mongoose ObjectId format before querying DB
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid ID format." });
        }

        // ✅ Fetch Superareamanager details, ensuring it's not soft-deleted
        const Superareamanager = await User.findOne({ _id: id, role: "superareamanager", isDeleted: false })
            .populate("refId")
            .populate("parentId")
            .populate("subordinates")
            .populate("games");

        // ✅ If Superareamanager not found, return 404
        if (!Superareamanager) {
            return res.status(404).json({ success: false, message: "Superareamanager not found." });
        }

        return res.status(200).json({ success: true, data: Superareamanager });

    } catch (error) {
        console.error("Error fetching Superareamanager:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching Superareamanager",
            error: error.message,
        });
    }
};

const createSuperareamanager = async (req, res) => {
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
        // ✅ Check for duplicate phone or email (before proceeding)
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

        if (role && role !== "superareamanager") {
            return res.status(400).json({
                success: false,
                message: "Only superareamanager users can be created using this API."
            });
        }

        // ✅ Create New Admin
        const newAdmin = new User({
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
            pin: pin || existingAdmin.pin,
            password: password || existingAdmin.password,
            userStatus,
            commission: commissionAmount,
        });
        // ✅ Handle Referrer
        let referrer = null;
        if (refId) {
            referrer = await User.findOne({ _id: refId, isDeleted: false });
            if (!referrer) {
                return res.status(404).json({ success: false, message: "Referrer not found." });
            }
            newAdmin.refId = referrer._id;
        }

        // ✅ Save Admin
        const savedUser = await newAdmin.save();

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
        // ✅ Fetch updated Superareamanager list after creation
        const Superareamanagers = await fetchSuperareamanager();

        return res.status(201).json({
            success: true,
            message: "Superareamanager created successfully.",
            data: Superareamanagers,
        });

    } catch (error) {
        console.error("Error creating Superareamanager:", error);
        return res.status(500).json({
            success: false,
            message: "Error creating Superareamanager",
            error: error.message,
        });
    }
};

const updateSuperareamanager = async (req, res) => {
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

        // ✅ Fetch existing admin (superareamanager)
        const existingAdmin = await User.findOne({ _id: id, role: "superareamanager", isDeleted: false });
        if (!existingAdmin) {
            return res.status(404).json({ success: false, message: "superareamanager not found or has been deleted." });
        }

        // ✅ Check for duplicate email or phone (excluding the admin being updated)
        if (email || phone) {
            const duplicateUser = await User.findOne({
                $or: [{ email }, { phone }],
                _id: { $ne: id }, // Exclude the admin being updated
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
        // ✅ Update the admin record
        const updatedAdmin = await User.findByIdAndUpdate(
            id,
            {
                $set: {
                    firstName,
                    lastName,
                    email,
                    phone,
                    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : existingAdmin.dateOfBirth,
                    country,
                    state,
                    city,
                    pinCode,
                    address,
                    pin: pin || existingAdmin.pin,
                    password: password || existingAdmin.password,
                    occupation,
                    refId: referrer ? referrer._id : existingAdmin.refId,
                    commission: commission != null ? commission : existingAdmin.commission ?? 0,
                    note,
                    userStatus: userStatus ?? existingAdmin.userStatus,
                }
            },
            { new: true }
        );

        // ✅ Handle referral transactions if refId changed
        if (refId && refId !== existingAdmin.refId?.toString()) {
            const referralTransaction = await ReferTransaction.create({
                referredUser: updatedAdmin._id,
                referredBy: referrer._id,
                refUserType: role,
                commissionAmount,
                status: "pending",
            });

            referrer.referralTransaction.push(referralTransaction._id);
            referrer.subordinates.push(updatedAdmin._id);
            await referrer.save();

            updatedAdmin.referralTransaction.push(referralTransaction._id);
            updatedAdmin.parentId = referrer._id;
            await updatedAdmin.save();
        }
        const Superareamanagers = await fetchSuperareamanager();
        return res.status(200).json({
            success: true,
            message: "Superareamanager updated successfully.",
            data: Superareamanagers, // Returning only updated Superareamanager data
        });

    } catch (error) {
        console.error("Error updating Superareamanager:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error. Could not update Superareamanager.",
            error: error.message,
        });
    }
};

const deleteSuperareamanager = async (req, res) => {
    try {
        const { id } = req.params;

        // ✅ Validate Mongoose ObjectId format before querying DB
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid ID format." });
        }
        // ✅ Check if the superdistributor exists and is not already deleted
        const superdistributor = await User.findOne({ _id: id, role: "superareamanager", isDeleted: false });
        if (!superdistributor) {
            return res.status(404).json({ success: false, message: "superareamanager not found or already deleted." });
        }

        // ✅ Check if the superdistributor has subordinates (distributors, retailers, etc.)
        const hasSubordinates = await User.countDocuments({ refId: superdistributor._id, isDeleted: false });
        if (hasSubordinates > 0) {
            return res.status(400).json({ success: false, message: "superareamanager has subordinates. Cannot delete." });
        }

        // ✅ Soft delete associated records (wallet transactions, logs, referrals, percentages)
        await Promise.all([
            UserTransaction.updateMany({ _id: { $in: superdistributor.walletTransaction } }, { isDeleted: true, deletedAt: new Date() }),
            UserLog.updateMany({ _id: { $in: superdistributor.userLogs } }, { isDeleted: true, deletedAt: new Date() }),
            ReferTransaction.updateMany({ _id: { $in: superdistributor.referralTransaction } }, { isDeleted: true, deletedAt: new Date() }),
        ]);

        // ✅ Soft delete the superdistributor
        superdistributor.isDeleted = true;
        superdistributor.deletedAt = new Date();
        await superdistributor.save();

        // ✅ Remove superdistributor from referrer's subordinates list (if refId exists)
        if (superdistributor.refId) {
            await User.findByIdAndUpdate(superdistributor.refId, {
                $pull: { subordinates: superdistributor._id }
            });
        }

        // ✅ Fetch updated list of Superareamanagers
        const Superareamanagers = await fetchSuperareamanager();

        return res.status(200).json({
            success: true,
            message: "Superareamanager deleted successfully.",
            data: Superareamanagers,
        });

    } catch (error) {
        console.error("Error deleting Superareamanager:", error);
        return res.status(500).json({
            success: false,
            message: "Error deleting Superareamanager",
            error: error.message,
        });
    }
};

const creditTransfer = async (req, res) => {
    const { userId, password, transferAmount, toUserId, authUser } = req.body;

    if (!userId || !toUserId || !transferAmount) {
        return res.status(400).json({ success: false, message: "All fields are required." });
    }

    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(toUserId)) {
        return res.status(400).json({ success: false, message: "Invalid user IDs." });
    }

    if (transferAmount <= 0) {
        return res.status(400).json({
            success: false,
            message: "Transfer amount must be greater than zero.",
        });
    }

    try {
        // ✅ Fetch sender (superdistributor)
        const senderWallet = await User.findOne({ _id: userId, userStatus: true, isDeleted: false });
        if (!senderWallet) {
            return res.status(403).json({
                success: false,
                message: "Only active users can perform credit transfers.",
            });
        }

        // ✅ Fetch receiver (Must be active and not deleted)
        const receiverWallet = await User.findOne({ _id: toUserId, isDeleted: false });
        if (!receiverWallet) {
            return res.status(404).json({ success: false, message: "Receiver not found or inactive." });
        }

        // ✅ Validate superdistributor's password
        const UserAuth = await User.findOne({ _id: req.userAuth._id, userStatus: true, isDeleted: false })
        const matchPin = await UserAuth.comparePin(Number(password)); // PIN entered
        const matchPassword = await UserAuth.comparePassword(password); // Password
        const matchPinPassword = await UserAuth.comparePinPassword(password); // PIN+Password
        // ✅ Validate admin's password
        if (matchPin || matchPassword || matchPinPassword) {

            // ✅ Check sender's balance
            if (senderWallet.walletBalance < transferAmount) {
                return res.status(400).json({ success: false, message: "Insufficient balance." });
            }


            // ✅ Create a new transaction record
            const transaction = new UserTransaction({
                userId: userId,
                toUserId: toUserId,
                amount: transferAmount,
                transactionType: "transfer",
                status: "pending",
                transactionMessage:
                    transactionMessage || `superareamanager ${sender.username} adjusted ${adjustAmount} transfer to ${receiver.username} pending`,
            });
            await transaction.save();

            senderWallet.walletTransaction.push(transaction._id);
            receiverWallet.walletTransaction.push(transaction._id);
            await logUserActivity(req, userId, `${senderWallet.username} credit ${transferAmount} to ${receiverWallet.username} pending`, "not Requst", "credit", "not Requst", null);

            await senderWallet.save();
            await receiverWallet.save();
            const Superareamanagers = await fetchSuperareamanager();
            return res.status(200).json({
                success: true,
                message: `Successfully transferred ${transferAmount} to User ${receiverWallet.username}`,
                data: { AdminChildren, receiverWallet },
            });
        } else {
            return res.status(400).json({ success: false, message: "Invalid password" });
        }
    } catch (error) {
        console.error("Transaction Error:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

const creditAdjust = async (req, res) => {
    const { userId, toUserId, password, adjustAmount, transactionType, transactionMessage, authUser } = req.body;

    if (!userId || !toUserId || !adjustAmount || !transactionType || !password) {
        return res.status(400).json({ success: false, message: "All fields are required." });
    }

    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(toUserId)) {
        return res.status(400).json({ success: false, message: "Invalid user IDs." });
    }

    if (adjustAmount <= 0) {
        return res.status(400).json({ success: false, message: "Adjustment amount must be greater than zero." });
    }

    if (!["debit", "credit"].includes(transactionType)) {
        return res.status(400).json({ success: false, message: "Invalid transaction type. Use 'debit' or 'credit'." });
    }

    try {
        // ✅ Fetch sender (Superareamanager)
        let sender = await User.findOne({ _id: userId, userStatus: true, isDeleted: false });
        if (!sender) {
            return res.status(403).json({
                success: false,
                message: "Only active  users can perform credit adjustments.",
            });
        }

        // ✅ Fetch receiver (Must be active and not deleted)
        let receiver = await User.findOne({ _id: toUserId, isDeleted: false });
        if (!receiver) {
            return res.status(404).json({ success: false, message: "Receiver not found or inactive." });
        }

        // ✅ Validate superdistributor's password
        const UserAuth = await User.findOne({ _id: req.userAuth._id, userStatus: true, isDeleted: false })
        const matchPin = await UserAuth.comparePin(Number(password)); // PIN entered
        const matchPassword = await UserAuth.comparePassword(password); // Password
        const matchPinPassword = await UserAuth.comparePinPassword(password); // PIN+Password
        // ✅ Validate admin's password
        if (matchPin || matchPassword || matchPinPassword) {

            // ✅ Process credit/debit adjustments
            if (transactionType === "debit") {
                if (sender.walletBalance < adjustAmount) {
                    return res.status(400).json({
                        success: false,
                        message: "Insufficient balance in Superareamanager's wallet.",
                    });
                }
            } else if (transactionType === "credit") {
                if (receiver.walletBalance < adjustAmount) {
                    return res.status(400).json({
                        success: false,
                        message: "Insufficient balance in receiver's wallet.",
                    });
                }
            }

            // ✅ Create a new transaction record
            const transaction = new UserTransaction({
                userId: userId,
                toUserId: toUserId,
                amount: adjustAmount,
                transactionType: transactionType,
                status: "pending",
                transactionMessage:
                    transactionMessage || `Superareamanager ${sender.username} adjusted ${adjustAmount} ${transactionType} to ${receiver.username} pending`,
            });

            await transaction.save();
            sender.walletTransaction.push(transaction._id);
            receiver.walletTransaction.push(transaction._id);
            await logUserActivity(req, userId, `${sender.username} adjusted ${adjustAmount} to ${receiver.username} pending`, "not Requst", "adjusted", "not Requst", null);
            // ✅ Save the updated wallets
            await sender.save();
            await receiver.save();

            // ✅ Fetch updated Superareamanager list
            const Superareamanagers = await fetchSuperareamanager();

            return res.status(200).json({
                success: true,
                message: `Successfully adjusted ${adjustAmount} ${transactionType} to User ${receiver.username}`,
                data: { Superareamanagers, receiver },
            });
        } else {
            return res.status(400).json({ success: false, message: "Invalid password" });
        }
    } catch (error) {
        console.error("Error during credit adjustment:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

const toggleUserStatus = async (req, res) => {
    const userId = req.params.id?.replace(/^:/, "");
    const action = req.params.action?.replace(/^:/, "");
    const SuperareamanagerId = req.user?.id; // Assuming authentication middleware sets req.user

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: "Invalid user ID format." });
    }

    try {
        // ✅ Ensure only active Superareamanagers can toggle user status
        const Superareamanager = await User.findOne({ _id: userId, role: "superareamanager", isDeleted: false });
        if (!Superareamanager) {
            return res.status(403).json({
                success: false,
                message: "Only active Superareamanager users can toggle user status.",
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

        // ✅ Fetch updated Superareamanager list
        const Superareamanagers = await fetchSuperareamanager();

        return res.status(200).json({
            success: true,
            message: `User ${action}d successfully.`,
            data: Superareamanagers,
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
            Superareamanager: { total: 0, active: 0, inactive: 0 },
            areamanager: { total: 0, active: 0, inactive: 0 },
            retailer: { total: 0, active: 0, inactive: 0 },
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
const fetchSuperareamanagerById = async (id) => {
    return await User.findOne({ _id: id, isDeleted: false })
        .populate("refId")
        .populate("parentId")
        .populate("subordinates")
        .populate("games")
        .lean();
};

// Helper function to fetch child users (refId) with sorting
const fetchSuperareamanagerChildren = async (id, sort, sortOrder) => {
    return await User.find({ refId: id, isDeleted: false })
        .populate("refId")
        .populate("parentId")
        .populate("subordinates")
        .populate("games")
        .sort({ [sort]: sortOrder === "asc" ? 1 : -1 })
        .lean();
};

// Main controller function
const getSuperareamanagerByIdChildren = async (req, res) => {
    try {
        const { id } = req.params;
        const { sort = "username", sortOrder = "asc" } = req.query;
        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid user ID" });
        }
        // Fetch user & child users
        const Superareamanager = await fetchSuperareamanagerById(id);
        if (!Superareamanager) {
            return res.status(404).json({ success: false, message: "User not found or has been deleted" });
        }
        const children = await fetchSuperareamanagerChildren(id, sort, sortOrder);
        // Return user and associated users
        return res.status(200).json({
            success: true,
            data: { Superareamanager, children }
        });

    } catch (error) {
        console.error("Error fetching user by ID:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const createSuperareamanagerByIdChildren = async (req, res) => {
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
        if (!firstName || !lastName || !phone || !email || !country || !state || !city || !address) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields. Please provide firstName, lastName, phone, email, country, state, city, and address."
            });
        }
        // ✅ Check for duplicate phone or email (before proceeding)
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

        // ✅ Ensure only 'Superareamanager' role is allowed
        if (role && role !== "areamanager") {
            return res.status(400).json({
                success: false,
                message: "Only areamanager users can be created using this API."
            });
        }

        // ✅ Create New Admin
        const newAdmin = new User({
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
            pin: pin || existingAdmin.pin,
            password: password || existingAdmin.password,
            userStatus,
            commission: commissionAmount,
        });
        // ✅ Handle Referrer
        let referrer = null;
        if (refId) {
            referrer = await User.findOne({ _id: refId, isDeleted: false });
            if (!referrer) {
                return res.status(404).json({ success: false, message: "Referrer not found." });
            }
            newAdmin.refId = referrer._id;
        }

        // ✅ Save Admin
        const savedUser = await newAdmin.save();

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
        // ✅ Fetch updated Superareamanager list after creation
        const areamanagerChildren = await fetchSuperareamanagerChildren(id);

        return res.status(201).json({
            success: true,
            message: "areamanager created successfully.",
            data: areamanagerChildren,
        });

    } catch (error) {
        console.error("Error creating areamanager:", error);
        return res.status(500).json({
            success: false,
            message: "Error creating areamanager",
            error: error.message,
        });
    }
};

const updateSuperareamanagerChildren = async (req, res) => {
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
        if (!mongoose.Types.ObjectId.isValid(childrenId) || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid ID format." });
        }

        // ✅ Fetch existing admin (superareamanager)
        const existingAdmin = await User.findOne({ _id: childrenId, role: "areamanager", isDeleted: false });
        if (!existingAdmin) {
            return res.status(404).json({ success: false, message: "areamanager not found or has been deleted." });
        }

        // ✅ Check for duplicate email or phone (excluding the admin being updated)
        if (email || phone) {
            const duplicateUser = await User.findOne({
                $or: [{ email }, { phone }],
                _id: { $ne: childrenId }, // Exclude the admin being updated
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

        // ✅ Update the admin record
        const updatedAdmin = await User.findByIdAndUpdate(
            childrenId,
            {
                $set: {
                    firstName,
                    lastName,
                    email,
                    phone,
                    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : existingAdmin.dateOfBirth,
                    country,
                    state,
                    city,
                    pinCode,
                    address,
                    pin: pin || existingAdmin.pin,
                    password: password || existingAdmin.password,
                    occupation,
                    refId: referrer ? referrer._id : existingAdmin.refId,
                    commission: commissionAmount != null ? commissionAmount : existingAdmin.commission ?? 0,
                    note,
                    userStatus: userStatus ?? existingAdmin.userStatus,
                }
            },
            { new: true }
        );

        // ✅ Handle referral transactions if refId changed
        if (refId && refId !== existingAdmin.refId?.toString()) {
            const referralTransaction = await ReferTransaction.create({
                referredUser: updatedAdmin._id,
                referredBy: referrer._id,
                refUserType: role,
                commissionAmount,
                status: "pending",
            });

            referrer.referralTransaction.push(referralTransaction._id);
            referrer.subordinates.push(updatedAdmin._id);
            await referrer.save();

            updatedAdmin.referralTransaction.push(referralTransaction._id);
            updatedAdmin.parentId = referrer._id;
            await updatedAdmin.save();
        }

        // ✅ Fetch updated admin children data
        const AdminChildren = await fetchSuperareamanagerChildren(id);
        return res.status(200).json({
            success: true,
            message: "areamanager updated successfully.",
            data: AdminChildren,
        });

    } catch (error) {
        console.error("Error updating areamanager:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error. Could not update admin.",
            error: error.message,
        });
    }
};

const deleteSuperareamanagerChildren = async (req, res) => {
    try {
        const { id, childrenId } = req.params;

        // ✅ Validate Mongoose ObjectId format before querying DB
        if (!mongoose.Types.ObjectId.isValid(childrenId) || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid ID format." });
        }

        // ✅ Check if the superdistributor exists and is not already deleted
        const superdistributor = await User.findOne({ _id: childrenId, role: "areamanager", isDeleted: false });
        if (!superdistributor) {
            return res.status(404).json({ success: false, message: "areamanager not found or already deleted." });
        }

        // ✅ Check if the superdistributor has subordinates (distributors, retailers, etc.)
        const hasSubordinates = await User.countDocuments({ refId: superdistributor._id, isDeleted: false });
        if (hasSubordinates > 0) {
            return res.status(400).json({ success: false, message: "areamanager has subordinates. Cannot delete." });
        }

        // ✅ Soft delete associated records (wallet transactions, logs, referrals, percentages)
        await Promise.all([
            UserTransaction.updateMany({ _id: { $in: superdistributor.walletTransaction } }, { isDeleted: true, deletedAt: new Date() }),
            UserLog.updateMany({ _id: { $in: superdistributor.userLogs } }, { isDeleted: true, deletedAt: new Date() }),
            ReferTransaction.updateMany({ _id: { $in: superdistributor.referralTransaction } }, { isDeleted: true, deletedAt: new Date() }),
        ]);

        // ✅ Soft delete the superdistributor
        superdistributor.isDeleted = true;
        superdistributor.deletedAt = new Date();
        await superdistributor.save();

        // ✅ Remove superdistributor from referrer's subordinates list (if refId exists)
        if (superdistributor.refId) {
            await User.findByIdAndUpdate(superdistributor.refId, {
                $pull: { subordinates: superdistributor._id }
            });
        }

        // ✅ Fetch updated list of admin's children (remaining superdistributors)
        const AdminChildren = await fetchSuperareamanagerChildren(id);

        return res.status(200).json({
            success: true,
            message: "areamanager deleted successfully.",
            data: AdminChildren,
        });

    } catch (error) {
        console.error("Error deleting areamanager:", error);
        return res.status(500).json({
            success: false,
            message: "Error deleting Superareamanager",
            error: error.message,
        });
    }
};

const toggleSuperareamanagerChildrenStatus = async (req, res) => {
    const userId = req.params.childrenId?.replace(/^:/, "");
    const action = req.params.action?.replace(/^:/, "");
    const areamanagerId = req.params.id?.replace(/^:/, ""); // Assuming authentication middleware sets req.user

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: "Invalid areamanager ID format." });
    }

    if (!mongoose.Types.ObjectId.isValid(areamanagerId)) {
        return res.status(400).json({ success: false, message: "Invalid user ID format." });
    }

    try {
        // ✅ Ensure only active Superareamanagers can toggle user status
        const areamanager = await User.findOne({ _id: userId, isDeleted: false });
        console.log(areamanager)
        if (!areamanager) {
            return res.status(403).json({
                success: false,
                message: "Only active areamanager users can toggle user status.",
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

        // ✅ Fetch updated list of Superareamanagers
        const areamanagerChildren = await fetchSuperareamanagerChildren(areamanagerId);

        return res.status(200).json({
            success: true,
            message: `User ${action}d successfully.`,
            data: areamanagerChildren,
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

const creditTransferSuperareamanagerChildren = async (req, res) => {
    const { id, childrenId } = req.params;
    const { userId, password, transferAmount, toUserId, authUser } = req.body;

    if (!userId || !toUserId || !transferAmount) {
        return res.status(400).json({ success: false, message: "All fields are required." });
    }

    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(toUserId)) {
        return res.status(400).json({ success: false, message: "Invalid user IDs." });
    }

    if (transferAmount <= 0) {
        return res.status(400).json({
            success: false,
            message: "Transfer amount must be greater than zero.",
        });
    }

    try {
        // ✅ Fetch sender (superdistributor)
        const senderWallet = await User.findOne({ _id: userId, userStatus: true, isDeleted: false });
        if (!senderWallet) {
            return res.status(403).json({
                success: false,
                message: "Only active users can perform credit transfers.",
            });
        }

        // ✅ Fetch receiver (Must be active and not deleted)
        const receiverWallet = await User.findOne({ _id: toUserId, isDeleted: false });
        if (!receiverWallet) {
            return res.status(404).json({ success: false, message: "Receiver not found or inactive." });
        }

        // ✅ Validate superdistributor's password
        const UserAuth = await User.findOne({ _id: req.userAuth._id, userStatus: true, isDeleted: false })
        const matchPin = await UserAuth.comparePin(Number(password)); // PIN entered
        const matchPassword = await UserAuth.comparePassword(password); // Password
        const matchPinPassword = await UserAuth.comparePinPassword(password); // PIN+Password
        // ✅ Validate admin's password
        if (matchPin || matchPassword || matchPinPassword) {

            // ✅ Check sender's balance
            if (senderWallet.walletBalance < transferAmount) {
                return res.status(400).json({ success: false, message: "Insufficient balance." });
            }


            // ✅ Create a new transaction record
            const transaction = new UserTransaction({
                userId: userId,
                toUserId: toUserId,
                amount: transferAmount,
                transactionType: "transfer",
                status: "pending",
                transactionMessage:
                    transactionMessage || `superareamanager ${sender.username} adjusted ${adjustAmount} transfer to ${receiver.username} pending`,
            });
            await transaction.save();

            senderWallet.walletTransaction.push(transaction._id);
            receiverWallet.walletTransaction.push(transaction._id);
            await logUserActivity(req, userId, `${senderWallet.username} credit ${transferAmount} to ${receiverWallet.username} pending`, "not Requst", "credit", "not Requst", null);

            await senderWallet.save();
            await receiverWallet.save();
            const AdminChildren = await fetchSuperareamanagerChildren(id);
            return res.status(200).json({
                success: true,
                message: `Successfully transferred ${transferAmount} to User ${receiverWallet.username}`,
                data: { AdminChildren, receiverWallet },
            });
        } else {
            return res.status(400).json({ success: false, message: "Invalid password" });
        }

    } catch (error) {
        console.error("Transaction Error:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

const creditAdjustSuperareamanagerChildren = async (req, res) => {
    const { userId, toUserId, password, adjustAmount, transactionType, transactionMessage, authUser } = req.body;
    const { id, childrenId } = req.params;
    if (!userId || !toUserId || !adjustAmount || !transactionType || !password) {
        return res.status(400).json({ success: false, message: "All fields are required." });
    }

    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(toUserId)) {
        return res.status(400).json({ success: false, message: "Invalid user IDs." });
    }

    if (adjustAmount <= 0) {
        return res.status(400).json({ success: false, message: "Adjustment amount must be greater than zero." });
    }

    if (!["debit", "credit"].includes(transactionType)) {
        return res.status(400).json({ success: false, message: "Invalid transaction type. Use 'debit' or 'credit'." });
    }

    try {
        // ✅ Fetch sender (superdistributor)
        let sender = await User.findOne({ _id: userId, userStatus: true, isDeleted: false });
        if (!sender) {
            return res.status(403).json({
                success: false,
                message: "Only active  users can perform credit adjustments.",
            });
        }

        // ✅ Fetch receiver (Must be active and not deleted)
        let receiver = await User.findOne({ _id: toUserId, isDeleted: false });
        if (!receiver) {
            return res.status(404).json({ success: false, message: "Receiver not found or inactive." });
        }

        // ✅ Validate superdistributor's password
        const UserAuth = await User.findOne({ _id: req.userAuth._id, userStatus: true, isDeleted: false })
        const matchPin = await UserAuth.comparePin(Number(password)); // PIN entered
        const matchPassword = await UserAuth.comparePassword(password); // Password
        const matchPinPassword = await UserAuth.comparePinPassword(password); // PIN+Password
        // ✅ Validate admin's password
        if (matchPin || matchPassword || matchPinPassword) {

            // ✅ Process credit/debit adjustments
            if (transactionType === "debit") {
                if (sender.walletBalance < adjustAmount) {
                    return res.status(400).json({
                        success: false,
                        message: "Insufficient balance in superdistributor's wallet.",
                    });
                }
                // sender.walletBalance -= adjustAmount;
                // receiver.walletBalance += adjustAmount;
            } else if (transactionType === "credit") {
                if (receiver.walletBalance < adjustAmount) {
                    return res.status(400).json({
                        success: false,
                        message: "Insufficient balance in receiver's wallet.",
                    });
                }
                // sender.walletBalance += adjustAmount;
                // receiver.walletBalance -= adjustAmount;
            }

            // ✅ Create a new transaction record
            // ✅ Create a new transaction record
            const transaction = new UserTransaction({
                userId: userId,
                toUserId: toUserId,
                amount: adjustAmount,
                transactionType: transactionType,
                status: "pending",
                transactionMessage:
                    transactionMessage || `superareamanager ${sender.username} adjusted ${adjustAmount} ${transactionType} to ${receiver.username} pending`,
            });

            await transaction.save();
            sender.walletTransaction.push(transaction._id);
            receiver.walletTransaction.push(transaction._id);
            await logUserActivity(req, userId, `${sender.username} adjusted ${adjustAmount} to ${receiver.username} pending`, "not Requst", "adjusted", "not Requst", null);
            // ✅ Save the updated wallets
            await sender.save();
            await receiver.save();
            // ✅ Fetch updated admin list
            const AdminChildren = await fetchSuperareamanagerChildren(id);

            return res.status(200).json({
                success: true,
                message: `Successfully adjusted ${adjustAmount} ${transactionType} to User ${receiver.username}`,
                data: { AdminChildren, sender, receiver },
            });
        } else {
            return res.status(400).json({ success: false, message: "Invalid password" });
        }
    } catch (error) {
        console.error("Error during credit adjustment:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

const getSuperareamanagerChildrenById = async (req, res) => {
    try {
        const { childrenId } = req.params;

        // ✅ Validate Mongoose ObjectId format before querying DB
        if (!mongoose.Types.ObjectId.isValid(childrenId)) {
            return res.status(400).json({ success: false, message: "Invalid ID format." });
        }

        // ✅ Fetch Superareamanager details, ensuring it's not soft-deleted
        const children = await User.findOne({ _id: childrenId, role: "areamanager", isDeleted: false })
            .populate("refId")
            .populate("parentId")
            .populate("subordinates",)
            .exec();
        // ✅ If Superareamanager not found, return 404
        if (!children) {
            return res.status(404).json({ success: false, message: `${childrenId} areamanager not found.` });
        }

        return res.status(200).json({ success: true, data: children });

    } catch (error) {
        console.error("Error fetching areamanager:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching areamanager",
            error: error.message,
        });
    }
};

module.exports = {
    loadcredit,
    createSuperareamanager,
    getAllSuperareamanager,
    getSuperareamanagerById,
    updateSuperareamanager,
    deleteSuperareamanager,
    creditTransfer,
    creditAdjust,
    getRoleCount,
    toggleUserStatus,
    getSuperareamanagerChildrenById,
    getSuperareamanagerByIdChildren,
    createSuperareamanagerByIdChildren,
    updateSuperareamanagerChildren,
    creditTransferSuperareamanagerChildren,
    creditAdjustSuperareamanagerChildren,
    toggleSuperareamanagerChildrenStatus,
    deleteSuperareamanagerChildren
};