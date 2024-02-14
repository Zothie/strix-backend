const mongoose = require('mongoose');
const gamesSchema = new mongoose.Schema({
    gameID: {
      type: String,
      required: true, // Обязательное поле
    },
    gameName: {
      type: String, // Тип данных для gameName (предположим, что это строка)
      required: true, // Обязательное поле
    },
    gameEngine: {
      type: String, // Тип данных для gameEngine (предположим, что это строка)
      required: true, // Обязательное поле
    },
    gameIcon: {
      type: String, // Тип данных для gameIcon (предположим, что это строка, представляющая путь к изображению)
    },
    gameSecretKey: {
      type: String, // Тип данных для gameSecretKey (предположим, что это строка)
      required: true, // Обязательное поле
    },
  });
  const Game = mongoose.model('Game', gamesSchema);

  module.exports = Game;