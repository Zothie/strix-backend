const mongoose = require('mongoose');

const segmentConditionSchema = new mongoose.Schema({
  conditionElementID: String,
  condition: String,
  conditionValue: String,
  conditionSecondaryValue: String,
  conditionOperator: String,
});

const segmentSchema = new mongoose.Schema({
  segmentID: {
    type: String,
    required: true,
  },
  segmentName: String,
  segmentComment: String,
  segmentConditions: [segmentConditionSchema],
  segmentPlayerCount: Number,
  segmentPlayerIDs: [String]
});

const branchSchema = new mongoose.Schema({
  branch: {
    type: String,
    required: true,
  },
  segments: [segmentSchema],
});

const segmentsSchema = new mongoose.Schema({
  gameID: {
    type: String,
    required: true,
  },
  branches: [branchSchema],
});

const Segments = mongoose.model('Segments', segmentsSchema);

module.exports = Segments;