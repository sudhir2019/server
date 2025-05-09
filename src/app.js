const express = require("express");
const app = express();
const cors = require("cors");
const path = require("path");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
require("dotenv").config({ path: ".env" });
const fs = require('fs');
// Importing routes
const authRouter = require("./routers/auth.routes.js");
const gameRouter = require("./routers/games.routes.js");
const countRoutes = require("./routers/count.routes.js");
const superadminRoutes = require("./routers/superadmin.routes.js");
const adminRoutes = require("./routers/admin.routes.js");
const superareamanagerRoutes = require("./routers/superareamanager.routes.js");
const areamanagerRoutes = require("./routers/areamanager.routes.js");
const masterRoutes = require("./routers/master.routes.js");
const playerRoutes = require("./routers/players.routes.js");
const percentageRoutes = require("./routers/percentage.routes.js");
const appRoutes = require("./routers/app.routes.js");
const liveRoutes = require("./routers/live.routes.js");
const reportRoutes = require("./routers/report.routes.js");
const logRoutes = require("./routers/log.routes.js");
const timeRoutes = require('./routers/time.routes.js');
const resultRoutes = require('./routers/result.routes.js');
const creditRoutes = require('./routers/credit.routes.js');
const onlinePlayerRoutes = require("./routers/onlinePlayer.routes.js");


const isDevelopment = process.env.NODE_ENV !== "production";
// ✅ Allowed Origins
// const allowedOrigins = isDevelopment ? ["http://localhost:5173", "http://localhost:3000"] : process.env.ACCESS_CONTROL_ALLOW_ORIGIN ? process.env.ACCESS_CONTROL_ALLOW_ORIGIN.split(",") : [];

// ✅ CORS Configuration
const corsOptions = {

  
   origin: (origin, callback) => {
      const allowedOrigins = ["https://rgnlife.in", "https://greport.pro", "https://planetg.co", "http://localhost:5173", "http://localhost:5174","http://127.0.0.1:5500"];

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, origin); // ✅ Set the specific origin
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  exposedHeaders: ["Cookie", "Authorization"],
  credentials: true, // ✅ Allows cookies to be sent
};;

// ✅ Apply Middleware
app.use(cors(corsOptions));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan("tiny"));

// ✅ Serve Static Files for Media
app.use("/media", express.static(path.join(__dirname, "storage", "upload")));

// ✅ Define API Routes
app.use("/api/auth", authRouter);
app.use("/api/superadmins", superadminRoutes);
app.use("/api/admins", adminRoutes);
app.use("/api/superareamanager", superareamanagerRoutes);
app.use("/api/areamanager", areamanagerRoutes);
app.use("/api/master", masterRoutes);
app.use("/api/player", playerRoutes);
app.use("/api/percentage", percentageRoutes);
app.use("/api/game", gameRouter);
app.use("/api/credit", creditRoutes);
app.use("/api/counts", countRoutes);
app.use("/api/time", timeRoutes);
app.use("/api/live", liveRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/logs", logRoutes);
app.use("/api/app", appRoutes);
app.use("/api/result", resultRoutes);

const historyRoutes = require("./routers/history.routes.js");
app.use("/api/history", historyRoutes);


app.use("/api/onlinePlayer", onlinePlayerRoutes);

const giftRoutes = require("./routers/gift.routes.js");
const loanRoutes = require("./routers/loan.routes.js");
const otcRoutes = require("./routers/otc.routes.js");

const complaintRoutes = require("./routers/complaint.routes.js");



app.use("/api/gift", giftRoutes);
app.use("/api/loan", loanRoutes);
app.use("/api/otc", otcRoutes);
app.use("/api/complaint", complaintRoutes);




const playRepRoutes = require('./routers/playrep.routes.js');
app.use("/api/playrep", playRepRoutes);




const funRepRoutes = require('./routers/funrep.routes.js');
app.use("/api/funrep", funRepRoutes);



const commission = require('./routers/commission.routes.js');
app.use("/api/commission", commission);



app.get("/", (req, res) => {
  var time = new Date().toString();
  res.send(time);
});




app.use((err, req, res, next) => {
  const fs = require('fs');
  const logMessage = `[${new Date().toISOString()}] ${err.stack || err}\n`;
  fs.appendFileSync('logs/error.log', logMessage);
  res.status(500).json({ error: 'Something broke!' });
});




// ✅ Serve frontend in production mode
if (isDevelopment) {
  console.log("Running in development mode...");
} else {
  console.log("Serving frontend in production mode...");
  app.use(
    express.static(path.resolve(__dirname, "..", "..", "client", "dist"), {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) {
          res.setHeader("Content-Type", "application/javascript");
        }
      },
    })
  );
  // ✅ Serve index.html for all unknown routes
  app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "..", "..", "client", "dist", "index.html"));
  });
}

// ✅ Export App
module.exports = app;
