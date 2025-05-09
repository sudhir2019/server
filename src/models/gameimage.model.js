const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const gameimageSchema = Schema({
  nodigit: { type: Number, required: true },
  image: { type: String, default: null },// An array to store multiple image URLs
  GameId: { type: Schema.Types.ObjectId, ref: 'Game' },
});

const GameImage = mongoose.model('GameImage', gameimageSchema);

module.exports = GameImage;
