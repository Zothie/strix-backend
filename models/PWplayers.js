import { Schema, model } from 'mongoose';
const propertySchema = new Schema({
  propertyID: String,
  name: String,
  valueType: String,
  value: String,
});

const entitiesSchema = new Schema({
  entityID: String,
  quantity: Number,
  properties: [propertySchema],
});
const inventorySchema = new Schema({
    entities: [entitiesSchema],
  });
  const goodsSchema = new Schema({
    goodID: String,
    goodLimitLeft: Number,
  });

const analyticsElementSchema = new Schema({
  elementID: String,
  elementValue: {},
  elementValues: [String],
});

const statisticsElementSchema = new Schema({
  elementID: String,
  elementValue: {
    type: String,
    cast: false,
  },
});


const playerSchema = new Schema({
  gameID: {
    type: String,
    required: true,
  },
  clientID: String,
  branch: {
    type: String,
    enum: ['development', 'stage', 'production'],
    required: true,
  },
  elements: {
    analytics: [analyticsElementSchema],
    statistics: [statisticsElementSchema],
  },
  inventory: [inventorySchema],
  goods: [goodsSchema],
  abtests: [String],
  segments: [String],
});

export const PWplayers = model('pwplayers', playerSchema);

