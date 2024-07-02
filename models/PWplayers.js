import { Schema, model } from "mongoose";

const analyticsElementSchema = new Schema({
  elementID: String,
  elementValue: {},
  elementValues: [String],
});

const statisticsElementSchema = new Schema({
  elementID: String,
  elementValue: {
    type: Schema.Types.Mixed,
    cast: false,
  },
});

const playerSchema = new Schema({
  gameID: {
    type: String,
    required: true,
  },
  clientID: String,
  branch: {
    type: String,
    enum: ["development", "staging", "production"],
    required: true,
  },
  elements: {
    analytics: [analyticsElementSchema],
    statistics: [statisticsElementSchema],
  },
  inventory: Array,
  offers: Array,
  abtests: [String],
  segments: [String],
});

export const PWplayers = model("pwplayers", playerSchema);
