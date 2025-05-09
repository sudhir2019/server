require("dotenv").config({ path: ".env" });

const path = require("path");
const fs = require("fs");
const { User } = require("../models/user.model");
const Percentage = require("../models/percentage.model");
const Game = require("../models/game.model");

// ✅ Default Users to Create
const defaultUsers = [
  { role: "gift", name: "GIFT ID", username: "GK00500055" },
  { role: "loan", name: "COMPUTER LOAN", username: "GK00500050" },
  { role: "otc", name: "OTC ID", username: "GK000050018" },
];

// ✅ Helpers
const generateDefaultPassword = () => "123456";
const generateDefaultPin = () => "1234";

// ✅ Create SuperAdmin
const createSuperAdmin = async () => {
  try {
    const existing = await User.findOne({ username: "GK00700001" }).lean();
    if (existing) {
      console.log("✅ SuperAdmin already exists.");
      return existing;
    }

    const superAdmin = new User({
      username: "GK00700001",
      firstName: "Super",
      lastName: "Admin",
      phone: "0000000000",
      email: "superadmin@example.com",
      address: "Admin Address",
      city: "Admin City",
      state: "Admin State",
      country: "Admin Country",
      password: "superadmin123",
      pin: "1234",
      pinPassword: "1234-superadmin123",
      role: "superadmin",
      userStatus: true,
      commission: 0,
      note: "System generated SuperAdmin",
      walletBalance: 100000000000,
      isLoggedIn: true,
    });

    await superAdmin.save();
    console.log("✅ SuperAdmin created successfully!");
    return superAdmin;
  } catch (err) {
    console.error("❌ Error creating SuperAdmin:", err.message);
  }
};

// ✅ Create Admin
const createAdmin = async (superAdminId) => {
  try {
    const existing = await User.findOne({ username: "GK00600001" }).lean();
    if (existing) {
      console.log("✅ Admin already exists.");
      return existing;
    }

    const admin = new User({
      username: "GK00600001",
      firstName: "Admin",
      lastName: "Admin",
      phone: "0000000001",
      email: "admin@example.com",
      address: "Admin Address",
      city: "Admin City",
      state: "Admin State",
      country: "Admin Country",
      password: "admin123",
      pin: "1234",
      pinPassword: "1234-admin123",
      role: "admin",
      userStatus: true,
      commission: 0,
      note: "System generated Admin",
      walletBalance: 1000000,
      isLoggedIn: true,
      refId: superAdminId,
      parentId: superAdminId,
    });

    await admin.save();

    await User.findByIdAndUpdate(superAdminId, {
      $push: { subordinates: admin._id },
    });

    console.log("✅ Admin created successfully!");
    return admin;
  } catch (err) {
    console.error("❌ Error creating Admin:", err.message);
  }
};

// ✅ Create Users with Fixed Usernames
const createUserWithFixedUsername = async (role, name, username, adminId) => {
  try {
    const existing = await User.findOne({ username }).lean();
    if (existing) {
      console.log(`✅ ${name} (${username}) already exists.`);
      return;
    }

    const password = "123456";
    const pin = "1234";
    const pinPassword = `${pin}-${password}`;

    const user = new User({
      username,
      firstName: name.split(" ")[0],
      lastName: name.split(" ")[1] || "",
      phone: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      email: `${role}@example.com`,
      address: "Default Address",
      city: "Default City",
      state: "Default State",
      country: "Default Country",
      password,
      pin,
      pinPassword,
      role,
      userStatus: true,
      commission: 0,
      note: `System generated ${name}`,
      walletBalance: 0,
      isLoggedIn: false,
      refId: adminId,
      parentId: adminId,
    });

    await user.save();

    await User.findByIdAndUpdate(adminId, {
      $push: { subordinates: user._id },
    });

    console.log(`✅ ${name} (${username}) created successfully!`);
  } catch (err) {
    console.error(`❌ Error creating ${name}:`, err.message);
  }
};




const assignAndInsertPercentages = async (adminId) => {
  try {
    const gamesPath = path.join(__dirname, '../../rainbowrushadmin.games.json');
    const gamesData = JSON.parse(fs.readFileSync(gamesPath, 'utf8'));

    const gameIds = [];
    const adminUser = await User.findById(adminId);

    if (!adminUser) {
      console.log("❌ Admin user not found.");
      return;
    }

    for (const game of gamesData) {
      const existingGame = await Game.findOne({ gameId: game.gameId });

      if (existingGame) {
        gameIds.push(existingGame._id);

        // Insert a Pecentage document if not already exists
        const alreadyExists = await Percentage.findOne({
          gameId: existingGame.gameId.toString(),
          adminId: adminUser._id
        });

        if (!alreadyExists) {
          const newPercentage = new Percentage({
            gameId: existingGame.gameId.toString(), // storing as string if your schema requires
            winpercentage: 100,
            adminId: adminUser._id,
            nextDrawNo: null,
            isDeleted: false,
            deletedAt: null,
            gameBalance: 0
          });
          await newPercentage.save();
        } else {
          console.log(`ℹ️ Pecentage already exists for game ${game.gameId} and admin ${adminUser._id}`);
        }
      } else {
        console.warn(`⚠️ Game with gameId ${game.gameId} not found in DB.`);
      }
    }

    adminUser.games = gameIds;
    await adminUser.save();

    console.log(`✅ Successfully linked ${gameIds.length} games and inserted Pecentage records.`);
    return true; // ✅ Add this line
  } catch (error) {
    console.error("❌ Error in assignAndInsertPercentages:", error.message);
  }
};


// ✅ Full Setup Function
const setupSystem = async () => {
  try {
    console.log("🚀 Starting system setup...");

    const superAdmin = await createSuperAdmin();
    if (!superAdmin) throw new Error("SuperAdmin creation failed");

    const admin = await createAdmin(superAdmin._id);
    if (!admin) throw new Error("Admin creation failed");



    const assignGames = await assignAndInsertPercentages(admin._id);
    if (!assignGames) throw new Error("Games creation failed");

    for (const user of defaultUsers) {
      await createUserWithFixedUsername(user.role, user.name, user.username, admin._id);
    }

    console.log("✅ System setup completed.");
  } catch (err) {
    console.error("❌ Error during system setup:", err.message);
  }
};

module.exports = { setupSystem };
