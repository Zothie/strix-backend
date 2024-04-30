const mongoose = require('mongoose');
const gamesSchema = new mongoose.Schema({
    gameID: {
      type: String,
      required: true,
    },
    gameName: {
      type: String,
      required: true,
    },
    gameEngine: {
      type: String,
      required: true,
    },
    gameIcon: {
      type: String,
    },
    gameSecretKey: {
      type: String,
      required: true,
    },
    scheduledDeletionDate: {
      type: Date,
      required: false,
    },
  });
  const Game = mongoose.model('Game', gamesSchema);

  module.exports = Game;