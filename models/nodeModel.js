const mongoose = require('mongoose');
// Определение основной схемы нод планирования
const customPropertySchema = new mongoose.Schema({
    propertyID: String,
    valueType: String,
    value: String,
  });
  
  const entityPropertiesSchema = new mongoose.Schema({
    entityID: String,
    isInAppPurchase: Boolean,
    softValue: Number,
    hardValue: Number,
    realValue: Number,
    customProperties: [customPropertySchema],
  });
  
  const nodeSchema = new mongoose.Schema({
    nodeID: {
      type: String,
      required: true,
    },
    name: String,
    description: {
      content: String,
      publishLink: String,
    },
    techDescription: {
      content: String,
      publishLink: String,
    },
    remoteConfigParams: [String],
    analyticsEvents: [String],
    entityProperties: entityPropertiesSchema,
  });
  
  const planningTypeSchema = new mongoose.Schema({
    type: {
      type: String,
      required: true,
      enum: ['entity', 'gameplay'],
    },
    nodes: [nodeSchema],
  });
  
  const branchSchema = new mongoose.Schema({
    branch: {
      type: String,
      enum: ['development', 'stage', 'production'],
      required: true,
    },
    planningTypes: [planningTypeSchema],
  });
  
  const resultNodeSchema = new mongoose.Schema({
    gameID: String,
    branches: [branchSchema],
  });
  
  // Создание модели на основе схемы
  const NodeModel = mongoose.model('Node', resultNodeSchema, 'nodes');

  module.exports = NodeModel;