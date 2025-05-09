const { default: mongoose } = require("mongoose");
const Game = require("../models/game.model");
const { User } = require("../models/user.model");
const UserLog = require("../models/userLog.model");
const Percentage = require("../models/percentage.model");
const UserTransaction = require("../models/userTransaction.model");
const ReferTransaction = require("../models/referTransaction.model");
const logUserActivity = require("../libs/userActivity");

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

const fetchAdmins = async (role, id, query = {}, sort = "username", sortOrder = 1, limit = 10, page = 1) => {
    try {
        const adminQuery = {
            role: "admin",
            isDeleted: false, // ✅ Ignore soft-deleted users
            ...query
        };

        let admins = [];

        if (role === "superadmin") {
            // ✅ Superadmin can fetch all admins
            admins = await User.find(adminQuery)
                .populate("refId") // User who created this admin
                .populate("parentId") // Parent reference
                .populate("subordinates") // Subordinates under this admin
                .populate("games") // Associated games
                .sort({ [sort]: sortOrder })
                .skip((page - 1) * limit)
                .limit(parseInt(limit))
                .exec();
        }
        else if (role === "admin") {
            // ✅ Admin can only fetch their own profile
            admins = await User.find({
                _id: new mongoose.Types.ObjectId(id),
                role: "admin",
                isDeleted: false
            })
                .populate("refId")
                .populate("parentId")
                .populate("subordinates")
                .populate("games")
                .exec();
        }

        return admins;
    } catch (error) {
        console.error("Error fetching admins:", error);
        throw new Error("Failed to fetch admins.");
    }
};

const createAdmin = async (req, res) => {
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
            role,
            refId,
            commissionAmount = 0,
            note,
            pin,
            password,
            userStatus = true,
            games = [],
        } = req.body;

        // ✅ Validate required fields
        if (!firstName || !lastName || !email) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields. Please provide firstName, lastName, email."
            });
        }

        // ✅ Check for duplicate phone or email (before proceeding)
        const existingUser = await User.findOne({
            $or: [{ email }],
            isDeleted: false
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: `User with this ${existingUser.phone === phone ? "phone number" : "email"} already exists.`
            });
        }

        if (role && role !== "admin") {
            return res.status(400).json({
                success: false,
                message: "Only admin users can be created using this API."
            });
        }

        // ✅ Validate Games (Ensure all provided game IDs exist)
        let validGames = [];
        if (Array.isArray(games) && games.length > 0) {
            const uniqueGameIds = [...new Set(games)];
            const existingGames = await Game.find({ _id: { $in: uniqueGameIds } });

            const foundGameIds = existingGames.map(game => game._id.toString());
            const missingGameIds = uniqueGameIds.filter(id => !foundGameIds.includes(id));

            if (missingGameIds.length > 0) {
                console.warn("Skipping missing game IDs:", missingGameIds);
            }
            validGames = foundGameIds.map(id => new mongoose.Types.ObjectId(id));
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
            pin,
            password,
            userStatus,
            commission: commissionAmount,
            games: validGames,
            gamepercentage: []
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

        // ✅ Assign Game Percentages
        if (validGames.length > 0) {
            const percentageEntries = await Promise.all(
                validGames.map(async (game) => {
                    const existingPercentage = await Percentage.findOne({ adminId: savedUser._id, gameId: game }).exec();
                    const gameDetails = await Game.findById(game).exec();

                    if (!gameDetails) {
                        console.log(`Game with ID ${game} not found.`);
                        return null;
                    }
                    if (!existingPercentage) {
                        const newPercentage = await Percentage.create({
                            gameId: gameDetails.gameId,
                            gameName: gameDetails.gameName,
                            winpercentage: 0,
                            adminId: savedUser._id
                        });

                        return newPercentage._id;
                    }
                    return null;
                })
            );

            const filteredEntries = percentageEntries.filter(Boolean);
            if (filteredEntries.length > 0) {
                await User.findByIdAndUpdate(savedUser._id, {
                    $set: { gamepercentage: filteredEntries }
                });
            }
        }

        // ✅ Fetch updated admin list
        const admins = await fetchAdmins(req.query.role, req.query.id);
        return res.status(201).json({
            success: true,
            message: "Admin created successfully.",
            data: admins,
        });

    } catch (error) {
        console.error("Error creating admin:", error);
        return res.status(500).json({
            success: false,
            message: "Error creating admin",
            error: error.message,
        });
    }
};

const updateAdmin = async (req, res) => {
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
            role,
            pin,
            password,
            refId,
            commissionAmount,
            note,
            userStatus,
            games
        } = req.body;
        // ✅ Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid admin ID format." });
        }
        // ✅ Check if admin exists
        const existingAdmin = await User.findOne({ _id: id, role: "admin", isDeleted: false });
        if (!existingAdmin) {
            return res.status(404).json({ success: false, message: "Admin not found." });
        }

        // ✅ Check for duplicate email or phone (excluding the current admin)
        if (email || phone) {
            const duplicateUser = await User.findOne({
                $or: [{ email }, { phone }],
                _id: { $ne: id }, // Exclude the current admin from the check
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

        // ✅ Validate Games (if updating games)
        let validGames = existingAdmin.games; // Keep existing games if not updating
        if (Array.isArray(games) && games.length > 0) {
            const uniqueGameIds = [...new Set(games)];
            const existingGames = await Game.find({ _id: { $in: uniqueGameIds } });

            const foundGameIds = existingGames.map(game => game._id.toString());
            const missingGameIds = uniqueGameIds.filter(id => !foundGameIds.includes(id));

            if (missingGameIds.length > 0) {
                console.warn("Skipping missing game IDs:", missingGameIds);
            }
            validGames = foundGameIds.map(id => new mongoose.Types.ObjectId(id));
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
                    commission: commissionAmount ?? existingAdmin.commission,
                    note,
                    userStatus: userStatus ?? existingAdmin.userStatus,
                    games: validGames
                }
            },
            { new: true }
        );

        // ✅ Update referral transactions if refId changed
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

        // ✅ Update Game Percentages (if games changed)
        if (validGames.length > 0) {
            await Percentage.deleteMany({ adminId: updatedAdmin._id });

            const percentageEntries = await Promise.all(
                validGames.map(async (game) => {
                    const gameDetails = await Game.findById(game).exec();
                    if (!gameDetails) return null;

                    const newPercentage = await Percentage.create({
                        gameId: gameDetails.gameId,
                        gameName: gameDetails.gameName,
                        winpercentage: 0,
                        adminId: updatedAdmin._id
                    });

                    return newPercentage._id;
                })
            );

            await User.findByIdAndUpdate(updatedAdmin._id, {
                $set: { gamepercentage: percentageEntries.filter(Boolean) }
            });
        }
        // ✅ Fetch updated admin list after update
        const admins = await fetchAdmins(req.query.role, req.query.id);

        return res.status(200).json({
            success: true,
            message: "Admin updated successfully.",
            data: admins, // Returning updated admin data
        });

    } catch (error) {
        console.error("Error updating admin:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error. Could not update admin.",
            error: error.message,
        });
    }
};

const getAllAdmins = async (req, res) => {
    try {
        const { search = "", sort = "username", order = "asc", id, role } = req.query;

        // ✅ Ensure only active admins are fetched
        let query = { role: "admin", isDeleted: false };

        // ✅ Optimized search across indexed fields
        // if (search) {
        //     query.$or = [
        //         { username: new RegExp(search, "i") },
        //         { email: new RegExp(search, "i") },
        //         { uniqueId: new RegExp(search, "i") },
        //     ];
        // }

        // ✅ Sorting order
        // const sortOrder = order === "desc" ? -1 : 1;

        // ✅ Fetch admins with populated references
        // const admins = await fetchAdmins(query, sort, sortOrder);

        let admins;
        if (role === "superadmin") {
            admins = await User.find(query)
                .populate("refId")
                .populate("parentId")
                .populate("subordinates")
                .populate("games")
                .exec();
        }

        if (role === "admin") {
            query.$and = [
                { role: 'admin' },
                { _id: new mongoose.Types.ObjectId(id) }
            ];
            admins = await User.find(query)
                .populate("refId")
                .populate("parentId")
                .populate("subordinates")
                .populate("games")
                .exec();
        }
        return res.status(200).json({
            success: true,
            data: admins,
        });

    } catch (error) {
        console.error("Error fetching admins:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching admins",
            error: error.message,
        });
    }
};

const getAdminById = async (req, res) => {
    try {
        const { id } = req.params;

        // ✅ Validate Mongoose ObjectId format before querying DB
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid ID format." });
        }

        // ✅ Fetch admin details, ensuring it's not soft-deleted
        const admin = await User.findOne({ _id: id, role: "admin", isDeleted: false })
            .populate("refId")
            .populate("parentId")
            .populate("subordinates",)
            .populate("games")
            .exec();
        // ✅ If admin not found, return 404
        if (!admin) {
            return res.status(404).json({ success: false, message: "Admin not found." });
        }

        return res.status(200).json({ success: true, data: admin });

    } catch (error) {
        console.error("Error fetching admin:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching admin",
            error: error.message,
        });
    }
};

const deleteAdmin = async (req, res) => {
    try {
        const { id } = req.params;

        // ✅ Validate Mongoose ObjectId format before querying DB
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid ID format." });
        }

        // ✅ Check if admin exists and is not already deleted
        const admin = await User.findOne({ _id: id, role: "admin", isDeleted: false });
        if (!admin) {
            return res.status(404).json({ success: false, message: "Admin not found or already deleted." });
        }
        // ✅ Check if admin has any subordinates
        const hasSubordinates = await User.countDocuments({ refId: admin._id });
        if (hasSubordinates > 0) {
            return res.status(400).json({ success: false, message: "Admin has subordinates. Cannot delete." });
        }

        // ✅ Soft delete associated records (wallet transactions, logs, referrals)
        await Promise.all([
            UserTransaction.updateMany({ _id: { $in: admin.walletTransaction } }, { isDeleted: true, deletedAt: new Date() }),
            UserLog.updateMany({ _id: { $in: admin.userLogs } }, { isDeleted: true, deletedAt: new Date() }),
            ReferTransaction.updateMany({ _id: { $in: admin.referralTransaction } }, { isDeleted: true, deletedAt: new Date() }),
        ]);

        // ✅ Soft delete the admin
        admin.isDeleted = true;
        admin.deletedAt = new Date();
        await admin.save();

        // ✅ Soft delete associated records (wallet transactions, logs, referrals, game percentages)
        await Promise.all([
            UserTransaction.updateMany({ _id: { $in: admin.walletTransaction } }, { isDeleted: true, deletedAt: new Date() }),
            UserLog.updateMany({ _id: { $in: admin.userLogs } }, { isDeleted: true, deletedAt: new Date() }),
            ReferTransaction.updateMany({ _id: { $in: admin.referralTransaction } }, { isDeleted: true, deletedAt: new Date() }),
            Percentage.updateMany({ _id: { $in: admin.gamepercentage } }, { isDeleted: true, deletedAt: new Date() }),
        ]);

        // ✅ Remove admin from the referrer's subordinates list (if refId exists)
        if (admin.refId) {
            await User.findByIdAndUpdate(admin.refId, {
                $pull: { subordinates: admin._id }
            });
        }

        // ✅ Fetch updated list of admins
        const admins = await fetchAdmins(req.query.role, req.query.id);

        return res.status(200).json({
            success: true,
            message: "Admin deleted successfully.",
            data: admins,
        });

    } catch (error) {
        console.error("Error deleting admin:", error);
        return res.status(500).json({
            success: false,
            message: "Error deleting admin",
            error: error.message,
        });
    }
};

const creditTransfer = async (req, res) => {
    const { userId, password, transferAmount, toUserId } = req.body;

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
        // ✅ Fetch sender (Admin)
        const senderWallet = await User.findOne({ _id: userId, userStatus: true, isDeleted: false });
        if (!senderWallet) {
            return res.status(403).json({
                success: false,
                message: "Only active users can perform credit transfers.",
            });
        }

        // ✅ Fetch receiver (Must be active and not deleted)
        const receiverWallet = await User.findOne({ _id: toUserId, isDeleted: false })
            .populate("refId")
            .populate("parentId")
            .populate("subordinates",)
            .populate("games")
            .exec();
        if (!receiverWallet) {
            return res.status(404).json({ success: false, message: "Receiver not found or inactive." });
        }

        const UserAuth = await User.findOne({ _id: req.query.id, userStatus: true, isDeleted: false })
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
                transactionMessage: `Admin ${senderWallet.username} adjusted ${transferAmount} transfer to ${receiverWallet.username} pending`,
            });
            await transaction.save();
            senderWallet.walletTransaction.push(transaction._id);
            receiverWallet.walletTransaction.push(transaction._id);
            await logUserActivity(req, userId, `${senderWallet.username} credit ${transferAmount} to ${receiverWallet.username}  pending`, "not Requst", "credit", "not Requst", null);

            await senderWallet.save();
            await receiverWallet.save();
            // ✅ Fetch updated admin list
            const admins = await fetchAdmins(req.query.role, req.query.id);

            return res.status(200).json({
                success: true,
                message: `Successfully transferred ${transferAmount} to User ${receiverWallet.username} pending`,
                data: { admins, receiverWallet, senderWallet },
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
    const { userId, toUserId, password, adjustAmount, transactionType, transactionMessage } = req.body;

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
        // ✅ Fetch sender (Admin)
        let sender = await User.findOne({ _id: userId, userStatus: true, isDeleted: false });
        if (!sender) {
            return res.status(403).json({
                success: false,
                message: "Only active  users can perform credit adjustments.",
            });
        }

        // ✅ Fetch receiver (Must be active and not deleted)
        let receiver = await User.findOne({ _id: toUserId, isDeleted: false })
            .populate("refId")
            .populate("parentId")
            .populate("subordinates",)
            .populate("games")
            .exec();
        if (!receiver) {
            return res.status(404).json({ success: false, message: "Receiver not found or inactive." });
        }
        const UserAuth = await User.findOne({ _id: req.query.id, userStatus: true, isDeleted: false })
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
                        message: "Insufficient balance in self's wallet.",
                    });
                }
                // sender.walletBalance -= adjustAmount;
                // receiver.walletBalance += adjustAmount;
            } else if (transactionType === "credit") {
                if (receiver.walletBalance < adjustAmount) {
                    return res.status(400).json({
                        success: false,
                        message: "Insufficient balance in admin's wallet.",
                    });
                }
                // sender.walletBalance += adjustAmount;
                // receiver.walletBalance -= adjustAmount;
            }

            // ✅ Create a new transaction record
            const transaction = new UserTransaction({
                userId: userId,
                toUserId: toUserId,
                amount: adjustAmount,
                transactionType: transactionType,
                status: "pending",
                transactionMessage:
                    transactionMessage || `Admin ${sender.username} adjusted ${adjustAmount} ${transactionType} to ${receiver.username} pending`,
            });

            await transaction.save();
            sender.walletTransaction.push(transaction._id);
            receiver.walletTransaction.push(transaction._id);
            await logUserActivity(req, userId, `${sender.username} adjusted ${adjustAmount} to ${receiver.username} pending`, "not Requst", "adjusted", "not Requst", null);
            // ✅ Save the updated wallets
            await sender.save();
            await receiver.save();
            // ✅ Fetch updated admin list
            const admins = await fetchAdmins(req.query.role, req.query.id);

            return res.status(200).json({
                success: true,
                message: `Successfully adjusted ${adjustAmount} ${transactionType} to User ${receiver.username} pending`,
                data: { admins, sender, receiver }
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
    const adminId = req.user?.id; // Assuming authentication middleware sets req.user

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: "Invalid user ID format." });
    }

    try {
        // ✅ Ensure only active admins can toggle user status
        const admin = await User.findOne({ _id: userId, role: "admin", isDeleted: false });
        if (!admin) {
            return res.status(403).json({
                success: false,
                message: "Only active admin users can toggle user status.",
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

        // ✅ Fetch updated admin list
        const admins = await fetchAdmins(req.query.role, req.query.id);

        return res.status(200).json({
            success: true,
            message: `User ${action}d successfully.`,
            data: admins,
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



// Childran
const getRoleCount = async (req, res) => {

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
            admin: { total: 0, active: 0, inactive: 0 },
            superdistributor: { total: 0, active: 0, inactive: 0 },
            distributor: { total: 0, active: 0, inactive: 0 },
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
        // console.error("❌ Error in getRoleCount:", error); // Debugging log
        res.status(500).json({
            success: false,
            message: "Error fetching role counts",
            error: error.message,
        });
    }
};

const fetchAdminById = async (id) => {
    return await User.findOne({ _id: id, isDeleted: false })
        .populate("refId")
        .populate("parentId")
        .populate("subordinates")
        .populate("games")
        .lean();
};

const fetchAdminChildren = async (id, sort, sortOrder) => {
    return await User.find({ refId: id, isDeleted: false })
        .populate("refId")
        .populate("parentId")
        .populate("subordinates")
        .populate("games")
        .sort({ [sort]: sortOrder === "asc" ? 1 : -1 })
        .lean();
};

const getAdminByIdChildren = async (req, res) => {
    try {
        const { id } = req.params;
        const { sort = "username", sortOrder = "asc" } = req.query;
        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid user ID" });
        }
        // Fetch user & child users
        const admin = await fetchAdminById(id);
        if (!admin) {
            return res.status(404).json({ success: false, message: "User not found or has been deleted" });
        }
        const children = await fetchAdminChildren(id, sort, sortOrder);
        // Return user and associated users
        return res.status(200).json({
            success: true,
            data: { admin, children }
        });

    } catch (error) {
        // console.error("Error fetching user by ID:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const createAdminByIdChildren = async (req, res) => {
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

        if (role && role !== "superareamanager") {
            return res.status(400).json({
                success: false,
                message: "Only admin users can be created using this API."
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
        // ✅ Fetch updated superdistributor list after creation
        const AdminChildren = await fetchAdminChildren(id);

        return res.status(201).json({
            success: true,
            message: "Admin created successfully.",
            data: AdminChildren,
        });

    } catch (error) {
        console.error("Error creating admin:", error);
        return res.status(500).json({
            success: false,
            message: "Error creating admin",
            error: error.message,
        });
    }
};

const updateAdminChildren = async (req, res) => {
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
        const existingAdmin = await User.findOne({ _id: childrenId, role: "superareamanager", isDeleted: false });
        if (!existingAdmin) {
            return res.status(404).json({ success: false, message: "superareamanager not found or has been deleted." });
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
        const AdminChildren = await fetchAdminChildren(id);
        return res.status(200).json({
            success: true,
            message: "superareamanager updated successfully.",
            data: AdminChildren,
        });

    } catch (error) {
        console.error("Error updating admin:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error. Could not update admin.",
            error: error.message,
        });
    }
};

const deleteAdminChildren = async (req, res) => {
    try {
        const { id, childrenId } = req.params;

        // ✅ Validate Mongoose ObjectId format before querying DB
        if (!mongoose.Types.ObjectId.isValid(childrenId) || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid ID format." });
        }

        // ✅ Check if the superdistributor exists and is not already deleted
        const superdistributor = await User.findOne({ _id: childrenId, role: "superareamanager", isDeleted: false });
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

        // ✅ Fetch updated list of admin's children (remaining superdistributors)
        const AdminChildren = await fetchAdminChildren(id);

        return res.status(200).json({
            success: true,
            message: "superareamanager deleted successfully.",
            data: AdminChildren,
        });

    } catch (error) {
        console.error("Error deleting Superdistributor:", error);
        return res.status(500).json({
            success: false,
            message: "Error deleting superareamanager",
            error: error.message,
        });
    }
};

const toggleAdminChildrenStatus = async (req, res) => {
    const userId = req.params.childrenId?.replace(/^:/, "");
    const action = req.params.action?.replace(/^:/, "");
    const adminId = req.params.id?.replace(/^:/, ""); // Assuming authentication middleware sets req.user

    if (!mongoose.Types.ObjectId.isValid(adminId)) {
        return res.status(400).json({ success: false, message: "Invalid admin ID format." });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: "Invalid user ID format." });
    }

    try {
        // ✅ Ensure only active superdistributors can toggle user status
        const superdistributor = await User.findOne({ _id: userId, role: "superareamanager", isDeleted: false });
        if (!superdistributor) {
            return res.status(403).json({
                success: false,
                message: "Only active superareamanager users can toggle user status.",
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

        // ✅ Fetch updated list of superdistributors
        const AdminChildren = await fetchAdminChildren(adminId);

        return res.status(200).json({
            success: true,
            message: `User ${action}d successfully.`,
            data: AdminChildren,
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

const creditTransferAdminChildren = async (req, res) => {
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
            const AdminChildren = await fetchAdminChildren(id);
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

const creditAdjustAdminChildren = async (req, res) => {
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
                    transactionMessage || `Admin ${sender.username} adjusted ${adjustAmount} ${transactionType} to ${receiver.username} pending`,
            });

            await transaction.save();
            sender.walletTransaction.push(transaction._id);
            receiver.walletTransaction.push(transaction._id);
            await logUserActivity(req, userId, `${sender.username} adjusted ${adjustAmount} to ${receiver.username} pending`, "not Requst", "adjusted", "not Requst", null);
            // ✅ Save the updated wallets
            await sender.save();
            await receiver.save();
            // ✅ Fetch updated admin list
            const AdminChildren = await fetchAdminChildren(id);

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

const getAdminChildrenById = async (req, res) => {
    try {
        const { childrenId } = req.params;

        // ✅ Validate Mongoose ObjectId format before querying DB
        if (!mongoose.Types.ObjectId.isValid(childrenId)) {
            return res.status(400).json({ success: false, message: "Invalid ID format." });
        }

        // ✅ Fetch admin details, ensuring it's not soft-deleted
        const children = await User.findOne({ _id: childrenId, role: "superareamanager", isDeleted: false })
            .populate("refId")
            .populate("parentId")
            .populate("subordinates",)
            .populate("games")
            .exec();
        // ✅ If admin not found, return 404
        if (!children) {
            return res.status(404).json({ success: false, message: "Admin not found." });
        }

        return res.status(200).json({ success: true, data: children });

    } catch (error) {
        console.error("Error fetching admin:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching admin",
            error: error.message,
        });
    }
};

module.exports = {
    loadcredit,

    createAdmin,
    getAllAdmins,
    getAdminById,
    updateAdmin,
    deleteAdmin,
    creditTransfer,
    creditAdjust,
    toggleUserStatus,
    getRoleCount,

    getAdminChildrenById,
    getAdminByIdChildren,
    createAdminByIdChildren,
    updateAdminChildren,
    creditTransferAdminChildren,
    creditAdjustAdminChildren,
    toggleAdminChildrenStatus,
    deleteAdminChildren
};