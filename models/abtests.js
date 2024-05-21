import { Schema, model } from 'mongoose';

const tests = new Schema({
  id: String,
  codename: String,
  name: String,
  comment: String,
  segments: String,
  observedMetric: String,
  subject: String,
  sampleSize: Number,
  startDate: String,
  paused: Boolean,
  archived: Boolean,
  archivedResult: String,
});

const branchSchema = new Schema({
  branch: String,
  tests: [tests],
});

const testsSchema = new Schema({
  gameID: String,
  branches: [branchSchema],
});

export const ABTests = model('ABTests', testsSchema);
