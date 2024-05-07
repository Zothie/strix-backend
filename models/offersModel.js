const mongoose = require('mongoose');

  const offerSchema = new mongoose.Schema({
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
    offerTriggers: [String],

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
    },

    content: Array,
  });
  
  const branchSchema = new mongoose.Schema({
    branch: {
      type: String,
      enum: ['development', 'stage', 'production'],
      required: true,
    },
    offers: [offerSchema],
    positions: String,
  });
  
  const resultSchema = new mongoose.Schema({
    gameID: String,
    branches: [branchSchema],
  });
  
  const OffersModel = mongoose.model('Offer', resultSchema, 'offers');

  module.exports = OffersModel;