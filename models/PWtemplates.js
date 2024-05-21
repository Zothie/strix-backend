import { Schema, model } from 'mongoose';
const templatesStatistics = new Schema({
    templateID: String,
    templateName: String,
    templateCodeName: String,
    templateType: String,
    templateDefaultValue: String,
    templateValueRangeMin: String,
    templateValueRangeMax: String,
})
const conditionSchema = new Schema({
    conditionEnabled: Boolean,
    condition: String,
    conditionValue: String,
    conditionSecondaryValue: String,
    conditionValueID: String,
})
const templatesAnalytics = new Schema({
    templateID: String,
    templateName: String,
    templateMethod: String,
    templateMethodTime: String,
    templateConditions: [conditionSchema],
    templateAnalyticEventID: String,
    templateEventTargetValueId: String,

    // Only for default templates
    templateDefaultVariantType: String,
})
const templatesSchema = new Schema({
    analytics: [templatesAnalytics],
    statistics: [templatesStatistics],
})
const branchSchema = new Schema({
  branch: {
    type: String,
    enum: ['development', 'stage', 'production'],
    required: true,
  },
  templates: templatesSchema,
});

const playerWarehouseSchema = new Schema({
  gameID: {
    type: String,
    required: true,
  },
  branches: [branchSchema],
});

export const PWtemplates = model('pwtemplates', playerWarehouseSchema);

