const { User } = require("../models/user.model");

async function counusers(req, res) {
  const { role, id } = req.query;
  let users;

  try {
    // If role is provided as "superadmin", count the users with that role
    if (role === "superadmin") {
      users = await User.find({ role: 'player', isDeleted: false }).exec();
    }

    if (role === "admin") {
      // Find the admin based on the provided id
      const admin = await User.findOne({ _id: id, isDeleted: false, role: "admin" })
        .populate('refId', 'username')  // populate refId with 'username'
        .populate('games')              // populate games
        .set('strictPopulate', false)   // for nested population
        .exec();

      if (!admin) {
        return res.status(404).json({
          success: false,
          message: "Admin not found with the given ID.",
        });
      }

      // Find superdistributors under this admin
      const superdistributors = await User.find({ role: 'superareamanager', isDeleted: false, refId: admin._id })
        .populate('refId', 'username')
        .populate('games')
        .exec();

      // Find distributors under each superdistributor
      let distributorsList = [];
      for (let superd of superdistributors) {
        const distributors = await User.find({ role: 'areamanager', isDeleted: false, refId: superd._id })
          .populate('refId', 'username')
          .populate('games')
          .exec();

        distributorsList.push(...distributors);
      }

      // Find retailers under each distributor
      let retailersList = [];
      for (let dist of distributorsList) {
        const retailers = await User.find({ role: 'master', isDeleted: false, refId: dist._id })
          .populate('refId', 'username')
          .populate('games')
          .exec();

        retailersList.push(...retailers);
      }

      // Find users under each retailer
      let userList = [];
      for (let retailer of retailersList) {
        const usersUnderRetailer = await User.find({ role: 'player', isDeleted: false, refId: retailer._id })
          .populate('refId', 'username')
          .populate('games')
          .exec();

        userList.push(...usersUnderRetailer);
      }

      // Combine all the results
      users = userList;


    }


    if (role === "superareamanager") {
      // Find the superdistributor based on the provided id
      const superdistributor = await User.findOne({ _id: id, isDeleted: false, role: "superareamanager" })
        .populate('refId', 'username')  // populate refId with 'username'
        .populate('games')              // populate games
        .set('strictPopulate', false)   // for nested population
        .exec();

      if (!superdistributor) {
        return res.status(404).json({
          success: false,
          message: "superareamanager not found with the given ID.",
        });
      }

      // Find distributors under this superdistributor
      const distributors = await User.find({ role: 'areamanager', isDeleted: false, refId: superdistributor._id })
        .populate('refId', 'username')
        .populate('games')
        .exec();

      // Find retailers under each distributor
      let retailersList = [];
      for (let dist of distributors) {
        const retailers = await User.find({ role: 'master', isDeleted: false, refId: dist._id })
          .populate('refId', 'username')
          .populate('games')
          .exec();

        retailersList.push(...retailers);
      }

      // Find users under each retailer
      let userList = [];
      for (let retailer of retailersList) {
        const usersUnderRetailer = await User.find({ role: 'player', isDeleted: false, refId: retailer._id })
          .populate('refId', 'username')
          .populate('games')
          .exec();

        userList.push(...usersUnderRetailer);
      }

      // Combine all the results for users under the superdistributor
      users = userList;

    }
    if (role === "areamanager") {
      // Find the distributor based on the provided id
      const distributor = await User.findOne({ _id: id, isDeleted: false, role: "areamanager" })
        .populate('refId', 'username')  // populate refId with 'username'
        .populate('games')              // populate games
        .set('strictPopulate', false)   // for nested population
        .exec();

      if (!distributor) {
        return res.status(404).json({
          success: false,
          message: "Distributor not found with the given ID.",
        });
      }

      // Find retailers under this distributor
      const retailers = await User.find({ role: 'master', isDeleted: false, refId: distributor._id })
        .populate('refId', 'username')
        .populate('games')
        .exec();

      // Find users under each retailer
      let userList = [];
      for (let retailer of retailers) {
        const usersUnderRetailer = await User.find({ role: 'player', isDeleted: false, refId: retailer._id })
          .populate('refId', 'username')
          .populate('games')
          .exec();

        userList.push(...usersUnderRetailer);
      }

      // Combine all the results for users under the distributor
      users = userList;
    }

    if (role === "master") {
      // Find the retailer based on the provided id
      const retailer = await User.findOne({ _id: id, isDeleted: false, role: "master" })
        .populate('refId', 'username')  // populate refId with 'username'
        .populate('games')              // populate games
        .set('strictPopulate', false)   // for nested population
        .exec();

      if (!retailer) {
        return res.status(404).json({
          success: false,
          message: "Retailer not found with the given ID.",
        });
      }

      // Find users under this retailer
      const usersUnderRetailer = await User.find({ role: 'player', isDeleted: false, refId: retailer._id })
        .populate('refId', 'username')
        .populate('games')
        .exec();

      // Combine all the results for users under the retailer
      users = usersUnderRetailer;
    }
    res.status(200).json({
      success: true,
      count: users,
      countAdmins: await User.countDocuments({ role: 'admin', isDeleted: false }).exec(),
      countSuperDistributors: await User.countDocuments({ role: 'superareamanager', isDeleted: false, }).exec(),
      countDistributors: await User.countDocuments({ role: 'areamanager', isDeleted: false, }).exec(),
      countRetailers: await User.countDocuments({ role: 'master', isDeleted: false }).exec()
    });
  } catch (error) {
    console.error("Error fetching count:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user count",
    });
  }
}

module.exports = { counusers };
