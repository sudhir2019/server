const express = require("express");
const fs = require('fs');
const { loadLiveGameData, addBalance, addCustomResult,liveData } = require("../controllers/live.controller");
const router = express.Router();
router.get("/loadgame", loadLiveGameData);

router.post("/addbalance", addBalance);
router.post("/addresult", addCustomResult);



router.get("/livedata", liveData);


module.exports = router;
