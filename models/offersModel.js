const mongoose = require('mongoose');

  
  const branchSchema = new mongoose.Schema({
    branch: {
      type: String,
      enum: ['development', 'stage', 'production'],
      required: true,
    },
    offers: [offersSchema],
  });
  
  const resultSchema = new mongoose.Schema({
    gameID: String,
    branches: [branchSchema],
  });
  
  const OffersModel = mongoose.model('Offer', offersSchema, 'offers');

  module.exports = OffersModel;