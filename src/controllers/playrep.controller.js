const Game = require("../models/game.model");
const { User } = require("../models/user.model");
const { validationResult } = require("express-validator"); // To handle validation errors
const { default: mongoose } = require("mongoose");
const Percentage = require("../models/percentage.model");
const GameImage = require("../models/gameimage.model");
const { Draw } = require("../models/draw.model");
const { Ticket } = require("../models/ticket.model");
const Upcome = require("../models/upcome.model");
const UserTransaction = require("../models/userTransaction.model");
const Result = require("../models/result.models");

const moment = require("moment-timezone");



async function loadPointTransferReport(req, res) {
    try {
        const { id, role, fromDate: fromDateStr, toDate: toDateStr } = req.query; //01-Apr-2025

        // Convert the date strings into proper Date objects
        const fromDate = moment.tz(fromDateStr, ["DD-MMM-YYYY", "YYYY-MM-DD"], "Asia/Kolkata");
        const toDate = moment.tz(toDateStr, ["DD-MMM-YYYY", "YYYY-MM-DD"], "Asia/Kolkata");

        if (!fromDate.isValid() || !toDate.isValid()) {
            return res.status(400).send({
                success: false,
                message: "Invalid date format. Expected DD-MMM-YYYY or YYYY-MM-DD"
            });
        }

        // Then convert to JS Date objects
        const fromDateObj = fromDate.startOf("day").toDate();
        const toDateObj = toDate.endOf("day").toDate();


        if (!fromDate || !toDate) {
            return res.status(404).send({
                success: false,
                message: "Dates not valid"
            });
        }


        // ✅ Validate user existence
        const userFound = await User.findById(id).exec();
        if (!userFound) {
            return res.status(404).send({
                success: false,
                message: "User not found"
            });
        }

        // ✅ Validate date range
        if (!fromDate || !toDate) {
            return res.status(400).send({
                success: false,
                message: "Check Dates"
            });
        }

        // ✅ Setup date filter
        const dateFilter = {
            createdAt: {
                $gte: fromDate,
                $lte: toDate
            }
        };

        // ✅ Helper to avoid repeating populate logic
        const findTransactions = (filter, populatePath) =>
            UserTransaction.find(filter).populate({
                path: populatePath,
                select: "username firstName lastName"
            });

        // 1. Transferred
        const transferred = await findTransactions(
            { userId: id, status: "completed", ...dateFilter },
            "toUserId"
        );

        // 2. Transferred but not received
        const transferredNotReceived = await findTransactions(
            { userId: id, status: "pending", ...dateFilter },
            "toUserId"
        );

        // 3. Received
        const received = await findTransactions(
            { toUserId: id, status: "completed", ...dateFilter },
            "userId"
        );

        // 4. Yet to be received
        const yetToBeReceived = await findTransactions(
            { toUserId: id, status: "pending", ...dateFilter },
            "userId"
        );

        // 5. Rejected
        const rejected = await findTransactions(
            {
                $or: [{ userId: id }, { toUserId: id }],
                status: "rejected",
                ...dateFilter
            },
            "userId"
        );

        // 6. Cancelled
        const cancelled = await UserTransaction.find({
            $or: [{ userId: id }, { toUserId: id }],
            status: "cancelled",
            ...dateFilter
        }).populate([
            { path: "userId", select: "username firstName lastName" },
            { path: "toUserId", select: "username firstName lastName" }
        ]);

        // ✅ Final response
        res.status(200).send({
            success: true,
            data: {
                transferred,
                transferredNotReceived,
                received,
                yetToBeReceived,
                rejected,
                cancelled
            }
        });

    } catch (error) {
        console.error("Error loading report:", error);
        res.status(500).send({
            success: false,
            message: error.message || "Something went wrong"
        });
    }
}



async function drawdetails(req, res) {
    try {
        const { gameId } = req.query;
        const data = await Result.find({ gameid: gameId }).sort({ _id: -1 }).limit(200).exec();
        res.status(200).send({
            message: true,
            data
        });
    } catch (error) {
        console.error('Error fetching draw details:', error);
        res.status(500).send({
            message: false,
            error: 'Internal Server Error in drawdetails'
        });
    }
}


async function balancereport(req, res) {
    try {
        const { id } = req.query;

        const data = await User.find({ refId: id }).select("_id username firstName lastName walletBalance userStatus").exec();

        res.status(200).send({
            message: true,
            data
        });
    } catch (error) {
        console.error('Error fetching balance report:', error);
        res.status(500).send({
            message: false,
            error: 'Internal Server Error in balancereport'
        });
    }
}


async function agentdetails(req, res) {
    try {
        const { id } = req.query;

        const data = await User.find({ refId: id }).select("_id username firstName lastName address commission").exec();

        res.status(200).send({
            message: true,
            data
        });
    } catch (error) {
        console.error('Error fetching balance report:', error);
        res.status(500).send({
            message: false,
            error: 'Internal Server Error in balancereport'
        });
    }
}


async function dailystatus(req, res) {
    try {
        const { id, fromDate: fromDateStr, toDate: toDateStr } = req.query;
        const now = moment.tz('Asia/Kolkata');

        // const fromDate = fromDateStr
        //     ? moment.tz(fromDateStr, "DD-MMM-YYYY", "Asia/Kolkata").startOf("day")
        //     : now.clone().startOf("month");

        // const toDate = toDateStr
        //     ? moment.tz(toDateStr, "DD-MMM-YYYY", "Asia/Kolkata").endOf("day")
        //     : now.clone().endOf("month").endOf("day");


        const fromDate = moment.tz(fromDateStr, ["DD-MMM-YYYY", "YYYY-MM-DD"], "Asia/Kolkata");
        const toDate = moment.tz(toDateStr, ["DD-MMM-YYYY", "YYYY-MM-DD"], "Asia/Kolkata");


            if (!fromDate.isValid() || !toDate.isValid()) {
                return res.status(400).send({
                    success: false,
                    message: "Invalid date format. Expected DD-MMM-YYYY or YYYY-MM-DD"
                });
            }
    

        const user = await User.findById(id); // Assuming this is the main user
        if (!user) {
            return res.status(404).send({ message: false, error: "User not found" });
        }



        const userData = await User.find({ refId: new mongoose.Types.ObjectId(id) }).exec();

        const weeklyData = [];
        let totalProfit = 0;
        let totalRevenue = 0;
        let totalCommission = 0;
        let totalRevenueAfterCommission = 0;
        let totalRevenuePercentage = 0;
        let serial = 1;

        const weekStart = fromDate.clone().startOf('isoWeek');
        const weekEnd = moment.min(fromDate.clone().endOf('isoWeek'), toDate);

        await Promise.all(userData.map(async (downline) => {
            let commissionPercent = downline.commission || 0;
            const revenue = await findProfitFromDownline(downline._id, downline.role, weekStart.toDate(), weekEnd.toDate());

            // console.log(revenue);
            let profit = 0;


            if (user.role === "admin") {
                profit = parseFloat(revenue.toFixed(2));
            } else {
                if (revenue < 0) {
                    commissionPercent = 4;
                } else {
                    commissionPercent = commissionPercent;
                }

                profit = parseFloat((revenue * commissionPercent / 100).toFixed(2));
            }



            const revenueAfterCommission = revenue - profit;

            weeklyData.push({
                srNo: serial++,
                id: downline._id,
                username: downline.username,
                fullname:downline.firstName+" "+downline.lastName,
                firstName:downline.firstName,
                lastName:downline.lastName,
                address:downline.address,
                profit: parseFloat(revenue.toFixed(2)),
                actualRevenue: profit,
                commissionAmount: commissionPercent,
                deductionPercentage: 0,
                revenueAfterCommission,
                revenuePercentage: commissionPercent
            });

            totalProfit += revenue;
            totalRevenue += profit;
            totalCommission += commissionPercent;
            totalRevenueAfterCommission += revenueAfterCommission;
            totalRevenuePercentage += commissionPercent;
        }));

        res.status(200).send({
            message: true,
            data: weeklyData,
            totals: {
                usercommission:user.commission,
                totalProfit: totalProfit.toFixed(2),
                totalRevenue: totalRevenue.toFixed(2),
                totalCommission: totalCommission.toFixed(2),
                totalRevenueAfterCommission: totalRevenueAfterCommission.toFixed(2),
                totalRevenuePercentage: totalRevenuePercentage.toFixed(2)
            }
        });
    } catch (error) {
        console.error("Error fetching revenue report:", error);
        res.status(500).send({
            message: false,
            error: "Internal Server Error in revenuereport"
        });
    }
}

async function mailreport(req, res) {
    try {
        const { id, fromDate: fromDateStr, toDate: toDateStr } = req.query;
        const now = moment.tz('Asia/Kolkata');

        // const fromDate = fromDateStr
        //     ? moment.tz(fromDateStr, "DD-MMM-YYYY", "Asia/Kolkata").startOf("day")
        //     : now.clone().startOf("month");

        // const toDate = toDateStr
        //     ? moment.tz(toDateStr, "DD-MMM-YYYY", "Asia/Kolkata").endOf("day")
        //     : now.clone().endOf("month").endOf("day");


        const fromDate = moment.tz(fromDateStr, ["DD-MMM-YYYY", "YYYY-MM-DD"], "Asia/Kolkata");
        const toDate = moment.tz(toDateStr, ["DD-MMM-YYYY", "YYYY-MM-DD"], "Asia/Kolkata");


            if (!fromDate.isValid() || !toDate.isValid()) {
                return res.status(400).send({
                    success: false,
                    message: "Invalid date format. Expected DD-MMM-YYYY or YYYY-MM-DD"
                });
            }
    

        const user = await User.findById(id); // Assuming this is the main user
        if (!user) {
            return res.status(404).send({ message: false, error: "User not found" });
        }



        const userData = await User.find({ refId: new mongoose.Types.ObjectId(id) }).exec();

        const weeklyData = [];
        let totalProfit = 0;
        let totalRevenue = 0;
        let totalCommission = 0;
        let totalRevenueAfterCommission = 0;
        let totalRevenuePercentage = 0;
        let serial = 1;

        const weekStart = fromDate.clone().startOf('isoWeek');
        const weekEnd = moment.min(fromDate.clone().endOf('isoWeek'), toDate);

        await Promise.all(userData.map(async (downline) => {
            let commissionPercent = downline.commission || 0;
            const revenue = await findProfitFromDownline(downline._id, downline.role, weekStart.toDate(), weekEnd.toDate());

            // console.log(revenue);
            let profit = 0;


            if (user.role === "admin") {
                profit = parseFloat(revenue.toFixed(2));
            } else {
                if (revenue < 0) {
                    commissionPercent = 4;
                } else {
                    commissionPercent = commissionPercent;
                }

                profit = parseFloat((revenue * commissionPercent / 100).toFixed(2));
            }



            const revenueAfterCommission = revenue - profit;

            weeklyData.push({
                srNo: serial++,
                id: downline._id,
                username: downline.username,
                fullname:downline.firstName+" "+downline.lastName,
                profit: parseFloat(revenue.toFixed(2)),
                actualRevenue: profit,
                commissionAmount: commissionPercent,
                deductionPercentage: 0,
                revenueAfterCommission,
                revenuePercentage: commissionPercent
            });

            totalProfit += revenue;
            totalRevenue += profit;
            totalCommission += commissionPercent;
            totalRevenueAfterCommission += revenueAfterCommission;
            totalRevenuePercentage += commissionPercent;
        }));

        res.status(200).send({
            message: true,
            data: weeklyData,
            totals: {
                usercommission:user.commission,
                totalProfit: totalProfit.toFixed(2),
                totalRevenue: totalRevenue.toFixed(2),
                totalCommission: totalCommission.toFixed(2),
                totalRevenueAfterCommission: totalRevenueAfterCommission.toFixed(2),
                totalRevenuePercentage: totalRevenuePercentage.toFixed(2)
            }
        });
    } catch (error) {
        console.error("Error fetching revenue report:", error);
        res.status(500).send({
            message: false,
            error: "Internal Server Error in revenuereport"
        });
    }
}


async function revenuereport(req, res) {
    try {
        const { id, fromDate: fromDateStr, toDate: toDateStr } = req.query;
        const now = moment.tz('Asia/Kolkata');

        // const fromDate = fromDateStr
        //     ? moment(fromDateStr, "DD-MMM-YYYY").startOf("day")
        //     : now.clone().startOf("month");

        // const toDate = toDateStr
        //     ? moment(toDateStr, "DD-MMM-YYYY").endOf("day")
        //     : now.clone().endOf("day");


        const fromDate = fromDateStr
            ? moment.tz(fromDateStr, "DD-MMM-YYYY", "Asia/Kolkata").startOf("day")
            : now.clone().startOf("month");

        const toDate = toDateStr
            ? moment.tz(toDateStr, "DD-MMM-YYYY", "Asia/Kolkata").endOf("day")
            : now.clone().endOf("month").endOf("day");

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).send({ message: false, error: "User not found" });
        }

        let commissionPercent = user?.commission || 0;
        let current = fromDate.clone();
        let serial = 1;
        const weeklyData = [];

        let totalProfit = 0;
        let totalRevenue = 0;
        let totalCommission = 0;
        let totalRevenueAfterCommission = 0;
        let totalRevenuePercentage = 0;

        while (current.isSameOrBefore(toDate)) {
            const weekStart = current.clone().startOf('isoWeek');
            const weekEnd = moment.min(current.clone().endOf('isoWeek'), toDate);

            // console.log(weekStart.toDate());
            // console.log(weekEnd.toDate());
            // const result = await calculateDownlineTotals(id, weekStart.toDate(), weekEnd.toDate());

            const revenue = await findProfitFromDownline(user._id, user.role, weekStart.toDate(), weekEnd.toDate());
            let profit = 0;


            if (revenue < 0) {
                commissionPercent = 0;
            } else {
                commissionPercent = commissionPercent;
            }


            if (user.role === "admin") {
                profit = parseFloat(parseFloat(revenue).toFixed(2));
            } else {
                profit = parseFloat((revenue * commissionPercent / 100).toFixed(2));
            }




            weeklyData.push({
                srNo: serial++,
                fromDate: weekStart.format("YYYY-MM-DD"),
                toDate: weekEnd.format("YYYY-MM-DD"),
                profit: parseFloat(revenue.toFixed(2)),
                actualRevenue: parseFloat(profit.toFixed(2)),
                commissionAmount: commissionPercent,
                deductionPercentage: 0,
                revenueAfterCommission: 0,
                revenuePercentage: 0
            });

            // totalProfit += parseFloat(revenue, 2).toFixed(2);
            // totalRevenue += parseFloat(0, 2).toFixed(2);
            // totalCommission += parseFloat(user.commission, 2).toFixed(2);
            // totalRevenueAfterCommission += parseFloat(0, 2).toFixed(2);
            // totalRevenuePercentage += parseFloat(user.commission, 2).toFixed(2);

            current = weekEnd.clone().add(1, "day").startOf("day");
        }

        res.status(200).send({
            message: true,
            data: weeklyData,
            totals: {
                totalProfit,
                totalRevenue,
                totalCommission,
                totalRevenueAfterCommission,
                totalRevenuePercentage
            }
        });

    } catch (error) {
        console.error("Error fetching revenue report:", error);
        res.status(500).send({
            message: false,
            error: "Internal Server Error in revenuereport"
        });
    }
}
async function revenuereportbyid(req, res) {
    try {
        const { id, fromDate: fromDateStr, toDate: toDateStr } = req.query;
        const now = moment.tz('Asia/Kolkata');

        const fromDate = fromDateStr
            ? moment.tz(fromDateStr, "DD-MMM-YYYY", "Asia/Kolkata").startOf("day")
            : now.clone().startOf("month");

        const toDate = toDateStr
            ? moment.tz(toDateStr, "DD-MMM-YYYY", "Asia/Kolkata").endOf("day")
            : now.clone().endOf("month").endOf("day");

        const user = await User.findById(id); // Assuming this is the main user
        if (!user) {
            return res.status(404).send({ message: false, error: "User not found" });
        }



        const userData = await User.find({ refId: new mongoose.Types.ObjectId(id) }).exec();

        const weeklyData = [];
        let totalProfit = 0;
        let totalRevenue = 0;
        let totalCommission = 0;
        let totalRevenueAfterCommission = 0;
        let totalRevenuePercentage = 0;
        let serial = 1;

        const weekStart = fromDate.clone().startOf('isoWeek');
        const weekEnd = moment.min(fromDate.clone().endOf('isoWeek'), toDate);

        await Promise.all(userData.map(async (downline) => {
            let commissionPercent = downline.commission || 0;
            const revenue = await findProfitFromDownline(downline._id, downline.role, weekStart.toDate(), weekEnd.toDate());
            let profit = 0;


            if (user.role === "admin") {
                profit = parseFloat(revenue.toFixed(2));
            } else {
                if (revenue < 0) {
                    commissionPercent = 4;
                } else {
                    commissionPercent = commissionPercent;
                }

                profit = parseFloat((revenue * commissionPercent / 100).toFixed(2));
            }



            const revenueAfterCommission = revenue - profit;

            weeklyData.push({
                srNo: serial++,
                id: downline._id,
                username: downline.username,
                profit: parseFloat(revenue.toFixed(2)),
                actualRevenue: profit,
                commissionAmount: commissionPercent,
                deductionPercentage: 0,
                revenueAfterCommission,
                revenuePercentage: commissionPercent
            });

            totalProfit += revenue;
            totalRevenue += profit;
            totalCommission += commissionPercent;
            totalRevenueAfterCommission += revenueAfterCommission;
            totalRevenuePercentage += commissionPercent;
        }));

        res.status(200).send({
            message: true,
            data: weeklyData,
            totals: {
                totalProfit: totalProfit.toFixed(2),
                totalRevenue: totalRevenue.toFixed(2),
                totalCommission: totalCommission.toFixed(2),
                totalRevenueAfterCommission: totalRevenueAfterCommission.toFixed(2),
                totalRevenuePercentage: totalRevenuePercentage.toFixed(2)
            }
        });
    } catch (error) {
        console.error("Error fetching revenue report:", error);
        res.status(500).send({
            message: false,
            error: "Internal Server Error in revenuereport"
        });
    }
}

async function findRevenuePercentage(role) {
    switch (role) {
        case "master":
            return 50;
        case "areamanager":
            return 10;
        case "superareamanager":
            return 5;
        case "admin":
            return 44.75; // Remaining goes to admin
        default:
            return 0;
    }
}

async function calculateProfit(profit, role) {
    const master = profit / 2;
    const areaManager = master * 0.1;
    const superAreaManager = areaManager * 0.05;
    const admin = profit - (master + areaManager + superAreaManager);

    switch (role) {
        case "master":
            return profit;
        case "areamanager":
            return master;
        case "superareamanager":
            return areaManager;
        case "admin":
            return profit;
        default:
            return admin;
    }
}

async function calculateDownlineTotals(userId, fromDate, toDate) {
    const rootUser = await User.findById(userId);
    if (!rootUser) return { message: false, error: "User not found" };

    const allPlayers = [];

    async function findPlayersRecursively(currentUser) {
        const referrals = await User.find({ refId: currentUser._id });
        for (const user of referrals) {
            if (user.role === "player") {
                allPlayers.push(user._id);
            } else {
                await findPlayersRecursively(user);
            }
        }
    }

    await findPlayersRecursively(rootUser);

    if (allPlayers.length === 0) {
        return {
            message: true,
            data: {
                totalPlaypoints: 0,
                totalWinpoints: 0
            }
        };
    }

    const result = await Ticket.aggregate([
        {
            $match: {
                date: {
                    $gte: new Date(new Date(fromDate).setHours(0, 0, 0, 0)),
                    $lte: new Date(new Date(toDate).setHours(23, 59, 59, 999)),
                },
                userid: { $in: allPlayers },
            }
        },
        {
            $group: {
                _id: null,
                playpoints: { $sum: { $ifNull: ['$playpoints', 0] } },
                winpoints: { $sum: { $ifNull: ['$winpoints', 0] } },
            }
        }
    ]);

    return {
        message: true,
        data: {
            totalPlaypoints: result[0]?.playpoints || 0,
            totalWinpoints: result[0]?.winpoints || 0
        }
    };
}


async function findstatus(req, res) {
    try {
        const { id, fromDate: fromDateStr } = req.query;
        const fromDate = moment(fromDateStr, "DD-MMM-YYYY").startOf("day").toDate(); // 00:00:00

        // console.log(fromDate);

        const userFound = await User.findById(id);
        if (!userFound) {
            return res.status(400).send({
                status: false,
                message: "User not found?"
            });
        }

        const findAgents = await User.find({ refId: userFound._id });

        // Wait for all async operations to complete
        const data = await Promise.all(
            findAgents.map(async (row) => {
                const result = await calculateDownlineTotals(row._id, fromDate, fromDate);

                const play = result?.data?.totalPlaypoints || 0;
                const win = result?.data?.totalWinpoints || 0;
                const profit = play - win;

                return {

                    id: row._id,
                    username: row.username,
                    name: `${row.firstName} ${row.lastName}`,
                    profit: profit
                };
            })
        );

        res.status(200).send({
            status: true,
            data
        });
    } catch (error) {
        console.error(error);
        res.status(500).send({
            status: false,
            message: "Error in status"
        });
    }
}

//updated calculations

async function findProfitFromDownline(userId, role, fromDate, toDate) {
    const allUsers = await User.find();
    const userMap = new Map(allUsers.map(u => [u._id.toString(), u]));

    // Special case: if role is 'player', just return that player's profit
    if (role === 'player') {
        const profits = await findTotalForPlayers([userId], fromDate, toDate);
        const rawProfit = profits[userId.toString()] ?? 0;

        const player = userMap.get(userId.toString());
        if (!player) return 0;

        const finalProfit = calculateProfit(userMap, player, rawProfit);
        return finalProfit;
    }

    // Otherwise, collect downline players
    const getDownline = (id) =>
        allUsers.filter(u => u.refId && u.refId.toString() === id.toString());

    const getAllPlayers = (user) => {
        let players = [];
        if (user.role === 'player') {
            players.push(user);
        } else {
            const downline = getDownline(user._id);
            if (user.role === 'master') {
                players = downline;
            } else {
                for (const sub of downline) {
                    players.push(...getAllPlayers(sub));
                }
            }
        }
        return players;
    };

    const players = getAllPlayers({ _id: userId, role });
    const playerIds = players.map(p => p._id);

    const profits = await findTotalForPlayers(playerIds, fromDate, toDate);

    let totalProfit = 0;
    for (const player of players) {
        const playerProfit = profits[player._id.toString()] ?? 0;
        totalProfit += calculateProfit(userMap, player, playerProfit);
    }

    return totalProfit;
}


function calculateProfit(userMap, player, downlineProfit) {
    const master = userMap.get(player.refId?.toString());
    if (!master) return 0;
    const area = userMap.get(master?.refId?.toString());
    const superManager = userMap.get(area?.refId?.toString());

    const masterCommission = master?.commission || 0;
    const areaCommission = area?.commission || 0;
    const superCommission = superManager?.commission || 0;

    const masterProfit = downlineProfit * masterCommission / 100;
    const areaProfit = masterProfit * areaCommission / 100;
    const superProfit = areaProfit * superCommission / 100;

    const adminProfit = downlineProfit - (masterProfit + areaProfit + superProfit);
    return adminProfit;
}


async function findTotalForPlayers(playerIds, fromDate, toDate) {
    // console.log(playerIds);
    const result = await Ticket.aggregate([
        {
            $match: {
                date: { $gte: new Date(fromDate), $lte: new Date(toDate) },
                userid: { $in: playerIds }
            }
        },
        {
            $group: {
                _id: "$userid",
                playpoints: { $sum: { $ifNull: ["$playpoints", 0] } },
                winpoints: { $sum: { $ifNull: ["$winpoints", 0] } }
            }
        }
    ]);

    const profits = {};



    for (const entry of result) {
        //  console.log(entry);
        const diff = (entry.playpoints || 0) - (entry.winpoints || 0);
        // profits[entry._id.toString()] = diff > 0 ? diff : 0;
        profits[entry._id.toString()] = diff;
    }
    // console.log(profits);
    return profits;
}


module.exports = {
    loadPointTransferReport,
    drawdetails,
    balancereport,
    agentdetails,
    dailystatus,
    mailreport,
    revenuereport,
    findstatus,
    revenuereportbyid
}