const mongoose = require('mongoose');

const chartObjectsSchema = new mongoose.Schema({
  chartObjects: String
});
const dashboardSchema = new mongoose.Schema({
  id: String,
  name: String,
  charts: [chartObjectsSchema]
});

const branchSchema = new mongoose.Schema({
  branch: String,
  dashboards: [dashboardSchema],
});

const gameSchema = new mongoose.Schema({
  gameID: String,
  branches: [branchSchema],
});

const charts = mongoose.model('charts', gameSchema);

module.exports = charts;