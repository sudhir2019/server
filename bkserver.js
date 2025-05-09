// require("dotenv").config({ path: ".env" });
// const express = require("express");
// var cron = require("node-cron");

// const connectToDatabase = require("./src/configs/db");
// const { setupSystem } = require("./src/libs/initialSetUp");
// const { initializeSocket } = require("./src/configs/io");
// const app = require("./src/app");
// const server  = require("http").createServer(app);

// connectToDatabase();

// setupSystem();

// initializeSocket(server);

// cron.schedule("* * * * *", () => {
//   console.log("Cron job is running every minute");
// });

// const PORT = process.env.PORT || 8082;
// const HOST = process.env.HOST || "localhost";

// // Start the server on the specified host and port
// app.listen(PORT, HOST, () => {
//   console.log(`Server is listening on http://${HOST}:${PORT}`);
// });





// server.js
const NodeCache = require('node-cache');
const Game = require('./src/models/game.model');
const Percentage = require('./src/models/percentage.model');
const { Draw } = require('./src/models/draw.model');
const { Ticket } = require('./src/models/ticket.model');
const { User } = require('./src/models/user.model');
const Result = require('./src/models/result.models');
const mongoose = require('mongoose');  // Ensure mongoose is imported if it's not already

require("dotenv").config({ path: ".env" });
const app = require("./src/app"); // Import the app
const http = require("http").createServer(app); // Create HTTP server with app
const socketIO = require("socket.io");
const socketOrigin = process.env.SOCKET_ORIGIN;

const io = socketIO(http, {
  cors: {
    origin: (origin, callback) => {
      const allowedOrigins = ["https://singhjyotiadmin.life", "https://fun-rep.pro", "https://play-rep.pro", "http://localhost:5173", "http://localhost:5174"];

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, origin); // ✅ Set the specific origin
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["Cookie", "Authorization"],
    credentials: true, // ✅ Allows cookies to be sent
  }
});


// Import your database and setup functions
const connectToDatabase = require("./src/configs/db");
const { setupSystem } = require("./src/libs/initialSetUp");
const cron = require("node-cron");

// Perform system setup and cron job schedule
connectToDatabase();
setupSystem();

// Define cron job
cron.schedule("0 * * * *", () => {
  console.log("Server is running");
});

let gameTimers = {};
const activeIntervals = new Map();
const gameIntervals = new Map(); // store intervalId by socket.id

let timerInterval;

io.on('connection', async (socket) => {
  console.log('A user connected');
  // console.log(socket);
  socket.emit('connectionAck', 'Connected to server');  // Emit to client that connection is successful
  const userId = socket.handshake.query.userId;
  const socketId = socket.handshake.query.socketId;
  try {
    // Update user's online status to false (offline)
    await User.findByIdAndUpdate(
      userId,
      { isLoggedIn: true, socketId: socketId },
      { new: true } // optional: returns the updated document
    );
    console.log(`User ${userId} is online.`);
  } catch (error) {
    console.error('Error updating user status:', error);
  }


  socket.on('timerData', async (data) => {
    try {
      const adminId = data.adminId;  // Fixed the typo (was admnId)
      const gameId = data.gameId;



      // console.log(data);
      // Find the percentage data by adminId and gameId
      const percentageData = await Percentage.findOne({ adminId: new mongoose.Types.ObjectId(adminId), gameId: gameId }).exec();

      if (!percentageData) {
        console.log('Percentage data not found');
        return;
      }

      // Now find the game data related to gameId
      const gameData = await Game.findOne({ gameId: gameId }).populate('timeId').exec();

      if (!gameData) {
        console.log('Game data not found');
        return;
      }
      if (timerInterval) {
        clearInterval(timerInterval);
      }

      if (gameData?.timeId[0]?.timecount === 60) {
        runTimer1(gameData?.timeId[0]?.timecount);
      } else {
        runTimer2(gameData?.timeId[0]?.timecount);
      }


    } catch (error) {
      console.error('Error in socket timer:', error);  // Better error logging
      socket.emit('timerError', 'An error occurred while processing the timer data.');
    }
  });




  socket.on("gameData", async ({ adminId, gameId }) => {
    if (!adminId || !gameId) {
      return socket.emit("responseData", { error: "Missing adminId or gameId" });
    }

   // Clear previous interval if any
    if (gameIntervals.has(socket.id)) {
      clearInterval(gameIntervals.get(socket.id));
    }

    // Emit once
    // const first = await getGameData(adminId, gameId);
    // socket.emit("responseData", first);

    // Emit every second
    const intervalId = setInterval(async () => {
      const fresh = await getGameData(adminId, gameId);
      socket.emit("responseData", fresh);
    }, 1000);

    gameIntervals.set(socket.id, intervalId);
  });










  socket.on('disconnect', async () => {
    console.log(`Socket ${socket.id} disconnected`);

    try {
      if (socket.adminId) {
        await User.findByIdAndUpdate(
          socket.adminId,
          { isLoggedIn: false, socketId: null },
          { new: true }
        );
        console.log(`User ${socket.adminId} is offline.`);
      }
    } catch (error) {
      console.error('Error updating user status:', error);
    }

    if (gameIntervals.has(socket.id)) {
      clearInterval(gameIntervals.get(socket.id));
      gameIntervals.delete(socket.id); // 💥 Remove stale reference
    }

  });



});


async function getMockGameData(gameId) {
  return {
    gameId,
    updatedAt: new Date().toISOString(),
    value: Math.floor(Math.random() * 1000)
  };
}



function runTimer1(seconds) {
  if (timerInterval) clearInterval(timerInterval);

  if (seconds !== 60) {
    console.error("This function is designed for 1-minute sync timer only (60s)");
    return;
  }

  timerInterval = setInterval(() => {
    const now = new Date();
    const currentSec = now.getSeconds(); // 0 to 59
    const remainingTime = 59 - currentSec;

    const minutes = Math.floor(remainingTime / 60);
    const secs = remainingTime % 60;

    const formatted = `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    io.emit("timer", formatted);
  }, 1000);
}


function runTimer2(seconds) {
  if (timerInterval) clearInterval(timerInterval);

  if (seconds !== 120) {
    console.error("This function is designed for 2-minute sync timer only (120s)");
    return;
  }

  timerInterval = setInterval(() => {
    const now = new Date();
    const totalSecs = now.getMinutes() * 60 + now.getSeconds();
    const mod120 = totalSecs % 120;           // Where we are in this 2-minute loop
    const remainingTime = 119 - mod120;       // Countdown from 01:59 to 00:00

    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;

    const formatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    io.emit("timer", formatted);
  }, 1000);
}



async function getGameData(adminId, gameId) {
  switch (gameId) {
    case "MNOQqWWi":
      return await handleTargetGame(adminId, gameId);
    case "vwRORrGO":
      return await handleRouletteGame(adminId, gameId);
    case "zuuhVbBM":
      return await handleTripleFunGame(adminId, gameId);
    case "qZicXikM":
      return await handleAndarBaharGame(adminId, gameId);
    case "qZicXikT":
      return await handleTitliGame(adminId, gameId);
    default:
      return { error: "Game not found" };
  }
}


async function handleTargetGame(adminId, gameId) {
  const funtarget = Array.from({ length: 10 }, (_, i) => {
    const drawno = (i + 1) % 10;
    return {
      label: drawno.toString(),
      drawno: drawno.toString(),
      image: "",
      color: "",
      sum: 0,
    };
  });

  const drawData = await getDrawData(adminId, gameId);

  const data = funtarget.map((obj) => {
    const draw = drawData.find(item => item._id === obj.drawno);
    return {
      ...obj,
      sum: draw ? draw.drawtotal : 0
    };
  });

  const [totalGameCollection, foundPercentage, lastResults] = await Promise.all([
    CalculateTotalCollection(adminId, gameId),
    getPercentageData(adminId, gameId),
    lastfiveresult(adminId, gameId)
  ]);

  return {
    success: true,
    data,
    collections: totalGameCollection,
    percentageData: foundPercentage,
    lastData: lastResults
  };
}


async function handleRouletteGame(adminId, gameId) {
  // Generate roulette numbers with colors
  const funroullet = Array.from({ length: 37 }, (_, i) => {
    const redNumbers = [
      1, 3, 5, 7, 9, 12, 14, 16, 18, 19,
      21, 23, 25, 27, 30, 32, 34, 36
    ];
    const color = i === 0 ? "green" : redNumbers.includes(i) ? "red" : "black";
    return {
      label: i.toString(),
      drawno: i.toString(),
      image: "",
      color: color,
    };
  });

  // Add "00" for American roulette
  funroullet.push({
    label: "00",
    drawno: "00",
    image: "",
    color: "green",
  });

  const drawData = await getDrawData(adminId, gameId);

  const data = funroullet.map((obj) => {
    const draw = drawData.find(item => item._id === obj.drawno);
    return {
      ...obj,
      sum: draw ? draw.drawtotal : 0
    };
  });

  const [totalGameCollection, foundPercentage, lastResults] = await Promise.all([
    CalculateTotalCollection(adminId, gameId),
    getPercentageData(adminId, gameId),
    lastfiveresult(adminId, gameId)
  ]);

  return {
    success: true,
    data,
    collections: totalGameCollection,
    percentageData: foundPercentage,
    lastData: lastResults
  };
}

async function handleTripleFunGame(adminId, gameId) {
  const drawData = await getDrawDataNew(adminId, gameId); // 1 query instead of 3000
  const drawMap = new Map();

  // Convert to quick lookup
  for (const item of drawData) {
    drawMap.set(item._id, item.drawtotal);
  }

  const data = [];

  for (let i = 0; i < 1000; i++) {
    const number = i.toString().padStart(3, '0');
    const [a, b, c] = number.split('');
    const single = c;
    const jodi = b + c;
    const triple = number;
    const drawno = a + "-" + b + "-" + c;
    const label = a + "-" + b + "-" + c;
    const image = `/assets/games/triplefun/${number}.png`;

    // Get from preloaded drawMap instead of DB
    const getSingleSum = parseFloat(drawMap.get(single) || 0);
    const getJodiSum = parseFloat(drawMap.get(jodi) || 0);
    const getTripleSum = parseFloat(drawMap.get(triple) || 0);

    const total = getSingleSum + getJodiSum + getTripleSum;

    data.push({
      label,
      drawno,
      image,
      sum: total
    });
  }
  const [totalGameCollection, foundPercentage, lastResults] = await Promise.all([
    CalculateTotalCollection(adminId, gameId),
    getPercentageData(adminId, gameId),
    lastfiveresult(adminId, gameId)
  ]);
  return {
    success: true,
    data,
    collections: totalGameCollection,
    percentageData: foundPercentage,
    lastData: lastResults
  };
}


async function handleAndarBaharGame(adminId, gameId) {
  const andharBahar = Array.from({ length: 13 }, (_, i) => {
    const drawno = i + 1; // 1 to 13
    const labels = {
      1: 'A',
      11: 'J',
      12: 'Q',
      13: 'K'
    };
    return {
      label: labels[drawno] || drawno.toString(),
      drawno: drawno.toString(),
      image: `/assets/games/${drawno}.png`,
      color: "",
    };
  });

  const drawData = await getDrawData(adminId, gameId);

  // Process main data
  const data = andharBahar.map((obj) => {
    const draw = drawData.find(item => item._id === obj.drawno);
    return {
      ...obj,
      sum: draw ? draw.drawtotal : 0
    };
  });

  // Get color data in parallel
  const colors = ["k", "c", "f", "l"];
  const colorPromises = colors.map(color => GetTotal(color, adminId, gameId));
  const colorTotals = await Promise.all(colorPromises);

  const dataColors = colors.map((color, index) => ({
    label: color,
    drawno: color,
    image: `/assets/games/${color}.png`,
    sum: colorTotals[index]
  }));

  // Get card type data in parallel
  const cardTypes = ["under", "bahar"];
  const cardTypePromises = cardTypes.map(type => GetTotal(type, adminId, gameId));
  const cardTypeTotals = await Promise.all(cardTypePromises);

  const dataCardTypes = cardTypes.map((type, index) => ({
    label: type.charAt(0).toUpperCase() + type.slice(1),
    drawno: type,
    sum: cardTypeTotals[index]
  }));

  const [totalGameCollection, foundPercentage, lastResults] = await Promise.all([
    CalculateTotalCollection(adminId, gameId),
    getPercentageData(adminId, gameId),
    lastfiveresult(adminId, gameId)
  ]);

  return {
    success: true,
    data,
    dataColors,
    dataCardTypes,
    collections: totalGameCollection,
    percentageData: foundPercentage,
    lastData: lastResults
  };
}

async function handleTitliGame(adminId, gameId) {
  const titli = Array.from({ length: 12 }, (_, i) => {
    const drawno = i + 1; // 1 to 12
    return {
      label: drawno.toString(),
      drawno: drawno.toString(),
      image: `/assets/games/titli/${drawno}.png`,
      color: "",
    };
  });

  const drawData = await getDrawData(adminId, gameId);

  const data = titli.map((obj) => {
    const draw = drawData.find(item => item._id === obj.drawno);
    return {
      ...obj,
      sum: draw ? draw.drawtotal : 0
    };
  });

  const [totalGameCollection, foundPercentage, lastResults] = await Promise.all([
    CalculateTotalCollection(adminId, gameId),
    getPercentageData(adminId, gameId),
    lastfiveresult(adminId, gameId)
  ]);

  return {
    success: true,
    data,
    collections: totalGameCollection,
    percentageData: foundPercentage,
    lastData: lastResults
  };
}

async function CalculateTotalCollection(adminId, gameId) {
  // Use cache for collection data
  const cacheKey = `collection-${adminId}-${gameId}`;
  const cachedData = dataCache.get(cacheKey);
  if (cachedData) return cachedData;

  var date = new Date();
  date.setHours(0, 0, 0, 0);
  const now = new Date();

  try {
    const tickets = await Ticket.aggregate([
      {
        $match: {
          adminid: new mongoose.Types.ObjectId(adminId),
          gameid: gameId,
          date: {
            $gte: date,
            $lte: now
          }
        }
      },
      {
        $group: {
          _id: null,
          totalPlaypoints: { $sum: "$playpoints" },
          totalWinpoints: { $sum: "$winpoints" }
        }
      }
    ]).exec();

    const result = tickets.length === 0
      ? { totalPlaypoints: 0, totalWinpoints: 0 }
      : { totalPlaypoints: tickets[0].totalPlaypoints, totalWinpoints: tickets[0].totalWinpoints };

    // Cache the result
    dataCache.set(cacheKey, result, 1); // Cache for 30 seconds
    return result;
  } catch (error) {
    console.error("Error calculating total collection:", error);
    return { totalPlaypoints: 0, totalWinpoints: 0 };
  }
}


async function getPercentageData(adminId, gameId) {
  // Cache key for percentage data
  const cacheKey = `percentage-${adminId}-${gameId}`;
  const cachedData = dataCache.get(cacheKey);
  if (cachedData) return cachedData;

  try {
    const percentageData = await Percentage.find({
      adminId: new mongoose.Types.ObjectId(adminId),
      gameId: gameId
    }).lean().exec();

    // console.log(percentageData);
    const formattedData = percentageData.map(item => ({
      ...item,
      gameBalance: parseFloat(item.gameBalance.toFixed(2))
    }));


     dataCache.set(cacheKey, formattedData, 1); // Cache for 30 seconds
    return formattedData;
  } catch (error) {
    console.error("Error fetching percentage data:", error);
    return [];
  }
}

async function getDrawData(adminId, gameId) {
  // Cache key for draw data
  const cacheKey = `draw-data-${adminId}-${gameId}`;
  const cachedData = dataCache.get(cacheKey);
  if (cachedData) return cachedData;

  try {
    const drawData = await Draw.aggregate([
      {
        $match: {
          adminid: new mongoose.Types.ObjectId(adminId),
          gameid: gameId,
          status: 0
        }
      },
      {
        $group: {
          _id: { $toString: "$drawno" },
          drawtotal: { $sum: "$drawtotal" }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    dataCache.set(cacheKey, drawData, 1); // Cache for 10 seconds
    return drawData;
  } catch (error) {
    console.error("Error fetching draw data:", error);
    return [];
  }
}

async function GetTotal(drawno, adminId, gameId) {
  // Use cache for draw totals
  const cacheKey = `draw-total-${adminId}-${gameId}-${drawno}`;
  const cachedTotal = dataCache.get(cacheKey);
  if (cachedTotal !== undefined) return cachedTotal;

  try {
    const result = await Draw.aggregate([
      {
        $match: {
          adminid: new mongoose.Types.ObjectId(adminId),
          gameid: gameId,
          status: 0,
          drawno: drawno.toString()
        }
      },
      {
        $group: {
          _id: { $toString: "$drawno" },
          drawtotal: { $sum: "$drawtotal" }
        }
      }
    ]);

    const total = result.length > 0 ? result[0].drawtotal : 0;
    dataCache.set(cacheKey, total, 1); // Cache for 15 seconds
    return total;
  } catch (error) {
    console.error(`Error getting total for drawno ${drawno}:`, error);
    return 0;
  }
}

async function getDrawDataNew(adminId, gameId) {
  // Validate inputs early
  if (!adminId || !gameId) {
    console.warn("getDrawData called with invalid adminId or gameId");
    return [];
  }

  const cacheKey = `draw-data-${adminId}-${gameId}`;
  const cachedData = dataCache.get(cacheKey);
  if (cachedData) return cachedData;

  try {
    const drawData = await Draw.aggregate([
      {
        $match: {
          adminid: new mongoose.Types.ObjectId(adminId),
          gameid: gameId,
          status: 0
        }
      },
      {
        $group: {
          _id: { $toString: "$drawno" },
          drawtotal: { $sum: "$drawtotal" }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Store only what's needed to keep memory light
    const formattedData = drawData.map(({ _id, drawtotal }) => ({
      _id,
      drawtotal
    }));

    dataCache.set(cacheKey, formattedData, 1); // Cache for 10 seconds
    return formattedData;
  } catch (error) {
    console.error(`Error fetching draw data for adminId=${adminId}, gameId=${gameId}:`, error);
    return [];
  }
}


async function lastfiveresult(adminId, gameId) {
  try {
    if (!gameId || !adminId) {
      return {
        success: false,
        message: "gameId and adminId are required",
        data: [],
      };
    }

    const ascendingData = await Result.find({ gameid: gameId, adminid: adminId, status: 1 })
      .sort({ _id: -1 })
      .limit(5)
      .lean()
      .exec();

    const data = ascendingData; // oldest to newest
    return { success: true, data };
  } catch (error) {
    console.error("Error fetching last results:", error);
    return {
      success: false,
      message: "Server error",
      data: [],
    };
  }
}



const dataCache = new NodeCache({
  stdTTL: 10,  // Default TTL of 10 seconds
  checkperiod: 5 // Check for expired keys every 5 seconds
});


// Listen on a specific host and port
const HOST = process.env.HOST || "localhost";
const PORT = process.env.PORT || 8081;
http.listen(PORT, HOST, () => {
  console.log(`Server is listening on http://${HOST}:${PORT}`);
});
