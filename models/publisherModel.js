const mongoose = require('mongoose');
const publisherSchema = new mongoose.Schema({
    publisherID: String,
    publisherName: String,
    studios: [{ 
      studioID: String }],
    users: [{ 
      userID: String, 
      userPermissions: [{ permission: String }] }]
  });
  
  const Publisher = mongoose.model('Publisher', publisherSchema);

  module.exports = Publisher;