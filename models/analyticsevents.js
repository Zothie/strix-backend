const mongoose = require('mongoose');

const valueSchema = new mongoose.Schema({
  valueName: String,
  valueFormat: String,
  valueCountMethod: String,
});
const eventSchema = new mongoose.Schema({
  eventID: String,
  eventName: String,
  eventCodeName: String,
  values: [valueSchema],
  comment: String,
  tags: [String],
});

const branchSchema = new mongoose.Schema({
  branch: String,
  events: [eventSchema],
});

const gameSchema = new mongoose.Schema({
  gameID: String,
  branches: [branchSchema],
});

const AnalyticsEvents = mongoose.model('AnalyticsEvents', gameSchema);

module.exports = AnalyticsEvents;