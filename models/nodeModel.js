const mongoose = require('mongoose');

  const entityBasicSchema = new mongoose.Schema({
    entityID: String,

    isInAppPurchase: Boolean,
    realValueBase: Number,
    isCurrency: Boolean,

    entityIcon: String,

    mainConfigs: String,
    parentCategory: String,
    inheritedCategories: [String],
    inheritedConfigs: String,
  });

  const entityCategorySchema = new mongoose.Schema({
    categoryID: String,

    mainConfigs: String,
    parentCategory: String,
    inheritedCategories: [String],
    inheritedConfigs: String,
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
    analyticsEvents: [String],
    entityCategory: entityCategorySchema,
    entityBasic: entityBasicSchema,
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