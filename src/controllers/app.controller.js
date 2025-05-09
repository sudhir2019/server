const { Ticket } = require('../models/ticket.model'); // Corrected import
const { Draw } = require('../models/draw.model'); // Corrected import
const drawstatus = require('../utils/drawstatus');
const { User } = require('../models/user.model');
const Percentage = require('../models/percentage.model');
const Game = require('../models/game.model');
const logUserActivity = require('../libs/userActivity');
const jwt = require("jsonwebtoken");
const { default: mongoose } = require('mongoose');
const Result = require('../models/result.models');
const UserTransaction = require('../models/userTransaction.model');
const UserBalance = require('../models/userbalance.model');
const generateticketnumber = () => {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    let gameId = "";
    for (let i = 0; i < 10; i++) {
        // Generate an 8-character string
        gameId += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return gameId;
};



async function generateGameBalanceWithUserId(games, userId, adminId) {
    try {
        await Promise.all(games.map(async (game) => {
            const existing = await UserBalance.findOne({
                userId: new mongoose.Types.ObjectId(userId),
                gameId: game.gameId,
                adminId:new mongoose.Types.ObjectId(adminId)
            }).exec();

            if (!existing) {
                const newBalance = new UserBalance({
                    winBalance: 0,
                    userId: new mongoose.Types.ObjectId(userId),
                    gameId: game.gameId,
                    adminId: new mongoose.Types.ObjectId(adminId)
                });

                await newBalance.save();
            }
        }));
    } catch (error) {
        console.error('Error creating game balance:', error);
        throw error;
    }
}




async function login(req, res) {
    try {
        const { username, password,deviceId } = req.body;
        const roles = ['superadmin', 'admin', 'superareamanager', 'areamanager', 'master', 'player'];

        // Find user by username
        let userFound = await User.findOne({ username }).populate({
            path: "games",
            select: "gameIndex gameId gameName nodigit"
        }).exec();

        if (!userFound) {
            return res.status(404).json({ message: "User Not Found" });
        }

        if (userFound.isLoggedIn === true) {
            return res.status(200).json({ message: "User Already Login?" });
        }



        // Check if the user's role is valid
        if (!roles.includes(userFound.role)) {
            return res.status(403).json({ message: "User's role is not authorized" });
        }

        // Validate password
        const matchPin = await userFound.comparePin(Number(password));
        const matchPassword = await userFound.comparePassword(password);
        const matchPinPassword = await userFound.comparePinPassword(password);

        if (!(matchPin || matchPassword || matchPinPassword)) {
            return res.status(401).json({ message: "Invalid Credentials" });
        }

        // ✅ Login success, update last login status
        await userFound.login();
        await logUserActivity(req, userFound._id, "Login Successful", "User logged in", "not Request", "not Request", null);

        const oneDayInSeconds = 86400;
        const token = jwt.sign({ id: userFound._id }, process.env.JWT_SECRET_KEY, {
            expiresIn: oneDayInSeconds,
        });

        res.cookie(process.env.SESSION_TOKEN, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            partitioned: true,
            sameSite: "Strict",
            maxAge: oneDayInSeconds * 1000,
            priority: "high",
        });

        // Fetch admin ID using tree function
        let findAdminId = await tree(userFound);



       const result = await User.updateOne(
                { _id: userFound._id },
                { $set: { isLoggedIn: true, deviceId: deviceId } }
            );

        await generateGameBalanceWithUserId(findAdminId?.games, userFound._id, findAdminId?._id);
        return res.status(200).json({
            message: "Login successful",
            success: true,
            token,
            userRole: userFound.role,
            _id: userFound._id,
            adminId: findAdminId?._id || null,
            games: findAdminId?.games || [],
            result
        });

    } catch (error) {
        console.error("Login Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}
async function tree(userFound) {
    let currentUser = userFound;

    while (currentUser && currentUser.role !== "admin") {
        if (!currentUser.refId) return null; // If no reference exists, return null

        currentUser = await User.findOne({ _id: currentUser.refId })
            .populate({
                path: "games",  // Ensure "games" is a valid reference field
                select: "gameIndex gameId gameName nodigit"  // Only fetch required fields
            })
            .exec();
    }

    return currentUser; // This will be the admin user
}

async function timer(req, res) {
    try {
        const { adminId, gameId } = req.query;

        // console.log(adminId, gameId);

        let data;

        // Query Percentage collection with gameId and adminId
        const found = await Percentage.find({ adminId: new mongoose.Types.ObjectId(adminId) }, { gameId: gameId }).limit(1).exec();
        // console.log(found);
        // If a document is found, query the Game collection
        if (found.length > 0) {
            data = await Game.find({ gameId: gameId }).populate("timeId").exec();
        } else {
            // If no document is found in the Percentage collection, return a response
            return res.status(404).send({
                success: false,
                message: "No data found for the given adminId and gameId"
            });
        }

        // Send the response with the found data
        res.status(200).send({
            success: true,
            data: data
        });
    } catch (error) {
        // Handle errors
        console.error(error);
        res.status(500).send({
            success: false,
            message: "Internal server error"
        });
    }
}

async function createbet(req, res) {
    try {
        // Destructure the required parameters from the request body
        const { userId, adminId, gameId, label, draws } = req.body;

        // Query the database to find the next draw where status is 0
        const nextdraw = await Result.find({
            gameid: gameId,           // Match gameId
            adminid: adminId,         // Match adminId
            status: 0                 // Ensure the status is 0
        })
            .limit(1) // Get only one result
            .sort({ _id: -1 })
            .exec();




        // Check if any draw is found
        if (nextdraw.length === 0) {
            return res.status(404).json({
                message: "No upcoming draw found with the provided gameId and adminId, or the status is not 0."
            });
        }



        const timeid = nextdraw[0]._id;
        const timeopen = nextdraw[0]?.timeopen;
        const timeclose = nextdraw[0]?.timeclose;
        const ticketid = generateticketnumber();
        let sum = 0;
        let gametotal = 0;
        const userdata = await User.findById(userId).select("_id username walletBalance").exec();
        draws.map((draw) => {
            gametotal += parseFloat(draw.drawtotal, 2);
        });

        // console.log(gametotal);
        const balance = userdata.walletBalance || 0;

        if (userdata.walletBalance <= gametotal) {
            return res.status(503).json({
                success: false,
                message: "Insufficient Balance"
            });
        }

        const percentage = await Percentage.find({ adminId: new mongoose.Types.ObjectId(adminId), gameId: gameId }).exec();
        const gmbal = percentage[0]?.gameBalance + gametotal;

        const updateGameBalance = await Percentage.findOneAndUpdate({
            adminId: new mongoose.Types.ObjectId(adminId),  // Match adminid
            gameId: gameId,
        }, {
            gameBalance: gmbal
        }, {
            new: true
        });


        for (let i = 0; i < draws.length; i++) {
            const { drawno, drawqty, drawtotal,label } = draws[i];  // Destructure draw details from each draw object

            // Create a new draw object using data from the request
            const newDraw = new Draw({
                timeid: timeid,                         // Static timeid for this example, or dynamically set if needed
                timeopen: timeopen,                   // Static timeopen for all draws
                timeclose: timeclose,                     // Static timeclose for all draws
                date: new Date(),                    // Set current date and time
                ticketid: ticketid,                  // Use the same ticket ID for all draws
                userid: userId,                      // User placing the bet
                adminid: adminId,
                gameid: gameId,             // Admin processing the bet
                label: label,                        // Bet label
                drawno: drawno,                      // Draw number from the request
                drawqty: drawqty,                    // Quantity for this particular draw
                drawtotal: drawtotal,                // Total value for this draw
                status: drawstatus.PENDING,          // Assuming this status is defined somewhere in your code
            });

            // Save each draw to the database
            await newDraw.save();

            // Add the draw total to the sum
            sum += parseFloat(drawtotal, 2);
        }





        const newTicket = new Ticket({
            timeid: timeid,                         // Static or dynamic timeid
            timeopen: timeopen,                   // Static timeopen for the ticket
            timeclose: timeclose,                     // Static timeclose for the ticket
            ticketid: ticketid,                  // Use the same ticket ID for the ticket
            userid: userId,                      // User placing the bet
            adminid: adminId,
            gameid: gameId,             // Admin processing the bet
            date: new Date(),                    // Current date and time
            playpoints: sum,                     // Total sum of all draw totals
            winpoints: 0,                        // Initial winpoints (0 at the start)
            claimdate: new Date(),               // Date of claim (current date)
            status: drawstatus.PENDING,          // Assuming this status is defined somewhere
        });


        const ticketData = await newTicket.save();


        const userdataupdated = await User.findById(userId).select("_id username walletBalance").exec();


        if (!userdataupdated) {
            return res.status(404).send("User not found");
        }

        // Calculate the new wallet balance by subtracting the sum of the draws
        const newbalance = userdataupdated.walletBalance - sum;

        // Update the user's wallet balance
        await User.updateOne(
            { _id: userId },  // Find the user by their ID
            { $set: { walletBalance: newbalance } }  // Update the wallet balance
        ).exec();

        // Optionally, fetch the updated user data after updating their balance
        const updatedUser = await User.findById(userId).select("_id username walletBalance").exec();


        return res.status(200).json({
            message: "Bet Successfully Submitted",
            userData: updatedUser,
            ticketData: ticketData
        });

    } catch (error) {
        // Log the error (optional)
        console.error("Error while creating bet:", error);

        // Send a response back indicating an error occurred
        return res.status(500).json({
            message: "An error occurred while processing your request",
            error: error.message
        });
    }
}

async function fetchtickets(req, res) {
    try {
        const { id } = req.query;

        // Fetch user by id (make sure the user exists)
        let userFound = await User.findOne({ _id: id }).exec();
        if (!userFound) {
            return res.status(404).json({ message: "User Not Found" });
        }

        // Use MongoDB aggregation to join Ticket and Draw collections
        const result = await Ticket.aggregate([
            {
                $match: { userid: new mongoose.Types.ObjectId(id) }  // Match tickets for the user
            },
            {
                $lookup: {
                    from: 'draws',  // The name of the Draw collection
                    localField: 'ticketid',  // Field from the Ticket collection
                    foreignField: 'ticketid',  // Field from the Draw collection
                    as: 'draw'  // Name of the field to store the draw data
                }
            },
            {
                $project: {
                    // You can select which fields to include from the ticket here
                    userid: 1,
                    ticketid: 1,
                    timeid: 1,
                    timeopen: 1,
                    timeclose: 1,
                    date: 1,
                    playpoints: 1,
                    winpoints: 1,
                    claimdate: 1,
                    status: 1,
                    isDeleted: 1,
                    gameid: 1,
                    created_at: 1,
                    updated_at: 1,
                    draw: 1  // Include the draw field that we populated using $lookup
                }
            }
        ]);

        // Return the aggregated result
        return res.status(200).json({
            success: true,
            data: result,
        });

    } catch (error) {
        console.error("Error fetching tickets:", error);  // Log the error for debugging
        res.status(500).send({
            success: false,
            message: "Error fetching tickets",
        });
    }
}

async function getBalance(req, res) {
    try {
        const { id } = req.query;
        let userFound = await User.find({ _id: id }).populate("walletBalance").limit(1).exec();
        // console.log(userFound);
        if (!userFound) {
            return res.status(404).json({ message: "User Not Found" });
        }

        return res.status(200).json({
            success: true,
            balance: parseFloat(userFound[0].walletBalance).toFixed(2),
        });


    } catch (error) {
        res.status(500).send({
            success: false,
            message: "error fetch tickets"
        });
    }
}


async function receivables(req, res) {
    try {
        const { id } = req.query;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, error: "Invalid user ID" });
        }
        const query = {
            toUserId: new mongoose.Types.ObjectId(id),
            status: "pending",
            transactionType: "transfer"
        };



        const results = await UserTransaction.find(query).populate({
            path: "userId",
            select: "username firstName lastName role" // ✅ Corrected - Populate multiple fields properly
        })
            .lean(); // ✅ Improves performance by returning plain objects


        return res.status(200).json({ success: true, data: results });
    } catch (error) {
        console.error("Error fetching transferable data:", error);
        return res.status(500).json({ success: false, error: "Internal Server Error" });
    }
}

async function transferables(req, res) {
    try {
        const { id } = req.query;

        // Validate the user ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, error: "Invalid user ID" });
        }

        // Query to find transactions
        const query = {
            userId: new mongoose.Types.ObjectId(id),
            status: "pending",
            transactionType: "transfer"
        };


        const results = await UserTransaction.find(query)
            .populate({
                path: "toUserId",
                select: "username firstName lastName role",
            })
            .lean(); // ✅ Improves performance by returning plain objects

        return res.status(200).json({ success: true, data: results });
    } catch (error) {
        console.error("Error fetching transferable data:", error.message);
        return res.status(500).json({ success: false, error: "Internal Server Error" });
    }
}

async function receive(req, res) {
    try {
        const { id, receiveData } = req.body;

        // Find user's wallet balance
        const findWallet = await User.findById(id).exec();
        if (!findWallet) {
            return res.status(404).json({ success: false, error: "User not found" });
        }

        let mainWalletBalance = findWallet.walletBalance;
        let sum = 0;

        // Use for...of to handle async properly
        for (const object of receiveData) {
            const findTransaction = await UserTransaction.findOne({
                _id: object, // Ensure `object` contains a valid MongoDB ObjectId
                status: "pending"
            }).exec();


            if (findTransaction) {
                sum += parseFloat(findTransaction.amount, 2);

                // Update transaction status
                await UserTransaction.updateOne(
                    { _id: object },
                    { $set: { status: "completed" } }
                );
            }
        }

        // Update user's wallet balance
        const newBalance = mainWalletBalance + sum;
        const updatedData = await User.updateOne(
            { _id: id },
            { $set: { walletBalance: newBalance } }
        );

        return res.status(200).json({ success: true, data: updatedData });
    } catch (error) {
        console.error("Error processing receive request:", error);
        return res.status(500).json({ success: false, error: "Internal Server Error" });
    }
}

async function transfer(req, res) {
    try {
        const { id, amount, pin, password, receiver_id } = req.body;

        // Find sender wallet

        const findWallet = await User.findById(id).exec();
        if (!findWallet) {
            return res.status(404).json({ success: false, error: "User not found" });
        }

        // Find receiver wallet
        const receiverWallet = await User.findOne({ username: receiver_id }).exec();
        if (!receiverWallet) {
            return res.status(404).json({ success: false, error: "Receiver not found" });
        }

        if (Number(pin) !== Number(findWallet.pin)) {
            return res.status(404).json({ success: false, error: "Pin not matched?" });
        }


        if (findWallet._id.toString() === receiverWallet._id.toString()) {
            return res.status(400).json({ success: false, error: "Sender and receiver cannot be the same user." });
        }



        // Check balance
        if (findWallet.role !== "admin") {
            if (!findWallet.walletBalance || findWallet.walletBalance < amount) {
                return res.status(400).json({ success: false, error: "Insufficient balance" });
            }
        }


        // Deduct from sender
        let mainWalletBalance = findWallet.walletBalance - amount;
        await User.findByIdAndUpdate(id, { walletBalance: mainWalletBalance });

        // Add to receiver
        // let oldplusnewbalance = receiverWallet.walletBalance + amount;
        // await User.findByIdAndUpdate(receiverWallet._id, { walletBalance: oldplusnewbalance });

        // Save transaction
        const transaction = new UserTransaction({
            userId: findWallet._id,
            toUserId: receiverWallet._id,
            amount: amount,
            transactionType: "transfer",
            status: "pending",
            transactionMessage:
                `superareamanager ${findWallet.username} adjusted ${amount} transfer to ${receiverWallet.username} pending`,
        });
        await transaction.save();

        return res.status(200).json({ success: true, data: transaction });

    } catch (error) {
        console.error("Error processing transfer request:", error);
        return res.status(500).json({ success: false, error: "Internal Server Error" });
    }
}

async function reject(req, res) {
    try {
        const { id, receiveData } = req.body;

        if (!receiveData || receiveData.length === 0) {
            return res.status(400).json({ success: false, error: "No transactions to reject" });
        }

        let updatedUsers = []; // Store updated user balances

        // Use `Promise.all()` for parallel execution
        await Promise.all(receiveData.map(async (object) => {
            const findTransaction = await UserTransaction.findOne({
                _id: object,
                status: "pending"
            }).exec();

            if (findTransaction) {
                const { userId, toUserId, amount } = findTransaction;

                const findWallet = await User.findById(userId).exec();
                if (!findWallet) {
                    console.warn(`Wallet not found for user ID: ${toUserId}`);
                    return;
                }

                let mainWalletBalance = findWallet.walletBalance;
                const parsedAmount = parseFloat(amount);

                // Update transaction status to "rejected"
                await UserTransaction.updateOne(
                    { _id: object },
                    { $set: { status: "rejected" } }
                );

                // Update receiver's wallet balance
                const newBalance = mainWalletBalance + parsedAmount;
                const updatedData = await User.updateOne(
                    { _id: userId },
                    { $set: { walletBalance: newBalance } }
                );

                updatedUsers.push(updatedData);
            }
        }));

        return res.status(200).json({ success: true, data: updatedUsers });
    } catch (error) {
        console.error("Error processing reject request:", error);
        return res.status(500).json({ success: false, error: "Internal Server Error" });
    }
}


async function cancel(req, res) {
    try {
        const { id, transferData } = req.body;


        const findWallet = await User.findById(id).exec();
        if (!findWallet) {
            return res.status(404).json({ success: false, error: "User not found" });
        }

        let mainWalletBalance = findWallet.walletBalance;
        let sum = 0;


        if (!transferData || transferData.length === 0) {
            return res.status(400).json({ success: false, error: "No transactions to reject" });
        }

        let updatedUsers = []; // Store updated user balances

        for (const object of transferData) {
            const findTransaction = await UserTransaction.findOne({
                _id: object, // Ensure `object` contains a valid MongoDB ObjectId
                status: "pending"
            }).exec();


            if (findTransaction) {
                sum += parseFloat(findTransaction.amount, 2);

                // Update transaction status
                await UserTransaction.updateOne(
                    { _id: object },
                    { $set: { status: "cancelled" } }
                );
            }
        }

        const newBalance = mainWalletBalance + sum;
        const updatedData = await User.updateOne(
            { _id: id },
            { $set: { walletBalance: newBalance } }
        );


        return res.status(200).json({ success: true, data: updatedUsers });
    } catch (error) {
        console.error("Error processing reject request:", error);
        return res.status(500).json({ success: false, error: "Internal Server Error" });
    }
}




// async function win(req, res) {
//     try {
//         const { id, gameId } = req.query;

//         if (!id || !gameId) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Missing required query parameters: id and gameId"
//             });
//         }

//         // Fetch UserBalance for user and gameId
//         const userBalance = await UserBalance.findOne({
//             userId: new mongoose.Types.ObjectId(id),
//             gameId: gameId
//         }).exec();

//         if (!userBalance) {
//             return res.status(404).json({
//                 success: false,
//                 message: "User balance not found for the specified game"
//             });
//         }

//       const winBalance = parseFloat(userBalance.winBalance,2).toFixed(2) || 0;
 
//         return res.status(200).json({
//             success: true,
//             winamount: winBalance
//         });

//     } catch (error) {
//         console.error("Error fetching win amount:", error);
//         return res.status(500).json({
//             success: false,
//             message: "Error fetching win amount",
//             error: error.message
//         });
//     }
// }


// async function take(req, res) {
//     try {
//         const { id, gameId } = req.body;
//         const userObjectId = new mongoose.Types.ObjectId(id);
//         // Find user
//         const userFound = await User.findOne({ _id: userObjectId }).exec();

//         if (!userFound) {
//             return res.status(404).json({ message: "User Not Found" });
//         }

//         // Get balances safely
//         const walletBalance = Number(userFound.walletBalance) || 0;

//         const userBalance = await UserBalance.findOne({ userId: userObjectId, gameId: gameId }).exec();
//         const winBalance = userBalance ? Number(userBalance.winBalance) || 0 : 0;

//         const newBalance = walletBalance + winBalance;

//         // Update user's wallet balance
//         await User.updateOne(
//             { _id: userObjectId },
//             { $set: { walletBalance: newBalance } }
//         );

//         // Reset winBalance for this game
//         await UserBalance.updateOne(
//             { userId: userObjectId, gameId: gameId },
//             { $set: { winBalance: 0 } }
//         );

//         res.status(200).json({
//             success: true,
//             message: "Balance updated successfully",
//             updatedBalance: newBalance
//         });

//     } catch (error) {
//         console.error("Error in take function:", error);
//         res.status(500).json({
//             success: false,
//             message: "Error updating balance",
//             error: error.message
//         });
//     }
// }



async function win(req, res) {
    try {
        const { id, gameId } = req.query;

        if (!id || !gameId) {
            return res.status(400).json({
                success: false,
                message: "Missing required query parameters: id and gameId"
            });
        }

        const userObjectId = new mongoose.Types.ObjectId(id);

        const userBalance = await UserBalance.findOne({
            userId: userObjectId,
            gameId: gameId
        }).exec();

        if (!userBalance) {
            return res.status(404).json({
                success: false,
                message: "User balance not found for the specified game"
            });
        }

        const rawWinBalance = userBalance.winBalance || 0;
        const winBalance = parseFloat(parseFloat(rawWinBalance).toFixed(2));

      
            // Update all matching draws
            // await Draw.updateMany(
            //   { gameid: gameId, userid: userObjectId },
            //   { $set: { betok: winBalance <= 0 } }

            // );
            
            
             const data = await Result.find({ gameid: gameId, status: 1 })
                .sort({ _id: -1 }) // Sort by newest first
                .limit(1)
                .lean() // Convert Mongoose docs to plain JS objects (better performance)
                .exec();
        return res.status(200).json({
            success: true,
            winamount: winBalance,
            resultData:data
        });

    } catch (error) {
        console.error("Error fetching win amount:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching win amount",
            error: error.message
        });
    }
}


async function take(req, res) {
    try {
        const { id, gameId } = req.body;
        const userObjectId = new mongoose.Types.ObjectId(id);
        // Find user
        const userFound = await User.findOne({ _id: userObjectId }).exec();

        if (!userFound) {
            return res.status(404).json({ message: "User Not Found" });
        }

        // Get balances safely
        const walletBalance = Number(userFound.walletBalance) || 0;

        const userBalance = await UserBalance.findOne({ userId: userObjectId, gameId: gameId }).exec();
        const winBalance = userBalance ? Number(userBalance.winBalance) || 0 : 0;
        
        const newBalance = walletBalance + winBalance;

        // Update user's wallet balance
        await User.updateOne(
            { _id: userObjectId },
            { $set: { walletBalance: newBalance } }
        );

        await Draw.updateMany(
            { gameid: gameId, userid: userObjectId },
            { $set: { betok: true } }
          );


        // Reset winBalance for this game
        await UserBalance.updateOne(
            { userId: userObjectId, gameId: gameId },
            { $set: { winBalance: 0 } }
        );

        res.status(200).json({
            success: true,
            message: "Balance updated successfully",
            updatedBalance: newBalance
        });

    } catch (error) {
        console.error("Error in take function:", error);
        res.status(500).json({
            success: false,
            message: "Error updating balance",
            error: error.message
        });
    }
}



// async function lastresults(req, res) {
//     try {
//         const { adminId, gameId } = req.query;

//         // Validate gameId (ensure it's provided)
//         if (!gameId || !adminId) {
//             return res.status(400).send({
//                 success: false,
//                 message: "gameId and adminId is required"
//             });
//         }

//         // Fetch last 12 results, sorted in DESC order
//         const rawData = await Result.find({ gameid: gameId, adminid: adminId, status: 1 })
//             .sort({ _id: -1 }) // Sort by newest first
//             .limit(10)
//             .lean() // Convert Mongoose docs to plain JS objects (better performance)
//             .exec();
            
            
            
//               const ascendingData = rawData.map((result) => {
//             // If booster is 2, set random to 0, otherwise use result.randomValues
//                 const random = result.booster === 2 ? 0 : result.randomValues;
//                 return {
//                     drawno: result.drawno,
//                     color: result.color,
//                     joker: result.joker,
//                     type: result.type,
//                     booster: result.booster,
//                     randomvalue:random
//                 };
//         });
        

//         const data = ascendingData.reverse(); // Oldest to newest among the last 10
        
        
       
        

//         res.status(200).send({
//             success: true,
//             data
//         });
//     } catch (error) {
//         console.error("Error fetching last results:", error);
//         res.status(500).send({
//             success: false,
//             message: "Internal Server Error"
//         });
//     }
// }


async function lastresults(req, res) {
    try {
        const { adminId, gameId } = req.query;

        // Validate gameId and adminId
        if (!gameId || !adminId) {
            return res.status(400).send({
                success: false,
                message: "gameId and adminId are required"
            });
        }

        // Fetch last 10 results in descending order (newest first)
        const rawData = await Result.find({ gameid: gameId, adminid: adminId, status: 1 })
            .sort({ _id: -1 })
            .limit(10)
            .lean()
            .exec();

        // Process results
        const processedResults = rawData.map((result) => {
            const random = result.booster === 2 ? 0 : result.randomValues;
            return {
                drawno: result.drawno,
                color: result.color,
                joker: result.joker,
                type: result.type,
                booster: result.booster,
                randomvalue: random
            };
        });

        // Reverse to get oldest to newest among the last 10
        const data = processedResults.reverse();

        res.status(200).send({
            success: true,
            data
        });
    } catch (error) {
        console.error("Error fetching last results:", error);
        res.status(500).send({
            success: false,
            message: "Internal Server Error"
        });
    }
}




async function winresult(req, res) {
    try {
        const { adminId, gameId } = req.query;

        // Validate gameId and adminId
        if (!gameId || !adminId) {
            return res.status(400).send({
                success: false,
                message: "gameId and adminId are required"
            });
        }

        // Fetch the latest result
        const rawData = await Result.find({ gameid: gameId, adminid: adminId, status: 1 })
            .sort({ _id: -1 })
            .limit(1)
            .lean()
            .exec();

        const data = rawData.map((result) => {
            // If booster is 2, set random to 0, otherwise use result.randomValues
            const random = result.booster === 2 ? 0 : result.randomValues;
            return {
                drawno: result.drawno,
                color: result.color,
                joker: result.joker,
                type: result.type,
                booster: result.booster,
                randomvalue:random
            };
        });

        // Generate random wheelData
        const values = [5, 10, 15];
        const wheelData = values[Math.floor(Math.random() * values.length)];

        res.status(200).send({
            success: true,
            data,
            wheelData,
        });
    } catch (error) {
        console.error("Error fetching last results:", error);
        res.status(500).send({
            success: false,
            message: "Internal Server Error"
        });
    }
}


async function lastfiveresult(req, res) {
    try {
        const { adminId, gameId } = req.query;

        // Validate gameId (ensure it's provided)
        if (!gameId || !adminId) {
            return res.status(400).send({
                success: false,
                message: "gameId and adminId is required"
            });
        }

        // Fetch last 12 results, sorted in DESC order
        const ascendingData = await Result.find({ gameid: gameId, adminid: adminId, status: 1 })
            .sort({ _id: -1 }) // Sort by newest first
            .limit(5)
            .lean() // Convert Mongoose docs to plain JS objects (better performance)
            .exec();
        // const data = ascendingData;
        const data = ascendingData.reverse(); // Oldest to newest among the last 10
        res.status(200).send({
            success: true,
            data
        });
    } catch (error) {
        console.error("Error fetching last results:", error);
        res.status(500).send({
            success: false,
            message: "Internal Server Error"
        });
    }
}




// async function getBetData(req, res) {
//     try {
//         const { gameId, userId } = req.query;


//         // Validation
//         if (!gameId || !userId) {
//             return res.status(400).send({
//                 message: false,
//                 error: 'Missing gameId or userId'
//             });
//         }

//         const userObjectId = new mongoose.Types.ObjectId(userId);

//         const userBalance = await UserBalance.findOne({
//             userId: userObjectId,
//             gameId: gameId
//         }).exec();

//         if (!userBalance) {
//             return res.status(404).json({
//                 success: false,
//                 message: "User balance not found for the specified game"
//             });
//         }

//         const rawWinBalance = userBalance.winBalance || 0;
//         const winBalance = parseFloat(parseFloat(rawWinBalance).toFixed(2));

//         let data;
//         if (winBalance <= 0) {

//             data = await Draw.aggregate([
//                 {
//                     $match: {
//                         userid: new mongoose.Types.ObjectId(userId),
//                         gameid: gameId,
//                         status: 0
//                     }
//                 },
//                 // First join: Draw ➡️ Ticket
//                 {
//                     $lookup: {
//                         from: "tickets",
//                         localField: "ticketid",
//                         foreignField: "ticketid",
//                         as: "ticketData"
//                     }
//                 },
//                 {
//                     $unwind: {
//                         path: "$ticketData",
//                         preserveNullAndEmptyArrays: true
//                     }
//                 },
//                 // Second join: Ticket ➡️ Result
//                 {
//                     $lookup: {
//                         from: "results",            // your result collection
//                         localField: "ticketData.result", // ticketData.result is ObjectId
//                         foreignField: "_id",
//                         as: "resultData"
//                     }
//                 },
//                 {
//                     $unwind: {
//                         path: "$resultData",
//                         preserveNullAndEmptyArrays: true
//                     }
//                 },
//                 {
//                     $group: {
//                         _id: { $toString: "$drawno" },  // Group by drawno from Draw
//                         label: { $first: { $toString: "$label" } },
//                         sumDrawQty: { $sum: "$drawqty" },
//                         resultDrawno: { $first: "$resultData.drawno" }, // <-- This is from result table
//                         resultBooster: { $first: "$resultData.booster" } // optional: booster from result
//                     }
//                 }
//             ]);



//         } else {
//             data = await Draw.aggregate([
//                 {
//                     $match: {
//                         userid: new mongoose.Types.ObjectId(userId),
//                         gameid: gameId,
//                         betok: false
//                     }
//                 },
//                 // First join: Draw ➡️ Ticket
//                 {
//                     $lookup: {
//                         from: "tickets",
//                         localField: "ticketid",
//                         foreignField: "ticketid",
//                         as: "ticketData"
//                     }
//                 },
//                 {
//                     $unwind: {
//                         path: "$ticketData",
//                         preserveNullAndEmptyArrays: true
//                     }
//                 },
//                 // Second join: Ticket ➡️ Result
//                 {
//                     $lookup: {
//                         from: "results",            // your result collection
//                         localField: "ticketData.result", // ticketData.result is ObjectId
//                         foreignField: "_id",
//                         as: "resultData"
//                     }
//                 },
//                 {
//                     $unwind: {
//                         path: "$resultData",
//                         preserveNullAndEmptyArrays: true
//                     }
//                 },
//                 {
//                     $group: {
//                         _id: { $toString: "$drawno" },  // Group by drawno from Draw
//                         label: { $first: { $toString: "$label" } },
//                         sumDrawQty: { $sum: "$drawqty" },
//                         resultDrawno: { $first: "$resultData.drawno" }, // <-- This is from result table
//                         resultBooster: { $first: "$resultData.booster" } // optional: booster from result
//                     }
//                 }
//             ]);
            
//         }



//         return res.status(200).send({
//             message: true,
//             data
//         });

//     } catch (error) {
//         console.error('Error in getBetData:', error);
//         return res.status(500).send({
//             message: false,
//             error: 'Internal Server Error'
//         });
//     }
// }


async function getBetData(req, res) {
    try {
        const { gameId, userId } = req.query;

        // Validation
        if (!gameId || !userId) {
            return res.status(400).send({
                message: false,
                error: 'Missing gameId or userId'
            });
        }

        const userObjectId = new mongoose.Types.ObjectId(userId);

        const userBalance = await UserBalance.findOne({
            userId: userObjectId,
            gameId: gameId
        }).exec();

        if (!userBalance) {
            return res.status(404).json({
                success: false,
                message: "User balance not found for the specified game"
            });
        }

        const rawWinBalance = userBalance.winBalance || 0;
        const winBalance = parseFloat(parseFloat(rawWinBalance).toFixed(2));

        let data;
        const matchCondition = winBalance <= 0
            ? { userid: userObjectId, gameid: gameId, status: 0 }
            : { userid: userObjectId, gameid: gameId, betok: false };

        data = await Draw.aggregate([
            { $match: matchCondition },

            // Join with Ticket collection
            {
                $lookup: {
                    from: "tickets",
                    localField: "ticketid",
                    foreignField: "ticketid",
                    as: "ticketData"
                }
            },
            {
                $unwind: {
                    path: "$ticketData",
                    preserveNullAndEmptyArrays: true
                }
            },

            // Join with Result collection
            {
                $lookup: {
                    from: "results",
                    localField: "ticketData.result",
                    foreignField: "_id",
                    as: "resultData"
                }
            },
            {
                $unwind: {
                    path: "$resultData",
                    preserveNullAndEmptyArrays: true
                }
            },

            // Group by drawno
            {
                $group: {
                    _id: { $toString: "$drawno" },
                    label: { $first: { $toString: "$label" } },
                    sumDrawQty: { $sum: "$drawqty" },
                    resultDrawno: { $first: "$resultData.drawno" },
                    resultBooster: { $first: "$resultData.booster" }
                }
            }
        ]);

        // 🔍 If gameId is "vwRORrGO", group data by label
        if (gameId === "vwRORrGO") {
            const groupedData = {};
            for (const item of data) {
                const label = item.label || "Unknown";
                if (!groupedData[label]) {
                    groupedData[label] = [];
                }
                groupedData[label].push(item);
            }
            data = groupedData; // Grouped result
        }

        return res.status(200).send({
            message: true,
            data
        });

    } catch (error) {
        console.error('Error in getBetData:', error);
        return res.status(500).send({
            message: false,
            error: 'Internal Server Error'
        });
    }
}


async function logout(req, res) {
    try {
        const { id } = req.query;

        // Check if user exists
        const userFound = await User.findOne({ _id: id }).exec();

        if (!userFound) {
            return res.status(404).json({ message: "User Not Found" });
        }

        // Update isLoggedIn to false
        const result = await User.updateOne(
            { _id: id },
            { $set: { isLoggedIn: false } }
        );

        return res.status(200).json({
            success: true,
            message: "Logout Successfully",
            data: result
        });

    } catch (error) {
        console.error("Error during logout:", error);
        res.status(500).json({
            success: false,
            message: "Error during logout",
            error: error.message
        });
    }
}


async function getsocketid(req, res) {
    try {
        const { id } = req.query;

        if (!id) {
            return res.status(400).send({
                message: false,
                error: "User ID is required"
            });
        }

        const data = await User.findById(id).select("socketId").exec();

        if (!data) {
            return res.status(404).send({
                message: false,
                error: "User not found"
            });
        }

        res.status(200).send({
            message: true,
            data
        });
    } catch (error) {
        console.error("Error in getsocketid:", error);
        res.status(500).send({
            message: false,
            error: "Internal Server Error"
        });
    }
}


async function checkdeviceid(req, res) {
    try {
        const { userId } = req.query; // Destructure userId from the query parameters

        // Fetch user data by userId
        const data = await User.findById(userId);

        if (!data) {
            // Handle case where user is not found
            return res.status(404).send({
                status: false,
                message: "User not found"
            });
        }

        // Send success response with the deviceId
        res.status(200).send({
            status: true,
            message: "OK",
            deviceId: data.deviceId
        });
    } catch (error) {
        // Handle unexpected errors
        console.error("Error fetching deviceId:", error);
        res.status(500).send({
            status: false,
            message: "Internal server error"
        });
    }
}


async function checkwheel(req, res) {
    try {
        const { adminId, gameId } = req.query;

        // Validate gameId and adminId
        if (!gameId || !adminId) {
            return res.status(400).send({
                success: false,
                message: "gameId and adminId are required"
            });
        }

        // Fetch the latest result
        const rawData = await Result.find({ gameid: gameId, adminid: adminId, status: 1 })
            .sort({ _id: -1 })
            .limit(1)
            .lean()
            .exec();

        if (!rawData || rawData.length === 0) {
            return res.status(404).send({
                success: false,
                message: "No result found"
            });
        }

        const result = rawData[0];
        const random = result.booster === 2 ? 0 : result.randomValues;

        // You can add wheelData generation logic here if needed

        res.status(200).send({
            success: true,
            random
        });

    } catch (error) {
        console.error("Error fetching wheelData:", error);
        res.status(500).send({
            success: false,
            message: "Internal Server Error in wheelData"
        });
    }
}





module.exports = {
    login,
    logout,
    timer,
    createbet,
    fetchtickets,
    getBalance,
    receivables,
    transferables,
    transferables,
    receive,
    transfer,
    reject,
    cancel,
    winresult,
    lastresults,
    win,
    take,
    lastfiveresult,
    getBetData,
    getsocketid,
    checkdeviceid,
    checkwheel
};

