
const router = require("express").Router();

const { turnoverreport, findallusersbyrole, transactionreport,commissionpayout, admincommissionpayout} = require('../controllers/report.controller');

router.get("/turnoverreport", turnoverreport);
router.get("/findallusers", findallusersbyrole);
router.get("/transactionreport", transactionreport);
router.get("/commissionpayout", commissionpayout);
router.get("/admincommissionpayout", admincommissionpayout);



module.exports = router;