
const { createTime, timelist } = require("../controllers/time.controller");
const router = require("express").Router();

router.get("/timelist", timelist);
router.post("/createtime", createTime);


module.exports = router;