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

const fetchMasters = async (query = {}, sort = "username", sortOrder = 1) => {
    try {
        const MasterQuery = {
            role: "master",
            isDeleted: false,  // ✅ Ignore soft-deleted users
            ...query
        };

        return await User.find(MasterQuery)
            .populate("refId")
            .populate("parentId")
            .populate("subordinates",)
            .sort({ [sort]: sortOrder })
            .exec();
    } catch (error) {
        console.error("Error fetching Masters:", error);
        throw new Error("Failed to fetch Masters.");
    }
};

const createMaster = async (req, res) => {
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
        if (role && role !== "master") {
            return res.status(400).json({
                success: false,
                message: "Only Master (Area Manager Child) can be created using this API."
            });
        }

        // ✅ Check if a Master with the same email already exists
        const existingMaster = await User.findOne({ email, isDeleted: false });
        if (existingMaster) {
            return res.status(400).json({
                success: false,
                message: "Master with this email already exists."
            });
        }

        // ✅ Create New Master (Area Manager Child)
        const newMaster = new User({
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
            newMaster.refId = referrer._id;
        }

        // ✅ Save Master (Area Manager Child)
        const savedUser = await newMaster.save();

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

        // ✅ Fetch updated list of Masters after creation
        const Masters = await fetchMasters();

        return res.status(201).json({
            success: true,
            message: "Master (Area Manager Child) created successfully.",
            data: Masters,
        });

    } catch (error) {
        console.error("Error creating Master:", error);
        return res.status(500).json({
            success: false,
            message: "Error creating Master",
            error: error.message,
        });
    }
};

const getAllMasters = async (req, res) => {
    try {
        const { search = "", sort = "username", order = "asc", role, id } = req.query;

        // ✅ Ensure only active Masters are fetched
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
        const sortOrder = order === "desc" ? -1 : 1;

        // ✅ Fetch Masters with populated references
        // const Masters = await fetchMasters(query, sort, sortOrder);
        let Masters;

        if (role === "superadmin") {
            query.$and = [
                { role: "master" }
            ];

            Masters = await User.find(query).populate('refId', 'username').exec();
        }
        if (role === "admin") {
            query.$and = [
                { role: 'superareamanager' },
                { 'refId': new mongoose.Types.ObjectId(id) }
            ];
            let supers = await User.find(query)
                .populate('refId', 'username')
                .populate('games')
                .set('strictPopulate', false)
                .exec();

            // Fetch areamanagers for each superareamanager
            let areamanagersList = [];
            let MasterList = [];
            for (let superd of supers) {
                let areamanagers = await User.find({
                    role: 'areamanager',
                    refId: superd._id  // Match superareamanager's _id to refId of areamanagers
                })
                    .populate('refId', 'username')
                    .populate('games')
                    .exec();
                for (let distd of areamanagers) {

                    let Masters = await User.find({
                        role: 'master',
                        refId: distd._id  // Match superareamanager's _id to refId of areamanagers
                    })
                        .populate('refId', 'username')
                        .populate('games')
                        .exec();

                    MasterList.push(...Masters);
                }
                // Use push for better performance
            }

            Masters = MasterList;  // Assign areamanagers to users

        }
        if (role === "superareamanager") {
            query.$and = [
                { role: 'superareamanager' },
                { _id: new mongoose.Types.ObjectId(id) }
            ];
            let supers = await User.find(query)
                .populate('refId', 'username')
                .populate('games')
                .set('strictPopulate', false)
                .exec();

            // Fetch areamanagers for each superareamanager
            let areamanagersList = [];
            let MasterList = [];
            for (let superd of supers) {
                let areamanagers = await User.find({
                    role: 'areamanager',
                    refId: superd._id  // Match superareamanager's _id to refId of areamanagers
                })
                    .populate('refId', 'username')
                    .populate('games')
                    .exec();
                for (let distd of areamanagers) {

                    let Masters = await User.find({
                        role: 'master',
                        refId: distd._id  // Match superareamanager's _id to refId of areamanagers
                    })
                        .populate('refId', 'username')
                        .populate('games')
                        .exec();

                    MasterList.push(...Masters);
                }
                // Use push for better performance
            }

            Masters = MasterList;  // Assign areamanagers to users

        }

        if (role === "areamanager") {
            query.$and = [
                { role: "master" },
                { 'refId': new mongoose.Types.ObjectId(id) }
            ];

            Masters = await User.find(query).populate('refId', 'username').exec();
        }

        if (role === "master") {
            query.$and = [
                { role: "master" },
                { _id: new mongoose.Types.ObjectId(id) }
            ];

            Masters = await User.find(query).populate('refId', 'username').exec();
        }

        return res.status(200).json({
            success: true,
            data: Masters,
        });

    } catch (error) {
        console.error("Error fetching Masters:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching Masters",
            error: error.message,
        });
    }
};

const getMasterById = async (req, res) => {
    try {
        const { id } = req.params;

        // ✅ Validate Mongoose ObjectId format before querying DB
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid ID format." });
        }

        // ✅ Fetch Master details, ensuring it's not soft-deleted
        const Master = await User.findOne({ _id: id, role: "master", isDeleted: false })
            .populate("refId")
            .populate("parentId")
            .populate("subordinates")
            .populate("games");

        // ✅ If Master not found, return 404
        if (!Master) {
            return res.status(404).json({ success: false, message: "Master not found." });
        }

        return res.status(200).json({ success: true, data: Master });

    } catch (error) {
        console.error("Error fetching Master:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching Master",
            error: error.message,
        });
    }
};

const updateMaster = async (req, res) => {
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

        // ✅ Fetch existing Master
        const existingMaster = await User.findOne({ _id: id, role: "master", isDeleted: false });
        if (!existingMaster) {
            return res.status(404).json({ success: false, message: "Master not found or has been deleted." });
        }

        // ✅ Check for duplicate email or phone (excluding the current Master)
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

        // ✅ Update the Master record
        const updatedMaster = await User.findByIdAndUpdate(
            id,
            {
                $set: {
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
                    commission: commission != null ? commission : existingMaster.commission ?? 0,
                    note,
                    userStatus: userStatus ?? existingMaster.userStatus,
                }
            },
            { new: true }
        );

        // ✅ Handle referral transactions if refId changed
        if (refId && refId !== existingMaster.refId?.toString()) {
            const referralTransaction = await ReferTransaction.create({
                referredUser: updatedMaster._id,
                referredBy: referrer._id,
                refUserType: role,
                commissionAmount,
                status: "pending",
            });

            referrer.referralTransaction.push(referralTransaction._id);
            referrer.subordinates.push(updatedMaster._id);
            await referrer.save();

            updatedMaster.referralTransaction.push(referralTransaction._id);
            updatedMaster.parentId = referrer._id;
            await updatedMaster.save();
        }

        // ✅ Fetch updated Master list after update
        const Masters = await fetchMasters();

        return res.status(200).json({
            success: true,
            message: "Master (Area Manager Child) updated successfully.",
            data: Masters,
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

const deleteMaster = async (req, res) => {
    try {
        const { id } = req.params;

        // ✅ Validate Mongoose ObjectId format before querying DB
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid ID format." });
        }

        // ✅ Check if the Master exists and is not already deleted
        const master = await User.findOne({ _id: id, role: "master", isDeleted: false });
        if (!master) {
            return res.status(404).json({ success: false, message: "Master not found or already deleted." });
        }

        // ✅ Check if the Master has subordinates (distributors, retailers, etc.)
        const hasSubordinates = await User.countDocuments({ refId: master._id, isDeleted: false });
        if (hasSubordinates > 0) {
            return res.status(400).json({ success: false, message: "Master has subordinates. Cannot delete." });
        }

        // ✅ Soft delete associated records (wallet transactions, logs, referrals)
        await Promise.all([
            UserTransaction.updateMany({ _id: { $in: master.walletTransaction } }, { isDeleted: true, deletedAt: new Date() }),
            UserLog.updateMany({ _id: { $in: master.userLogs } }, { isDeleted: true, deletedAt: new Date() }),
            ReferTransaction.updateMany({ _id: { $in: master.referralTransaction } }, { isDeleted: true, deletedAt: new Date() }),
        ]);

        // ✅ Soft delete the Master
        master.isDeleted = true;
        master.deletedAt = new Date();
        await master.save();

        // ✅ Remove Master from referrer's subordinates list (if refId exists)
        if (master.refId) {
            await User.findByIdAndUpdate(master.refId, {
                $pull: { subordinates: master._id }
            });
        }

        // ✅ Fetch updated list of Masters
        const Masters = await fetchMasters();

        return res.status(200).json({
            success: true,
            message: "Master (Area Manager Child) deleted successfully.",
            data: Masters,
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
        // ✅ Fetch sender (Master)
        const senderWallet = await User.findOne({ _id: userId, userStatus: true, isDeleted: false });
        if (!senderWallet) {
            return res.status(403).json({ success: false, message: "Only active Masters can perform credit transfers." });
        }

        // ✅ Fetch receiver (Must be active and not deleted)
        const receiverWallet = await User.findOne({ _id: toUserId, isDeleted: false });
        if (!receiverWallet) {
            return res.status(404).json({ success: false, message: "Receiver not found or inactive." });
        }

        // ✅ Validate Master's password
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
            transactionMessage: `Master ${senderWallet.username} transferred ${transferAmount} to ${receiverWallet.username} (pending)`,
        });

        await transaction.save();

        // ✅ Update sender & receiver transaction history
        senderWallet.walletTransaction.push(transaction._id);
        receiverWallet.walletTransaction.push(transaction._id);

        await senderWallet.save();
        await receiverWallet.save();

        // ✅ Log transaction activity
        await logUserActivity(req, userId, `${senderWallet.username} credited ${transferAmount} to ${receiverWallet.username} (pending)`, "not request", "credit", "not request", null);

        // ✅ Fetch updated list of Masters
        const Masters = await fetchMasters();

        return res.status(200).json({
            success: true,
            message: `Successfully transferred ${transferAmount} to User ${receiverWallet.username}`,
            data: { Masters, receiverWallet },
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
        // ✅ Fetch sender (Master)
        let sender =await User.findOne({ _id: userId, userStatus: true, isDeleted: false });
        if (!sender) {
            return res.status(403).json({ success: false, message: "Only active Masters can perform credit adjustments." });
        }

        // ✅ Fetch receiver (Must be active and not deleted)
        let receiver = await User.findOne({ _id: toUserId, isDeleted: false });
        if (!receiver) {
            return res.status(404).json({ success: false, message: "Receiver not found or inactive." });
        }

        // ✅ Validate Master's password
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
                return res.status(400).json({ success: false, message: "Insufficient balance in Master's wallet." });
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
            transactionMessage: transactionMessage || `Master ${sender.username} adjusted ${adjustAmount} ${transactionType} to ${receiver.username}`,
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

        // ✅ Fetch updated list of Masters
        const Masters = await fetchMasters();

        return res.status(200).json({
            success: true,
            message: `Successfully adjusted ${adjustAmount} ${transactionType} to User ${receiver.username}`,
            data: { Masters, receiver },
        });

    } catch (error) {
        console.error("Error during credit adjustment:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
    }
};

const toggleUserStatus = async (req, res) => {
    const userId = req.params.id?.replace(/^:/, "");
    const action = req.params.action?.replace(/^:/, "");
    const MasterId = req.user?.id; // Assuming authentication middleware sets req.user

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: "Invalid user ID format." });
    }

    try {
        // ✅ Ensure only active Masters can toggle user status
        const Master = await User.findOne({ _id: userId, role: "master", isDeleted: false });
        if (!Master) {
            return res.status(403).json({
                success: false,
                message: "Only active Master users can toggle user status.",
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

        // ✅ Fetch updated Master list
        const Masters = await fetchMasters();

        return res.status(200).json({
            success: true,
            message: `User ${action}d successfully.`,
            data: Masters,
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

const fetchMasterById = async (id) => {
    return await User.findOne({ _id: id, isDeleted: false })
        .populate("refId")
        .populate("parentId")
        .populate("subordinates")
        .populate("games")
        .lean();
};

const fetchMasterChildren = async (id, sort, sortOrder) => {
    return await User.find({ refId: id, isDeleted: false })
        .populate("refId")
        .populate("parentId")
        .populate("subordinates")
        .populate("games")
        .sort({ [sort]: sortOrder === "asc" ? 1 : -1 })
        .lean();
};

// Main controller function
const getMasterByIdChildren = async (req, res) => {
    try {
        const { id } = req.params;
        const { sort = "username", sortOrder = "asc" } = req.query;
        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid user ID" });
        }
        // Fetch user & child users
        const Master = await fetchMasterById(id);
        if (!Master) {
            return res.status(404).json({ success: false, message: "User not found or has been deleted" });
        }
        const children = await fetchMasterChildren(id, sort, sortOrder);
        // Return user and associated users
        return res.status(200).json({
            success: true,
            data: { Master, children }
        });

    } catch (error) {
        console.error("Error fetching user by ID:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const createMasterByIdChildren = async (req, res) => {
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
            note,
            userStatus = true,
        } = req.body;
        const { id } = req.params; // Master ID
        let commissionAmount = 0;

        // ✅ Validate required fields
        if (!firstName || !lastName  || !password) {
            return res.status(400).json({
                success: false,
                message: "First name, last name, phone, and password are required.",
            });
        }

        // ✅ Ensure only 'player' role is allowed
        // if (role && role !== "player") {
        //     return res.status(400).json({
        //         success: false,
        //         message: "Only Player users can be created using this API.",
        //     });
        // }

        // ✅ Check if the parent Master exists
        const parentMaster = await User.findOne({ _id: id, role: "master", isDeleted: false });
        if (!parentMaster) {
            return res.status(404).json({
                success: false,
                message: "Parent Master not found or has been deleted.",
            });
        }

        // ✅ Check if an active Player already exists with the same phone number
        // const existingPlayer = await User.findOne({ phone, isDeleted: false });
        // if (existingPlayer) {
        //     return res.status(400).json({
        //         success: false,
        //         message: "Player with this phone number already exists.",
        //     });
        // }

        // ✅ Create New Player
        const newPlayer = new User({
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
            role: "player", // Set role explicitly
            note,
            pin,
            password,
            userStatus,
            refId: parentMaster._id, // Set parent reference (Master)
        });

        // ✅ Save Player
        const savedPlayer = await newPlayer.save();

        // ✅ Add the new Player under the parent Master's subordinates list
        parentMaster.subordinates.push(savedPlayer._id);
        await parentMaster.save();

        // ✅ Referral Transaction (if refId exists)
        if (refId) {
            const referrer = await User.findOne({ _id: refId, isDeleted: false });
            if (referrer) {
                const referralTransaction = await ReferTransaction.create({
                    referredUser: savedPlayer._id,
                    referredBy: referrer._id,
                    refUserType: "player",
                    commissionAmount,
                    status: "pending",
                });

                referrer.referralTransaction.push(referralTransaction._id);
                referrer.subordinates.push(savedPlayer._id);
                await referrer.save();

                savedPlayer.referralTransaction.push(referralTransaction._id);
                savedPlayer.parentId = referrer._id;
                await savedPlayer.save();
            }
        }

        // ✅ Fetch updated list of Players under this Master
        const playerChildren = await fetchMasterChildren(id);

        return res.status(201).json({
            success: true,
            message: "Player created successfully.",
            data: playerChildren,
        });

    } catch (error) {
        console.error("Error creating Player:", error);
        return res.status(500).json({
            success: false,
            message: "Error creating Player",
            error: error.message,
        });
    }
};

const updateMasterChildren = async (req, res) => {
    try {
        const { id, childrenId } = req.params; // Master ID & Player ID
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
            refId,
            commissionAmount,
            note,
            userStatus,
        } = req.body;

        // ✅ Validate ObjectId format
        if (![id, childrenId].every(mongoose.Types.ObjectId.isValid)) {
            return res.status(400).json({ success: false, message: "Invalid ID format." });
        }

        // ✅ Fetch existing Player under this Master
        const existingPlayer = await User.findOne({ _id: childrenId, role: "player", isDeleted: false });
        if (!existingPlayer) {
            return res.status(404).json({ success: false, message: "Player not found or has been deleted." });
        }

        // ✅ Check for duplicate email or phone (excluding current player)
        if (email || phone) {
            const duplicateUser = await User.findOne({
                $or: [{ email }, { phone }],
                _id: { $ne: childrenId },
                isDeleted: false,
            });

            if (duplicateUser) {
                return res.status(400).json({
                    success: false,
                    message: `User with this ${duplicateUser.email === email ? "email" : "phone number"} already exists.`,
                });
            }
        }

        // ✅ Validate referrer (if updating refId)
        let referrer = null;
        if (refId && refId !== existingPlayer.refId?.toString()) {
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
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : existingPlayer.dateOfBirth,
            country,
            state,
            city,
            pinCode,
            address,
            pin: pin || existingPlayer.pin,
            password: password || existingPlayer.password,
            occupation,
            refId: referrer ? referrer._id : existingPlayer.refId,
            commission: commissionAmount != null ? commissionAmount : existingPlayer.commission ?? 0,
            note,
            userStatus: userStatus ?? existingPlayer.userStatus,
        };

        // ✅ Update Player record
        const updatedPlayer = await User.findByIdAndUpdate(childrenId, { $set: updateFields }, { new: true });

        // ✅ Handle referral transactions if refId changed
        if (referrer) {
            const referralTransaction = await ReferTransaction.create({
                referredUser: updatedPlayer._id,
                referredBy: referrer._id,
                refUserType: "player",
                commissionAmount,
                status: "pending",
            });

            // ✅ Update relationships
            await Promise.all([
                User.findByIdAndUpdate(referrer._id, {
                    $push: { referralTransaction: referralTransaction._id, subordinates: updatedPlayer._id },
                }),
                User.findByIdAndUpdate(updatedPlayer._id, {
                    $push: { referralTransaction: referralTransaction._id },
                    parentId: referrer._id,
                }),
            ]);
        }

        // ✅ Fetch updated Player list under this Master
        const playerChildren = await fetchMasterChildren(id);

        return res.status(200).json({
            success: true,
            message: "Player updated successfully.",
            data: playerChildren,
        });

    } catch (error) {
        console.error("Error updating Player:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error. Could not update Player.",
            error: error.message,
        });
    }
};

const deleteMasterChildren = async (req, res) => {
    try {
        const { id, childrenId } = req.params; // Master ID & Player ID

        // ✅ Validate ObjectId format
        if (![id, childrenId].every(mongoose.Types.ObjectId.isValid)) {
            return res.status(400).json({ success: false, message: "Invalid ID format." });
        }

        // ✅ Check if the Player exists and is not already deleted
        const player = await User.findOne({ _id: childrenId, role: "player", isDeleted: false });
        if (!player) {
            return res.status(404).json({ success: false, message: "Player not found or already deleted." });
        }

        // ✅ Check if the Player has subordinates (prevents deletion if Player has referrals)
        const hasSubordinates = await User.countDocuments({ refId: player._id, isDeleted: false });
        if (hasSubordinates > 0) {
            return res.status(400).json({ success: false, message: "Player has subordinates. Cannot delete." });
        }

        // ✅ Soft delete associated records (wallet transactions, logs, referrals)
        await Promise.all([
            UserTransaction.updateMany({ _id: { $in: player.walletTransaction } }, { isDeleted: true, deletedAt: new Date() }),
            UserLog.updateMany({ _id: { $in: player.userLogs } }, { isDeleted: true, deletedAt: new Date() }),
            ReferTransaction.updateMany({ _id: { $in: player.referralTransaction } }, { isDeleted: true, deletedAt: new Date() }),
        ]);

        // ✅ Soft delete the Player
        player.isDeleted = true;
        player.deletedAt = new Date();
        await player.save();

        // ✅ Remove Player from referrer's subordinates list (if refId exists)
        if (player.refId) {
            await User.findByIdAndUpdate(player.refId, {
                $pull: { subordinates: player._id }
            });
        }

        // ✅ Fetch updated list of Players under the Master
        const playerChildren = await fetchMasterChildren(id);

        return res.status(200).json({
            success: true,
            message: "Player deleted successfully.",
            data: playerChildren,
        });

    } catch (error) {
        console.error("Error deleting Player:", error);
        return res.status(500).json({
            success: false,
            message: "Error deleting Player",
            error: error.message,
        });
    }
};

const toggleMasterChildrenStatus = async (req, res) => {
    const userId = req.params.childrenId?.replace(/^:/, "");
    const action = req.params.action?.replace(/^:/, "");
    const MasterId = req.params.id?.replace(/^:/, ""); // Assuming authentication middleware sets req.user

    if (!mongoose.Types.ObjectId.isValid(MasterId)) {
        return res.status(400).json({ success: false, message: "Invalid Master ID format." });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: "Invalid user ID format." });
    }

    try {
        // ✅ Ensure only active users can toggle user status
        const users = await User.findOne({ _id: userId, role: "player", isDeleted: false });
        if (!users) {
            return res.status(403).json({
                success: false,
                message: "Only active user users can toggle user status.",
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

        // ✅ Fetch updated list of users
        const MasterChildren = await fetchMasterChildren(MasterId);

        return res.status(200).json({
            success: true,
            message: `player ${action}d successfully.`,
            data: MasterChildren,
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

const creditTransferMasterChildren = async (req, res) => {
    const { id, childrenId } = req.params; // Master ID & Player ID
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
        // ✅ Fetch sender (Master)
        const sender = await User.findOne({ _id: userId, userStatus: true, isDeleted: false });
        if (!sender) {
            return res.status(403).json({ success: false, message: "Sender not authorized or inactive." });
        }

        // ✅ Fetch receiver (Player)
        const receiver = await User.findOne({ _id: toUserId, role: "player", isDeleted: false });
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

        // ✅ Deduct amount from sender and add to receiver
        sender.walletBalance -= transferAmount;
        receiver.walletBalance += transferAmount;

        // ✅ Create a new transaction record
        const transaction = new UserTransaction({
            userId,
            toUserId,
            amount: transferAmount,
            transactionType: "transfer",
            status: "completed",
            transactionMessage: `Master ${sender.username} transferred ${transferAmount} to Player ${receiver.username}.`,
        });
        await transaction.save();

        // ✅ Update sender and receiver's wallet transaction history
        sender.walletTransaction.push(transaction._id);
        receiver.walletTransaction.push(transaction._id);

        // ✅ Log user activity
        await logUserActivity(req, userId, `${sender.username} credited ${transferAmount} to ${receiver.username}`, "credit");

        // ✅ Save updated user data
        await Promise.all([sender.save(), receiver.save()]);

        // ✅ Fetch updated Player list under the Master
        const playerChildren = await fetchMasterChildren(id);

        return res.status(200).json({
            success: true,
            message: `Successfully transferred ${transferAmount} to Player ${receiver.username}`,
            data: { playerChildren, receiver },
        });

    } catch (error) {
        console.error("Transaction Error:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

const creditAdjustMasterChildren = async (req, res) => {
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
        // ✅ Fetch sender (Master)
        let sender = await User.findOne({ _id: userId, userStatus: true, isDeleted: false });
        if (!sender) {
            return res.status(403).json({ success: false, message: "Sender not authorized or inactive." });
        }

        // ✅ Fetch receiver (Player)
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
            transactionMessage: transactionMessage ||
                `Master ${sender.username} adjusted ${adjustAmount} ${transactionType} to ${receiver.username}.`,
        });

        await transaction.save();

        // ✅ Update sender and receiver's wallet transaction history
        sender.walletTransaction.push(transaction._id);
        receiver.walletTransaction.push(transaction._id);

        // ✅ Log user activity
        await logUserActivity(req, userId, `${sender.username} adjusted ${adjustAmount} ${transactionType} to ${receiver.username}`, "adjusted");

        // ✅ Save updated user data
        await Promise.all([sender.save(), receiver.save()]);

        // ✅ Fetch updated Player list under the Master
        const playerChildren = await fetchMasterChildren(id);

        return res.status(200).json({
            success: true,
            message: `Successfully adjusted ${adjustAmount} ${transactionType} to Player ${receiver.username}`,
            data: { playerChildren, sender, receiver },
        });

    } catch (error) {
        console.error("Error during credit adjustment:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

const getMasterChildrenById = async (req, res) => {
    try {
        const { childrenId } = req.params;

        // ✅ Validate Mongoose ObjectId format before querying DB
        if (!mongoose.Types.ObjectId.isValid(childrenId)) {
            return res.status(400).json({ success: false, message: "Invalid ID format." });
        }

        // ✅ Fetch Master details, ensuring it's not soft-deleted
        const children = await User.findOne({ _id: childrenId, role: "player", isDeleted: false })
            .populate("refId")
            .populate("parentId")
            .populate("subordinates",)
            .populate("games")
            .exec();
        // ✅ If Master not found, return 404
        if (!children) {
            return res.status(404).json({ success: false, message: "Master not found." });
        }

        return res.status(200).json({ success: true, data: children });

    } catch (error) {
        console.error("Error fetching Master:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching Master",
            error: error.message,
        });
    }
};

module.exports = {
    createMaster,
    getAllMasters,
    getMasterById,
    updateMaster,
    deleteMaster,
    creditTransfer,
    creditAdjust,
    toggleUserStatus,
    getRoleCount,
    loadcredit,
    getMasterChildrenById,
    getMasterByIdChildren,
    createMasterByIdChildren,
    updateMasterChildren,
    creditTransferMasterChildren,
    creditAdjustMasterChildren,
    toggleMasterChildrenStatus,
    deleteMasterChildren
};