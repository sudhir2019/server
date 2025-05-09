const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const { ObjectId } = require("mongodb");

async function connectToDatabase() {
  const connectionString = process.env.MONGODB_URI;

  const options = {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 30000,
    connectTimeoutMS: 30000,
    maxPoolSize: 10,
    useNewUrlParser: true,
    useUnifiedTopology: true,
  };

  let retryCount = 0;
  const maxRetries = 5;
  const retryInterval = 5000;

  while (retryCount < maxRetries) {
    try {
      const conn = await mongoose.connect(connectionString, options);
      console.log(`✅ Connected to MongoDB! Host: ${conn.connection.host}`);

      const db = conn.connection.db;
      const timeCollection = db.collection("times");
      const gameCollection = db.collection("games");

      // Load time data
      const timesData = JSON.parse(
        fs.readFileSync(path.join("rainbowrushadmin.times.json"))
      );

      for (const timeData of timesData) {
        const timeId = timeData._id["$oid"];
        const timecount = timeData.timecount;

        const exists = await timeCollection.findOne({ _id: new ObjectId(timeId) });

        if (exists) {
          console.log(`⏱ Time "${timecount}" already exists.`);
          continue;
        }

        await timeCollection.insertOne({
          _id: new ObjectId(timeId),
          timecount,
        });

        console.log(`✅ Time "${timecount}" inserted.`);
      }

      // Load game data
      const gamesData = JSON.parse(
        fs.readFileSync(path.join("rainbowrushadmin.games.json"))
      );

      for (const gameData of gamesData) {
        const gameId = gameData.gameId;

        const exists = await gameCollection.findOne({ gameId });

        if (exists) {
          console.log(`🎮 Game "${gameData.gameName}" already exists.`);
          continue;
        }

        let timeIds = [];
        try {
          timeIds = gameData.timeId.map((tid) => new ObjectId(tid["$oid"]));
        } catch (err) {
          console.error(`❌ Invalid timeId(s) for "${gameData.gameName}":`, err.message);
          continue;
        }

        const newGame = {
          gameIndex:gameData.gameIndex,
          gameName: gameData.gameName,
          nodigit: gameData.nodigit,
          logo: gameData.logo,
          status: gameData.status,
          isDeleted: gameData.isDeleted,
          deletedAt: gameData.deletedAt ? new Date(gameData.deletedAt["$date"]) : null,
          releaseDate: new Date(gameData.releaseDate["$date"]),
          publisher: gameData.publisher,
          GameImage: gameData.GameImage || [],
          label: gameData.label || "",
          createdAt: gameData.createdAt
            ? new Date(gameData.createdAt["$date"])
            : new Date(),
          updatedAt: gameData.updatedAt
            ? new Date(gameData.updatedAt["$date"])
            : new Date(),
          gameId,
          timeId: timeIds,
        };

        await gameCollection.insertOne(newGame);
        console.log(`✅ Game "${newGame.gameName}" inserted.`);
      }

      break; // All good
    } catch (error) {
      console.error(
        `❌ MongoDB connection failed (attempt ${retryCount + 1}/${maxRetries}):`,
        error.message
      );
      retryCount++;
      if (retryCount === maxRetries) {
        console.error("💥 Max retries reached. Exiting.");
        process.exit(1);
      }
      console.log(`🔁 Retrying in ${retryInterval / 1000} seconds...`);
      await new Promise((res) => setTimeout(res, retryInterval));
    }
  }
}

module.exports = connectToDatabase;
