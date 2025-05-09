const { default: mongoose, mongo } = require("mongoose");
const { User } = require("../models/user.model");
const { Ticket } = require("../models/ticket.model");
const UserTransaction = require("../models/userTransaction.model");
const Percentage = require("../models/percentage.model");
const Game = require("../models/game.model");
const Result = require("../models/result.models");
const { Draw } = require("../models/draw.model");
const Upcome = require("../models/upcome.model");
const { Frequency } = require("../models/frequency.model");
const UserBalance = require("../models/userbalance.model");
// const { clearbetok } = require("../actions/clearbetok");

let ADMINID = process.env.ADMIN_ID ? process.env.ADMIN_ID.toString() : "";



async function generateGameBalanceWithUserId(userId, gameId, adminId) {
    try {
        const newBalance = new UserBalance({
            winBalance: 0,
            userId,
            gameId,
            adminId
        });

        const savedBalance = await newBalance.save();
        return savedBalance; // optionally return for confirmation or further use
    } catch (error) {
        console.error('Error creating game balance:', error);
        throw error; // propagate for handling upstream
    }
}


const funtarget = async (req, res) => {
    try {
        const gameId = "MNOQqWWi";
        const adminId = ADMINID;

        const game = await Game.findOne({ gameId }).populate("timeId").limit(1).exec();
        if (!game) return res.status(404).send({ success: false, message: "Game not found" });

        const main = { gameId: game.gameId, adminId };
        const [lastResult] = await Result.find({ gameid: gameId, adminid: adminId, status: 0 })
            .sort({ _id: -1 })
            .limit(1)
            .exec();

        if (!lastResult) {
            await generateNextDrawOneMinute(game.timeId[0]._id, gameId, adminId);
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const { timeid: timeIdPrev, timeopen, timeclose } = lastResult || {};

        // Check if a booster draw is scheduled
        const [boosterDraw] = await Upcome.find({ adminId, gameId, status: 0 }).sort({ _id: 1 }).limit(1).exec();

        // Decide Joker value
        let joker = "1";
        if (boosterDraw?.booster === 2) {
            joker = "2";
        } else {
            joker = await GetBoosterFunTarget(adminId, gameId);
        }

        let randomNumber, resultDoc, baltestvalue;

        // If booster draw exists, use it directly
        if (boosterDraw) {
            randomNumber = String(boosterDraw.drawno);

            resultDoc = await Result.findOneAndUpdate(
                { adminid: adminId, gameid: gameId, status: 0 },
                { status: 1, drawno: randomNumber, booster: joker },
                { upsert: true, new: true }
            );

            await Upcome.findByIdAndUpdate(boosterDraw._id, { status: 1 });

            await Draw.updateMany(
                { adminid: adminId, gameid: gameId, status: 0 },
                { $set: { status: 1 } }
            );
        } else {
            const [gamePercent] = await Percentage.find({ adminId, gameId }).limit(1).exec();
            const gameBalance = gamePercent?.gameBalance || 0;
            const winPercentage = gamePercent?.winpercentage || 0;
            const allowedWin = (gameBalance * winPercentage) / 100;
            const remainingBalance = gameBalance - allowedWin;

            baltestvalue = remainingBalance;

            const safeDraws = [], riskyDraws = [];
            const drawPromises = [];

            for (let i = 0; i < 10; i++) {
                const drawno = String(i);
                drawPromises.push(
                    getDrawQtyByDrawNo(adminId, gameId, drawno).then(qty => {
                        const winQty = qty * 9;
                        const logicValue = winQty * joker;

                        if (logicValue <= remainingBalance) {
                            safeDraws.push({ no: i, sum: logicValue });
                        } else {
                            riskyDraws.push({ no: i, sum: logicValue });
                        }

                        return Draw.updateMany(
                            { adminid: adminId, gameid: gameId, drawno, status: 0 },
                            { $set: { status: 1 } }
                        );
                    }).catch(err => console.error(`Draw ${i} error:`, err))
                );
            }

            await Promise.all(drawPromises);

            if (safeDraws.length > 0) {
                  //console.log("safeDraws",safeDraws);
                const maxSum = Math.max(...safeDraws.map(draw => draw.sum));

                // Step 2: Filter draws that have the maximum sum
                const maxDraws = safeDraws.filter(draw => draw.sum === maxSum);
                
                // Step 3: Select a random one among those
                const randomEntry = maxDraws[Math.floor(Math.random() * maxDraws.length)];
                 randomNumber = randomEntry.no;


            } else if (riskyDraws.length > 0) {
                //console.log("riskyDraws",riskyDraws);
                const minSum = Math.min(...riskyDraws.map(d => d.sum));
                const lowest = riskyDraws.filter(d => d.sum === minSum);
                const randomPick = lowest[Math.floor(Math.random() * lowest.length)];
                randomNumber = randomPick.no;
            } else {
                //console.log("no any draws");
                randomNumber = Math.floor(Math.random() * 10); // fallback
            }

             const values = [5, 10, 15];
             const randomValue = values[Math.floor(Math.random() * values.length)];
             
            resultDoc = await Result.findOneAndUpdate(
                { adminid: adminId, gameid: gameId, status: 0 },
                { status: 1, drawno: randomNumber, booster: joker,randomValues : randomValue },
                { upsert: true, new: true }
            );
            
            
             
        }
        
//  console.log("randomNumber",randomNumber);
        await sendWinFunTarget(randomNumber, joker, adminId, gameId, resultDoc._id);
        await generateNextDrawOneMinute(timeIdPrev, gameId, adminId);

        res.status(200).send({
            success: true,
            message: `Successfully generated result of Fun Target. Result: ${randomNumber}, Booster: ${joker}`,
            baltestvalue
        });
    } catch (err) {
        console.error("Error in funtarget:", err);
        res.status(500).send({
            success: false,
            message: "Internal Server Error",
            error: err.message
        });
    }
};


const GetBoosterFunTarget = async (adminId, gameId) => {
    const adminObjectId = new mongoose.Types.ObjectId(adminId);

    let frequency = await Frequency.findOne({
        adminid: adminObjectId,
        gameid: gameId
    });

    if (!frequency) {
        // Set random count 20-30
        const randomNumber = Math.floor(Math.random() * (30 - 20 + 1)) + 20;
        frequency = new Frequency({
            gameid: gameId,
            adminid: adminObjectId,
            fcount: randomNumber
        });
        await frequency.save();
        return "1"; // First time, just start the counter
    }

    if (frequency.fcount <= 0) {
        // fcount hit zero, set it again and return "yes" once
        const randomNumber = Math.floor(Math.random() * (30 - 20 + 1)) + 20;
        await Frequency.findOneAndUpdate(
            { adminid: adminObjectId, gameid: gameId },
            { fcount: randomNumber }
        );
        return "2"; // This is the moment to trigger "joker"
    } else {
        // Decrement fcount
        await Frequency.findOneAndUpdate(
            { adminid: adminObjectId, gameid: gameId },
            { $inc: { fcount: -1 } }
        );
        return "1";
    }
};

async function sendWinFunTarget(resultNo, joker, adminId, gameId, resultId) {

    const adminObjectId = new mongoose.Types.ObjectId(adminId);

    // Get all pending tickets
    const loadTickets = await Ticket.find({
        adminid: adminObjectId,
        gameid: gameId,
        status: 0
    }).exec();

    // console.log(loadTickets);

    for (const ticket of loadTickets) {
        const loadDraws = await Draw.find({ ticketid: ticket.ticketid }).exec();

        // console.log(loadDraws);


        let winningAmount = 0;

        for (const draw of loadDraws) {
              if (String(draw.drawno) === String(resultNo)) {
                let win = parseFloat(draw.drawqty) * 9;
                // Joker multiplier
                win *= joker;

                winningAmount += win;
            }
        }

        const userId = ticket.userid;
        if (winningAmount > 0) {

            const user = await User.findById(userId);
            let userBalance = await UserBalance.findOne({ userId, gameId, adminId });

            if (!userBalance) {
                await generateGameBalanceWithUserId(userId, gameId, adminId);
                // Give DB a short time to register new document (optional)
                await new Promise(res => setTimeout(res, 100));
                userBalance = await UserBalance.findOne({ userId, gameId, adminId });
            }

            await UserBalance.findOneAndUpdate(
                { userId, gameId, adminId },
                { $inc: { winBalance: winningAmount } }
            );

        } else {
            clearbetok(winningAmount, adminId, gameId, userId);
        }

        // Mark ticket as processed
        await Ticket.findByIdAndUpdate(ticket._id, {
            status: 1,
            winpoints: winningAmount,
            result: resultId
        });


        const [gamePercent] = await Percentage.find({
            adminId: new mongoose.Types.ObjectId(adminId),
            gameId: gameId
        }).limit(1).exec();

        const gameBalance = gamePercent?.gameBalance || 0;


        const balance = parseFloat(gameBalance);
        const winning = parseFloat(winningAmount);
        const newBalance = balance - winning; // Prevent negative balance

        await Percentage.findOneAndUpdate(
            {
                adminId: new mongoose.Types.ObjectId(adminId),
                gameId: gameId
            },
            { gameBalance: newBalance },
            { upsert: true } // ADD THIS
        );
    }
}




const funroullet = async (req, res) => {
    try {
        let gameId = "vwRORrGO";
        let adminId = ADMINID;
        let Games = await Game.findOne({ gameId }).populate("timeId").limit(1).exec();
        if (!Games) return res.status(404).send({ success: false, message: "Game not found" });

        const main = {
            gameId: Games.gameId,
            adminId: adminId
        };

        const prvdraw = await Result.find({
            gameid: gameId,
            adminid: adminId,
            status: 0
        }).sort({ _id: -1 }).limit(1).exec();


        if (prvdraw.length === 0) {
            await generateNextDrawOneMinute(Games.timeId[0]._id, main.gameId, main.adminId);
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        const timeidp = prvdraw[0]?.timeid;
        const timeopenp = prvdraw[0]?.timeopen;
        const timeclosep = prvdraw[0]?.timeclose;

        const findBooster = await Upcome.find({
            adminId: main.adminId,
            gameId: main.gameId,
            status: 0
        }).sort({ _id: 1 }).limit(1).exec();



        // console.log("booster",findBooster);

        let booster = 1;
        let color;

        if (findBooster[0]?.booster === 2) {
            booster = 2;
        } else {
            booster = await GetBoosterFunRoullet(main.adminId, main.gameId);
        }

        // console.log(booster);

        let randomNumber;
        let ResultData;
        if (findBooster.length > 0) {
            randomNumber = String(findBooster[0].drawno);

            color = getRouletteColor(randomNumber);
            // const resultNumber = String(findBooster[0].drawno);
            // console.log("Booster used resultNumber:", resultNumber);
            // console.log("Joker (from booster logic):", setJoker);
            ResultData = await Result.findOneAndUpdate(
                {
                    adminid: main.adminId,
                    gameid: main.gameId,
                    status: 0
                },
                {
                    status: 1,
                    drawno: randomNumber,
                    booster: booster,
                    color: color
                },

                {
                    upsert: true,
                    new: true // Ensures the returned document is the updated/new one
                }
            );

            await Upcome.findByIdAndUpdate(findBooster[0]._id, { status: 1 });

            await Draw.updateMany(
                {
                    adminid: new mongoose.Types.ObjectId(main.adminId),
                    gameid: main.gameId,
                    // timeopen: timeopenp,
                    // timeclose: timeclosep,
                    status: 0,
                },
                { $set: { status: 1 } }
            );




        } else {
            const groupedDraws = await Draw.aggregate([
                {
                    $match: {
                        adminid: new mongoose.Types.ObjectId(main.adminId),
                        gameid: main.gameId,
                        // timeopen: timeopenp,
                        // timeclose: timeclosep,
                        status: 0
                    }
                },
                {
                    $group: {
                        _id: { $toString: "$drawno" },
                        sumDrawQty: { $sum: "$drawqty" }
                    }
                }
            ]);


            // console.log(groupedDraws);

            const arr1 = [];
            const arr2 = [];

            const [gamePercent] = await Percentage.find({
                adminId: new mongoose.Types.ObjectId(main.adminId),
                gameId: main.gameId
            }).limit(1).exec();

            const gameBalance = gamePercent?.gameBalance || 0;
            const winpercentage = gamePercent?.winpercentage || 0;
            const sendwin = (gameBalance * winpercentage) / 100;
            const remainingBalance = gameBalance - sendwin;

            // console.log(groupedDraws);

            for (const draw of groupedDraws) {


                await Draw.updateMany(
                    {
                        adminid: new mongoose.Types.ObjectId(main.adminId),
                        gameid: main.gameId,
                        // timeopen: timeopenp,
                        // timeclose: timeclosep,
                        status: 0,
                        drawno: draw._id
                    },
                    { $set: { status: 1 } }
                );


                const winqty = parseFloat(draw?.sumDrawQty * 36); //20*9=180
                // console.log(remainingBalance,winqty);
                const boosterLogic = winqty * Number(booster);

                // console.log(booster,draw?.sumDrawQty,boosterLogic,remainingBalance)

                if (boosterLogic <= remainingBalance) {
                    arr1.push({ no: draw._id, sum: boosterLogic });
                } else {
                    arr2.push({ no: draw._id, sum: boosterLogic });
                }

            }
            // console.log("arr1", arr1);
            // console.log("arr2", arr2);





            if (arr1.length > 0) {
                const maxSumObj = arr1.reduce((max, obj) => obj.sum > max.sum ? obj : max, arr1[0]);
                randomNumber = maxSumObj.no;
                //  const maxWinQtySum = maxSumObj.sum;
                // const newBalance = parseFloat(gameBalance) - parseFloat(maxWinQtySum);
                // await Percentage.findOneAndUpdate(
                //     {
                //         adminId: new mongoose.Types.ObjectId(main.adminId),
                //         gameId: main.gameId
                //     },
                //     { gameBalance: newBalance },
                //     { upsert: true } // ADD THIS
                // );
            } else if (arr2.length > 0) {
                // // const minSumObj = arr2.reduce((min, obj) => obj.sum < min.sum ? obj : min, arr2[0]);
                const arrfound = arr2; // 
                const excludeNos = [
                    "0", "1", "2", "3", "5", "6", "7", "8", "9",
                    "10", "11", "12", "13", "14", "15", "16", "17",
                    "18", "19", "20", "21", "22", "23", "24", "25",
                    "26", "27", "28", "29", "30", "31", "32", "33",
                    "34", "35", "36", "00"
                ];

                // Filter numbers NOT present in arrfound
                const filteredExcludeNos = excludeNos.filter(
                    no => !arrfound.some(item => item.no === no)
                );
                randomNumber = filteredExcludeNos[Math.floor(Math.random() * filteredExcludeNos.length)];
                
                
                // const minSum = Math.min(...arr2.map(obj => obj.sum));
                // const lowestItems = arr2.filter(obj => obj.sum === minSum);
                // const randomItem = lowestItems[Math.floor(Math.random() * lowestItems.length)];
                // randomNumber = randomItem.no;
                // console.log("no", filteredExcludeNos);

            } else {
                const radomseries = [
                    "0", "1", "2", "3", "5", "6", "7", "8", "9",
                    "10", "11", "12", "13", "14", "15", "16", "17",
                    "18", "19", "20", "21", "22", "23", "24", "25",
                    "26", "27", "28", "29", "30", "31", "32", "33",
                    "34", "35", "36", "00"
                ];

                // Pick a random number from radomseries
                randomNumber = radomseries[Math.floor(Math.random() * radomseries.length)];
            }

            color = getRouletteColor(randomNumber);

            ResultData = await Result.findOneAndUpdate(
                {
                    adminid: main.adminId,
                    gameid: main.gameId,
                    // timeopen: timeopenp,
                    // timeclose: timeclosep,
                    status: 0
                },
                {
                    status: 1,
                    drawno: randomNumber,
                    booster: booster,
                    color: color
                },

                {
                    upsert: true,
                    new: true // Ensures the returned document is the updated/new one
                }
            );





        }



        await sendWinAmericanRoullet(randomNumber, color, booster, main.adminId, main.gameId, ResultData._id);
        await generateNextDrawOneMinute(timeidp, main.gameId, main.adminId);
        res.status(200).send({
            success: true,
            message: `Generated Result Fun Roullet is ${randomNumber} and color is ${color} booster is ${booster} `
        });
    } catch (err) {
        console.error("Error in funtarget:", err);
        res.status(500).send({
            success: false,
            message: "Internal Server Error",
            error: err.message
        });
    }
};

async function sendWinAmericanRoullet(resultNo, color, booster, adminId, gameId, ResultId) {
    const adminObjectId = new mongoose.Types.ObjectId(adminId);

    // Get all pending tickets
    const loadTickets = await Ticket.find({
        adminid: adminObjectId,
        gameid: gameId,
        status: 0
    }).exec();

    // console.log(loadTickets);

    for (const ticket of loadTickets) {
        const loadDraws = await Draw.find({ ticketid: ticket.ticketid }).exec();

        // console.log(loadDraws);


        let winningAmount = 0;

        for (const draw of loadDraws) {
            if (draw.drawno === resultNo) {
                let win = parseFloat(draw.drawqty) * 36;

                win *= Number(booster);
                winningAmount += win;
            }
        }
        const userId = ticket.userid;
        if (winningAmount > 0) {

            const user = await User.findById(userId);

            let userBalance = await UserBalance.findOne({ userId, gameId, adminId });

            if (!userBalance) {
                await generateGameBalanceWithUserId(userId, gameId, adminId);
                // Give DB a short time to register new document (optional)
                await new Promise(res => setTimeout(res, 100));
                userBalance = await UserBalance.findOne({ userId, gameId, adminId });
            }

            await UserBalance.findOneAndUpdate(
                { userId, gameId, adminId },
                { $inc: { winBalance: winningAmount } }
            );

        } else {
            clearbetok(winningAmount, adminId, gameId, userId);
        }

        // Mark ticket as processed
        await Ticket.findByIdAndUpdate(ticket._id, {
            status: 1,
            winpoints: winningAmount,
            result: ResultId
        });


        const [gamePercent] = await Percentage.find({
            adminId: new mongoose.Types.ObjectId(adminId),
            gameId: gameId
        }).limit(1).exec();

        const gameBalance = gamePercent?.gameBalance || 0;


        const balance = parseFloat(gameBalance);
        const winning = parseFloat(winningAmount);

        const newBalance = balance - winning; // Prevent negative balance

        await Percentage.findOneAndUpdate(
            {
                adminId: new mongoose.Types.ObjectId(adminId),
                gameId: gameId
            },
            { gameBalance: newBalance },
            { upsert: true } // ADD THIS
        );
    }
}

async function GetBoosterFunRoullet(adminId, gameId) {
    const adminObjectId = new mongoose.Types.ObjectId(adminId);

    let frequency = await Frequency.findOne({
        adminid: adminObjectId,
        gameid: gameId
    });

    if (!frequency) {
        // Set random count 20-30
        const randomNumber = Math.floor(Math.random() * (30 - 20 + 1)) + 20;
        frequency = new Frequency({
            gameid: gameId,
            adminid: adminObjectId,
            fcount: randomNumber
        });
        await frequency.save();
        return "1"; // First time, just start the counter
    }

    if (frequency.fcount <= 0) {
        // fcount hit zero, set it again and return "yes" once
        const randomNumber = Math.floor(Math.random() * (30 - 20 + 1)) + 20;
        await Frequency.findOneAndUpdate(
            { adminid: adminObjectId, gameid: gameId },
            { fcount: randomNumber }
        );
        return "2"; // This is the moment to trigger "joker"
    } else {
        // Decrement fcount
        await Frequency.findOneAndUpdate(
            { adminid: adminObjectId, gameid: gameId },
            { $inc: { fcount: -1 } }
        );
        return "1";
    }
}
function getRouletteColor(number) {
    if (number === undefined || number === null) return "unknown";

    const strNum = number.toString();
    const redNumbers = new Set([
        "1", "3", "5", "7", "9", "12", "14", "16", "18",
        "19", "21", "23", "25", "27", "30", "32", "34", "36"
    ]);
    const blackNumbers = new Set([
        "2", "4", "6", "8", "10", "11", "13", "15", "17",
        "20", "22", "24", "26", "28", "29", "31", "33", "35"
    ]);

    if (strNum === "0" || strNum === "00") return "green";
    if (redNumbers.has(strNum)) return "red";
    if (blackNumbers.has(strNum)) return "black";
    return "unknown";
}








const triplefun = async (req, res) => {
    try {
        const gameId = "zuuhVbBM";
        const adminId = ADMINID;

        const Games = await Game.findOne({ gameId }).populate("timeId").limit(1).exec();
        if (!Games) return res.status(404).send({ success: false, message: "Game not found" });

        const main = { gameId: Games.gameId, adminId };

        const prvdraw = await Result.find({ gameid: gameId, adminid: adminId, status: 0 })
            .sort({ _id: -1 }).limit(1).exec();

        if (prvdraw.length === 0) {
            await generateNextDrawTwoMinute(Games.timeId[0]._id, main.gameId, main.adminId);
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        const timeidp = prvdraw[0]?.timeid;

        const findBooster = await Upcome.find({
            adminId: main.adminId,
            gameId: main.gameId,
            status: 0
        }).sort({ _id: 1 }).limit(1).exec();

        let booster = 1;
        if (findBooster[0]?.booster === 2) {
            booster = 2;
        } else {
            booster = await GetBoosterTripleFun(main.adminId, main.gameId);
        }

        let randomNumber;
        let ResultData;

        if (findBooster.length > 0) {
            randomNumber = String(findBooster[0].drawno);

            ResultData = await Result.findOneAndUpdate(
                {
                    adminid: main.adminId,
                    gameid: main.gameId,
                    status: 0
                },
                {
                    status: 1,
                    drawno: randomNumber,
                    booster: booster
                },
                { upsert: true, new: true }
            );

            await Upcome.findByIdAndUpdate(findBooster[0]._id, { status: 1 });

            await Draw.updateMany(
                {
                    adminid: new mongoose.Types.ObjectId(main.adminId),
                    gameid: main.gameId,
                    status: 0
                },
                { $set: { status: 1 } }
            );
        } else {
            const [gamePercent] = await Percentage.find({
                adminId: new mongoose.Types.ObjectId(main.adminId),
                gameId: main.gameId
            }).limit(1).exec();

            const rawBalance = gamePercent?.gameBalance ?? 0;
            const gameBalance = rawBalance < 0 ? 0 : rawBalance;

            const winpercentage = gamePercent?.winpercentage || 0;
            const sendwin = (gameBalance * winpercentage) / 100;
            const remainingBalance = gameBalance - sendwin;

            // Generate all 1000 combinations (000 to 999)
            const digitCombinations = [];
            for (let i = 0; i <= 9; i++) {
                for (let j = 0; j <= 9; j++) {
                    for (let k = 0; k <= 9; k++) {
                        digitCombinations.push({ i, j, k });
                    }
                }
            }

            // Fetch all draw sums in parallel
            // const allResults = await Promise.all(
            //     digitCombinations.map(async ({ i, j, k }) => {
            //         const singledigit = `${k}`;
            //         const doubledigit = `${j}${k}`;
            //         const maindigit = `${i}${j}${k}`;
            //         const threedigit = `${i}-${j}-${k}`;

            //         const [singleSum, doubleSum, tripleSum] = await Promise.all([
            //             getDrawQtyByDrawNo(main.adminId, main.gameId, singledigit),
            //             getDrawQtyByDrawNo(main.adminId, main.gameId, doubledigit),
            //             getDrawQtyByDrawNo(main.adminId, main.gameId, maindigit)
            //         ]);

            //         const digit = String(Number(maindigit));
            //         let total = 0;
            //         if (digit.length === 1) total += singleSum * 9;
            //         else if (digit.length === 2) total += doubleSum * 90;
            //         else if (digit.length === 3) total += tripleSum * 900;

            //         return {
            //             no: threedigit,
            //             sum: total
            //         };
            //     })
            // );
            


// Fetch all draw sums in parallel
const allResults = await Promise.all(
    digitCombinations.map(async ({ i, j, k }) => {
        const singledigit = `${k}`;
        const doubledigit = `${j}${k}`;
        const maindigit = `${i}${j}${k}`;
        const threedigit = `${i}-${j}-${k}`;

        const [singleSum, doubleSum, tripleSum] = await Promise.all([
            getDrawQtyByDrawNo(main.adminId, main.gameId, singledigit),
            getDrawQtyByDrawNo(main.adminId, main.gameId, doubledigit),
            getDrawQtyByDrawNo(main.adminId, main.gameId, maindigit)
        ]);

        const total = (singleSum * 9) + (doubleSum * 90) + (tripleSum * 900);

        return {
            no: threedigit,
            sum: total
        };
    })
);




            const arr1 = [];
            const arr2 = [];

            for (const item of allResults) {
                const withbooster = item.sum * booster;
                if (withbooster <= remainingBalance) {
                    arr1.push(item);
                } else {
                    arr2.push(item);
                }
            }

            if (arr1.length > 0) {
                const maxSum = Math.max(...arr1.map(i => i.sum));
                const topItems = arr1.filter(i => i.sum === maxSum);
                const randomItem = topItems[Math.floor(Math.random() * topItems.length)];
                randomNumber = randomItem.no;
            } else if (arr2.length > 0) {

                const minSum = Math.min(...arr2.map(i => i.sum));
                const lowItems = arr2.filter(i => i.sum === minSum);
                const randomItem = lowItems[Math.floor(Math.random() * lowItems.length)];
                randomNumber = randomItem.no;
            } else {
                const randomItem = allResults[Math.floor(Math.random() * allResults.length)];
                randomNumber = randomItem.no;
            }
            ResultData = await Result.findOneAndUpdate(
                {
                    adminid: main.adminId,
                    gameid: main.gameId,
                    status: 0
                },
                {
                    status: 1,
                    drawno: randomNumber,
                    booster: booster
                },
                { upsert: true, new: true }
            );

            await Draw.updateMany(
                {
                    adminid: new mongoose.Types.ObjectId(main.adminId),
                    gameid: main.gameId,
                    status: 0
                },
                { $set: { status: 1 } }
            );
        }

        await sendWinTripleFun(randomNumber, booster, main.adminId, main.gameId, ResultData._id);
        await generateNextDrawOneMinute(timeidp, main.gameId, main.adminId);

        res.status(200).send({
            success: true,
            message: `Generated Result Triple is ${randomNumber} and booster is ${booster}`
        });
    } catch (err) {
        console.error("Error in triplefun:", err);
        res.status(500).send({
            success: false,
            message: "Internal Server Error",
            error: err.message
        });
    }
};



async function sendWinTripleFun(resultNo, booster, adminId, gameId, ResultId) {
    const [d1, d2, d3] = resultNo.split("-"); // e.g., "0-0-0"
    const fullDigit = `${d1}${d2}${d3}`; // e.g., "000"
    const fullDigitStripped = String(Number(fullDigit)); // e.g., "000"

    const adminObjectId = new mongoose.Types.ObjectId(adminId);

    const loadTickets = await Ticket.find({
        adminid: adminObjectId,
        gameid: gameId,
        status: 0
    }).exec();

    for (const ticket of loadTickets) {
        const loadDraws = await Draw.find({ ticketid: ticket.ticketid }).exec();
        let winningAmount = 0;

        for (const draw of loadDraws) {
            let win = 0;
            const drawQty = parseFloat(draw.drawqty);
            const drawNo = draw.drawno;

            // Match single digit (last digit)
            if (drawNo.length === 1 && drawNo === d3) {
                win += drawQty * 9;
            }

            // Match two-digit (last two digits)
            if (drawNo.length === 2 && drawNo === `${d2}${d3}`) {
                win += drawQty * 90;
            }

            // Match full three-digit number
            if (drawNo.length === 3 && drawNo === `${d1}${d2}${d3}`) {
                win += drawQty * 900;
            }

            // Apply booster
            win *= Number(booster);
            winningAmount += win;
        }
        const userId = ticket.userid;
        // Credit user if there's any win
        if (winningAmount > 0) {
            const userId = ticket.userid;
            const user = await User.findById(userId);

            let userBalance = await UserBalance.findOne({ userId, gameId, adminId });

            if (!userBalance) {
                await generateGameBalanceWithUserId(userId, gameId, adminId);
                // Give DB a short time to register new document (optional)
                await new Promise(res => setTimeout(res, 100));
                userBalance = await UserBalance.findOne({ userId, gameId, adminId });
            }

            await UserBalance.findOneAndUpdate(
                { userId, gameId, adminId },
                { $inc: { winBalance: winningAmount } }
            );

        } else {
            clearbetok(winningAmount, adminId, gameId, userId);
        }

        // Mark ticket as processed
        await Ticket.findByIdAndUpdate(ticket._id, {
            status: 1,
            winpoints: winningAmount,
            result: ResultId
        });

        // Update game balance
        const [gamePercent] = await Percentage.find({
            adminId: adminObjectId,
            gameId: gameId
        }).limit(1).exec();

        const gameBalance = gamePercent?.gameBalance || 0;

        const balance = parseFloat(gameBalance);
        const winning = parseFloat(winningAmount);

        const newBalance = balance - winning; // Prevent negative balance

        await Percentage.findOneAndUpdate(
            {
                adminId: adminObjectId,
                gameId: gameId
            },
            { gameBalance: newBalance },
            { upsert: true }
        );
    }
}


async function GetBoosterTripleFun(adminId, gameId) {
    const adminObjectId = new mongoose.Types.ObjectId(adminId);

    let frequency = await Frequency.findOne({
        adminid: adminObjectId,
        gameid: gameId
    });

    if (!frequency) {
        // Set random count 20-30
        const randomNumber = Math.floor(Math.random() * (30 - 20 + 1)) + 20;
        frequency = new Frequency({
            gameid: gameId,
            adminid: adminObjectId,
            fcount: randomNumber
        });
        await frequency.save();
        return "1"; // First time, just start the counter
    }

    if (frequency.fcount <= 0) {
        // fcount hit zero, set it again and return "yes" once
        const randomNumber = Math.floor(Math.random() * (30 - 20 + 1)) + 20;
        await Frequency.findOneAndUpdate(
            { adminid: adminObjectId, gameid: gameId },
            { fcount: randomNumber }
        );
        return "2"; // This is the moment to trigger "joker"
    } else {
        // Decrement fcount
        await Frequency.findOneAndUpdate(
            { adminid: adminObjectId, gameid: gameId },
            { $inc: { fcount: -1 } }
        );
        return "1";
    }
}

async function getDrawQtyByDrawNo(adminId, gameId, drawno) {
    const result = await Draw.aggregate([
        {
            $match: {
                adminid: new mongoose.Types.ObjectId(adminId),
                gameid: gameId,
                drawno: drawno,
                status: 0
            }
        },
        {
            $group: {
                _id: "$drawno",
                totalDrawQty: { $sum: "$drawqty" }
            }
        }
    ]);

    // console.log(result[0]?.totalDrawQty || 0);

    return result[0]?.totalDrawQty || 0;
}







const funab = async (req, res) => {
    try {
        let gameId = "qZicXikM";
        let adminId = ADMINID;
        let Games = await Game.findOne({ gameId }).populate("timeId").limit(1).exec();
        if (!Games) return res.status(404).send({ success: false, message: "Game not found" });

        const main = {
            gameId: Games.gameId,
            adminId: adminId
        };

        const prvdraw = await Result.find({
            gameid: gameId,
            adminid: adminId,
            status: 0
        }).sort({ _id: -1 }).limit(1).exec();

        // console.log(prvdraw);


        if (prvdraw.length === 0) {
            await generateNextDrawTwoMinute(Games.timeId[0]._id, main.gameId, main.adminId);
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        const timeidp = prvdraw[0]?.timeid;
        const timeopenp = prvdraw[0]?.timeopen;
        const timeclosep = prvdraw[0]?.timeclose;

        const findBooster = await Upcome.find({
            adminId: main.adminId,
            gameId: main.gameId,
            status: 0
        }).sort({ _id: 1 }).limit(1).exec();



        // console.log("booster",findBooster);

        let booster = 1;


        if (findBooster[0]?.booster === 2) {
            booster = 2;
        } else {
            booster = await GetBoosterFunAB(main.adminId, main.gameId);
        }

        // console.log(booster);

        let randomNumber;
        let randomNumberColor;
        let randomNumberType;
        let ResultData;
        if (findBooster.length > 0) {
            randomNumber = String(findBooster[0].drawno);
            randomNumberColor = String(findBooster[0].color);
            randomNumberType = String(findBooster[0].type);
            // const resultNumber = String(findBooster[0].drawno);
            // console.log("Booster used resultNumber:", resultNumber);
            // console.log("Joker (from booster logic):", setJoker);
            ResultData = await Result.findOneAndUpdate(
                {
                    adminid: main.adminId,
                    gameid: main.gameId,
                    status: 0
                },
                {
                    status: 1,
                    drawno: randomNumber,
                    booster: booster,
                    color: randomNumberColor,
                    type: randomNumberType

                },
                {
                    upsert: true,
                    new: true // Ensures the returned document is the updated/new one
                }
            );

            await Upcome.findByIdAndUpdate(findBooster[0]._id, { status: 1 });

            await Draw.updateMany(
                {
                    adminid: new mongoose.Types.ObjectId(main.adminId),
                    gameid: main.gameId,
                    // timeopen: timeopenp,
                    // timeclose: timeclosep,
                    status: 0,
                },
                { $set: { status: 1 } }
            );
        } else {

            // console.log(groupedDraws);





            const arr1 = [];
            const arr2 = [];

            const [gamePercent] = await Percentage.find({
                adminId: new mongoose.Types.ObjectId(main.adminId),
                gameId: main.gameId
            }).limit(1).exec();

            const rawBalance = gamePercent?.gameBalance ?? 0;
            const gameBalance = rawBalance < 0 ? 0 : rawBalance;

            const winpercentage = gamePercent?.winpercentage || 0;
            const sendwin = (gameBalance * winpercentage) / 100;
            const remainingBalance = gameBalance - sendwin;
            // console.log("booster",booster);
            // console.log("rb",remainingBalance);
            // const sum = await getDrawQtyByDrawNo(main.adminId, main.gameId, main.drawno);
            const tempArray = [];

            const Colors = ["k", "c", "f", "l"];
            const Cards = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13"];

            let underColorTotal = 0;
            let baharColorTotal = 0;
            let middleColorTotal = 0;



            for (const color of Colors) {
                // Add to under color total (optional - you can handle by type if needed)
                const colorTotal = await getDrawQtyByDrawNo(main.adminId, main.gameId, color);

                const sendColorTotal = parseFloat(colorTotal) * parseFloat(3.75);

                // UNDER CARDS: index 0–5 (cards 1–6)
                for (let i = 0; i < 6; i++) {
                    const card = Cards[i];
                    const total = await getDrawQtyByDrawNo(main.adminId, main.gameId, card);
                    const underSum = await getDrawQtyByDrawNo(main.adminId, main.gameId, "under");

                    const winAmount = calculateWinAmount(total, sendColorTotal, booster, underSum);
                    //console.log(card,total, sendColorTotal, booster, underSum);
                    const entry = {
                        no: card,
                        sum: total,
                        color: color,
                        type: "under",
                        colorsum: colorTotal,
                        typesum: underSum

                    };


                    if (winAmount <= remainingBalance) {
                        arr1.push(entry);
                    } else {
                        arr2.push(entry);
                    }
                    tempArray.push(entry);
                }

                // MIDDLE CARD: index 6 (card 7)
                const middleCard = Cards[6];
                const middleTotal = await getDrawQtyByDrawNo(main.adminId, main.gameId, middleCard);



                const middleWinAmount = calculateWinAmount(middleTotal, sendColorTotal, booster, 0);
                const middleEntry = {
                    no: middleCard,
                    sum: middleTotal,
                    color: color,
                    type: "middle",
                    colorsum: colorTotal,
                    typesum: 0
                };

                if (middleWinAmount < remainingBalance) {
                    arr1.push(middleEntry);
                } else {
                    arr2.push(middleEntry);
                }
                tempArray.push(middleEntry);
                // BAHAR CARDS: index 7–12 (cards 8–13)
                for (let i = 7; i < 13; i++) {
                    const card = Cards[i];
                    const total = await getDrawQtyByDrawNo(main.adminId, main.gameId, card);
                    const baharSum = await getDrawQtyByDrawNo(main.adminId, main.gameId, "bahar");
                    const winAmount = calculateWinAmount(total, sendColorTotal, booster, baharSum);
                    const entry = {
                        no: card,
                        sum: total,
                        color: color,
                        type: "bahar",
                        colorsum: colorTotal,
                        typesum: baharSum
                    };

                    if (winAmount <= remainingBalance) {
                        arr1.push(entry);
                    } else {
                        arr2.push(entry);
                    }

                    tempArray.push(entry);
                }
            }

            // console.log("arr1", arr1);

            // console.log("arr2", arr2);



            if (arr1.length > 0) {
                // Get max values
                const maxSum = Math.max(...arr1.map(item => Number(item.sum)));
                const maxColorSum = Math.max(...arr1.map(item => Number(item.colorsum)));
                const maxTypeSum = Math.max(...arr1.map(item => Number(item.typesum)));

                // Score each item by how many max values it matches
                const scoredItems = arr1.map(item => {
                    let score = 0;
                    if (Number(item.sum) === maxSum) score += 100;       // highest weight
                    if (Number(item.colorsum) === maxColorSum) score += 10;
                    if (Number(item.typesum) === maxTypeSum) score += 1;
                    return { ...item, score };
                });


                // Get max score
                const maxScore = Math.max(...scoredItems.map(item => item.score));
                // Filter items with max score
                const topItems = scoredItems.filter(item => item.score === maxScore);

                // Pick random from the best ones
                const finalPick = topItems[Math.floor(Math.random() * topItems.length)];

                // Assign values
                randomNumber = finalPick?.no;
                randomNumberColor = finalPick?.color;
                randomNumberType = finalPick?.type;

                // console.log({ randomNumber, randomNumberColor, randomNumberType });


            } else if (arr2.length > 0) {

                // Find the minimum sum, colorsum, and typesum values in arr2
                const minSum = Math.min(...arr2.map(item => Number(item.sum)));
                const minColorSum = Math.min(...arr2.map(item => Number(item.colorsum)));
                const minTypeSum = Math.min(...arr2.map(item => Number(item.typesum)));

                // Score each item based on how closely it matches the minimums
                const scoredItems = arr2.map(item => {
                    let score = 0;
                    if (Number(item.sum) === minSum) score += 100;       // weight for sum match
                    if (Number(item.colorsum) === minColorSum) score += 10;
                    if (Number(item.typesum) === minTypeSum) score += 1;
                    return { ...item, score };
                });

                // Get the lowest score among all items
                const minScore = Math.min(...scoredItems.map(item => item.score));

                // Filter items that have the lowest score (matching minimums)
                const lowestScoreItems = scoredItems.filter(item => item.score === minScore);

                // Pick a random item from the lowest-scoring items
                const finalPick = lowestScoreItems[Math.floor(Math.random() * lowestScoreItems.length)];

                // Assign the final values
                randomNumber = finalPick?.no;
                randomNumberColor = finalPick?.color;
                randomNumberType = finalPick?.type;




            } else {
                // Final fallback: use entire tempArray
                const randomIndex = Math.floor(Math.random() * tempArray.length);
                const randomItem = tempArray[randomIndex];
                randomNumber = randomItem?.no;
                randomNumberColor = randomItem?.color;
                randomNumberType = randomItem?.type;
            }
            ResultData = await Result.findOneAndUpdate(
                {
                    adminid: main.adminId,
                    gameid: main.gameId,
                    // timeopen: timeopenp,
                    // timeclose: timeclosep,
                    status: 0
                },
                {
                    status: 1,
                    drawno: randomNumber,
                    booster: booster,
                    color: randomNumberColor,
                    type: randomNumberType

                },
                {
                    upsert: true,
                    new: true // Ensures the returned document is the updated/new one
                }
            );

            await Draw.updateMany(
                {
                    adminid: new mongoose.Types.ObjectId(main.adminId),
                    gameid: main.gameId,
                    // timeopen: timeopenp,
                    // timeclose: timeclosep,
                    status: 0,
                },
                { $set: { status: 1 } }
            );



        }


        // console.log(randomNumber);
        await sendWinFunAB(randomNumber, randomNumberColor, randomNumberType, booster, main.adminId, main.gameId, ResultData._id);
        await generateNextDrawOneMinute(timeidp, main.gameId, main.adminId);
        res.status(200).send({
            success: true,
            message: `Generated Result Triple is ${randomNumber} and color is ${randomNumberColor} or type is ${randomNumberType} booster is ${booster} `
        });
    } catch (err) {
        console.error("Error in funtarget:", err);
        res.status(500).send({
            success: false,
            message: "Internal Server Error",
            error: err.message
        });
    }
};


async function sendWinFunAB(resultNo, color, type, booster, adminId, gameId, ResultId) {
    const adminObjectId = new mongoose.Types.ObjectId(adminId);

    // Get all pending tickets
    const loadTickets = await Ticket.find({
        adminid: adminObjectId,
        gameid: gameId,
        status: 0
    }).exec();

    // console.log(loadTickets);

    for (const ticket of loadTickets) {
        const loadDraws = await Draw.find({ ticketid: ticket.ticketid }).exec();




        let winningAmount = 0;

        for (const draw of loadDraws) {
            // console.log(loadDraws);
            const win = getMatchWin(draw.drawno, resultNo, color, type, draw.drawqty, booster);
            winningAmount += win;
        }
        const userId = ticket.userid;
        if (winningAmount > 0) {

            const user = await User.findById(userId);

            let userBalance = await UserBalance.findOne({ userId, gameId, adminId });

            if (!userBalance) {
                await generateGameBalanceWithUserId(userId, gameId, adminId);
                // Give DB a short time to register new document (optional)
                await new Promise(res => setTimeout(res, 100));
                userBalance = await UserBalance.findOne({ userId, gameId, adminId });
            }

            await UserBalance.findOneAndUpdate(
                { userId, gameId, adminId },
                { $inc: { winBalance: winningAmount } }
            );


        } else {
            clearbetok(winningAmount, adminId, gameId, userId);
        }

        // console.log(winningAmount);

        // Mark ticket as processed
        await Ticket.findByIdAndUpdate(ticket._id, {
            status: 1,
            winpoints: winningAmount,
            result: ResultId
        });


        const [gamePercent] = await Percentage.find({
            adminId: new mongoose.Types.ObjectId(adminId),
            gameId: gameId
        }).limit(1).exec();

        const gameBalance = gamePercent?.gameBalance || 0;

        const newBalance = parseFloat(gameBalance) - parseFloat(winningAmount);
        await Percentage.findOneAndUpdate(
            {
                adminId: new mongoose.Types.ObjectId(adminId),
                gameId: gameId
            },
            { gameBalance: newBalance },
            { upsert: true } // ADD THIS
        );
    }
}
function getMatchWin(drawno, resultNo, color, type, drawqty, booster) {
    let win = 0;

    if (drawno === resultNo) {
        win += parseFloat(drawqty) * 12;
    }

    if (drawno === color) {
        win += parseFloat(drawqty) * 3.95;
    }

    if (drawno === type) {
        win += parseFloat(drawqty) * 1.95;
    }

    return win * parseFloat(booster);
}
async function GetBoosterFunAB(adminId, gameId) {
    const adminObjectId = new mongoose.Types.ObjectId(adminId);

    let frequency = await Frequency.findOne({
        adminid: adminObjectId,
        gameid: gameId
    });

    if (!frequency) {
        // Set random count 20-30
        const randomNumber = Math.floor(Math.random() * (30 - 20 + 1)) + 20;
        frequency = new Frequency({
            gameid: gameId,
            adminid: adminObjectId,
            fcount: randomNumber
        });
        await frequency.save();
        return "1"; // First time, just start the counter
    }

    if (frequency.fcount <= 0) {
        // fcount hit zero, set it again and return "yes" once
        const randomNumber = Math.floor(Math.random() * (30 - 20 + 1)) + 20;
        await Frequency.findOneAndUpdate(
            { adminid: adminObjectId, gameid: gameId },
            { fcount: randomNumber }
        );
        return "2"; // This is the moment to trigger "joker"
    } else {
        // Decrement fcount
        await Frequency.findOneAndUpdate(
            { adminid: adminObjectId, gameid: gameId },
            { $inc: { fcount: -1 } }
        );
        return "1";
    }
}


// one minutes and two minutes times

async function generateNextDrawOneMinute(timeId, gameId, adminId) {
    const currentTime = new Date();
    const hours = currentTime.getHours().toString().padStart(2, '0');  // Ensure two digits for hours
    const minutes = parseInt(currentTime.getMinutes() + 1).toString().padStart(2, '0');  // Ensure two digits for minutes
    const time = `${hours}:${minutes}`;  // Combine hours and minutes with a colon
    const timeclose = hours >= 12 ? 'PM' : 'AM';
    // Create the next draw entry in the Result collection
    const makeResult = new Result({
        timeid: timeId,
        date: new Date(),
        status: 0,
        timeopen: time,
        timeclose: timeclose,
        gameid: gameId,
        adminid: adminId
    });

    await makeResult.save();
}
async function generateNextDrawTwoMinute(timeId, gameId, adminId) {
    const currentTime = new Date();
    const hours = currentTime.getHours().toString().padStart(2, '0');  // Ensure two digits for hours
    const minutes = parseInt(currentTime.getMinutes() + 2).toString().padStart(2, '0');  // Ensure two digits for minutes
    const time = `${hours}:${minutes}`;  // Combine hours and minutes with a colon
    const timeclose = hours >= 12 ? 'PM' : 'AM';
    // Create the next draw entry in the Result collection
    const makeResult = new Result({
        timeid: timeId,
        date: new Date(),
        status: 0,
        timeopen: time,
        timeclose: timeclose,
        gameid: gameId,
        adminid: adminId
    });

    await makeResult.save();
}



function calculateWinAmount(cardTotal = 0, colorTotal = 0, booster = 1, underbaharsum = 0) {
    const underBaharWin = Number(underbaharsum) * 1.95;
    const baseWin = (Number(cardTotal) * 12) + Number(colorTotal) + underBaharWin;
    return baseWin * Number(booster);
}




const titlisorrat = async (req, res) => {
    try {
        let gameId = "qZicXikT";
        let adminId = ADMINID;
        
        
        
        const game = await Game.findOne({ gameId }).populate("timeId").limit(1).exec();
        if (!game) return res.status(404).send({ success: false, message: "Game not found" });

        const main = { gameId: game.gameId, adminId };
        const [lastResult] = await Result.find({ gameid: gameId, adminid: adminId, status: 0 })
            .sort({ _id: -1 })
            .limit(1)
            .exec();

        if (!lastResult) {
            await generateNextDrawOneMinute(game.timeId[0]._id, gameId, adminId);
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const { timeid: timeIdPrev, timeopen, timeclose } = lastResult || {};

        // Check if a booster draw is scheduled
        const [boosterDraw] = await Upcome.find({ adminId, gameId, status: 0 }).sort({ _id: 1 }).limit(1).exec();

        // Decide Joker value
        let joker = "1";
        if (boosterDraw?.booster === 2) {
            joker = "2";
        } else {
            joker = await GetBoosterFunTarget(adminId, gameId);
        }

        let randomNumber, resultDoc, baltestvalue;

        // If booster draw exists, use it directly
        if (boosterDraw) {
            randomNumber = String(boosterDraw.drawno);

            resultDoc = await Result.findOneAndUpdate(
                { adminid: adminId, gameid: gameId, status: 0 },
                { status: 1, drawno: randomNumber, booster: joker },
                { upsert: true, new: true }
            );

            await Upcome.findByIdAndUpdate(boosterDraw._id, { status: 1 });

            await Draw.updateMany(
                { adminid: adminId, gameid: gameId, status: 0 },
                { $set: { status: 1 } }
            );
        } else {
            const [gamePercent] = await Percentage.find({ adminId, gameId }).limit(1).exec();
            const gameBalance = gamePercent?.gameBalance || 0;
            const winPercentage = gamePercent?.winpercentage || 0;
            const allowedWin = (gameBalance * winPercentage) / 100;
            const remainingBalance = gameBalance - allowedWin;

            baltestvalue = remainingBalance;

            const safeDraws = [], riskyDraws = [];
            const drawPromises = [];

            for (let i = 1; i < 13; i++) {
                const drawno = String(i);
                drawPromises.push(
                    getDrawQtyByDrawNo(adminId, gameId, drawno).then(qty => {
                        const winQty = qty * 11;
                        const logicValue = winQty * joker;

                        if (logicValue <= remainingBalance) {
                            safeDraws.push({ no: i, sum: logicValue });
                        } else {
                            riskyDraws.push({ no: i, sum: logicValue });
                        }

                        return Draw.updateMany(
                            { adminid: adminId, gameid: gameId, drawno, status: 0 },
                            { $set: { status: 1 } }
                        );
                    }).catch(err => console.error(`Draw ${i} error:`, err))
                );
            }

            await Promise.all(drawPromises);
            
            //   console.log("safe",safeDraws);
            //   console.log("risky",riskyDraws);

            if (safeDraws.length > 0) {
              const maxSum = Math.max(...safeDraws.map(draw => draw.sum));

                // Step 2: Filter draws that have the maximum sum
                const maxDraws = safeDraws.filter(draw => draw.sum === maxSum);
                
                // Step 3: Select a random one among those
                const randomEntry = maxDraws[Math.floor(Math.random() * maxDraws.length)];
                 randomNumber = randomEntry.no;


            } else if (riskyDraws.length > 0) {
                const minSum = Math.min(...riskyDraws.map(d => d.sum));
                const lowest = riskyDraws.filter(d => d.sum === minSum);
                const randomPick = lowest[Math.floor(Math.random() * lowest.length)];
                randomNumber = randomPick.no;
            } else {
                randomNumber = Math.floor(Math.random() * 12) + 1;
            }

            resultDoc = await Result.findOneAndUpdate(
                { adminid: adminId, gameid: gameId, status: 0 },
                { status: 1, drawno: randomNumber, booster: joker },
                { upsert: true, new: true }
            );
        }

        //   console.log(randomNumber, joker, adminId, gameId, resultDoc._id);

        await sendTitaliSorratWin(randomNumber, joker, adminId, gameId, resultDoc._id);
        await generateNextDrawOneMinute(timeIdPrev, gameId, adminId);
        
        res.status(200).send({
            success: true,
            message: `Successfully generated result of Titli Sorrat result is ${randomNumber} and booster is ${joker}`
        });
    } catch (err) {
        console.error("Error in funtarget:", err);
        res.status(500).send({
            success: false,
            message: "Internal Server Error",
            error: err.message
        });
    }
};

async function sendTitaliSorratWin(resultNo, joker, adminId, gameId, resultId) {

    const adminObjectId = new mongoose.Types.ObjectId(adminId);

    // Get all pending tickets
    const loadTickets = await Ticket.find({
        adminid: adminObjectId,
        gameid: gameId,
        status: 0
    }).exec();

    // console.log(loadTickets);

    for (const ticket of loadTickets) {
        const loadDraws = await Draw.find({ ticketid: ticket.ticketid }).exec();

        // console.log(loadDraws);


        let winningAmount = 0;

        for (const draw of loadDraws) {
              if (String(draw.drawno) === String(resultNo)) {
                let win = parseFloat(draw.drawqty) * 11;
                // Joker multiplier
                win *= joker;

                winningAmount += win;
            }
        }
        const userId = ticket.userid;

        if (winningAmount > 0) {

            const user = await User.findById(userId);
            let userBalance = await UserBalance.findOne({ userId, gameId, adminId });

            if (!userBalance) {
                await generateGameBalanceWithUserId(userId, gameId, adminId);
                // Give DB a short time to register new document (optional)
                await new Promise(res => setTimeout(res, 100));
                userBalance = await UserBalance.findOne({ userId, gameId, adminId });
            }

            await UserBalance.findOneAndUpdate(
                { userId, gameId, adminId },
                { $inc: { winBalance: winningAmount } }
            );

        } else {
            clearbetok(winningAmount, adminId, gameId, userId);
        }

        // Mark ticket as processed
        await Ticket.findByIdAndUpdate(ticket._id, {
            status: 1,
            winpoints: winningAmount,
            result: resultId
        });


        const [gamePercent] = await Percentage.find({
            adminId: new mongoose.Types.ObjectId(adminId),
            gameId: gameId
        }).limit(1).exec();

        const gameBalance = gamePercent?.gameBalance || 0;


        const balance = parseFloat(gameBalance);
        const winning = parseFloat(winningAmount);
        const newBalance = balance - winning; // Prevent negative balance

        await Percentage.findOneAndUpdate(
            {
                adminId: new mongoose.Types.ObjectId(adminId),
                gameId: gameId
            },
            { gameBalance: newBalance },
            { upsert: true } // ADD THIS
        );
    }
}


async function clearbetok(winamount, adminId, gameId, userId) {
    try {
        if (winamount <= 0) {
            const userObjectId = new mongoose.Types.ObjectId(userId);

            await Draw.updateMany(
                {
                    gameid: gameId,
                    userid: userObjectId
                },
                {
                    $set: { betok: true }
                }
            );

            console.log(`Cleared betok (set to true) for user ${userId} in game ${gameId}`);
        }
    } catch (error) {
        console.error('Error clearing betok:', error);
    }
}


function getRandomFromMaxSum(draws) {
    if (!Array.isArray(draws) || draws.length === 0) return null;

    const maxSum = Math.max(...draws.map(draw => draw.sum));
    const maxDraws = draws.filter(draw => draw.sum === maxSum);

    const randomEntry = maxDraws[Math.floor(Math.random() * maxDraws.length)];
    return randomEntry.no;
}


module.exports = {
    funtarget,
    funroullet,
    triplefun,
    funab,
    titlisorrat
}
