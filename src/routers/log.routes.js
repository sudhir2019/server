
const router = require("express").Router();
const { logUserActivity, getAllUserLogs, getUserLogsByUserId, getUserLogById } = require('../controllers/userLog.controller');
const { activityLogs } = require('../controllers/logs.controller');
const { verifyToken } = require("../middlewares/authJwt");

router.get("/", getAllUserLogs);
router.post("/logUserActivity", logUserActivity);
router.get("/:userId", getUserLogsByUserId);
router.get("/getUserLogById/:logId", getUserLogById);

router.get("/activityLogs", activityLogs);




module.exports = router;