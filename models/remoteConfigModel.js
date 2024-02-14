const mongoose = require('mongoose');

const valueSchema = new mongoose.Schema({
  segmentID: String,
  value: String,
  valueFileName: String,
  isTesting: Boolean,
  testID: String,
  isEventOverriden: Boolean,
  eventID: String,
});

const paramSchema = new mongoose.Schema({
  paramID: {
    type: String,
    required: true,
  },
  paramName: String,
  paramCodeName: String,
  valueType: String,
  values: [valueSchema],
});

const branchSchema = new mongoose.Schema({
  branch: {
    type: String,
    enum: ['development', 'stage', 'production'],
    required: true,
  },
  params: [paramSchema],
});

const remoteConfigSchema = new mongoose.Schema({
  gameID: {
    type: String,
    required: true,
  },
  branches: [branchSchema],
});

const RemoteConfig = mongoose.model('RemoteConfig', remoteConfigSchema);

module.exports = RemoteConfig;