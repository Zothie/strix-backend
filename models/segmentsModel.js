import { Schema, model } from 'mongoose';

const segmentSchema = new Schema({
  segmentID: {
    type: String,
    required: true,
  },
  segmentName: String,
  segmentComment: String,
  segmentConditions: String,
  segmentPlayerCount: Number,
  segmentPlayerIDs: [String]
});

const branchSchema = new Schema({
  branch: {
    type: String,
    required: true,
  },
  segments: [segmentSchema],
});

const segmentsSchema = new Schema({
  gameID: {
    type: String,
    required: true,
  },
  branches: [branchSchema],
});

export const Segments = model('Segments', segmentsSchema);
