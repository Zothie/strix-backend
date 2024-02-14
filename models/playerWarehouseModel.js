const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  propertyID: String,
  name: String,
  valueType: String,
  value: String,
});

const entitiesSchema = new mongoose.Schema({
  entityID: String,
  quantity: Number,
  properties: [propertySchema],
});
const inventorySchema = new mongoose.Schema({
    entities: [entitiesSchema],
  });

const analyticsElementSchema = new mongoose.Schema({
  elementID: String,
  elementValue: String,
  elementValues: [String],
});

const statisticsElementSchema = new mongoose.Schema({
  elementID: String,
  elementValue: String,
});

const goodsSchema = new mongoose.Schema({
  goodID: String,
  goodLimitLeft: Number,
});

const playerSchema = new mongoose.Schema({
  clientID: String,
  elements: {
    analytics: [analyticsElementSchema],
    statistics: [statisticsElementSchema],
  },
  inventory: [inventorySchema],
  goods: [goodsSchema],
  abtests: [String],
  segments: [String],
});
const templatesStatistics = new mongoose.Schema({
    templateID: String,
    templateName: String,
    templateCodeName: String,
    templateType: String,
    templateDefaultValue: String,
    templateValueRangeMin: String,
    templateValueRangeMax: String,
})
const conditionSchema = new mongoose.Schema({
    conditionEnabled: Boolean,
    condition: String,
    conditionValue: String,
    conditionSecondaryValue: String,
    conditionValueID: String,
})
const templatesAnalytics = new mongoose.Schema({
    templateID: String,
    templateName: String,
    templateMethod: String,
    templateMethodTime: String,
    templateConditions: [conditionSchema],
    templateAnalyticEventID: String,
    templateEventTargetValueId: String,
})
const templatesSchema = new mongoose.Schema({
    analytics: [templatesAnalytics],
    statistics: [templatesStatistics],
})
const branchSchema = new mongoose.Schema({
  branch: {
    type: String,
    enum: ['development', 'stage', 'production'],
    required: true,
  },
  templates: templatesSchema,
  players: [playerSchema],
});

const playerWarehouseSchema = new mongoose.Schema({
  gameID: {
    type: String,
    required: true,
  },
  branches: [branchSchema],
});

const PlayerWarehouse = mongoose.model('PlayerWarehouse', playerWarehouseSchema);

module.exports = PlayerWarehouse;