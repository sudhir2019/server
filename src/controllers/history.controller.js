const jwt = require("jsonwebtoken");
const { default: mongoose } = require('mongoose');
const { User } = require("../models/user.model");
const { Ticket } = require("../models/ticket.model");

const gameHistory = async (req, res) => {
    try {
        const { gameId } = req.query;

        // Build query dynamically
        const query = gameId ? { gameid: gameId } : {};

        const history = await Ticket.find(query)
            .populate("userid") // Assuming userid references User model
            .populate("result") // Assuming result references Result model
            .sort({ date: -1 }) // Or `createdAt: -1` if that's what you're using
            .exec();

        const historyData = history.map((ticket) => ({
            ticketId:ticket.ticketid,
            gameId: ticket.gameid,
            timeopen: ticket.timeopen,
            timeclose: ticket.timeclose,
            userId: ticket.userid?._id || null,
            username: ticket.userid?.username || 'N/A',
            date: ticket.created_at,
            playpoints: ticket.playpoints || 0,
            winpoints: ticket.winpoints || 0,
            claimdate: ticket.claimdate || null,
            resultNo: ticket.result?.drawno || 'Pending'
        }));

        res.status(200).send({
            success: true,
            data: historyData
        });

    } catch (error) {
        console.error("Game History Error:", error);
        res.status(500).send({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};


module.exports = {
    gameHistory,
};
