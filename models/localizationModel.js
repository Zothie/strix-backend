const mongoose = require('mongoose');

  const translationSchema = new mongoose.Schema({
    code: {
      type: String,
      required: true
    },
    value: {
      type: String,
      required: false
    }
  });

  const localizationItemSchema = new mongoose.Schema({
    sid: {
      type: String,
      required: true
    },
    key: String,
    inheritedFrom: String,
    translations: [translationSchema],
  });
  
  const localizationSchema = new mongoose.Schema({
    offers: [localizationItemSchema],
    entities: [localizationItemSchema],
    custom: [localizationItemSchema],
  });
  
  const branchSchema = new mongoose.Schema({
    branch: {
      type: String,
      enum: ['development', 'stage', 'production'],
      required: true,
    },
    localization: localizationSchema,
  });
  
  const resultSchema = new mongoose.Schema({
    gameID: String,
    branches: [branchSchema],
  });
  
  const Localization = mongoose.model('Localization', resultSchema, 'localizations');

  module.exports = Localization;