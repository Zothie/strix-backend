import { Schema, model } from 'mongoose';const publisherSchema = new Schema({
    publisherID: String,
    publisherName: String,
    studios: [{ 
      studioID: String }],
    users: [{ 
      userID: String, 
      userPermissions: [{ permission: String }] }]
  });
  
  export const Publisher = model('Publisher', publisherSchema);

