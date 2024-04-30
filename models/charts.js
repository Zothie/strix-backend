const mongoose = require('mongoose');

const dashboardSchema = new mongoose.Schema({
  id: String,
  name: String,
  linkName: String,
  charts: String
});

const branchSchema = new mongoose.Schema({
  branch: String,
  dashboards: [dashboardSchema],
  profileCompositionPresets: String,
});

const gameSchema = new mongoose.Schema({
  gameID: String,
  branches: [branchSchema],
});

const charts = mongoose.model('charts', gameSchema);

module.exports = charts;