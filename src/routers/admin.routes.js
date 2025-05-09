const express = require("express");
const router = express.Router();
const {
    createAdmin,
    getAllAdmins,
    getAdminById,
    updateAdmin,
    deleteAdmin,
    creditTransfer,
    creditAdjust,
    toggleUserStatus,
    getRoleCount,
    getAdminByIdChildren,
    createAdminByIdChildren,
    updateAdminChildren,
    creditTransferAdminChildren,
    creditAdjustAdminChildren,
    toggleAdminChildrenStatus,
    deleteAdminChildren,
    getAdminChildrenById,
    loadcredit
} = require("../controllers/admin.controller");
const { verifyToken } = require("../middlewares/authJwt");


// ✅ Create a new admin (POST)
router.post("/create", createAdmin);

// ✅ Get all admins (GET)
router.get("/all", getAllAdmins);

// ✅ Get admin by ID (GET)
router.get("/:id", getAdminById);

// ✅ Update an admin (PUT)
router.put("/:id", updateAdmin);

// ✅ Delete an admin (DELETE)
router.delete("/:id", deleteAdmin);

// ✅ Credit Transfer (POST)
router.post("/credit-transfer", creditTransfer);

// ✅ Credit Adjustment (POST)
router.post("/credit-adjust", creditAdjust);

// ✅ Toggle User Status (Activate/Deactivate) (PATCH)
router.patch("/toggle-status/:id/:action", toggleUserStatus);

// ✅ Get Role Count (GET) && GET role-based user count
router.get("/role-count", getRoleCount);

// ✅ Get admin's children (GET)
router.get("/:id/children", getAdminByIdChildren);

// ✅ Create admin's children (POST)
router.post("/:id/children", createAdminByIdChildren);

// ✅ Update admin's children (PUT)
router.put("/:id/children/:childrenId", updateAdminChildren);

// ✅ Credit Transfer for admin's children (POST)
router.post("/:id/children/:childrenId/credit-transfer", creditTransferAdminChildren);

// ✅ Credit Adjustment for admin's children (POST)

router.post("/:id/children/:childrenId/credit-adjust", creditAdjustAdminChildren);

// ✅ Toggle admin's children status (Activate/Deactivate) (PATCH)
router.patch("/:id/children/:childrenId/toggle-status/:action", toggleAdminChildrenStatus);

// ✅ Delete admin's children (DELETE)
router.delete("/:id/children/delete/:childrenId", deleteAdminChildren);

// ✅ Get admin's children by ID (GET)
router.get("/:id/children/:childrenId", getAdminChildrenById);

router.get("/loadcredit/:id", loadcredit);
module.exports = router;
