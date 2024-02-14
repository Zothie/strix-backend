const mongoose = require('mongoose');
const studiosSchema = new mongoose.Schema({
    studioID: String,
    studioName: String,
    games: [{ 
      gameID: String }],
    users: [{ 
      userID: String, 
      userPermissions: [{ permission: String }] }]
  });
  
  const Studio = mongoose.model('Studio', studiosSchema);

  module.exports = Studio;