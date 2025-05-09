const Game = require("../models/game.model");
const { User } = require("../models/user.model");
const { validationResult } = require("express-validator"); // To handle validation errors
const { default: mongoose } = require("mongoose");
const Percentage = require("../models/percentage.model");


async function getUsersRoleWise(role, id) {
    try {
        let superadminsData = [];
        let adminsData = [];
        let superdistributorsData = [];
        let distributorsData = [];
        let retailersData = [];
        let usersData = [];

        // Handle superadmin case: Fetch everything under the superadmin
        if (role === "superadmin") {
            // Fetch all admins for the superadmin
            let admins = await User.find({ role: "admin" }).exec();
            adminsData.push(...admins);
            // console.log(admins);

            for (let admin of admins) {
                // For each admin, fetch superdistributors
                let superdistributors = await User.find({ role: "superareamanager", refId: admin._id, isDeleted: false }).exec();
                superdistributorsData.push(...superdistributors);

                for (let superdistributor of superdistributors) {
                    // For each superdistributor, fetch distributors
                    let distributors = await User.find({ role: "areamanager", refId: superdistributor._id, isDeleted: false }).exec();
                    distributorsData.push(...distributors);

                    for (let distributor of distributors) {
                        // For each distributor, fetch retailers
                        let retailers = await User.find({ role: "master", refId: distributor._id, isDeleted: false }).exec();
                        retailersData.push(...retailers);

                        for (let retailer of retailers) {
                            // For each retailer, fetch users
                            let users = await User.find({ role: "player", refId: retailer._id, isDeleted: false }).exec();
                            usersData.push(...users);
                        }
                    }
                }
            }

        } else if (role === "admin") {
            // Fetch admins (this is where you start for admin role)
            let admins = await User.find({ role: "admin", _id: new mongoose.Types.ObjectId(id), isDeleted: false }).exec();
            adminsData.push(...admins);



            for (let admin of admins) {
                // Fetch superdistributors under each admin
                let superdistributors = await User.find({ role: "superareamanager", refId: admin._id, isDeleted: false }).exec();
                superdistributorsData.push(...superdistributors);

                for (let superdistributor of superdistributors) {
                    // Fetch distributors under each superdistributor
                    let distributors = await User.find({ role: "areamanager", refId: superdistributor._id, isDeleted: false }).exec();
                    distributorsData.push(...distributors);

                    for (let distributor of distributors) {
                        // Fetch retailers under each distributor
                        let retailers = await User.find({ role: "master", refId: distributor._id, isDeleted: false }).exec();
                        retailersData.push(...retailers);

                        for (let retailer of retailers) {
                            // Fetch users under each retailer
                            let users = await User.find({ role: "user", refId: retailer._id, isDeleted: false }).exec();
                            usersData.push(...users);
                        }
                    }
                }
            }

        } else if (role === "superareamanager") {
            // Start from superdistributor if the role is superdistributor
            let superdistributors = await User.find({ role: "superareamanager", _id: new mongoose.Types.ObjectId(id), isDeleted: false }).exec();
            superdistributorsData.push(...superdistributors);

            for (let superdistributor of superdistributors) {
                let distributors = await User.find({ role: "areamanager", refId: superdistributor._id, isDeleted: false }).exec();
                distributorsData.push(...distributors);

                for (let distributor of distributors) {
                    let retailers = await User.find({ role: "master", refId: distributor._id, isDeleted: false }).exec();
                    retailersData.push(...retailers);

                    for (let retailer of retailers) {
                        let users = await User.find({ role: "user", refId: retailer._id, isDeleted: false }).exec();
                        usersData.push(...users);
                    }
                }
            }

        } else if (role === "areamanager") {
            // Start from distributor if the role is distributor
            let distributors = await User.find({ role: "areamanager", _id: new mongoose.Types.ObjectId(id), isDeleted: false }).exec();
            distributorsData.push(...distributors);

            for (let distributor of distributors) {
                let retailers = await User.find({ role: "master", refId: distributor._id, isDeleted: false }).exec();
                retailersData.push(...retailers);

                for (let retailer of retailers) {
                    let users = await User.find({ role: "user", refId: retailer._id, isDeleted: false }).exec();
                    usersData.push(...users);
                }
            }

        } else if (role === "master") {
            // Start from retailer if the role is retailer
            let retailers = await User.find({ role: "master", _id: new mongoose.Types.ObjectId(id), isDeleted: false }).exec();
            retailersData.push(...retailers);

            for (let retailer of retailers) {
                let users = await User.find({ role: "user", refId: retailer._id, isDeleted: false }).exec();
                usersData.push(...users);
            }

        }


        // const allData = [
        //   ...superadminsData,
        //   ...adminsData,
        //   ...superdistributorsData,
        //   ...distributorsData,
        //   ...retailersData,
        //   ...usersData
        // ];

        // After fetching all data, log the single merged array
        // console.log("All Data:", usersData);
        return usersData;

    } catch (error) {
        console.error("Error in getUsersRoleWise:", error);
    }
}

const loadGamesByAdmin = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, error: "Invalid ObjectId format" });
    }

    try {
        // ✅ Fetch active user only
        const user = await User.findOne({ _id: id, isDeleted: false }).exec();
        if (!user) {
            return res.status(404).json({ success: false, error: "User not found or inactive" });
        }

        // ✅ Fetch all users under this admin (ensure `isDeleted: false` in `getUsersRoleWise`)
        let allUsers = await getUsersRoleWise(user.role, user._id);

        // ✅ Fetch games list based on user role (ensure `isDeleted: false` in `getGamesByUserRole`)
        const gameData = await getGamesByUserRole(id, user.role);
        if (!gameData.success || !gameData.games) {
            return res.status(500).json({ success: false, error: gameData.error || "Failed to load games" });
        }

        // ✅ Fetch admin game list with percentages
        const adminGameData = await getAdminGameList(user._id, user.role);
        if (!adminGameData.success || !adminGameData.adminGameList) {
            return res.status(500).json({ success: false, error: adminGameData.error || "Failed to load admin game list" });
        }

        res.status(200).json({
            success: true,
            games: gameData.games,
            users: allUsers,
            adminGameList: adminGameData.adminGameList,
        });

    } catch (error) {
        console.error("Error in loadGamesByAdmin:", error);
        res.status(500).json({
            success: false,
            error: "Internal Server Error",
        });
    }
};

const getUsersByRole = async (role, id) => {
    let rolesToFetch;

    try {
        // Define role-based logic
        switch (role) {
            case "superadmin":
                rolesToFetch = ["admin", "superareamanager", "areamanager", "master", "player"];
                break;
            case "admin":
                rolesToFetch = ["superareamanager", "areamanager", "master", "player"];
                break;
            case "superareamanager":
                // For superdistributor, fetch all distributors, retailers, and users
                rolesToFetch = ["areamanager", "master", "player"];
                break;
            case "areamanager":
                // For distributor, fetch all retailers and users
                rolesToFetch = ["master", "player"];
                break;
            case "master":
                // For retailer, fetch all users
                rolesToFetch = ["player"];
                break;
            case "player":
                // For user, fetch users only
                rolesToFetch = ["player"];
                break;
            default:
                return { success: false, message: "Invalid role" };
        }

        // Returning the rolesToFetch so that it can be used in a user-fetching query
        return { success: true, rolesToFetch };
    } catch (error) {
        console.error("Error fetching users by role:", error);
        return { success: false, message: "Failed to fetch users" };
    }
};

const updateWinpercentageById = async (req, res) => {
    try {
        const { id } = req.params; // Get percentage entry ID from params
        const { winpercentage } = req.body; // Get new win percentage

        // ✅ Validate ID format
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid ID format." });
        }

        // ✅ Validate win percentage (0-100)
        if (typeof winpercentage !== "number" || winpercentage < 0 || winpercentage > 100) {
            return res.status(400).json({ success: false, message: "Win percentage must be a number between 0 and 100." });
        }

        // ✅ Find and update percentage entry
        const updatedPercentage = await Percentage.findOneAndUpdate(
            { _id: id, isDeleted: false },  // Ensure the document is not deleted
            { winpercentage },
            { new: true } // Return the updated document
        );

        if (!updatedPercentage) {
            return res.status(404).json({ success: false, message: "Percentage entry not found." });
        }

        return res.status(200).json({
            success: true,
            message: "Win percentage updated successfully.",
            data: updatedPercentage,
        });

    } catch (error) {
        console.error("Error updating win percentage:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error. Could not update win percentage.",
            error: error.message,
        });
    }
};

const updateWinpercentageBulk = async (req, res) => {
    try {
        const { id } = req.params;
        const { updates } = req.body; // Array of { id, winpercentage }
        // ✅ Validate ID format
        // console.log(req.body);
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, error: "Invalid ObjectId format" });
        }
        // ✅ Validate input
        if (!Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({ success: false, message: "Invalid updates array." });
        }

        // // ✅ Validate IDs and percentages
        for (const update of updates) {
            if (!mongoose.Types.ObjectId.isValid(update.id) || typeof update.winpercentage !== "number" || update.winpercentage < 0 || update.winpercentage > 100) {
                return res.status(400).json({ success: false, message: "Invalid ID or winpercentage." });
            }
        }

        // // ✅ Prepare bulk operations
        const bulkOperations = updates.map(update => ({
            updateOne: {
                filter: { _id: update.id },
                update: { $set: { winpercentage: update.winpercentage } }
            }
        }));

        // // ✅ Execute bulk update
        await Percentage.bulkWrite(bulkOperations);

        // // ✅ Fetch updated records
        const updatedPercentages = await Percentage.find({ _id: { $in: updates.map(u => u.id) } });

        const user = await User.findById(id).exec();

        if (!user) {
            return res.status(404).json({ success: false, error: "User not found" });
        }
        // ✅ Fetch all users under this admin
        let allUsers = await getUsersRoleWise(user.role, user._id);

        // ✅ Fetch games list based on user role
        const gameData = await getGamesByUserRole(id, user.role);
        if (!gameData.success) {
            return res.status(500).json({ success: false, error: gameData.error });
        }

        // ✅ Fetch admin game list with percentages
        const adminGameData = await getAdminGameList(user._id, user.role);
        if (!adminGameData.success) {
            return res.status(500).json({ success: false, error: adminGameData.error });
        }
        return res.status(200).json({
            success: true,
            message: "Win percentages updated successfully.",
            data: updatedPercentages,
            games: gameData.games,
            users: allUsers,
            adminGameList: adminGameData.adminGameList,
        });

    } catch (error) {
        console.error("Error updating win percentages:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error. Could not update win percentages.",
            error: error.message,
        });
    }
};

const getGamesByUserRole = async (userId) => {
    try {
        // ✅ Fetch user with `isDeleted: false`
        const user = await User.findOne({ _id: userId, isDeleted: false }).exec();
        if (!user) return { error: "User not found or inactive" };

        let gameList = [];

        if (user.role === "superadmin") {
            // ✅ Superadmin gets all non-deleted games
            gameList = await Game.find({ isDeleted: false }).exec() || [];
        } else if (user.role === "admin") {
            // ✅ Admin gets only their assigned non-deleted games
            const adminWithGames = await User.findOne({ _id: userId, isDeleted: false })
                .populate({ path: "games", match: { isDeleted: false } })
                .exec();
            gameList = adminWithGames?.games || [];
        } else {
            let referenceUser = await User.findOne({ _id: user.refId, isDeleted: false }).exec();

            if (user.role === "superareamanager") {
                referenceUser = await User.findOne({ _id: user.refId, isDeleted: false })
                    .populate({ path: "games", match: { isDeleted: false } })
                    .exec();
            } else if (["areamanager", "master"].includes(user.role)) {
                const superDistributor = await User.findOne({ _id: referenceUser?.refId, isDeleted: false }).exec();
                referenceUser = await User.findOne({ _id: superDistributor?.refId, isDeleted: false })
                    .populate({ path: "games", match: { isDeleted: false } })
                    .exec();
            }

            gameList = referenceUser?.games || [];
        }

        return { success: true, games: gameList };
    } catch (error) {
        console.error("Error fetching games:", error);
        return { error: "Internal Server Error" };
    }
};

const getAdminGameList = async (userId, role) => {
    try {
        let adminGameList = [];

        // ✅ Validate role
        if (!["superadmin", "admin"].includes(role)) {
            return { success: false, message: "User role is not authorized" };
        }

        // ✅ Apply filter based on role
        const filter = role === "admin" ? { adminId: userId, isDeleted: false } : { isDeleted: false };
        // ✅ Fetch percentages (only non-deleted)
        const percentages = await Percentage.find(filter)
            .exec();
        // ✅ Extract game IDs from percentages
        const gameIds = percentages.map(p => p.gameId);

        // ✅ Fetch games (only non-deleted)
        const games = await Game.find({ gameId: { $in: gameIds }, isDeleted: false }).exec() || [];

        // ✅ Fetch admin details only for required IDs
        const adminIds = [...new Set(percentages.map(p => p.adminId))]; // Unique admin IDs
        const admins = await User.find({ _id: { $in: adminIds }, isDeleted: false }).exec();
        const adminMap = admins.reduce((acc, admin) => {
            acc[admin._id] = admin.username;
            return acc;
        }, {});

        // ✅ Construct response
        adminGameList = percentages.map((percentage) => {
            const game = games.find(g => g.gameId.toString() === percentage.gameId.toString()) || null;
            return {
                id: percentage._id,
                adminId: percentage.adminId?._id || null,
                gameId: percentage.gameId,
                nofDigit: game ? game.nodigit : '0',
                username: adminMap[percentage.adminId] || 'Unknown User',
                gameName: game?.gameName || 'Unknown Game',
                winpercentage: percentage.winpercentage,
            };
        });

        return { success: true, adminGameList };

    } catch (error) {
        console.error("Error fetching admin game list:", error);
        return { success: false, error: "Internal Server Error" };
    }
};


module.exports = {
    updateWinpercentageById,
    updateWinpercentageBulk,
    loadGamesByAdmin,
};

