const { default: mongoose } = require("mongoose");
const { Time } = require("../models/time.model");

async function timelist(req, res) {
    try {
        // Await the promise returned by Time.find().exec()
        let times = await Time.find().exec();
        
        // Send the successful response
        res.send({
            message: "Successfully fetched times",
            data: times
        });
    } catch (error) {
        // Handle any errors
        res.status(500).send({
            message: "Error in fetching times",
            error: error.message
        });
    }
}

async function createTime(req, res) {
    try {
        const { time } = req.body; // Destructure time from request body

        // Create a new Time instance
        const newTime = new Time({
            timecount: time || 90  // Use `time` from the request body if provided, else default to 30
        });

        // Save the new instance to the database
        const saveTime = await newTime.save();

        // Send the response back with success
        res.send({
            message: "Successfully created time",
            data: saveTime
        });
    } catch (error) {
        console.log("Error in creating time:", error);
        res.status(500).send({
            message: "Error in creating time",
            error: error.message
        });
    }
}

module.exports = {

    timelist,
    createTime
};