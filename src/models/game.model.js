const mongoose = require("mongoose");

const Schema = mongoose.Schema;

// Function to generate a random gameId with only letters (no digits)
const generateGameId = () => {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let gameId = "";
  for (let i = 0; i < 8; i++) {
    gameId += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return gameId;
};

// Define the Game schema
const gameSchema = new Schema(
  {
    gameId: {
      type: String,
      unique: true,
      match: /^[a-zA-Z]+$/, // Ensures only letters (no digits)
    },
    gameIndex: { type: Number, default: 0 },
    gameName: {
      type: String,
      required: true,
      trim: true,
    },
    nodigit: {
      type: Number,
      required: true,
    },
    logo: {
      type: String,
      default: "https://platopedia.com/docs/assets/images/logos/default.png"
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    deletedAt: {
      type: Date,
      default: null
    },
    description: {
      type: String,
      required: false,
    },
    releaseDate: {
      type: Date,
      required: true,
    },
    publisher: {
      type: String,
      required: true,
    },
    GameImage: [{ type: Schema.Types.ObjectId, ref: 'GameImage' }],
    timeId: [{ type: Schema.Types.ObjectId, ref: "Time" }],
    label: { type: String, default: "no" },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ✅ **1. Auto-generate `gameId` before saving**
gameSchema.pre("save", async function (next) {
  if (!this.gameId) {
    this.gameId = generateGameId();
  }
  next();
});

// ✅ **2. Static Method: Get Only Active & Non-Deleted Games**
gameSchema.statics.findActive = function () {
  return this.find({ isDeleted: false, status: "active" });
};

// ✅ **3. Instance Method: Soft Delete a Game**
gameSchema.methods.softDelete = async function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  await this.save();
};

// ✅ **4. Restore Soft Deleted Game**
gameSchema.methods.restore = async function () {
  this.isDeleted = false;
  this.deletedAt = null;
  await this.save();
};

// ✅ **5. Get All Non-Deleted Games**
gameSchema.statics.findNonDeleted = function () {
  return this.find({ isDeleted: false });
};

// ✅ **6. Permanently Delete Game**
gameSchema.methods.permanentDelete = async function () {
  await this.deleteOne();
};

// Create the Game model
const Game = mongoose.model("Game", gameSchema);

module.exports = Game;
