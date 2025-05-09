const express = require("express");
const router = express.Router();
const {
    createSuperareamanager,
    getAllSuperareamanager,
    getSuperareamanagerById,
    updateSuperareamanager,
    deleteSuperareamanager,
    creditTransfer,
    creditAdjust,
    getRoleCount,
    toggleUserStatus,
    getSuperareamanagerChildrenById,
    getSuperareamanagerByIdChildren,
    createSuperareamanagerByIdChildren,
    updateSuperareamanagerChildren,
    creditTransferSuperareamanagerChildren,
    creditAdjustSuperareamanagerChildren,
    toggleSuperareamanagerChildrenStatus,
    deleteSuperareamanagerChildren,
    loadcredit
} = require("../controllers/superareamanager.controller");
const { verifyToken } = require("../middlewares/authJwt");

router.get("/loadcredit/:id", loadcredit);
// ✅ Create a new Superdistributor (POST)
router.post("/create",createSuperareamanager);

// ✅ Get all Superdistributors (GET)
router.get("/all", getAllSuperareamanager);

// ✅ Get Superdistributor by ID (GET)
router.get("/:id", getSuperareamanagerById);

// ✅ Update an Superdistributor (PUT)
router.put("/:id", updateSuperareamanager);

// ✅ Delete an Superdistributor (DELETE)
router.delete("/:id", deleteSuperareamanager);

// ✅ Credit Transfer (POST)
router.post("/credit-transfer", creditTransfer);

// ✅ Credit Adjustment (POST)
router.post("/credit-adjust", creditAdjust);

// ✅ Toggle User Status (Activate/Deactivate) (PATCH)
router.patch("/toggle-status/:id/:action", toggleUserStatus);

// ✅ Get Role Count (GET) && GET role-based user count
router.get("/role-count", getRoleCount);

// ✅ Get Superdistributor's children (GET)
router.get("/:id/children",  getSuperareamanagerByIdChildren);

// ✅ Create Superdistributor's children (POST)
router.post("/:id/children", createSuperareamanagerByIdChildren);

// ✅ Update Superdistributor's children (PUT)
router.put("/:id/children/:childrenId", updateSuperareamanagerChildren);

// ✅ Credit Transfer for Superdistributor's children (POST)
router.post("/:id/children/:childrenId/credit-transfer", creditTransferSuperareamanagerChildren);

// ✅ Credit Adjustment for Superdistributor's children (POST)

router.post("/:id/children/:childrenId/credit-adjust", creditAdjustSuperareamanagerChildren);

// ✅ Toggle Superdistributor's children status (Activate/Deactivate) (PATCH)
router.patch("/:id/children/:childrenId/toggle-status/:action", toggleSuperareamanagerChildrenStatus);

// ✅ Delete Superdistributor's children (DELETE)
router.delete("/:id/children/delete/:childrenId", deleteSuperareamanagerChildren);

// ✅ Get Superdistributor's children by ID (GET)
router.get("/:id/children/:childrenId", getSuperareamanagerChildrenById);
module.exports = router;
