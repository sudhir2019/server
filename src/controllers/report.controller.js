const { default: mongoose, mongo } = require("mongoose");
const { User } = require("../models/user.model");
const { Ticket } = require("../models/ticket.model");
const UserTransaction = require("../models/userTransaction.model");
const { Percentage } = require("../models/percentage.model");
const Game = require("../models/game.model");

const findallusersbyrole = async (req, res) => {
    const { role, id } = req.query;
    try {
        const data = await getAllusersByroleWise(role, id);

        res.status(200).send({
            data: data
        });
    } catch (error) {
        res.status(500).send({
            message: "error",
            data: error
        });
    }
}
const transactionreport = async (req, res) => {
    const { status, id, date, type, currentid, role } = req.query;

    // Validate and convert the date to a JavaScript Date object
    let dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
        // If the date is invalid, return an error
        return res.status(400).send({
            success: false,
            message: 'Invalid date format'
        });
    }

    try {
        // Build the query object
      
        const allData = await getAllusersByroleWise(role, currentid);

        let query = {}; // Initialize an empty query object

        if (type === "all") {
            if (allData && Array.isArray(allData)) {
                // For all data, create an array of userIds
                const userIds = allData.map(obj => new mongoose.Types.ObjectId(obj._id));

                // Update the query with the $in operator to find multiple userIds
                query.userId = { $in: userIds };
            }
        } else {
            // If type is not "all", query for a single userId
            query.userId = new mongoose.Types.ObjectId(id);
        }

        // console.log(query);




        //   // Optionally add status to the query if provided
        //   if (status) {
        //     query.status = status; // Assuming `status` is a field in your transactions
        //   }

        // Optionally add the date filter to the query if provided
        // if (dateObj) {
        //     // Assuming you want to filter by the transaction date, and the transactions are stored as Date objects
        //     query.createdAt = { $gte: dateObj }; // Filter transactions from the given date onwards
        // }
        // console.log(dateObj);
        // Perform the query

        if (dateObj) {
            // Assuming you want to filter transactions created on the exact given date.
            // You need to adjust the time to the start of the day and the end of the day for comparison.
            
            // Start of the day: 00:00:00
            const startOfDay = new Date(dateObj.setHours(0, 0, 0, 0));
            
            // End of the day: 23:59:59
            const endOfDay = new Date(dateObj.setHours(23, 59, 59, 999));
            
            // Filter transactions between the start and end of the day
            query.createdAt = { 
                $gte: startOfDay,  // Greater than or equal to the start of the day
                $lte: endOfDay    // Less than or equal to the end of the day
            };
        }
        

console.log(query);
        const data = await UserTransaction.find(query)
            .populate('userId') // Populate 'userId' reference
            .populate('toUserId', 'username walletBalance') // Populate 'toUserId' reference
            .exec();


        res.status(200).send({
            success: true,
            data: data
        });
    } catch (error) {
        console.error(error);
        res.status(500).send({
            success: false,
            message: 'Error retrieving transactions'
        });
    }
};


const turnoverreport = async (req, res) => {
    // const role = "admin";
    // const id = "67c68e68d2ab14d29b7d2aa2";

    // const role = "superdistributor";
    // const id = "67c68e8ed2ab14d29b7d2ad6";


    // const role = "distributor";
    // const id = "67c68f02d2ab14d29b7d2b63";

    // const role = "retailer";
    // const id = "67c68f24d2ab14d29b7d2b78";

    const { startDate, endDate, role, id } = req.query;



    const fromdate = new Date(startDate);
    fromdate.setHours(0, 0, 0, 0); // Set to midnight
    const todate = new Date(endDate);
    todate.setHours(23, 59, 59, 999); // Set to just before midnight
    let data = [];


    // console.log(users);


    if (role === "superadmin") {
        let users = await User.find({ role: 'admin' }).exec();
        if (!users) {
            res.status(503).send({
                status: false,
                message: "Users not found?"
            });
        }
        await Promise.all(users.map(async (user, index) => {
            var playpoints = await GetPlayPoints(role, user.role, user._id, fromdate, todate);
            //  console.log(playpoints);
            var winpoints = await GetWinPoints(role, user.role, user._id, fromdate, todate);
            var endpoints = playpoints - winpoints;
            var supercom = playpoints * user.commission / 100;
            var distcom = await ascdistcommision(playpoints, user._id, user.role);
            var retailcom = await ascrtcommision(playpoints, user._id, user.role);
            var net = endpoints - supercom - distcom - retailcom;
            data.push({
                id: user._id,
                username: user.username,
                role: user.role,
                commission: user.commission,
                playPoints: playpoints,
                winPoints: winpoints,
                endPoints: endpoints,
                supercom: supercom,
                distcom: distcom,
                retailcom: retailcom,
                net: net
            });
        }));

    }



    if (role === "admin") {
        let users = await User.find({ 'refId': new mongoose.Types.ObjectId(id) }).exec();
        if (!users) {
            res.status(503).send({
                status: false,
                message: "Users not found?"
            });
        }
        await Promise.all(users.map(async (user, index) => {
            var playpoints = await GetPlayPoints(role, user.role, user._id, fromdate, todate);
            //  console.log(playpoints);
            var winpoints = await GetWinPoints(role, user.role, user._id, fromdate, todate);
            var endpoints = playpoints - winpoints;
            var supercom = playpoints * user.commission / 100;
            var distcom = await ascdistcommision(playpoints, user._id, user.role);
            var retailcom = await ascrtcommision(playpoints, user._id, user.role);
            var net = endpoints - supercom - distcom - retailcom;
            data.push({
                id: user._id,
                username: user.username,
                role: user.role,
                commission: user.commission,
                playPoints: playpoints,
                winPoints: winpoints,
                endPoints: endpoints,
                supercom: supercom,
                distcom: distcom,
                retailcom: retailcom,
                net: net
            });
        }));

    }


    if (role === "superareamanager") {
        // console.log(id);

        const users = await User.find({ 'refId': id }).exec();
        if (!users) {
            res.status(503).send({
                status: false,
                message: "Users not found?"
            });
        }
        await Promise.all(users.map(async (user, index) => {


            //   console.log(user);
            var playpoints = await GetPlayPoints(role, user.role, user._id, fromdate, todate);

            var winpoints = await GetWinPoints(role, user.role, user._id, fromdate, todate);
            var endpoints = playpoints - winpoints;
            var supercom = await descsupercom(playpoints, user.refId, user.role);
            var distcom = (parseFloat(playpoints) * parseFloat(user.commission)) / 100;
            var roundedDistcom = distcom.toFixed(2);  // Rounds to 2 decimal places
            var retailcom = await ascdistcommision(playpoints, user._id, user.role);
            var net = endpoints - supercom - distcom - retailcom;
            data.push({
                id: user._id,
                username: user.username,
                role: user.role,
                commission: user.commission,
                playPoints: playpoints,
                winPoints: winpoints,
                endPoints: endpoints,
                supercom: supercom,
                distcom: roundedDistcom,
                retailcom: retailcom,
                net: net
            });
        }));

    }

    if (role === "areamanager") {

        const users = await User.find({ 'refId': id }).exec();
        if (!users) {
            res.status(503).send({
                status: false,
                message: "Users not found?"
            });
        }
        await Promise.all(users.map(async (user, index) => {


            //   console.log(user);
            var playpoints = await GetPlayPoints(role, user.role, user._id, fromdate, todate);

            var winpoints = await GetWinPoints(role, user.role, user._id, fromdate, todate);
            var endpoints = playpoints - winpoints;
            var supercom = await descsupercom2(playpoints, user.refId, user.role);
            var distcom = await descdistcom2(playpoints, user.refId, user.role);
            var retailcom = (parseFloat(playpoints) * parseFloat(user.commission)) / 100;
            var net = endpoints - supercom - distcom - retailcom;
            data.push({
                id: user._id,
                username: user.username,
                role: user.role,
                commission: user.commission,
                playPoints: playpoints,
                winPoints: winpoints,
                endPoints: endpoints,
                supercom: supercom,
                distcom: distcom,
                retailcom: retailcom,
                net: net
            });
        }));
    }


    if (role === "master") {

        let users = await User.find({ 'refId': id }).exec();
        if (!users) {
            res.status(503).send({
                status: false,
                message: "Users not found?"
            });
        }
        await Promise.all(users.map(async (user, index) => {


            //   console.log(user);
            var playpoints = await GetPlayPointsByUser(user._id, fromdate, todate);

            var winpoints = await GetWinPointsByUser(user._id, fromdate, todate);
            var endpoints = playpoints - winpoints;
            var supercom = await descsupercom3(playpoints, user.refId, user.role);
            var distcom = await descsupercom2(playpoints, user.refId, user.role);
            var retailcom = await descdistcom2(playpoints, user.refId, user.role);
            var net = endpoints - supercom - distcom - retailcom;
            data.push({
                id: user._id,
                username: user.username,
                role: user.role,
                commission: user.commission,
                playPoints: playpoints,
                winPoints: winpoints,
                endPoints: endpoints,
                supercom: supercom,
                distcom: distcom,
                retailcom: retailcom,
                net: net
            });
        }));
    }

    res.status(200).send({
        status: true,
        role: role,
        data: data
    });



}


async function GetPlayPoints(role, userole, id, fromdate, todate) {
    let playedData = 0;

    const allUsers = await getUsersRoleWise(userole, id);

    // console.log(allUsers);

    // Use a for...of loop to wait for the async operations to complete
    for (const user of allUsers) {
        const result = await getData(fromdate, todate, user._id);
        playedData += parseFloat(result.playData, 10); // Fixing the parseFloat to use base 10
    }

    return playedData;
}
async function GetPlayPointsByUser(id, fromdate, todate) {
    let playedData = 0;

    const result = await getData(fromdate, todate, id);
    playedData += parseFloat(result.playData, 10); // Fixing the parseFloat to use base 10


    return playedData;
}


async function GetWinPoints(role, userole, id, fromdate, todate) {
    let winData = 0;

    const allUsers = await getUsersRoleWise(userole, id);

    // Use a for...of loop to wait for the async operations to complete
    for (const user of allUsers) {
        const result = await getData(fromdate, todate, user._id);
        winData += parseFloat(result.winData, 10); // Fixing the parseFloat to use base 10
    }

    return winData;
}



async function GetWinPointsByUser(id, fromdate, todate) {
    let winData = 0;


    const result = await getData(fromdate, todate, id);
    winData += parseFloat(result.winData, 10); // Fixing the parseFloat to use base 10


    return winData;
}

async function ascdistcommision(playpoints, id, role) {
    var com = 0;
    // console.log(id);
    let users = await User.find({ 'refId': new mongoose.Types.ObjectId(id) }).exec();
    // console.log(users);
    for (const user of users) {
        com += parseFloat(playpoints * user.commission / 100, 10);
    }
    return com;
}

async function ascrtcommision(playpoints, id, role) {
    let com = 0;

    // Find the distributors
    let users = await User.find({ 'refId': new mongoose.Types.ObjectId(id) }).exec();

    for (const user of users) {
        // console.log(user);
        // Await the retailers' data for the current distributor
        let retailers = await User.find({ 'refId': new mongoose.Types.ObjectId(user._id) }).exec();


        // Loop through the retailers and calculate the commission
        for (const rt of retailers) {
            com += parseFloat(playpoints * rt.commission / 100, 10);
        }
    }

    return com;
}



async function descsupercom(playpoints, id, role) {
    var com = 0;
    // console.log(id);
    let users = await User.findById({ _id: new mongoose.Types.ObjectId(id) }).exec();
    // console.log(users);
    // for (const user of users) {
    com = parseFloat(playpoints * users.commission / 100, 10);
    // }
    return com;
}

async function descsupercom2(playpoints, id, role) {
    var com = 0;

    // Find the distributor by ID
    let dist = await User.findById(new mongoose.Types.ObjectId(id)).exec();

    // Find all super users (users whose 'refId' matches the distributor's _id)
    let supers = await User.findById({ _id: dist.refId }).exec();

    // console.log(supers);
    com = parseFloat(playpoints * supers.commission / 100);


    return com;
}

async function descsupercom3(playpoints, id, role) {
    var com = 0;
    // console.log(id);
    // Find the distributor by ID
    let rtt = await User.findById({ _id: new mongoose.Types.ObjectId(id) }).exec();

    // console.log(rtt.refId);

    let dist = await User.findById(new mongoose.Types.ObjectId(rtt.refId)).exec();

    // // Find all super users (users whose 'refId' matches the distributor's _id)
    let supers = await User.findById({ _id: dist.refId }).exec();

    // // console.log(supers);
    com = parseFloat(playpoints * supers.commission / 100);


    return com;
}
async function descdistcom2(playpoints, id, role) {
    var com = 0;

    // Find the distributor by ID
    let dist = await User.findById(new mongoose.Types.ObjectId(id)).exec();
    // console.log(dist);
    com = parseFloat(playpoints * dist.commission / 100);


    return com;
}

async function getData(fromdate, todate, id) {
    // Convert the string 'id' to a mongoose ObjectId
    const userId = new mongoose.Types.ObjectId(id);

    // Ensure 'fromdate' and 'todate' are valid Date objects
    const startDate = new Date(fromdate);
    const endDate = new Date(todate);

    // Validate dates
    if (isNaN(startDate) || isNaN(endDate)) {
        throw new Error('Invalid date format');
    }

    const result = await Ticket.aggregate([
        {
            $match: {
                // date: { $gte: startDate, $lte: endDate },
                userid: userId,
            },
        },
        {
            $group: {
                _id: userId,
                playpoints: { $sum: { $ifNull: ['$playpoints', 0] } },
                winpoints: { $sum: { $ifNull: ['$winpoints', 0] } },
            },
        },
    ]);
    // console.log(result);
    if (result.length > 0) {
        return {
            playData: result[0].playpoints || 0,
            winData: result[0].winpoints || 0,
        };
    } else {
        return { playData: 0, winData: 0 };
    }
}


async function getUsersRoleWise(role, id) {

    try {
        let superadminsData = [];
        let adminsData = [];
        let superdistributorsData = [];
        let distributorsData = [];
        let retailersData = [];
        let usersData = [];

        // Handle superadmin case: Fetch everything under the superadmin
        if (role === "superadmin") {
            // Fetch all admins for the superadmin
            let admins = await User.find({ role: "admin" }).exec();
            adminsData.push(...admins);
            // console.log(admins);

            for (let admin of admins) {
                // For each admin, fetch superdistributors
                let superdistributors = await User.find({ role: "superareamanager", refId: admin._id }).exec();
                superdistributorsData.push(...superdistributors);

                for (let superdistributor of superdistributors) {
                    // For each superdistributor, fetch distributors
                    let distributors = await User.find({ role: "areamanager", refId: superdistributor._id }).exec();
                    distributorsData.push(...distributors);

                    for (let distributor of distributors) {
                        // For each distributor, fetch retailers
                        let retailers = await User.find({ role: "master", refId: distributor._id }).exec();
                        retailersData.push(...retailers);

                        for (let retailer of retailers) {
                            // For each retailer, fetch users
                            let users = await User.find({ role: "player", refId: retailer._id }).exec();
                            usersData.push(...users);
                        }
                    }
                }
            }

        } else if (role === "admin") {
            // Fetch admins (this is where you start for admin role)
            let admins = await User.find({ role: "admin", _id: new mongoose.Types.ObjectId(id) }).exec();
            adminsData.push(...admins);



            for (let admin of admins) {
                // Fetch superdistributors under each admin
                let superdistributors = await User.find({ role: "superareamanager", refId: admin._id }).exec();
                superdistributorsData.push(...superdistributors);

                for (let superdistributor of superdistributors) {
                    // Fetch distributors under each superdistributor
                    let distributors = await User.find({ role: "areamanager", refId: superdistributor._id }).exec();
                    distributorsData.push(...distributors);

                    for (let distributor of distributors) {
                        // Fetch retailers under each distributor
                        let retailers = await User.find({ role: "master", refId: distributor._id }).exec();
                        retailersData.push(...retailers);

                        for (let retailer of retailers) {
                            // Fetch users under each retailer
                            let users = await User.find({ role: "player", refId: retailer._id }).exec();
                            usersData.push(...users);
                        }
                    }
                }
            }

        } else if (role === "superareamanager") {
            // Start from superdistributor if the role is superdistributor
            let superdistributors = await User.find({ role: "superareamanager", _id: new mongoose.Types.ObjectId(id) }).exec();
            superdistributorsData.push(...superdistributors);

            for (let superdistributor of superdistributors) {
                let distributors = await User.find({ role: "areamanager", refId: superdistributor._id }).exec();
                distributorsData.push(...distributors);

                for (let distributor of distributors) {
                    let retailers = await User.find({ role: "master", refId: distributor._id }).exec();
                    retailersData.push(...retailers);

                    for (let retailer of retailers) {
                        let users = await User.find({ role: "player", refId: retailer._id }).exec();
                        usersData.push(...users);
                    }
                }
            }

        } else if (role === "areamanager") {
            // Start from distributor if the role is distributor
            let distributors = await User.find({ role: "areamanager", _id: new mongoose.Types.ObjectId(id) }).exec();
            distributorsData.push(...distributors);

            for (let distributor of distributors) {
                let retailers = await User.find({ role: "master", refId: distributor._id }).exec();
                retailersData.push(...retailers);

                for (let retailer of retailers) {
                    let users = await User.find({ role: "player", refId: retailer._id }).exec();
                    usersData.push(...users);
                }
            }

        } else if (role === "master") {
            // Start from retailer if the role is retailer
            let retailers = await User.find({ role: "master", _id: new mongoose.Types.ObjectId(id) }).exec();
            retailersData.push(...retailers);

            for (let retailer of retailers) {
                let users = await User.find({ role: "player", refId: retailer._id }).exec();
                usersData.push(...users);
            }

        }


        // const allData = [
        //   ...superadminsData,
        //   ...adminsData,
        //   ...superdistributorsData,
        //   ...distributorsData,
        //   ...retailersData,
        //   ...usersData
        // ];

        // After fetching all data, log the single merged array
        // console.log("All Data:", usersData);
        return usersData;

    } catch (error) {
        console.error("Error in getUsersRoleWise:", error);
    }
}


async function getAllusersByroleWise(role, id) {

    try {
        let superadminsData = [];
        let adminsData = [];
        let superdistributorsData = [];
        let distributorsData = [];
        let retailersData = [];
        let usersData = [];

        // Handle superadmin case: Fetch everything under the superadmin
        if (role === "superadmin") {
            // Fetch all admins for the superadmin
            let admins = await User.find({ role: "admin" }).exec();
            adminsData.push(...admins);
            // console.log(admins);

            for (let admin of admins) {
                // For each admin, fetch superdistributors
                let superdistributors = await User.find({ role: "superareamanager", refId: admin._id }).exec();
                superdistributorsData.push(...superdistributors);

                for (let superdistributor of superdistributors) {
                    // For each superdistributor, fetch distributors
                    let distributors = await User.find({ role: "areamanager", refId: superdistributor._id }).exec();
                    distributorsData.push(...distributors);

                    for (let distributor of distributors) {
                        // For each distributor, fetch retailers
                        let retailers = await User.find({ role: "master", refId: distributor._id }).exec();
                        retailersData.push(...retailers);

                        for (let retailer of retailers) {
                            // For each retailer, fetch users
                            let users = await User.find({ role: "player", refId: retailer._id }).exec();
                            usersData.push(...users);
                        }
                    }
                }
            }

        } else if (role === "admin") {
            // Fetch admins (this is where you start for admin role)
            let admins = await User.find({ role: "admin", _id: new mongoose.Types.ObjectId(id) }).exec();
            adminsData.push(...admins);



            for (let admin of admins) {
                // Fetch superdistributors under each admin
                let superdistributors = await User.find({ role: "superareamanager", refId: admin._id }).exec();
                superdistributorsData.push(...superdistributors);

                for (let superdistributor of superdistributors) {
                    // Fetch distributors under each superdistributor
                    let distributors = await User.find({ role: "areamanager", refId: superdistributor._id }).exec();
                    distributorsData.push(...distributors);

                    for (let distributor of distributors) {
                        // Fetch retailers under each distributor
                        let retailers = await User.find({ role: "master", refId: distributor._id }).exec();
                        retailersData.push(...retailers);

                        for (let retailer of retailers) {
                            // Fetch users under each retailer
                            let users = await User.find({ role: "player", refId: retailer._id }).exec();
                            usersData.push(...users);
                        }
                    }
                }
            }

        } else if (role === "superareamanager") {
            // Start from superdistributor if the role is superdistributor
            let superdistributors = await User.find({ role: "superareamanager", _id: new mongoose.Types.ObjectId(id) }).exec();
            superdistributorsData.push(...superdistributors);

            for (let superdistributor of superdistributors) {
                let distributors = await User.find({ role: "areamanager", refId: superdistributor._id }).exec();
                distributorsData.push(...distributors);

                for (let distributor of distributors) {
                    let retailers = await User.find({ role: "master", refId: distributor._id }).exec();
                    retailersData.push(...retailers);

                    for (let retailer of retailers) {
                        let users = await User.find({ role: "player", refId: retailer._id }).exec();
                        usersData.push(...users);
                    }
                }
            }

        } else if (role === "areamanager") {
            // Start from distributor if the role is distributor
            let distributors = await User.find({ role: "areamanager", _id: new mongoose.Types.ObjectId(id) }).exec();
            distributorsData.push(...distributors);

            for (let distributor of distributors) {
                let retailers = await User.find({ role: "master", refId: distributor._id }).exec();
                retailersData.push(...retailers);

                for (let retailer of retailers) {
                    let users = await User.find({ role: "player", refId: retailer._id }).exec();
                    usersData.push(...users);
                }
            }

        } else if (role === "master") {
            // Start from retailer if the role is retailer
            let retailers = await User.find({ role: "master", _id: new mongoose.Types.ObjectId(id) }).exec();
            retailersData.push(...retailers);

            for (let retailer of retailers) {
                let users = await User.find({ role: "player", refId: retailer._id }).exec();
                usersData.push(...users);
            }

        }


        const allData = [
            ...superadminsData,
            ...adminsData,
            ...superdistributorsData,
            ...distributorsData,
            ...retailersData,
            ...usersData
        ];

        // After fetching all data, log the single merged array
        //   console.log("All Data:", usersData);
        return allData;

    } catch (error) {
        console.error("Error in getUsersRoleWise:", error);
    }
}

async function commissionpayout(req, res) {
    const { role, id } = req.query;
    try {
        const data = await getAllusersByroleWise(role, id);
        let commissionData = [];

        // Use Promise.all to handle all asynchronous operations inside the map
        await Promise.all(
            data.map(async (object) => {
                const foundedData = await getCalculateDataByTree(object.role, object._id);
                // console.log(foundedData);

                // Push the result to the commissionData array
                commissionData.push({
                    "id": object._id,
                    "username": object.username,
                    "commission": object.commission,
                    "role": object.role,
                    "totalcommission": parseFloat(foundedData, 2),
                });


            })
        );
        // console.log(commissionData);
        res.status(200).send({
            data: commissionData
        });
    } catch (error) {
        res.status(500).send({
            message: "error",
            data: error
        });
    }
}


async function getCalculateDataByTree(role, id) {
    try {
        let superadminsData = [];
        let adminsData = [];
        let superdistributorsData = [];
        let distributorsData = [];
        let retailersData = [];
        let usersData = [];

        // Handle superadmin case: Fetch everything under the superadmin
        if (role === "superadmin") {
            // Fetch all admins for the superadmin
            let admins = await User.find({ role: "admin" }).exec();
            adminsData.push(...admins);
            // console.log(admins);

            for (let admin of admins) {
                // For each admin, fetch superdistributors
                let superdistributors = await User.find({ role: "superareamanager", refId: admin._id }).exec();
                superdistributorsData.push(...superdistributors);

                for (let superdistributor of superdistributors) {
                    // For each superdistributor, fetch distributors
                    let distributors = await User.find({ role: "areamanager", refId: superdistributor._id }).exec();
                    distributorsData.push(...distributors);

                    for (let distributor of distributors) {
                        // For each distributor, fetch retailers
                        let retailers = await User.find({ role: "master", refId: distributor._id }).exec();
                        retailersData.push(...retailers);

                        for (let retailer of retailers) {
                            // For each retailer, fetch users
                            let users = await User.find({ role: "player", refId: retailer._id }).exec();
                            usersData.push(...users);
                        }
                    }
                }
            }

        } else if (role === "admin") {
            // Fetch admins (this is where you start for admin role)
            let admins = await User.find({ role: "admin", _id: new mongoose.Types.ObjectId(id) }).exec();
            adminsData.push(...admins);



            for (let admin of admins) {
                // Fetch superdistributors under each admin
                let superdistributors = await User.find({ role: "superareamanager", refId: admin._id }).exec();
                superdistributorsData.push(...superdistributors);

                for (let superdistributor of superdistributors) {
                    // Fetch distributors under each superdistributor
                    let distributors = await User.find({ role: "areamanager", refId: superdistributor._id }).exec();
                    distributorsData.push(...distributors);

                    for (let distributor of distributors) {
                        // Fetch retailers under each distributor
                        let retailers = await User.find({ role: "retailer", refId: distributor._id }).exec();
                        retailersData.push(...retailers);

                        for (let retailer of retailers) {
                            // Fetch users under each retailer
                            let users = await User.find({ role: "player", refId: retailer._id }).exec();
                            usersData.push(...users);
                        }
                    }
                }
            }

        } else if (role === "superareamanager") {
            // Start from superdistributor if the role is superdistributor
            let superdistributors = await User.find({ role: "superareamanager", _id: new mongoose.Types.ObjectId(id) }).exec();
            superdistributorsData.push(...superdistributors);

            for (let superdistributor of superdistributors) {
                let distributors = await User.find({ role: "areamanager", refId: superdistributor._id }).exec();
                distributorsData.push(...distributors);

                for (let distributor of distributors) {
                    let retailers = await User.find({ role: "retailer", refId: distributor._id }).exec();
                    retailersData.push(...retailers);

                    for (let retailer of retailers) {
                        let users = await User.find({ role: "player", refId: retailer._id }).exec();
                        usersData.push(...users);
                    }
                }
            }

        } else if (role === "areamanager") {
            // Start from distributor if the role is distributor
            let distributors = await User.find({ role: "areamanager", _id: new mongoose.Types.ObjectId(id) }).exec();
            distributorsData.push(...distributors);

            for (let distributor of distributors) {
                let retailers = await User.find({ role: "master", refId: distributor._id }).exec();
                retailersData.push(...retailers);

                for (let retailer of retailers) {
                    let users = await User.find({ role: "player", refId: retailer._id }).exec();
                    usersData.push(...users);
                }
            }

        } else if (role === "master") {
            // Start from retailer if the role is retailer
            let retailers = await User.find({ role: "retailer", _id: new mongoose.Types.ObjectId(id) }).exec();
            retailersData.push(...retailers);

            for (let retailer of retailers) {
                let users = await User.find({ role: "player", refId: retailer._id }).exec();
                usersData.push(...users);
            }

        }

        // console.log(usersData);

        const userIds = usersData.map(dd => new mongoose.Types.ObjectId(dd._id));

        const result = await Ticket.aggregate([
            {
                $match: { userid: { $in: userIds } } // Match tickets for any of the users
            },
            {
                $group: {
                    _id: "$userid", // Group by 'userid'
                    totalPlayPoints: { $sum: "$playpoints" } // Sum up the 'playpoints'
                }
            }
        ]);


        return result[0]?.totalPlayPoints || 0;




    } catch (error) {
        console.error("Error in getUsersRoleWise:", error);
    }
}


async function admincommissionpayout(req, res) {
    try {
        const { role, id, startDate, endDate } = req.query;

        const fromdate = new Date(startDate);
        fromdate.setHours(0, 0, 0, 0); // Set to midnight
        const todate = new Date(endDate);
        todate.setHours(23, 59, 59, 999); // Set to just before midnight


        let data;
        if (role === "superadmin") {
            data = await Percentage.find().exec();
        }

        if (role === "admin") {
            data = await Percentage.find({ adminId: id }).exec();
        }

        let admindata = [];



        const gameIds = data.map(p => p.gameId);  // gameId is a string

        // Query the Game collection using gameIds
        const games = await Game.find({ gameId: { $in: gameIds } }).exec();

        // Map through percentages and attach gameName from the corresponding game
        admindata = await Promise.all(data.map(async (percentage) => {
            const game = games.find(g => g.gameId === percentage.gameId);  // Find the game by gameId
            const name = await User.findById(percentage.adminId).exec(); // Fetch the admin name

            const statData = await getGameStatsUsingMap(percentage.gameId, percentage.adminId, fromdate, todate);

            // console.log(statData);

            return {
                id: percentage._id,
                gameId: percentage.gameId,
                nofDigit: game ? game.nodigit : '0',
                username: name ? name.username : 'Unknown User',
                gameName: game ? game.gameName : 'Unknown Game',  // Default to 'Unknown Game' if no game is found
                winpercentage: percentage.winpercentage,
                totalpoints: statData.totalPlaypoints,
                totalwinpoints: statData.totalWinpoints
            };
        }));




        res.status(200).send({
            success: true,
            data: admindata,
        });

    } catch (error) {
        res.send({
            success: false,
            message: error.message,
        });
    }
}


async function getGameStats(gameId, adminId) {

    //console.log(gameId,adminId);
    try {
        // Aggregate tickets based on gameId and adminId
        const result = await Ticket.aggregate([
            {
                // Match tickets for a specific gameId and adminId
                $match: {
                    gameid: gameId, // GameId as string or ObjectId based on your data
                    adminid: adminId // AdminId should be an ObjectId
                }
            },
            {
                // Group by gameId and adminId to sum playpoints and winpoints
                $group: {
                    _id: {
                        gameid: "$gameid", // Group by gameId
                        adminid: "$adminId" // Group by adminId
                    },
                    totalPlaypoints: { $sum: "$playpoints" }, // Sum of playpoints
                    totalWinpoints: { $sum: "$winpoints" }, // Sum of winpoints
                }
            }
        ]);

        // If no result, return a default object
        if (result.length === 0) {
            return { totalPlaypoints: 0, totalWinpoints: 0 };
        }

        // Return the aggregated result
        return result[0]; // Since we're grouping by gameId and adminId, there should be only one result
    } catch (error) {
        console.error('Error in getGameStats:', error);
        return { totalPlaypoints: 0, totalWinpoints: 0 }; // Return default in case of error
    }
}

async function getGameStatsUsingMap(gameId, adminId, fromdate, todate) {
    try {
        // Find all tickets matching the gameId and adminId
        // const tickets = await Ticket.find({ gameid: gameId, adminid: adminId }).exec();
        const tickets = await Ticket.find({
            gameid: gameId,        // Filter by gameId
            adminid: adminId,      // Filter by adminId
            date: {           // Filter by date range
                $gte: fromdate,      // Greater than or equal to fromdate
                $lte: todate         // Less than or equal to todate
            }
        }).exec();
        // console.log(tickets);

        // If no tickets are found, return default values
        if (tickets.length === 0) {
            return { totalPlaypoints: 0, totalWinpoints: 0 };
        }

        // Use map to iterate over the tickets and calculate the sum
        const totalPlaypoints = tickets.map(ticket => ticket.playpoints).reduce((sum, playpoints) => sum + playpoints, 0);
        const totalWinpoints = tickets.map(ticket => ticket.winpoints).reduce((sum, winpoints) => sum + winpoints, 0);

        // Return the results
        return { totalPlaypoints, totalWinpoints };

    } catch (error) {
        console.error('Error in getGameStatsUsingMap:', error);
        return { totalPlaypoints: 0, totalWinpoints: 0 }; // Return default in case of error
    }
}

module.exports = {
    turnoverreport,
    findallusersbyrole,
    transactionreport,
    commissionpayout,
    admincommissionpayout
}