const { gameHistory } = require("../controllers/history.controller");

const router = require("express").Router();
router.get("/gamehistory",gameHistory);
module.exports = router;