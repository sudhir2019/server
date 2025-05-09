const { loadTransferable, loadReceivable, loadBalance, receive, reject,pointtransfer, cancel, changePassword, chnagepin,loadUsers,resetPinPassword, complaint, drawdetails } = require("../controllers/funrep.controller");
const router = require("express").Router();
router.get("/loadBalance", loadBalance);
router.get("/loadTransferable", loadTransferable);
router.get("/loadReceivable", loadReceivable);
router.post("/receive", receive);
router.post("/reject", reject);
router.post("/cancel", cancel);
router.post("/pointtransfer", pointtransfer);

router.post("/chnagepassword", changePassword);

router.post("/changepin", chnagepin);

router.get("/loadusers", loadUsers);

router.post("/resetpinpassword", resetPinPassword);
router.post("/sendcontact", complaint);


router.get("/drawdetails", drawdetails);
module.exports = router;