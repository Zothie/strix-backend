import { Schema, model } from 'mongoose';
  const translationSchema = new Schema({
    code: {
      type: String,
      required: true
    },
    value: {
      type: String,
      required: false
    }
  });

  const localizationItemSchema = new Schema({
    sid: {
      type: String,
      required: true
    },
    key: String,
    inheritedFrom: String,
    translations: [translationSchema],
  });
  
  const localizationSchema = new Schema({
    offers: [localizationItemSchema],
    entities: [localizationItemSchema],
    custom: [localizationItemSchema],
  });
  
  const branchSchema = new Schema({
    branch: {
      type: String,
      enum: ['development', 'stage', 'production'],
      required: true,
    },
    localization: localizationSchema,
  });
  
  const resultSchema = new Schema({
    gameID: String,
    branches: [branchSchema],
  });
  
  export const Localization = model('Localization', resultSchema, 'localizations');

