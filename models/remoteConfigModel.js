import { Schema, model } from 'mongoose';
const valueSchema = new Schema({
  segmentID: String,
  value: String,
  valueFileName: String,
  isTesting: Boolean,
  testID: String,
  isEventOverriden: Boolean,
  eventID: String,
});

const paramSchema = new Schema({
  paramID: {
    type: String,
    required: true,
  },
  paramName: String,
  paramCodeName: String,
  valueType: String,
  values: [valueSchema],
});

const branchSchema = new Schema({
  branch: {
    type: String,
    enum: ['development', 'stage', 'production'],
    required: true,
  },
  params: [paramSchema],
});

const remoteConfigSchema = new Schema({
  gameID: {
    type: String,
    required: true,
  },
  branches: [branchSchema],
});

export const RemoteConfig = model('RemoteConfig', remoteConfigSchema);