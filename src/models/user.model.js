const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { Counter } = require("./counter.model");

const Schema = mongoose.Schema;



// ✅ **Generate a 4-digit PIN (Numbers Only)**
const generatePin = () => Math.floor(1000 + Math.random() * 9000).toString(); // e.g., "4723"


// ✅ **Generate Mixed PIN + Password (Numbers & Letters Combined)**// ✅ **Generate Secure Password (Uppercase + Numbers)**
const generatePassword = (length = 8) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password; // e.g., "AB123456"
};

const userSchema = new Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  dateOfBirth: {
    type: Date,
    required: false
  },
  country: {
    type: String,
    required: false
  },
  state: {
    type: String,
    required: false
  },
  city: {
    type: String,
    required: false
  },
  pinCode: {
    type: String,
    required: false
  },
  address: {
    type: String,
    required: false
  },
  isOnline: { type: Boolean, default: false }, // ✅ Online status
  location: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    coordinates: { type: [Number], default: [0, 0] }, // [longitude, latitude]
  },
  occupation: {
    type: String,
    required: false
  },
  phone: {
    type: String,
    unique: false
  },
  username: {
    type: String,
    unique: true
  },
  password: { type: String, }, // ✅ Encrypted Password
  pin: { type: Number }, // ✅ Encrypted PIN
  pinPassword: { type: String },
  email: {
    type: String,
    required: false
  },
  profilePicture: {
    type: String,
    default: "https://cdn-icons-png.flaticon.com/512/149/149071.png",
  },
  profilePicture_id: {
    type: String,
  },
  role: {
    type: String,
    enum: ['superadmin', 'admin', 'superareamanager', 'areamanager', 'master', 'player', "gift", "loan", "otc"],
    default: 'player',
    required: true,
  },
  refId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  walletBalance: {
    type: Number,
    default: 0
  },
  winBalance: {
    type: Number,
    default: 0
  },
  isLoggedIn: {
    type: Boolean,
    default: false
  },
  userStatus: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date
  },
  commission: {
    type: Number,
    default: 0
  },
  socketId: {
    type: String,
    required: false,
    default: null
  },
  deviceId: {
    type: String,
    required: false,
    default: null
  },
  
  permissions: {
    canEdit: {
      type: Boolean,
      default: false
    },
    canDelete: {
      type: Boolean,
      default: false
    },
    canTransferCredits: {
      type: Boolean,
      default: false
    },
  },
  gamepercentage: [
    {
      type: Schema.Types.ObjectId,
      ref: "Percentage",
    },
  ],
  referralTransaction: [
    {
      type: Schema.Types.ObjectId,
      ref: "ReferTransaction",
    },
  ],
  userLogs: [
    {
      type: Schema.Types.ObjectId,
      ref: "UserLog",
    },
  ],
  walletTransaction: [
    {
      type: Schema.Types.ObjectId,
      ref: "UserTransaction",
    },
  ],
  parentId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }, // For hierarchical relationships
  subordinates: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }], // List of subordinates
  note: {
    type: String,
    default: null
  },
  games: [{
    type: Schema.Types.ObjectId,
    ref: 'Game'
  }],
  isDeleted: {
    type: Boolean,
    default: false
  },  // ✅ Added for soft delete support
  deletedAt: {
    type: Date,
    default: null
  }, // Stores deletion timestamp
});

const rolePrefixes = {
  superadmin: "GK007",
  admin: "GK006",
  superareamanager: "GK003",
  areamanager: "GK002",
  master: "GK001",
  player: "GK002111"
};


userSchema.pre("save", async function (next) {
  if (this.isNew) {
    const prefix = rolePrefixes[this.role] || "GK000";
    const numDigits = this.role === "player" ? 2 : 5; // Players get 2-digit numbers, others get 6

    try {
      // ✅ Atomically increment counter for the role
      const counter = await Counter.findOneAndUpdate(
        { role: this.role },
        { $inc: { count: 1 } },
        { upsert: true, new: true }
      );

      // ✅ Generate unique username
      this.username = this.username || `${prefix}${String(counter.count).padStart(numDigits, "0")}`;
      this.pin = this.pin || generatePin();
      this.password = this.password || generatePassword();
      this.pinPassword = this.pinPassword || `${this.pin}-${this.password}`;

      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

// ✅ **Compare Login Credentials Without Hashing**
userSchema.methods.comparePin = function (pin) {
  return this.pin === pin;
};

userSchema.methods.comparePassword = function (password) {
  return this.password === password;
};

userSchema.methods.comparePinPassword = function (pinPassword) {
  return this.pinPassword === pinPassword;
};

// ✅ **Login Method (Handles Last Login Updates)**
userSchema.methods.login = async function () {
  const now = new Date();

  // Update login state
  this.lastLogin = now;
  this.isLoggedIn = true;
  await this.save();
};

// ✅ **Soft Delete User**
userSchema.methods.softDelete = async function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  await this.save();
};

// ✅ **Find Only Non-Deleted Users**
userSchema.statics.findNonDeleted = function () {
  return this.find({ isDeleted: { $ne: true } });
};

// ✅ Create User model
const User = mongoose.model("User", userSchema);

module.exports = { User };
