const express = require("express");
const router = express.Router();
const {
    createSuperadmin,
    getAllSuperadmins,
    getSuperadminById,
    updateSuperadmin,
    deleteSuperadmin,
    creditTransfer,
    creditAdjust,
    toggleUserStatus,
    getRoleCount,
    getSuperAdminChildrenById,
    getSuperAdminByIdChildren,
    createSuperAdminByIdChildren,
    updateSuperAdminChildren,
    creditTransferSuperAdminChildren,
    creditAdjustSuperAdminChildren,
    toggleSuperAdminChildrenStatus,
    deleteSuperAdminChildren,
    loadcredit
} = require("../controllers/superadmin.controller");
const { verifyToken } = require("../middlewares/authJwt");



router.get("/loadcredit/:id", loadcredit);
// ✅ Create a new Superdistributor (POST)
router.post("/create", createSuperadmin);

// ✅ Get all Superdistributors (GET)
router.get("/all", getAllSuperadmins);

// ✅ Get Superdistributor by ID (GET)
router.get("/:id", getSuperadminById);

// ✅ Update an Superdistributor (PUT)
router.put("/:id", updateSuperadmin);

// ✅ Delete an Superdistributor (DELETE)
router.delete("/:id", deleteSuperadmin);

// ✅ Credit Transfer (POST)
router.post("/credit-transfer", creditTransfer);

// ✅ Credit Adjustment (POST)
router.post("/credit-adjust", creditAdjust);

// ✅ Toggle User Status (Activate/Deactivate) (PATCH)
router.patch("/toggle-status/:id/:action", toggleUserStatus);

// ✅ Get Role Count (GET) && GET role-based user count
router.get("/role-count", getRoleCount);

// ✅ Get SuperAdmin's children (GET)
router.get("/:id/children", getSuperAdminByIdChildren);

// ✅ Create SuperAdmin's children (POST)
router.post("/:id/children", createSuperAdminByIdChildren);

// ✅ Update SuperAdmin's children (PUT)
router.put("/:id/children/:childrenId", updateSuperAdminChildren);

// ✅ Credit Transfer for SuperAdmin's children (POST)
router.post("/:id/children/:childrenId/credit-transfer", creditTransferSuperAdminChildren);

// ✅ Credit Adjustment for SuperAdmin's children (POST)

router.post("/:id/children/:childrenId/credit-adjust", creditAdjustSuperAdminChildren);

// ✅ Toggle SuperAdmin's children status (Activate/Deactivate) (PATCH)
router.patch("/:id/children/:childrenId/toggle-status/:action", toggleSuperAdminChildrenStatus);

// ✅ Delete SuperAdmin's children (DELETE)
router.delete("/:id/children/delete/:childrenId", deleteSuperAdminChildren);

// ✅ Get SuperAdmin's children by ID (GET)
router.get("/:id/children/:childrenId", getSuperAdminChildrenById);

module.exports = router;