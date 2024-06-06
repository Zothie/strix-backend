import { Schema, model } from 'mongoose';

  const contentItems = new Schema({
    nodeID: String,
    amount: Number,
  })

  const offerSchema = new Schema({
    offerID: String,
    offerName: String,
    offerCodeName: String,
    offerIcon: String,

    offerInGameName: String,
    offerInGameDescription: String,

    offerTags: [String],

    offerPurchaseLimit: Number,
    offerDuration: {
      value: Number,
      timeUnit: String,
    },

    offerSegments: [String],
    offerTriggers: Array,

    offerPrice: {
      targetCurrency: String,
      amount: Number,
      nodeID: String,
      moneyCurr: [
        {
          cur: String,
          amount: Number,
        }
      ],
      discount: Number,
    },

    content: [contentItems],
    removed: Boolean,
  });
  
  const branchSchema = new Schema({
    branch: {
      type: String,
      enum: ['development', 'stage', 'production'],
      required: true,
    },
    offers: [offerSchema],
    positions: String,
    pricing: [
      {
        code: String,
        base: Number,
      }
    ]
  });
  
  const resultSchema = new Schema({
    gameID: String,
    branches: [branchSchema],
  });
  
  export const OffersModel = model('Offer', resultSchema, 'offers');

