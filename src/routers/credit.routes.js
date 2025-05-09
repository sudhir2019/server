const { loadcredit } = require("../controllers/credit.controller");
const router = require("express").Router();
router.get("/loadcredit", loadcredit);
module.exports = router;