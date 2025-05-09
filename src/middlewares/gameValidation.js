const { body } = require("express-validator");

const gameValidation = [
  body("gameName")
    .notEmpty()
    .withMessage("Game name is required.")
    .isLength({ max: 100 })
    .withMessage("Game name cannot exceed 100 characters."),

  // body("description")
  //   .notEmpty()
  //   .withMessage("Description is required.")
  //   .isLength({ max: 500 })
  //   .withMessage("Description cannot exceed 500 characters."),

  body("releaseDate")
    .isDate()
    .withMessage("Release date must be a valid date."),

  body("publisher").notEmpty().withMessage("Publisher is required."),
];

module.exports = gameValidation;
