import { Schema, model } from 'mongoose';
  const entityBasicSchema = new Schema({
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

  const entityCategorySchema = new Schema({
    categoryID: String,

    mainConfigs: String,
    parentCategory: String,
    inheritedCategories: [String],
    inheritedConfigs: String,
  });
  
  const nodeSchema = new Schema({
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
  
  const planningTypeSchema = new Schema({
    type: {
      type: String,
      required: true,
      enum: ['entity', 'gameplay'],
    },
    nodes: [nodeSchema],
  });
  
  const branchSchema = new Schema({
    branch: {
      type: String,
      enum: ['development', 'stage', 'production'],
      required: true,
    },
    planningTypes: [planningTypeSchema],
  });
  
  const resultNodeSchema = new Schema({
    gameID: String,
    branches: [branchSchema],
  });
  
  // Создание модели на основе схемы
  export const NodeModel = model('Node', resultNodeSchema, 'nodes');

