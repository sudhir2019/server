const Game = require("../models/game.model");
const { User } = require("../models/user.model");
const { validationResult } = require("express-validator"); // To handle validation errors
const { default: mongoose } = require("mongoose");
const Percentage = require("../models/percentage.model");
const GameImage = require("../models/gameimage.model");
const { Draw } = require("../models/draw.model");
const { Ticket } = require("../models/ticket.model");
const Upcome = require("../models/upcome.model");

async function loadLiveGameData(req, res) {
    try {
        const { adminId, gameId } = req.query;

        // Validate that both adminId and gameId are provided
        if (!adminId || !gameId) {
            return res.status(400).send({
                success: false,
                message: "Both adminId and gameId are required"
            });
        }

        // Fetch the percentage data for the given adminId and gameId
        const foundPercentage = await Percentage.find({
            adminId: new mongoose.Types.ObjectId(adminId),
            gameId: gameId // gameId is a string, so we pass it directly
        }).exec();

        // Fetch the game details for the given gameId

        const gameDetails = await Game.findOne({ gameId: gameId })
            .populate("timeId")
            .select("GameImage nodigit label gameName gameId")
            .populate("GameImage") // Ensure the GameImage reference is populated
            .limit(1)
            .exec();

        // If data is found, send it; otherwise, send a not found message
        let playData;
        if (gameDetails.GameImage) {
            playData = await playedDataWithLabel(gameId, adminId, gameDetails.GameImage);

        } else {
            playData = await playedData(gameId, adminId, gameDetails.nodigit);
        }

        let totalGameCollection = await CalculateTotalCollection(adminId, gameId);

        if (foundPercentage.length > 0) {
            res.status(200).send({
                success: true,
                data: {
                    percentageData: foundPercentage,
                    gameData: gameDetails,
                    playData: playData,
                    gameBalance: 0,
                    collection: totalGameCollection,

                }
            });
        } else {
            res.status(404).send({
                success: false,
                message: "No data found for the given adminId and gameId"
            });
        }
    } catch (error) {
        console.error(error);
        res.status(503).send({
            success: false,
            data: [],
            message: "An error occurred while fetching live game data"
        });
    }
}

async function playedData(gameId, adminId, nodigit) {
    // console.log(gameId, adminId, nodigit)
    const data = [];

    // Aggregate the draw data
    const drawData = await Draw.aggregate([
        {
            $match: {
                adminid: new mongoose.Types.ObjectId(adminId),
                gameid: gameId,  // gameId is a string, so we pass it directly
                status: 0
            }
        },
        {
            $group: {
                _id: "$drawno",  // Group by draw number
                drawtotal: { $sum: "$drawtotal" }  // Sum the drawtotal field
            }
        }
    ]).exec();

    // Create the data array by matching drawNo and adding to the results
    for (let i = 1; i <= nodigit; i++) {
        const draw = drawData.find(item => item._id === i);
        const drawtotal = draw ? draw.drawtotal : 0;  // If no data is found, set drawQty to 0

        data.push({
            drawNo: i,
            drawtotal: drawtotal
        });
    }

    return data;
}

async function playedDataWithLabel(gameId, adminId, GameImage) {
    const data = [];

    // Aggregate the draw data
    const drawData = await Draw.aggregate([
        {
            $match: {
                adminid: new mongoose.Types.ObjectId(adminId),
                gameid: gameId,  // gameId is a string, so we pass it directly
                status: 0
            }
        },
        {
            $group: {
                _id: "$drawno",  // Group by draw number
                drawtotal: { $sum: "$drawtotal" }  // Sum the drawtotal field
            }
        }
    ]).exec();

    // console.log(drawData)

    // Create the data array by matching drawNo with GameImage items
    GameImage.forEach((item, index) => {
        // Assuming GameImage array has drawNo associated with it (i.e., it's ordered correctly or has a field for drawNo)
        const draw = drawData.find(draw => draw._id === (index + 1));  // Assuming drawno starts from 1

        // console.log(draw);

        const drawtotal = draw ? draw.drawtotal : 0;  // If no data is found, set drawtotal to 0

        data.push({
            drawNo: index + 1,  // Adjust index to represent the draw number (1, 2, 3...)
            drawtotal: drawtotal || 0,
            image: item.image
        });
    });

    return data;
}

//operations
async function addBalance(req, res) {
    try {
        const { adminId, gameId, balance, type } = req.body;

        // Step 1: Find the current gameBalance from the database
        const existingPercentage = await Percentage.findOne({ gameId: gameId, adminId: adminId });

        // If no document is found, return an error message
        if (!existingPercentage) {
            return res.status(404).send({
                success: false,
                message: "Game not found for the given admin."
            });
        }

        // Step 2: Get the current gameBalance, or default to 0 if it doesn't exist
        const currentBalance = existingPercentage.gameBalance || 0;
        let updatedBalance;
        if (type == "add") {
            updatedBalance = currentBalance + parseFloat(balance);
        }
        if (type === "remove") {
            updatedBalance = 0;
        }
        // Step 3: Add the new balance to the current balance


        // Step 4: Update the gameBalance in the database
        const updatePercentage = await Percentage.updateOne(
            { gameId: gameId, adminId: adminId },  // Matching gameId and adminId
            { $set: { gameBalance: updatedBalance } }  // Updating the gameBalance field
        );

        // Step 5: Check if any documents were updated
        if (updatePercentage.nModified === 0) {
            return res.status(404).send({
                success: false,
                message: "No matching records found to update"
            });
        }

        // Step 6: Return the response
        res.status(200).send({
            success: true,
            message: "Balance updated successfully"
        });
    } catch (error) {
        // Handle errors
        res.status(500).send({
            success: false,
            message: error.message || "An error occurred while updating the balance"
        });
    }
}


async function addCustomResult(req, res) {
    try {
        const { adminId, gameId, result,color,type, boosterValue } = req.body;

        // Step 1: Create a new document in the "Upcome" collection
        const upcome = new Upcome({
            adminId: adminId,
            gameId: gameId,
            drawno: result,
            color:color,
            type:type,
            booster: boosterValue,
            status: 0 // Assuming 0 represents an initial or default status
        });

        // Step 2: Save the new document to the database
        await upcome.save();

        // Step 3: Return the success response
        res.status(200).send({
            success: true,
            message: "Result added successfully",
            data: upcome
        });
    } catch (error) {
        // Step 4: Handle any errors
        res.status(500).send({
            success: false,
            message: error.message || "An error occurred while adding the result"
        });
    }
}





async function liveData(req, res) {
    try {
        const { adminId, gameId } = req.query;



        if (!adminId || !gameId) {
            return res.status(400).json({ message: 'Missing adminId or gameId' });
        }

        if (gameId === "MNOQqWWi") {
            // console.log(adminId, gameId);
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
                        _id: { $toString: "$drawno" },  // Grouping as string
                        drawtotal: { $sum: "$drawtotal" }
                    }
                },
                {
                    $sort: { _id: 1 }
                }
            ]);
            // console.log(drawData);


            const data = funtarget.map((obj) => {
                const draw = drawData.find(item => item._id === obj.drawno);
                return {
                    ...obj,
                    sum: draw ? draw.drawtotal : 0
                };
            });
            let totalGameCollection = await CalculateTotalCollection(adminId, gameId);
            const foundPercentage = await Percentage.find({
                adminId: new mongoose.Types.ObjectId(adminId),
                gameId: gameId // gameId is a string, so we pass it directly
            }).exec();

            // console.log(foundPercentage);

            return res.status(200).json({
                success: true,
                data,
                collections: totalGameCollection,
                percentageData: foundPercentage,

            });
        }


        if (gameId === "vwRORrGO") {
            // console.log(adminId, gameId);
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

            // ✅ Add "00" at the end (for American roulette)
            funroullet.push({
                label: "00",
                drawno: "00",
                image: "",
                color: "green",
            });

            // console.log(funroullet);

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
                        _id: { $toString: "$drawno" },  // Grouping as string
                        drawtotal: { $sum: "$drawtotal" }
                    }
                },
                {
                    $sort: { _id: 1 }
                }
            ]);
            // console.log(drawData);


            const data = funroullet.map((obj) => {
                const draw = drawData.find(item => item._id === obj.drawno);
                return {
                    ...obj,
                    sum: draw ? draw.drawtotal : 0
                };
            });
            let totalGameCollection = await CalculateTotalCollection(adminId, gameId);
            const foundPercentage = await Percentage.find({
                adminId: new mongoose.Types.ObjectId(adminId),
                gameId: gameId // gameId is a string, so we pass it directly
            }).exec();

            // console.log(foundPercentage);

            return res.status(200).json({
                success: true,
                data,
                collections: totalGameCollection,
                percentageData: foundPercentage,

            });
        }


        if (gameId === "zuuhVbBM") {
            // console.log(adminId, gameId);
            const triplefun = [];

            for (let i = 0; i <= 9; i++) {
                for (let j = 0; j <= 9; j++) {
                    for (let k = 0; k <= 9; k++) {
                        triplefun.push({
                            one: `${i}`,
                            two: `${i}${j}`,
                            three: `${i}-${j}-${k}`,
                            label: `${i}-${j}-${k}`,
                            drawno: `${i}${j}${k}`,  // Optional: full number without dashes
                            image: "",
                            color: ""
                        });
                    }
                }
            }



            // console.log(funroullet);

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
                        _id: { $toString: "$drawno" },  // Grouping as string
                        drawtotal: { $sum: "$drawtotal" }
                    }
                },
                {
                    $sort: { _id: 1 }
                }
            ]);
            // console.log(drawData);


            const data = await Promise.all(
                triplefun.map(async (obj) => {
                    const draw = drawData.find(item => item._id === obj.drawno);
                    const findsingle = await GetTotal(obj.one, adminId, gameId);
                    const findtwo = await GetTotal(obj.two, adminId, gameId);
                    const findthree = await GetTotal(obj.drawno, adminId, gameId);

                    return {
                        ...obj,
                        sum: findthree
                    };
                })
            );




            let totalGameCollection = await CalculateTotalCollection(adminId, gameId);
            const foundPercentage = await Percentage.find({
                adminId: new mongoose.Types.ObjectId(adminId),
                gameId: gameId // gameId is a string, so we pass it directly
            }).exec();

            // console.log(foundPercentage);

            return res.status(200).json({
                success: true,
                data,
                collections: totalGameCollection,
                percentageData: foundPercentage,

            });
        }


        if (gameId === "qZicXikM") {
            // console.log(adminId, gameId);
            const andharBahar = Array.from({ length: 13 }, (_, i) => {
                const drawno = i + 1; // 1 to 13
                const labels = {
                    1: 'A',
                    11: 'J',
                    12: 'Q',
                    13: 'K'
                };

                return {
                    label: labels[drawno] || drawno.toString(), // Use mapped label or the number itself
                    drawno: drawno.toString(),
                    image: `/assets/games/${drawno}.png`,
                    color: "",
                };
            });




            // console.log(funroullet);

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
                        _id: { $toString: "$drawno" },  // Grouping as string
                        drawtotal: { $sum: "$drawtotal" }
                    }
                },
                {
                    $sort: { _id: 1 }
                }
            ]);
            // console.log(drawData);


            const data = await Promise.all(
                andharBahar.map(async (obj) => {
                    const draw = drawData.find(item => item._id === obj.drawno);
                    return {
                        ...obj,
                        sum: draw ? draw.drawtotal : 0
                    };
                })
            );

           const colors = ["k","c","f","l"]


            const dataColors = await Promise.all(
                colors.map(async (obj) => {
                    const findsingle = await GetTotal(obj, adminId, gameId);
                    return {
                        ...obj,
                        label :obj,
                        drawno :obj,
                        image: `/assets/games/${obj}.png`,
                        sum: findsingle ? findsingle : 0
                    };
                })
            );


            const datCardType = ["under", "bahar"];

            const dataCardTypes = await Promise.all(
              datCardType.map(async (drawno) => {
                const findsingle = await GetTotal(drawno, adminId, gameId);
                // console.log(drawno)
                return {
                  label: drawno.charAt(0).toUpperCase() + drawno.slice(1), // Optional: Capitalize for UI
                  drawno: drawno,
                  sum: findsingle || 0
                };
              })
            );
            let totalGameCollection = await CalculateTotalCollection(adminId, gameId);
            const foundPercentage = await Percentage.find({
                adminId: new mongoose.Types.ObjectId(adminId),
                gameId: gameId // gameId is a string, so we pass it directly
            }).exec();

            // console.log(foundPercentage);

            return res.status(200).json({
                success: true,
                data,
                dataColors,
                dataCardTypes,
                collections: totalGameCollection,
                percentageData: foundPercentage,

            });
        }


        


        if (gameId === "qZicXikT") {
            // console.log(adminId, gameId);
            const titli = Array.from({ length: 12 }, (_, i) => {
                const drawno = i + 1; // 1 to 13
               
                return {
                    label:  drawno.toString(), // Use mapped label or the number itself
                    drawno: drawno.toString(),
                    image: `/assets/games/titli/${drawno}.png`,
                    color: "",
                };
            });




            // console.log(funroullet);

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
                        _id: { $toString: "$drawno" },  // Grouping as string
                        drawtotal: { $sum: "$drawtotal" }
                    }
                },
                {
                    $sort: { _id: 1 }
                }
            ]);
            // console.log(drawData);


            const data = await Promise.all(
                titli.map(async (obj) => {
                    const draw = drawData.find(item => item._id === obj.drawno);
                    return {
                        ...obj,
                        sum: draw ? draw.drawtotal : 0
                    };
                })
            );

            let totalGameCollection = await CalculateTotalCollection(adminId, gameId);
            const foundPercentage = await Percentage.find({
                adminId: new mongoose.Types.ObjectId(adminId),
                gameId: gameId // gameId is a string, so we pass it directly
            }).exec();

            // console.log(foundPercentage);

            return res.status(200).json({
                success: true,
                data,
                collections: totalGameCollection,
                percentageData: foundPercentage,

            });
        }


        



        return res.status(404).json({ message: "Game not found" });

    } catch (error) {
        console.error("Error in liveData:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}
async function CalculateTotalCollection(adminId, gameId) {
    // console.log(adminId,gameId)
    var date = new Date();
    date.setHours(0, 0, 0, 0); // Set to midnight for the start of the day
    const now = new Date(); // Current time

    // console.log(date);

    // Aggregation to calculate total playpoints and winpoints for today
    const tickets = await Ticket.aggregate([
        {
            $match: {
                adminid: new mongoose.Types.ObjectId(adminId),         // Filter by adminId
                gameid: gameId,
                date: {                   // Filter by date range
                    $gte: date,           // Greater than or equal to today
                    $lte: now      // Less than or equal to current time
                }
            }
        },
        {
            $group: {
                _id: null,                      // Group all matching tickets together (since we're summing the values, we don't need to group by anything)
                totalPlaypoints: { $sum: "$playpoints" },  // Sum up the playpoints
                totalWinpoints: { $sum: "$winpoints" }     // Sum up the winpoints
            }
        }
    ]).exec();


    // If no matching tickets found, return 0 for both playpoints and winpoints
    if (tickets.length === 0) {
        return {
            totalPlaypoints: 0,
            totalWinpoints: 0
        };
    }

    // Extract the sum values from the aggregation result
    const { totalPlaypoints, totalWinpoints } = tickets[0];

    return {
        totalPlaypoints,
        totalWinpoints
    };
}

async function GetTotal(drawno, adminId, gameId) {
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

    return result.length > 0 ? result[0].drawtotal : 0;
}




module.exports = { loadLiveGameData, addBalance, addCustomResult, liveData };
