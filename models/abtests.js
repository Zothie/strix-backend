const mongoose = require('mongoose');

const tests = new mongoose.Schema({
  id: String,
  codename: String,
  name: String,
  comment: String,
  segments: String,
  observedMetric: String,
  subject: String,
  sampleSize: Number,
  startDate: String,
  paused: Boolean,
  archived: Boolean,
  archivedResult: String,
});

const branchSchema = new mongoose.Schema({
  branch: String,
  tests: [tests],
});

const testsSchema = new mongoose.Schema({
  gameID: String,
  branches: [branchSchema],
});

const ABTests = mongoose.model('ABTests', testsSchema);

module.exports = ABTests;