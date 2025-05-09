const { default: mongoose } = require("mongoose");
const { User } = require("../models/user.model");
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

const fetchSuperadmins = async (query = {}, sort = "username", sortOrder = 1) => {
    try {
        const superadminQuery = {
            role: "superadmin",
            isDeleted: false,  // ✅ Ignore soft-deleted users
            ...query
        };

        return await User.find(superadminQuery)
            .populate("refId")
            .populate("parentId")
            .populate("subordinates",)
            .sort({ [sort]: sortOrder })
            .exec();
    } catch (error) {
        console.error("Error fetching superadmins:", error);
        throw new Error("Failed to fetch superadmins.");
    }
    
};

const createSuperadmin = async (req, res) => {
    try {
        const {
            username,
            password,
            role,
            refId,
            commissionAmount = 0,
            note,
            userStatus = true,
        } = req.body;
        console.log(req.body);
        // ✅ Validate required fields
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: "Username and password are required."
            });
        }

        // ✅ Ensure only 'superadmin' role is allowed
        if (role && role !== "superadmin") {
            return res.status(400).json({
                success: false,
                message: "Only superadmin users can be created using this API."
            });
        }

        // ✅ Check if an active superadmin already exists with the same username
        const existingsuperadmin = await User.findOne({ username, isDeleted: false });
        if (existingsuperadmin) {
            return res.status(400).json({
                success: false,
                message: "superadmin with this username already exists."
            });
        }

        // ✅ Encrypt password before saving
        const hashedPassword = await User.encryptPassword(password);

        // ✅ Create a new superadmin user
        const newsuperadmin = new User({
            username,
            email: `${username}@gmail.com`,
            password: hashedPassword,
            uniqueId: `${username}1`,
            role,
            note,
            userStatus,
            commission: commissionAmount,
        });
        // ✅ Check if referrer exists
        let referrer = null;
        if (refId) {
            referrer = await User.findOne({ _id: refId, isDeleted: { $ne: true } });
            if (!referrer) {
                return res.status(404).json({ success: false, message: "Referrer not found." });
            }
            newsuperadmin.refId = referrer._id;
        }
        await newsuperadmin.save();
        // ✅ Handle referral transaction if refId exists
        if (refId) {
            const referralTransaction = await ReferTransaction.create({
                referredUser: newsuperadmin._id,
                referredBy: referrer._id,
                refUserType: role,
                commissionAmount,
                status: "paid",
            });

            referrer.referralTransaction.push(referralTransaction._id);
            referrer.subordinates.push(newsuperadmin._id);
            await referrer.save();

            newsuperadmin.referralTransaction.push(referralTransaction._id);
            newsuperadmin.parentId = referrer._id;
            await newsuperadmin.save();
        }

        // ✅ Fetch updated superadmin list after creation
        const superadmins = await fetchSuperadmins();

        return res.status(201).json({
            success: true,
            message: "superadmin created successfully.",
            data: superadmins,
        });

    } catch (error) {
        console.error("Error creating superadmin:", error);
        return res.status(500).json({
            success: false,
            message: "Error creating superadmin",
            error: error.message,
        });
    }
};

const getAllSuperadmins = async (req, res) => {
    try {
        const { search = "", sort = "username", order = "asc" } = req.query;

        // ✅ Ensure only active superadmins are fetched
        let query = { role: "superadmin", isDeleted: false };

        // ✅ Optimized search across indexed fields
        if (search) {
            query.$or = [
                { username: new RegExp(search, "i") },
                { email: new RegExp(search, "i") },
                { uniqueId: new RegExp(search, "i") },
            ];
        }

        // ✅ Sorting order
        const sortOrder = order === "desc" ? -1 : 1;

        // ✅ Fetch superadmins with populated references
        const superadmins = await fetchSuperadmins(query, sort, sortOrder);

        return res.status(200).json({
            success: true,
            data: superadmins,
        });

    } catch (error) {
        console.error("Error fetching superadmins:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching superadmins",
            error: error.message,
        });
    }
};

const getSuperadminById = async (req, res) => {
    try {
        const { id } = req.params;

        // ✅ Validate Mongoose ObjectId format before querying DB
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid ID format." });
        }

        // ✅ Fetch superadmin details, ensuring it's not soft-deleted
        const superadmin = await User.findOne({ _id: id, role: "superadmin", isDeleted: false })
            .populate("refId")
            .populate("parentId")
            .populate("subordinates",)
            .populate("games")
            .exec();
        // ✅ If superadmin not found, return 404
        if (!superadmin) {
            return res.status(404).json({ success: false, message: "superadmin not found." });
        }

        return res.status(200).json({ success: true, data: superadmin });

    } catch (error) {
        console.error("Error fetching superadmin:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching superadmin",
            error: error.message,
        });
    }
};

const updateSuperadmin = async (req, res) => {
    try {
        const { id } = req.params;
        const { password, note, userStatus, refId, commission } = req.body;

        // ✅ Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid ID format." });
        }

        // ✅ Fetch superadmin, ensuring it's active (not soft-deleted)
        const superadmin = await User.findOne({ _id: id, role: "superadmin", isDeleted: false });
        if (!superadmin) {
            return res.status(404).json({ success: false, message: "superadmin not found or has been deleted." });
        }


        // ✅ Validate & Update Password
        if (password) {
            // ✅ Encrypt password before saving
            const hashedPassword = await User.encryptPassword(password);
            superadmin.password = hashedPassword;
        }

        // ✅ Validate & Update Referrer
        if (refId) {
            const referrer = await User.findOne({ _id: req.body.refId, isDeleted: { $ne: true } });
            if (!referrer) {
                return res.status(404).json({ success: false, message: "Referrer not found." });
            }
            superadmin.refId = referrer._id;
        }
        // ✅ Update Fields (Only If Provided)
        if (note) superadmin.note = note;
        if (userStatus !== undefined) superadmin.userStatus = userStatus;
        if (commission !== undefined) superadmin.commission = commission;

        await superadmin.save();
        // ✅ Fetch updated superadmin list after creation
        const superadmins = await fetchSuperadmins();
        return res.status(200).json({
            success: true,
            message: "superadmin updated successfully.",
            data: superadmins, // Returning only updated superadmin data
        });

    } catch (error) {
        console.error("Error updating superadmin:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error. Could not update superadmin.",
            error: error.message,
        });
    }
};

const deleteSuperadmin = async (req, res) => {
    try {
        const { id } = req.params;

        // ✅ Validate Mongoose ObjectId format before querying DB
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid ID format." });
        }

        // ✅ Check if superadmin exists and is not already deleted
        const superadmin = await User.findOne({ _id: id, role: "superadmin", isDeleted: false });
        if (!superadmin) {
            return res.status(404).json({ success: false, message: "superadmin not found or already deleted." });
        }

        // ✅ Soft delete (mark as deleted instead of removing from DB)
        superadmin.isDeleted = true;
        superadmin.deletedAt = new Date();
        await superadmin.save();

        // ✅ Fetch updated list of superadmins
        const superadmins = await fetchSuperadmins();

        return res.status(200).json({
            success: true,
            message: "superadmin deleted successfully.",
            data: superadmins,
        });

    } catch (error) {
        console.error("Error deleting superadmin:", error);
        return res.status(500).json({
            success: false,
            message: "Error deleting superadmin",
            error: error.message,
        });
    }
};

const creditTransfer = async (req, res) => {
    const { userId, password, transferAmount, toUserId, authUser } = req.body;

    console.log(userId, toUserId);

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
        // ✅ Fetch sender (superadmin)
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

        // ✅ Validate superadmin's password
        if (password) {
            const isPasswordValid = await User.comparePassword(password, authUser.password);
            if (!isPasswordValid) {
                return res.status(400).json({ success: false, message: "Invalid password" });
            }
        }

        // ✅ Check sender's balance
        if (senderWallet.walletBalance < transferAmount) {
            return res.status(400).json({ success: false, message: "Insufficient balance." });
        }

        // ✅ Perform balance update
        senderWallet.walletBalance -= transferAmount;
        receiverWallet.walletBalance += transferAmount;


        // ✅ Create transaction records
        const senderTransaction = new UserTransaction({
            userId,
            toUserId,
            amount: -transferAmount,
            transactionType: "transfer",
            status: "completed",
            transactionMessage: `superadmin ${senderWallet.username} transferred ${transferAmount} to User ${receiverWallet.username}`,
        });

        const receiverTransaction = new UserTransaction({
            userId: toUserId,
            toUserId: userId,
            amount: transferAmount,
            transactionType: "transfer",
            status: "completed",
            transactionMessage: `User ${receiverWallet.username} received ${transferAmount} from superadmin ${senderWallet.username}`,
        });

        await senderTransaction.save();
        await receiverTransaction.save();
        senderWallet.walletTransaction.push(senderTransaction._id);
        receiverWallet.walletTransaction.push(receiverTransaction._id);
        await logUserActivity(req, userId, `${senderWallet.username} credit ${transferAmount} to ${receiverWallet.username}`, "not Requst", "credit", "not Requst", null);

        await senderWallet.save();
        await receiverWallet.save();
        // ✅ Fetch updated superadmin list
        const superadmins = await fetchSuperadmins();

        return res.status(200).json({
            success: true,
            message: `Successfully transferred ${transferAmount} to User ${receiverWallet.username}`,
            data: superadmins,
        });

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
        // ✅ Fetch sender (superadmin)
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

        // ✅ Validate superadmin's password
        if (password) {
            const isPasswordValid = await User.comparePassword(password, authUser.password);
            if (!isPasswordValid) {
                return res.status(400).json({ success: false, message: "Invalid password" });
            }
        }

        // ✅ Process credit/debit adjustments
        if (transactionType === "debit") {
            if (sender.walletBalance < adjustAmount) {
                return res.status(400).json({
                    success: false,
                    message: "Insufficient balance in superadmin's wallet.",
                });
            }
            sender.walletBalance -= adjustAmount;
            receiver.walletBalance += adjustAmount;
        } else if (transactionType === "credit") {
            if (receiver.walletBalance < adjustAmount) {
                return res.status(400).json({
                    success: false,
                    message: "Insufficient balance in receiver's wallet.",
                });
            }
            sender.walletBalance += adjustAmount;
            receiver.walletBalance -= adjustAmount;
        }

        // ✅ Create a new transaction record
        const transaction = new UserTransaction({
            userId: userId,
            toUserId: toUserId,
            amount: adjustAmount,
            transactionType: transactionType,
            status: "completed",
            transactionMessage:
                transactionMessage || `superadmin ${sender.username} adjusted ${adjustAmount} ${transactionType} to ${receiver.username}`,
        });

        await transaction.save();
        sender.walletTransaction.push(transaction._id);
        receiver.walletTransaction.push(transaction._id);
        // Log the activity
        await logUserActivity(req, userId, `${sender.username} adjusted ${adjustAmount} to ${receiver.username}`, "not Requst", "adjusted", "not Requst", null);

        // ✅ Save the updated wallets
        await sender.save();
        await receiver.save();
        // ✅ Fetch updated superadmin list
        const superadmins = await fetchSuperadmins();

        return res.status(200).json({
            success: true,
            message: `Successfully adjusted ${adjustAmount} ${transactionType} to User ${receiver.username}`,
            data: superadmins,
        });

    } catch (error) {
        console.error("Error during credit adjustment:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

const toggleUserStatus = async (req, res) => {
    const userId = req.params.id?.replace(/^:/, "");
    const action = req.params.action?.replace(/^:/, "");
    const superadminId = req.user?.id; // Assuming authentication middleware sets req.user

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: "Invalid user ID format." });
    }

    try {
        // ✅ Ensure only active superadmins can toggle user status
        const superadmin = await User.findOne({ _id: userId, role: "superadmin", isDeleted: false });
        if (!superadmin) {
            return res.status(403).json({
                success: false,
                message: "Only active superadmin users can toggle user status.",
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

        // ✅ Fetch updated superadmin list
        const superadmins = await fetchSuperadmins();

        return res.status(200).json({
            success: true,
            message: `User ${action}d successfully.`,
            data: superadmins,
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
            superadmin: { total: 0, active: 0, inactive: 0 },
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
        console.error("❌ Error in getRoleCount:", error); // Debugging log
        res.status(500).json({
            success: false,
            message: "Error fetching role counts",
            error: error.message,
        });
    }
};

const fetchSuperAdminById = async (id) => {
    return await User.findOne({ _id: id, isDeleted: false })
        .populate("refId")
        .populate("parentId")
        .populate("subordinates")
        .populate("games")
        .lean();
};

const fetchSuperAdminChildren = async (id, sort, sortOrder) => {
    return await User.find({ refId: id, isDeleted: false })
        .populate("refId")
        .populate("parentId")
        .populate("subordinates")
        .populate("games")
        .sort({ [sort]: sortOrder === "asc" ? 1 : -1 })
        .lean();
};

const getSuperAdminByIdChildren = async (req, res) => {
    try {
        const { id } = req.params;
        const { sort = "username", sortOrder = "asc" } = req.query;
        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid user ID" });
        }
        // Fetch user & child users
        const admin = await fetchSuperAdminById(id);
        if (!admin) {
            return res.status(404).json({ success: false, message: "User not found or has been deleted" });
        }
        const children = await fetchSuperAdminChildren(id, sort, sortOrder);
        // Return user and associated users
        return res.status(200).json({
            success: true,
            data: { admin, children }
        });

    } catch (error) {
        console.error("Error fetching user by ID:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const createSuperAdminByIdChildren = async (req, res) => {
    try {
        const {
            username,
            password,
            role,
            refId,
            commissionAmount = 0,
            note,
            userStatus = true,
            games = []
        } = req.body;

        // ✅ Validate required fields
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: "Username and password are required."
            });
        }

        // ✅ Ensure only 'admin' role is allowed
        if (role && role !== "admin") {
            return res.status(400).json({
                success: false,
                message: "Only admin users can be created using this API."
            });
        }

        // ✅ Check if an active admin already exists with the same username
        const existingAdmin = await User.findOne({ username, isDeleted: false });
        if (existingAdmin) {
            return res.status(400).json({
                success: false,
                message: "Admin with this username already exists."
            });
        }

        // ✅ Encrypt password before saving
        const hashedPassword = await User.encryptPassword(password);

        // ✅ Validate games
        let validGames = [];
        if (Array.isArray(games) && games.length > 0) {
            const uniqueGameIds = [...new Set(games)];
            const existingGames = await Game.find({ _id: { $in: uniqueGameIds } });

            // ✅ Identify valid and missing game IDs
            const foundGameIds = existingGames.map(game => game._id.toString());
            const missingGameIds = uniqueGameIds.filter(id => !foundGameIds.includes(id));

            if (missingGameIds.length > 0) {
                return res.status(404).json({
                    success: false,
                    message: "Some games were not found.",
                    missingGames: missingGameIds
                });
            }
            validGames = foundGameIds;
        }

        // ✅ Create a new admin user
        const newAdmin = new User({
            username,
            email: `${username}@gmail.com`,
            password: hashedPassword,
            uniqueId: `${username}1`,
            role,
            note,
            userStatus,
            commission: commissionAmount,
            games: validGames,
            gamepercentage: [] // Initialize the array
        });

        // ✅ Check if referrer exists
        let referrer = null;
        if (refId) {
            referrer = await User.findOne({ _id: refId, isDeleted: { $ne: true } });
            if (!referrer) {
                return res.status(404).json({ success: false, message: "Referrer not found." });
            }
            newAdmin.refId = referrer._id;
        }

        const savedUser = await newAdmin.save();

        // ✅ Handle referral transaction if refId exists
        if (refId) {
            const referralTransaction = await ReferTransaction.create({
                referredUser: savedUser._id,
                referredBy: referrer._id,
                refUserType: role,
                commissionAmount,
                status: "paid",
            });

            referrer.referralTransaction.push(referralTransaction._id);
            referrer.subordinates.push(savedUser._id);
            await referrer.save();

            savedUser.referralTransaction.push(referralTransaction._id);
            savedUser.parentId = referrer._id;
            await savedUser.save();
        }

        // ✅ Assign default percentage for each game & push IDs into `gamepercentage`
        let percentageEntries = [];

        if (Array.isArray(validGames) && validGames.length > 0) {
            for (const game of validGames) {
                const check = await Percentage.findOne({ adminId: savedUser._id, gameId: game }).exec();

                // Find the game by its _id
                const findGameId = await Game.findOne({ _id: game }).exec();

                if (!findGameId) {
                    console.log(`Game with ID ${game} not found.`);
                    continue; // Skip if game is not found
                }

                // If no Percentage entry exists for this game and admin, create it
                if (!check) {
                    const newPercentage = await Percentage.create({
                        gameId: findGameId._id, // Correct reference to the game
                        winpercentage: 0,
                        adminId: savedUser._id // Correct reference to the admin
                    });

                    percentageEntries.push(newPercentage._id); // Collect the percentage IDs
                }
            }
        }

        // ✅ Push gamepercentage IDs to the admin document
        if (percentageEntries.length > 0) {
            savedUser.gamepercentage = percentageEntries;
            await savedUser.save();
        }

        // ✅ Fetch updated admin list after creation
        const admins = await fetchAdmins();

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

const updateSuperAdminChildren = async (req, res) => {
    try {
        const { id } = req.params;
        const { password, note, userStatus, refId, commission, games = [] } = req.body;
        // ✅ Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid ID format." });
        }

        // ✅ Fetch admin, ensuring it's active (not soft-deleted)
        const admin = await User.findOne({ _id: id, role: "admin", isDeleted: false });
        if (!admin) {
            return res.status(404).json({ success: false, message: "Admin not found or has been deleted." });
        }

        // ✅ Validate & Update Games
        let validGames = [];
        if (Array.isArray(games) && games.length > 0) {
            const uniqueGameIds = [...new Set(games)];

            // Validate ObjectIds
            const invalidGameIds = uniqueGameIds.filter(gameId => !mongoose.Types.ObjectId.isValid(gameId));
            if (invalidGameIds.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid game ID(s) provided.",
                    invalidIds: invalidGameIds,
                });
            }

            // Fetch valid games from the database
            const existingGames = await Game.find({ _id: { $in: uniqueGameIds } });

            // Identify missing game IDs
            const foundGameIds = existingGames.map(game => game._id.toString());
            const missingGameIds = uniqueGameIds.filter(gameId => !foundGameIds.includes(gameId));

            if (missingGameIds.length > 0) {
                return res.status(404).json({
                    success: false,
                    message: "Some games were not found.",
                    missingGames: missingGameIds,
                });
            }

            validGames = foundGameIds;

            // ✅ Remove game percentages for games that were removed
            const gamesToRemove = admin.games.filter(game => !validGames.includes(game));
            if (gamesToRemove.length > 0) {
                await Percentage.deleteMany({ adminId: admin._id, gameId: { $in: gamesToRemove } });
                console.log(`Removed percentages for games: ${gamesToRemove}`);
            }

            // ✅ Assign only valid game IDs AFTER removing percentages
            admin.games = validGames;
        }

        // ✅ Validate & Update Password
        if (password) {
            const hashedPassword = await User.encryptPassword(password);
            admin.password = hashedPassword;
        }

        // ✅ Validate & Update Referrer
        if (refId) {
            const referrer = await User.findOne({ _id: refId, isDeleted: { $ne: true } });
            if (!referrer) {
                return res.status(404).json({ success: false, message: "Referrer not found." });
            }
            admin.refId = referrer._id;
        }

        // ✅ Update Fields (Only If Provided)
        if (note) admin.note = note;
        if (userStatus !== undefined) admin.userStatus = userStatus;
        if (commission !== undefined) admin.commission = commission;

        await admin.save();

        // ✅ Add default percentage for new games
        if (Array.isArray(validGames) && validGames.length > 0) {
            for (const game of validGames) {
                const check = await Percentage.findOne({ adminId: admin._id, gameId: game }).exec();

                // Find the game by its _id
                const findGameId = await Game.findOne({ _id: game }).exec();
                if (!findGameId) {
                    console.log(`Game with ID ${game} not found.`);
                    continue; // Skip if game is not found
                }

                // If no Percentage entry exists for this game and admin, create it
                if (!check) {
                    await Percentage.create({
                        gameId: findGameId.gameId, // Correct reference to the game
                        winpercentage: 0,
                        adminId: admin._id // Correct reference to the admin
                    });
                    console.log(`Added percentage for game: ${game}`);
                }
            }
        }

        // ✅ Fetch updated admin list after update
        const admins = await fetchAdmins();

        return res.status(200).json({
            success: true,
            message: "Admin updated successfully.",
            data: admins, // Returning only updated admin data
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

const deleteSuperAdminChildren = async (req, res) => {
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

        // ✅ Soft delete (mark as deleted instead of removing from DB)
        admin.isDeleted = true;
        admin.deletedAt = new Date();
        await admin.save();

        // ✅ Fetch updated list of admins
        const admins = await fetchAdmins();

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

const toggleSuperAdminChildrenStatus = async (req, res) => {
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
        const superdistributor = await User.findOne({ _id: userId, role: "superdistributor", isDeleted: false });
        if (!superdistributor) {
            return res.status(403).json({
                success: false,
                message: "Only active superdistributor users can toggle user status.",
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

const creditTransferSuperAdminChildren = async (req, res) => {
    const { id, childrenId } = req.params;
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
        if (password) {
            const isPasswordValid = await User.comparePassword(password, senderWallet.password);
            if (!isPasswordValid) {
                return res.status(400).json({ success: false, message: "Invalid password" });
            }
        }

        // ✅ Check sender's balance
        if (senderWallet.walletBalance < transferAmount) {
            return res.status(400).json({ success: false, message: "Insufficient balance." });
        }

        // ✅ Perform balance update
        senderWallet.walletBalance -= transferAmount;
        receiverWallet.walletBalance += transferAmount;


        // ✅ Create transaction records
        const senderTransaction = new UserTransaction({
            userId,
            toUserId,
            amount: -transferAmount,
            transactionType: "transfer",
            status: "completed",
            transactionMessage: `superdistributor ${senderWallet.username} transferred ${transferAmount} to User ${receiverWallet.username}`,
        });

        const receiverTransaction = new UserTransaction({
            userId: toUserId,
            toUserId: userId,
            amount: transferAmount,
            transactionType: "transfer",
            status: "completed",
            transactionMessage: `User ${receiverWallet.username} received ${transferAmount} from Admin ${senderWallet.username}`,
        });

        await senderTransaction.save();
        await receiverTransaction.save();
        senderWallet.walletTransaction.push(senderTransaction._id);
        receiverWallet.walletTransaction.push(receiverTransaction._id);
        await logUserActivity(req, userId, `${senderWallet.username} credit ${transferAmount} to ${receiverWallet.username}`, "not Requst", "credit", "not Requst", null);
        await senderWallet.save();
        await receiverWallet.save();
        const AdminChildren = await fetchAdminChildren(id);
        return res.status(200).json({
            success: true,
            message: `Successfully transferred ${transferAmount} to User ${receiverWallet.username}`,
            data: { AdminChildren, receiverWallet },
        });

    } catch (error) {
        console.error("Transaction Error:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

const creditAdjustSuperAdminChildren = async (req, res) => {
    const { userId, toUserId, password, adjustAmount, transactionType, transactionMessage } = req.body;
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
        if (password) {
            const isPasswordValid = await User.comparePassword(password, sender.password);
            if (!isPasswordValid) {
                return res.status(400).json({ success: false, message: "Invalid password" });
            }
        }

        // ✅ Process credit/debit adjustments
        if (transactionType === "debit") {
            if (sender.walletBalance < adjustAmount) {
                return res.status(400).json({
                    success: false,
                    message: "Insufficient balance in superdistributor's wallet.",
                });
            }
            sender.walletBalance -= adjustAmount;
            receiver.walletBalance += adjustAmount;
        } else if (transactionType === "credit") {
            if (receiver.walletBalance < adjustAmount) {
                return res.status(400).json({
                    success: false,
                    message: "Insufficient balance in receiver's wallet.",
                });
            }
            sender.walletBalance += adjustAmount;
            receiver.walletBalance -= adjustAmount;
        }

        // ✅ Create a new transaction record
        const transaction = new UserTransaction({
            userId: userId,
            toUserId: toUserId,
            amount: adjustAmount,
            transactionType: transactionType,
            status: "completed",
            transactionMessage:
                transactionMessage || `superdistributor ${sender.username} adjusted ${adjustAmount} ${transactionType} to ${receiver.username}`,
        });

        await transaction.save();
        sender.walletTransaction.push(transaction._id);
        receiver.walletTransaction.push(transaction._id);
        // ✅ Save the updated wallets
        await logUserActivity(req, userId, `${sender.username} adjusted ${adjustAmount} to ${receiver.username}`, "not Requst", "adjusted", "not Requst", null);
       
        await sender.save();
        await receiver.save();


        // ✅ Fetch updated admin list
        const AdminChildren = await fetchAdminChildren(id);

        return res.status(200).json({
            success: true,
            message: `Successfully adjusted ${adjustAmount} ${transactionType} to User ${receiver.username}`,
            data: { AdminChildren, receiver },
        });

    } catch (error) {
        console.error("Error during credit adjustment:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

const getSuperAdminChildrenById = async (req, res) => {
    try {
        const { childrenId } = req.params;

        // ✅ Validate Mongoose ObjectId format before querying DB
        if (!mongoose.Types.ObjectId.isValid(childrenId)) {
            return res.status(400).json({ success: false, message: "Invalid ID format." });
        }

        // ✅ Fetch admin details, ensuring it's not soft-deleted
        const children = await User.findOne({ _id: childrenId, role: "admin", isDeleted: false })
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
    createSuperadmin,
    getAllSuperadmins,
    getSuperadminById,
    updateSuperadmin,
    deleteSuperadmin,
    creditTransfer,
    creditAdjust,
    toggleUserStatus,
    getRoleCount,
    getSuperAdminChildrenById,
    getSuperAdminByIdChildren,
    createSuperAdminByIdChildren,
    updateSuperAdminChildren,
    creditTransferSuperAdminChildren,
    creditAdjustSuperAdminChildren,
    toggleSuperAdminChildrenStatus,
    deleteSuperAdminChildren
};