import { Schema, model } from "mongoose";
const gamesSchema = new Schema({
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
  apiKeys: Array,
});
export const Game = model("Game", gamesSchema);
