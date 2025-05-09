const socketIO = require("socket.io");
const mongoose = require("mongoose");
const Game = require("../models/game.model");
const Percentage = require("../models/percentage.model");
const { Draw } = require("../models/draw.model");
const { Ticket } = require("../models/ticket.model");

const isDevelopment = process.env.NODE_ENV === "production";
// ✅ Allowed Origins
const allowedOrigins = isDevelopment ? ["http://localhost:5173", "http://localhost:3000"] : process.env.ACCESS_CONTROL_ALLOW_ORIGIN ? process.env.ACCESS_CONTROL_ALLOW_ORIGIN.split(",") : [];

// Store timers for each game
let timerInterval;

/**
 * Initialize Socket.IO
 * @param {object} server - HTTP server instance
 */
function initializeSocket(server) {
    const io = socketIO(server, {
        cors: {
            origin: (origin, callback) => {
                if (!origin || allowedOrigins.includes(origin)) {
                    callback(null, true);
                } else {
                    callback(new Error("Not allowed by CORS"));
                }
            },
            methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
            allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
            credentials: true,
        },
    });

    io.on("connection", (socket) => {
        console.log("A user connected");
        socket.emit("connectionAck", "Connected to server");

        socket.on("timerData", async (data) => {
            try {
                const { adminId, gameId } = data;
                console.log(data);

                const percentageData = await Percentage.findOne({
                    adminId: new mongoose.Types.ObjectId(adminId),
                    gameId,
                }).exec();

                if (!percentageData) {
                    console.log("Percentage data not found");
                    return;
                }

                const gameData = await Game.findOne({ gameId }).populate("timeId").exec();

                if (!gameData) {
                    console.log("Game data not found");
                    return;
                }

                if (timerInterval) clearInterval(timerInterval);
                runTimer(io, gameData?.timeId[0]?.timecount);
            } catch (error) {
                console.error("Error in socket timer:", error);
                socket.emit("timerError", "An error occurred while processing the timer data.");
            }
        });

        socket.on("calculateData", async (data) => {
            try {
                const { adminId, gameId } = data;

                if (!adminId || !gameId) {
                    socket.emit("calculateDataResponse", {
                        success: false,
                        message: "Both adminId and gameId are required",
                    });
                    return;
                }

                const foundPercentage = await Percentage.find({
                    adminId: new mongoose.Types.ObjectId(adminId),
                    gameId,
                }).exec();

                const gameDetails = await Game.findOne({ gameId })
                    .populate("timeId")
                    .select("GameImage nodigit label gameName")
                    .populate("GameImage")
                    .limit(1)
                    .exec();

                let playData = gameDetails.GameImage
                    ? await playedDataWithLabel(gameId, adminId, gameDetails.GameImage)
                    : await playedData(gameId, adminId, gameDetails.nodigit);

                let totalGameCollection = await CalculateTotalCollection(adminId, gameId);

                socket.emit("calculateDataResponse", {
                    success: foundPercentage.length > 0,
                    data: foundPercentage.length
                        ? {
                            percentageData: foundPercentage,
                            gameData: gameDetails,
                            playData,
                            gameBalance: 0,
                            collection: totalGameCollection,
                        }
                        : { message: "No data found for the given adminId and gameId" },
                });
            } catch (error) {
                console.error(error);
                socket.emit("calculateDataResponse", {
                    success: false,
                    message: "An error occurred while fetching live game data",
                });
            }
        });

        socket.on("disconnect", () => {
            console.log("A user disconnected");
        });
    });
}

/**
 * Runs a countdown timer and emits updates to all clients
 * @param {object} io - Socket.IO instance
 * @param {number} seconds - Duration of the timer
 */
function runTimer(io, seconds) {
    if (seconds === 60) {
        if (timerInterval) clearInterval(timerInterval);

        timerInterval = setInterval(() => {
            const currentSecond = new Date().getSeconds();
            io.emit("timer", 59 - currentSecond);
        }, 1000);
    }
}

async function playedData(gameId, adminId, nodigit) {
    const data = [];
    const drawData = await Draw.aggregate([
        {
            $match: {
                adminid: new mongoose.Types.ObjectId(adminId),
                gameid: gameId,
                status: 0,
            },
        },
        {
            $group: {
                _id: "$drawno",
                drawtotal: { $sum: "$drawtotal" },
            },
        },
    ]).exec();

    for (let i = 1; i <= nodigit; i++) {
        const draw = drawData.find((item) => item._id === i);
        data.push({ drawNo: i, drawtotal: draw ? draw.drawtotal : 0 });
    }

    return data;
}

async function playedDataWithLabel(gameId, adminId, GameImage) {
    const data = [];
    const drawData = await Draw.aggregate([
        {
            $match: {
                adminid: new mongoose.Types.ObjectId(adminId),
                gameid: gameId,
                status: 0,
            },
        },
        {
            $group: {
                _id: "$drawno",
                drawtotal: { $sum: "$drawtotal" },
            },
        },
    ]).exec();

    GameImage.forEach((item, index) => {
        const draw = drawData.find((draw) => draw._id === index + 1);
        data.push({
            drawNo: index + 1,
            drawtotal: draw ? draw.drawtotal : 0,
            image: item.image,
        });
    });

    return data;
}

async function CalculateTotalCollection(adminId, gameId) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);

    const tickets = await Ticket.aggregate([
        {
            $match: {
                gameid: gameId,
                adminid: new mongoose.Types.ObjectId(adminId),
                date: { $gte: date, $lte: new Date() },
            },
        },
        {
            $group: {
                _id: null,
                totalPlaypoints: { $sum: "$playpoints" },
                totalWinpoints: { $sum: "$winpoints" },
            },
        },
    ]).exec();

    return tickets.length === 0
        ? { totalPlaypoints: 0, totalWinpoints: 0 }
        : tickets[0];
}

module.exports = { initializeSocket };
