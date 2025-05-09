const Game = require("../models/game.model");
const { User } = require("../models/user.model");
const { validationResult } = require("express-validator"); // To handle validation errors
const { default: mongoose } = require("mongoose");
const Percentage = require("../models/percentage.model");
const GameImage = require("../models/gameimage.model");

const fetchGames = async (query = {}, sort = "gameName", sortOrder = 1) => {
  try {
    const gameQuery = {
      isDeleted: false,  // ✅ Ignore soft-deleted games
      ...query
    };
    return await Game.find(gameQuery)
      .populate("timeId")
      .populate("GameImage")
      .sort({ [sort]: sortOrder })
      .exec();
  } catch (error) {
    console.error("Error fetching games:", error);
    throw new Error("Failed to fetch games.");
  }
};

const getAllGames = async (req, res) => {
  try {
    const {
      search,
      page = 1,
      limit = 50,
      status,
      publisher,
      sortBy = "gameName",
      sortOrder = "asc",
    } = req.query;
    // Build query object
    let query = { isDeleted: false }; // ✅ Exclude soft-deleted games

    // Add search functionality
    if (search) {
      query.$or = [
        { gameName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { publisher: { $regex: search, $options: "i" } },
      ];
    }

    // Add status filter
    if (status) {
      query.status = status;
    }

    // Add publisher filter
    if (publisher) {
      query.publisher = publisher;
    }

    // Calculate skip value for pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Get total count for pagination
    const totalCount = await Game.countDocuments(query);

    // Get games with pagination and sorting
    const games = await Game.find(query)
      .populate("timeId")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .exec();

    // If no games found
    if (games.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No games found for the given criteria.",
      });
    }

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    // Return success response
    return res.status(200).json({
      success: true,
      data: games,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalGames: totalCount,
        hasNextPage,
        hasPrevPage,
        limit: parseInt(limit),
      },
      filters: {
        search: search || null,
        status: status || null,
        publisher: publisher || null,
      },
      sorting: {
        sortBy,
        sortOrder,
      },
    });
  } catch (error) {
    console.error("Error fetching games:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching games",
      error: error.message,
    });
  }
};

// GET: Get a game by gameId
const getGameById = async (req, res) => {
  try {
    const id = req.params.id?.replace(/^:/, "");
    const game = await Game.findById(id);

    if (!game) {
      return res.status(404).json({
        success: false,
        message: "Game not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: game,
    });
  } catch (error) {
    console.error("Error fetching game:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching game",
      error: error.message,
    });
  }
};

// POST: Create a new game
const createGame = async (req, res) => {
  const {
    nodigit,
    gameName,
    description,
    releaseDate,
    publisher,
    status,
    logo,
    timeId,
  } = req.body;

  try {


    const images = req.processedImages || [];
    const parsedNodigit = parseInt(nodigit, 10) || 0;
    const time = []
    time.push(timeId)
    // Step 4: Create New Game Instance
    const newGame = new Game({
      nodigit: parsedNodigit,
      gameName,
      description,
      releaseDate,
      publisher,
      status: status || 'active',  // Default to "active" if status is not provided
      logo: logo || "https://platopedia.com/docs/assets/images/logos/default.png", // Default logo if not provided
      timeId: time
    });

    // Step 5: Save the New Game to the Database
    if (images.length > 0) {
      for (const image of images) {
        const newImage = new GameImage({
          nodigit: parsedNodigit,
          image: image,
          GameId: newGame._id,
        });

        const savedImage = await newImage.save();
        newGame.GameImage.push(savedImage._id);
      }
    }

    await newGame.save(); // Save the game after processing images

    // Fetch and return all games
    const games = await fetchGames(); // Assuming fetchGames is a function that returns all games

    // Return success response
    return res.status(201).json({
      success: true,
      message: "Game created successfully",
      data: games,
    });

  } catch (error) {
    // Improved error logging
    console.error("Error creating game:", error.message, error.stack);

    // Return a more specific error message depending on the error type
    return res.status(500).json({
      success: false,
      message: "Error creating game",
      error: error.message || "An unexpected error occurred",
    });
  }
};


// PUT: Update a game by gameId
const updateGame = async (req, res) => {
  try {
    const id = req.params.id?.replace(/^:/, "");
    // 1. Validate incoming request data
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // 2. Find and update the game by gameId
    const updatedGame = await Game.findOneAndUpdate({ _id: id }, req.body, {
      new: true,
      runValidators: true,
    });

    // 3. If game not found, return 404
    if (!updatedGame) {
      return res.status(404).json({ message: "Game not found" });
    }
    // get all game
    const games = await fetchGames();
    // 4. Return the updated game data
    return res.status(200).json({
      message: "Game updated successfully",
      game: games,
      updatedGame: updatedGame,
    });
  } catch (error) {
    // 5. Handle errors during update
    console.error("Error updating game:", error);
    return res.status(500).json({
      message: "Error updating game",
      error: error.message,
    });
  }
};

// DELETE: Delete a game by gameId
// ✅ Soft Delete a Game
const deleteGame = async (req, res) => {
  try {
    const gameId = req.params.id?.replace(/^:/, "");

    if (!gameId || !mongoose.Types.ObjectId.isValid(gameId)) {
      return res.status(400).json({ success: false, message: "Invalid game ID" });
    }

    // Find game by ID
    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ success: false, message: "Game not found" });
    }

    // Perform soft delete
    game.isDeleted = true;
    game.deletedAt = new Date();
    await game.save();
    const games = await fetchGames();
    return res.status(200).json({
      success: true,
      message: "Game deleted successfully (soft delete)",
      games,
    });

  } catch (error) {
    console.error("❌ Error deleting game:", error);
    return res.status(500).json({
      success: false,
      message: "Error deleting game",
      error: error.message,
    });
  }
};

// Toggle game status (active/inactive)
const toggleGameStatus = async (req, res) => {
  const gameId = req.params.id?.replace(/^:/, "");
  const action = req.params.action;

  try {
    const game = await Game.findOne({ _id: gameId });
    if (!game) {
      return res.status(404).json({
        success: false,
        message: "Game not found",
      });
    }

    // Validate and update status
    if (action === "activate") {
      if (game.status === "active") {
        return res.status(400).json({
          success: false,
          message: "Game is already active",
        });
      }
      game.status = "active";
    } else if (action === "deactivate") {
      if (game.status === "inactive") {
        return res.status(400).json({
          success: false,
          message: "Game is already inactive",
        });
      }
      game.status = "inactive";
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid action. Use 'activate' or 'deactivate'.",
      });
    }

    await game.save();

    // Fetch updated games list with pagination and sorting
    const games = await fetchGames();

    return res.status(200).json({
      success: true,
      message: `Game ${action}d successfully`,
      data: games,
    });
  } catch (error) {
    console.error(`Error occurred during game ${action}:`, error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

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
        let superdistributors = await User.find({ role: "superareamanager", refId: admin._id }).exec();
        superdistributorsData.push(...superdistributors);

        for (let superdistributor of superdistributors) {
          // For each superdistributor, fetch distributors
          let distributors = await User.find({ role: "areamanager", refId: superdistributor._id }).exec();
          distributorsData.push(...distributors);

          for (let distributor of distributors) {
            // For each distributor, fetch retailers
            let retailers = await User.find({ role: "master", refId: distributor._id }).exec();
            retailersData.push(...retailers);

            for (let retailer of retailers) {
              // For each retailer, fetch users
              let users = await User.find({ role: "player", refId: retailer._id }).exec();
              usersData.push(...users);
            }
          }
        }
      }

    } else if (role === "admin") {
      // Fetch admins (this is where you start for admin role)
      let admins = await User.find({ role: "admin", _id: new mongoose.Types.ObjectId(id) }).exec();
      adminsData.push(...admins);



      for (let admin of admins) {
        // Fetch superdistributors under each admin
        let superdistributors = await User.find({ role: "superareamanager", refId: admin._id }).exec();
        superdistributorsData.push(...superdistributors);

        for (let superdistributor of superdistributors) {
          // Fetch distributors under each superdistributor
          let distributors = await User.find({ role: "areamanager", refId: superdistributor._id }).exec();
          distributorsData.push(...distributors);

          for (let distributor of distributors) {
            // Fetch retailers under each distributor
            let retailers = await User.find({ role: "master", refId: distributor._id }).exec();
            retailersData.push(...retailers);

            for (let retailer of retailers) {
              // Fetch users under each retailer
              let users = await User.find({ role: "player", refId: retailer._id }).exec();
              usersData.push(...users);
            }
          }
        }
      }

    } else if (role === "superareamanager") {
      // Start from superdistributor if the role is superdistributor
      let superdistributors = await User.find({ role: "superareamanager", _id: new mongoose.Types.ObjectId(id) }).exec();
      superdistributorsData.push(...superdistributors);

      for (let superdistributor of superdistributors) {
        let distributors = await User.find({ role: "areamanager", refId: superdistributor._id }).exec();
        distributorsData.push(...distributors);

        for (let distributor of distributors) {
          let retailers = await User.find({ role: "master", refId: distributor._id }).exec();
          retailersData.push(...retailers);

          for (let retailer of retailers) {
            let users = await User.find({ role: "player", refId: retailer._id }).exec();
            usersData.push(...users);
          }
        }
      }

    } else if (role === "areamanager") {
      // Start from distributor if the role is distributor
      let distributors = await User.find({ role: "areamanager", _id: new mongoose.Types.ObjectId(id) }).exec();
      distributorsData.push(...distributors);

      for (let distributor of distributors) {
        let retailers = await User.find({ role: "master", refId: distributor._id }).exec();
        retailersData.push(...retailers);

        for (let retailer of retailers) {
          let users = await User.find({ role: "player", refId: retailer._id }).exec();
          usersData.push(...users);
        }
      }

    } else if (role === "master") {
      // Start from retailer if the role is retailer
      let retailers = await User.find({ role: "master", _id: new mongoose.Types.ObjectId(id) }).exec();
      retailersData.push(...retailers);

      for (let retailer of retailers) {
        let users = await User.find({ role: "player", refId: retailer._id }).exec();
        usersData.push(...users);
      }

    }

    return usersData;

  } catch (error) {
    console.error("Error in getUsersRoleWise:", error);
  }
}

const loadGamesByAdmin = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, error: 'Invalid ObjectId format' });
  }

  try {
    const user = await User.findById(id).exec();
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    let allUsers = await getUsersRoleWise(user.role, user._id);

    let gameList = [];
    if (user.role === "superadmin") {
      gameList = await Game.find().exec() || [];
    } else if (user.role === "admin") {
      const adminWithGames = await User.findById(id).populate('games').exec();
      gameList = adminWithGames?.games || [];
    } else {
      let referenceUser = await User.findById(user.refId).exec();

      if (user.role === "superareamanager") {
        referenceUser = await User.findById(user.refId).populate('games').exec();
      } else if (user.role === "areamanager" || user.role === "master") {
        const superDistributor = await User.findById(referenceUser?.refId).exec();
        referenceUser = await User.findById(superDistributor?.refId).populate('games').exec();
      }
      gameList = referenceUser?.games || [];
    }

    let adminGameList = [];
    if (["superadmin", "admin"].includes(user.role)) {
      const filter = user.role === "admin" ? { adminId: user._id } : {};
      const percentages = await Percentage.find(filter).populate("adminId").exec();
      const gameIds = percentages.map(p => p.gameId);
      const games = await Game.find({ gameId: { $in: gameIds } }).exec() || [];
      adminGameList = await Promise.all(
        percentages.map(async (percentage) => {
          const game = games.length > 0
            ? games.find(g => g.gameId.toString() === percentage.gameId.toString())
            : null;
          const admin = await User.findById(percentage.adminId).exec();
          return {
            id: percentage._id,
            gameId: percentage.gameId,
            nofDigit: game ? game.nodigit : '0',
            username: admin?.username || 'Unknown User',
            gameName: game?.gameName || 'Unknown Game',
            winpercentage: percentage.winpercentage,
          };
        })
      );
    }

    res.status(200).json({
      success: true,
      games: gameList,
      users: allUsers,
      adminGameList,
    });

  } catch (error) {
    console.log(error)
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const updateWinPercentage = async (req, res) => {
  try {
    const { adminId, gameId } = req.params; // Extract IDs from URL
    const { winpercentage } = req.body; // Extract new win percentage

    // ✅ Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(adminId) || !mongoose.Types.ObjectId.isValid(gameId)) {
      return res.status(400).json({ success: false, message: "Invalid ID format." });
    }

    // ✅ Validate win percentage (should be a number between 0-100)
    if (typeof winpercentage !== "number" || winpercentage < 0 || winpercentage > 100) {
      return res.status(400).json({ success: false, message: "Win percentage must be a number between 0 and 100." });
    }

    // ✅ Check if admin exists
    const admin = await User.findById(adminId);
    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin not found." });
    }

    // ✅ Check if game exists
    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ success: false, message: "Game not found." });
    }

    // ✅ Find existing percentage entry
    let percentageEntry = await Percentage.findOne({ adminId, gameId });

    if (percentageEntry) {
      // ✅ Update existing entry
      percentageEntry.winpercentage = winpercentage;
      await percentageEntry.save();
    } else {
      // ✅ Create new entry if not found
      percentageEntry = await Percentage.create({
        adminId,
        gameId,
        winpercentage,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Win percentage updated successfully.",
      data: percentageEntry,
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

const getUsersByRole = async (role, id) => {
  let rolesToFetch;

  try {
    // Define role-based logic
    switch (role) {
      case "superadmin":
        rolesToFetch = ['admin', 'superareamanager', 'areamanager', 'master', 'player'];
        break;
      case "admin":
        rolesToFetch = ['superareamanager', 'areamanager', 'master', 'player'];
        break;
      case "superareamanager":
        // For superdistributor, fetch all distributors, retailers, and users
        rolesToFetch = ['areamanager', 'master', 'player'];
        break;
      case "areamanager":
        // For distributor, fetch all retailers and users
        rolesToFetch = ['master', 'player'];
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

module.exports = {
  getAllGames,
  getGameById,
  createGame,
  updateGame,
  deleteGame,
  toggleGameStatus,
  loadGamesByAdmin,
  updateWinPercentage,
  getUsersByRole
};

