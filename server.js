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
      const allowedOrigins = ["https://rgnlife.in", "https://greport.pro", "https://planetg.co", "http://localhost:5173", "http://localhost:5174","http://127.0.0.1:5500"];

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

const gameTimers = new Map(); // Store intervals for each gameId
const gameIntervals = new Map(); // Store game data intervals by socketId

io.on('connection', async (socket) => {
  console.log('A user connected');
  socket.emit('connectionAck', 'Connected to server');  // Emit to client that connection is successful

  const userId = socket.handshake.query.userId;
  const socketId = socket.handshake.query.socketId;

  try {
    await User.findByIdAndUpdate(userId, { isLoggedIn: true, socketId: socketId }, { new: true });
    console.log(`User ${userId} is online.`);
  } catch (error) {
    console.error('Error updating user status:', error);
  }

  // Handle timerData event
//   socket.on('timerData', async (data) => {
//     try {
//       const { adminId, gameId } = data;

//       if (!gameId) {
//         console.error('⛔ No gameId found in data.');
//         return;
//       }

//       // Get game data based on adminId and gameId
//       const percentageData = await Percentage.findOne({ adminId: new mongoose.Types.ObjectId(adminId), gameId: gameId }).exec();

//       if (!percentageData) {
//         console.log('Percentage data not found');
//         return;
//       }

//       const gameData = await Game.findOne({ gameId: gameId }).populate('timeId').exec();
//       if (!gameData) {
//         console.log('Game data not found');
//         return;
//       }

//       const timeCount = gameData?.timeId[0]?.timecount;

//       // Clear any existing timer for this gameId
//       if (gameTimers.has(gameId)) {
//         clearInterval(gameTimers.get(gameId));  // Stop the existing timer
//         gameTimers.delete(gameId);  // Remove from map
//         console.log(`✅ Cleared existing timer for game ${gameId}`);
//       }

//       // Start new timer based on timeCount
//       if (timeCount === 60) {
       
//         runTimer1(socket, gameId, timeCount);  // Start 60-second timer
//       } else if (timeCount === 120) {
      
//         runTimer2(socket, gameId, timeCount);  // Start 120-second timer
//       }

//     } catch (error) {
//       console.error('Error in socket timer:', error);
//       socket.emit('timerError', 'An error occurred while processing the timer data.');
//     }
//   });


socket.on('timerData', async (data) => {
  try {
    const { adminId, gameId } = data;

    if (!gameId) {
      console.error('⛔ No gameId found in data.');
      return;
    }

    socket.join(gameId); // ✅ Join the room for this gameId

    // Fetch required data
    const percentageData = await Percentage.findOne({ adminId: new mongoose.Types.ObjectId(adminId), gameId: gameId }).exec();
    const gameData = await Game.findOne({ gameId: gameId }).populate('timeId').exec();

    if (!percentageData || !gameData) {
      console.log('Required game or percentage data not found');
      return;
    }

    const timeCount = gameData?.timeId[0]?.timecount;

    // ✅ Only start timer if one doesn't already exist for this gameId
    if (!gameTimers.has(gameId)) {
      if (timeCount === 60) {
        runTimer1(io, gameId, timeCount);  // Now uses io, not socket
      } else if (timeCount === 120) {
        runTimer2(io, gameId, timeCount);
      }
    }

  } catch (error) {
    console.error('Error in socket timer:', error);
    socket.emit('timerError', 'An error occurred while processing the timer data.');
  }
});



  // Handle gameData for periodic updates
  socket.on("gameData", async ({ adminId, gameId }) => {
    if (!adminId || !gameId) {
      return socket.emit("responseData", { error: "Missing adminId or gameId" });
    }

    // Clear previous interval if any
    if (gameIntervals.has(socket.id)) {
      clearInterval(gameIntervals.get(socket.id));  // Stop the previous interval
    }

    // Set new interval for game data
    const intervalId = setInterval(async () => {
    // clearInterval(intervalId);
      const fresh = await getGameData(adminId, gameId);
      socket.emit("responseData", fresh);
    }, 1000);

    gameIntervals.set(socket.id, intervalId);  // Store the new interval for game data
  });
  
  
  
  
     socket.on("checkStatus", async ({ userId, deviceId }) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return socket.emit("statusResponse", { error: "Invalid user ID" });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Optional: Update the user's deviceId
    // await User.updateOne({ _id: userObjectId }, { $set: { deviceId } });

    const user = await User.findById(userObjectId).select("isLoggedIn deviceId");

    if (!user) {
      return socket.emit("statusResponse", { error: "User not found" });
    }

    socket.emit("statusResponse", {
      isLoggedIn: user.isLoggedIn,
      deviceId: user.deviceId
    });

  } catch (error) {
    console.error("Error checking user status:", error);
    socket.emit("statusResponse", { error: "Internal server error" });
  }
});

  
  

  // Handle disconnection of socket
  socket.on('disconnect', async () => {
    console.log(`Socket ${socket.id} disconnected`);

    try {
      if (userId) {
        await User.findByIdAndUpdate(userId, { isLoggedIn: false, socketId: null }, { new: true });
        console.log(`User ${userId} is offline.`);
      }
    } catch (error) {
      console.error('Error updating user status:', error);
    }

    // Clear game data interval if it exists
    if (gameIntervals.has(socket.id)) {
      clearInterval(gameIntervals.get(socket.id));
      gameIntervals.delete(socket.id); // Remove stale reference
    }

    // Clear game timer for specific game if socket was involved in one
//   if (gameTimers.has(gameId)) {
//   clearInterval(gameTimers.get(gameId));  // Clear the previous interval
//   gameTimers.delete(gameId);  // Delete the reference to the previous interval
//   //console.log(`✅ Cleared previous timer for game ${gameId}`);
// }


const rooms = Array.from(socket.rooms);
  rooms.forEach(async (room) => {
    if (room !== socket.id) { // Skip the default room (socket.id)
      const socketsInRoom = await io.in(room).allSockets();
      if (socketsInRoom.size === 0) {
        // No more clients in this game room
        if (gameTimers.has(room)) {
          clearInterval(gameTimers.get(room));
          gameTimers.delete(room);
          console.log(`🧹 Timer for game ${room} cleared on last disconnect.`);
        }
      }
    }
  });
  
  


  });

});

// Helper to format time nicely

// function runTimer1(socket, gameId, seconds) {
//   let remainingTime = seconds;
// //   console.log(`🔵 Starting Timer1 for ${gameId} with initial time: ${formatTime(remainingTime)}`);

//   const interval = setInterval(() => {
//     const now = new Date();
//     const currentSec = now.getSeconds(); // 0 to 59
//     const remainingTime = 59 - currentSec;

//     const minutes = Math.floor(remainingTime / 60);
//     const secs = remainingTime % 60;

//     const formatted = `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
//   // socket.emit("timer", { gameId, time: formatted, type: "timer1" });  // Emit clearly
//   //console.log(`🔵 [${gameId}] Timer1: ${formatted}`);
// io.to(gameId).emit("timer", { gameId, time: formatted, type: "timer1" });
  
//     if (remainingTime < 0) {
//       clearInterval(interval);
//      // gameTimers.delete(gameId);
//       console.log(`🔁 Restarting Timer1 for ${gameId}`);
//       runTimer1(socket, gameId, seconds);
//     }
//   }, 1000);

//  gameTimers.set(gameId, interval);
// }

// function runTimer2(socket, gameId, seconds) {
//   let remainingTime = seconds;
// //   console.log(`🟢 Starting Timer2 for ${gameId} with initial time: ${formatTime(remainingTime)}`);

//   const interval = setInterval(() => {
//     const now = new Date();
//     const totalSecs = now.getMinutes() * 60 + now.getSeconds();
//     const mod120 = totalSecs % 120;
//     const remainingTime = 119 - mod120;

//     const minutes = Math.floor(remainingTime / 60);
//     const secs = remainingTime % 60;

//     const formatted = `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;


//     socket.emit("timer", { gameId, time: formatted, type: "timer2" });
//     //console.log(`🟢 [${gameId}] Timer2: ${formatted}`);


//     if (remainingTime < 0) {
//       clearInterval(interval);
//     //  gameTimers.delete(gameId);
//       console.log(`🔁 Restarting Timer2 for ${gameId}`);
//       runTimer2(socket, gameId, seconds);
//     }
//   }, 1000);

// //   gameTimers.set(gameId, interval);
// }



// function runTimer1(io, gameId, seconds) {
//   const interval = setInterval(() => {
//     const now = new Date();
//     const currentSec = now.getSeconds(); // 0 to 59
//     const remainingTime = 59 - currentSec;

//     const minutes = Math.floor(remainingTime / 60);
//     const secs = remainingTime % 60;
//     const formatted = `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

//     io.to(gameId).emit("timer", { gameId, time: formatted, type: "timer1" });

//     if (remainingTime < 0) {
//       clearInterval(interval);
//       runTimer1(io, gameId, seconds); // Restart
//     }
//   }, 1000);

//   gameTimers.set(gameId, interval);
// }

// function runTimer2(io, gameId, seconds) {
//   const interval = setInterval(() => {
//     const now = new Date();
//     const totalSecs = now.getMinutes() * 60 + now.getSeconds();
//     const mod120 = totalSecs % 120;
//     const remainingTime = 119 - mod120;

//     const minutes = Math.floor(remainingTime / 60);
//     const secs = remainingTime % 60;
//     const formatted = `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

//     io.to(gameId).emit("timer", { gameId, time: formatted, type: "timer2" });

//     if (remainingTime < 0) {
//       clearInterval(interval);
//       runTimer2(io, gameId, seconds);
//     }
//   }, 1000);

//   gameTimers.set(gameId, interval);
// }


function runTimer1(socket, gameId, seconds) {
  let remainingTime = seconds;

  const now = new Date();
  const currentSec = now.getSeconds(); // 0 to 59
  const remaining = 59 - currentSec;

  const minutes = Math.floor(remaining / 60);
  const secs = remaining % 60;

  const formatted = `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  // 🔹 Immediately send to the client who requested
  socket.emit("timer", { gameId, time: formatted, type: "timer1" });

  // 🔄 Broadcast interval to all users in this game's room
  const interval = setInterval(() => {
    const now = new Date();
    const currentSec = now.getSeconds();
    const remainingTime = 59 - currentSec;

    const minutes = Math.floor(remainingTime / 60);
    const secs = remainingTime % 60;
    const formatted = `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

    // 🔊 Emit to all users joined in this game's room
    io.to(gameId).emit("timer", { gameId, time: formatted, type: "timer1" });

    if (remainingTime < 0) {
      clearInterval(interval);
      console.log(`🔁 Restarting Timer1 for ${gameId}`);
      runTimer1(socket, gameId, seconds); // Restart the timer
    }
  }, 1000);

  gameTimers.set(gameId, interval); // Save timer for cleanup
}





function runTimer2(socket, gameId, seconds) {
  const now = new Date();
  const totalSecs = now.getMinutes() * 60 + now.getSeconds();
  const mod120 = totalSecs % 120;
  const remaining = 119 - mod120;

  const minutes = Math.floor(remaining / 60);
  const secs = remaining % 60;

  const formatted = `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  // 🔹 Emit immediately to the requesting socket
  socket.emit("timer", { gameId, time: formatted, type: "timer2" });

  // 🔄 Set interval to broadcast every second
  const interval = setInterval(() => {
    const now = new Date();
    const totalSecs = now.getMinutes() * 60 + now.getSeconds();
    const mod120 = totalSecs % 120;
    const remainingTime = 119 - mod120;

    const minutes = Math.floor(remainingTime / 60);
    const secs = remainingTime % 60;
    const formatted = `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

    // 🔊 Broadcast to all clients in the game room
    io.to(gameId).emit("timer", { gameId, time: formatted, type: "timer2" });

    if (remainingTime < 0) {
      clearInterval(interval);
      console.log(`🔁 Restarting Timer2 for ${gameId}`);
      runTimer2(socket, gameId, seconds); // Restart the timer loop
    }
  }, 1000);

  gameTimers.set(gameId, interval);
}




function clearAllGameTimers() {
  for (const [gameId, interval] of gameTimers.entries()) {
    clearInterval(interval);
    console.log(`🧹 Cleared timer for game ${gameId}`);
  }
  gameTimers.clear(); // Remove all entries from the map
}




function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
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
