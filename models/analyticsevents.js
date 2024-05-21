import { Schema, model } from 'mongoose';


const valueSchema = new Schema({
  valueName: String,
  valueFormat: String,
  valueCountMethod: String,
});
const eventSchema = new Schema({
  eventID: String,
  eventName: String,
  eventCodeName: String,
  removed: Boolean,
  values: [valueSchema],
  comment: String,
  tags: [String],
});

const branchSchema = new Schema({
  branch: String,
  events: [eventSchema],
});

const gameSchema = new Schema({
  gameID: String,
  branches: [branchSchema],
});

export const AnalyticsEvents = model('AnalyticsEvents', gameSchema);

