const express = require("express");
const router = express.Router();
const {
    createAreamanager,
    getAllAreamanagers,
    getAreamanagerById,
    updateAreamanager,
    deleteAreamanager,
    creditTransfer,
    creditAdjust,
    toggleUserStatus,
    getRoleCount,

    getAreamanagerChildrenById,
    getAreamanagerByIdChildren,
    createAreamanagerByIdChildren,
    updateAreamanagerChildren,
    creditTransferAreamanagerChildren,
    creditAdjustAreamanagerChildren,
    toggleAreamanagerChildrenStatus,
    deleteAreamanagerChildren,
    loadcredit
} = require("../controllers/areamanager.controller");
const { verifyToken } = require("../middlewares/authJwt");

router.get("/loadcredit/:id",loadcredit);
// ✅ Create a new Areamanager (POST)
router.post("/create", createAreamanager);

// ✅ Get all Areamanagers (GET)
router.get("/all", getAllAreamanagers);

// ✅ Get Areamanager by ID (GET)
router.get("/:id", getAreamanagerById);

// ✅ Update an Areamanager (PUT)
router.put("/:id",updateAreamanager);

// ✅ Delete an Areamanager (DELETE)
router.delete("/:id", deleteAreamanager);

// ✅ Credit Transfer (POST)
router.post("/credit-transfer", creditTransfer);

// ✅ Credit Adjustment (POST)
router.post("/credit-adjust", creditAdjust);

// ✅ Toggle User Status (Activate/Deactivate) (PATCH)
router.patch("/toggle-status/:id/:action",toggleUserStatus);

// ✅ Get Role Count (GET) && GET role-based user count
router.get("/role-count", getRoleCount);

// ✅ Get Areamanager's children (GET)
router.get("/:id/children", getAreamanagerByIdChildren);

// ✅ Create Areamanager's children (POST)
router.post("/:id/children", createAreamanagerByIdChildren);

// ✅ Update Areamanager's children (PUT)
router.put("/:id/children/:childrenId",updateAreamanagerChildren);

// ✅ Credit Transfer for Areamanager's children (POST)
router.post("/:id/children/:childrenId/credit-transfer", creditTransferAreamanagerChildren);

// ✅ Credit Adjustment for Areamanager's children (POST)

router.post("/:id/children/:childrenId/credit-adjust", creditAdjustAreamanagerChildren);

// ✅ Toggle Areamanager's children status (Activate/Deactivate) (PATCH)
router.patch("/:id/children/:childrenId/toggle-status/:action",toggleAreamanagerChildrenStatus);

// ✅ Delete Areamanager's children (DELETE)
router.delete("/:id/children/delete/:childrenId", deleteAreamanagerChildren);

// ✅ Get Areamanager's children by ID (GET)
router.get("/:id/children/:childrenId", getAreamanagerChildrenById);

module.exports = router;
