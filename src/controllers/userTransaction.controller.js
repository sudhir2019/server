// controllers/userTransactionController.js
const UserTransaction = require("../models/userTransaction.model");
const mongoose = require("mongoose");

/**
 * Get all transactions
 */
async function getAllTransactions(req, res) {
  try {
    const transactions = await UserTransaction.find()
      .populate("userId", "name email")
      .sort({ created_at: -1 });

    if (!transactions.length) {
      return res.status(404).json({
        success: false,
        message: "No transactions found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: transactions,
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching transactions.",
    });
  }
}

/**
 * Get a transaction by ID
 */
async function getTransactionById(req, res) {
  const { transactionId } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(transactionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid transactionId format.",
      });
    }

    const transaction = await UserTransaction.findById(transactionId).populate(
      "userId",
      "name email"
    );

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    console.error("Error fetching transaction by ID:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching the transaction.",
    });
  }
}

module.exports = {
  getAllTransactions,
  getTransactionById,
};
