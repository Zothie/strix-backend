import { Schema, model } from 'mongoose';const studiosSchema = new Schema({
    studioID: String,
    studioName: String,
    studioIcon: String,
    apiKey: String,
    scheduledDeletionDate: Date,
    games: [{ 
      gameID: String }],
    users: [{ 
      userID: String, 
      userPermissions: [{ permission: String }] }]
  });
  
  export const Studio = model('Studio', studiosSchema);

