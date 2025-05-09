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

const fetchusers = async (query = {}, sort = "username", sortOrder = 1) => {
    try {
        const userQuery = {
            role: "player",
            isDeleted: false,  // ✅ Ignore soft-deleted users
            ...query
        };

        return await User.find(userQuery)
            .populate("refId")
            .populate("parentId")
            .populate("subordinates",)
            .sort({ [sort]: sortOrder })
            .exec();
    } catch (error) {
        console.error("Error fetching users:", error);
        throw new Error("Failed to fetch users.");
    }
};

const createPlayers = async (req, res) => {
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
        if (!firstName || !lastName  || !country || !state || !city || !address) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields. Please provide firstName, lastName, phone, email, country, state, city, and address."
            });
        }

        // ✅ Check for duplicate phone or email
        // const existingUser = await User.findOne({
        //     $or: [ { email }],
        //     isDeleted: false
        // });

        // if (existingUser) {
        //     return res.status(400).json({
        //         success: false,
        //         message: `User with this ${existingUser.phone === phone ? "phone number" : "email"} already exists.`
        //     });
        // }
        // ✅ Check if a Master with the same email already exists
        // const existingMaster = await User.findOne({ email, isDeleted: false });
        // if (existingMaster) {
        //     return res.status(400).json({
        //         success: false,
        //         message: "Master with this email already exists."
        //     });
        // }


        // ✅ Ensure only 'player' role is allowed
        if (role && role !== "player") {
            return res.status(400).json({
                success: false,
                message: "Only player users can be created using this API."
            });
        }



        // ✅ Create a new user user
        const newuser = new User({
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
        });
        // ✅ Check if referrer exists
        let referrer = null;
        if (refId) {
            referrer = await User.findOne({ _id: refId, isDeleted: { $ne: true } });
            if (!referrer) {
                return res.status(404).json({ success: false, message: "Referrer not found." });
            }
            newuser.refId = referrer._id;
        }
        await newuser.save();
        // ✅ Handle referral transaction if refId exists
        if (refId) {
            const referralTransaction = await ReferTransaction.create({
                referredUser: newuser._id,
                referredBy: referrer._id,
                refUserType: role,
                commissionAmount,
                status: "pending",
            });

            referrer.referralTransaction.push(referralTransaction._id);
            referrer.subordinates.push(newuser._id);
            await referrer.save();

            newuser.referralTransaction.push(referralTransaction._id);
            newuser.parentId = referrer._id;
            await newuser.save();
        }

        // ✅ Fetch updated user list after creation
        const users = await fetchusers();

        return res.status(201).json({
            success: true,
            message: "user created successfully.",
            data: users,
        });

    } catch (error) {
        console.error("Error creating user:", error);
        return res.status(500).json({
            success: false,
            message: "Error creating user",
            error: error.message,
        });
    }
};

const getAllPlayers = async (req, res) => {
    try {
        const { search = "", sort = "username", order = "asc", id, role } = req.query;

        // ✅ Ensure only active users are fetched
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

        // ✅ Fetch users with populated references
        // const users = await fetchusers(query, sort, sortOrder);
        let users;
        if (role === "superadmin") {
            query.$and = [
                { role: "player" },
            ]
            users = await User.find(query).populate('refId', 'username').exec();
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

        // console.log(supers);

            let userList = [];

            // Loop through each superdistributor
            for (let superd of supers) {
                // Fetch distributors for each superdistributor
                let distributors = await User.find({
                    role: 'areamanager',
                    refId: superd._id  // Match superdistributor's _id to refId of distributors
                })
                    .populate('refId', 'username')
                    .exec();

                console.log(distributors);

                // Loop through each distributor to fetch retailers
                for (let distd of distributors) {
                    let retailers = await User.find({
                        role: 'master',
                        refId: distd._id  // Match distributor's _id to refId of retailers
                    })
                        .populate('refId', 'username')
                        .exec();
                    //    console.log(retailers);
                    // Loop through each retailer to fetch users
                    for (let userd of retailers) {
                        let usersl = await User.find({
                            role: 'player',
                            refId: userd._id  // Match retailer's _id to refId of users
                        })
                            .populate('refId', 'username')
                            .exec();

                        // Push the fetched users into the userList array
                        userList.push(...usersl);  // Use push to append multiple elements efficiently
                    }
                }
            }

            // Assign the userList to the final users array
            users = userList;


        }

        if (role === "superareamanager") {
            query.$and = [
                { role: 'areamanager' },
                { 'refId': new mongoose.Types.ObjectId(id) }
            ];
            let distributors = await User.find(query)
                .populate('refId', 'username')

                .set('strictPopulate', false)
                .exec();

            let userList = [];
            // Loop through each distributor to fetch retailers
            for (let dist of distributors) {
                let retailers = await User.find({
                    role: 'master',
                    refId: dist._id  // Match distributor's _id to refId of retailers
                })
                    .populate('refId', 'username')

                    .exec();

                // Loop through each retailer to fetch users
                for (let retailer of retailers) {
                    let usersUnderRetailer = await User.find({
                        role: 'player',
                        refId: retailer._id  // Match retailer's _id to refId of users
                    })
                        .populate('refId', 'username')

                        .exec();

                    userList.push(...usersUnderRetailer);  // Append users to the list
                }
            }

            users = userList;  // Assign users to users
        }

        if (role === "areamanager") {
            query.$and = [
                { role: 'areamanager' },
                { _id: new mongoose.Types.ObjectId(id) }
            ];
            let distributors = await User.find(query)
                .populate('refId', 'username')
                .populate('games')
                .set('strictPopulate', false)
                .exec();

            let userList = [];
            // Loop through each distributor to fetch retailers
            for (let dist of distributors) {
                let retailers = await User.find({
                    role: 'master',
                    refId: dist._id  // Match distributor's _id to refId of retailers
                })
                    .populate('refId', 'username')
                    .populate('games')
                    .exec();

                // Loop through each retailer to fetch users
                for (let retailer of retailers) {
                    let usersUnderRetailer = await User.find({
                        role: 'player',
                        refId: retailer._id  // Match retailer's _id to refId of users
                    })
                        .populate('refId', 'username')
                        .populate('games')
                        .exec();

                    userList.push(...usersUnderRetailer);  // Append users to the list
                }
            }

            users = userList;  // Assign users to users
        }


        if (role === "master") {
            query.$and = [
                { role: 'master' },
                { _id: new mongoose.Types.ObjectId(id) }  // Match distributor's _id to refId of retailers
            ];
            let retailers = await User.find(query)
                .populate('refId', 'username')
                .set('strictPopulate', false)
                .exec();

            let userList = [];
            // Loop through each retailer to fetch users
            for (let retailer of retailers) {
                let usersUnderRetailer = await User.find({
                    role: 'player',
                    refId: retailer._id  // Match retailer's _id to refId of users
                })
                    .populate('refId', 'username')

                    .exec();

                userList.push(...usersUnderRetailer);  // Append users to the list
            }

            users = userList;  // Assign users to users

        }
        return res.status(200).json({
            success: true,
            data: users,
        });

    } catch (error) {
        console.error("Error fetching users:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching users",
            error: error.message,
        });
    }
};

const getPlayersById = async (req, res) => {
    try {
        const { id } = req.params;

        // ✅ Validate Mongoose ObjectId format before querying DB
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid ID format." });
        }

        // ✅ Fetch user details, ensuring it's not soft-deleted
        const user = await User.findOne({ _id: id, role: "player", isDeleted: false })
            .populate("refId", "username email role walletBalance")
            .populate("parentId", "username email role")
            .populate("subordinates", "username email role")
            .populate("games", "name type");

        // ✅ If user not found, return 404
        if (!user) {
            return res.status(404).json({ success: false, message: "user not found." });
        }

        return res.status(200).json({ success: true, data: user });

    } catch (error) {
        console.error("Error fetching user:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching user",
            error: error.message,
        });
    }
};

const updatePlayers = async (req, res) => {
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
            note,
            userStatus,
        } = req.body;

        // ✅ Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid ID format." });
        }

        // ✅ Fetch user, ensuring it's active (not soft-deleted)
        const user = await User.findOne({ _id: id, role: "player", isDeleted: false });
        if (!user) {
            return res.status(404).json({ success: false, message: "user not found or has been deleted." });
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
                    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : user.dateOfBirth,
                    country,
                    state,
                    city,
                    pinCode,
                    address,
                    pin: pin || user.pin,
                    password: password || user.password,
                    occupation,
                    refId: referrer ? referrer._id : user.refId,
                    note,
                    userStatus: userStatus ?? user.userStatus,
                }
            },
            { new: true }
        );
        await updatedMaster.save();
        // ✅ Handle referral transactions if refId changed
        if (refId && refId !== user.refId?.toString()) {
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
        // ✅ Fetch updated user list after creation
        const users = await fetchusers();
        return res.status(200).json({
            success: true,
            message: "player updated successfully.",
            data: users, // Returning only updated user data
        });

    } catch (error) {
        console.error("Error updating user:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error. Could not update user.",
            error: error.message,
        });
    }
};

const deletePlayers = async (req, res) => {
    try {
        const { id } = req.params;

        // ✅ Validate Mongoose ObjectId format before querying DB
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid ID format." });
        }

        // ✅ Check if user exists and is not already deleted
        const user = await User.findOne({ _id: id, role: "player", isDeleted: false });
        if (!user) {
            return res.status(404).json({ success: false, message: "player not found or already deleted." });
        }
        // ✅ Check if the Master has subordinates (distributors, retailers, etc.)
        const hasSubordinates = await User.countDocuments({ refId: user._id, isDeleted: false });
        if (hasSubordinates > 0) {
            return res.status(400).json({ success: false, message: "user has subordinates. Cannot delete." });
        }

        // ✅ Soft delete associated records (wallet transactions, logs, referrals)
        await Promise.all([
            UserTransaction.updateMany({ _id: { $in: user.walletTransaction } }, { isDeleted: true, deletedAt: new Date() }),
            UserLog.updateMany({ _id: { $in: user.userLogs } }, { isDeleted: true, deletedAt: new Date() }),
            ReferTransaction.updateMany({ _id: { $in: user.referralTransaction } }, { isDeleted: true, deletedAt: new Date() }),
        ]);

        // ✅ Soft delete (mark as deleted instead of removing from DB)
        user.isDeleted = true;
        user.deletedAt = new Date();
        await user.save();

        // ✅ Fetch updated list of users
        const users = await fetchusers();

        return res.status(200).json({
            success: true,
            message: "user deleted successfully.",
            data: users,
        });

    } catch (error) {
        console.error("Error deleting user:", error);
        return res.status(500).json({
            success: false,
            message: "Error deleting user",
            error: error.message,
        });
    }
};

const creditTransfer = async (req, res) => {
    const { userId, password, transferAmount, toUserId, authUser } = req.body;

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
        const senderWallet = await User.findOne({ _id: userId, role: "master", userStatus: true, isDeleted: false });
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
        // ✅ Fetch updated user list
        const users = await fetchusers();

        return res.status(200).json({
            success: true,
            message: `Successfully transferred ${transferAmount} to Player ${receiverWallet.username}`,
            data: { users, receiverWallet },
        });

    } catch (error) {
        console.error("Transaction Error:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

const creditAdjust = async (req, res) => {
    const { userId, toUserId, password, adjustAmount, transactionType, transactionMessage, authUser } = req.body;

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
        let sender = await User.findOne({ _id: userId, role: "master", userStatus: true, isDeleted: false });
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

        // ✅ Fetch updated user list
        const users = await fetchusers();

        return res.status(200).json({
            success: true,
            message: `Successfully adjusted ${adjustAmount} ${transactionType} to User ${receiver.username}`,
            data: { users, receiver },
        });

    } catch (error) {
        console.error("Error during credit adjustment:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

const toggleUserStatus = async (req, res) => {
    const userId = req.params.id?.replace(/^:/, "");
    const action = req.params.action?.replace(/^:/, "");
    // const userId = req.user?.id; // Assuming authentication middleware sets req.user

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: "Invalid user ID format." });
    }

    try {
        // ✅ Ensure only active users can toggle user status
        const user = await User.findOne({ _id: userId, role: "player", isDeleted: false });
        if (!user) {
            return res.status(403).json({
                success: false,
                message: "Only active player users can toggle user status.",
            });
        }

        // ✅ Fetch the target user (Ensure user is not deleted)
        const userD = await User.findOne({ _id: userId, isDeleted: false });
        if (!userD) {
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

        // ✅ Fetch updated user list
        const users = await fetchusers();

        return res.status(200).json({
            success: true,
            message: `Player ${action}d successfully.`,
            data: users,
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

module.exports = {
    createPlayers,
    getAllPlayers,
    getPlayersById,
    updatePlayers,
    deletePlayers,
    creditTransfer,
    creditAdjust,
    getRoleCount,
    toggleUserStatus,
    loadcredit,
};