const express = require("express");
const gameController = require("../controllers/game.controller");
const gameValidation = require("../middlewares/gameValidation");
const fs = require('fs');
const router = express.Router();

const { uploadFields, processImages } = require("../configs/multerConfig");
//GET: Get all games
router.get("/", gameController.getAllGames);

// POST: Create a new game with validation
router.post("/", [uploadFields, processImages], gameController.createGame);

// GET: Get a game by gameId
router.get("/:id", gameController.getGameById);

// PUT: Update a game by gameId
router.put("/:id", gameValidation, gameController.updateGame);

// DELETE: Delete a game by gameId
router.delete("/:id", gameController.deleteGame);

// PUT: Status toggle a game by gameId
router.put('/:id/:action', gameController.toggleGameStatus);

router.get("/usergames/:id", gameController.loadGamesByAdmin);

// updateWinpercentage
router.put("/:id/winpercentage", gameController.updateWinPercentage);



module.exports = router;
