const express = require("express");
const router = express.Router();
const {
    createMaster,
    getAllMasters,
    getMasterById,
    updateMaster,
    deleteMaster,
    creditTransfer,
    creditAdjust,
    toggleUserStatus,
    getRoleCount,

    getMasterChildrenById,
    getMasterByIdChildren,
    createMasterByIdChildren,
    updateMasterChildren,
    creditTransferMasterChildren,
    creditAdjustMasterChildren,
    toggleMasterChildrenStatus,
    deleteMasterChildren,
    loadcredit
} = require("../controllers/master.controller");

const { verifyToken } = require("../middlewares/authJwt");

router.get("/loadcredit/:id", loadcredit);
// ✅ Create a new Master (POST)
router.post("/create", createMaster);

// ✅ Get all Masters (GET)
router.get("/all", getAllMasters);

// ✅ Get Master by ID (GET)
router.get("/:id",  getMasterById);

// ✅ Update an Master (PUT)
router.put("/:id",  updateMaster);

// ✅ Delete an Master (DELETE)
router.delete("/:id",  deleteMaster);

// ✅ Credit Transfer (POST)
router.post("/credit-transfer", creditTransfer);

// ✅ Credit Adjustment (POST)
router.post("/credit-adjust", creditAdjust);

// ✅ Toggle User Status (Activate/Deactivate) (PATCH)
router.patch("/toggle-status/:id/:action", toggleUserStatus);

// ✅ Get Role Count (GET) && GET role-based user count
router.get("/role-count",  getRoleCount);


// ✅ Get Master's children (GET)
router.get("/:id/children", getMasterByIdChildren);

// ✅ Create Master's children (POST)
router.post("/:id/children",  createMasterByIdChildren);

// ✅ Update Master's children (PUT)
router.put("/:id/children/:childrenId",  updateMasterChildren);

// ✅ Credit Transfer for Master's children (POST)
router.post("/:id/children/:childrenId/credit-transfer", creditTransferMasterChildren);

// ✅ Credit Adjustment for Master's children (POST)

router.post("/:id/children/:childrenId/credit-adjust", creditAdjustMasterChildren);

// ✅ Toggle Master's children status (Activate/Deactivate) (PATCH)
router.patch("/:id/children/:childrenId/toggle-status/:action",  toggleMasterChildrenStatus);

// ✅ Delete Master's children (DELETE)
router.delete("/:id/children/delete/:childrenId",  deleteMasterChildren);

// ✅ Get Master's children by ID (GET)
router.get("/:id/children/:childrenId",  getMasterChildrenById);

module.exports = router;
