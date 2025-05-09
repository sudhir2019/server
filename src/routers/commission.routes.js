
const router = require("express").Router();
const { sendcommission } = require("../controllers/commission.controller");

router.get("/sendcommission",sendcommission)
module.exports = router;