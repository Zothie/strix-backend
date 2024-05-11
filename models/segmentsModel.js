const mongoose = require('mongoose');


const segmentSchema = new mongoose.Schema({
  segmentID: {
    type: String,
    required: true,
  },
  segmentName: String,
  segmentComment: String,
  segmentConditions: String,
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