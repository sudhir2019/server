const mongoose = require("mongoose");
const { ReferTransaction } = require("../models/referTransactionModel");
const { User } = require("../models/userModel");
const { decrypt } = require("../utils/encryptionAndDecryption");

/**
 * Controller to create a new referral transaction
 */
async function createReferTransaction(req, res) {
  const {
    userId,
    refId,
    refUserId,
    refUserType,
    bonus,
    bonusType,
    amount,
    currency,
  } = req.body;

  try {
    // 1. Validate required fields
    if (!userId || !refId || !refUserId || !refUserType || !currency) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: userId, refId, refUserId, refUserType, and currency are required.",
      });
    }

    // 2. Check if both the users exist
    const user = await User.findById(userId);
    const refUser = await User.findById(refUserId);

    if (!user || !refUser) {
      return res.status(404).json({
        success: false,
        message: "User or referral user not found.",
      });
    }

    // 3. Prepare transaction data
    const newTransactionData = {
      userId,
      refId,
      refUserId,
      refUserType,
      bonus: bonus || 0, // Default to 0 if not provided
      bonusType: bonusType || "percentage", // Default to "percentage"
      amount: amount || 0, // Default to 0 if not provided
      currency,
    };

    // 4. Create the referral transaction
    const newTransaction = new ReferTransaction(newTransactionData);

    // 5. Save the transaction
    await newTransaction.save();

    return res.status(201).json({
      success: true,
      message: "Referral transaction created successfully.",
      data: newTransaction,
    });
  } catch (error) {
    console.error("Error creating referral transaction:", error);

    // 6. Handle different error cases
    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({
        success: false,
        message: "Validation error: " + error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal Server Error. Could not create referral transaction.",
    });
  }
}

/**
 * Controller to get all referral transactions
 */
async function getAllReferTransactions(req, res) {
  const { search, filter, select, page = 1, limit = 10 } = req.query;

  try {
    // Base query object
    let query = {};

    // Apply search functionality (e.g., searching by user or referrer details)
    if (search) {
      query.$or = [
        { "userId.name": { $regex: search, $options: "i" } }, // Search in user name
        { "userId.email": { $regex: search, $options: "i" } }, // Search in user email
        { "referrerId.name": { $regex: search, $options: "i" } }, // Search in referrer name
        { "referrerId.email": { $regex: search, $options: "i" } }, // Search in referrer email
      ];
    }

    // Apply filters (e.g., filtering by status or other fields)
    if (filter) {
      const filters = JSON.parse(filter); // Expecting a JSON object in the `filter` query param
      query = { ...query, ...filters };
    }

    // Apply pagination
    const skip = (page - 1) * limit;

    // Fetch transactions with population, search, filter, and selection
    const transactions = await ReferTransaction.find(query)
      .populate("userId", "name email")
      .populate("referrerId", "name email")
      .select(select ? select.split(",").join(" ") : "") // Dynamic field selection
      .skip(skip)
      .limit(parseInt(limit));

    // Handle case where no transactions are found
    if (transactions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No referral transactions found.",
      });
    }

    // Decrypt `bonusAmount` and `currency` for each transaction
    const decryptedTransactions = transactions.map((transaction) => ({
      ...transaction.toObject(),
      bonusAmount: decrypt(transaction.bonusAmount),
      currency: decrypt(transaction.currency),
    }));

    return res.status(200).json({
      success: true,
      data: decryptedTransactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: await ReferTransaction.countDocuments(query),
      },
    });
  } catch (error) {
    console.error("Error fetching referral transactions:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error. Could not fetch transactions.",
    });
  }
}

/**
 * Controller to get referral transactions by userId
 */
async function getReferTransactionsByUserId(req, res) {
  const userId = req.params.userId?.replace(/^:/, "");

  try {
    // Validate userId parameter
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId.",
      });
    }

    // Fetch transactions for the specific user
    const transactions = await ReferTransaction.find({ userId })
      .populate("userId", "name email") // Populate user details
      .populate("referrerId", "name email"); // Populate referrer details

    // Handle case where no transactions are found for the user
    if (transactions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No referral transactions found for this user.",
      });
    }

    // Decrypt `bonusAmount` and `currency` fields for each transaction
    const decryptedTransactions = transactions.map((transaction) => ({
      ...transaction.toObject(),
      bonusAmount: decrypt(transaction.bonusAmount),
      currency: decrypt(transaction.currency),
    }));

    // Respond with decrypted transactions
    return res.status(200).json({
      success: true,
      data: decryptedTransactions,
    });
  } catch (error) {
    console.error("Error fetching referral transactions by userId:", error);

    // Handle specific Mongoose errors
    if (error instanceof mongoose.Error.CastError) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId format.",
      });
    }

    // Generic error handler
    return res.status(500).json({
      success: false,
      message: "Internal Server Error. Could not fetch transactions.",
    });
  }
}

/**
 * Controller to get a referral transaction by transaction ID
 */
async function getReferTransactionById(req, res) {
  const transactionId = req.params.transactionId?.replace(/^:/, "");

  try {
    // 1. Validate the transactionId parameter
    if (!mongoose.Types.ObjectId.isValid(transactionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid transactionId.",
      });
    }

    // 2. Fetch the transaction by its ID
    const transaction = await ReferTransaction.findById(transactionId)
      .populate("userId", "name email") // Populate user details
      .populate("referrerId", "name email"); // Populate referrer details

    // 3. Handle case where the transaction is not found
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Referral transaction not found.",
      });
    }

    // 4. Decrypt sensitive fields
    const decryptedTransaction = {
      ...transaction.toObject(), // Convert Mongoose document to plain object
      bonusAmount: decrypt(transaction.bonusAmount),
      currency: decrypt(transaction.currency),
    };

    // 5. Respond with the transaction details
    return res.status(200).json({
      success: true,
      data: decryptedTransaction,
    });
  } catch (error) {
    console.error("Error fetching referral transaction by ID:", error);

    // 6. Handle Mongoose-specific and other errors
    if (error instanceof mongoose.Error.CastError) {
      return res.status(400).json({
        success: false,
        message: "Invalid transactionId format.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal Server Error. Could not fetch transaction.",
    });
  }
}

async function getReferralById(req, res) {
  const referralId = req.params.referralId?.replace(/^:/, "");

  try {
    // 1. Validate the referralId parameter
    if (!mongoose.Types.ObjectId.isValid(referralId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid referralId.",
      });
    }

    // 2. Fetch the referral transaction by its ID
    const referral = await ReferTransaction.findById(referralId)
      .populate("userId", "name email") // Populate user details
      .populate("referrerId", "name email"); // Populate referrer details

    // 3. Handle case where the referral is not found
    if (!referral) {
      return res.status(404).json({
        success: false,
        message: "Referral transaction not found.",
      });
    }

    // 4. Decrypt sensitive fields
    const decryptedReferral = {
      ...referral.toObject(), // Convert Mongoose document to plain object
      bonusAmount: decrypt(referral.bonusAmount),
      currency: decrypt(referral.currency),
    };

    // 5. Respond with the referral transaction details
    return res.status(200).json({
      success: true,
      data: decryptedReferral,
    });
  } catch (error) {
    console.error("Error fetching referral transaction by ID:", error);

    // 6. Handle Mongoose-specific and other errors
    if (error instanceof mongoose.Error.CastError) {
      return res.status(400).json({
        success: false,
        message: "Invalid referralId format.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal Server Error. Could not fetch referral transaction.",
    });
  }
}

module.exports = {
  createReferTransaction,
  getAllReferTransactions,
  getReferTransactionsByUserId,
  getReferTransactionById,
  getReferralById,
};
