import { PlanningTreeModel } from "../../models/planningTreeModel.js";
import { User } from "../../models/userModel.js";
import { NodeModel } from "../../models/nodeModel.js";
import { Game } from "../../models/gameModel.js";
import { Studio } from "../../models/studioModel.js";
import { Publisher } from "../../models/publisherModel.js";
import { RemoteConfig } from "../../models/remoteConfigModel.js";
import { AnalyticsEvents } from "../../models/analyticsevents.js";
import { Segments } from "../../models/segmentsModel.js";
import { Relations } from "../../models/relationsModel.js";
import { Localization } from "../../models/localizationModel.js";
import { OffersModel as Offers } from "../../models/offersModel.js";
import { charts as CustomCharts } from "../../models/charts.js";
import { ABTests } from "../../models/abtests.js";
import { PWplayers } from "../../models/PWplayers.js";
import { PWtemplates } from "../../models/PWtemplates.js";

import * as segmentsLib from "../../libs/segmentsLib.mjs";
import druidLib from "../../libs/druidLib.cjs";
import * as playerWarehouseLib from "../../libs/playerWarehouseLib.mjs";

import { v4 as uuid } from "uuid";
import jwt from "jsonwebtoken";
import secretKey from "dotenv";
import axios from "axios";
import moment from "moment";
import http from "http";
import dayjs from "dayjs";
import jStat from "jstat";
import abTestResults from "ab-test-result";
import * as d3 from "d3-random";
import crypto from "crypto";
import nodemailer from "nodemailer";
import bcrypt from "bcrypt";
import firebase from "firebase-admin";



const demoGames = ['brawlDemo']


export function isDemoGameID(gameID) {
  // Checking if gameID contains demo gameID at the start
  for (const demoGameID of demoGames) {
    if (gameID.startsWith(demoGameID)) {
      return demoGameID;
    }
  }
  return gameID;
}

export async function generateAvgProfile({
  gameID, 
  branchName, 
  filterSegments = [], 
  skipSubprofiles = false,
  salesCount = 100,
}) {

  if (!gameID || !branchName) {
    return []
  }
  let templates = await PWtemplates.find({ gameID, 'branches.branch': branchName }, { 'branches.$': 1 })
  if (templates.length === 0) {
    return []
  }
  templates = templates[0].branches[0].templates

  const templateNames = []
  .concat(templates.analytics.map(template => ({name: template.templateName, id: template.templateID})))
  .concat(templates.statistics.map(template => ({name: template.templateName, id: template.templateID})))


  const segments = ['everyone', ...filterSegments]

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }
  function getSampleSize(totalSampleSize, confidenceLevel) {
    const n = clamp(totalSampleSize, 1, totalSampleSize);

    const expectedProportion = 0.5;
    const marginOfError = 0.05;

    const z = confidenceLevel === 0.95 ? 1.96 : 2.58;

    let sampleSize = Math.ceil(Math.pow((z * Math.sqrt(expectedProportion * (1 - expectedProportion))) / marginOfError, 2));
    sampleSize = clamp(sampleSize, 1, n);

    return sampleSize;
  }

  const sampleSize = getSampleSize(salesCount, 0.999)
  
  let players = await PWplayers.find({
    gameID: isDemoGameID(gameID),
    branch: branchName,
    segments: { $in: segments },
    "elements.analytics": {
      $elemMatch: { elementID: "totalPaymentsCount", elementValue: { $gt: 0 } },
    },
  })
    .limit(sampleSize)
    .lean();
  
  let elementData = {};

  for (let player of players) {
    let elements = [].concat(player.elements.analytics, player.elements.statistics);
    
    for (let element of elements) {
      let { elementID, elementValue } = element;

      if (!elementData[elementID]) {
        elementData[elementID] = {
          name: templateNames.find(t => t.id === elementID)?.name || elementID,
          templateID: elementID,
          totalPlayers: 0,
          subProfiles: {}
        };
      }

      elementData[elementID].totalPlayers++;
      
      if (!elementData[elementID].subProfiles[elementValue]) {
        elementData[elementID].subProfiles[elementValue] = {
          value: elementValue,
          players: 0
        };
      }
      
      elementData[elementID].subProfiles[elementValue].players++;
    }
  }

  let avgProfile = Object.values(elementData).map(element => {
    let maxSubProfile = Object.values(element.subProfiles).reduce((a, b) => (a.players > b.players ? a : b));
    let subProfiles = Object.values(element.subProfiles).filter(subProfile => subProfile.value !== maxSubProfile.value);
    return {
      name: element.name,
      value: maxSubProfile.value,
      templateID: element.templateID,
      players: maxSubProfile.players,
      subProfiles: skipSubprofiles ? [] : subProfiles
    };
  });
  return avgProfile;
}

export function arraySum(numbers) {
  return numbers.reduce((accumulator, currentValue) => {
    return accumulator + currentValue;
  }, 0);
} 



// Generate random data for testing.
// Trend is int between -1 and 1 (everyday change)
// Deviation is any int. Dev. 0.5 means that every day will be +/- 0.5 of trend
export async function generateRandomDataByDays(
  startDate, 
  endDate, 
  minValue, 
  maxValue,
  trend, 
  deviation, 
  toFixedAmount = 2, 
  categoryFieldName = 'timestamp', 
  valueFieldName = 'value'
  ) {
  let currentDate = new Date(startDate);
  let lastGeneratedValue = randomNumberInRange(minValue, maxValue);

  let randomData = [];
  while (currentDate <= endDate) {
    let calcRandAdditiveTrend = 1 - randomNumberInRange(-deviation, deviation)
    let randomValue = lastGeneratedValue + (lastGeneratedValue * trend * calcRandAdditiveTrend)


    randomValue = parseFloat(randomValue.toFixed(toFixedAmount));

    randomData.push({
      [categoryFieldName]: currentDate.toISOString(),
      [valueFieldName]: randomValue
    });

    lastGeneratedValue = randomValue;
    
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return randomData;
}
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
export async function generateRandomDataByDaysNonLinear(
  startDate, 
  endDate, 
  minValue, 
  maxValue,
  trend, 
  deviation, 
  toFixedAmount = 2, 
  categoryFieldName = 'timestamp', 
  valueFieldName = 'value'
  ) {
  let currentDate = new Date(startDate);
  let lastGeneratedValue = randomNumberInRange(minValue, maxValue);

  let sinFrequencyMultiplier = 0.1
  let randomData = [];
  let iteration = 0;

  let declineIterationPoint = randomNumberInRange(7, 17)
  let stopIterationPoint = declineIterationPoint+randomNumberInRange(4, 10)

  while (currentDate <= endDate) {
    iteration += 1;
    let currentDeviation = deviation;
    let currentSinMultiplier = sinFrequencyMultiplier;

    if (iteration > declineIterationPoint && iteration <= stopIterationPoint) {
      currentDeviation *= (stopIterationPoint - iteration) / 3;
      currentSinMultiplier *= (stopIterationPoint - iteration) / 3;
    } else if (iteration > stopIterationPoint) {
      currentSinMultiplier = 0;
    }

    let calcRandAdditiveTrend = clamp(randomNumberInRange(-currentDeviation, currentDeviation, true), 0, 1);
    let trendFactor = Math.sin((iteration * calcRandAdditiveTrend) * currentSinMultiplier) + 1;

    let randomValue
    if (currentDeviation == 0 || currentSinMultiplier == 0) {
      randomValue = lastGeneratedValue + (lastGeneratedValue * trend * calcRandAdditiveTrend);
    } else {
      randomValue = lastGeneratedValue + (lastGeneratedValue * trend * calcRandAdditiveTrend * trendFactor);
    }
    randomValue = parseFloat(Math.ceil(randomValue).toFixed(toFixedAmount));

    randomData.push({
      [categoryFieldName]: currentDate.toISOString(),
      [valueFieldName]: randomValue
    });

    lastGeneratedValue = randomValue;
    
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return randomData;
}
export function NonAsyncGenerateRandomDataByDays(
  startDate, 
  endDate, 
  minValue, 
  maxValue,
  trend, 
  deviation, 
  toFixedAmount = 2, 
  categoryFieldName = 'timestamp', 
  valueFieldName = 'value'
  ) {
  let currentDate = new Date(startDate);
  let lastGeneratedValue = randomNumberInRange(minValue, maxValue);

  let randomData = [];
  while (currentDate <= endDate) {
    let calcRandAdditiveTrend = 1 - randomNumberInRange(-deviation, deviation)
    let randomValue = lastGeneratedValue + (lastGeneratedValue * trend * calcRandAdditiveTrend)


    randomValue = parseFloat(randomValue.toFixed(toFixedAmount));

    randomData.push({
      [categoryFieldName]: currentDate.toISOString(),
      [valueFieldName]: randomValue
    });

    lastGeneratedValue = randomValue;
    
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return randomData;
}
export async function generateRandomDataByDaysAndGroups(
  startDate, 
  endDate, 
  minValue, 
  maxValue,
  trend, 
  deviation, 
  toFixedAmount = 2, 
  categoryFieldName = 'timestamp', 
  categoriesArray = [],
  valueFieldName = 'value'
  ) {
  let currentDate = new Date(startDate);
  let lastGeneratedValue = randomNumberInRange(minValue, maxValue);

  let randomData = [];
  while (currentDate <= endDate) {
    let calcRandAdditiveTrend = trend - randomNumberInRange(-deviation, deviation)
    let randomValue = lastGeneratedValue + (lastGeneratedValue * calcRandAdditiveTrend)


    randomValue = parseFloat(randomValue.toFixed(toFixedAmount));

    randomData.push({
      [categoryFieldName]: currentDate.toISOString(),
      [valueFieldName]: randomValue
    });

    lastGeneratedValue = randomValue;
    
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return randomData;
}
export async function generateRandomDataByNumber(startNum, endNum, minValue, maxValue, trend, deviation, toFixedAmount, categoryFieldName, valueFieldName) {
  let currentNum = startNum;
  let lastGeneratedValue = randomNumberInRange(minValue, maxValue);

  let randomData = [];
  while (currentNum <= endNum) {
    let calcRandAdditiveTrend = trend - randomNumberInRange(-deviation, deviation)
    let randomValue = lastGeneratedValue + (lastGeneratedValue * calcRandAdditiveTrend)


    randomValue = parseFloat(randomValue.toFixed(toFixedAmount));

    randomData.push({
      [categoryFieldName]: currentNum,
      [valueFieldName]: randomValue
    });

    lastGeneratedValue = randomValue;
    
    currentNum += 1;
  }

  return randomData;
}

export const randomNumberInRange = (min, max, isFloat, toFixed = 3) => {
  if (isFloat) {
    return parseFloat(Math.random() * (max - min) + min).toFixed(toFixed);
  } else {
    return Math.round(Math.random() * (max - min)) + min;
  }
};

export async function getPlayersFromSegment(gameID, branchName, segmentIDs) {
  try {
    const segments = await Segments.findOne(
      {
        'gameID': gameID,
        'branches.branch': branchName,
      },
      { 'branches.segments': 1, '_id': 0 }
    );

    if (!segments) {
      throw new Error(`Game or branch not found for gameID: ${gameID} and branchName: ${branchName}`);
    }

    const playerIDsSet = new Set();

    segments.branches.forEach((branch) => {
        branch.segments.forEach((segment) => {
          if (segmentIDs.includes(segment.segmentID)) {

            segment.segmentPlayerIDs.forEach((playerID) => {
              playerIDsSet.add(playerID);
            });

          }
    });

  });

    const playerIDsArray = Array.from(playerIDsSet);

    return playerIDsArray;


  } catch (error) {
    console.error(error.message);
    return [];
  }
}

export async function checkOrganizationAuthority(token, orgID) {
  try {
    // Verify the token
    const decodedToken = await firebase.auth().verifyIdToken(token);
    const uid = decodedToken.uid;
    if (!uid) {
      throw new Error('Invalid or expired token');
    }

    // Check user organization authority
    const checkAuthority = await checkUserOrganizationAuthority(orgID, uid);
    return checkAuthority;
  } catch (error) {
    throw error;
  }
}

export async function fetchUsersName(usersEmails) {
  const users = await User.find({ email: { $in: usersEmails } });
  return users.map(user => ({ email: user.email, username: user.username }));
}

export async function buildDemo() {
  const demoUserEmail = 'demoUser_' + uuid();

  const newUser = new User({ 
    username: 'Demo User', 
    role: 'Demo', 
    email: demoUserEmail, 
    password: demoUserEmail, 
    isDemo: true 
  });
  await newUser.save();

  const publisherID = 'demo_' + uuid();
  const publisher = new Publisher({ 
    publisherID, 
    publisherName: 'Demo Publisher' 
  });
  const newPermission = { permission: 'admin' };
  publisher.users.push({ userID: demoUserEmail, userPermissions: [newPermission] });
      
  const studioID = 'demo_' + uuid();
  const studio = new Studio({ 
    studioID, 
    studioName: 'Demo Studio', 
    apiKey: 'demo_' + uuid(), 
    studioIcon: '' 
  });
  studio.users.push({ userID: demoUserEmail, userPermissions: [newPermission] });
  await studio.save();

  publisher.studios.push({ studioID });
  await publisher.save();

  await createDemoGame('brawlDemo', studioID);

  try {
    const customToken = await firebase.auth().createCustomToken(demoUserEmail);
    return customToken;
  } catch (error) {
    throw new Error('Error building demo: ' + error.message);
  }
}

export async function createDemoGame(demoGameID, studioID) {

  const newGameID = `${demoGameID}_${uuid()}`;

  const demoGame = await Game.findOne({ gameID: demoGameID });
  const newGame = new Game({
    gameID: newGameID,
    gameName: demoGame.gameName,
    gameEngine: demoGame.gameEngine,
    gameIcon: demoGame.gameIcon,
    gameSecretKey: uuid(),
  });
  await newGame.save();

  await Studio.findOneAndUpdate(
    { studioID: studioID },
    { $push: { games: { gameID: newGameID } } },
    { new: true }
  );

  //
  //
  // Populating existing collestions with new game
  //
  //
  // Creating new game doc in NodeModel
  const demoNodeModel = await NodeModel.findOne({ gameID: demoGameID }, {_id: 0}).lean();
  const newNodeModel = new NodeModel({
    ...demoNodeModel,
    gameID: newGameID,
  });
  await newNodeModel.save();

  // Creating new game doc in AnalyticsEvents
  const demoAnalyticsEvents = await AnalyticsEvents.findOne({ gameID: demoGameID }, {_id: 0}).lean();
  const newAnalyticsEvents = new AnalyticsEvents({
    ...demoAnalyticsEvents,
    gameID: newGameID,
  });
  await newAnalyticsEvents.save();

  // // Creating new game doc in PlayerWarehouse
  // const demoPWplayers = PWplayers.aggregate([
  //   { $match: { gameID: demoGameID } },
  //   { $group: { _id: null, players: { $push: '$$ROOT' } } },
  // ]);
  // await PWplayers.collection.insertMany({
  //   gameID: newGameID,
  //   ...demoPWplayers,
  // });

  const demoPWtemplates = await PWtemplates.findOne({ gameID: demoGameID }, {_id: 0}).lean();
  const newPWtemplates = new PWtemplates({
    ...demoPWtemplates,
    gameID: newGameID,
  });
  await newPWtemplates.save();

  // Creating new game doc in RemoteConfig
  const demoRemoteConfig = await RemoteConfig.findOne({ gameID: demoGameID }, {_id: 0}).lean();
  const newRemoteConfig = new RemoteConfig({
    gameID: newGameID,
    ...demoRemoteConfig,
  });
  await newRemoteConfig.save();

  // Creating new game doc in Segments
  const demoSegments = await Segments.findOne({ gameID: demoGameID }, {_id: 0}).lean();
  const newSegments = new Segments({
    ...demoSegments,
    gameID: newGameID,
  });
  await newSegments.save();

  // Creating new game doc in Planning Tree
  const demoTree = await PlanningTreeModel.findOne({ gameID: demoGameID }, {_id: 0}).lean();
  const newTree = {
    gameID: newGameID,
    ...demoTree,
  };
  await PlanningTreeModel.create(newTree);

  // Creating new game doc in Relations
  const demoRelations = await Relations.findOne({ gameID: demoGameID }, {_id: 0}).lean();
  const newRelations = new Relations({
    ...demoRelations,
    gameID: newGameID,
  });
  await newRelations.save();

  // Creating new game doc in Localization
  const demoLocalization = await Localization.findOne({ gameID: demoGameID }, {_id: 0}).lean();
  const newLocalization = new Localization({
    ...demoLocalization,
    gameID: newGameID,
  });
  await newLocalization.save();

  const demoOffers = await Offers.findOne({ gameID: demoGameID }, {_id: 0}).lean();
  const newOffers = new Offers({
    ...demoOffers,
    gameID: newGameID,
  });
  await newOffers.save();

  const demoCustomCharts = await CustomCharts.findOne({ gameID: demoGameID }, {_id: 0}).lean();
  const newCustomCharts = new CustomCharts({
    ...demoCustomCharts,
    gameID: newGameID,
  });
  await newCustomCharts.save();

  const demoABTests = await ABTests.findOne({ gameID: demoGameID }, {_id: 0}).lean();
  const newABTests = new ABTests({
    ...demoABTests,
    gameID: newGameID,
  });
  await newABTests.save();
}

export async function finishUserOnboarding({ publisherName, email, username, jobTitle, studioName, studioApiKey, studioIcon }) {
  const user = await User.findOne({ email });
  if (!user) {
    throw new Error('User not found');
  }

  user.role = jobTitle;
  user.username = username;
  await user.save();

  const publisherID = uuid();
  const publisher = new Publisher({ publisherID, publisherName });
  const newPermission = { permission: 'admin' };
  publisher.users.push({ userID: user.email, userPermissions: [newPermission] });

  const studioID = uuid();
  const studio = new Studio({ studioID, studioName, apiKey: studioApiKey, studioIcon });
  studio.users.push({ userID: user.email, userPermissions: [newPermission] });
  await studio.save();

  publisher.studios.push({ studioID });
  await publisher.save();

  await createDemoGame('brawlDemo', studioID);

  return {
    publisherID: publisher.publisherID,
    publisherName: publisher.publisherName,
  };
}

export function generateASKU(gameID, offerID) {
  const prefix = "strix_";
  const characters = "0123456789abcdefghijklmnopqrstuvwxyz";
  let result = "";
  for (let i = 0; i < 20; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  // Save newly created asku to db
  updateOfferASKU(gameID, offerID, prefix + result);

  return prefix + result;
}



// Generate secret hash with crypto to use for encryption
const key = crypto
  .createHash('sha512')
  .update(process.env.ENCRYPT_SECRET_KEY)
  .digest('hex')
  .substring(0, 32)
const encryptionIV = crypto
  .createHash('sha512')
  .update(process.env.ENCRYPT_SECRET_KEY)
  .digest('hex')
  .substring(0, 16)

export function encryptString(data) {
  const cipher = crypto.createCipheriv("aes-256-cbc", key, encryptionIV)
  return Buffer.from(
    cipher.update(data, 'utf8', 'hex') + cipher.final('hex')
  ).toString('base64')
}

export function decryptString(data) {
  const buff = Buffer.from(data, 'base64')
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, encryptionIV)
  return (
    decipher.update(buff.toString('utf8'), 'hex', 'utf8') +
    decipher.final('utf8')
  )
}