// require('dotenv').config();
import dotenv from 'dotenv';

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import { v4 as uuid } from 'uuid';
import jwt from 'jsonwebtoken';
import secretKey from 'dotenv';
import axios from 'axios';
import moment from 'moment';
import http from 'http';
import dayjs from 'dayjs';
import jStat from 'jstat';
import abTestResults from 'ab-test-result'
import * as d3 from 'd3-random';
// const morgan = require('morgan');

dotenv.config();
const app = express();
const port = 3001;
const host = '0.0.0.0'
const mongoURI = process.env.MONGODB_URI;

app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb'}));
// app.use(morgan('combined'));

import {PlanningTreeModel} from './models/planningTreeModel.js';
import {User} from './models/userModel.js'
import {NodeModel} from './models/nodeModel.js'
import {Game} from './models/gameModel.js'
import {Studio} from './models/studioModel.js'
import {Publisher} from './models/publisherModel.js'
import {RemoteConfig} from './models/remoteConfigModel.js'
import {AnalyticsEvents} from './models/analyticsevents.js'
import {Segments} from './models/segmentsModel.js'
import {Relations} from './models/relationsModel.js'
import {Localization} from './models/localizationModel.js'
import {OffersModel as Offers} from './models/offersModel.js'
import {charts as CustomCharts} from './models/charts.js'
import {ABTests} from './models/abtests.js'
import {PWplayers} from './models/PWplayers.js'
import {PWtemplates} from './models/PWtemplates.js'

import * as segmentsLib from './segmentsLib.mjs'
import druidLib from './druidLib.cjs'
import * as playerWarehouseLib from './playerWarehouseLib.mjs'



mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });


// Firebase
import firebase from 'firebase-admin'
//  Admin SDK config
const firebaseCredentials = {  
  type: `${process.env.FB_ASDK_TYPE}`,
  project_id: `${process.env.FB_ASDK_PROJECT_ID}`,
  private_key_id: `${process.env.FB_ASDK_PROJECT_KEY_ID}`,
  private_key: `${formatPrivateKey(process.env.FB_ASDK_PRIVATE_KEY)}`,
  client_email: `${process.env.FB_ASDK_CLIENT_EMAIL}`,
  client_id: `${process.env.FB_ASDK_CLIENT_ID}`,
  auth_uri: `${process.env.FB_ASDK_AUTH_URI}`,
  token_uri: `${process.env.FB_ASDK_TOKEN_URI}`,
  auth_provider_x509_cert_url: `${process.env.FB_ASDK_AUTH_PROVIDER}`,
  client_x509_cert_url: `${process.env.FB_ASDK_CLIENT_CERT}`,
  universe_domain: `${process.env.FB_ASDK_UNIVERSE_DOMAIN}`,
};
firebase.initializeApp({
  credential: firebase.credential.cert(firebaseCredentials)
});
function formatPrivateKey(key) {
    return key.replace(/\\n/g, "\n")
}

app.use(bodyParser.json());


// CORS
const whitelist = `${process.env.CORS_WHITELIST}`.split(',');
const corsOptions = {
  origin: function (origin, callback) {
    callback(null, true);
    // if (!origin || whitelist.includes(origin)) {
    //   callback(null, true);
    // } else if (origin.match(/https?:\/\/localhost:?[0-9]*$/)) {
    //   callback(null, true);
    // } else {
    //   callback(new Error('Not allowed by CORS'));
    // }
  },
  credentials: false,
};
app.use(cors(corsOptions));


// Регистрация нового пользователя
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;

  try {

    // Проверяем, существует ли пользователь с таким именем
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email is already registered' });
    }
    // Создаем нового пользователя
    const newUser = new User({ email, password });
    await newUser.save();

    admin.auth()
      // Serve email as uid
      .createCustomToken(email)
      .then((customToken) => {
        // Send token back to client
        res.status(201).json({ success: true, token: customToken });
      })

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// Аутентификация пользователя
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (user) {
      const isPasswordMatch = password === user.password;

      if (isPasswordMatch) {

        admin.auth()
        // Serve email as uid
        .createCustomToken(email)
        .then((customToken) => {
          // Send token back to client
          res.status(200).json({ success: true, token: customToken });
        })

      } else {
        res.status(401).json({ message: 'Неверное имя пользователя или пароль' });
      }
    } else {
      res.status(401).json({ message: 'Неверное имя пользователя или пароль' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Ошибка при аутентификации' });
  }
});

// Logout/signout/token revoke
app.post('/api/logout', async (req, res) => {
  const { token } = req.body;

 admin.auth().verifyIdToken(token)
 .then((decodedToken) => {
   // Verify user after verifying token
   const uid = decodedToken.uid;

   // Force revoke user
   admin.auth().revokeRefreshTokens(uid)
     .then(() => {
       res.status(200).send('User logged out successfully');
     })
     .catch((error) => {
       console.error('Error revoking refresh tokens:', error);
       res.status(500).send('Error logging out user');
     });
 })
 .catch((error) => {
   // Обработка ошибок верификации токена
   console.error('Error verifying token:', error);
   res.status(401).send('Invalid or expired token');
 });
});

app.post('/api/finishInitialOnboarding', async (req, res) => {
  const { publisherName, email, username, jobTitle, studioName, studioApiKey, studioIcon } = req.body;

  try {
    const user = await User.findOne({ email });
    if (user) {

      user.role = jobTitle;
      user.username = username;
      await user.save();

      const publisherID = uuid();
      const publisher = new Publisher({ publisherID, publisherName });
      const newPermission = { permission: 'read' };
      publisher.users.push({ userID: user.email, userPermissions: [newPermission] });


      const studioID = uuid();
      const studio = new Studio({ studioID, studioName, apiKey: studioApiKey, studioIcon });
      await studio.save();
  
      publisher.studios.push({ studioID });
      await publisher.save();


      async function createDemoGame() {
            // const demoGameID = `demoGame`;
            const demoGameID = `a5f10dcc-84e2-4c7d-90eb-37f172131396`;

            const newGameID = `demoGame_${uuid()}`;

            const demoGame = await Game.findOne({ gameID: demoGameID });
            const newGame = new Game({
              gameID: newGameID,
              gameName: demoGame.gameName,
              gameEngine: demoGame.gameEngine,
              gameIcon: demoGame.gameIcon,
              gameSecretKey: uuid(),
            });
            await newGame.save();
          
            const updatedStudio = await Studio.findOneAndUpdate(
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
            const demoNodeModel = NodeModel.findOne({ gameID: demoGameID });
            const newNodeModel = new NodeModel({
              gameID: newGameID,
              ...demoNodeModel
            });
            await newNodeModel.save();
          
            // Creating new game doc in AnalyticsEvents
            const demoAnalyticsEvents = AnalyticsEvents.findOne({ gameID: demoGameID });
            const newAnalyticsEvents = new AnalyticsEvents({
              gameID: newGameID,
              ...demoAnalyticsEvents
            });
            await newAnalyticsEvents.save();
          
            // Creating new game doc in PlayerWarehouse
            const demoPWplayers = PWplayers.aggregate([
              { $match: { gameID: demoGameID } },
              { $group: { _id: null, players: { $push: '$$ROOT' } } },
            ]);
            await PWplayers.collection.insertMany({
              gameID: newGameID,
              ...demoPWplayers,
            });

            const demoPWtemplates = PWtemplates.findOne({ gameID: demoGameID });
            const newPWtemplates = new PWtemplates({
              gameID: newGameID,
              ...demoPWtemplates
            });
            await newPWtemplates.save();
          
            // Creating new game doc in RemoteConfig
            const demoRemoteConfig = RemoteConfig.findOne({ gameID: demoGameID });
            const newRemoteConfig = new RemoteConfig({
              gameID: newGameID,
              ...demoRemoteConfig
            });
            await newRemoteConfig.save();
          
            // Creating new game doc in Segments
            const demoSegments = Segments.findOne({ gameID: demoGameID });
            const newSegments = new Segments({
              gameID: newGameID,
              ...demoSegments
            });
            await newSegments.save();
          
            // Creating new game doc in Planning Tree
            const demoTree = PlanningTreeModel.findOne({ gameID: demoGameID });
            const newTree = {
              gameID: newGameID,
              ...demoTree
            };
            await PlanningTreeModel.create(newTree);
          
            // Creating new game doc in Relations
            const demoRelations = Relations.findOne({ gameID: demoGameID });
            const newRelations = new Relations({
              gameID: newGameID,
              ...demoRelations
            });
            await newRelations.save();
          
            // Creating new game doc in Localization
            const demoLocalization = Localization.findOne({ gameID: demoGameID });
            const newLocalization = new Localization({
              gameID: newGameID,
              ...demoLocalization
            });
            await newLocalization.save();
          
            const demoOffers = Offers.findOne({ gameID: demoGameID });
            const newOffers = new Offers({
              gameID: newGameID,
              ...demoOffers
            });
            await newOffers.save();
          
            const demoCustomCharts = CustomCharts.findOne({ gameID: demoGameID });
            const newCustomCharts = new CustomCharts({
              gameID: newGameID,
              ...demoCustomCharts
            });
            await newCustomCharts.save();

            const demoABTests = ABTests.findOne({ gameID: demoGameID });
            const newABTests = new ABTests({
              gameID: newGameID,
              ...demoABTests
            });
            await newABTests.save();
      }
      // createDemoGame()


      res.status(200).json({
        success: true,
        message: 'User onboarded successfully',
        publisherID: publisher.publisherID,
        publisherName: publisher.publisherName,
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Получение списка всех паблишеров
app.post('/api/getPublishers', async (req, res) => {
  const { email } = req.body;

  // Найдите пользователя по email
  const user = await User.findOne({ email });

  if (!user) {
    return res.status(200).json({ success: false, error: 'User not found' });
  }

  const publishers = await Publisher.find(
    {
      'users.userID': user.email,
    },
    'publisherID publisherName -_id'
  );

  res.json({success: true, publishers});
});

app.post('/api/getUser', async (req, res) => {
  const { email } = req.body;

  // Найдите пользователя по email
  const user = await User.findOne({ email });

  if (!user) {
    return res.status(200).json({ success: false, error: 'User not found' });
  }

  res.status(200).json({ success: true, user });
});



// Добавление студии к паблишеру
app.post('/api/addStudio', async (req, res) => {
  // console.log("Новый запрос на создание студии");
  const { publisherID, studioName, apiKey, studioIcon } = req.body;
  // console.log(req.body);

  if (!publisherID || !studioName || !apiKey) {
    return res.status(400).json({ success: false, message: 'Missing required parameters' });
  }

  try {
    const studioID = uuid();
    // Создать нового паблишера
    const studio = new Studio({ studioID, studioName, apiKey, studioIcon });
    // Сохранить паблишера в базу данных
    await studio.save();
    // console.log("Сохраняем студию");
    // Добавляем новоиспечённый uuid студии к паблишеру
    const publisher = await Publisher.findOne({ publisherID });
    if (publisher) {
      publisher.studios.push({ studioID });
      await publisher.save();
    }
    // Создать объект разрешения для read
    // const newPermission = { permission: 'read' };
    // Найти пользователя в паблишерах и добавить разрешение
    // studio.users.push({ userID: user.email, userPermissions: [newPermission] });
    // Сохранить обновленного паблишера
    // await studio.save();
    // console.log("Сейвим студию с разрешением read для пользователя");

    res.json({success: true, message: 'Studio added successfully'});

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.post('/api/getPublisherStudios', async (req, res) => {
  const { publisherID } = req.body;

  try {
    // Найти паблишера по его publisherID
    const publisher = await Publisher.findOne({ publisherID });

    if (publisher) {
      const studioIDs = publisher.studios.map(studio => studio.studioID);

      const studios = await Studio.find({ studioID: { $in: studioIDs } })
        .select('studioID studioName studioIcon');

      const result = studios.map(studio => ({
        studioID: studio.studioID,
        studioName: studio.studioName,
        studioIcon: studio.studioIcon,
      }));

      res.json({success: true, result});
    } else {
      res.status(200).json({ success: false, error: 'Publisher not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(200).json({ success: false, error: 'Internal Server Error' });
  }
});



// Get all studio games
app.post('/api/getStudioGames', async (req, res) => {
  const { studioIDs } = req.body;
  try {
    const studio = await Studio.find({ studioID: { $in: studioIDs } });

    if (!studio) {
      return res.status(404).json({ error: 'Студия не найдена' });
    }

    const gameIDs = studio
                    .map(s => s.games
                      .map(game => game.gameID))
                    .reduce((acc, curr) => acc.concat(curr), []);

    const games = await Game.find({ gameID: { $in: gameIDs } });

    let studiosAndGames = studio.map(s => ({
      studioID: s.studioID,
      games: games.map(g => s.games.some(game => game.gameID === g.gameID) ? g : null).filter(Boolean)
    }));

    res.json(studiosAndGames);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Создание игры в студии
app.post('/api/createGame', async (req, res) => {
  const { studioID, gameName, gameEngine, gameKey, gameIcon } = req.body;

  // Создаем новый gameID с использованием uuid
  const newGameID = uuid();

  try {
    // Создаем новую игру
    const newGame = new Game({
      gameID: newGameID,
      gameName: gameName,
      gameEngine: gameEngine,
      gameIcon: gameIcon,
      gameSecretKey: gameKey,
    });

    // Сохраняем новую игру
    const savedGame = await newGame.save();

    // Обновляем массив games в схеме студии
    const updatedStudio = await Studio.findOneAndUpdate(
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
    const newNodeModel = new NodeModel({
      gameID: newGameID,
      branches: [
        {
          branch: 'development',
          planningTypes: [
            {
              type: 'entity',
              nodes: [
                {
                  nodeID: 'Root',
                  name: 'Root',
                  entityCategory: {
                    categoryID: 'Root',
                    mainConfigs: '',
                    parentCategory: '',
                    inheritedConfigs: '',
                  }
                }
              ],
            },
            {
              type: 'gameplay',
              nodes: [],
            },
          ],
        },
        {
          branch: 'stage',
          planningTypes: [
            {
              type: 'entity',
              nodes: [],
            },
            {
              type: 'gameplay',
              nodes: [],
            },
          ],
        },
        {
          branch: 'production',
          planningTypes: [
            {
              type: 'entity',
              nodes: [],
            },
            {
              type: 'gameplay',
              nodes: [],
            },
          ],
        },
      ],
    });
    await newNodeModel.save();

    // Creating new game doc in AnalyticsEvents
    const newAnalyticsEvents = new AnalyticsEvents({
      gameID: newGameID,
      branches: [
        {
          branch: 'development',
          events: [],
        },
        {
          branch: 'stage',
          events: [],
        },
        {
          branch: 'production',
          events: [],
        },
      ],
    });
    await newAnalyticsEvents.save();

    const newPWtemplates = new PWtemplates({
      gameID: newGameID,
      branches: [
        {
          branch: 'development',
          templates: {
            analytics: [
              {
                templateID: 'lastReturnDate',
                templateName: 'Last Return Date',
              },
              {
                templateID: 'lastPaymentDate',
                templateName: 'Last Payment Date',
              },
              {
                templateID: 'totalPaymentsSumm',
                templateName: 'Total Payments Summ',
              },
              {
                templateID: 'totalPaymentsCount',
                templateName: 'Total Payments Count',
              },
              {
                templateID: 'country',
                templateName: 'Country',
              },
              {
                templateID: 'engineVersion',
                templateName: 'Engine Version',
              },
              {
                templateID: 'gameVersion',
                templateName: 'Game Version',
              },
              {
                templateID: 'language',
                templateName: 'Language',
              },
              {
                templateID: 'meanSessionLength',
                templateName: 'Mean. Session Length',
              },
            ],
            statistics: [

            ]
          },
          players: []
        },
        {
          branch: 'stage',
          templates: {},
          players: []
        },
        {
          branch: 'production',
          templates: {},
          players: []
        },
      ],
    });
    await newPWtemplates.save();


    // Creating new game doc in RemoteConfig
    const newRemoteConfig = new RemoteConfig({
      gameID: newGameID,
      branches: [
        {
          branch: 'development',
          params: []
        },
        {
          branch: 'stage',
          params: []
        },
        {
          branch: 'production',
          params: []
        },
      ],
    });
    await newRemoteConfig.save();

    // Creating new game doc in Segments
    const newSegments = new Segments({
      gameID: newGameID,
      branches: [
        {
          branch: 'development',
          segments: [{ segmentID: 'everyone', segmentName: 'Everyone', segmentComment: '' }]
        },
        {
          branch: 'stage',
          segments: [{ segmentID: 'everyone', segmentName: 'Everyone', segmentComment: '' }]
        },
        {
          branch: 'production',
          segments: [{ segmentID: 'everyone', segmentName: 'Everyone', segmentComment: '' }]
        },
      ],
    });
    await newSegments.save();

    // Creating new game doc in Planning Tree
    const newTree = {
      gameID: newGameID,
      branches: [
        {
        branch: 'development',
        planningTypes: [
          {
          type: 'entity',
          nodes: [{
            nodeID: 'Root',
            isCategory: true,
            subnodes: [],
          }],
          },
          {
          type: 'gameplay',
          nodes: [{
            nodeID: 'Root',
            subnodes: [],
          }],
          }
        ]
        },
        {
        branch: 'stage',
        planningTypes: [
          {
          type: 'entity',
          nodes: [{
            nodeID: 'Root',
            subnodes: [],
          }],
          },
          {
          type: 'gameplay',
          nodes: [{
            nodeID: 'Root',
            subnodes: [],
          }],
          }
        ]
        },
        {
        branch: 'production',
        planningTypes: [
            {
            type: 'entity',
            nodes: [{
              nodeID: 'Root',
              subnodes: [],
            }],
            },
            {
            type: 'gameplay',
            nodes: [{
              nodeID: 'Root',
              subnodes: [],
            }],
            }
          ]
        }
    ],
    };
    await PlanningTreeModel.create(newTree);

    // Creating new game doc in Relations
    const newRelations = new Relations({
      gameID: newGameID,
      branches: [
        {
          branch: 'development',
          relations: [],
          contexts: [],
        },
        {
          branch: 'stage',
          relations: [],
          contexts: [],
        },
        {
          branch: 'production',
          relations: [],
          contexts: [],
        },
      ],
    });
    await newRelations.save();

    // Creating new game doc in Localization
    const newLocalization = new Localization({
      gameID: newGameID,
      branches: [
        {
          branch: 'development',
          localization: {
            offers: [],
            entities: [],
            custom: [],
          },
        },
        {
          branch: 'stage',
          localization: {
            offers: [],
            entities: [],
            custom: [],
          },
        },
        {
          branch: 'production',
          localization: {
            offers: [],
            entities: [],
            custom: [],
          },
        },
      ],
    });
    await newLocalization.save();

    const newOffers = new Offers({
      gameID: newGameID,
      branches: [
        {
          branch: 'development',
          offers: [],
        },
        {
          branch: 'stage',
          offers: [],
        },
        {
          branch: 'production',
          offers: [],
        },
      ],
    });
    await newOffers.save();

    const newCustomCharts = new CustomCharts({
      gameID: newGameID,
      branches: [
        {
          branch: 'development',
          dashboards: [],
        },
        {
          branch: 'stage',
          dashboards: [],
        },
        {
          branch: 'production',
          dashboards: [],
        },
      ],
    });
    await newCustomCharts.save();

    const newABTests = new ABTests({
      gameID: newGameID,
      branches: [
        {
          branch: 'development',
          tests: [],
        },
        {
          branch: 'stage',
          tests: [],
        },
        {
          branch: 'production',
          tests: [],
        },
      ],
    });
    await newABTests.save();


    res.json({ success: true, gameID: newGameID });
  } catch (error) {
    console.error(error);
    res.status(200).json({ success: false, error: 'Internal server error' });
  }
});
// Removing game
app.post('/api/removeGame', async (req, res) => {

  const {studioID, gameID} = req.body

  try {
    // Removing all documents with this game
    // Studio.findOneAndUpdate(
    //   { studioID: studioID },
    //   { $pull: { games: { gameID: gameID } } },
    //   { new: true }
    // );
    // NodeModel.findOneAndRemove({ gameID });
    // Segments.findOneAndRemove({ gameID });
    // Relations.findOneAndRemove({ gameID });
    // PlayerWarehouse.findOneAndRemove({ gameID });
    // AnalyticsEvents.findOneAndRemove({ gameID });
    // RemoteConfig.findOneAndRemove({ gameID });
    // PlanningTreeModel.findOneAndRemove({ gameID });

    const currentDate = new Date();
    const deletionDate = new Date(currentDate);
    deletionDate.setHours(currentDate.getHours() + 72);

    await Game.findOneAndUpdate({gameID}, {$set: {scheduledDeletionDate: deletionDate}}, {new: true, upsert: true});

    // await Game.findOneAndRemove({ gameID });

    res.status(200).json({success: true, message: 'Game scheduled successfully'})

  } catch (error) {
    console.error('Error removeGame:', error)
    res.status(200).json({success: false, message: 'Internal Server Error'})
  }
});
app.post('/api/cancelRemoveGame', async (req, res) => {

  const {studioID, gameID} = req.body

  try {
    // Removing all documents with this game
    // Studio.findOneAndUpdate(
    //   { studioID: studioID },
    //   { $pull: { games: { gameID: gameID } } },
    //   { new: true }
    // );
    // NodeModel.findOneAndRemove({ gameID });
    // Segments.findOneAndRemove({ gameID });
    // Relations.findOneAndRemove({ gameID });
    // PlayerWarehouse.findOneAndRemove({ gameID });
    // AnalyticsEvents.findOneAndRemove({ gameID });
    // RemoteConfig.findOneAndRemove({ gameID });
    // PlanningTreeModel.findOneAndRemove({ gameID });

    await Game.findOneAndUpdate({gameID}, {$unset: { scheduledDeletionDate: "" }}, {new: true, upsert: true});

    // await Game.findOneAndRemove({ gameID });

    res.status(200).json({success: true, message: 'Game scheduled successfully'})

  } catch (error) {
    console.error('Error removeGame:', error)
    res.status(200).json({success: false, message: 'Internal Server Error'})
  }
});


// Getting studio details for settings modal
app.post('/api/getStudioDetails', async (req, res) => {
  try {
    const {studioID} = req.body;
    if (!studioID) {
      return res.status(400).send('Studio ID is required');
    }

    const studio = await Studio.findOne({ studioID: studioID });
    if (!studio) {
      return res.status(404).send('Studio not found');
    }

    res.json({ success: true,
      studioName: studio.studioName,
      studioIcon: studio.studioIcon,
      apiKey: studio.apiKey,
      scheduledDeletionDate: studio.scheduledDeletionDate
    });
  } catch (error) {
    console.error('Error fetching studio details:', error.message);
    res.status(500).send('Internal Server Error');
  }
});
// Changing game details
app.post('/api/updateStudioDetails', async (req, res) => {
  try {
    const { studioID, studioName, studioIcon, apiKey } = req.body;
    if (!studioID) {
      return res.status(400).send('Studio ID is required');
    }

    const updatedData = {};
    if (studioName) updatedData.studioName = studioName;
    if (studioIcon) updatedData.studioIcon = studioIcon;
    if (apiKey) updatedData.apiKey = apiKey;

    const studio = await Studio.findOneAndUpdate({ studioID: studioID }, updatedData, { new: true });
    if (!studio) {
      return res.status(404).send('Studio not found');
    }

    res.json({success: true});
  } catch (error) {
    console.error('Error updating studio details:', error.message);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/revokeStudioKey', async (req, res) => {
  try {
    const { studioID } = req.body;

    const updatedData = {};
    updatedData.apiKey = uuid();

    const studio = await Studio.findOneAndUpdate({ studioID: studioID }, updatedData, { new: true });
    if (!studio) {
      return res.status(404).send('Studio not found');
    }

    res.json({success: true, message: 'Studio key revoked', apiKey: updatedData.apiKey});
  } catch (error) {
    console.error('Error revoking studio key:', error.message);
    res.status(500).send('Internal Server Error');
  }
});
app.post('/api/revokeGameKey', async (req, res) => {
  try {
    const { gameID } = req.body;

    const updatedData = {};
    updatedData.gameSecretKey = uuid();

    const game = await Game.findOneAndUpdate({ gameID: gameID }, updatedData, { new: true });
    if (!game) {
      return res.status(404).send('Game not found');
    }

    res.json({success: true, message: 'Game key revoked', apiKey: updatedData.gameSecretKey});
  } catch (error) {
    console.error('Error revoking game key:', error.message);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/removeStudio', async (req, res) => {
  try {
    const { studioID } = req.body;

    const currentDate = new Date();
    const deletionDate = new Date(currentDate);
    deletionDate.setHours(currentDate.getHours() + 72);

    await Studio.findOneAndUpdate({ studioID: studioID }, {$set: {scheduledDeletionDate: deletionDate}}, {new: true, upsert: true});

    res.json({success: true, message: 'Studio scheduled for removal successfully'})

  } catch (error) {
    console.error('Error removeStudio:', error)
    res.status(200).json({success: false, message: 'Internal Server Error'})
  }
});
app.post('/api/cancelRemoveStudio', async (req, res) => {

  const {studioID} = req.body

  try {
    const studio = await Studio.findOneAndUpdate({ studioID: studioID }, {$unset: { scheduledDeletionDate: "" }}, {new: true, upsert: true});

    if (!studio) {
      return res.status(404).send('Studio not found');
    }

    res.json({success: true, message: 'Studio removed successfully'})

  } catch (error) {
    console.error('Error removeStudio:', error)
    res.status(200).json({success: false, message: 'Internal Server Error'})
  }
});


// Getting game details for settings modal
app.post('/api/getGameDetails', async (req, res) => {
  try {
    const {gameID} = req.body;
    if (!gameID) {
      return res.status(400).send('Game ID is required');
    }

    const game = await Game.findOne({ gameID: gameID });
    if (!game) {
      return res.status(404).send('Game not found');
    }

    res.json({ success: true,
      gameName: game.gameName,
      gameEngine: game.gameEngine,
      gameIcon: game.gameIcon,
      gameSecretKey: game.gameSecretKey,
      gameScheduledDeletionDate: game.scheduledDeletionDate
    });
  } catch (error) {
    console.error('Error fetching game details:', error.message);
    res.status(500).send('Internal Server Error');
  }
});
// Changing game details
app.post('/api/updateGameDetails', async (req, res) => {
  try {
    const { gameID, gameName, gameEngine, gameIcon, gameSecretKey } = req.body;
    if (!gameID) {
      return res.status(400).send('Game ID is required');
    }

    const updatedData = {};
    if (gameName) updatedData.gameName = gameName;
    if (gameEngine) updatedData.gameEngine = gameEngine;
    if (gameIcon) updatedData.gameIcon = gameIcon;
    if (gameSecretKey) updatedData.gameSecretKey = gameSecretKey;

    const game = await Game.findOneAndUpdate({ gameID: gameID }, updatedData, { new: true });
    if (!game) {
      return res.status(404).send('Game not found');
    }

    res.json({success: true});
  } catch (error) {
    console.error('Error updating game details:', error.message);
    res.status(500).send('Internal Server Error');
  }
});

// Получить ноду из определённой игры и ветки разработки по её ID
app.post('/api/getNode', async (req, res) => {
  try {
    const { gameID, branch, nodeID } = req.body;
    // console.log(req.body);

    // Проверка наличия обязательных параметров
    if (!gameID || !branch || !nodeID) {
      return res.status(400).json({ error: 'Missing required parameters: gameID, branch, nodeID' });
    }

    // Поиск ноды по gameID, branch и nodeID с использованием агрегации
    const foundNode = await NodeModel.aggregate([
      {
        $match: {
          gameID,
          'branches.branch': branch,
        },
      },
      {
        $unwind: '$branches',
      },
      {
        $unwind: '$branches.planningTypes',
      },
      {
        $unwind: '$branches.planningTypes.nodes',
      },
      {
        $match: {
          'branches.planningTypes.nodes.nodeID': nodeID,
        },
      },
      {
        $replaceWith: '$branches.planningTypes.nodes',
      },
    ]);

    // Проверка наличия найденной ноды
    if (foundNode.length > 0) {
      res.status(200).json(foundNode[0]);
    } else {
      res.status(404).json({ error: 'Node not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Обновить поле content в description или techDescription когда кто-то изменяет ноду
app.post('/api/updateNode', async (req, res) => {
  const { gameID, branchName, nodeID, fieldToUpdate, newField } = req.body;

  try {
    // Найти узел в коллекции nodes
    const resultNode = await NodeModel.findOne({ gameID });
    if (!resultNode) {
      return res.status(404).json({ message: 'Node not found' });
    }

    // Найти соответствующую ветвь и узел внутри нее
    const selectedBranch = resultNode.branches.find(b => b.branch === branchName);
    if (!selectedBranch) {
      return res.status(404).json({ message: 'Branch not found' });
    }

    const selectedNode = selectedBranch.planningTypes.reduce((acc, pt) => {
      const foundNode = pt.nodes.find(n => n.nodeID === nodeID);
      return foundNode ? foundNode : acc;
    }, null);

    if (!selectedNode) {
      return res.status(404).json({ message: 'Node not found in the specified branch' });
    }

    // Обновление значения в соответствии с переданными параметрами
    if (fieldToUpdate === 'description') {
      selectedNode.description.content = newField;
    } else if (fieldToUpdate === 'techDescription') {
      selectedNode.techDescription.content = newField;
    } else if (fieldToUpdate === 'entityProperties') {
      selectedNode.entityProperties = newField;
    } else {
      return res.status(400).json({ message: 'Invalid fieldToUpdate parameter' });
    }

    // Сохранение обновленного узла
    await resultNode.save();

    res.status(200).json({ success: true, message: 'Node updated successfully' });
  } catch (error) {
    console.error('Error updating node:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Создать ноду в определённой игре, ветке, планнинге. Вводные - айди ноды и её имя. Айди лучше на бэке создавать и возвращать
// на фронт сразу чтоб можно было открыть эдитор ноды по этому айди
app.post('/api/createPlanningNode', async (req, res) => {
  try {
    const { gameID, branch, planningType, nodeID, nodeName } = req.body;

    // Проверка наличия обязательных полей в запросе
    if (!gameID || !branch || !planningType || !nodeID || !nodeName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existingNode = await NodeModel.findOne({
      gameID,
      'branches.branch': branch,
    });

    if (existingNode) {
      // Если branch уже существует, проверим, существует ли planningType
      const branchExists = existingNode.branches.some(b => b.branch === branch);

      if (branchExists) {
        // Если planningType уже существует, добавим новую ноду
        const planningTypeExists = existingNode.branches.find(b => b.branch === branch)
          .planningTypes.some(pt => pt.type === planningType);

        if (planningTypeExists) {
          const nodeExists = existingNode.branches.find(b => b.branch === branch)
            .planningTypes.find(pt => pt.type === planningType)
            .nodes.some(n => n.nodeID === nodeID);

          if (!nodeExists) {
            // Если нода с nodeID не существует, добавляем новую ноду
            await NodeModel.updateOne(
              {
                gameID,
                'branches.branch': branch,
                'branches.planningTypes.type': planningType,
              },
              {
                $push: {
                  'branches.$[b].planningTypes.$[pt].nodes': {
                    nodeID,
                    name: nodeName,
                    description: {
                      content: `<h1 class="PlaygroundEditorTheme__h1" dir="ltr"><span style="white-space: pre-wrap;">${nodeName}</span></h1>`,
                      media: [],
                    },
                    techDescription: {
                      content: `<h1 class="PlaygroundEditorTheme__h1" dir="ltr"><span style="white-space: pre-wrap;">Technical Documentation</span></h1>`,
                      media: [],
                    },
                    remoteConfigParams: [],
                    analyticsEvents: [],
                    entityProperties: {
                      entityID: '',
                      quantity: 0,
                      isInAppPurchase: false,
                      softValue: 0,
                      hardValue: 0,
                      realValue: 10,
                      customProperties: [],
                    },
                  },
                },
              },
              {
                arrayFilters: [
                  { 'b.branch': branch },
                  { 'pt.type': planningType },
                ],
              }
            );
          }
        } else {
          // Если planningType не существует, добавим его
          await NodeModel.updateOne(
            {
              gameID,
              'branches.branch': branch,
            },
            {
              $push: {
                'branches.$[b].planningTypes': {
                  type: planningType,
                  nodes: [{
                    nodeID,
                    name: nodeName,
                    description: {
                      content: `<h1 class="PlaygroundEditorTheme__h1" dir="ltr"><span style="white-space: pre-wrap;">${nodeName}</span></h1>`,
                      media: [],
                    },
                    techDescription: {
                      content: `<h1 class="PlaygroundEditorTheme__h1" dir="ltr"><span style="white-space: pre-wrap;">Technical Documentation</span></h1>`,
                      media: [],
                    },
                    remoteConfigParams: [],
                    analyticsEvents: [],
                    entityProperties: {
                      entityID: '',
                      quantity: 0,
                      isInAppPurchase: false,
                      softValue: 0,
                      hardValue: 0,
                      realValue: 10,
                      customProperties: [],
                    },
                  }],
                },
              },
            },
            {
              arrayFilters: [
                { 'b.branch': branch },
              ],
            }
          );
        }
      } else {
        // Если branch не существует, добавим его и новый planningType
        await NodeModel.updateOne(
          {
            gameID,
          },
          {
            $push: {
              'branches': {
                branch: branch,
                planningTypes: [{
                  type: planningType,
                  nodes: [{
                    nodeID,
                    name: nodeName,
                    description: {
                      content: `<h1 class="PlaygroundEditorTheme__h1" dir="ltr"><span style="white-space: pre-wrap;">${nodeName}</span></h1>`,
                      media: [],
                    },
                    techDescription: {
                      content: `<h1 class="PlaygroundEditorTheme__h1" dir="ltr"><span style="white-space: pre-wrap;">Technical Documentation</span></h1>`,
                      media: [],
                    },
                    remoteConfigParams: [],
                    analyticsEvents: [],
                    entityProperties: {
                      entityID: '',
                      quantity: 0,
                      isInAppPurchase: false,
                      softValue: 0,
                      hardValue: 0,
                      realValue: 10,
                      customProperties: [],
                    },
                  }],
                }],
              },
            },
          }
        );
      }
    } else {
      // Если документа с таким gameID, branch, planningType нет, создаем новую ноду
      const newNode = {
        gameID,
        branches: [{
          branch,
          planningTypes: [{
            type: planningType,
            nodes: [{
              nodeID,
              name: nodeName,
              description: {
                content: `<h1 class="PlaygroundEditorTheme__h1" dir="ltr"><span style="white-space: pre-wrap;">${nodeName}</span></h1>`,
                media: [],
              },
              techDescription: {
                content: `<h1 class="PlaygroundEditorTheme__h1" dir="ltr"><span style="white-space: pre-wrap;">Technical Documentation</span></h1>`,
                media: [],
              },
              remoteConfigParams: [],
              analyticsEvents: [],
              entityProperties: {
                entityID: '',
                quantity: 0,
                isInAppPurchase: false,
                softValue: 0,
                hardValue: 0,
                realValue: 0,
                customProperties: [],
              },
            }],
          }],
        }],
      };
      await NodeModel.create(newNode);
    }

    res.status(201).json({ message: 'Empty node created successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// V2 - ENTITY CREATION
app.post('/api/createEntity', async (req, res) => {
  try {
    const { gameID, branch, entityObj } = req.body;

    // Проверка наличия обязательных полей в запросе
    if (!gameID || !branch || !entityObj) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const query = {
      gameID: gameID,
      'branches.branch': branch
    };

    const newNodeID = uuid();
    
    const update = {
      $push: { 
        'branches.$.planningTypes.$[type].nodes': {
          nodeID: newNodeID,
          name: entityObj.entityName,
          description: entityObj.entityDescription,
          techDescription: entityObj.entityTechDescription,
          entityCategory: entityObj.entityCategory,
          entityBasic: entityObj.entityBasic
        }
      }
    };
    
    const options = {
      arrayFilters: [
        { 'type.type': 'entity' } // фильтруем нужный тип планирования
      ],
      new: true // чтобы получить обновленный документ
    };
    
    await NodeModel.findOneAndUpdate(query, update, options)

    // If not empty, it is basic entity. Category otherwise
    if (entityObj.entityBasic && entityObj.entityBasic.entityID !== '') {
      // Trying to put it under parent category immediately
      if (entityObj.entityBasic.parentCategory !== '') {
        const addEntityToCategory = await addEntityToParent(gameID, branch, entityObj.entityBasic.parentCategory, newNodeID, false)
        // console.log('Adding basic entity:', addEntityToCategory, 'Params:', gameID, branch, entityObj.entityBasic.parentCategory, newNodeID)
      }
    } else {
      // Trying to put it under parent category immediately
      if (entityObj.entityCategory.parentCategory !== '') {
        const addEntityToCategory = await addEntityToParent(gameID, branch, entityObj.entityCategory.parentCategory, newNodeID, true)
        // console.log('Adding category:', addEntityToCategory, 'Params:', gameID, branch, entityObj.entityCategory.parentCategory, newNodeID)
      } 
    }

    res.status(201).json({ message: 'Empty node created successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.post('/api/createEntityBulk', async (req, res) => {
  try {
    const { gameID, branch, entityObjArray } = req.body;

    // Проверка наличия обязательных полей в запросе
    if (!gameID || !branch || !entityObjArray || entityObjArray.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const query = {
      gameID: gameID,
      'branches.branch': branch
    };

    const newNodes = entityObjArray.map(entityObj => {
      const newNodeID = uuid();
      return {
        nodeID: newNodeID,
        name: entityObj.entityName,
        description: entityObj.entityDescription,
        techDescription: entityObj.entityTechDescription,
        entityCategory: entityObj.entityCategory,
        entityBasic: entityObj.entityBasic
      };
    });
    
    const update = {
      $push: {
        'branches.$.planningTypes.$[type].nodes': {
          $each: newNodes
        }
      }
    };
    
    const options = {
      arrayFilters: [
        { 'type.type': 'entity' } // фильтруем нужный тип планирования
      ],
      new: true // чтобы получить обновленный документ
    };
    
    await NodeModel.findOneAndUpdate(query, update, options)

    let nodesToPutInParents = [];

    newNodes.forEach(e => {
      async function tryToAddEntityToParent(entityObj) {
        console.log('Adding entity:', entityObj, 'Params:', gameID, branch, entityObj, entityObj.nodeID)
        // If not empty, it is basic entity. Category otherwise
        if (entityObj.entityBasic && entityObj.entityBasic.entityID !== '') {
          // Trying to put it under parent category immediately
          if (entityObj.entityBasic.parentCategory !== '') {
            nodesToPutInParents.push(entityObj);
          }
        }
      }
      tryToAddEntityToParent(e)
    });
    if (nodesToPutInParents.length > 0) {
      await addBasicEntityToParentInBulk(gameID, branch, nodesToPutInParents.map(e => e.entityBasic.parentCategory), nodesToPutInParents.map(e => e.nodeID), nodesToPutInParents.map(e => e.entityBasic.isCategory))
    }

    res.status(201).json({ message: 'Empty node created successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
async function addBasicEntityToParentInBulk(gameID, branch, parentIds, newNodes, isCategories) {
  try {
    const planningDocument = await PlanningTreeModel.findOne({ gameID }).exec();

    if (!planningDocument) {
      return { status: 404, success: false, error: 'Planning document not found' };
    }

    const foundBranch = planningDocument.branches.find(b => b.branch === branch);

    if (!foundBranch) {
      return { status: 404, success: false, error: 'Branch not found' };
    }

    let success = false;

    const findAndUpdateNode = (nodes, index) => {
      for (const node of nodes) {
        if (node._id.toString() === parentIds[index]) {
          const newNodeObject = {
            nodeID: newNodes[index],
            subnodes: [],
            _id: new mongoose.Types.ObjectId(),
            isCategory: isCategories[index]
          };
          node.subnodes.push(newNodeObject);
          success = true;
          return;
        }

        if (node.subnodes.length > 0) {
          findAndUpdateNode(node.subnodes, index);
        }
      }
    };

    parentIds.forEach((parentId, index) => {
      findAndUpdateNode(foundBranch.planningTypes.find(pt => pt.type === 'entity')?.nodes || [], index);
    });

    planningDocument.save();

    if (success) {
      return { status: 200, success: true };
    } else {
      return { status: 404, success: false, error: 'Node with parentId not found' };
    }
  } catch (error) {
    console.error(error);
    return { status: 500, success: false, error: 'Internal Server Error' };
  }
}
async function addEntityToParent(gameID, branch, parentId, newNode, isCategory) {
  try {

    // Поиск документа в коллекции plannings по gameID
    const planningDocument = await PlanningTreeModel.findOne({ gameID }).exec();

    if (!planningDocument) {
      return res.status(404).json({ error: 'Planning document not found' });
    }

    // Поиск ветки с соответствующим branch
    const foundBranch = planningDocument.branches.find(b => b.branch === branch);

    if (!foundBranch) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    let success = false;
    // Рекурсивная функция для поиска и обновления узла
    const findAndUpdateNode = (nodes) => {
      for (const node of nodes) {
        if (node._id.toString() === parentId) {
          // Найден узел с соответствующим parentId
          const newNodeObject = {
            nodeID: newNode,
            subnodes: [],
            _id: new mongoose.Types.ObjectId(),
            isCategory: isCategory
          };
          node.subnodes.push(newNodeObject);
          
          success = true;
          return;
        }

        if (node.subnodes.length > 0) {
          // Рекурсивный вызов для подузлов
          findAndUpdateNode(node.subnodes);
        }
      }
    };

    // Начало поиска и обновления узла
    await findAndUpdateNode(foundBranch.planningTypes.find(pt => pt.type === 'entity')?.nodes || []);
    planningDocument.save();


    if (success) {
      return { status: 200, success: true };
    } else {
      // Если не найден узел с указанным parentId
      return { status: 404, success: false, error: 'Node with parentId not found' };
    }

  } catch (error) {
    console.error(error);
    return { status: 500, success: false, error: 'Internal Server Error' };
  }
}
// ENTITY TREE SEARCH & GATHERING CATEGORIES ON THE WAY
app.get('/api/findNodeById', async (req, res) => {
  try {
    const { nodeID, gameID, branch } = req.query;

    // Проверяем наличие nodeID в параметрах запроса
    if (!nodeID) {
      return res.status(400).json({ message: 'nodeID is required' });
    }

    // Находим узел в базе данных по nodeID
    const foundNode = await findEntityById(gameID, branch, nodeID);


    // Если узел не найден, возвращаем пустой массив
    if (!foundNode) {
      return res.status(404).json({ message: 'Node not found' });
    }

    // Обходим дерево рекурсивно и собираем nodeID всех узлов с isEntityCategory = true
    const entityCategoryNodeIDs = findEntityCategoryNodeIDs(foundNode);

    res.status(200).json({ entityCategoryNodeIDs });
  } catch (error) {
    console.error("Error finding node by ID:", error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Функция для поиска узла по nodeID
async function findEntityById(gameID, branch, nodeID) {
  const query = {
    gameID: gameID,
    'branches.branch': branch
  };
  const tree = await PlanningTreeModel.findOne(query);

  const branchObject = tree.branches.find(b => b.branch === branch);
  const entityNodes = branchObject.planningTypes.find(t => t.type === 'entity').nodes;


  function findNode(node) {
    if (node.nodeID === nodeID) {
      return node;
    }
    if (node.subnodes && node.subnodes.length > 0) {
      for (const subnode of node.subnodes) {
        const found = findNode(subnode);
        if (found) {
          return found;
        }
      }
    }
    return null;
  }

  return findNode(entityNodes[0]);
}

// Функция для обхода дерева и сбора nodeID всех узлов с isEntityCategory = true
function findEntityCategoryNodeIDs(node) {
  const entityCategoryNodeIDs = [];

  // Рекурсивно обходим дерево
  function traverse(node, path = []) {
    if (node.isEntityCategory === false) {
      entityCategoryNodeIDs.push(node.nodeID);
    }
    path.push(node.nodeID);
    if (node.subnodes && node.subnodes.length > 0) {
      for (const subnode of node.subnodes) {
        traverse(subnode, [...path]);
      }
    }
  }

  traverse(node);

  return entityCategoryNodeIDs;
}

// Удалить ноду из планнинга. Также код вызывает удаление всех её прямых зависимостей
app.post('/api/removePlanningNode', async (req, res) => {
  try {
    const { gameID, branchName, nodeID } = req.body;

    if (!gameID || !branchName || !nodeID) {
        return res.status(400).json({ success: false, message: 'Missing required parameters' });
    }

    // Получить узел
    const node = await NodeModel.findOne({ 'branches.planningTypes.nodes.nodeID': nodeID });
    if (!node) {
        return res.status(404).json({ success: false, message: 'Node not found' });
    }

    // Извлечь идентификаторы
    const { remoteConfigParams, analyticsEvents } = node;

    // Удалить объекты из RemoteConfig
    if (remoteConfigParams && remoteConfigParams.length) {
        await RemoteConfig.updateMany(
            { gameID },
            { $pull: { 'branches.$[].params': { paramID: { $in: remoteConfigParams } } } }
        );
    }

    // Удалить объекты из AnalyticsEvents
    if (analyticsEvents && analyticsEvents.length) {
        await AnalyticsEvents.updateMany(
            { gameID },
            { $pull: { 'branches.$[].events': { eventID: { $in: analyticsEvents } } } }
        );
        // Clearing up all dependent templates from Player Warehouse
        removeAnalyticsTemplatesByEventID(gameID, branchName, analyticsEvents)
    }
    // Clearing all traces of this node in planning tree
    removePlanningNodeObjectByNodeID(gameID, branchName, nodeID)

    // Clearing all R&C references
    removeObjectsByNodeID(gameID, branchName, nodeID)

    // Удалить узел
    await NodeModel.updateOne(
        { gameID, 'branches.branch': branchName },
        { $pull: { 'branches.$.planningTypes.$[].nodes': { nodeID } } }
    );

    res.status(200).json({ success: true, message: 'Node and related data deleted successfully' });
} catch (error) {
    console.error('Error in /api/deleteNode:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
}
});

// Remove all PW analytics templates by given eventIDs
async function removeAnalyticsTemplatesByEventID(gameID, branchName, eventIDs) {
  try {
    // Найти и сохранить templateID удаляемых шаблонов
    const templates = await PWtemplates.find(
      { gameID, 'branches.branch': branchName, 'branches.templates.analytics.templateAnalyticEventID': { $in: eventIDs } },
      { 'branches.templates.analytics.$': 1 }
    );

    // Извлечь templateID
    let templateIDs = [];
    templates.forEach(doc => {
      doc.branches.forEach(branch => {
        branch.templates.analytics.forEach(template => {
          if (eventIDs.includes(template.templateAnalyticEventID)) {
            templateIDs.push(template.templateID);
          }
        });
      });
    });

    // Удаление шаблонов аналитики
    const result = await PWtemplates.updateMany(
      { gameID, 'branches.branch': branchName },
      { $pull: { 'branches.$[].templates.analytics': { templateAnalyticEventID: { $in: eventIDs } } } }
    );
    console.log('Удалено шаблонов:', result.modifiedCount);

    // Удаление соответствующих условий из Segments
    if (templateIDs.length > 0) {
      await removeConditionsFromSegments(gameID, branchName, templateIDs);
    }
  } catch (error) {
    console.error('Ошибка при удалении шаблонов аналитики:', error);
  }
}
// Clearing all segments' conditions that are dependent on removed template from PW
async function removeConditionsFromSegments(gameID, branchName, templateIDs) {
  try {

    // Getting all segmentIDs to be updated
    const originalSegments = await Segments.aggregate([
      { $match: { gameID: gameID, 'branches.branch': branchName } },
      { $unwind: '$branches' },
      { $match: { 'branches.branch': branchName } },
      { $unwind: '$branches.segments' },
      { $match: { 'branches.segments.segmentConditions.conditionElementID': { $in: templateIDs } } },
      { $project: { 'branches.segments.segmentID': 1 } }
    ]);

    const originalSegmentIDs = originalSegments.map(seg => seg.branches.segments.segmentID);



    // Updating all segments
    const query = {
      gameID: gameID,
      'branches.branch': branchName
    };
    const promises = templateIDs.map(async (templateID) => {
      const update = {
        $pull: {
          'branches.$[branch].segments.$[segment].segmentConditions': {
            conditionElementID: templateID
          }
        }
      };

      const options = {
        arrayFilters: [
          { 'branch.branch': branchName },
          { 'segment.segmentConditions.conditionElementID': templateID }
        ]
      };

      await Segments.updateMany(query, update, options);
      console.log('Объекты с conditionElementID:', templateID, 'удалены успешно.');
    });
    await Promise.all(promises);


    // Getting another segmentIDs but now compare to the first array to find which IDs were modified and are now missing from array
    const updatedSegments = await Segments.aggregate([
      { $match: { gameID: gameID, 'branches.branch': branchName } },
      { $unwind: '$branches' },
      { $match: { 'branches.branch': branchName } },
      { $unwind: '$branches.segments' },
      { $project: { 'branches.segments.segmentID': 1, 'branches.segments.segmentConditions': 1 } }
    ]);
    const updatedSegmentIDs = updatedSegments
    .filter(seg => seg.branches.segments.segmentConditions.some(cond => templateIDs.includes(cond.conditionElementID)))
    .map(seg => seg.branches.segments.segmentID);

    // Get updated segmentIDs
    const changedSegmentIDs = originalSegmentIDs.filter(id => !updatedSegmentIDs.includes(id));
    changedSegmentIDs.forEach(segmentID => {
      recalculateSegment(gameID, branchName, segmentID)
    })

    console.log('Все объекты удалены успешно.');
  } catch (error) {
    console.error('Ошибка при удалении объектов:', error);
  }
}
// Remove all node's traces from planning tree
async function removePlanningNodeObjectByNodeID(gameID, branchName, nodeID) {
  try {
    const query = {
      gameID: gameID,
      'branches.branch': branchName
    };

    const document = await PlanningTreeModel.findOne(query);

    if (!document) {
      console.error('Документ не найден.');
      return;
    }

    // Рекурсивная функция для удаления узлов
    function removeNodes(nodes) {
      for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i];
        if (node.nodeID === nodeID) {
          nodes.splice(i, 1); // Удалить текущий узел
        } else if (node.subnodes && node.subnodes.length > 0) {
          removeNodes(node.subnodes); // Рекурсивно удалить subnodes
        }
      }
    }

    document.branches.find(b => b.branch === branchName).planningTypes.forEach(planningType => {
      removeNodes(planningType.nodes)
    })

    await document.save(); // Сохраняем обновленный документ в базе данных

    console.log('Удаление узлов выполнено успешно.');
  } catch (error) {
    console.error('Ошибка при удалении узлов:', error);
  }
}

// Remove all traces of node from R&C
async function removeObjectsByNodeID(gameID, branchName, nodeID) {
  try {
    const query = {
      'gameID': gameID,
      'branches.branch': branchName
    };

    const document = await Relations.findOne(query);

    if (!document) {
      console.error('Документ не найден.');
      return;
    }

    const branch = document.branches.find(branch => branch.branch === branchName);
    if (branch) {
      branch.relations.forEach(relation => {
        relation.nodes = relation.nodes.filter(node => node.nodeID !== nodeID);
      });

      branch.contexts.forEach(context => {
        context.nodes = context.nodes.filter(node => node.nodeID !== nodeID);
      });

      // Удаление всех объектов links, у которых в source или target есть указанный nodeID
      branch.relations.forEach(relation => {
        relation.links = relation.links.filter(link =>
          link.source !== nodeID && link.target !== nodeID
        );
      });
    }

    await document.save(); // Сохраняем обновленный документ в базе данных

    console.log('Удаление объектов выполнено успешно.');
  } catch (error) {
    console.error('Ошибка при удалении объектов:', error);
  }
}



// Removing gameplay node. This req is only meant to delete gameplay node exactly from planningType === gameplay
// and from .nodes[0].subnodes. Any nested gameplays won't be deleted.
app.post('/api/removeGameplayNode', async (req, res) => {

  const { gameID, branchName, nodeID } = req.body;

  try {
    const query = {
      gameID: gameID,
      'branches.branch': branchName
    };

    const document = await PlanningTreeModel.findOne(query);

    if (!document) {
      console.error('Документ не найден.');
      return;
    }

    const gameplayNodes = document.branches.find(b => b.branch === branchName).planningTypes.find(b => b.type === 'gameplay').nodes[0].subnodes;
    console.log(gameplayNodes)
    const index = gameplayNodes.findIndex(node => node.nodeID === nodeID);

    if (index !== -1) {
      gameplayNodes.splice(index, 1); // Удалить геймплейную ноду
    } else {
      console.error('Геймплейная нода с указанным nodeID не найдена.');
      return;
    }

    await document.save(); // Сохраняем обновленный документ в базе данных

    console.log('Удаление геймплейной ноды выполнено успешно.');
  } catch (error) {
    console.error('Ошибка при удалении геймплейной ноды:', error);
  }
});


// Получить все ноды определённого типа (entities, gameplay)
app.post('/api/getPlanningNodes', async (req, res) => {
  try {
    const { gameID, branch, planningType } = req.body;

    if (!gameID || !branch || !planningType) {
      return res.status(200).json({ success: false, error: 'Missing required fields' });
    }

    let nodes = await NodeModel.findOne({ gameID }).exec();

    if (!nodes) {
      return res.status(200).json({ success: false, error: 'No document found' });
    }

    // Ищем или создаем соответствующую branch
    let branchObj = nodes.branches.find(b => b.branch === branch);

    if (!branchObj) {
      return res.status(200).json({ success: false, error: 'No branch found' });
    }

    // Ищем или создаем соответствующий planningType
    let planningTypeObj = branchObj.planningTypes.find(pt => pt.type === planningType);

    if (!planningTypeObj) {
      return res.status(200).json({ success: false, error: 'No planning type found' });
    }

    const nodesList = planningTypeObj.nodes;

    res.json({ success: true, nodes: nodesList });
  } catch (error) {
    console.error(error);
    res.status(200).json({ success: false, error: 'Internal Server Error' });
  }
});
app.post('/api/createPlanningGameplay', async (req, res) => {
  try {
    const { gameID, branchName, gameplayName } = req.body;

    // Проверка наличия обязательных полей в запросе
    if (!gameID || !branchName || !gameplayName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const nodeID = `gameplay_${new mongoose.Types.ObjectId()}`;

    const result = await PlanningTreeModel.updateOne(
      {
        gameID,
        'branches.branch': branchName,
        'branches.planningTypes.type': 'gameplay',
      },
      {
        $push: {
          'branches.$[b].planningTypes.$[pt].nodes.$[root].subnodes': {
            nodeID: nodeID,
            isGameplay: true,
            gameplayName: gameplayName,
            subnodes: [],
          },
        },
      },
      {
        arrayFilters: [
          { 'b.branch': branchName },
          { 'pt.type': 'gameplay' },
          { 'root.nodeID': 'Root' }, // Фильтр для нахождения ноды Root
        ],
      }
    );

    if (result.modifiedCount === 0) {
      // Если не было изменений, значит нужно создать новую запись
      await PlanningTreeModel.updateOne(
        {
          gameID,
          'branches.branch': branchName,
        },
        {
          $push: {
            'branches': {
              branch: branchName,
              planningTypes: [
                {
                  type: 'gameplay',
                  nodes: [
                    {
                      nodeID: 'Root',
                      subnodes: [
                        {
                          nodeID: nodeID,
                          isGameplay: true,
                          gameplayName: gameplayName,
                          subnodes: [],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        }
      );
    }

    res.status(201).json({ message: 'Gameplay node created successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/publishNode', async (req, res) => {
  const { gameID, branchName, nodeID, fieldToPublish } = req.body;

  try {
    // Генерировать ссылку из 12 символов (буквы и цифры)
    const publishLink = generatePublishLink();

    // Определить поле для обновления в зависимости от fieldToPublish
    const updateField = (fieldToPublish === 'techdoc') ? 'techDescription' : 'description';

    // Построить путь к полю в документе Node
    const updatePath = `branches.$[b].planningTypes.$[pt].nodes.$[n].${updateField}.publishLink`;

    // Составить объект обновления
    const update = {
      $set: { [updatePath]: publishLink }
    };

    // Обновить документ Node
    const result = await NodeModel.updateOne(
      { 'gameID': gameID, 'branches.branch': branchName, 'branches.planningTypes.nodes.nodeID': nodeID },
      update,
      {
        arrayFilters: [
          { 'b.branch': branchName },
          { 'pt.type': { $in: ['entity', 'gameplay'] } },
          { 'n.nodeID': nodeID }
        ]
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: 'Node not found' });
    }

    res.status(200).json({ success: true, message: 'Node published successfully', publishLink });
  } catch (error) {
    console.error('Error publishing node:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }

  // Функция для генерации ссылки из 12 символов (буквы и цифры)
  function generatePublishLink() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 12; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  }
});
app.post('/api/getIsNodePublished', async (req, res) => {
  const { gameID, branchName, nodeID, fieldToCheck } = req.body;

  try {
    // Найти документ Node по gameID и branchName
    const nodeDocument = await NodeModel.findOne(
      { 'gameID': gameID, 'branches.branch': branchName, 'branches.planningTypes.nodes.nodeID': nodeID },
      { 'branches.$': 1 }
    );

    if (!nodeDocument) {
      return res.status(404).json({ message: 'Node not found' });
    }

    // Извлечь нужное поле для проверки
    const branch = nodeDocument.branches.find(b => b.branch === branchName);

    if (!branch || !branch.planningTypes || branch.planningTypes.length === 0) {
      return res.status(404).json({ message: 'Branch or planningTypes not found' });
    }

    const planningTypes = branch.planningTypes;
    let node;

    for (const planningType of planningTypes) {
      node = planningType.nodes.find(n => n.nodeID === nodeID);

      if (node) {
        break;
      }
    }

    if (!node) {
      return res.status(404).json({ message: 'Node with specified nodeID not found' });
    }
    let isPublished;
    let publishLink;

    // Проверить, есть ли ссылка в publishLink или поле пустое
    switch (fieldToCheck) {
      case 'description':
        isPublished = !!node.description && !!node.description.publishLink;
        publishLink = node.description ? node.description.publishLink : undefined;
        break;
      case 'techdoc':
        isPublished = !!node.techDescription && !!node.techDescription.publishLink;
        publishLink = node.techDescription ? node.techDescription.publishLink : undefined;
        break;
      default:
        return res.status(400).json({ message: 'Invalid fieldToCheck' });
    }

    res.status(200).json({ success: true, message: 'Node publish status retrieved successfully', isPublished, publishLink });
  } catch (error) {
    console.error('Error getting node publish status:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});
app.post('/api/unPublishNode', async (req, res) => {
  const { gameID, branchName, nodeID, fieldToUnpublish } = req.body;

  try {
    // Определить поле для обновления в зависимости от fieldToUnpublish
    const updateField = (fieldToUnpublish === 'techdoc') ? 'techDescription.publishLink' : 'description.publishLink';

    // Построить путь к полю в документе Node
    const updatePath = `branches.$[b].planningTypes.$[pt].nodes.$[n].${updateField}`;

    // Составить объект обновления
    const update = {
      $unset: { [updatePath]: '' }
    };
    // Обновить документ Node
    const result = await NodeModel.updateOne(
      { 'gameID': gameID, 'branches.branch': branchName, 'branches.planningTypes.nodes.nodeID': nodeID },
      update,
      {
        arrayFilters: [
          { 'b.branch': branchName },
          { 'pt.type': { $in: ['entity', 'gameplay'] } },
          { 'n.nodeID': nodeID }
        ]
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: 'Node not found' });
    }

    res.status(200).json({ success: true, message: 'Node unpublished successfully' });
  } catch (error) {
    console.error('Error unpublishing node:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});
app.post('/api/getPublishedNode', async (req, res) => {
  const { link, branchName } = req.body;

  if (!link) {
    return res.status(400).send('Parameter "link" is required');
  }
  try {
    // Ищем соответствующее значение в publishLink всех существующих нод
    const node = await NodeModel.findOne({
      'branches.branch': branchName,
      'branches.planningTypes.nodes': {
        $elemMatch: {
          $or: [
            { 'description.publishLink': link },
            { 'techDescription.publishLink': link }
          ]
        }
      }
    });

    if (!node) {
      return res.status(404).send('Node not found');
    }

    // Найдем соответствующую ноду в ветке development
    const developmentNode = node.branches.find(b => b.branch === branchName);

    if (!developmentNode || !developmentNode.planningTypes || developmentNode.planningTypes.length === 0) {
      return res.status(404).json({ message: 'Development branch or planningTypes not found' });
    }

    const planningTypes = developmentNode.planningTypes;
    let foundNode;

    for (const planningType of planningTypes) {
      foundNode = planningType.nodes.find(n =>
        n.description.publishLink === link || n.techDescription.publishLink === link
      );

      if (foundNode) {
        break;
      }
    }

    if (!foundNode) {
      return res.status(404).json({ message: 'Node not found in development branch' });
    }


    // Проверяем наличие полей и используем их при формировании ответа
    const content = (foundNode.description && foundNode.description.publishLink === link)
      ? foundNode.description.content
      : (foundNode.techDescription && foundNode.techDescription.publishLink === link)
      ? foundNode.techDescription.content
      : undefined;

    const name = foundNode.name;

    if (!content || !name) {
      console.log('Content or Name Not Found');
      return res.status(404).json({ message: 'Content or name not found' });
    }

    return res.status(200).json({ gameID: node.gameID, content, name });

  } catch (error) {
    console.error('Error retrieving node:', error.message);
    res.status(500).send('Internal Server Error');
  }
});




// Получить дерево нод (для визуализации, отдельный тип данных)
app.post('/api/getNodeTree', async (req, res) => {
  try {
    const { gameID, branch, planningType } = req.body;

    if (!gameID || !branch || !planningType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Проверяем существование документа с указанными gameID и branch
    const existingDoc = await PlanningTreeModel.findOne({
      gameID,
      'branches.branch': branch,
    });

    if (existingDoc) {
      // Если документ существует, проверяем наличие planningType
      const planningTypeExists = existingDoc.branches.find(b => b.branch === branch)?.planningTypes.some(pt => pt.type === planningType);

      if (!planningTypeExists) {
        // Если planningType отсутствует, добавляем его в существующий документ
        await PlanningTreeModel.updateOne(
          {
            gameID,
            'branches.branch': branch,
          },
          {
            $push: {
              'branches.$[b].planningTypes': {
                type: planningType,
                nodes: [{
                  nodeID: 'Root',
                  subnodes: [],
                }],
              },
            },
          },
          {
            arrayFilters: [
              { 'b.branch': branch },
            ],
          }
        );
      }
    } else {
      // Если документ не существует, создаем новый
      const newNode = {
        gameID,
        branches: [{
          branch,
          planningTypes: [{
            type: planningType,
            nodes: [{
              nodeID: 'Root',
              subnodes: [],
            }],
          }],
        }],
      };
      await PlanningTreeModel.create(newNode);
    }

    // Получаем обновленный документ
    const updatedDoc = await PlanningTreeModel.findOne({
      gameID,
      'branches.branch': branch,
      'branches.planningTypes.type': planningType,
    });

    // Преобразуем формат данных
    const planningTypeObj = updatedDoc?.branches.find(b => b.branch === branch)?.planningTypes.find(pt => pt.type === planningType);
    const nodesList = planningTypeObj ? planningTypeObj.nodes : [];

    const transformNodes = (inputNodes) => {
      return inputNodes.map(({ _id, nodeID, subnodes, isGameplay, gameplayName, isCategory }) => ({
        ID: nodeID,
        Subnodes: transformNodes(subnodes),
        _id: _id,
        isGameplay: isGameplay,
        gameplayName: gameplayName,
        isCategory: isCategory,
      }));
    };

    const transformedNodesList = transformNodes(nodesList);

    res.json({ nodes: transformedNodesList });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.post('/api/addChildNodeInTree', async (req, res) => {
  const { gameID, branchName, planningType, parentId, newNode } = req.body;
  const result = await addChildNodeInPlanningTree(gameID, branchName, planningType, parentId, newNode)
  res.status(result.status).json({sucess: result.success})
});
async function addChildNodeInPlanningTree(gameID, branchName, planningType, parentId, newNode) {
  try {

    // Поиск документа в коллекции plannings по gameID
    const planningDocument = await PlanningTreeModel.findOne({ gameID }).exec();

    if (!planningDocument) {
      return res.status(404).json({ error: 'Planning document not found' });
    }

    // Поиск ветки с соответствующим branchName
    const branch = planningDocument.branches.find(b => b.branch === branchName);

    if (!branch) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    let success = false;

    console.log(newNode)
    // Рекурсивная функция для поиска и обновления узла
    const findAndUpdateNode = (nodes) => {
      for (const node of nodes) {
        if (node._id.toString() === parentId) {
          // Найден узел с соответствующим parentId
          const newNodeObject = {
            nodeID: newNode.ID,
            subnodes: [],
            isCategory: newNode.isCategory ? newNode.isCategory : false,
            _id: newNode._id,
          };
          node.subnodes.push(newNodeObject);
          planningDocument.save(); // Сохранение изменений
          success = true;
          return;
        }

        if (node.subnodes.length > 0) {
          // Рекурсивный вызов для подузлов
          findAndUpdateNode(node.subnodes);
        }
      }
    };

    // Начало поиска и обновления узла
    findAndUpdateNode(branch.planningTypes.find(pt => pt.type === planningType)?.nodes || []);

    if (success) {

      // Now we need to update the node itself with the new parentCategoryID
      let updateFields = {}
      if (newNode.isCategory) {
        updateFields[`branches.$[branch].planningTypes.$[planningType].nodes.$[node].entityCategory.parentCategory`] = parentId;
      } else {
        updateFields[`branches.$[branch].planningTypes.$[planningType].nodes.$[node].entityBasic.parentCategory`] = parentId;
      }
    
      // Saving target node
      const resp = await NodeModel.updateOne(
        { 
            gameID, 
            'branches': { $elemMatch: { 'branch': branchName } },
            'branches.planningTypes': { $elemMatch: { 'type': 'entity' } },
            'branches.planningTypes.nodes': { $elemMatch: { 'nodeID': newNode.ID } },
        },
        {
            $set: updateFields,
        },
        { 
            arrayFilters: [
                { 'branch.branch': branchName },
                { 'planningType.type': 'entity' },
                { 'node.nodeID': newNode.ID }
            ],
            new: true
        }
      );

      return { status: 200, success: true };
    } else {
      // Если не найден узел с указанным parentId
      return { status: 404, success: false, error: 'Node with parentId not found' };
    }

  } catch (error) {
    console.error(error);
    return { status: 500, success: false, error: 'Internal Server Error' };
  }
}
app.post('/api/removeNodeFromTree', async (req, res) => {
  try {
    const { gameID, branchName, planningType, nodeID } = req.body;

    // Поиск документа в коллекции plannings по gameID
    const planningDocument = await PlanningTreeModel.findOne({ gameID }).exec();

    if (!planningDocument) {
      return res.status(404).json({ error: 'Planning document not found' });
    }

    // Поиск ветки с соответствующим branchName
    const branch = planningDocument.branches.find(b => b.branch === branchName);

    if (!branch) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    let success = false;

    // Рекурсивная функция для поиска и удаления узла
    const findAndRemoveNode = (nodes) => {
      for (const node of nodes) {
        if (node._id.toString() === nodeID) {
          // Найден узел с соответствующим nodeID
          nodes.pull(node);
          removeChildrenInheritance(node)
          planningDocument.save(); // Сохранение изменений
          success = true;
          return;
        }

        if (node.subnodes && node.subnodes.length > 0) {
          // Рекурсивный вызов для подузлов
          findAndRemoveNode(node.subnodes);
        }
      }
    };

    // Найти указанный planningType
    const targetPlanningType = branch.planningTypes.find(pt => pt.type === planningType);

    if (!targetPlanningType) {
      return res.status(404).json({ error: 'PlanningType not found' });
    }

    // Начало поиска и удаления узла
    findAndRemoveNode(targetPlanningType.nodes);

    function removeChildrenInheritance(node) {

      const iterateChildren = (children) => {
        for (const n of children) {

          removeNodeInheritance(gameID, branchName, n.nodeID, n.isCategory)

          if (n.subnodes && n.subnodes.length > 0) {
            iterateChildren(n.subnodes);
          }
        }

      };
      removeNodeInheritance(gameID, branchName, node.nodeID, node.isCategory)
      iterateChildren(node.subnodes)
    }

    if (success) {
      return res.status(200).json({ success: true });
    } else {
      // Если не найден узел с указанным nodeID
      return res.status(404).json({ error: 'Node with nodeID not found' });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.post('/api/moveNodeInTree', async (req, res) => {
  const { gameID, branchName, planningType, nodeToMove, destinationID } = req.body;

  const response = await moveNodeInPlanningTree(gameID, branchName, planningType, nodeToMove, destinationID)
  res.status(200).json({ success: true, message: 'Node moved successfully' });
});
async function moveNodeInPlanningTree( gameID, branchName, planningType, nodeToMove, destinationID ) {
  try {
    // Найти документ PlanningTreeModel по gameID
    const planningTree = await PlanningTreeModel.findOne({ gameID });

    if (!planningTree) {
      // return res.status(404).json({ message: 'PlanningTree not found' });
    }

    // Найти ветку с соответствующим именем
    const branchIndex = planningTree.branches.findIndex((b) => b.branch === branchName);

    if (branchIndex === -1) {
      // return res.status(404).json({ message: 'Branch not found' });
    }

    // Найти планировочный тип с соответствующим типом
    const planningTypeIndex = planningTree.branches[branchIndex].planningTypes.findIndex(
      (p) => p.type === planningType
    );

    if (planningTypeIndex === -1) {
      // return res.status(404).json({ message: 'PlanningType not found' });
    }

    // Найти ноду, куда нужно переместить
    const destinationNode = findNodeById(planningTree.branches[branchIndex].planningTypes[planningTypeIndex].nodes, destinationID);

    if (!destinationNode) {
      // return res.status(404).json({ message: 'Destination node not found' });
    }

    // Удалить ноду из исходного места
    const removedNode = removeNodeById(planningTree.branches[branchIndex].planningTypes[planningTypeIndex].nodes, nodeToMove._id)
    if (!removedNode) return
    // Переместить ноду в новое место
    const findAndUpdateNode = async (nodes) => {
      for (const node of nodes) {
        if (node._id.toString() === destinationID) {
          // Найден узел с соответствующим parentId
          node.subnodes.push(removedNode);
          return;
        }

        if (node.subnodes.length > 0) {
          // Рекурсивный вызов для подузлов
          findAndUpdateNode(node.subnodes);
        }
      }
    };
    // Начало поиска и обновления узла
    findAndUpdateNode(planningTree.branches[branchIndex].planningTypes.find(pt => pt.type === planningType)?.nodes || []);
    
    await planningTree.save();
    
    if (planningType === 'entity') {
      await resolveEntityObjAfterMoving(gameID, branchName, nodeToMove, destinationID)
    }

    // res.status(200).json({ success: true, message: 'Node moved successfully' });
  } catch (error) {
    console.error('Error moving node in tree:', error);
    // res.status(500).json({ message: 'Internal Server Error' });
  }
}


async function removeNodeInheritance(gameID, branch, nodeID, isCategory) {

console.log('Removing node inheritance for gameID:', 
gameID, 'branch:', branch, 'nodeID:', nodeID, 'isCategory:', isCategory)


  try {
    const updateFields = {};

    if (isCategory) {
      updateFields[`branches.$[branch].planningTypes.$[planningType].nodes.$[node].entityCategory.parentCategory`] = '';
      updateFields[`branches.$[branch].planningTypes.$[planningType].nodes.$[node].entityCategory.inheritedCategories`] = [];
      updateFields[`branches.$[branch].planningTypes.$[planningType].nodes.$[node].entityCategory.inheritedConfigs`] = '';
    } else {
      updateFields[`branches.$[branch].planningTypes.$[planningType].nodes.$[node].entityBasic.parentCategory`] = '';
      updateFields[`branches.$[branch].planningTypes.$[planningType].nodes.$[node].entityBasic.inheritedCategories`] = [];
      updateFields[`branches.$[branch].planningTypes.$[planningType].nodes.$[node].entityBasic.inheritedConfigs`] = '';
    }
  
    // Saving target node
    const resp = await NodeModel.updateOne(
      { 
          gameID, 
          'branches': { $elemMatch: { 'branch': branch } },
          'branches.planningTypes': { $elemMatch: { 'type': 'entity' } },
          'branches.planningTypes.nodes': { $elemMatch: { 'nodeID': nodeID } }
      },
      {
          $set: updateFields,
      },
      { 
          arrayFilters: [
              { 'branch.branch': branch },
              { 'planningType.type': 'entity' },
              { 'node.nodeID': nodeID }
          ],
          new: true
      }
    );
    console.log({ success: true, message: 'Entity updated successfully' });
  } catch (error) {
    console.error(error);
  }
}
// It is crucial to resolve existing configs. What do we want to do:
// 1. Change entity's parentCategory ID
// 2. Change inheritedCategories array to know which categories are inherited now
// 3. Loop through inheritedCategories & existing inheritedConfigs, removing all configs that are now not inherited
// resolveEntityObjAfterMoving(
//   'c60079e9-9b64-4cb7-a35d-4ccb1cf63864', 
// 'development', 
// 'b1f60bcb-4a7c-45d6-9cf6-558f8668e6a5', 
// '65f770b196a5dfe2ad8da040')
async function resolveEntityObjAfterMoving(gameID, branch, node, newParentID) {
  
  async function getTree() {

    const planningTree = await PlanningTreeModel.findOne({ gameID });

    if (!planningTree) {
      return { success: false, message: 'PlanningTree not found' };
    }

    // Найти ветку с соответствующим именем
    const branchIndex = planningTree.branches.findIndex((b) => b.branch === branch);

    if (branchIndex === -1) {
      return { success: false, message: 'Branch not found' };
    }

    // Найти планировочный тип с соответствующим типом
    const planningTypeIndex = planningTree.branches[branchIndex].planningTypes.findIndex(
      (p) => p.type === 'entity'
    );

    if (planningTypeIndex === -1) {
      return { success: false, message: 'PlanningType not found' };
    }

    // Найти ноду, куда нужно переместить
    const nodesTree = planningTree.branches[branchIndex].planningTypes[planningTypeIndex].nodes;

    if (!nodesTree) {
      return { success: false, message: 'Destination node not found' };
    }
    return { success: true, nodes: nodesTree[0] };
  }
  let planningTree = await getTree()
  if (planningTree.success === false) return
  planningTree = planningTree.nodes

  async function getNodes() {
    const nodes = await NodeModel.aggregate([
      { $match: { gameID } }, 
      { $unwind: "$branches" }, 
      { $match: { "branches.branch": branch } }, 
      { $unwind: "$branches.planningTypes" }, 
      { $match: { "branches.planningTypes.type": "entity" } },
      { $unwind: "$branches.planningTypes.nodes" },
      { $unset: ["branches.planningTypes.nodes.entityCategory.mainConfigs"] },
      { $unset: ["branches.planningTypes.nodes.entityBasic.mainConfigs"] },
      { $unset: ["branches.planningTypes.nodes.entityBasic.entityIcon"] },
      { $unset: ["branches.planningTypes.nodes.name"] },
      { $unset: ["branches.planningTypes.nodes.analyticsEvents"] },
      { $replaceRoot: { newRoot: "$branches.planningTypes.nodes" } }
    ]);

    if (!nodes) {
        return { success: false, error: 'No document found' };
    }

    return {success: true, nodes: nodes};
  }
  let nodes = await getNodes()
  if (nodes.success === false) return
  // Losing the unnecessary "success" field
  nodes = nodes.nodes

  let targetNode = nodes.find(n => n.nodeID === node.ID)
  let entityConfigField = targetNode.entityCategory !== undefined ? 'entityCategory' : 'entityBasic'


  function getInheritance(parentCategoryID) {
    let tempCategories = []

    function getInheritanceRecursively(parentCategoryID) {
  
      let inheritedNodeID = findNodeById(planningTree.subnodes, parentCategoryID)
  
      // Check if null. If so, it's Root
      if (inheritedNodeID === null) {
        if (planningTree._id.toString() === parentCategoryID) {
          inheritedNodeID = planningTree
        }
      }
  
      let entityConfigField = inheritedNodeID.isCategory ? 'entityCategory' : 'entityBasic'
  
      inheritedNodeID = inheritedNodeID.nodeID
  
      let inheritedNodeParentID = nodes.find(n => n.nodeID === inheritedNodeID)[entityConfigField].parentCategory
  
      // If this node is nested, go recursive until we hit the root
      tempCategories.push(inheritedNodeID)
      if (inheritedNodeParentID && inheritedNodeParentID !== '') {
  
        getInheritanceRecursively(inheritedNodeParentID)
  
      }
    }
    getInheritanceRecursively(parentCategoryID)

    return tempCategories
  }
  let newInheritedCategories = getInheritance(newParentID)
  // console.log('Target nodes new cats:', newInheritedCategories)
  

  function clearInheritedConfigs() {
    const inheritedCategoriesSet = new Set(newInheritedCategories);

    if (targetNode[entityConfigField].inheritedConfigs === '') return []
    let nodeConfigs = JSON.parse(targetNode[entityConfigField].inheritedConfigs)

    const filteredInheritedConfigs = nodeConfigs.filter(config => {
        const { nodeID } = config;
        return inheritedCategoriesSet.has(nodeID);
    });
    return filteredInheritedConfigs
  }
  const newInheritedConfigs = JSON.stringify(clearInheritedConfigs())

  targetNode = {
    ...targetNode,
    [entityConfigField]: {
      ...targetNode[entityConfigField],
      parentCategory: newParentID,
      inheritedCategories: newInheritedCategories,
      inheritedConfigs: newInheritedConfigs
    }
  }
  // console.log('Resulted node:', targetNode)

  const updateFields = {};
  updateFields[`branches.$[branch].planningTypes.$[planningType].nodes.$[node].${entityConfigField}.parentCategory`] = targetNode[entityConfigField].parentCategory;
  updateFields[`branches.$[branch].planningTypes.$[planningType].nodes.$[node].${entityConfigField}.inheritedCategories`] = targetNode[entityConfigField].inheritedCategories;
  updateFields[`branches.$[branch].planningTypes.$[planningType].nodes.$[node].${entityConfigField}.inheritedConfigs`] = targetNode[entityConfigField].inheritedConfigs;

  // console.log('Saving target fields', updateFields)

  // Saving target node
  try {
    const saveNode = await NodeModel.updateOne(
      { 
          gameID, 
          'branches': { $elemMatch: { 'branch': branch } },
          'branches.planningTypes': { $elemMatch: { 'type': 'entity' } },
          'branches.planningTypes.nodes': { $elemMatch: { 'nodeID': node.ID } }
      },
      {
          $set: updateFields,
      },
      { 
          arrayFilters: [
              { 'branch.branch': branch },
              { 'planningType.type': 'entity' },
              { 'node.nodeID': node.ID }
          ],
          new: true
      }
    );
    // console.log({ saveNode, success: true, message: 'Entity updated successfully' });
  } catch (error) {
    console.error('Error saving node while moving in tree:', error);
  }
  let updateLocalNodes = nodes.find(n => n.nodeID === targetNode.nodeID)
  updateLocalNodes = Object.assign(updateLocalNodes, targetNode)

  // Now we must also resolve all children nodes' inheritedCategories
  async function resolveChildren() {

    const parentNode = findNodeById(planningTree.subnodes, node._id)

    if (parentNode.subnodes && parentNode.subnodes.length > 0) {

      parentNode.subnodes.forEach(subnode => {

        async function resolveChildRecursively(subnode) {

          
          let child = nodes.find(n => n.nodeID === subnode.nodeID)

          let entityConfigField = child.entityCategory ? 'entityCategory' : 'entityBasic'

          let inheritedCategories = getInheritance(child[entityConfigField].parentCategory)
  
          const updateFields = {};
          updateFields[`branches.$[branch].planningTypes.$[planningType].nodes.$[node].${entityConfigField}.inheritedCategories`] = inheritedCategories;
        
          // console.log('Saving child inhcats:', inheritedCategories)
        
          // Saving child node
          const saveNode = NodeModel.updateOne(
            { 
                gameID, 
                'branches': { $elemMatch: { 'branch': branch } },
                'branches.planningTypes': { $elemMatch: { 'type': 'entity' } },
                'branches.planningTypes.nodes': { $elemMatch: { 'nodeID': child.nodeID } }
            },
            {
                $set: updateFields,
            },
            { 
                arrayFilters: [
                    { 'branch.branch': branch },
                    { 'planningType.type': 'entity' },
                    { 'node.nodeID': child.nodeID }
                ],
                new: true
            }
          );

          if (subnode.subnodes && subnode.subnodes.length > 0) {
            subnode.subnodes.forEach(subnode => {
              resolveChildRecursively(subnode)
            })
          }
        }
        resolveChildRecursively(subnode)

      })


    }

  }
  resolveChildren()

  async function resolveLocalizationItems() {

    // Get the new updated tree
    let newTree = await getTree()
    newTree = newTree.nodes

    // Get the current node we just moved
    const targetNode = findNodeById(newTree.subnodes, node._id)

    async function resolveExitedItems(nodeID) {
      let localizationItems = await Localization.aggregate([
        { $match: { gameID } }, 
        { $unwind: "$branches" }, 
        { $match: { "branches.branch": branch } }, 
        { $unwind: "$branches.localization" }, 
        { $unwind: `$branches.localization.entities` },
        { 
          $match: { 
              [`branches.localization.entities.sid`]: { 
                  $regex: new RegExp(`^.*\\|${nodeID}$`)
              } 
          } 
        },
        { $replaceRoot: { newRoot: `$branches.localization.entities` } }
      ]);

      if (localizationItems && localizationItems.length > 0) {
        for (const item of localizationItems) {
  
          if (item.inheritedFrom) {
            // We want to get the category node that we inherit localized item from
            const parentCategory = findNodeByNodeID(newTree.subnodes, item.inheritedFrom)
            // Then we want to check if the target node is a child of the parent node
            // This way we know if it is moved from the parent node. If so, we need to remove outdated localization items
            if (parentCategory) {
              const targetNodeAsChild = findNodeByNodeID(parentCategory.subnodes, nodeID)
              if (!targetNodeAsChild) {
                // Remove all localization items that are inherited from the parent category
                // and "sid" contains this nodeID
                const result = await Localization.updateMany(
                  { 
                    gameID, 
                    'branches.branch': branch,
                    'branches.localization.entities.sid': new RegExp(`^.*\\|${nodeID}$`),
                    'branches.localization.entities.inheritedFrom': item.inheritedFrom
                  },
                  { 
                    $pull: { 
                      'branches.$[branch].localization.entities': { 
                        $and: [
                          { sid: new RegExp(`^.*\\|${nodeID}$`) },
                          { inheritedFrom: item.inheritedFrom }
                        ]
                      }
                    }
                  },
                  {
                    arrayFilters: [
                      { 'branch.branch': branch },
                      { 'localization.entities.inheritedFrom': item.inheritedFrom }
                    ],
                    new: true,
                    multi: true
                  }
                ).exec();
              }
            }
          }
        }
      }

    }
    resolveExitedItems(targetNode.nodeID)

    async function resolveJoinedItems(nodeID) {
      let localizationItems = await Localization.aggregate([
        { $match: { gameID } }, 
        { $unwind: "$branches" }, 
        { $match: { "branches.branch": branch } }, 
        { $unwind: "$branches.localization" }, 
        { $unwind: `$branches.localization.entities` },
        { 
          $match: { 
              [`branches.localization.entities.inheritedFrom`]: { 
                  $exists: false
              } 
          } 
        },
        { $replaceRoot: { newRoot: `$branches.localization.entities` } }
      ]);
      
      if (localizationItems && localizationItems.length > 0) {
        for (const item of localizationItems) {
  
          const categoryNodeID = item.sid.split('|')[1]
          const parentCategory = findNodeByNodeID(newTree.subnodes, categoryNodeID)
          const targetNodeAsChild = findNodeByNodeID(parentCategory.subnodes, nodeID)

          if (targetNodeAsChild) {
            let tempItem = item
            tempItem.sid = tempItem.sid.split('|')[0] + '|' + nodeID;
            tempItem.inheritedFrom = categoryNodeID
            
            await insertLocalizationItem(gameID, branch, 'entities', tempItem);
          }

        }
      }

    }
    resolveJoinedItems(targetNode.nodeID)


    function recursivelyResolveItems(node) {
      if (node.subnodes) {
        for (const subnode of node.subnodes) {
          resolveJoinedItems(subnode.nodeID)
          resolveExitedItems(subnode.nodeID)
          recursivelyResolveItems(subnode)
        }
      }
    }
    recursivelyResolveItems(targetNode)
  }
  resolveLocalizationItems()


  return
}

app.post('/api/getEntitiesByNodeIDs', async (req, res) => {
  try {
    const { gameID, branch, nodeIDs } = req.body;

    const entities = await NodeModel.aggregate([
      { $match: { gameID } }, 
      { $unwind: "$branches" }, 
      { $match: { "branches.branch": branch } }, 
      { $unwind: "$branches.planningTypes" }, 
      { $match: { "branches.planningTypes.type": "entity" } },
      { $unwind: "$branches.planningTypes.nodes" },
      { $match: { "branches.planningTypes.nodes.nodeID": { $in: nodeIDs } } },
      { $unset: ["branches.planningTypes.nodes.entityBasic.mainConfigs"] },
      { $unset: ["branches.planningTypes.nodes.entityBasic.inheritedConfigs"] },
      { $unset: ["branches.planningTypes.nodes.analyticsEvents"] },
      { $unset: ["branches.planningTypes.nodes.entityCategory.parentCategory"] },
      { $replaceRoot: { newRoot: "$branches.planningTypes.nodes" } }
    ]);

    if (!entities) {
      return res.status(404).json({ message: 'Entity not found' });
    }
    res.status(200).json({ success: true, entities });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});
app.post('/api/getEntitiesIDs', async (req, res) => {
  try {
    const { gameID, branch } = req.body;

    const entities = await NodeModel.aggregate([
      { $match: { gameID } }, 
      { $unwind: "$branches" }, 
      { $match: { "branches.branch": branch } }, 
      { $unwind: "$branches.planningTypes" }, 
      { $match: { "branches.planningTypes.type": "entity" } },
      { $unwind: "$branches.planningTypes.nodes" },

      { $unset: ["branches.planningTypes.nodes.entityBasic.entityIcon"] },
      { $unset: ["branches.planningTypes.nodes.entityBasic.parentCategory"] },
      { $unset: ["branches.planningTypes.nodes.entityBasic.mainConfigs"] },
      { $unset: ["branches.planningTypes.nodes.entityBasic.inheritedConfigs"] },

      { $match: { "branches.planningTypes.nodes.entityCategory": { $exists: false } } },

      { $unset: ["branches.planningTypes.nodes.analyticsEvents"] },

      { $replaceRoot: { newRoot: "$branches.planningTypes.nodes" } }
    ]);

    if (!entities) {
      return res.status(404).json({ message: 'Entity not found' });
    }
    res.status(200).json({ success: true, entities });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});
app.post('/api/getEntitiesNames', async (req, res) => {
  try {
    const { gameID, branch } = req.body;

    const entities = await NodeModel.aggregate([
      { $match: { gameID } }, 
      { $unwind: "$branches" }, 
      { $match: { "branches.branch": branch } }, 
      { $unwind: "$branches.planningTypes" }, 
      { $match: { "branches.planningTypes.type": "entity" } },
      { $unwind: "$branches.planningTypes.nodes" },
      { $replaceRoot: { newRoot: "$branches.planningTypes.nodes" } },
      { 
        $project: {
          _id: 0,
          name: 1, 
          nodeID: 1 
        }
      }
    ]);

    if (!entities) {
      return res.status(404).json({ message: 'Entity not found' });
    }
    res.status(200).json({ success: true, entities });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});
app.post('/api/getEntityIcon', async (req, res) => {
  try {
    const { gameID, branch, nodeID } = req.body;

    let entityIcon = await NodeModel.aggregate([
      { $match: { gameID } }, 
      { $unwind: "$branches" }, 
      { $match: { "branches.branch": branch } }, 
      { $unwind: "$branches.planningTypes" }, 
      { $match: { "branches.planningTypes.type": "entity" } },
      { $unwind: "$branches.planningTypes.nodes" },
      { $match: { "branches.planningTypes.nodes.nodeID": nodeID } },

      { $unset: ["branches.planningTypes.nodes.entityBasic.mainConfigs"] },
      { $unset: ["branches.planningTypes.nodes.entityBasic.inheritedConfigs"] },
      { $unset: ["branches.planningTypes.nodes.entityCategory.mainConfigs"] },
      { $unset: ["branches.planningTypes.nodes.entityCategory.inheritedConfigs"] },

      { $replaceRoot: { newRoot: "$branches.planningTypes.nodes" } },
      { 
        $project: {
          _id: 0,
          nodeID: 1,
          entityBasic: 1,
          entityCategory: 1,
        }
      }
    ]);

    entityIcon = entityIcon[0]
    if (entityIcon.entityBasic) {
      entityIcon = entityIcon.entityBasic.entityIcon
    } else if (entityIcon.entityCategory) {
      entityIcon = entityIcon.entityCategory.entityIcon
    }


    if (!entityIcon) {
      return res.status(404).json({ message: 'Entity not found' });
    }
    res.status(200).json({ success: true, entityIcon });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

async function fetchEntityIcons(gameID, branch, nodeIDs) {
  let entityIcons = await NodeModel.aggregate([
    { $match: { gameID } }, 
    { $unwind: "$branches" }, 
    { $match: { "branches.branch": branch } }, 
    { $unwind: "$branches.planningTypes" }, 
    { $match: { "branches.planningTypes.type": "entity" } },
    { $unwind: "$branches.planningTypes.nodes" },
    { $match: { "branches.planningTypes.nodes.nodeID": { $in: nodeIDs } } },

    { $unset: ["branches.planningTypes.nodes.entityBasic.mainConfigs"] },
    { $unset: ["branches.planningTypes.nodes.entityBasic.inheritedConfigs"] },
    { $unset: ["branches.planningTypes.nodes.entityCategory.mainConfigs"] },
    { $unset: ["branches.planningTypes.nodes.entityCategory.inheritedConfigs"] },

    { $replaceRoot: { newRoot: "$branches.planningTypes.nodes" } },
    { 
      $project: {
        _id: 0,
        nodeID: 1,
        entityBasic: 1,
        entityCategory: 1,
      }
    }
  ]);

  entityIcons = entityIcons.map(entity => {
    if (entity.entityBasic) {
      return {
        nodeID: entity.nodeID,
        icon: entity.entityBasic.entityIcon
      }
    } else if (entity.entityCategory) {
      return {
        nodeID: entity.nodeID,
        icon: entity.entityCategory.entityIcon
      }
    }
  })
  return entityIcons
}
app.post('/api/getEntityIcons', async (req, res) => {
  try {
    const { gameID, branch, nodeIDs } = req.body;

    let entityIcons = await fetchEntityIcons(gameID, branch, nodeIDs)

    if (!entityIcons) {
      return res.status(404).json({ message: 'Entity not found' });
    }
    res.status(200).json({ success: true, entityIcons });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


app.post('/api/saveEntityBasicInfo', async (req, res) => {

  const { gameID, branch, nodeID, entityID, nodeName, isCategory } = req.body;
  try {
    const updateFields = {};

    if (isCategory) {
      updateFields[`branches.$[branch].planningTypes.$[planningType].nodes.$[node].name`] = nodeName;
      updateFields[`branches.$[branch].planningTypes.$[planningType].nodes.$[node].entityCategory.categoryID`] = entityID;
    } else {
      updateFields[`branches.$[branch].planningTypes.$[planningType].nodes.$[node].name`] = nodeName;
      updateFields[`branches.$[branch].planningTypes.$[planningType].nodes.$[node].entityBasic.entityID`] = entityID;
    }
  
    // Saving target node
    const resp = await NodeModel.updateOne(
      { 
          gameID, 
          'branches': { $elemMatch: { 'branch': branch } },
          'branches.planningTypes': { $elemMatch: { 'type': 'entity' } },
          'branches.planningTypes.nodes': { $elemMatch: { 'nodeID': nodeID } }
      },
      {
          $set: updateFields,
      },
      { 
          arrayFilters: [
              { 'branch.branch': branch },
              { 'planningType.type': 'entity' },
              { 'node.nodeID': nodeID }
          ],
          new: true
      }
    );
    res.status(200).json({ success: true, message: 'Entity updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});
app.post('/api/saveEntityRoles', async (req, res) => {

  const { gameID, branch, nodeID, isCurrency, isInAppPurchase, realValueBase } = req.body;

  try {
    const updateFields = {};
    updateFields[`branches.$[branch].planningTypes.$[planningType].nodes.$[node].entityBasic.isCurrency`] = isCurrency;
    updateFields[`branches.$[branch].planningTypes.$[planningType].nodes.$[node].entityBasic.isInAppPurchase`] = isInAppPurchase;
    updateFields[`branches.$[branch].planningTypes.$[planningType].nodes.$[node].entityBasic.realValueBase`] = realValueBase;
  
    // Saving target node
    await NodeModel.updateOne(
      { 
          gameID, 
          'branches': { $elemMatch: { 'branch': branch } },
          'branches.planningTypes': { $elemMatch: { 'type': 'entity' } },
          'branches.planningTypes.nodes': { $elemMatch: { 'nodeID': nodeID } }
      },
      {
          $set: updateFields,
      },
      { 
          arrayFilters: [
              { 'branch.branch': branch },
              { 'planningType.type': 'entity' },
              { 'node.nodeID': nodeID }
          ],
          new: true
      }
    );
    res.status(200).json({ success: true, message: 'Entity updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.post('/api/saveEntityIcon', async (req, res) => {

  const { gameID, branch, nodeID, entityIcon } = req.body;

  try {
    const updateFields = {};
    updateFields[`branches.$[branch].planningTypes.$[planningType].nodes.$[node].entityBasic.entityIcon`] = entityIcon;
  
    // Saving target node
    await NodeModel.updateOne(
      { 
          gameID, 
          'branches': { $elemMatch: { 'branch': branch } },
          'branches.planningTypes': { $elemMatch: { 'type': 'entity' } },
          'branches.planningTypes.nodes': { $elemMatch: { 'nodeID': nodeID } }
      },
      {
          $set: updateFields,
      },
      { 
          arrayFilters: [
              { 'branch.branch': branch },
              { 'planningType.type': 'entity' },
              { 'node.nodeID': nodeID }
          ],
          new: true
      }
    );
    res.status(200).json({ success: true, message: 'Entity updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.post('/api/saveEntityMainConfigs', async (req, res) => {

  const { gameID, branch, nodeID, mainConfigs, isCategory } = req.body;

  try {
    const updateFields = {};

    if (isCategory) {
      updateFields[`branches.$[branch].planningTypes.$[planningType].nodes.$[node].entityCategory.mainConfigs`] = mainConfigs;
    } else {
      updateFields[`branches.$[branch].planningTypes.$[planningType].nodes.$[node].entityBasic.mainConfigs`] = mainConfigs;
    }  

    // Saving target node
    await NodeModel.updateOne(
      { 
          gameID, 
          'branches': { $elemMatch: { 'branch': branch } },
          'branches.planningTypes': { $elemMatch: { 'type': 'entity' } },
          'branches.planningTypes.nodes': { $elemMatch: { 'nodeID': nodeID } }
      },
      {
          $set: updateFields,
      },
      { 
          arrayFilters: [
              { 'branch.branch': branch },
              { 'planningType.type': 'entity' },
              { 'node.nodeID': nodeID }
          ],
          new: true
      }
    );
    res.status(200).json({ success: true, message: 'Entity updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.post('/api/saveEntityInheritedConfigs', async (req, res) => {

  const { gameID, branch, nodeID, inheritedConfigs, isCategory } = req.body;

  try {
    const updateFields = {};

    if (isCategory) {
      updateFields[`branches.$[branch].planningTypes.$[planningType].nodes.$[node].entityCategory.inheritedConfigs`] = inheritedConfigs;
    } else {
      updateFields[`branches.$[branch].planningTypes.$[planningType].nodes.$[node].entityBasic.inheritedConfigs`] = inheritedConfigs;
    }
  
    // Saving target node
    await NodeModel.updateOne(
      { 
          gameID, 
          'branches': { $elemMatch: { 'branch': branch } },
          'branches.planningTypes': { $elemMatch: { 'type': 'entity' } },
          'branches.planningTypes.nodes': { $elemMatch: { 'nodeID': nodeID } }
      },
      {
          $set: updateFields,
      },
      { 
          arrayFilters: [
              { 'branch.branch': branch },
              { 'planningType.type': 'entity' },
              { 'node.nodeID': nodeID }
          ],
          new: true
      }
    );
    res.status(200).json({ success: true, message: 'Entity updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

async function makeLocalizationForCategoryChildren(gameID, branch, categoryNodeID, translationObjects) {
  try {

    let planningTree = await PlanningTreeModel.findOne({ gameID });
    if (!planningTree) {
      return { success: false, message: 'PlanningTree not found' };
    }
    planningTree = planningTree.branches.find(b => b.branch === branch);
    planningTree = planningTree.planningTypes.find(pt => pt.type === 'entity');

    const categoryNode = findNodeByNodeID(planningTree.nodes, categoryNodeID)
    if (!categoryNode) {
      return { success: false, message: 'Category node not found' };
    }

    async function recursivelyMakeItems(node) {
      if (node.subnodes) {
        for (const subnode of node.subnodes) {
          let modifiedObjects = translationObjects.map(obj => {
            obj.sid = obj.sid.split('|')[0] + '|' + subnode.nodeID;
            return obj;
          });
          await updateLocalization(gameID, branch, 'entities', modifiedObjects, categoryNode.nodeID);
          await recursivelyMakeItems(subnode)
        }
      }
    }
    recursivelyMakeItems(categoryNode)

  } catch (error) {
    console.error(error);
  }
}

// Localization
async function insertLocalizationItem(gameID, branch, type, translationObject) {
  try {
    const result = await Localization.findOneAndUpdate(
      { 
        gameID, 
        'branches.branch': branch 
      },
      { 
        $push: {
          [`branches.$[branch].localization.${type}`]: translationObject
        }
      },
      {
        arrayFilters: [
          { 'branch.branch': branch },
        ],
        upsert: true,
        new: true
      }
    ).exec();
  } catch (error) {
    console.error(error);
  }
}
async function updateLocalization(gameID, branch, type, translationObjects, categoryNodeID) {

  let fieldToUpdate;
  switch (type) {
    case 'offers':
      fieldToUpdate = `branches.$[branch].localization.offers`;
      break;
    case 'entities':
      fieldToUpdate = `branches.$[branch].localization.entities`;
      break;
    case 'custom':
      fieldToUpdate = `branches.$[branch].localization.custom`;
      break;
    default:
      return res.status(400).json({ error: 'Invalid localization type' });
  }

  async function getLocalizationDocument(type) {
    let array = []
    array = await Localization.aggregate([
      { $match: { gameID } }, 
      { $unwind: "$branches" }, 
      { $match: { "branches.branch": branch } }, 
      { $unwind: "$branches.localization" }, 
      { $unwind: `$branches.localization.${type}` },
      { $replaceRoot: { newRoot: `$branches.localization.${type}` } }
    ]);
    return array;
  }
  
  let localizations = await getLocalizationDocument(type)
  
  translationObjects.forEach(translation => {
    const sid = translation.sid;
    const key = translation.key;
    let values = []
    Object.keys(translation.translations).forEach(obj => {
      values.push({
        code: obj,
        value: translation.translations[obj]
      })
    })
  
    const exists = localizations.some(localization => localization.sid === sid)
    if (exists) {
      const index = localizations.findIndex(localization => localization.sid === sid)
      localizations[index].translations = values
      localizations[index].key = key
    } else {

      // If we're creating inherited localization item, we need to also tell which node it was inherited from
      if (categoryNodeID) {
        localizations.push({ sid: sid, key: key, translations: values, inheritedFrom: categoryNodeID })
      } else {
        localizations.push({ sid: sid, key: key, translations: values })
      }
      
      if (type === 'entities') {
        makeLocalizationForCategoryChildren(
          gameID, 
          branch, 
          translation.sid.split('|')[1],
          translationObjects
        )
      }
    }
  });
  
  const filter = { gameID };
  const arrayFilters = 
  [
    { 'gameID': gameID }, 
    { 'branch.branch': branch }
  ]
  await Localization.updateMany(filter, 
    { 
      $set: {[`${fieldToUpdate}`]: localizations}
    }, 
    { arrayFilters, upsert: true }).exec()
}
app.post('/api/updateLocalization', async (req, res) => {
  const { gameID, branch, type, translationObjects } = req.body;

  try {

    await updateLocalization(gameID, branch, type, translationObjects)

    res.status(200).json({ message: 'Localization updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.post('/api/getLocalization', async (req, res) => {
  const { gameID, branch, type } = req.body;

  try {

    async function getLocalizationDocument(type) {
      let array = []
      array = await Localization.aggregate([
        { $match: { gameID } }, 
        { $unwind: "$branches" }, 
        { $match: { "branches.branch": branch } }, 
        { $unwind: "$branches.localization" }, 
        { $unwind: `$branches.localization.${type}` },
        { $replaceRoot: { newRoot: `$branches.localization.${type}` } }
      ]);
      return array;
    }

    let localizations = await getLocalizationDocument(type)

    res.status(200).json({ localizations: localizations, success: true, message: 'Localization fetched successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.post('/api/getLocalizationItems', async (req, res) => {
  const { gameID, branch, type, sids } = req.body;

  try {
    let fieldToUpdate;
    switch (type) {
      case 'offers':
        fieldToUpdate = `branches.$[branch].localization.offers`;
        break;
      case 'entities':
        fieldToUpdate = `branches.$[branch].localization.entities`;
        break;
      case 'custom':
        fieldToUpdate = `branches.$[branch].localization.custom`;
        break;
      default:
        return res.status(400).json({ error: 'Invalid localization type' });
    } 

    async function getLocalizationDocument(type) {
      let array = []
      array = await Localization.aggregate([
        { $match: { gameID } }, 
        { $unwind: "$branches" }, 
        { $match: { "branches.branch": branch } }, 
        { $unwind: "$branches.localization" }, 
        { $unwind: `$branches.localization.${type}` },
        { $match: { [`branches.localization.${type}.sid`]: { $in: sids } } },
        { $replaceRoot: { newRoot: `$branches.localization.${type}` } }
      ]);
      return array;
    }

    let localizations = await getLocalizationDocument(type)

    res.status(200).json({ localizations: localizations, success: true, message: 'Localization fetched successfully' });
  } catch (error) {
    console.error('Error getting localization items:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
app.post('/api/removeLocalizationItem', async (req, res) => {
  const { gameID, branch, type, sid } = req.body;

  try {
    const result = await Localization.findOneAndUpdate(
      { 
        gameID, 
        'branches.branch': branch 
      },
      { 
        $pull: { 
          [`branches.$[branch].localization.${type}`]: { 
            sid: { $regex: new RegExp(`^${sid}\\|`) }
          }
        }
      },
      {
        arrayFilters: [
          { 'branch.branch': branch },
        ],
        new: true
      }
    ).exec();

    res.status(200).json({ success: true, message: 'Localization item removed successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})

app.post('/api/changeLocalizationItemKey', async (req, res) => {
  const { gameID, branch, type, sid, newKey } = req.body;

  try {
    const result = await Localization.findOneAndUpdate(
      { 
        gameID, 
        'branches.branch': branch,
        [`branches.localization.${type}.sid`]: sid
      },
      { 
        $set: { 
          [`branches.$[branch].localization.${type}.$.key`]: newKey 
        }
      },
      {
        arrayFilters: [
          { 'branch.branch': branch },
        ],
        new: true
      }
    ).exec();

    res.status(200).json({ success: true, message: 'Localization item changed successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})

app.post('/api/createNewOffer', async (req, res) => {
  const { gameID, branch, offerObj } = req.body;
  try {
    // content, price-moneyCurr, triggers fields must be stringified from JSON
    
    const offer = {
      offerID: offerObj.offerId,
      offerName: offerObj.name,
      offerCodeName: offerObj.offerCodeName,
      offerIcon: offerObj.icon,

      offerInGameName: offerObj.ingameNameStringId,
      offerInGameDescription: offerObj.descrStringId,

      offerTags: offerObj.tags,

      offerPurchaseLimit: offerObj.purchaseLimit,
      offerDuration: {
        value: offerObj.duration.value,
        timeUnit: offerObj.duration.timeUnit,
      },

      offerSegments: offerObj.segments,
      offerTriggers: offerObj.triggers,

      offerPrice: {
        targetCurrency: offerObj.price.targetCurrency,
        nodeID: offerObj.price.nodeID,
        amount: offerObj.price.amount,
        moneyCurr: offerObj.price.moneyCurr,
      },

      content: offerObj.content,
    };
    const result = await Offers.findOneAndUpdate(
      { gameID },
      { $addToSet: { 'branches.$[branch].offers': offer } },
      { arrayFilters: [{ 'branch.branch': branch }], upsert: true, new: true }
    ).exec();

    const translationObjects = [
      {
        sid: offerObj.ingameNameStringId,
        key: offerObj.ingameNameStringId,
        translations: {
          en: 'Localized name',
        }
      },
      {
        sid: offerObj.descrStringId,
        key: offerObj.descrStringId,
        translations: {
          en: 'Localized description',
        }
      },
    ]

    await updateLocalization(gameID, branch, 'offers', translationObjects)

    res.status(200).json({ success: true, message: 'Offer created successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
app.post('/api/updateOffer', async (req, res) => {
  const { gameID, branch, offerObj } = req.body;
  try {
    // content, price-moneyCurr, triggers fields must be stringified from JSON
    
    const offer = {
      offerID: offerObj.offerId,
      offerName: offerObj.name,
      offerCodeName: offerObj.offerCodeName,
      offerIcon: offerObj.icon,

      offerInGameName: offerObj.ingameNameStringId,
      offerInGameDescription: offerObj.descrStringId,

      offerTags: offerObj.tags,

      offerPurchaseLimit: offerObj.purchaseLimit,
      offerDuration: {
        value: offerObj.duration.value,
        timeUnit: offerObj.duration.timeUnit,
      },

      offerSegments: offerObj.segments,
      offerTriggers: offerObj.triggers,

      offerPrice: {
        targetCurrency: offerObj.price.targetCurrency,
        nodeID: offerObj.price.nodeID,
        amount: offerObj.price.amount,
        moneyCurr: offerObj.price.moneyCurr,
      },

      content: offerObj.content,
    };

    const result = await Offers.findOneAndUpdate(
      { 
        gameID, 
        'branches.branch': branch, 
        'branches.offers.offerID': offerObj.offerId 
      },
      { 
        $set: { 
          'branches.$[branch].offers.$[offer]': offer 
        } 
      },
      {
        arrayFilters: [
          { 'branch.branch': branch },
          { 'offer.offerID': offerObj.offerId }
        ],
        new: true
      }
    ).exec();

    res.status(200).json({ success: true, message: 'Offer created successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
app.post('/api/getOffers', async (req, res) => {
  const { gameID, branch } = req.body;

  try {
    const offers = await Offers.aggregate([
        { $match: { gameID } }, 
        { $unwind: "$branches" }, 
        { $match: { "branches.branch": branch } }, 
        { $unwind: "$branches.offers" }, 
        { $replaceRoot: { newRoot: `$branches.offers` } }
    ]);

    res.status(200).json({ success: true, offers });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})

app.post('/api/removeOffer', async (req, res) => {
  const { gameID, branch, offerID } = req.body;
  try {

    let positions = await Offers.findOne({ gameID, 'branches.branch': branch });
    if (!positions) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }
    positions = JSON.parse(positions.branches.find(b => b.branch === branch).positions)
    positions = positions.map(p => {
      p.segments = p.segments.map(s => {
        s.offers = s.offers.filter(o => o !== offerID)
        return s
      })
      return p
    })
    positions = JSON.stringify(positions)

    const result = await Offers.findOneAndUpdate(
      { 
        gameID, 
        'branches.branch': branch 
      },
      { 
        $pull: { 
          'branches.$[branch].offers': { offerID: offerID } 
        },
        $set: { 
          'branches.$[branch].positions': positions
        }
      },
      {
        arrayFilters: [
          { 'branch.branch': branch }
        ],
        new: true
      }
    ).exec();

    const locResult = await Localization.findOneAndUpdate(
      { 
        gameID, 
        'branches.branch': branch 
      },
      { 
        $pull: { 
          'branches.$[branch].localization.offers': { 
            $or: [
              { sid: offerID + "|name" },
              { sid: offerID + "|desc" }
            ]
          }
        }
      },
      {
        arrayFilters: [
          { 'branch.branch': branch }
        ],
        new: true
      }
    ).exec();

    res.status(200).json({ success: true, message: 'Offer created successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
app.post('/api/getOffersNames', async (req, res) => {
  const { gameID, branch } = req.body;

  try {
    const offers = await Offers.aggregate([
        { $match: { gameID } }, 
        { $unwind: "$branches" }, 
        { $match: { "branches.branch": branch } }, 
        { $unwind: "$branches.offers" }, 
        { $replaceRoot: { newRoot: `$branches.offers` } },
        { 
          $project: {
            _id: 0,
            offerID: 1, 
            offerName: 1 
          }
        }
      ]);

    res.status(200).json({ success: true, offers });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
app.post('/api/getOffersByContentNodeID', async (req, res) => {
  const { gameID, branch, nodeID } = req.body;

  try {
    const offers = await Offers.aggregate([
        { $match: { gameID } }, 
        { $unwind: "$branches" }, 
        { $match: { "branches.branch": branch } }, 
        { $unwind: "$branches.offers" }, 
        { $match: { "branches.offers.content": { $elemMatch: { nodeID: nodeID } } } },
        { $replaceRoot: { newRoot: `$branches.offers` } },
        { 
          $project: {
            _id: 0,
            offerID: 1,
            offerName: 1,
            offerIcon: 1,
            content: 1,
          }
        }
      ]);

    res.status(200).json({ success: true, offers });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
app.post('/api/getPositionedOffers', async (req, res) => {
  const { gameID, branch } = req.body;

  try {
    let pos = await Offers.aggregate([
        { $match: { gameID } }, 
        { $unwind: "$branches" }, 
        { $match: { "branches.branch": branch } }, 
    ]);
    pos = pos[0].branches.positions

    if (!pos || pos === '') {
      return res.status(404).json({ success: false, message: 'Data not found' });
    }

    let parsed = JSON.parse(pos);

    res.status(200).json({ success: true, positions: parsed });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
app.post('/api/setPositionedOffers', async (req, res) => {
  const { gameID, branch, positions } = req.body;

  try {
    const result = await Offers.findOneAndUpdate(
      { 
        gameID, 
        'branches.branch': branch 
      },
      {
        $set: { "branches.$.positions": positions },
      },
      {
        new: true,
        upsert: true
      }
    ).exec();
    

    res.status(200).json({ success: true, message: 'Positions set successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
app.post('/api/getGameplayRelations', async (req, res) => {
  try {
      const { gameID, branchName } = req.body;

      if (!gameID || !branchName) {
          return res.status(400).json({ success: false, message: 'Missing required parameters' });
      }

      // Get the planning tree and relations for the specified gameID and branchName
      const [planningTree, relationsData] = await Promise.all([
          PlanningTreeModel.findOne({ gameID, 'branches.branch': branchName, 'branches.planningTypes.type': 'gameplay' }),
          Relations.findOne({ gameID, 'branches.branch': branchName })
      ]);

      if (!planningTree || !relationsData) {
          return res.status(404).json({ success: false, message: 'Data not found' });
      }

      // Extract gameplay nodes and their subnodes
      const gameplayNodes = extractGameplayNodes(planningTree);
      const gameplayRelations = getGameplayRelations(gameplayNodes, relationsData);

      res.status(200).json({ success: true, gameplayRelations });
  } catch (error) {
      console.error('Error in /api/getRelatedGameplays:', error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

function extractGameplayNodes(planningTree) {
  let gameplayNodes = [];

  const extractNodes = (nodes) => {
    nodes.forEach(node => {
      if (node.isGameplay) {
        gameplayNodes.push({
          gameplayNodeID: node.nodeID,
          subnodes: node.subnodes
        });
      }
      if (node.subnodes) {
        extractNodes(node.subnodes);
      }
    });
  };

  planningTree.branches.forEach(branch => {
    branch.planningTypes.forEach(type => {
      if (type.type === 'gameplay') {
        extractNodes(type.nodes);
      }
    });
  });

  return gameplayNodes;
}

function getGameplayRelations(gameplayNodes, relationsData) {
  let relationsMap = new Map();

  gameplayNodes.forEach(gameplayNode => {
    gameplayNode.subnodes.forEach(subnode => {
      relationsData.branches.forEach(branch => {
        branch.relations.forEach(relation => {
          relation.links.forEach(link => {
            if (link.source === subnode.nodeID || link.target === subnode.nodeID) {
              const otherNodeID = link.source === subnode.nodeID ? link.target : link.source;

              gameplayNodes.forEach(otherGameplayNode => {
                if (otherGameplayNode.subnodes.some(n => n.nodeID === otherNodeID)) {
                  const relationKey = [gameplayNode.gameplayNodeID, otherGameplayNode.gameplayNodeID].sort().join('_');
                  const existingRelation = relationsMap.get(relationKey);

                  if (existingRelation) {
                    if (!existingRelation.relations.includes(relation.relationID)) {
                      existingRelation.relations.push(relation.relationID);
                    }
                  } else {
                    relationsMap.set(relationKey, {
                      nodeID_1: gameplayNode.gameplayNodeID,
                      nodeID_2: otherGameplayNode.gameplayNodeID,
                      relations: [relation.relationID]
                    });
                  }
                }
              });
            }
          });
        });
      });
    });
  });

  return Array.from(relationsMap.values());
}


// Вспомогательная функция для поиска ноды по nodeID
function findNodeByNodeID(nodes, nodeID) {
  for (const node of nodes) {
    if (node.nodeID.toString() === nodeID) {
      return node;
    }
    const subnodeResult = findNodeByNodeID(node.subnodes, nodeID);
    if (subnodeResult) {
      return subnodeResult;
    }
  }
  return null;
}

// Вспомогательная функция для поиска ноды по _id
function findNodeById(nodes, id) {
  for (const node of nodes) {
    if (node._id.toString() === id) {
      return node;
    }
    const subnodeResult = findNodeById(node.subnodes, id);
    if (subnodeResult) {
      return subnodeResult;
    }
  }
  return null;
}

// Вспомогательная функция для удаления ноды по _id
function removeNodeById(nodes, id) {
  const index = nodes.findIndex((node) => node._id.toString() === id);
  if (index !== -1) {
    return nodes.splice(index, 1)[0];
  }
  for (const node of nodes) {
    const removedNode = removeNodeById(node.subnodes, id);
    if (removedNode) {
      return removedNode;
    }
  }
  return null;
}

app.post('/api/checkEntityIDExists', async (req, res) => {
  try {
    const { gameID, branchName, entityID } = req.body;

    // Ищем документ в коллекции nodes, соответствующий gameID
    const gameDocument = await NodeModel.findOne({ 'branches.branch': branchName, gameID }).exec();

    if (!gameDocument) {
      return res.status(404).json({ exists: false });
    }

    // Проверяем, существует ли entityID в указанной ветке
    const exists = gameDocument.branches.some((branch) =>
      branch.branch === branchName && branch.planningTypes.some((type) =>
        type.nodes.some((node) => node.entityID === entityID)
      )
    );

    return res.json({ exists });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/createNewRemoteConfigParam', async (req, res) => {
  const { gameID, branchName, nodeID } = req.body;

  try {
    // Найти узел в коллекции nodes
    const resultNode = await NodeModel.findOne({ gameID });
    if (!resultNode) {
      return res.status(404).json({ message: 'Node not found' });
    }

    // Найти соответствующую ветвь и узел внутри нее
    const selectedBranch = resultNode.branches.find(b => b.branch === branchName);
    if (!selectedBranch) {
      return res.status(404).json({ message: 'Branch not found' });
    }

    const selectedNode = selectedBranch.planningTypes.reduce((acc, pt) => {
      const foundNode = pt.nodes.find(n => n.nodeID === nodeID);
      return foundNode ? foundNode : acc;
    }, null);

    if (!selectedNode) {
      return res.status(404).json({ message: 'Node not found in the specified branch' });
    }

    // Создание нового параметра
    const newParam = {
      paramID: new mongoose.Types.ObjectId().toString(), // генерация уникального ID
      paramName: 'New Parameter', // ваше значение
      paramCodeName: 'New Parameter', // ваше значение
      valueType: '', // ваше значение
      values: [], // начальные значения
    };

    // Добавление нового параметра в выбранный узел
    selectedNode.remoteConfigParams.push(newParam.paramID);

    // Сохранение обновленного узла
    await resultNode.save();

    // Добавление нового параметра в коллекцию RemoteConfig
    const remoteConfig = await RemoteConfig.findOne({ gameID, 'branches.branch': branchName });

    if (remoteConfig) {
      // Обновляем существующий документ
      const updatedRemoteConfig = await RemoteConfig.findOneAndUpdate(
        { gameID, 'branches.branch': branchName, 'branches.params.paramID': { $ne: newParam.paramID } },
        {
          $addToSet: {
            'branches.$.params': newParam,
          },
        },
        { new: true }
      );

      const updatedParam = await refreshSingleRemoteConfigSegments(gameID, branchName, newParam.paramID)

      res.status(200).json({
        success: true,
        message: 'New remote config param created',
        remoteConfigParams: selectedNode.remoteConfigParams,
      });

    } else {
      // Создаем новый документ
      const newRemoteConfig = new RemoteConfig({
        gameID,
        branches: [
          {
            branch: branchName,
            params: [newParam],
          },
        ],
      });

      await newRemoteConfig.save();

      const updatedParam = await refreshSingleRemoteConfigSegments(gameID, branchName, newParam.paramID)

      res.status(200).json({
        success: true,
        message: 'New remote config param created',
        remoteConfigParams: selectedNode.remoteConfigParams,
      });
    }

  } catch (error) {
    console.error('Error creating new remote config param:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});
app.post('/api/getRemoteConfigParams', async (req, res) => {
  const { gameID, branchName, paramIDs } = req.body;

  try {
    // Поиск документа RemoteConfig
    const remoteConfig = await RemoteConfig.findOne({ gameID, 'branches.branch': branchName, 'branches.params.paramID': { $in: paramIDs } });

    if (!remoteConfig) {
      return res.status(404).json({ message: 'RemoteConfig not found' });
    }

    // Фильтрация параметров по массиву paramID
    const foundParams = remoteConfig.branches
      .find(b => b.branch === branchName)
      .params.filter(param => paramIDs.includes(param.paramID));

    res.status(200).json({ success: true, message: 'Params found successfully', params: foundParams });
  } catch (error) {
    console.error('Error getting remote config params:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});
app.post('/api/checkIfRCParamCodeNameExists', async (req, res) => {
  const { gameID, branchName, paramCodeName, paramID } = req.body;

  try {
    // Найти документ RemoteConfig по gameID и branchName
    const remoteConfig = await RemoteConfig.findOne({ gameID, 'branches.branch': branchName });

    if (!remoteConfig) {
      return res.status(404).json({ exists: false, message: 'RemoteConfig not found' });
    }

    const conflictingParamIDs = [];

    // Проверить количество вхождений параметра с заданным paramCodeName
    // const paramCount = remoteConfig.branches.reduce((count, branch) => {
    //   return count + branch.params.filter(param => param.paramCodeName === paramCodeName && param.paramID !== paramID).length;
    // }, 0);
    remoteConfig.branches.forEach((branch) => {
      if (branch.branch === branchName) {
        branch.params.forEach((param) => {
          if (param.paramCodeName === paramCodeName && param.paramID !== paramID) {
            conflictingParamIDs.push(param.paramID);
          }
        });
      }
    });
    // Если количество равно 0 или 1, то считаем, что параметр не существует
    const paramExists = conflictingParamIDs.length >= 1;
    let nodeName
    if( paramExists ) {
      nodeName = await getNodeNameByParamID(gameID, branchName, conflictingParamIDs[0])
    }

    res.status(200).json({ exists: paramExists, conflictingNodeName: nodeName });
  } catch (error) {
    console.error('Error checking if RC param code name exists:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});
// Searches node with given paramID in it's dependencies and returns it's name
async function getNodeNameByParamID(gameID, branchName, paramID) {
  try {
    const result = await NodeModel.aggregate([
      { $match: { gameID: gameID, 'branches.branch': branchName } },
      { $unwind: '$branches' },
      { $match: { 'branches.branch': branchName } },
      { $unwind: '$branches.planningTypes' },
      { $unwind: '$branches.planningTypes.nodes' },
      { $match: { 'branches.planningTypes.nodes.remoteConfigParams': paramID } },
      { $project: { _id: 0, 'nodeName': '$branches.planningTypes.nodes.name' } }
    ]);

    if (!result || result.length === 0) {
      return null; // Если нода с указанным paramID не найдена
    }

    return result[0].nodeName;

  } catch (error) {
    console.error('Error fetching node:', error.message);
    throw error;
  }
}
app.post('/api/updateRemoteConfigParam', async (req, res) => {
  const { gameID, branchName, paramID, paramObject } = req.body;

  try {
    // Найти соответствующий документ RemoteConfig
    const remoteConfig = await RemoteConfig.findOne({
      gameID,
      'branches.branch': branchName,
      'branches.params.paramID': paramID,
    });

    if (!remoteConfig) {
      return res.status(404).json({ message: 'RemoteConfig not found' });
    }

    // Найти соответствующий параметр внутри выбранной ветви
    const selectedBranch = remoteConfig.branches.find(b => b.branch === branchName);
    const selectedParamIndex = selectedBranch.params.findIndex(p => p.paramID === paramID);

    if (selectedParamIndex === -1) {
      return res.status(404).json({ message: 'Param not found in the specified branch' });
    }

    // Обновить параметр
    selectedBranch.params[selectedParamIndex] = paramObject;

    // Сохранить обновленный документ RemoteConfig
    const updatedRemoteConfig = await remoteConfig.save();

    res.status(200).json({
      success: true,
      message: 'RemoteConfig param updated successfully',
      updatedParam: paramObject,
      updatedRemoteConfig,
    });
  } catch (error) {
    console.error('Error updating RemoteConfig param:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});
app.post('/api/removeRemoteConfigParam', async (req, res) => {
  const { gameID, branchName, paramID, nodeID } = req.body;

  try {
    // Находим соответствующий объект RemoteConfig
    const remoteConfig = await RemoteConfig.findOne({ gameID });
    if (!remoteConfig) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const branch = remoteConfig.branches.find((b) => b.branch === branchName);
    if (!branch) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    const paramIndex = branch.params.findIndex((p) => p.paramID === paramID);
    if (paramIndex === -1) {
      return res.status(404).json({ error: 'Param not found' });
    }

    // Удаляем объект param по индексу
    branch.params.splice(paramIndex, 1);

    // Находим соответствующий объект NodeModel
    const node = await NodeModel.findOne({ gameID });
    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    const nodeBranch = node.branches.find((b) => b.branch === branchName);
    if (!branch) {
      return res.status(404).json({ error: 'Planning type not found' });
    }

    for (const planningType of nodeBranch.planningTypes) {
      const nodeToUpdate = planningType.nodes.find((n) => n.nodeID === nodeID);
      if (nodeToUpdate) {
        // Удалить paramID из remoteConfigParams
        nodeToUpdate.remoteConfigParams = nodeToUpdate.remoteConfigParams.filter((param) => param !== paramID);
      }
    }

    // Сохраняем обновленный объект NodeModel
    await node.save();

    res.json({ message: 'Param removed successfully' });
  } catch (error) {
    console.error('Error removing param:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Принимает массив айди и возвращает подходящие ивенты
app.post('/api/getAnalyticsEventsConfig', async (req, res) => {
  try {
    const { gameID, branchName, eventIDs } = req.body;

    if (!gameID || !branchName || !eventIDs || !eventIDs.length) {
      return res.status(400).json({ message: 'Missing required parameters' });
    }

    const analyticsData = await AnalyticsEvents.findOne(
      { gameID, 'branches.branch': branchName },
      { 'branches.$': 1 }
    );

    if (!analyticsData) {
      return res.status(404).json({ message: 'Data not found' });
    }

    const branch = analyticsData.branches.find(b => b.branch === branchName);
    const filteredEvents = branch.events.filter(event => eventIDs.includes(event.eventID));

    res.status(200).json({ success: true, matchingEvents: filteredEvents});
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});
app.post('/api/createNewAnalyticsEvent', async (req, res) => {
  try {
    const { gameID, branchName } = req.body;

    if (!gameID || !branchName) {
      return res.status(400).json({ message: 'Missing required parameters' });
    }

    const eventID = new mongoose.Types.ObjectId().toString();
    const newEvent = {
      eventID,
      eventName: 'New Event',
      eventCodeName: '',
      values: [],
      comment: '',
      tags: [],
    };

    // Добавление нового ивента в коллекцию AnalyticsEvents
    await AnalyticsEvents.findOneAndUpdate(
      { gameID, 'branches.branch': branchName },
      {
        $addToSet: { 'branches.$.events': newEvent },
      },
      { upsert: true, new: true }
    );

    // Добавление ID нового ивента в ноду
    // const nodeModel = await NodeModel.findOne({ gameID, 'branches.branch': branchName });
    // if (nodeModel) {
    //   nodeModel.branches.forEach(branch => {
    //     if (branch.branch === branchName) {
    //       branch.planningTypes.forEach(planningType => {
    //         planningType.nodes.forEach(node => {
    //           if (node.nodeID === nodeID) {
    //             node.analyticsEvents.push(eventID);
    //           }
    //         });
    //       });
    //     }
    //   });
    //   await nodeModel.save();
    // }

    res.status(200).json({
      success: true,
      message: 'New analytics event created',
      newEvent
    });
  } catch (error) {
    console.error('Error creating new analytics event:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});
app.post('/api/removeAnalyticsEvent', async (req, res) => {
  try {
    const { gameID, branchName, nodeID, eventID } = req.body;

    if (!gameID || !branchName || !nodeID || !eventID) {
      return res.status(400).json({ message: 'Missing required parameters' });
    }

    // Удаление eventID из коллекции AnalyticsEvents
    const result = await AnalyticsEvents.findOneAndUpdate(
      { gameID, 'branches.branch': branchName },
      { $pull: { 'branches.$.events': { eventID } } }
    );

    if (!result) {
      return res.status(404).json({ message: 'Analytics event not found' });
    }

    // Удаление eventID из ноды
    await NodeModel.findOneAndUpdate(
      { gameID, 'branches.branch': branchName, 'branches.planningTypes.nodes.nodeID': nodeID },
      { $pull: { 'branches.$.planningTypes.$[type].nodes.$[n].analyticsEvents': eventID } },
      { arrayFilters: [{ 'type.type': { $exists: true } }, { 'n.nodeID': nodeID }] }
    );

    res.status(200).json({ success: true, message: 'Analytics event deleted' });
  } catch (error) {
    console.error('Error deleting analytics event:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});
app.post('/api/v2/removeAnalyticsEvent', async (req, res) => {
  try {
    const { gameID, branchName, eventID } = req.body;

    if (!gameID || !branchName || !eventID) {
      return res.status(400).json({ message: 'Missing required parameters' });
    }

    // Set analytics event field "removed" to true
    const result = await AnalyticsEvents.findOneAndUpdate(
      { gameID, 'branches.branch': branchName },
      { $set: { 'branches.$.events.$[e].removed': true } },
      { arrayFilters: [{ 'e.eventID': eventID }] }
    );

    if (!result) {
      return res.status(404).json({ message: 'Analytics event not found' });
    }

    res.status(200).json({ success: true, message: 'Analytics event deleted' });
  } catch (error) {
    console.error('Error deleting analytics event:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});
app.post('/api/checkIfAnalyticsEventIDExists', async (req, res) => {
  try {
    const { gameID, branchName, eventID, eventCodeName } = req.body;

    if (!gameID || !branchName || !eventID) {
      return res.status(400).json({ message: 'Missing required parameters' });
    }

    const analyticsEvents = await AnalyticsEvents.findOne({ gameID });
    if (!analyticsEvents) {
      return res.status(404).json({ exists: false });
    }

    const branch = analyticsEvents.branches.find((b) => b.branch === branchName);
    if (!branch) {
      return res.status(404).json({ exists: false });
    }

    // Подсчитываем, сколько раз eventID встречается в events данной ветви
    const eventCount = branch.events.filter((event) => event.eventCodeName === eventCodeName && event.eventID !== eventID).length;
    // Если eventCount больше или равно 1, то это дубликат
    const exists = eventCount >= 1;

    res.status(200).json({ exists });
  } catch (error) {
    console.error('Error checking analytics event ID existence:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});
app.post('/api/updateAnalyticsEvent', async (req, res) => {
  try {
    const { gameID, branchName, eventID, eventObject } = req.body;

    if (!gameID || !branchName || !eventID || !eventObject) {
      return res.status(400).json({ message: 'Missing required parameters' });
    }

    let tempObj = eventObject;
    // tempObj.values = tempObj.values.map(value => {
    //   console.log('value', value)
    //   value._id = value._id;
    //   return value;
    // });

    // Найти и обновить ивент в коллекции AnalyticsEvents
    const updatedAnalyticsEvent = await AnalyticsEvents.findOneAndUpdate(
      { 'gameID': gameID, 'branches.branch': branchName, 'branches.events.eventID': eventID },
      {
        $set: {
          'branches.$[b].events.$[e].eventName': tempObj.eventName,
          'branches.$[b].events.$[e].eventCodeName': tempObj.eventCodeName,
          'branches.$[b].events.$[e].values': tempObj.values,
          'branches.$[b].events.$[e].comment': tempObj.comment,
          'branches.$[b].events.$[e].tags': tempObj.tags,
        },
      },
      {
        arrayFilters: [{ 'b.branch': branchName }, { 'e.eventID': eventID }],
        new: true,
      }
    );

    if (!updatedAnalyticsEvent) {
      return res.status(404).json({ message: 'Analytics event not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Analytics event updated successfully',
    });
  } catch (error) {
    console.error('Error updating analytics event:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// For Lexical RemoteConfigNode
app.post('/api/getRCValueBySegmentID', async (req, res) => {
  try {
      const { gameID, branchName, paramID, segmentID } = req.body;

      if (!gameID || !branchName || !paramID || !segmentID) {
          return res.status(200).json({ success: false, message: 'Missing required parameters' });
      }

      const remoteConfig = await RemoteConfig.findOne({ gameID, 'branches.branch': branchName });

      if (!remoteConfig) {
          return res.status(200).json({ success: false, message: 'RemoteConfig not found' });
      }

      const branch = remoteConfig.branches.find(branch => branch.branch === branchName);
      const param = branch.params.find(param => param.paramID === paramID);

      if (!param) {
          return res.status(200).json({ success: false, message: 'Param not found' });
      }

      const value = param.values.find(value => value.segmentID === segmentID);

      if (!value) {
          return res.status(200).json({ success: false, message: 'Value not found' });
      }


      // If the value is file, show file name instead
      if (value.valueFileName !== '' && value.valueFileName !== undefined && value.valueFileName !== null) {
        res.status(200).json({ success: true, value: value.valueFileName });
      } else {
        res.status(200).json({ success: true, value: value.value });
      }

  } catch (error) {
      console.error('Error in /api/getValueBySegmentID:', error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

app.post('/api/getAllSegments', async (req, res) => {
  try {
    const { gameID, branchName } = req.body;

    // Проверка наличия gameID и branchName в запросе
    if (!gameID || !branchName) {
      return res.status(400).json({ message: 'Missing gameID or branchName in the request' });
    }

    // Поиск сегментов по gameID и branchName
    let segments = await Segments.findOne({ gameID, 'branches.branch': branchName });
    // Если не найдены, создаем новый документ
    if (!segments) {
      segments = new Segments({
        gameID,
        branches: [{ branch: branchName, segments: [] }],
      });

      // Добавление сегмента "Everyone" при создании
      const branch = segments.branches.find(b => b.branch === branchName);
      if (branch) {
        branch.segments.push({ segmentID: 'everyone', segmentName: 'Everyone', segmentComment: '' });
      }

      await segments.save();
    }

    // Возвращаем массив сегментов
    const branch = segments.branches.find(b => b.branch === branchName);
    const segmentArray = branch ? branch.segments : [];

    // Возвращаем массив сегментов
    res.status(200).json({ success: true, segments: segmentArray });

  } catch (error) {
    console.error('Error getting all segments:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Only outputs IDs and Names. Needed to get segment names by their IDs in various places on website (Remote Config, Player Warehouse)
app.post('/api/getSegmentsByIdArray', async (req, res) => {
  try {
    const { gameID, branchName, segmentIDs } = req.body;

    if (!gameID || !branchName || !segmentIDs) {
      return res.status(400).json({ message: 'Missing required parameters' });
    }

    // Преобразование строки с segmentIDs в массив
    const segmentIDsArray = Array.isArray(segmentIDs) ? segmentIDs : [segmentIDs];

    // Поиск сегментов по gameID, branchName и segmentIDs
    const segments = await Segments.findOne({
      gameID,
      'branches.branch': branchName,
      'branches.segments.segmentID': { $in: segmentIDsArray },
    });

    if (!segments) {
      return res.status(404).json({ message: 'Segments not found' });
    }

    const filteredSegments = segments.branches
      .find(branch => branch.branch === branchName)
      .segments.filter(segment => segmentIDsArray.includes(segment.segmentID))

      // Extracting only segmentID and segmentName from an array
      .map(({ segmentID, segmentName }) => ({ segmentID, segmentName }));


    res.status(200).json({ success: true, segments: filteredSegments });
  } catch (error) {
    console.error('Error fetching segments by IDs:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});
app.post('/api/createNewSegment', async (req, res) => {
  try {
    const { gameID, branchName } = req.body;

    // Проверка наличия gameID и branchName в запросе
    if (!gameID || !branchName) {
      return res.status(400).json({ message: 'Missing gameID or branchName in the request' });
    }

    // Генерация уникального идентификатора для нового сегмента
    const segmentID = new mongoose.Types.ObjectId().toString();

    // Создание нового сегмента с пустыми полями
    const newSegment = {
      segmentID,
      segmentName: 'New segment',
      segmentConditions: [],
    };

    // Поиск или создание документа Segments
    let segments = await Segments.findOne({ gameID, 'branches.branch': branchName });

    if (!segments) {
      segments = new Segments({
        gameID,
        branches: [{ branch: branchName, segments: [] }],
      });
    }

    // Добавление нового сегмента в указанный документ
    const branch = segments.branches.find(b => b.branch === branchName);
    if (branch) {
      branch.segments.push(newSegment);
    } else {
      segments.branches.push({ branch: branchName, segments: [newSegment] });
    }

    // Сохранение изменений
    await segments.save();

    // Возвращаем актуальный список сегментов
    const updatedBranch = segments.branches.find(b => b.branch === branchName);
    const updatedSegments = updatedBranch ? updatedBranch.segments : [];

    res.status(200).json({ success: true, segments: updatedSegments });

    // Обновляем Remote Config в соответствии с новым созданным сегментом
    refreshRemoteConfigSegments(gameID, branchName)

  } catch (error) {
    console.error('Error creating new segment:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});
async function refreshRemoteConfigSegments(gameID, branchName) {
  try {
    // Шаг 1: Получить все параметры из массива params в модели RemoteConfig
    const remoteConfig = await RemoteConfig.findOne({ gameID, 'branches.branch': branchName });

    if (!remoteConfig) {
      return;
    }

    const params = remoteConfig.branches[0].params;

    if (params.length === 0) return

    // Шаг 2: Получить массив строк segmentID в модели Segments
    const segments = await Segments.findOne({ gameID, 'branches.branch': branchName });

    if (!segments) {
      return;
    }

    // Получаем массив строк с segmentID
    const segmentIDs = segments.branches.find(b => b.branch === branchName).segments.map(segment => segment.segmentID).filter(id => id !== 'everyone');

    // Шаги 3-7: Обновить значения в каждом параметре
    for (const param of params) {
      const everyoneIndex = param.values.findIndex(value => value.segmentID === 'everyone');
      const everyoneValue = everyoneIndex !== -1 ? param.values[everyoneIndex] : { segmentID: 'everyone' };
      const everyoneSegment = {
        segmentID: everyoneValue.segmentID,
        value: everyoneValue.value,
        isTesting: everyoneValue.isTesting,
        testID: everyoneValue.testID,
        isEventOverridden: everyoneValue.isEventOverridden,
        eventID: everyoneValue.eventID
      };

      // Шаг 5: Пройти по массиву values и вставить новые обьекты value в конец массива
      segmentIDs.forEach((segmentID) => {
        const existingValue = param.values.find(value => value.segmentID === segmentID);
        console.log('iterating segment:', segmentID)
        if (!existingValue) {
          console.log('Segment not found. Adding', segmentID)
          param.values.push({ segmentID, value: '', isTesting: false, testID: '', isEventOverriden: false, eventID: '' });
        }
      });

      // Шаг 6: Удалить обьекты из values, если в них есть segmentID, которого нет в изначальном массиве строк
      param.values = param.values.filter(value => segmentIDs.includes(value.segmentID));

      // Шаг 7: Вставить в конец массива сохранённый обьект everyone
      param.values.push(everyoneSegment);
    }

    // Шаг 8: Сохранить модель RemoteConfig
    await remoteConfig.save();

    // console.log('RemoteConfig values updated successfully', params[0].values);
  } catch (error) {
    console.error('Error updating RemoteConfig values:', error);
    throw error;
  }
}
async function refreshSingleRemoteConfigSegments(gameID, branchName, paramID) {
  try {
    // Шаг 1: Получить все параметры из массива params в модели RemoteConfig
    const remoteConfig = await RemoteConfig.findOne({ gameID, 'branches.branch': branchName });

    if (!remoteConfig) {
      return;
    }

    const params = remoteConfig.branches[0].params;

    // Найти параметр по paramID
    const param = params.find(p => p.paramID === paramID);

    if (!param) {
      // console.log(`Param with paramID ${paramID} not found.`);
      return;
    }

    // Шаг 2: Получить массив строк segmentID в модели Segments
    const segments = await Segments.findOne({ gameID, 'branches.branch': branchName });

    if (!segments) {
      return;
    }

    // Получаем массив строк с segmentID
    const segmentIDs = segments.branches.find(b => b.branch === branchName).segments.map(segment => segment.segmentID).filter(id => id !== 'everyone');

    // Шаги 3-7: Обновить значения в каждом параметре
    const everyoneIndex = param.values.findIndex(value => value.segmentID === 'everyone');
    const everyoneValue = everyoneIndex !== -1 ? param.values[everyoneIndex] : { segmentID: 'everyone' };
    const everyoneSegment = {
      segmentID: everyoneValue.segmentID,
      value: everyoneValue.value,
      isTesting: everyoneValue.isTesting,
      testID: everyoneValue.testID,
      isEventOverridden: everyoneValue.isEventOverridden,
      eventID: everyoneValue.eventID
    };

    // Шаг 5: Пройти по массиву values и вставить новые обьекты value в конец массива
    segmentIDs.forEach((segmentID) => {
      const existingValue = param.values.find(value => value.segmentID === segmentID);
      if (!existingValue) {
        // console.log('Segment not found. Adding', segmentID)
        param.values.push({ segmentID, value: everyoneSegment.value, isTesting: false, testID: '', isEventOverriden: false, eventID: '' });
      }
    });

    // Шаг 6: Удалить обьекты из values, если в них есть segmentID, которого нет в изначальном массиве строк
    param.values = param.values.filter(value => segmentIDs.includes(value.segmentID));

    // Шаг 7: Вставить в конец массива сохранённый обьект everyone
    param.values.push(everyoneSegment);

    // Шаг 8: Сохранить модель RemoteConfig
    await remoteConfig.save();

    console.log('RemoteConfig values updated successfully', param);

    return param;

  } catch (error) {
    console.error('Error updating RemoteConfig values:', error);
    throw error;
  }
}
app.post('/api/setSegmentName', async (req, res) => {
  try {
    let { gameID, branchName, segmentID, newName } = req.body;

    if (!newName) {
      newName = ''
    }
    // Проверка наличия gameID, branchName, segmentID и newName в запросе
    if (!gameID || !branchName || !segmentID) {
      return res.status(400).json({ message: 'Missing gameID, branchName, segmentID, or newName in the request' });
    }

    // Поиск сегментов по gameID и branchName
    let segments = await Segments.findOne({ gameID, 'branches.branch': branchName });

    // Если не найдены, возвращаем ошибку
    if (!segments) {
      return res.status(404).json({ message: 'Segments not found for the specified gameID and branchName' });
    }

    // Поиск сегмента по segmentID
    const branch = segments.branches.find(b => b.branch === branchName);
    const segment = branch ? branch.segments.find(s => s.segmentID === segmentID) : null;

    // Если сегмент не найден, возвращаем ошибку
    if (!segment) {
      return res.status(404).json({ message: 'Segment not found for the specified segmentID' });
    }

    // Изменение segmentName
    segment.segmentName = newName;

    // Сохранение изменений в базе данных
    await segments.save();

    // Возвращаем успешный ответ
    res.status(200).json({ success: true, message: 'SegmentName updated successfully' });

  } catch (error) {
    console.error('Error updating segmentName:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});
app.post('/api/setSegmentComment', async (req, res) => {
  try {
    let { gameID, branchName, segmentID, newComment } = req.body;

    if (!newComment) {
      newComment = ''
    }
    // Проверка наличия gameID, branchName, segmentID и newComment в запросе
    if (!gameID || !branchName || !segmentID) {
      return res.status(400).json({ message: 'Missing gameID, branchName, segmentID, or newComment in the request' });
    }

    // Поиск сегментов по gameID и branchName
    let segments = await Segments.findOne({ gameID, 'branches.branch': branchName });

    // Если не найдены, возвращаем ошибку
    if (!segments) {
      return res.status(404).json({ message: 'Segments not found for the specified gameID and branchName' });
    }

    // Поиск сегмента по segmentID
    const branch = segments.branches.find(b => b.branch === branchName);
    const segment = branch ? branch.segments.find(s => s.segmentID === segmentID) : null;

    // Если сегмент не найден, возвращаем ошибку
    if (!segment) {
      return res.status(404).json({ message: 'Segment not found for the specified segmentID' });
    }

    // Изменение segmentComment
    segment.segmentComment = newComment;

    // Сохранение изменений в базе данных
    await segments.save();

    // Возвращаем успешный ответ
    res.status(200).json({ success: true, message: 'SegmentComment updated successfully' });

  } catch (error) {
    console.error('Error updating segmentComment:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});
app.post('/api/countPlayersInWarehouse', async (req, res) => {
  try {
    const { gameID, branchName } = req.body;

    // Проверка наличия gameID и branchName в запросе
    if (!gameID || !branchName) {
      return res.status(400).json({ message: 'Missing gameID or branchName in the request' });
    }

    // Поиск игроков по gameID и branchName
    const players = await PWplayers.find(
      { gameID, branch: branchName },
    );

    // Если не найдены, возвращаем ошибку
    if (!players) {
      return res.status(404).json({ message: 'PlayerWarehouse not found for the specified gameID and branchName' });
    }

    // Возвращаем успешный ответ с количеством игроков
    res.status(200).json({ success: true, playerCount: players.length });

  } catch (error) {
    console.error('Error counting players in warehouse:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});
app.post('/api/getTemplatesForSegments', async (req, res) => {
  try {
    const { gameID, branchName } = req.body;

    // Проверка наличия gameID и branchName в запросе
    if (!gameID || !branchName) {
      return res.status(200).json({ success: false, message: 'Missing gameID or branchName in the request' });
    }

    // Поиск сегментов по gameID и branchName
    const playerWarehouse = await PWtemplates.findOne({ gameID, 'branches.branch': branchName });

    // Если не найдены, возвращаем ошибку
    if (!playerWarehouse) {
      return res.status(200).json({ success: false, message: 'PlayerWarehouse not found for the specified gameID and branchName' });
    }

    // Поиск ветки по branchName
    const branch = playerWarehouse.branches.find(b => b.branch === branchName);

    // Если не найдена ветка, возвращаем ошибку
    if (!branch) {
      return res.status(200).json({ success: false, message: 'Branch not found for the specified branchName' });
    }

    if (branch.templates.analytics.length === 0 && branch.templates.statistics.length === 0) {
      return res.status(200).json({ success: false, message: 'No templates found' });
    }
    // Возвращаем объект templates в branchSchema
    res.status(200).json({ success: true, templates: branch.templates });

  } catch (error) {
    console.error('Error getting templates for segments:', error);
    res.status(200).json({ success: false, message: 'Internal Server Error' });
  }
});
app.post('/api/setSegmentConditions', async (req, res) => {
  try {
      const { gameID, branchName, segmentID, segmentConditions } = req.body;

      // Проверка наличия необходимых параметров в запросе
      if (!gameID || !branchName || !segmentID || !segmentConditions) {
          return res.status(400).json({ message: 'Missing required parameters in the request' });
      }

      // Поиск сегмента по gameID, branchName и segmentID
      const segment = await Segments.findOne({
          'gameID': gameID,
          'branches.branch': branchName,
          'branches.segments.segmentID': segmentID,
      });

      // Проверка наличия сегмента
      if (!segment) {
          return res.status(404).json({ message: 'Segment not found' });
      }

      const updatedBranches = segment.branches.map(branch => {
          if (branch.branch === branchName) {
              const updatedSegments = branch.segments.map(segment => {
                  if (segment.segmentID === segmentID) {
                      segment.segmentConditions = JSON.stringify(segmentConditions);
                  }
                  return segment;
              });

              branch.segments = updatedSegments;
          }
          return branch;
      });

      await Segments.updateOne(
          { 'gameID': gameID, 'branches.branch': branchName },
          { $set: { 'branches': updatedBranches } }
      );

      res.status(200).json({ success: true, message: 'Segment conditions updated successfully' });
  } catch (error) {
      console.error('Error updating segment conditions:', error);
      res.status(500).json({ message: 'Internal Server Error' });
  }
});
app.post('/api/refreshSegmentPlayerCount', async (req, res) => {
  try {
    const { gameID, branchName, segmentID } = req.body;

    const playerCount = await refreshSegmentPlayerCount(gameID, branchName, segmentID)

    res.status(200).json({ success: true, playerCount: playerCount.length });

  } catch (error) {
    console.error('Error refreshing segmentPlayerCount:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});




async function refreshSegmentPlayerCount(gameID, branchName, segmentID) {
  try {

    // Находим всех игроков, у которых в массиве segments есть указанный segmentID
    const playersWithSegment = await PWplayers.find(
      { gameID, branch: branchName, segments: {$in: [segmentID]} },
    );
    

    // Обновляем segmentPlayerCount в модели Segments
    const result = await Segments.updateOne(
      {
        'gameID': gameID,
        'branches.branch': branchName,
        'branches.segments.segmentID': segmentID,
      },
      {
        $set: {
          'branches.$[i].segments.$[j].segmentPlayerCount': playersWithSegment.length,
        },
      },
      {
        arrayFilters: [
          { 'i.branch': branchName },
          { 'j.segmentID': segmentID },
        ],
      }
    );
    return playersWithSegment;
  } catch (error) {
    console.error('Error refreshing segmentPlayerCount:', error);
    return false;
  }
}

// Recalculate given segmentID for all recent players. This means all recent players will get or lose
// this given segment
async function recalculateSegment(gameID, branchName, segmentID) {
  try {
    const branch = await Segments.findOne(
      { gameID, 'branches.branch': branchName },
      { 'branches.$': 1 }
    );

    if (!branch) {
      return {status: 200, json: { success: false, message: 'Branch not found' }};
    }

    // Извлекаем сегмент из ветки
    const segment = branch.branches.find(b => b.branch === branchName).segments.find((seg) => seg.segmentID === segmentID);

    if (!segment) {
      return {status: 200, json: { success: false, message: 'Segment not found' }};
    }


    try {

      // Get all clientIDs for the last month
      const response = await druidLib.getRecentClientIDs(gameID, branchName)
      const clientIDs = response;

      const players = await PWplayers.find(
        { gameID, branch: branchName, clientID: { $in: clientIDs.map(String) } },
      );

      // Recalculating target segment for each clientID
      const promises = players.map(async (player) => {
        if (player) {
          const check = segmentsLib.calculatePlayerSegment(player, segment);

          if (check) {
            await segmentsLib.addSegmentToPlayer(gameID, branchName, player.clientID, segment.segmentID);
          } else {
            await segmentsLib.removeSegmentFromPlayer(gameID, branchName, player.clientID, segment.segmentID);
          }
        }
      });

      // Дожидаемся завершения всех асинхронных операций
      await Promise.all(promises);
    } catch (error) {
      return {status: 500, json: { success: false, message: 'Something went wrong recalculating segments. Or would I say Internal Sever Error' }}
    }


    const playerCount = await refreshSegmentPlayerCount(gameID, branchName, segmentID)

    return {status: 200, json: { success: true, message: 'Recalculation complete', playerCount: playerCount.length }}
    // res.status(200).json({ success: true, message: 'Recalculation complete', playerCount: playerCount.length });
  } catch (error) {
    console.error('Error in recalculateSegmentSize:', error.message);
    return {status: 200, json: { success: false, message: 'Internal server error' }};
    // res.status(200).json({ success: false, message: 'Internal server error' });
  }
}

app.post('/api/recalculateSegmentSize', async (req, res) => {
  const { gameID, branchName, segmentID } = req.body;
  try {

    const response = await recalculateSegment(gameID, branchName, segmentID)
    res.status(response.status).json(response.json)
  } catch (error) {
    console.error('Error at recalculateSegmentSize:', error)
    res.status(500).json({success: false, json: 'Internal server error'})
  }
});

app.post('/api/removeSegmentByID', async (req, res) => {
  const {gameID, branchName, segmentID} = req.body
  try {
    const query = {
      gameID: gameID,
      'branches.branch': branchName,
      'branches.segments.segmentID': segmentID
    };

    const update = {
      $pull: {
        'branches.$.segments': { segmentID: segmentID }
      }
    };

    const result = await Segments.updateOne(query, update);
    if (result.modifiedCount > 0) {
      res.status(200).json({success: true, message: 'Segment removed successfully'})
    } else {
      res.status(200).json({success: false, message: 'Segment not found'})
    }
  } catch (error) {
    res.status(200).json({success: false, message: 'Internal server error'})
  }
})

// Player warehouse
app.post('/api/addStatisticsTemplate', async (req, res) => {
  const { gameID, branchName, templateObject } = req.body;

  try {
    // Найти документ PlayerWarehouse по gameID
    let playerWarehouse = await PWtemplates.findOne({ gameID });
    // Проверить, существует ли уже branch с указанным branchName
    const existingBranchIndex = playerWarehouse.branches.findIndex((b) => b.branch === branchName);

    // Извлечь нужный branch
    const branchIndex = playerWarehouse.branches.findIndex((b) => b.branch === branchName);

    if (branchIndex === -1) {
      // Если не существует, создать новый branch
      playerWarehouse.branches.push({ branch: branchName, templates: { statistics: [] } });
    }

    // Извлечь нужный branch после добавления, чтобы получить его по индексу
    const branch = playerWarehouse.branches[branchIndex];

    // Генерировать новый templateID
    const newTemplateID = new mongoose.Types.ObjectId();
    // Добавить новый шаблон в массив templates
    const newTemplate = { ...templateObject, templateID: newTemplateID };

    if (!branch.templates) {
      branch.templates = { statistics: [newTemplate] };
    } else if (!branch.templates.statistics) {
      branch.templates.statistics = [newTemplate];
    } else {
      branch.templates.statistics.push(newTemplate);
    }
    // Сохранить изменения в базе данных
    await playerWarehouse.save();

    res.status(200).json({ success: true, message: 'Statistics template added successfully', newTemplate });
  } catch (error) {
    console.error('Error adding statistics template:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});
app.post('/api/updateStatisticsTemplate', async (req, res) => {
  const { gameID, branchName, templateID, templateObject } = req.body;

  try {

    await PWtemplates.findOneAndUpdate(
      { 
        "gameID": gameID,
        "branches.branch": branchName,
        "branches.templates.statistics.templateID": templateID
      },
      {
        $set: {
          "branches.$[branch].templates.statistics.$[template].templateName": templateObject.templateName,
          "branches.$[branch].templates.statistics.$[template].templateCodeName": templateObject.templateCodeName,
          "branches.$[branch].templates.statistics.$[template].templateDefaultValue": templateObject.templateDefaultValue,
          "branches.$[branch].templates.statistics.$[template].templateValueRangeMin": templateObject.templateValueRangeMin,
          "branches.$[branch].templates.statistics.$[template].templateValueRangeMax": templateObject.templateValueRangeMax,
        },
      },
      {
        arrayFilters: [
          { "branch.templates.statistics.templateID": templateID },
          { "template.templateID": templateID },
        ],
        new: true,
      }
    );

    res.status(200).json({ success: true, message: 'Statistics template edited successfully' });

  } catch (error) {
    console.error('Error editing statistics template:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});
    
app.post('/api/getWarehouseTemplates', async (req, res) => {
  const { gameID, branchName } = req.body;

  try {
    // Найти документ PlayerWarehouse по gameID и branchName
    let playerWarehouse = await PWtemplates.findOne({
      gameID,
      'branches.branch': branchName,
    });

    // Извлечь нужный branch
    const branch = playerWarehouse.branches.find((b) => b.branch === branchName);

    // Вернуть объект templates из найденного branch
    let templates = branch ? branch.templates : {};

    const assignNamesToAnalyticsEvents = async() => {

      // Добавить поля templateVisualEventName и templateVisualValueName
      if (templates.analytics && templates.analytics.length > 0) {
        let updatedTemplates = await Promise.all(templates.analytics.map(async (template) => {
          const gameDoc = await AnalyticsEvents.findOne({
            'gameID': gameID,
            'branches.branch': branchName,
            'branches.events.eventID': template.templateAnalyticEventID
          }).lean();

          if (gameDoc) {
            const targetEvent = gameDoc.branches.find(b => b.branch === branchName)?.events.find(e => e.eventID === template.templateAnalyticEventID);
            const targetEventValue = targetEvent.values.find(value => value._id.toString() === template.templateEventTargetValueId);

            // Преобразуем объект mongoose в JSON
            const templateJSON = template.toJSON();

            // Создаем новый объект с обновленными полями
            const updatedTemplate = {
              ...templateJSON,
              templateVisualEventName: targetEvent?.eventName || 'Event not found',
              templateVisualValueName: targetEventValue?.valueName || 'Value not found',
            };

            return updatedTemplate;
          } else {
            // Если документ не найден, возвращаем исходный template
            return template;
          }
        }));

        templates = {
          _id: templates._id,
          analytics: updatedTemplates,
          statistics: templates.statistics
        };
      }
    }
    const assignNames = await assignNamesToAnalyticsEvents()

    res.status(200).json({ success: true, message: 'Warehouse templates retrieved successfully', templates });
  } catch (error) {
    console.error('Error getting warehouse templates:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


app.post('/api/getWarehousePlayers', async (req, res) => {
  const { gameID, branchName } = req.body;

  try {
    // Найти документ PlayerWarehouse по gameID и branchName
    const playerWarehouse = await PWplayers.find(
      { gameID, branch: branchName },
      { elements: 0, inventory: 0, goods: 0, abtests: 0, segments: 0, branch: 0, _id: 0, gameID: 0 },
    );


    if (!playerWarehouse) {
      return res.status(404).json({ message: 'PlayerWarehouse not found' });
    }

    // Извлечь массив clientID из players
    const playerIDs = playerWarehouse.map((player) => player.clientID);

    res.status(200).json({ success: true, playerIDs });
  } catch (error) {
    console.error('Error getting warehouse players:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


app.post('/api/getWarehousePlayerData', async (req, res) => {
  const { gameID, branchName, clientID } = req.body;

  try {
    // Найти документ PlayerWarehouse по gameID и branchName
    const playerWarehouse = await PWplayers.findOne(
      { gameID, branch: branchName, clientID },
    );


    if (!playerWarehouse) {
      return res.status(404).json({ message: 'PlayerWarehouse not found' });
    }

    res.status(200).json({ success: true, player: playerWarehouse });
  } catch (error) {
    console.error('Error getting warehouse player data:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// По аналогии с getAllAnalyticsEvents собирает перечень параметров у каждой ноды с сортировкой по категориям.
// Подробности см. в запросе getAllAnalyticsEvents
app.post('/api/getCategorizedRemoteConfigParams', async (req, res) => {
  try {
    const { gameID, branchName } = req.body;

    const node = await NodeModel.findOne({
      'branches.branch': branchName,
      'gameID': gameID,
    });

    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    const result = [];

    for (const branch of node.branches) {
      if (branch.branch === branchName) {
        for (const planningType of branch.planningTypes) {
          for (const node of planningType.nodes) {
            const nodeInfo = {
              categoryName: planningType.type,
              nodes: [{
                nodeName: node.name,
                params: await Promise.all(node.remoteConfigParams.map(async paramID => {
                  const param = await RemoteConfig.findOne({ 'branches.branch': branchName, 'gameID': gameID, 'branches.params.paramID': paramID });

                  return {
                    paramID: paramID,
                    paramName: param
                      ? param.branches.find(b => b.branch === branchName)?.params.find(e => e.paramID === paramID)?.paramName || 'Parameter not found'
                      : 'Parameter not found',
                  };
                })),
              }],
            };

            const existingCategory = result.find(category => category.categoryName === nodeInfo.categoryName);

            if (existingCategory) {
              const existingNode = existingCategory.nodes.find(existingNode => existingNode.nodeName === nodeInfo.nodes[0].nodeName);

              if (existingNode) {
                existingNode.params.push(...nodeInfo.nodes[0].params);
              } else {
                existingCategory.nodes.push(nodeInfo.nodes[0]);
              }
            } else {
              result.push(nodeInfo);
            }
          }
        }
      }
    }

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Собирает все ивенты из ветки. Нужно в вейрхаусе при создании шаблона.
// Собирает в формате указанном ниже. Берём это во внимание
// [
//   {
//     "categoryName": "entity",
//     "nodes": [
//       {
//         "nodeName": "test",
//         "events": [
//           {
//             "eventID": "656298e51c04ab53a39d2797",
//             "eventName": "New Event"
//           },
//           {
//             "eventID": "6582c332ae9b2969c9cd95fc",
//             "eventName": "New Event"
//           },
//           {
//             "eventID": "6583efc1eee10f1eb6a223ea",
//             "eventName": "New Event"
//           }
//         ]
//       }
//     ]
//   },
//   {
//     "categoryName": "gameplay",
//     "nodes": [
//       {
//         "nodeName": "test",
//         "events": []
//       },
//       {
//         "nodeName": "somemechanic",
//         "events": []
//       },
//       {
//         "nodeName": "adad",
//         "events": []
//       }
//     ]
//   }
// ]
//
app.post('/api/getAllAnalyticsEvents', async (req, res) => {
  try {
    const { gameID, branchName, shouldReturnValues } = req.body;

    const node = await NodeModel.findOne({
      'branches.branch': branchName,
      'gameID': gameID,
    });

    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    const result = [];

    for (const branch of node.branches) {
      if (branch.branch === branchName) {
        for (const planningType of branch.planningTypes) {
          for (const node of planningType.nodes) {
            const nodeInfo = {
              categoryName: planningType.type,
              nodes: [{
                nodeName: node.name,
                nodeID: node.nodeID,
                events: await Promise.all(node.analyticsEvents.map(async eventID => {
                  const event = await AnalyticsEvents.findOne({ 'branches.branch': branchName, 'gameID': gameID, 'branches.events.eventID': eventID });

                  return {
                    eventID: eventID,
                    eventName: event
                      ? event.branches.find(b => b.branch === branchName)?.events.find(e => e.eventID === eventID)?.eventName || 'Event not found'
                      : 'Event not found',
                    eventCodeName: event
                      ? event.branches.find(b => b.branch === branchName)?.events.find(e => e.eventID === eventID)?.eventCodeName || 'Event ID not found'
                      : 'Event ID not found',
                    values: shouldReturnValues
                      ? event.branches.find(b => b.branch === branchName)?.events.find(e => e.eventID === eventID)?.values || 'Event values not found'
                      : 'Event values not found',
                  };
                })),
              }],
            };

            const existingCategory = result.find(category => category.categoryName === nodeInfo.categoryName);

            if (existingCategory) {
              const existingNode = existingCategory.nodes.find(existingNode => existingNode.nodeName === nodeInfo.nodes[0].nodeName);

              if (existingNode) {
                existingNode.events.push(...nodeInfo.nodes[0].events);
              } else {
                existingCategory.nodes.push(nodeInfo.nodes[0]);
              }
            } else {
              result.push(nodeInfo);
            }
          }
        }
      }
    }

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.post('/api/v2/getAllAnalyticsEvents', async (req, res) => {
  try {
    const { gameID, branchName, getRemoved } = req.body;

    if (!gameID || !branchName) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    let events = await AnalyticsEvents.findOne(
      {
        'gameID': gameID,
        'branches.branch': branchName,
      },
      {
        'branches.$': 1,
      }
    );
    events = events?.branches[0].events;
    if (events && events.length > 0 && !getRemoved) {
      events = events.filter(event => !event.removed)
    }

    res.status(200).json({success: true, message: 'Analytics events retrieved successfully', events: events });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.post('/api/getAnalyticsEvent', async (req, res) => {
  try {
    const { gameID, branchName, eventID } = req.body;

    // Проверка наличия обязательных параметров
    if (!gameID || !branchName || !eventID) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Поиск нужного ивента в базе данных
    const event = await AnalyticsEvents.findOne(
      {
        'gameID': gameID,
        'branches': {
          $elemMatch: {
            'branch': branchName,
            'events.eventID': eventID,
          },
        },
      },
      {
        'branches.$': 1, // Проекция на получение только первого совпадения в массиве branches
      }
    );

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Находим соответствующий ивент в указанной ветке
    const branch = event.branches.find(b => b.branch === branchName);
    if (!branch || !branch.events || branch.events.length === 0) {
      return res.status(404).json({ error: 'Event not found in the specified branch' });
    }

    // Находим ивент с указанным eventID
    const selectedEvent = branch.events.find(e => e.eventID === eventID);
    if (!selectedEvent) {
      return res.status(404).json({ error: 'Event with specified eventID not found in the specified branch' });
    }

    // Возвращение найденного ивента
    res.json(selectedEvent);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.post('/api/getAnalyticsEvents', async (req, res) => {
  try {
    const { gameID, branchName, eventIDs } = req.body;

    // Проверка наличия обязательных параметров
    if (!gameID || !branchName || !eventIDs || eventIDs.length === 0) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Поиск нужных ивентов в базе данных
    const events = await AnalyticsEvents.findOne(
      {
        'gameID': gameID,
        'branches': {
          $elemMatch: {
            'branch': branchName,
            'events.eventID': { $in: eventIDs },
          },
        },
      },
      {
        'branches.$': 1, // Проекция на получение только первого совпадения в массиве branches
      }
    );

    if (!events) {
      return res.status(404).json({ error: 'Events not found' });
    }

    // Находим соответствующие ивенты в указанной ветке
    const branch = events.branches.find(b => b.branch === branchName);
    if (!branch || !branch.events || branch.events.length === 0) {
      return res.status(404).json({ error: 'Events not found in the specified branch' });
    }

    // Находим ивенты с указанными eventIDs
    const selectedEvents = branch.events.filter(e => eventIDs.includes(e.eventID));
    if (selectedEvents.length === 0) {
      return res.status(404).json({ error: 'No events found with specified eventIDs in the specified branch' });
    }

    // Возвращение найденных ивентов
    res.json(selectedEvents);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.post('/api/addAnalyticsTemplate', async (req, res) => {
  const { gameID, branchName, templateObject } = req.body;

  try {
    // Генерация уникального ObjectID для templateID
    const templateID = new mongoose.Types.ObjectId();

    // Добавление сгенерированного templateID в объект шаблона
    templateObject.templateID = templateID;

    // Находим или создаем объект playerWarehouse
    let playerWarehouse = await PWtemplates.findOne({ gameID });

    if (!playerWarehouse) {
      playerWarehouse = new PlayerWarehouse({
        gameID,
        branches: [{ branch: branchName, templates: { analytics: [], statistics: [] }, players: [] }],
      });
    }

    // Находим или создаем объект branch
    const branch = playerWarehouse.branches.find(b => b.branch === branchName);

    // Добавляем шаблон в analytics
    branch.templates.analytics.push(templateObject);

    // Сохраняем изменения
    await playerWarehouse.save();

    res.status(200).json({ success: true, message: 'Analytics template added successfully', newTemplate: templateObject});

    // Выставляем всем игрокам значения на основе существующих данных
    calculateInitialElementValue(gameID, branchName, templateObject)

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});
// После создания шаблона необходимо посчитать его стартовое значение у всех игроков
async function calculateInitialElementValue(gameID, branchName, template) {

  const eventIDtoFind = template.templateAnalyticEventID
  const valueIDtoFind = template.templateEventTargetValueId

  try {
    // Поиск нужного ивента в базе данных
    const event = await AnalyticsEvents.findOne(
      {
        'gameID': gameID,
        'branches': {
          $elemMatch: {
            'branch': branchName,
            'events.eventID': eventIDtoFind,
          },
        },
      },
      {
        'branches.$': 1, // Проекция на получение только первого совпадения в массиве branches
      }
    );

    if (!event) {
      throw new Error(`Event with ID ${eventIDtoFind} not found.`);
    }

    // Get event from object
    const foundEvent = event.branches.reduce((result, branch) => {
      const eventInBranch = branch.events.find((e) => e.eventID === eventIDtoFind);
      return eventInBranch ? eventInBranch : result;
    }, null);

    if (!foundEvent) {
      throw new Error(`Event with ID ${eventIDtoFind} not found.`);
    }

    // Find value index, so we know which column in Druid to seek for (value1, value2, value3)
    const valueIndex = foundEvent.values.findIndex((value) => value._id.toString() === valueIDtoFind);

    if (valueIndex !== 0 || valueIndex !== undefined) {

      try {

        // Getting all "recent" clientIDs from Druid
        const response = await druidLib.getRecentClientIDs(gameID, branchName)
        const clientIDs = response;

        // If there are no players, just return.
        if (!clientIDs || clientIDs.length === 0) return;

        let players = await PWplayers.find(
          { gameID, branch: branchName, clientID: { $in: clientIDs.map(String) } },
        );

        // Iterate each found client
        const promises = players.map(async (player) => {
          if (player) {

            // So we can find corresponding fields in Druid and get value from them. Can be "value1", "value2" and "value3"
            let targetValueColumn = `value${valueIndex+1}`;

            // Needed for some calculations
            let isFloat

            // String, int, float, money etc
            let eventValueFormat = foundEvent.values[valueIndex].valueFormat


            // Give initial elementValue
            switch (template.templateMethod) {
            case 'mostRecent':
              const mostRecentValue = await druidLib.getMostRecentValue(gameID, branchName, player.clientID, 'designEvent', foundEvent.eventCodeName, targetValueColumn)
              playerWarehouseLib.setElementValue(gameID, branchName, player.clientID, template.templateID, mostRecentValue)
              break;

            case 'firstReceived':
              const firstReceived = await druidLib.getFirstEventValue(gameID, branchName, player.clientID, 'designEvent', foundEvent.eventCodeName, targetValueColumn)
              playerWarehouseLib.setElementValueFirstTimeOnly(gameID, branchName, player.clientID, template.templateID, firstReceived)
              break;

            case 'mostCommon':
              const mostCommonValues = await druidLib.getMostCommonValue(gameID, branchName, player.clientID, 'designEvent', foundEvent.eventCodeName, targetValueColumn)
              playerWarehouseLib.setElementValues(gameID, branchName, player.clientID, template.templateID, mostCommonValues)
              break;

            case 'leastCommon':
              const leastCommonValues = await druidLib.getLeastCommonValue(gameID, branchName, player.clientID, 'designEvent', foundEvent.eventCodeName, targetValueColumn)
              playerWarehouseLib.setElementValue(gameID, branchName, player.clientID, template.templateID, leastCommonValues)
              break;

            case 'mean':
              switch (eventValueFormat) {
                case 'string':
                  isFloat = false;
                  break;
                case 'integer':
                  isFloat = false;
                  break;
                case 'float':
                  isFloat = true;
                  break;
                case 'percentile':
                  isFloat = true;
                  break;
                case 'money':
                  isFloat = true;
                  break;
                default:
                  break;
              }
              const meanValue = await druidLib.getMeanValue(gameID, branchName, player.clientID, 'designEvent', foundEvent.eventCodeName, targetValueColumn, isFloat)
              playerWarehouseLib.setElementValue(gameID, branchName, player.clientID, template.templateID, meanValue)
              break;

            case 'meanForTime':
              switch (eventValueFormat) {
                case 'string':
                  isFloat = false;
                  break;
                case 'integer':
                  isFloat = false;
                  break;
                case 'float':
                  isFloat = true;
                  break;
                case 'percentile':
                  isFloat = true;
                  break;
                case 'money':
                  isFloat = true;
                  break;
                default:
                  break;
              }
              const meanForTimeValue = await druidLib.getMeanValueForTime(gameID, branchName, player.clientID, 'designEvent', foundEvent.eventCodeName, targetValueColumn, isFloat, template.templateMethodTime)
              playerWarehouseLib.setElementValue(gameID, branchName, player.clientID, template.templateID, meanForTimeValue)
              break;

            case 'numberOfEvents':
              const numberOfEvents = await druidLib.getEventNumber(gameID, branchName, player.clientID, 'designEvent', foundEvent.eventCodeName, targetValueColumn)
              playerWarehouseLib.setElementValue(gameID, branchName, player.clientID, template.templateID, numberOfEvents)
              break;

            case 'numberOfEventsForTime':
              const numberOfEventsForTime = await druidLib.getNumberOfEventsForTime(gameID, branchName, player.clientID, 'designEvent', foundEvent.eventCodeName, template.templateMethodTime)
              playerWarehouseLib.setElementValue(gameID, branchName, player.clientID, template.templateID, numberOfEventsForTime)
              break;

            case 'summ':
              switch (eventValueFormat) {
              case 'string':
                isFloat = false;
                break;
              case 'integer':
                isFloat = false;
                break;
              case 'float':
                isFloat = true;
                break;
              case 'percentile':
                isFloat = true;
                break;
              case 'money':
                isFloat = true;
                break;
              default:
                break;
              }
              const summ = await druidLib.getSummValue(gameID, branchName, player.clientID, 'designEvent', foundEvent.eventCodeName, targetValueColumn, isFloat)
              playerWarehouseLib.setElementValue(gameID, branchName, player.clientID, template.templateID, summ)
              break;

              // Define which format is which format. This way we can either pick float mean from Druid
              // ...or transform it to integer.
            case 'summForTime':
              switch (eventValueFormat) {
                case 'string':
                  isFloat = false;
                  break;
                case 'integer':
                  isFloat = false;
                  break;
                case 'float':
                  isFloat = true;
                  break;
                case 'percentile':
                  isFloat = true;
                  break;
                case 'money':
                  isFloat = true;
                  break;
                default:
                  break;
              }
              const summForTime = await druidLib.getSummValueForTime(gameID, branchName, player.clientID, 'designEvent', foundEvent.eventCodeName, targetValueColumn, isFloat, template.templateMethodTime)
              playerWarehouseLib.setElementValue(gameID, branchName, player.clientID, template.templateID, summForTime)
              break;

            default:
              console.warn(`Unknown templateMethod: ${template.templateMethod}`);
              break;
            }

          }
        });

        // Wait till everything is complete
        await Promise.all(promises);

      } catch (error) {
        console.error(error)
      }
    }

  } catch (error) {
    console.error(error.message);
    return null;
  }

}


// Удаление темплейта из Player Warehouse. При этом не удаляются элементы у игроков
app.post('/api/removeWarehouseTemplate', async (req, res) => {
  try {
    const { gameID, branchName, templateID } = req.body;

    if (!gameID || !branchName || !templateID) {
      return res.status(400).json({ message: 'Missing required parameters' });
    }

    const result = await PWtemplates.findOneAndUpdate(
      { gameID, 'branches.branch': branchName },
      {
        $pull: {
          'branches.$.templates.analytics': { templateID: templateID },
          'branches.$.templates.statistics': { templateID: templateID },
        },
      },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({ message: 'Template not found or not deleted' });
    }

    removeConditionsFromSegments(gameID, branchName, [templateID])

    res.status(200).json({ success: true, message: 'Template deleted successfully' });



  } catch (error) {
    console.error('Error removing template:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// R&C Relations
app.post('/api/getAllNodes', async (req, res) => {
  const { gameID, branchName } = req.body;

  try {
    // Найти документ NodeModel по gameID
    const nodesDocument = await NodeModel.findOne({ gameID });

    if (!nodesDocument) {
      return res.status(404).json({ message: 'Nodes not found' });
    }

    // Найти ветку с соответствующим именем
    const branch = nodesDocument.branches.find((b) => b.branch === branchName);

    if (!branch) {
      return res.status(404).json({ message: 'Branch not found' });
    }

    // Формируем ответ
    const response = branch.planningTypes.map((planningType) => ({
      type: planningType.type,
      nodes: planningType.nodes,
    }));

    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching nodes:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});
app.post('/api/addNewRelation', async (req, res) => {
  try {
    const { gameID, branchName } = req.body;

    // Генерация нового уникального relationID
    const relationID = new mongoose.Types.ObjectId();

    // Новый объект отношений
    const newRelation = {
      relationID: relationID.toString(), // Преобразуем ObjectId в строку
      name: '',
      nodes: [], // Здесь вы можете определить начальные данные для узлов
      comment: '', // Здесь вы можете определить начальный комментарий
    };

    // Найти соответствующую ветку и добавить новое отношение
    const updatedGame = await Relations.findOneAndUpdate(
      { gameID, 'branches.branch': branchName },
      {
        $push: {
          'branches.$.relations': newRelation,
        },
      },
      { new: true }
    );

    if (!updatedGame) {
      return res.status(404).json({ message: 'Game or branch not found' });
    }

    return res.status(200).json({message: 'Successfully created new relation. New ID:', newID: relationID});
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});
app.post('/api/getAllRelations', async (req, res) => {
  try {
    const { gameID, branchName } = req.body;

    // Найти соответствующую ветку и получить массив relationID
    let relations = await Relations.findOne(
      { gameID, 'branches.branch': branchName },
      { 'branches.$': 1, _id: 0 } // Проекция, чтобы вернуть только нужную ветку
    );

    if (!relations) {
      // Если игра не найдена, создаем документ с gameID
      const newRelations = new Relations({
        gameID,
        branches: [
          { branch: 'development', relations: [], context: [] },
          { branch: 'stage', relations: [], context: [] },
          { branch: 'production', relations: [], context: [] },
        ],
      });
      relations = await newRelations.save();
    }

    if (!relations.branches || relations.branches.length === 0) {
      return res.status(404).json({ message: 'Game or branch not found' });
    }


    const targetBranch = relations.branches.find(b => b.branch === branchName);
    if (!targetBranch || !targetBranch.relations || targetBranch.relations.length === 0) {
      return res.status(404).json({ message: 'Game or branch not found' });
    }


    const relationIDs = targetBranch.relations.map((relation) => relation.relationID);

    return res.status(200).json(relationIDs);

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Used in node editor in R&C section
app.post('/api/getRelationsByNodeIDArray', async (req, res) => {
  try {
    const { gameID, branchName, nodeIDs } = req.body; // Предположим, nodeIDs - это массив идентификаторов узлов

    // Найти соответствующую ветку и получить массив relations
    let relations = await Relations.findOne(
      { gameID, 'branches.branch': branchName },
      { 'branches.$': 1, _id: 0 } // Проекция, чтобы вернуть только нужную ветку
    );

    if (!relations || !relations.branches || relations.branches.length === 0) {
      return res.status(404).json({ message: 'Game or branch not found' });
    }

    const targetBranch = relations.branches.find(b => b.branch === branchName);

    if (!targetBranch || !targetBranch.relations || targetBranch.relations.length === 0) {
      return res.status(404).json({ message: 'Game or branch not found' });
    }

    // Фильтрация relations, содержащих указанные nodeID
    const filteredRelations = targetBranch.relations.filter(relation =>
      relation.nodes.some(node => nodeIDs.includes(node.nodeID))
    );

    const relationIDs = filteredRelations.map(relation => relation.relationID);

    return res.status(200).json(relationIDs);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});



app.post('/api/addNodeToRelation', async (req, res) => {
  try {
    const { gameID, branchName, relationID, nodeID } = req.body;

    // Проверка наличия обязательных параметров
    if (!gameID || !branchName || !relationID || !nodeID) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Находим документ по gameID
    const relationsDoc = await Relations.findOne({ gameID });

    if (!relationsDoc) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Находим нужную ветку по branchName
    const branch = relationsDoc.branches.find((b) => b.branch === branchName);

    if (!branch) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    // Находим нужную связь по relationID
    const relation = branch.relations.find((r) => r.relationID === relationID);

    if (!relation) {
      return res.status(404).json({ error: 'Relation not found' });
    }

    // Проверяем, существует ли нода с данным nodeID в массиве
    const existingNode = relation.nodes.find((n) => n.nodeID === nodeID);

    if (existingNode) {
      return res.json({ alreadyExists: true });
    }

    // Находим соответствующую ноду в NodeModel
    const nodeModelData = await NodeModel.findOne({
      "branches.branch": branchName,
      "branches.planningTypes": {
        $elemMatch: {
          "nodes.nodeID": nodeID
        }
      }
    });

    if (!nodeModelData || !nodeModelData.branches || !nodeModelData.branches.length) {
      return res.status(404).json({ error: 'Node not found in NodeModel' });
    }

    const planningType = nodeModelData.branches
    .find(branch => branch.planningTypes.some(pt => pt.nodes.some(n => n.nodeID === nodeID)))
    .planningTypes.find(pt => pt.nodes.some(n => n.nodeID === nodeID)).type;

    // Добавляем новый узел к связи
    relation.nodes.push({ nodeID, nodeType: planningType ? planningType : '' });

    // Сохраняем изменения в базе данных
    await relationsDoc.save();

    // Отправляем успешный ответ
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.post('/api/getRelation', async (req, res) => {
  try {
    const { gameID, branchName, relationID } = req.body;

    // Проверка наличия обязательных параметров
    if (!gameID || !branchName || !relationID) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Находим документ по gameID
    const relationsDoc = await Relations.findOne({ gameID });

    if (!relationsDoc) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Находим нужную ветку по branchName
    const branch = relationsDoc.branches.find((b) => b.branch === branchName);

    if (!branch) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    // Находим нужную связь по relationID
    const relation = branch.relations.find((r) => r.relationID === relationID);

    if (!relation) {
      return res.status(404).json({ error: 'Relation not found' });
    }

    // Возвращаем полный объект связи
    res.json(relation);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.post('/api/assignRelationNodeNames', async (req, res) => {
  try {
    const { gameID, branchName, nodeIDs } = req.body;

    // Проверка наличия обязательных параметров
    if (!gameID || !branchName || !nodeIDs || !Array.isArray(nodeIDs)) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    // Находим документ по gameID
    const nodesDoc = await NodeModel.findOne({ gameID });

    if (!nodesDoc) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Находим нужную ветку по branchName
    const branch = nodesDoc.branches.find((b) => b.branch === branchName);

    if (!branch) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    // Создаем массив для хранения результата
    const resultArray = [];

    // Проходим по массиву nodeIDs
    for (const nodeID of nodeIDs) {
      // Находим нужную ноду по nodeID
      const node = branch.planningTypes.reduce(
        (acc, planningType) => acc.concat(planningType.nodes),
        []
      ).find((n) => n.nodeID === nodeID);

      if (node) {
        // Если нода найдена, добавляем в результирующий массив
        resultArray.push({ nodeID, name: node.name });
      }
    }

    // Возвращаем результат
    res.json(resultArray);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.post('/api/addRelationLink', async (req, res) => {
  const { gameID, branchName, relationID, newLink } = req.body;

  try {
    // Находим нужную запись в базе данных
    const existingRelation = await Relations.findOne({
      gameID,
      'branches.branch': branchName,
      'branches.relations.relationID': relationID,
    });

    // Если запись не найдена, создаем новую
    if (!existingRelation) {
      const newRelation = new Relations({
        gameID,
        branches: [
          {
            branch: branchName,
            relations: [
              {
                relationID,
                links: [
                  {
                    sourceContent: ``,
                    targetContent: ``,
                    ...newLink,
                  },
                ],
              },
            ],
          },
        ],
      });

      await newRelation.save();
    } else {
      // Если запись найдена, обновляем существующую линку или добавляем новую
      const relationIndex = existingRelation.branches.findIndex(
        (b) => b.branch === branchName
      );
      const relation = existingRelation.branches[relationIndex].relations.find(
        (r) => r.relationID === relationID
      );

      if (relation) {
        // Проверка наличия линки с такими же source и target
        const linkIndex = relation.links.findIndex((link) =>
          (link.source === newLink.source && link.target === newLink.target) ||
          (link.target === newLink.source && link.source === newLink.target)
        );

        if (linkIndex !== -1) {
          // Если линка с такими же source и target уже существует, обновляем ее
          relation.links[linkIndex] = {
            targetContent: ``,
            ...newLink,
          };
        } else {
          // Иначе добавляем новую линку
          relation.links.push({
            sourceContent: ``,
            targetContent: ``,
            ...newLink,
          });
        }

        await existingRelation.save();
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});
app.post('/api/getRelationLinks', async (req, res) => {
  const { gameID, branchName, relationID, lightMode } = req.body;

  try {
    // Находим нужную запись в базе данных
    const existingRelation = await Relations.findOne({
      gameID,
      'branches.branch': branchName,
      'branches.relations.relationID': relationID,
    }).lean();

    if (!existingRelation) {
      return res.status(404).json({ success: false, error: 'Relation not found' });
    }

    const relationIndex = existingRelation.branches.findIndex(
      (b) => b.branch === branchName
    );
    const relation = existingRelation.branches[relationIndex].relations.find(
      (r) => r.relationID === relationID
    );

    if (!relation) {
      return res.status(404).json({ success: false, error: 'Relation not found' });
    }

    const links = relation.links.map((link) => {
      if (lightMode) {
        // Если lightMode = true, возвращаем линку без полей content
        const { content, ...lightLink } = link;
        return lightLink;
      } else {
        // Если lightMode = false, возвращаем полную линку
        return link;
      }
    });
    res.status(200).json({ success: true, links });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});
app.post('/api/updateRelationNode', async (req, res) => {
  const { gameID, branchName, relationID, linkID, fieldToUpdate, content } = req.body;

  try {
    // Находим нужную запись в базе данных
    const existingRelation = await Relations.findOne({
      gameID,
      'branches.branch': branchName,
      'branches.relations.relationID': relationID,
    }).lean();

    if (!existingRelation) {
      return res.status(404).json({ success: false, error: 'Relation not found' });
    }

    const relationIndex = existingRelation.branches.findIndex(
      (b) => b.branch === branchName
    );
    const relation = existingRelation.branches[relationIndex].relations.find(
      (r) => r.relationID === relationID
    );

    if (!relation) {
      return res.status(404).json({ success: false, error: 'Relation not found' });
    }

    const linkIndex = relation.links.findIndex((link) => link._id.toString() === linkID);

    if (linkIndex === -1) {
      return res.status(404).json({ success: false, error: 'Link not found' });
    }

    const updatedLink = { ...relation.links[linkIndex] };

    if (fieldToUpdate === 'sourceContent' || fieldToUpdate === 'targetContent') {
      updatedLink[fieldToUpdate] = content;
    } else {
      return res.status(400).json({ success: false, error: 'Invalid field to update' });
    }

    relation.links[linkIndex] = updatedLink;

    await Relations.updateOne(
      {
        gameID,
        'branches.branch': branchName,
        'branches.relations.relationID': relationID,
      },
      { $set: { 'branches.$.relations.$[rel].links.$[link]': updatedLink } },
      {
        arrayFilters: [{ 'rel.relationID': relationID }, { 'link._id': linkID }],
      }
    );

    res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});
app.post('/api/setRelationComment', async (req, res) => {
  const { gameID, branchName, relationID, newComment } = req.body;

  try {
    // Находим нужную запись в базе данных
    const existingRelation = await Relations.findOne({
      gameID,
      'branches.branch': branchName,
      'branches.relations.relationID': relationID,
    });

    if (!existingRelation) {
      return res.status(404).json({ success: false, error: 'Relation not found' });
    }

    const relationIndex = existingRelation.branches.findIndex(
      (b) => b.branch === branchName
    );
    const relation = existingRelation.branches[relationIndex].relations.find(
      (r) => r.relationID === relationID
    );

    if (!relation) {
      return res.status(404).json({ success: false, error: 'Relation not found' });
    }

    // Обновляем поле comment в найденной линке
    relation.comment = newComment;

    await existingRelation.save();

    res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});
app.post('/api/setRelationName', async (req, res) => {
  const { gameID, branchName, relationID, newName } = req.body;

  try {
    // Находим нужную запись в базе данных
    const existingRelation = await Relations.findOne({
      gameID,
      'branches.branch': branchName,
      'branches.relations.relationID': relationID,
    });

    if (!existingRelation) {
      return res.status(404).json({ success: false, error: 'Relation not found' });
    }

    const relationIndex = existingRelation.branches.findIndex(
      (b) => b.branch === branchName
    );
    const relation = existingRelation.branches[relationIndex].relations.find(
      (r) => r.relationID === relationID
    );

    if (!relation) {
      return res.status(404).json({ success: false, error: 'Relation not found' });
    }

    // Обновляем поле name в найденной линке
    relation.name = newName;

    await existingRelation.save();

    res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

app.post('/api/removeRelationLink', async (req, res) => {
  const { gameID, branchName, relationID, linkSource, linkTarget, removeType } = req.body;
  try {
    // Находим соответствующий объект linkSchema
    const relations = await Relations.findOne({ gameID });
    if (!relations) {
      return res.status(404).json({ success: false, error: 'Game not found' });
    }

    const branch = relations.branches.find((b) => b.branch === branchName);
    if (!branch) {
      return res.status(404).json({ success: false, error: 'Branch not found' });
    }

    const relation = branch.relations.find((r) => r.relationID === relationID);
    if (!relation) {
      return res.status(404).json({ success: false, error: 'Relation not found' });
    }

    const link = relation.links.find((l) => l.source === linkSource && l.target === linkTarget);
    if (!link) {
      return res.status(404).json({ success: false, error: 'Link not found' });
    }

    // В зависимости от removeType делаем линку однонаправленной, смотря какую её часть мы хотим удалить
    if (removeType === 'source' || removeType === 'target') {
      if (link.left && link.right) {
        if (removeType === 'source') {
          link.left = false;
        } else if (removeType === 'target') {
          link.right = false;
        }
      } else {
        // Если left или right равны false, удаляем объект link. Воспринимаем действие как "удалить линку полностью"
        relation.links = relation.links.filter((l) => !(l.source === linkSource && l.target === linkTarget));
      }
    }

    // Сохраняем обновленный объект Relations
    await relations.save();

    res.json({ success: true, message: 'Link updated successfully' });
  } catch (error) {
    console.error('Error updating link:', error.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
})
app.post('/api/removeRelationNodeFromTree', async (req, res) => {
  const { gameID, branchName, nodeID, relationType, relationID } = req.body;
  // relationType must be either "relation" or "context"
  try {
    const relation = await Relations.findOne({ gameID });

    if (!relation) {
      return res.status(404).send({success: false, message: 'Game not found'});
    }

    const branch = relation.branches.find(b => b.branch === branchName);

    if (!branch) {
      return res.status(404).json({success: false, message: 'Branch not found'});
    }

    if (relationType === 'relation') {
      const relationIndex = branch.relations.findIndex(r => r.relationID === relationID);
      if (relationIndex === -1) {
        return res.status(404).json({success: false, message: 'Relation not found'});
      }

      branch.relations[relationIndex].nodes = branch.relations[relationIndex].nodes.filter(n => n.nodeID !== nodeID);

      branch.relations[relationIndex].links = branch.relations[relationIndex].links.filter(l => l.source !== nodeID && l.target !== nodeID);

    } else if (relationType === 'context') {
      const contextIndex = branch.contexts.findIndex(c => c.contextID === relationID);
      if (contextIndex === -1) {
        return res.status(404).json({success: false, message: 'Context not found'});
      }

      branch.contexts[contextIndex].nodes = branch.contexts[contextIndex].nodes.filter(n => n.nodeID !== nodeID);
    } else {
      return res.status(400).json({success: false, message: 'Invalid relation type'});
    }

    await relation.save();

    res.json({success: true, message: 'Node deleted successfully'});
  } catch (error) {
    res.status(500).json({success: false, error: error.message});
  }
});

// R&C Contexts
app.post('/api/addNewContext', async (req, res) => {
  try {
    const { gameID, branchName } = req.body;

    // Генерация нового уникального relationID
    const contextID = new mongoose.Types.ObjectId();

    // Новый объект отношений
    const newContext = {
      contextID: contextID.toString(), // Преобразуем ObjectId в строку
      name: '',
      nodes: [], // Здесь вы можете определить начальные данные для узлов
      comment: '', // Здесь вы можете определить начальный комментарий
    };

    // Найти соответствующую ветку и добавить новое отношение
    const updatedGame = await Relations.findOneAndUpdate(
      { gameID, 'branches.branch': branchName },
      {
        $push: {
          'branches.$.contexts': newContext,
        },
      },
      { new: true }
    );

    if (!updatedGame) {
      return res.status(404).json({ message: 'Game or branch not found' });
    }

    return res.status(200).json({message: 'Successfully created new relation. New ID:', newID: contextID});
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});
app.post('/api/setContextComment', async (req, res) => {
  const { gameID, branchName, contextID, newComment } = req.body;

  try {
    // Находим нужную запись в базе данных
    const existingContext = await Relations.findOne({
      gameID,
      'branches.branch': branchName,
      'branches.contexts.contextID': contextID,
    });

    if (!existingContext) {
      return res.status(404).json({ success: false, error: 'Context not found' });
    }

    const contextIndex = existingContext.branches.findIndex(
      (b) => b.branch === branchName
    );
    const context = existingContext.branches[contextIndex].contexts.find(
      (r) => r.contextID === contextID
    );

    if (!context) {
      return res.status(404).json({ success: false, error: 'Context not found' });
    }

    // Обновляем поле comment в найденной линке
    context.comment = newComment;

    await existingContext.save();

    res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});
app.post('/api/setContextName', async (req, res) => {
  const { gameID, branchName, contextID, newName } = req.body;

  try {
    // Находим нужную запись в базе данных
    const existingContext = await Relations.findOne({
      gameID,
      'branches.branch': branchName,
      'branches.contexts.contextID': contextID,
    });

    if (!existingContext) {
      return res.status(404).json({ success: false, error: 'Context not found' });
    }

    const contextIndex = existingContext.branches.findIndex(
      (b) => b.branch === branchName
    );
    const context = existingContext.branches[contextIndex].contexts.find(
      (r) => r.contextID === contextID
    );

    if (!context) {
      return res.status(404).json({ success: false, error: 'Context not found' });
    }

    // Обновляем поле name в найденной линке
    context.name = newName;

    await existingContext.save();

    res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});
app.post('/api/getAllContexts', async (req, res) => {
  try {
    const { gameID, branchName } = req.body;

    // Найти соответствующую ветку и получить массив relationID
    let contexts = await Relations.findOne(
      { gameID, 'branches.branch': branchName },
      { 'branches.$': 1, _id: 0 } // Проекция, чтобы вернуть только нужную ветку
    );

    if (!contexts) {
      // Если игра не найдена, создаем документ с gameID
      const newContexts = new Relations({
        gameID,
        branches: [
          { branch: 'development', relations: [], context: [] },
          { branch: 'stage', relations: [], context: [] },
          { branch: 'production', relations: [], context: [] },
        ],
      });
      contexts = await newContexts.save();
    }

    if (!contexts.branches || contexts.branches.length === 0) {
      return res.status(404).json({ message: 'Game or branch not found' });
    }

    const targetBranch = contexts.branches.find(b => b.branch === branchName);

    if (!targetBranch || !targetBranch.relations || targetBranch.relations.length === 0) {
      return res.status(404).json({ message: 'Game or branch not found' });
    }

    const contextIDs = targetBranch.contexts.map((context) => context.contextID);

    return res.status(200).json(contextIDs);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Used in node editor in R&C section
app.post('/api/getContextsByNodeIDArray', async (req, res) => {
  try {
    const { gameID, branchName, nodeIDs } = req.body;

    // Найти соответствующую ветку и получить массив contextID
    let relations = await Relations.findOne(
      { gameID, 'branches.branch': branchName },
      { 'branches.$': 1, _id: 0 } // Проекция, чтобы вернуть только нужную ветку
    );

    if (!relations || !relations.branches || relations.branches.length === 0) {
      return res.status(404).json({ message: 'Game or branch not found' });
    }

    const targetBranch = relations.branches.find(b => b.branch === branchName);

    if (!targetBranch || !targetBranch.contexts || targetBranch.contexts.length === 0) {
      return res.status(404).json({ message: 'Game or branch not found' });
    }

    // Фильтрация контекстов, содержащих указанные nodeID
    const filteredContexts = targetBranch.contexts.filter(context =>
      context.nodes.some(node => nodeIDs.includes(node.nodeID))
    );

    // Можно возвращать полные контексты или только их ID, в зависимости от требований
    const contextIDs = filteredContexts.map(context => context.contextID);

    return res.status(200).json(contextIDs);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});


app.post('/api/getContext', async (req, res) => {
  try {
    const { gameID, branchName, contextID } = req.body;

    // Проверка наличия обязательных параметров
    if (!gameID || !branchName || !contextID) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Находим документ по gameID
    const contextsDoc = await Relations.findOne({ gameID });

    if (!contextsDoc) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Находим нужную ветку по branchName
    const branch = contextsDoc.branches.find((b) => b.branch === branchName);

    if (!branch) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    // Находим нужную связь по contextID
    const context = branch.contexts.find((r) => r.contextID === contextID);

    if (!context) {
      return res.status(404).json({ error: 'Context not found' });
    }

    // Возвращаем полный объект связи
    res.json(context);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.post('/api/addNodeToContext', async (req, res) => {
  try {
    const { gameID, branchName, contextID, nodeID } = req.body;

    // Проверка наличия обязательных параметров
    if (!gameID || !branchName || !contextID || !nodeID) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Находим документ по gameID
    const contextsDoc = await Relations.findOne({ gameID });

    if (!contextsDoc) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Находим нужную ветку по branchName
    const branch = contextsDoc.branches.find((b) => b.branch === branchName);

    if (!branch) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    // Находим нужную связь по contextID
    const context = branch.contexts.find((r) => r.contextID === contextID);

    if (!context) {
      return res.status(404).json({ error: 'Context not found' });
    }

    // Проверяем, существует ли нода с данным nodeID в массиве
    const existingNode = context.nodes.find((n) => n.nodeID === nodeID);

    if (existingNode) {
      return res.json({ alreadyExists: true });
    }

    // Находим соответствующую ноду в NodeModel
    const nodeModelData = await NodeModel.findOne({
      "branches.branch": branchName,
      "branches.planningTypes": {
        $elemMatch: {
          "nodes.nodeID": nodeID
        }
      }
    });

    if (!nodeModelData || !nodeModelData.branches || !nodeModelData.branches.length) {
      return res.status(404).json({ error: 'Node not found in NodeModel' });
    }

    const planningType = nodeModelData.branches
    .find(branch => branch.planningTypes.some(pt => pt.nodes.some(n => n.nodeID === nodeID)))
    .planningTypes.find(pt => pt.nodes.some(n => n.nodeID === nodeID)).type;

    // Добавляем новый узел к связи
    context.nodes.push({
      nodeID,
      nodeType: planningType ? planningType : '',
      emotion: '',
      instinct: ''
    });

    // Сохраняем изменения в базе данных
    await contextsDoc.save();

    // Отправляем успешный ответ
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.post('/api/updateContextNodes', async (req, res) => {
  try {
    const { gameID, branchName, contextID, newNodes } = req.body;

    // Найдем нужный объект relations по gameID
    const relations = await Relations.findOne({ gameID });

    if (!relations) {
      return res.status(404).json({ error: 'Relations not found for the given gameID' });
    }

    // Найдем нужный объект branch по branchName
    const branch = relations.branches.find((b) => b.branch === branchName);

    if (!branch) {
      return res.status(404).json({ error: 'Branch not found for the given branchName' });
    }

    // Найдем нужный объект context по contextID
    const context = branch.contexts.find((c) => c.contextID === contextID);

    if (!context) {
      return res.status(404).json({ error: 'Context not found for the given contextID' });
    }

    // Заменяем массив nodes новым
    context.nodes = newNodes;

    // Сохраняем изменения в базе данных
    await relations.save();

    res.json({ message: 'Context nodes updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Analytics filter button. Fetching all segments to populate it's menu items.
app.post('/api/getAllSegmentsForAnalyticsFilter', async (req, res) => {
  const {gameID, branchName} = req.body
  try {
    const segments = await Segments.findOne(
      {
        'gameID': gameID,
        'branches.branch': branchName,
      },
      { 'branches.segments.segmentID': 1, 'branches.segments.segmentName': 1, '_id': 0 }
    );

    if (!segments) {
      throw new Error(`Segments not found for gameID: ${gameID} and branchName: ${branchName}`);
    }

    res.status(200).json({success: true, message: segments.branches[0].segments})
  } catch (error) {
    console.error(error.message);
    res.status(500).json({success: false, message: 'Internal Server Error'})
  }
});

// Analytics
//
// Analytics Dashboard - General
//
async function getPlayersFromSegment(gameID, branchName, segmentIDs) {
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
function calculateDelta(delta, current) {
  try {
    // Get summ of values of actual query
    const currentSum = current.data.reduce((acc, entry) => acc + parseFloat(entry.value), 0);

    // If delta is undefined, just return currentSum because it means there is no delta to compare
    if (delta.data === undefined || delta.data.length === 0) return currentSum.toFixed(2)
    // Get summ of values of previous data
    const deltaSum = delta.data.reduce((acc, entry) => acc + parseFloat(entry.value), 0);

    return currentSum.toFixed(2) - deltaSum.toFixed(2);
  } catch (error) {
    // console.error('Error in calculating analytics delta')
    return 0;
  }
}
app.post('/api/analytics/getNewUsers', async (req, res) => {
  const {gameID, branchName, filterDate, filterSegments} = req.body

  try {

    const endDate = new Date(filterDate[1])
    const startDate = new Date(filterDate[0])


    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(23, 59, 59, 999);

    // Get difference between dates in milliseconds
    const dateDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);

    // Getting date for delta response, so if we get a query for "today" data, we get it and delta between today and yesterday.
    // If we get a data for this month, we will get delta for the previous month.
    const deltaEndDate = new Date(startDate)
    deltaEndDate.setDate(startDate.getDate() - 1)

    const deltaStartDate = new Date(startDate)
    deltaStartDate.setDate(startDate.getDate() - (dateDiff + 1))

    deltaStartDate.setUTCHours(0, 0, 0, 0);
    deltaEndDate.setUTCHours(23, 59, 59, 999);

    const deltaDateDiff = (deltaEndDate - deltaStartDate) / (1000 * 60 * 60 * 24);

    let clientIDs = []

    if (filterSegments && filterSegments.length !== 0) {
      clientIDs = await getPlayersFromSegment(gameID, branchName, filterSegments)
    }
    const deltaResponse = await druidLib.getNewUsers(gameID, branchName, deltaStartDate, deltaEndDate, deltaDateDiff, clientIDs)
    const response = await druidLib.getNewUsers(gameID, branchName, startDate, endDate, dateDiff, clientIDs)

    const deltaValue = calculateDelta(deltaResponse, response)

    if (response.success) {
      res.status(200).json({success: true, message: {data: response.data, granularity: response.granularity, deltaValue: deltaValue}})
    } else{
      res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
    }

  } catch (error) {
    console.log(error)
    res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
  }


});
app.post('/api/analytics/getDAU', async (req, res) => {
  const {gameID, branchName, filterDate, filterSegments} = req.body

  try {

    const endDate = new Date(filterDate[1])
    const startDate = new Date(filterDate[0])

    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(23, 59, 59, 999);

    // Get difference between dates in milliseconds
    const dateDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);

    // Getting date for delta response, so if we get a query for "today" data, we get it and delta between today and yesterday.
    // If we get a data for this month, we will get delta for the previous month.
    const deltaEndDate = new Date(startDate)
    deltaEndDate.setDate(startDate.getDate() - 1)

    const deltaStartDate = new Date(startDate)
    deltaStartDate.setDate(startDate.getDate() - (dateDiff + 1))

    deltaStartDate.setUTCHours(0, 0, 0, 0);
    deltaEndDate.setUTCHours(23, 59, 59, 999);

    const deltaDateDiff = (deltaEndDate - deltaStartDate) / (1000 * 60 * 60 * 24);

    let clientIDs = []

    if (filterSegments && filterSegments.length !== 0) {
      clientIDs = await getPlayersFromSegment(gameID, branchName, filterSegments)
    }
    // const deltaResponse = await druidLib.getDAU(gameID, branchName, deltaStartDate, deltaEndDate, deltaDateDiff, clientIDs)
    // const response = await druidLib.getDAU(gameID, branchName, startDate, endDate, dateDiff, clientIDs)

    // const deltaValue = calculateDelta(deltaResponse, response)

    const responseData = [
      {
        timestamp: '2023-12-19T10:00:00.000Z',
        value: randomNumberInRange(1, 100)
      },
      {
        timestamp: '2023-12-20T10:00:00.000Z',
        value: randomNumberInRange(1, 100)
      },
      {
        timestamp: '2023-12-21T10:00:00.000Z',
        value: randomNumberInRange(1, 100)
      },
      {
        timestamp: '2023-12-22T10:00:00.000Z',
        value: randomNumberInRange(1, 100)
      },
      {
        timestamp: '2023-12-23T10:00:00.000Z',
        value: randomNumberInRange(1, 100)
      },
      {
        timestamp: '2023-12-24T10:00:00.000Z',
        value: randomNumberInRange(1, 100)
      },
      {
        timestamp: '2023-12-25T10:00:00.000Z',
        value: randomNumberInRange(1, 100)
      },
      {
        timestamp: '2023-12-26T10:00:00.000Z',
        value: randomNumberInRange(1, 100)
      },
    ]

    // if (response.success) {
    if (true) {
      res.status(200).json({success: true, message: {data: responseData, granularity: 'day', deltaValue: randomNumberInRange(1, 500)}})
    } else{
      res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
    }

  } catch (error) {
    console.log(error)
    res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
  }

});
const randomNumberInRange = (min, max, isFloat, toFixed = 3) => {
  if (isFloat) {
    return parseFloat(Math.random() * (max - min) + min).toFixed(toFixed);
  } else {
    return Math.round(Math.random() * (max - min)) + min;
  }
};

// Generate random data for testing.
// Trend is int between -1 and 1 (everyday change)
// Deviation is any int. Dev. 0.5 means that every day will be +/- 0.5 of trend
async function generateRandomDataByDays(
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
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
async function generateRandomDataByDaysNonLinear(
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
function NonAsyncGenerateRandomDataByDays(
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
async function generateRandomDataByDaysAndGroups(
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
async function generateRandomDataByNumber(startNum, endNum, minValue, maxValue, trend, deviation, toFixedAmount, categoryFieldName, valueFieldName) {
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
function arraySum(numbers) {
  return numbers.reduce((accumulator, currentValue) => {
    return accumulator + currentValue;
  }, 0);
} 
app.post('/api/analytics/getRevenue', async (req, res) => {
  const {gameID, branchName, filterDate, filterSegments} = req.body

  try {

    const endDate = new Date(filterDate[1])
    const startDate = new Date(filterDate[0])

    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(23, 59, 59, 999);

    // Get difference between dates in milliseconds
    const dateDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);

    // Getting date for delta response, so if we get a query for "today" data, we get it and delta between today and yesterday.
    // If we get a data for this month, we will get delta for the previous month.
    const deltaEndDate = new Date(startDate)
    deltaEndDate.setDate(startDate.getDate() - 1)

    const deltaStartDate = new Date(startDate)
    deltaStartDate.setDate(startDate.getDate() - (dateDiff + 1))

    deltaStartDate.setUTCHours(0, 0, 0, 0);
    deltaEndDate.setUTCHours(23, 59, 59, 999);

    const deltaDateDiff = (deltaEndDate - deltaStartDate) / (1000 * 60 * 60 * 24);

    let clientIDs = []

    if (filterSegments && filterSegments.length !== 0) {
      clientIDs = await getPlayersFromSegment(gameID, branchName, filterSegments)
    }
    // const deltaResponse = await druidLib.getRevenue(gameID, branchName, deltaStartDate, deltaEndDate, deltaDateDiff, clientIDs)
    // const response = await druidLib.getRevenue(gameID, branchName, startDate, endDate, dateDiff, clientIDs)

    // const deltaValue = calculateDelta(deltaResponse, response)
    let generatedData = await generateRandomDataByDays(startDate, endDate, 80, 400, 0.1, 0.05)
    let responseData = generatedData.map(item => ({
      timestamp: item.timestamp,
      sales: parseFloat((item.value*2 * randomNumberInRange(1.2, 2))).toFixed(0),
      revenue: item.value*2,
    }))
    deltaValue = arraySum(responseData.map(item => item.revenue)).toFixed(2)

    if (true) {
      res.status(200).json({success: true, message: {data: responseData, granularity: 'day', deltaValue: deltaValue}})
    } else{
      res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
    }

  } catch (error) {
    console.log(error)
    res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
  }


});
app.post('/api/analytics/getRandomDataForUniversalChart', async (req, res) => {
  const {gameID, branchName, filterDate, filterSegments, categoryField} = req.body

  try {

    const engineVersions = ['ue4.27', 'ue5.23', 'unity2019.4', 'unity2020.3', 'unity2021.1']
    const gameVersions = ['2.23.1', '2.23.2', '2.24.0', '2.25.0', '2.26.0', '2.27.0', '2.28.0']
    const platforms = ['windows_11', 'windows_10', 'macos', 'linux', 'android', 'ios']
    const languages = ['English', 'German', 'French', 'Spanish', 'Russian', 'Chinese', 'Japanese', 'Korean']
    const countries = ['US', 'UK', 'Germany', 'France', 'Spain', 'Russia', 'China', 'Japan', 'Korea']

    let categoryArray = []
    switch (categoryField) {
      case 'engineVersion': {
        categoryArray = engineVersions
        break
      }
      case 'gameVersion': {
        categoryArray = gameVersions
        break
      }
      case 'platform': {
        categoryArray = platforms
        break
      }
      case 'language': {
        categoryArray = languages
        break
      }
      case 'country': {
        categoryArray = countries
        break
      }
    }

    const endDate = new Date(filterDate[1])
    const startDate = new Date(filterDate[0])
    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(23, 59, 59, 999);

    const dateDiff = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));

    switch (categoryField) {
      case 'timestamp': {
        let generatedData = await generateRandomDataByDays(startDate, endDate, 80, 400, 0.1, 0.05)
        let responseData = generatedData
        deltaValue = arraySum(responseData.map(item => item.value)).toFixed(2)
        res.status(200).json({success: true, message: {data: responseData, granularity: 'day', deltaValue: deltaValue}})
        return
      }
      default: {
        let generatedData = []

        let values
        for (i = 0; i <= dateDiff-1; i++) {
          values = categoryArray.map(item => {
            return {
                [categoryField]: item,
                value: randomNumberInRange(80, 1000)
                }
          })
        }
        generatedData = values

        let responseData = generatedData
        deltaValue = arraySum(responseData.map(item => item.value)).toFixed(2)
        res.status(200).json({success: true, message: {data: responseData}})
        return
      }
    }

  } catch (error) {
    console.log(error)
    res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
  }


});
app.post('/api/analytics/getAvgCustomerProfile', async (req, res) => {
  const {gameID, branchName, filterDate, filterSegments} = req.body

  try {

    const endDate = new Date(filterDate[1])
    const startDate = new Date(filterDate[0])

    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(23, 59, 59, 999);

    // Get difference between dates in milliseconds
    const dateDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);

    // Getting date for delta response, so if we get a query for "today" data, we get it and delta between today and yesterday.
    // If we get a data for this month, we will get delta for the previous month.
    const deltaEndDate = new Date(startDate)
    deltaEndDate.setDate(startDate.getDate() - 1)

    const deltaStartDate = new Date(startDate)
    deltaStartDate.setDate(startDate.getDate() - (dateDiff + 1))

    deltaStartDate.setUTCHours(0, 0, 0, 0);
    deltaEndDate.setUTCHours(23, 59, 59, 999);

    const deltaDateDiff = (deltaEndDate - deltaStartDate) / (1000 * 60 * 60 * 24);

    let clientIDs = []

    if (filterSegments && filterSegments.length !== 0) {
      clientIDs = await getPlayersFromSegment(gameID, branchName, filterSegments)
    }
    // const deltaResponse = await druidLib.getRevenue(gameID, branchName, deltaStartDate, deltaEndDate, deltaDateDiff, clientIDs)
    // const response = await druidLib.getRevenue(gameID, branchName, startDate, endDate, dateDiff, clientIDs)

    // const deltaValue = calculateDelta(deltaResponse, response)
    let generatedData_ARPPU = await generateRandomDataByDays(startDate, endDate, 0.3, 0.6, 0.1, 0.05)
    let generatedData_Recency = await generateRandomDataByDays(startDate, endDate, 1, 2, 0.1, 0.05)
    let generatedData_SalesPerLife = await generateRandomDataByDays(startDate, endDate, 2, 4, 0.01, 0.05)

    const avgProfile = {
      arppu: generatedData_ARPPU,
      arecppu: generatedData_Recency,
      asppu: generatedData_SalesPerLife,
      totalSales: 1000,
      avgProfile: [
        {
          name: 'Game Level',
          value: '4',
          templateID: '1',
          players: 321,
          subProfiles: [
            {
              value: '3',
              players: 120,
            },
            {
              value: '2',
              players: 56,
            },
            {
              value: '1',
              players: 21,
            },
          ]
        },
        {
          name: 'Fav. Char',
          value: 'Leon',
          templateID: '2',
          players: 632,
          subProfiles: [
            {
              value: 'Shelly',
              players: 120,
            },
            {
              value: 'Bull',
              players: 56,
            },
            {
              value: 'Crow',
              players: 21,
            },
          ]
        },
        {
          name: 'Winrate',
          value: '64%',
          templateID: '3',
          players: 345,
          subProfiles: [
            {
              value: '63%',
              players: 341,
            },
            {
              value: '62%',
              players: 334,
            },
            {
              value: '61%',
              players: 234,
            },
          ]
        },
        {
          name: 'Retention',
          value: 'D0',
          templateID: '4',
          players: 1231,
          subProfiles: [
            {
              value: 'D3',
              players: 120,
            },
            {
              value: 'D2',
              players: 56,
            },
            {
              value: 'D1',
              players: 21,
            },
          ]
        },
        {
          name: 'Country',
          value: 'USA',
          templateID: '5',
          players: 1231,
          subProfiles: [
            {
              value: 'France',
              players: 564,
            },
            {
              value: 'Canada',
              players: 341,
            },
            {
              value: 'Germany',
              players: 234,
            },
          ]
        },
        {
          name: 'Total Summ Spent',
          value: '$34',
          templateID: '6',
          players: 561,
          subProfiles: [
            {
              value: '$54',
              players: 120,
            },
            {
              value: '$45',
              players: 56,
            },
            {
              value: '$76',
              players: 21,
            },
          ]
        },
        {
          name: 'IAP bought times',
          value: '1',
          templateID: '7',
          players: 456,
          subProfiles: [
            {
              value: '2',
              players: 120,
            },
            {
              value: '3',
              players: 56,
            },
            {
              value: '4',
              players: 21,
            },
          ]
        },
        {
          name: 'Segment',
          value: 'New player',
          templateID: '8',
          players: 2312,
          subProfiles: [
          ]
        },
      ],
    }

    if (true) {
      res.status(200).json({success: true, message: {data: avgProfile, granularity: 'day'}})
    } else{
      res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
    }

  } catch (error) {
    console.log(error)
    res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
  }


});
app.post('/api/analytics/getRetention', async (req, res) => {
  const {gameID, branchName, filterDate, filterSegments} = req.body

  try {

    const endDate = new Date(filterDate[1])
    const startDate = new Date(filterDate[0])

    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(23, 59, 59, 999);

    // Get difference between dates in milliseconds
    const dateDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);

    // Getting date for delta response, so if we get a query for "today" data, we get it and delta between today and yesterday.
    // If we get a data for this month, we will get delta for the previous month.
    const deltaEndDate = new Date(startDate)
    deltaEndDate.setDate(startDate.getDate() - 1)

    const deltaStartDate = new Date(startDate)
    deltaStartDate.setDate(startDate.getDate() - (dateDiff + 1))

    deltaStartDate.setUTCHours(0, 0, 0, 0);
    deltaEndDate.setUTCHours(23, 59, 59, 999);

    const deltaDateDiff = (deltaEndDate - deltaStartDate) / (1000 * 60 * 60 * 24);

    let clientIDs = []

    if (filterSegments && filterSegments.length !== 0) {
      clientIDs = await getPlayersFromSegment(gameID, branchName, filterSegments)
    }
    // const deltaResponse = await druidLib.getRevenue(gameID, branchName, deltaStartDate, deltaEndDate, deltaDateDiff, clientIDs)
    const response = await druidLib.getRetention(gameID, branchName, startDate, endDate, dateDiff, clientIDs)


    if (response.success) {
      res.status(200).json({success: true, message: {data: response.data, granularity: response.granularity}})
    } else{
      res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
    }

  } catch (error) {
    console.log(error)
    res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
  }


});
app.post('/api/analytics/getARPDAU', async (req, res) => {
  const {gameID, branchName, filterDate, filterSegments} = req.body

  try {

    const endDate = new Date(filterDate[1])
    const startDate = new Date(filterDate[0])

    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(23, 59, 59, 999);

    // Get difference between dates in milliseconds
    const dateDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);

    // Getting date for delta response, so if we get a query for "today" data, we get it and delta between today and yesterday.
    // If we get a data for this month, we will get delta for the previous month.
    const deltaEndDate = new Date(startDate)
    deltaEndDate.setDate(startDate.getDate() - 1)

    const deltaStartDate = new Date(startDate)
    deltaStartDate.setDate(startDate.getDate() - (dateDiff + 1))

    deltaStartDate.setUTCHours(0, 0, 0, 0);
    deltaEndDate.setUTCHours(23, 59, 59, 999);

    const deltaDateDiff = (deltaEndDate - deltaStartDate) / (1000 * 60 * 60 * 24);

    let clientIDs = []

    if (filterSegments && filterSegments.length !== 0) {
      clientIDs = await getPlayersFromSegment(gameID, branchName, filterSegments)
    }
    const deltaResponse = await druidLib.getARPDAU(gameID, branchName, deltaStartDate, deltaEndDate, deltaDateDiff, clientIDs)
    const response = await druidLib.getARPDAU(gameID, branchName, startDate, endDate, dateDiff, clientIDs)

    const deltaValue = calculateDelta(deltaResponse, response)

    if (response.success) {
      res.status(200).json({success: true, message: {data: response.data, granularity: response.granularity, deltaValue: deltaValue}})
    } else{
      res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
    }

  } catch (error) {
    console.log(error)
    res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
  }


});
app.post('/api/analytics/getCumulativeARPU', async (req, res) => {
  const {gameID, branchName, filterDate, filterSegments} = req.body

  try {

    const endDate = new Date(filterDate[1])
    const startDate = new Date(filterDate[0])

    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(23, 59, 59, 999);

    // Get difference between dates in milliseconds
    const dateDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);

    let clientIDs = []

    if (filterSegments && filterSegments.length !== 0) {
      clientIDs = await getPlayersFromSegment(gameID, branchName, filterSegments)
    }
    const response = await druidLib.getCumulativeARPU(gameID, branchName, startDate, endDate, dateDiff, clientIDs)

    if (response.success) {
      res.status(200).json({success: true, message: {data: response.data, granularity: response.granularity, deltaValue: 0}})
    } else{
      res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
    }

  } catch (error) {
    console.log(error)
    res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
  }


});
app.post('/api/analytics/getPayingUsersShare', async (req, res) => {
  const {gameID, branchName, filterDate, filterSegments} = req.body

  try {

    const endDate = new Date(filterDate[1])
    const startDate = new Date(filterDate[0])

    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(23, 59, 59, 999);

    // Get difference between dates in milliseconds
    const dateDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);

    // Getting date for delta response, so if we get a query for "today" data, we get it and delta between today and yesterday.
    // If we get a data for this month, we will get delta for the previous month.
    const deltaEndDate = new Date(startDate)
    deltaEndDate.setDate(startDate.getDate() - 1)

    const deltaStartDate = new Date(startDate)
    deltaStartDate.setDate(startDate.getDate() - (dateDiff + 1))

    deltaStartDate.setUTCHours(0, 0, 0, 0);
    deltaEndDate.setUTCHours(23, 59, 59, 999);

    const deltaDateDiff = (deltaEndDate - deltaStartDate) / (1000 * 60 * 60 * 24);

    let clientIDs = []

    if (filterSegments && filterSegments.length !== 0) {
      clientIDs = await getPlayersFromSegment(gameID, branchName, filterSegments)
    }
    const deltaResponse = await druidLib.getPayingUsersShare(gameID, branchName, deltaStartDate, deltaEndDate, deltaDateDiff, clientIDs)
    const response = await druidLib.getPayingUsersShare(gameID, branchName, startDate, endDate, dateDiff, clientIDs)

    let deltaValue
    if (deltaResponse.success === false) {
      // If no data returned, use fresh response data as delta
      deltaValue = '100'
    } else {
      // If any data value is 0, return 100% delta. If not, return true delta.
      if (deltaResponse.data[0].data1 === 0 || response.data[0].data1 === 0) {
        deltaValue = '100'
      } else {
        const percentageDelta = ((deltaResponse.data[0].data1 / response.data[0].data1) * 100).toFixed(2)
        deltaValue = percentageDelta
      }
    }

    if (response.success) {
      res.status(200).json({success: true, message: {data: response.data, granularity: response.granularity, deltaValue: deltaValue}})
    } else{
      res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
    }

  } catch (error) {
    console.log(error)
    res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
  }


});
app.post('/api/analytics/getARPPU', async (req, res) => {
  const {gameID, branchName, filterDate, filterSegments} = req.body

  try {

    const endDate = new Date(filterDate[1])
    const startDate = new Date(filterDate[0])

    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(23, 59, 59, 999);

    // Get difference between dates in milliseconds
    const dateDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);

    // Getting date for delta response, so if we get a query for "today" data, we get it and delta between today and yesterday.
    // If we get a data for this month, we will get delta for the previous month.
    const deltaEndDate = new Date(startDate)
    deltaEndDate.setDate(startDate.getDate() - 1)

    const deltaStartDate = new Date(startDate)
    deltaStartDate.setDate(startDate.getDate() - (dateDiff + 1))

    deltaStartDate.setUTCHours(0, 0, 0, 0);
    deltaEndDate.setUTCHours(23, 59, 59, 999);

    const deltaDateDiff = (deltaEndDate - deltaStartDate) / (1000 * 60 * 60 * 24);

    let clientIDs = []

    if (filterSegments && filterSegments.length !== 0) {
      clientIDs = await getPlayersFromSegment(gameID, branchName, filterSegments)
    }
    const deltaResponse = await druidLib.getARPPU(gameID, branchName, deltaStartDate, deltaEndDate, deltaDateDiff, clientIDs)
    const response = await druidLib.getARPPU(gameID, branchName, startDate, endDate, dateDiff, clientIDs)

    const deltaValue = calculateDelta(deltaResponse, response)

    if (response.success) {
      res.status(200).json({success: true, message: {data: response.data, granularity: response.granularity, deltaValue: deltaValue}})
    } else{
      res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
    }

  } catch (error) {
    console.log(error)
    res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
  }


});
app.post('/api/analytics/getStickinessRate', async (req, res) => {
  const {gameID, branchName, filterDate, filterSegments} = req.body

  try {

    const endDate = new Date(filterDate[1])
    const startDate = new Date(filterDate[0])

    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(23, 59, 59, 999);

    // Get difference between dates in milliseconds
    const dateDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);

    // Getting date for delta response, so if we get a query for "today" data, we get it and delta between today and yesterday.
    // If we get a data for this month, we will get delta for the previous month.
    const deltaEndDate = new Date(startDate)
    deltaEndDate.setDate(startDate.getDate() - 1)

    const deltaStartDate = new Date(startDate)
    deltaStartDate.setDate(startDate.getDate() - (dateDiff + 1))

    deltaStartDate.setUTCHours(0, 0, 0, 0);
    deltaEndDate.setUTCHours(23, 59, 59, 999);

    const deltaDateDiff = (deltaEndDate - deltaStartDate) / (1000 * 60 * 60 * 24);

    let clientIDs = []

    if (filterSegments && filterSegments.length !== 0) {
      clientIDs = await getPlayersFromSegment(gameID, branchName, filterSegments)
    }
    const deltaResponse = await druidLib.getStickinessRate(gameID, branchName, deltaStartDate, deltaEndDate, deltaDateDiff, clientIDs)
    const response = await druidLib.getStickinessRate(gameID, branchName, startDate, endDate, dateDiff, clientIDs)

    const deltaValue = calculateDelta(deltaResponse, response)

    if (response.success) {
      res.status(200).json({success: true, message: {data: response.data, granularity: response.granularity, deltaValue: deltaValue}})
    } else{
      res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
    }

  } catch (error) {
    console.log(error)
    res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
  }


});
app.post('/api/analytics/getSessionLength', async (req, res) => {
  const {gameID, branchName, filterDate, filterSegments} = req.body

  try {

    const endDate = new Date(filterDate[1])
    const startDate = new Date(filterDate[0])


    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(23, 59, 59, 999);

    // Get difference between dates in milliseconds
    const dateDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);

    // Getting date for delta response, so if we get a query for "today" data, we get it and delta between today and yesterday.
    // If we get a data for this month, we will get delta for the previous month.
    const deltaEndDate = new Date(startDate)
    deltaEndDate.setDate(startDate.getDate() - 1)

    const deltaStartDate = new Date(startDate)
    deltaStartDate.setDate(startDate.getDate() - (dateDiff + 1))

    deltaStartDate.setUTCHours(0, 0, 0, 0);
    deltaEndDate.setUTCHours(23, 59, 59, 999);

    const deltaDateDiff = (deltaEndDate - deltaStartDate) / (1000 * 60 * 60 * 24);

    let clientIDs = []

    if (filterSegments && filterSegments.length !== 0) {
      clientIDs = await getPlayersFromSegment(gameID, branchName, filterSegments)
    }
    const deltaResponse = await druidLib.getSessionLength(gameID, branchName, deltaStartDate, deltaEndDate, deltaDateDiff, clientIDs)
    const response = await druidLib.getSessionLength(gameID, branchName, startDate, endDate, dateDiff, clientIDs)

    const deltaValue = calculateDelta(deltaResponse, response)

    if (response.success) {
      res.status(200).json({success: true, message: {data: response.data, granularity: response.granularity, deltaValue: deltaValue}})
    } else{
      res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
    }

  } catch (error) {
    console.log(error)
    res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
  }


});
app.post('/api/analytics/getEconomyBalanceForCurrency', async (req, res) => {
  const {gameID, branchName, filterDate, filterSegments} = req.body

  try {

    const endDate = new Date(filterDate[1])
    const startDate = new Date(filterDate[0])

    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(23, 59, 59, 999);

    // Get difference between dates in milliseconds
    const dateDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);

    // Getting date for delta response, so if we get a query for "today" data, we get it and delta between today and yesterday.
    // If we get a data for this month, we will get delta for the previous month.
    const deltaEndDate = new Date(startDate)
    deltaEndDate.setDate(startDate.getDate() - 1)

    const deltaStartDate = new Date(startDate)
    deltaStartDate.setDate(startDate.getDate() - (dateDiff + 1))

    deltaStartDate.setUTCHours(0, 0, 0, 0);
    deltaEndDate.setUTCHours(23, 59, 59, 999);

    const deltaDateDiff = (deltaEndDate - deltaStartDate) / (1000 * 60 * 60 * 24);

    let clientIDs = []

    if (filterSegments && filterSegments.length !== 0) {
      clientIDs = await getPlayersFromSegment(gameID, branchName, filterSegments)
    }
    // const deltaResponse = await druidLib.getRevenue(gameID, branchName, deltaStartDate, deltaEndDate, deltaDateDiff, clientIDs)
    // const response = await druidLib.getRevenue(gameID, branchName, startDate, endDate, dateDiff, clientIDs)

    // const deltaValue = calculateDelta(deltaResponse, response)
    let generatedData = await generateRandomDataByDays(startDate, endDate, 80, 400, 0.1, 0.05, 0, 'timestamp', 'earn')
    let responseData = generatedData.map(i => 
      {
        return {
          timestamp: i.timestamp
        }
      }
    )
    responseData = responseData.map((item, index) => {
      return {
        timestamp: item.timestamp,
        currencies: [
          {
            currencyNodeID: 'd366e616-8012-4290-aea8-b13cf6a0be90',
            absolute: {
              sources: [
                {
                  id: 'iapBought',
                  value: randomNumberInRange(1000, 10000),
                },
                {
                  id: 'levelSuccess',
                  value: randomNumberInRange(1000, 10000),
                },
                {
                  id: 'itemSold',
                  value: randomNumberInRange(100000, 150000),
                },
              ],
              sinks: [
                {
                  id: 'itemBought',
                  value: randomNumberInRange(-80000, -50000),
                }
              ]
            },
            perPlayer: {
              sources: [
                {
                  id: 'levelSuccess',
                  value: randomNumberInRange(1000, 2000),
                },
                {
                  id: 'itemSold',
                  value: randomNumberInRange(1000, 5000),
                },
              ],
              sinks: [
                {
                  id: 'itemBought',
                  value: randomNumberInRange(-8000, -2000),
                }
              ]
            }
          },
          {
            currencyNodeID: '99bd2cf7-110e-4a14-b7a3-aa597e84d534',
            absolute: {
              sources: [
                {
                  id: 'iapBought',
                  value: randomNumberInRange(100, 1000),
                },
                {
                  id: 'levelSuccess',
                  value: randomNumberInRange(100, 1000),
                },
                {
                  id: 'itemSold',
                  value: randomNumberInRange(10000, 15000),
                },
              ],
              sinks: [
                {
                  id: 'itemBought',
                  value: randomNumberInRange(-8000, -5000),
                }
              ]
            },
            perPlayer: {
              sources: [
                {
                  id: 'levelSuccess',
                  value: randomNumberInRange(100, 200),
                },
                {
                  id: 'itemSold',
                  value: randomNumberInRange(100, 500),
                },
              ],
              sinks: [
                {
                  id: 'itemBought',
                  value: randomNumberInRange(-800, -200),
                }
              ]
            }
          },
        ],
      }
    })
    


    if (true) {
      res.status(200).json({success: true, message: {data: responseData, granularity: 'day' }})
    } else{
      res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
    }

  } catch (error) {
    console.log(error)
    res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
  }


});
app.post('/api/analytics/getPaymentDriversOffers', async (req, res) => {
  const {gameID, branchName, filterDate, filterSegments} = req.body

  try {

    let offers = await Offers.aggregate([
      { $match: { gameID } }, 
      { $unwind: "$branches" }, 
      { $match: { "branches.branch": branchName } }, 
      { $unwind: "$branches.offers" }, 
      { $replaceRoot: { newRoot: `$branches.offers` } },
      { $project: { _id: 0, offerName: 1, offerIcon: 1, offerPrice: 1, content: 1 } }
    ]);

    let driverOffers = offers.filter(offer => offer.offerPrice.targetCurrency === 'entity')
    let driverOffersPriceEntities = driverOffers.map(offer => offer.offerPrice.nodeID)
    let currencyOffers = offers.filter(offer => offer.content.some(content => driverOffersPriceEntities.includes(content.nodeID)))
    
    let responseData = driverOffers.map(offer => ({driver: offer}))
    responseData = responseData.map((item, index) => {
      return {
        ...item,
        chainedPayments: randomNumberInRange(100, 10000),
        currencyOffer: currencyOffers.find(offer => offer.content.some(content => content.nodeID === item.driver.offerPrice.nodeID))
      }
    })


    if (true) {
      res.status(200).json({success: true, message: {data: responseData, granularity: 'day' }})
    } else{
      res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
    }

  } catch (error) {
    console.log(error)
    res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
  }
});
app.post('/api/analytics/getSourcesAndSinks', async (req, res) => {

  const {gameID, branchName, filterDate, filterSegments} = req.body

  try {

    const sources = ['missionReward', 'questReward', 'eventReward', 'inAppPurchase']
    const sinks = ['itemBought', 'itemUpgraded', 'characterUpgraded', 'secondLifeBought']

    const nodes = ['d366e616-8012-4290-aea8-b13cf6a0be90', '99bd2cf7-110e-4a14-b7a3-aa597e84d534']

    function getRandomNodeID() {
      return nodes[randomNumberInRange(0, nodes.length - 1)]
    }

    let icons = await fetchEntityIcons(gameID, branchName, nodes)

    let responseData = {
      sources: 
        sources.map(source => (
          {
            name: source,
            mean: randomNumberInRange(100, 1000),
            total: randomNumberInRange(100, 10000),
            players: randomNumberInRange(1000, 7000),
            currencyEntity: getRandomNodeID(),
            avgProfile: [
              {
                name: 'Game Level',
                value: '4',
                templateID: '1',
                players: 321,
                subProfiles: [
                  {
                    value: '3',
                    players: 120,
                  },
                  {
                    value: '2',
                    players: 56,
                  },
                  {
                    value: '1',
                    players: 21,
                  },
                ]
              },
              {
                name: 'Fav. Char',
                value: 'Leon',
                templateID: '2',
                players: 632,
                subProfiles: [
                  {
                    value: 'Shelly',
                    players: 120,
                  },
                  {
                    value: 'Bull',
                    players: 56,
                  },
                  {
                    value: 'Crow',
                    players: 21,
                  },
                ]
              },
              {
                name: 'Winrate',
                value: '64%',
                templateID: '3',
                players: 345,
                subProfiles: [
                  {
                    value: '63%',
                    players: 341,
                  },
                  {
                    value: '62%',
                    players: 334,
                  },
                  {
                    value: '61%',
                    players: 234,
                  },
                ]
              },
              {
                name: 'Retention',
                value: 'D0',
                templateID: '4',
                players: 1231,
                subProfiles: [
                  {
                    value: 'D3',
                    players: 120,
                  },
                  {
                    value: 'D2',
                    players: 56,
                  },
                  {
                    value: 'D1',
                    players: 21,
                  },
                ]
              },
              {
                name: 'Country',
                value: 'USA',
                templateID: '5',
                players: 1231,
                subProfiles: [
                  {
                    value: 'France',
                    players: 564,
                  },
                  {
                    value: 'Canada',
                    players: 341,
                  },
                  {
                    value: 'Germany',
                    players: 234,
                  },
                ]
              },
              {
                name: 'Total Summ Spent',
                value: '$34',
                templateID: '6',
                players: 561,
                subProfiles: [
                  {
                    value: '$54',
                    players: 120,
                  },
                  {
                    value: '$45',
                    players: 56,
                  },
                  {
                    value: '$76',
                    players: 21,
                  },
                ]
              },
              {
                name: 'IAP bought times',
                value: '1',
                templateID: '7',
                players: 456,
                subProfiles: [
                  {
                    value: '2',
                    players: 120,
                  },
                  {
                    value: '3',
                    players: 56,
                  },
                  {
                    value: '4',
                    players: 21,
                  },
                ]
              },
              {
                name: 'Segment',
                value: 'New player',
                templateID: '8',
                players: 2312,
                subProfiles: [
                ]
              },
            ],
          }
        ))
      ,
      sinks: 
        sinks.map(sinks => (
          {
            name: sinks,
            mean: randomNumberInRange(100, 1000),
            total: randomNumberInRange(100, 10000),
            players: randomNumberInRange(1000, 7000),
            currencyEntity: getRandomNodeID(),
            avgProfile: [
              {
                name: 'Game Level',
                value: '4',
                templateID: '1',
                players: 321,
                subProfiles: [
                  {
                    value: '3',
                    players: 120,
                  },
                  {
                    value: '2',
                    players: 56,
                  },
                  {
                    value: '1',
                    players: 21,
                  },
                ]
              },
              {
                name: 'Fav. Char',
                value: 'Leon',
                templateID: '2',
                players: 632,
                subProfiles: [
                  {
                    value: 'Shelly',
                    players: 120,
                  },
                  {
                    value: 'Bull',
                    players: 56,
                  },
                  {
                    value: 'Crow',
                    players: 21,
                  },
                ]
              },
              {
                name: 'Winrate',
                value: '64%',
                templateID: '3',
                players: 345,
                subProfiles: [
                  {
                    value: '63%',
                    players: 341,
                  },
                  {
                    value: '62%',
                    players: 334,
                  },
                  {
                    value: '61%',
                    players: 234,
                  },
                ]
              },
              {
                name: 'Retention',
                value: 'D0',
                templateID: '4',
                players: 1231,
                subProfiles: [
                  {
                    value: 'D3',
                    players: 120,
                  },
                  {
                    value: 'D2',
                    players: 56,
                  },
                  {
                    value: 'D1',
                    players: 21,
                  },
                ]
              },
              {
                name: 'Country',
                value: 'USA',
                templateID: '5',
                players: 1231,
                subProfiles: [
                  {
                    value: 'France',
                    players: 564,
                  },
                  {
                    value: 'Canada',
                    players: 341,
                  },
                  {
                    value: 'Germany',
                    players: 234,
                  },
                ]
              },
              {
                name: 'Total Summ Spent',
                value: '$34',
                templateID: '6',
                players: 561,
                subProfiles: [
                  {
                    value: '$54',
                    players: 120,
                  },
                  {
                    value: '$45',
                    players: 56,
                  },
                  {
                    value: '$76',
                    players: 21,
                  },
                ]
              },
              {
                name: 'IAP bought times',
                value: '1',
                templateID: '7',
                players: 456,
                subProfiles: [
                  {
                    value: '2',
                    players: 120,
                  },
                  {
                    value: '3',
                    players: 56,
                  },
                  {
                    value: '4',
                    players: 21,
                  },
                ]
              },
              {
                name: 'Segment',
                value: 'New player',
                templateID: '8',
                players: 2312,
                subProfiles: [
                ]
              },
            ],
          }
        ))
      ,
    }

    responseData = {
      sources: 
        responseData.sources.map(source => ({
          ...source,
          entityIcon: icons.find(n => n.nodeID === source.currencyEntity).icon,
        })),
      sinks: 
        responseData.sinks.map(sink => ({
          ...sink,
          entityIcon: icons.find(n => n.nodeID === sink.currencyEntity).icon,
        })),
    }

    if (true) {
      res.status(200).json({success: true, data: responseData})
    } else{
      res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
    }

  } catch (error) {
    console.log(error)
    res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
  }
});
//
// Analytics Dashboard - User Acquisition
//
app.post('/api/analytics/getInstallsByCountry', async (req, res) => {
  const {gameID, branchName, filterDate, filterSegments} = req.body

  try {

    const endDate = new Date(filterDate[1])
    const startDate = new Date(filterDate[0])


    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(23, 59, 59, 999);

    // Get difference between dates in milliseconds
    const dateDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);

    // Getting date for delta response, so if we get a query for "today" data, we get it and delta between today and yesterday.
    // If we get a data for this month, we will get delta for the previous month.
    const deltaEndDate = new Date(startDate)
    deltaEndDate.setDate(startDate.getDate() - 1)

    const deltaStartDate = new Date(startDate)
    deltaStartDate.setDate(startDate.getDate() - (dateDiff + 1))

    deltaStartDate.setUTCHours(0, 0, 0, 0);
    deltaEndDate.setUTCHours(23, 59, 59, 999);

    const deltaDateDiff = (deltaEndDate - deltaStartDate) / (1000 * 60 * 60 * 24);

    let clientIDs = []

    if (filterSegments && filterSegments.length !== 0) {
      clientIDs = await getPlayersFromSegment(gameID, branchName, filterSegments)
    }
    // const deltaResponse = await druidLib.getSessionLength(gameID, branchName, deltaStartDate, deltaEndDate, deltaDateDiff, clientIDs)
    // const response = await druidLib.getSessionLength(gameID, branchName, startDate, endDate, dateDiff, clientIDs)

    // const deltaValue = calculateDelta(deltaResponse, response)
    const responseData = [
      {
        countryName: 'Russia',
        installs: {
          admob: randomNumberInRange(100, 1000),
          applovin: randomNumberInRange(100, 1000),
          ironsource: randomNumberInRange(100, 1000),
          unityads: randomNumberInRange(100, 1000),
        }
      },
      {
        countryName: 'Japan',
        installs: {
          admob: randomNumberInRange(100, 1000),
          applovin: randomNumberInRange(100, 1000),
          ironsource: randomNumberInRange(100, 1000),
          unityads: randomNumberInRange(100, 1000),
        }
      },
      {
        countryName: 'United States',
        installs: {
          admob: randomNumberInRange(100, 1000),
          applovin: randomNumberInRange(100, 1000),
          ironsource: randomNumberInRange(100, 1000),
          unityads: randomNumberInRange(100, 1000),
        }
      },
      {
        countryName: 'France',
        installs: {
          admob: randomNumberInRange(100, 1000),
          applovin: randomNumberInRange(100, 1000),
          ironsource: randomNumberInRange(100, 1000),
          unityads: randomNumberInRange(100, 1000),
        }
      },
      {
        countryName: 'Italy',
        installs: {
          admob: randomNumberInRange(100, 1000),
          applovin: randomNumberInRange(100, 1000),
          ironsource: randomNumberInRange(100, 1000),
          unityads: randomNumberInRange(100, 1000),
        }
      },
      {
        countryName: 'Switzerland',
        installs: {
          admob: randomNumberInRange(100, 1000),
          applovin: randomNumberInRange(100, 1000),
          ironsource: randomNumberInRange(100, 1000),
          unityads: randomNumberInRange(100, 1000),
        }
      },
      {
        countryName: 'China',
        installs: {
          admob: randomNumberInRange(100, 1000),
          applovin: randomNumberInRange(100, 1000),
          ironsource: randomNumberInRange(100, 1000),
          unityads: randomNumberInRange(100, 1000),
        }
      },
      {
        countryName: 'Germany',
        installs: {
          admob: randomNumberInRange(100, 1000),
          applovin: randomNumberInRange(100, 1000),
          ironsource: randomNumberInRange(100, 1000),
          unityads: randomNumberInRange(100, 1000),
        }
      },
      {
        countryName: 'Australia',
        installs: {
          admob: randomNumberInRange(100, 1000),
          applovin: randomNumberInRange(100, 1000),
          ironsource: randomNumberInRange(100, 1000),
          unityads: randomNumberInRange(100, 1000),
        }
      },
      {
        countryName: 'New Zealand',
        installs: {
          admob: randomNumberInRange(100, 1000),
          applovin: randomNumberInRange(100, 1000),
          ironsource: randomNumberInRange(100, 1000),
          unityads: randomNumberInRange(100, 1000),
        }
      },
    ]

    res.status(200).json({success: true, message: {data: responseData, granularity: 'day', networks: ['admob', 'applovin', 'ironsource', 'unityads']}})

    // if (response.success) {
    //   res.status(200).json({success: true, message: {data: response.data, granularity: response.granularity, deltaValue: deltaValue}})
    // } else{
    //   res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
    // }

  } catch (error) {
    console.log(error)
    res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
  }


});
app.post('/api/analytics/getUARetention', async (req, res) => {
  const {gameID, branchName, filterDate, filterSegments} = req.body

  try {

    const endDate = new Date(filterDate[1])
    const startDate = new Date(filterDate[0])


    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(23, 59, 59, 999);

    // Get difference between dates in milliseconds
    const dateDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);

    // Getting date for delta response, so if we get a query for "today" data, we get it and delta between today and yesterday.
    // If we get a data for this month, we will get delta for the previous month.
    const deltaEndDate = new Date(startDate)
    deltaEndDate.setDate(startDate.getDate() - 1)

    const deltaStartDate = new Date(startDate)
    deltaStartDate.setDate(startDate.getDate() - (dateDiff + 1))

    deltaStartDate.setUTCHours(0, 0, 0, 0);
    deltaEndDate.setUTCHours(23, 59, 59, 999);

    const deltaDateDiff = (deltaEndDate - deltaStartDate) / (1000 * 60 * 60 * 24);

    let clientIDs = []

    if (filterSegments && filterSegments.length !== 0) {
      clientIDs = await getPlayersFromSegment(gameID, branchName, filterSegments)
    }
    // const deltaResponse = await druidLib.getSessionLength(gameID, branchName, deltaStartDate, deltaEndDate, deltaDateDiff, clientIDs)
    // const response = await druidLib.getSessionLength(gameID, branchName, startDate, endDate, dateDiff, clientIDs)

    // const deltaValue = calculateDelta(deltaResponse, response)
    const responseData = [
      {
        countryName: 'Russia',
        installs: {
          organic: 4812,
          admob: 111,
          applovin: 111,
          ironsource: 111,
          unityads: 444,
        },
        retention: {
          organic: {
            d1: 100,
            d3: 50,
            d7: 5
          },
          admob: {
            d1: 100,
            d3: 50,
            d7: 5
          },
          applovin: {
            d1: 100,
            d3: 50,
            d7: 5
          },
          ironsource: {
            d1: 100,
            d3: 50,
            d7: 5
          },
          unityads: {
            d1: 100,
            d3: 50,
            d7: 5
          },
        }
      },
      {
        countryName: 'Japan',
        installs: {
          organic: 4812,
          admob: 3223,
          applovin: 111,
          ironsource: 222,
          unityads: 222,
        },
        retention: {
          organic: {
            d1: 100,
            d3: 50,
            d7: 5
          },
          admob: {
            d1: 100,
            d3: 50,
            d7: 5
          },
          applovin: {
            d1: 100,
            d3: 50,
            d7: 5
          },
          ironsource: {
            d1: 100,
            d3: 50,
            d7: 5
          },
          unityads: {
            d1: 100,
            d3: 50,
            d7: 5
          },
        }
      },
      {
        countryName: 'United States',
        installs: {
          organic: 421,
          admob: 111,
          applovin: 2,
          ironsource: 2,
          unityads: 444,
        },
        retention: {
          organic: {
            d1: 222,
            d3: 50,
            d7: 5
          },
          admob: {
            d1: 100,
            d3: 50,
            d7: 5
          },
          applovin: {
            d1: 100,
            d3: 50,
            d7: 5
          },
          ironsource: {
            d1: 123,
            d3: 50,
            d7: 5
          },
          unityads: {
            d1: 122,
            d3: 22,
            d7: 5
          },
        }
      },
      {
        countryName: 'France',
        installs: {
          organic: 4211,
          admob: 12,
          applovin: 300,
          ironsource: 0,
          unityads: 11,
        },
        retention: {
          organic: {
            d1: 0,
            d3: 50,
            d7: 5
          },
          admob: {
            d1: 0,
            d3: 50,
            d7: 5
          },
          applovin: {
            d1: 23,
            d3: 50,
            d7: 5
          },
          ironsource: {
            d1: 100,
            d3: 50,
            d7: 5
          },
          unityads: {
            d1: 11,
            d3: 33,
            d7: 3636
          },
        }
      },
      {
        countryName: 'Italy',
        installs: {
          organic: 12111,
          admob: 111,
          applovin: 222,
          ironsource: 333,
          unityads: 444,
        },
        retention: {
          organic: {
            d1: 100,
            d3: 50,
            d7: 5
          },
          admob: {
            d1: 366,
            d3: 366,
            d7: 5
          },
          applovin: {
            d1: 3446,
            d3: 34,
            d7: 5
          },
          ironsource: {
            d1: 33,
            d3: 346,
            d7: 5
          },
          unityads: {
            d1: 100,
            d3: 50,
            d7: 346
          },
        }
      },
      {
        countryName: 'Switzerland',
        installs: {
          organic: 7543,
          admob: 111,
          applovin: 222,
          ironsource: 333,
          unityads: 444,
        },
        retention: {
          organic: {
            d1: 457,
            d3: 33,
            d7: 5
          },
          admob: {
            d1: 18,
            d3: 1212,
            d7: 222
          },
          applovin: {
            d1: 12,
            d3: 222,
            d7: 1
          },
          ironsource: {
            d1: 100,
            d3: 50,
            d7: 5
          },
          unityads: {
            d1: 555,
            d3: 12,
            d7: 1
          },
        }
      },
      {
        countryName: 'China',
        installs: {
          organic: 2,
          admob: 111,
          applovin: 222,
          ironsource: 333,
          unityads: 444,
        },
        retention: {
          organic: {
            d1: 100,
            d3: 21,
            d7: 21
          },
          admob: {
            d1: 100,
            d3: 50,
            d7: 121
          },
          applovin: {
            d1: 111,
            d3: 12,
            d7: 555
          },
          ironsource: {
            d1: 252,
            d3: 50,
            d7: 5
          },
          unityads: {
            d1: 11,
            d3: 50,
            d7: 5
          },
        }
      },
      {
        countryName: 'Germany',
        installs: {
          organic: 123,
          admob: 111,
          applovin: 222,
          ironsource: 333,
          unityads: 444,
        },
        retention: {
          organic: {
            d1: 25,
            d3: 50,
            d7: 5
          },
          admob: {
            d1: 25,
            d3: 50,
            d7: 5
          },
          applovin: {
            d1: 1000,
            d3: 50,
            d7: 5
          },
          ironsource: {
            d1: 100,
            d3: 50,
            d7: 5
          },
          unityads: {
            d1: 100,
            d3: 50,
            d7: 5
          },
        }
      },
      {
        countryName: 'Australia',
        installs: {
          organic: 1111,
          admob: 111,
          applovin: 222,
          ironsource: 333,
          unityads: 444,
        },
        retention: {
          organic: {
            d1: 100,
            d3: 50,
            d7: 5
          },
          admob: {
            d1: 100,
            d3: 50,
            d7: 5
          },
          applovin: {
            d1: 100,
            d3: 50,
            d7: 5
          },
          ironsource: {
            d1: 100,
            d3: 50,
            d7: 5
          },
          unityads: {
            d1: 100,
            d3: 50,
            d7: 5
          },
        }

      },
      {
        countryName: 'New Zealand',
        installs: {
          organic: 2122,
          admob: 111,
          applovin: 222,
          ironsource: 333,
          unityads: 444,
        },
        retention: {
          organic: {
            d1: 100,
            d3: 50,
            d7: 5
          },
          admob: {
            d1: 100,
            d3: 50,
            d7: 5
          },
          applovin: {
            d1: 100,
            d3: 50,
            d7: 5
          },
          ironsource: {
            d1: 100,
            d3: 50,
            d7: 5
          },
          unityads: {
            d1: 300,
            d3: 25,
            d7: 2
          },
        }
      },
    ]

    res.status(200).json({success: true, message: {data: responseData, granularity: 'day', networks: ['organic', 'admob', 'applovin', 'ironsource', 'unityads']}})

    // if (response.success) {
    //   res.status(200).json({success: true, message: {data: response.data, granularity: response.granularity, deltaValue: deltaValue}})
    // } else{
    //   res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
    // }

  } catch (error) {
    console.log(error)
    res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
  }


});
app.post('/api/analytics/getAdPerformance', async (req, res) => {
  const {gameID, branchName, filterDate, filterSegments} = req.body

  try {

    const endDate = new Date(filterDate[1])
    const startDate = new Date(filterDate[0])


    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(23, 59, 59, 999);

    // Get difference between dates in milliseconds
    const dateDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);

    // Getting date for delta response, so if we get a query for "today" data, we get it and delta between today and yesterday.
    // If we get a data for this month, we will get delta for the previous month.
    const deltaEndDate = new Date(startDate)
    deltaEndDate.setDate(startDate.getDate() - 1)

    const deltaStartDate = new Date(startDate)
    deltaStartDate.setDate(startDate.getDate() - (dateDiff + 1))

    deltaStartDate.setUTCHours(0, 0, 0, 0);
    deltaEndDate.setUTCHours(23, 59, 59, 999);

    const deltaDateDiff = (deltaEndDate - deltaStartDate) / (1000 * 60 * 60 * 24);

    let clientIDs = []

    if (filterSegments && filterSegments.length !== 0) {
      clientIDs = await getPlayersFromSegment(gameID, branchName, filterSegments)
    }
    // const deltaResponse = await druidLib.getSessionLength(gameID, branchName, deltaStartDate, deltaEndDate, deltaDateDiff, clientIDs)
    // const response = await druidLib.getSessionLength(gameID, branchName, startDate, endDate, dateDiff, clientIDs)

    // const deltaValue = calculateDelta(deltaResponse, response)
    const responseData = [
      {
        networkName: 'admob',
        installs: randomNumberInRange(100, 1000),
        cpi: '1.32',
        costs: `${randomNumberInRange(1000, 5000)}.00`,
        payingshare: '2.21',
        arpu: '1.21',
        revenue: '52285.00',
        roi: `${randomNumberInRange(1, 100)}.${randomNumberInRange(1, 100)}`,
      },
      {
        networkName: 'adcolony',
        installs: randomNumberInRange(100, 1000),
        cpi: '1.11',
        costs: `${randomNumberInRange(1000, 5000)}.00`,
        payingshare: '2.21',
        arpu: '1.21',
        revenue: '52285.00',
        roi: `${randomNumberInRange(1, 100)}.${randomNumberInRange(1, 100)}`,
      },
      {
        networkName: 'unityads',
        installs: randomNumberInRange(100, 1000),
        cpi: '1.56',
        costs: `${randomNumberInRange(1000, 5000)}.00`,
        payingshare: '2.21',
        arpu: '1.21',
        revenue: '52285.00',
        roi: `${randomNumberInRange(1, 100)}.${randomNumberInRange(1, 100)}`,
      },
      {
        networkName: 'ironsource',
        installs: randomNumberInRange(100, 1000),
        cpi: '0.67',
        costs: `${randomNumberInRange(1000, 5000)}.00`,
        payingshare: '2.21',
        arpu: '1.21',
        revenue: '52285.00',
        roi: `${randomNumberInRange(1, 100)}.${randomNumberInRange(1, 100)}`,
      },
      {
        networkName: 'applovin',
        installs: randomNumberInRange(100, 1000),
        cpi: '0.98',
        costs: `${randomNumberInRange(1000, 5000)}.00`,
        payingshare: '2.21',
        arpu: '1.21',
        revenue: '52285.00',
        roi: `${randomNumberInRange(1, 100)}.${randomNumberInRange(1, 100)}`,
      },
      {
        networkName: 'fyber',
        installs: randomNumberInRange(100, 1000),
        cpi: '2.02',
        costs: `${randomNumberInRange(1000, 5000)}.00`,
        payingshare: '2.21',
        arpu: '1.21',
        revenue: '52285.00',
        roi: `${randomNumberInRange(1, 100)}.${randomNumberInRange(1, 100)}`,
      },
      {
        networkName: 'facebook',
        installs: randomNumberInRange(100, 1000),
        cpi: '1.23',
        costs: `${randomNumberInRange(1000, 5000)}.00`,
        payingshare: '2.21',
        arpu: '1.21',
        revenue: '52285.00',
        roi: `${randomNumberInRange(1, 100)}.${randomNumberInRange(1, 100)}`,
      },
    ]

    res.status(200).json({success: true, message: {data: responseData, granularity: 'day', networks: ['admob', 'ironsource', 'unityads', 'adcolony', 'applovin', 'fyber', 'facebook']}})

    // if (response.success) {
    //   res.status(200).json({success: true, message: {data: response.data, granularity: response.granularity, deltaValue: deltaValue}})
    // } else{
    //   res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
    // }

  } catch (error) {
    console.log(error)
    res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
  }


});
//
// Analytics Dashboard - Ads
//
app.post('/api/analytics/getAdsRevenue', async (req, res) => {
  const {gameID, branchName, filterDate, filterSegments} = req.body

  try {

    const endDate = new Date(filterDate[1])
    const startDate = new Date(filterDate[0])


    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(23, 59, 59, 999);

    // Get difference between dates in milliseconds
    const dateDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);

    // Getting date for delta response, so if we get a query for "today" data, we get it and delta between today and yesterday.
    // If we get a data for this month, we will get delta for the previous month.
    const deltaEndDate = new Date(startDate)
    deltaEndDate.setDate(startDate.getDate() - 1)

    const deltaStartDate = new Date(startDate)
    deltaStartDate.setDate(startDate.getDate() - (dateDiff + 1))

    deltaStartDate.setUTCHours(0, 0, 0, 0);
    deltaEndDate.setUTCHours(23, 59, 59, 999);

    const deltaDateDiff = (deltaEndDate - deltaStartDate) / (1000 * 60 * 60 * 24);

    let clientIDs = []

    if (filterSegments && filterSegments.length !== 0) {
      clientIDs = await getPlayersFromSegment(gameID, branchName, filterSegments)
    }
    // const deltaResponse = await druidLib.getSessionLength(gameID, branchName, deltaStartDate, deltaEndDate, deltaDateDiff, clientIDs)
    // const response = await druidLib.getSessionLength(gameID, branchName, startDate, endDate, dateDiff, clientIDs)

    // const deltaValue = calculateDelta(deltaResponse, response)
    const responseData = [
      {
        countryName: 'Russia',
        revenue: {
          admob: 111,
          applovin: 111,
          ironsource: 111,
          unityads: 444,
        }
      },
      {
        countryName: 'Japan',
        revenue: {
          admob: 3223,
          applovin: 111,
          ironsource: 222,
          unityads: 222,
        }
      },
      {
        countryName: 'United States',
        revenue: {
          admob: 111,
          applovin: 2,
          ironsource: 2,
          unityads: 444,
        }
      },
      {
        countryName: 'France',
        revenue: {
          admob: 12,
          applovin: 300,
          ironsource: 0,
          unityads: 11,
        }
      },
      {
        countryName: 'Italy',
        revenue: {
          admob: 111,
          applovin: 222,
          ironsource: 333,
          unityads: 444,
        }
      },
      {
        countryName: 'Switzerland',
        revenue: {
          admob: 111,
          applovin: 222,
          ironsource: 333,
          unityads: 444,
        }
      },
      {
        countryName: 'China',
        revenue: {
          admob: 111,
          applovin: 222,
          ironsource: 333,
          unityads: 444,
        }
      },
      {
        countryName: 'Germany',
        revenue: {
          admob: 111,
          applovin: 222,
          ironsource: 333,
          unityads: 444,
        }
      },
      {
        countryName: 'Australia',
        revenue: {
          admob: 111,
          applovin: 222,
          ironsource: 333,
          unityads: 444,
        }
      },
      {
        countryName: 'New Zealand',
        revenue: {
          admob: 111,
          applovin: 222,
          ironsource: 333,
          unityads: 444,
        }
      },
    ]

    res.status(200).json({success: true, message: {data: responseData, granularity: 'day', networks: ['admob', 'applovin', 'ironsource', 'unityads']}})

    // if (response.success) {
    //   res.status(200).json({success: true, message: {data: response.data, granularity: response.granularity, deltaValue: deltaValue}})
    // } else{
    //   res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
    // }

  } catch (error) {
    console.log(error)
    res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
  }


});


let cachedWarehousePlayers = []
async function cachePlayers(gameID, branchName) {

  const playerWarehouse = await PWplayers.find(
    { gameID, branch: branchName },
  ).lean();
  if (!playerWarehouse) {
    return
  }
  cachedWarehousePlayers = playerWarehouse.map(player => ({
    ...player,
    elements: [].concat(player.elements.analytics).concat(player.elements.statistics)
  }))
  console.log('Cached players')
}


app.post('/api/analytics/getProfileComposition', async (req, res) => {
  const {
    gameID, branchName, 
    
    // Filtering
    baseSegment, filters, 

    // Bubble chart
    element1, element2, element3,

  } = req.body

  try {

    // We need to get the playerCount for the base segment to calculate the sample size
    // before querying the database
    let segmentCount = await Segments.findOne({ gameID, 'branches.branch': branchName })
    segmentCount = segmentCount.branches
    .find(b => b.branch === branchName).segments
    .find(s => s.segmentID === baseSegment)?.segmentPlayerCount
    if (segmentCount == undefined) {
      segmentCount = 0
    }

    // Calculating the sample size
    let sampleSize = getSampleSize(segmentCount, 0.999)

    // Getting templates so we can build the query
    let warehouseTemplates = await PWtemplates.findOne({gameID, 'branches.branch': branchName})
    warehouseTemplates = warehouseTemplates.branches.find(b => b.branch === branchName).templates

    function getTemplateType(templateID) {
      if (warehouseTemplates.analytics.some(t => t.templateID === templateID)) {
        return 'analytics'
      } else if (warehouseTemplates.statistics.some(t => t.templateID === templateID)) {
        return 'statistics'
      } else {
        return null
      }
    }

    async function buildQuery() {
      const queryConditions = [];
    
      for (const filter of filters) {
        if (filter.condition) {
          if (filter.condition === 'and') {
            queryConditions.push({ $and: [] });
          } else if (filter.condition === 'or') {
            queryConditions.push({ $or: [] });
          }
        } else {
          const targetElementPath = `elements.${getTemplateType(filter.templateID)}.elementID`;
          const targetValuePath = `elements.${getTemplateType(filter.templateID)}.elementValue`;
    
          let condition = {};
          let formattedValue = filter.filterValue;
          switch (filter.filterCondition) {
            case 'is':
              formattedValue = filter.filterValue.toString()
              condition = { [`elements.${getTemplateType(filter.templateID)}`]: { $elemMatch: { elementID: filter.templateID, elementValue: formattedValue } } };
              break;
            case 'is not':
              formattedValue = filter.filterValue.toString()
              condition = { [`elements.${getTemplateType(filter.templateID)}`]: { $elemMatch: { elementID: filter.templateID, elementValue: { $ne: formattedValue } } } };
              break;
            case 'contains':
              formattedValue = filter.filterValue.toString()
              condition = { [`elements.${getTemplateType(filter.templateID)}`]: { $elemMatch: { elementID: filter.templateID, elementValue: { $regex: formattedValue, $options: 'i' } } } };
              break;
            case 'starts with':
              formattedValue = filter.filterValue.toString()
              condition = { [`elements.${getTemplateType(filter.templateID)}`]: { $elemMatch: { elementID: filter.templateID, elementValue: { $regex: `^${formattedValue}`, $options: 'i' } } } };
              break;
            case 'ends with':
              formattedValue = filter.filterValue.toString()
              condition = { [`elements.${getTemplateType(filter.templateID)}`]: { $elemMatch: { elementID: filter.templateID, elementValue: { $regex: `${formattedValue}$`, $options: 'i' } } } };
              break;
            case '>':
              formattedValue = parseFloat(filter.filterValue)
              condition = { [`elements.${getTemplateType(filter.templateID)}`]: { $elemMatch: { elementID: filter.templateID, elementValue: { $gt: formattedValue } } } };
              break;
            case '<':
              formattedValue = parseFloat(filter.filterValue)
              condition = { [`elements.${getTemplateType(filter.templateID)}`]: { $elemMatch: { elementID: filter.templateID, elementValue: { $lt: formattedValue } } } };
              break;
            case '>=':
              formattedValue = parseFloat(filter.filterValue)
              condition = { [`elements.${getTemplateType(filter.templateID)}`]: { $elemMatch: { elementID: filter.templateID, elementValue: { $gte: formattedValue } } } };
              break;
            case '<=':
              formattedValue = parseFloat(filter.filterValue)
              condition = { [`elements.${getTemplateType(filter.templateID)}`]: { $elemMatch: { elementID: filter.templateID, elementValue: { $lte: formattedValue } } } };
              break;
            case '=': 
              formattedValue = parseFloat(filter.filterValue)
              condition = { [`elements.${getTemplateType(filter.templateID)}`]: { $elemMatch: { elementID: filter.templateID, elementValue: formattedValue } } };
              break;
            case '!=':
              formattedValue = parseFloat(filter.filterValue)
              condition = { [`elements.${getTemplateType(filter.templateID)}`]: { $elemMatch: { elementID: filter.templateID, elementValue: { $ne: formattedValue } } } };
              break;
            case 'dateRange':
              const [startDate, endDate] = filter.filterValue.map(date => new Date(date));
              condition = { 'elements.analytics': { $elemMatch: { elementID: filter.templateID, elementValue: { $gte: startDate, $lte: endDate } } } };
              break;
            default:
              continue;
          }
          
          if (queryConditions.length > 0 && queryConditions[queryConditions.length - 1].$and) {
            queryConditions[queryConditions.length - 1].$and.push(condition);
          } else if (queryConditions.length > 0 && queryConditions[queryConditions.length - 1].$or) {
            queryConditions[queryConditions.length - 1].$or.push(condition);
          } else {
            queryConditions.push(condition);
          }
        }
      }
      
      const baseSegmentFilter = {
        ['segments']: { $in: [baseSegment] }
      }
      const defaultQuery = {
        gameID, 
        branch: branchName,
      }

      return { $and: [defaultQuery, baseSegmentFilter, ...queryConditions] };
    }
    const query = await buildQuery()

    // Finding the total count of filtered players
    const totalCount = await PWplayers.find(query).count()
    // console.log('totalCount', totalCount)

    // Making the sample
    let players
    players = await PWplayers.find(query).limit(sampleSize).lean()


  function getSampleSize(totalSampleSize, confidenceLevel) {
    const n = totalSampleSize;

    const expectedProportion = 0.5;
    const marginOfError = 0.05;

    const z = confidenceLevel === 0.95 ? 1.96 : 2.58;

    function clamp(value, min, max) {
      return Math.min(Math.max(value, min), max);
    }

    let sampleSize = Math.ceil(Math.pow((z * Math.sqrt(expectedProportion * (1 - expectedProportion))) / marginOfError, 2));
    sampleSize = clamp(sampleSize, 1, n);

    return sampleSize;
  }

  if (players && players.length > 0) {
    players = players.map(p => {
      return {
        ...p,
        elements: [].concat(p.elements.analytics).concat(p.elements.statistics)
      }
    })
  }



  res.status(200).json({ success: true, composition: totalCount, sample: players });

  } catch (error) {
    console.log(error)
    res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
  }
});

app.post('/api/getProfileCompositionPreset', async (req, res) => {
  const { gameID, branchName } = req.body
  try {
    const charts = await CustomCharts.findOne({ gameID, 'branches.branch': branchName })
    if (!charts) {
      return res.status(404).json({ success: false, message: 'Charts not found' })
    }
    let branch = charts.branches.find(b => b.branch === branchName)
    if (branch.profileCompositionPresets !== undefined && branch.profileCompositionPresets !== '') {
      branch.profileCompositionPresets = JSON.parse(branch.profileCompositionPresets)
      res.status(200).json({ success: true, message: { presets: branch.profileCompositionPresets } })
    } else {
      res.status(200).json({ success: true, message: { presets: [] } })
    }

  } catch (error) {
    console.log(error)
    res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
  }
});
app.post('/api/setProfileCompositionPreset', async (req, res) => {
  const { gameID, branchName, presets = [] } = req.body
  try {
    const result = await CustomCharts.findOneAndUpdate(
      { gameID, 'branches.branch': branchName },
      { $set: { 'branches.$.profileCompositionPresets': JSON.stringify(presets) } }
    );
    if (!result) {
      return res.status(404).json({ success: false, message: 'Charts not found' });
    }

    res.status(200).json({ success: true, message: 'Profile composition preset set' })
  } catch (error) {
    console.log(error)
    res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
  }
});

app.post('/api/analytics/getAdsRevenuePerType', async (req, res) => {
  const {gameID, branchName, filterDate, filterSegments} = req.body

  try {

    const endDate = new Date(filterDate[1])
    const startDate = new Date(filterDate[0])


    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(23, 59, 59, 999);

    // Get difference between dates in milliseconds
    const dateDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);

    // Getting date for delta response, so if we get a query for "today" data, we get it and delta between today and yesterday.
    // If we get a data for this month, we will get delta for the previous month.
    const deltaEndDate = new Date(startDate)
    deltaEndDate.setDate(startDate.getDate() - 1)

    const deltaStartDate = new Date(startDate)
    deltaStartDate.setDate(startDate.getDate() - (dateDiff + 1))

    deltaStartDate.setUTCHours(0, 0, 0, 0);
    deltaEndDate.setUTCHours(23, 59, 59, 999);

    const deltaDateDiff = (deltaEndDate - deltaStartDate) / (1000 * 60 * 60 * 24);

    let clientIDs = []

    if (filterSegments && filterSegments.length !== 0) {
      clientIDs = await getPlayersFromSegment(gameID, branchName, filterSegments)
    }
    // const deltaResponse = await druidLib.getSessionLength(gameID, branchName, deltaStartDate, deltaEndDate, deltaDateDiff, clientIDs)
    // const response = await druidLib.getSessionLength(gameID, branchName, startDate, endDate, dateDiff, clientIDs)

    // const deltaValue = calculateDelta(deltaResponse, response)
    const responseData = [
      {
        networkName: 'admob',
        revenue: {
          interstitial: 48312,
          rewarded: 12131,
          banner: 442
        }
      },
      {
        networkName: 'applovin',
        revenue: {
          interstitial: 4812,
          rewarded: 422,
          banner: 6
        }
      },
      {
        networkName: 'ironsource',
        revenue: {
          interstitial: 512,
          rewarded: 5555,
          banner: 12
        }
      },
      {
        networkName: 'unityads',
        revenue: {
          interstitial: 211,
          rewarded: 566,
          banner: 531
        }
      },
    ]

    res.status(200).json({success: true, message: {data: responseData, granularity: 'day', networks: ['admob', 'applovin', 'ironsource', 'unityads']}})

    // if (response.success) {
    //   res.status(200).json({success: true, message: {data: response.data, granularity: response.granularity, deltaValue: deltaValue}})
    // } else{
    //   res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
    // }

  } catch (error) {
    console.log(error)
    res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
  }


});
app.post('/api/analytics/getAdsImpressionsDetailed', async (req, res) => {
  const {gameID, branchName, filterDate, filterSegments} = req.body

  try {

    const endDate = new Date(filterDate[1])
    const startDate = new Date(filterDate[0])


    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(23, 59, 59, 999);

    // Get difference between dates in milliseconds
    const dateDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);

    // Getting date for delta response, so if we get a query for "today" data, we get it and delta between today and yesterday.
    // If we get a data for this month, we will get delta for the previous month.
    const deltaEndDate = new Date(startDate)
    deltaEndDate.setDate(startDate.getDate() - 1)

    const deltaStartDate = new Date(startDate)
    deltaStartDate.setDate(startDate.getDate() - (dateDiff + 1))

    deltaStartDate.setUTCHours(0, 0, 0, 0);
    deltaEndDate.setUTCHours(23, 59, 59, 999);

    const deltaDateDiff = (deltaEndDate - deltaStartDate) / (1000 * 60 * 60 * 24);

    let clientIDs = []

    if (filterSegments && filterSegments.length !== 0) {
      clientIDs = await getPlayersFromSegment(gameID, branchName, filterSegments)
    }
    // const deltaResponse = await druidLib.getSessionLength(gameID, branchName, deltaStartDate, deltaEndDate, deltaDateDiff, clientIDs)
    // const response = await druidLib.getSessionLength(gameID, branchName, startDate, endDate, dateDiff, clientIDs)

    // const deltaValue = calculateDelta(deltaResponse, response)
    const responseData = [
      {
        networkName: 'admob',
        impressions: {
          interstitial: 48312,
          rewarded: 12131,
          banner: 442
        },
        impressionsPerType: {
          perUser: {
            interstitial: 48312,
            rewarded: 12131,
            banner: 442
          },
          perSession: {
            interstitial: 48312,
            rewarded: 12131,
            banner: 442
          },
        },
        ctr: {
          interstitial: 123,
          rewarded: 321,
          banner: 2
        },
      },
      {
        networkName: 'applovin',
        impressions: {
          interstitial: 48312,
          rewarded: 12131,
          banner: 442
        },
        impressionsPerType: {
          perUser: {
            interstitial: 48312,
            rewarded: 12131,
            banner: 442
          },
          perSession: {
            interstitial: 48312,
            rewarded: 12131,
            banner: 442
          },
        },
        ctr: {
          interstitial: 123,
          rewarded: 321,
          banner: 2
        },
      },
      {
        networkName: 'ironsource',
        impressions: {
          interstitial: 48312,
          rewarded: 12131,
          banner: 442
        },
        impressionsPerType: {
          perUser: {
            interstitial: 48312,
            rewarded: 12131,
            banner: 442
          },
          perSession: {
            interstitial: 48312,
            rewarded: 12131,
            banner: 442
          },
        },
        ctr: {
          interstitial: 123,
          rewarded: 321,
          banner: 2
        },
      },
      {
        networkName: 'unityads',
        impressions: {
          interstitial: 48312,
          rewarded: 12131,
          banner: 442
        },
        impressionsPerType: {
          perUser: {
            interstitial: 48312,
            rewarded: 12131,
            banner: 442
          },
          perSession: {
            interstitial: 48312,
            rewarded: 12131,
            banner: 442
          },
        },
        ctr: {
          interstitial: 123,
          rewarded: 321,
          banner: 2
        },
      },
    ]

    res.status(200).json({success: true, message: {data: responseData, granularity: 'day', networks: ['admob', 'applovin', 'ironsource', 'unityads']}})

    // if (response.success) {
    //   res.status(200).json({success: true, message: {data: response.data, granularity: response.granularity, deltaValue: deltaValue}})
    // } else{
    //   res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
    // }

  } catch (error) {
    console.log(error)
    res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
  }


});
app.post('/api/analytics/getOffersDataTableWithProfile', async (req, res) => {
  const { gameID, branch, filterDate, filterSegments, priceType } = req.body;

  try {
    let offers = await Offers.aggregate([
        { $match: { gameID } }, 
        { $unwind: "$branches" }, 
        { $match: { "branches.branch": branch } }, 
        { $unwind: "$branches.offers" }, 
        { $replaceRoot: { newRoot: `$branches.offers` } },
        { $project: { _id: 0, offerName: 1, offerIcon: 1, offerPrice: 1 } }
    ]);

    offers = offers.filter(offer => offer.offerPrice.targetCurrency === priceType)

    offers = offers.map(offer => {
      let temp = {
        ...offer,
        sales: priceType === 'entity' ? randomNumberInRange(1000, 10000)*130 : randomNumberInRange(1000, 10000),
        revenue: priceType === 'entity' ? randomNumberInRange(1000, 10000)*600 : randomNumberInRange(2000, 10000),
        avgProfile: [
          {
            name: 'Game Level',
            value: '4',
            templateID: '1',
            players: 321,
            subProfiles: [
              {
                value: '3',
                players: 120,
              },
              {
                value: '2',
                players: 56,
              },
              {
                value: '1',
                players: 21,
              },
            ]
          },
          {
            name: 'Fav. Char',
            value: 'Leon',
            templateID: '2',
            players: 632,
            subProfiles: [
              {
                value: 'Shelly',
                players: 120,
              },
              {
                value: 'Bull',
                players: 56,
              },
              {
                value: 'Crow',
                players: 21,
              },
            ]
          },
          {
            name: 'Winrate',
            value: '64%',
            templateID: '3',
            players: 345,
            subProfiles: [
              {
                value: '63%',
                players: 341,
              },
              {
                value: '62%',
                players: 334,
              },
              {
                value: '61%',
                players: 234,
              },
            ]
          },
          {
            name: 'Retention',
            value: 'D0',
            templateID: '4',
            players: 1231,
            subProfiles: [
              {
                value: 'D3',
                players: 120,
              },
              {
                value: 'D2',
                players: 56,
              },
              {
                value: 'D1',
                players: 21,
              },
            ]
          },
          {
            name: 'Country',
            value: 'USA',
            templateID: '5',
            players: 1231,
            subProfiles: [
              {
                value: 'France',
                players: 564,
              },
              {
                value: 'Canada',
                players: 341,
              },
              {
                value: 'Germany',
                players: 234,
              },
            ]
          },
          {
            name: 'Total Summ Spent',
            value: '$34',
            templateID: '6',
            players: 561,
            subProfiles: [
              {
                value: '$54',
                players: 120,
              },
              {
                value: '$45',
                players: 56,
              },
              {
                value: '$76',
                players: 21,
              },
            ]
          },
          {
            name: 'IAP bought times',
            value: '1',
            templateID: '7',
            players: 456,
            subProfiles: [
              {
                value: '2',
                players: 120,
              },
              {
                value: '3',
                players: 56,
              },
              {
                value: '4',
                players: 21,
              },
            ]
          },
          {
            name: 'Segment',
            value: 'New player',
            templateID: '8',
            players: 2312,
            subProfiles: [
            ]
          },
        ],
      }
      if (priceType === 'entity') {
        temp.entityNodeID = offer.offerPrice.nodeID
      }
      return temp
    })

    res.status(200).json({ success: true, offers });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.post('/api/analytics/getFirstPaymentConversionTime', async (req, res) => {
  const { gameID, branch, filterDate, filterSegments } = req.body;

  try {

    let randDays = randomNumberInRange(11, 23);
    let responseData = await generateRandomDataByNumber(0, randDays, 4000, 10000, -0.5, 0, 0, 'day', 'players')

    let randDeviation = randomNumberInRange(3,5)
    responseData[randDeviation] = {
      day: responseData[randDeviation].day,
      players: responseData[randDeviation].players * randomNumberInRange(1.2, 2, true)
    }

    res.status(200).json({ success: true, message: {data: responseData, granularity: 'day'} });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.post('/api/analytics/getPaymentConversion', async (req, res) => {
  const { gameID, branch, filterDate, filterSegments } = req.body;

  try {

    let randPayments = randomNumberInRange(1, 23);
    let responseData = await generateRandomDataByNumber(1, randPayments, 4000, 10000, -0.5, 0, 0, 'payment', 'players')
    responseData = responseData.map(item => ({
      ...item,
      meanPayment: randomNumberInRange(1, 15, true),
      meanDaysToConvert: randomNumberInRange(1, 5),
      revenue: randomNumberInRange(1000, 10000),
      sales: randomNumberInRange(1000, 10000),
      avgProfile: [
      {
        name: 'Game Level',
        value: '4',
        templateID: '1',
        players: 321,
        subProfiles: [
          {
            value: '3',
            players: 120,
          },
          {
            value: '2',
            players: 56,
          },
          {
            value: '1',
            players: 21,
          },
        ]
      },
      {
        name: 'Fav. Char',
        value: 'Leon',
        templateID: '2',
        players: 632,
        subProfiles: [
          {
            value: 'Shelly',
            players: 120,
          },
          {
            value: 'Bull',
            players: 56,
          },
          {
            value: 'Crow',
            players: 21,
          },
        ]
      },
      {
        name: 'Winrate',
        value: '64%',
        templateID: '3',
        players: 345,
        subProfiles: [
          {
            value: '63%',
            players: 341,
          },
          {
            value: '62%',
            players: 334,
          },
          {
            value: '61%',
            players: 234,
          },
        ]
      },
      {
        name: 'Retention',
        value: 'D0',
        templateID: '4',
        players: 1231,
        subProfiles: [
          {
            value: 'D3',
            players: 120,
          },
          {
            value: 'D2',
            players: 56,
          },
          {
            value: 'D1',
            players: 21,
          },
        ]
      },
      {
        name: 'Country',
        value: 'USA',
        templateID: '5',
        players: 1231,
        subProfiles: [
          {
            value: 'France',
            players: 564,
          },
          {
            value: 'Canada',
            players: 341,
          },
          {
            value: 'Germany',
            players: 234,
          },
        ]
      },
      {
        name: 'Total Summ Spent',
        value: '$34',
        templateID: '6',
        players: 561,
        subProfiles: [
          {
            value: '$54',
            players: 120,
          },
          {
            value: '$45',
            players: 56,
          },
          {
            value: '$76',
            players: 21,
          },
        ]
      },
      {
        name: 'IAP bought times',
        value: '1',
        templateID: '7',
        players: 456,
        subProfiles: [
          {
            value: '2',
            players: 120,
          },
          {
            value: '3',
            players: 56,
          },
          {
            value: '4',
            players: 21,
          },
        ]
      },
      {
        name: 'Segment',
        value: 'New player',
        templateID: '8',
        players: 2312,
        subProfiles: [
        ]
      },
      ],
    }))

    res.status(200).json({ success: true, responseData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.post('/api/analytics/getMainPaymentConversionFunnel', async (req, res) => {
  const { gameID, branch, filterDate, filterSegments } = req.body;

  try {

    let randPayments = randomNumberInRange(1, 23);
    let responseData = await generateRandomDataByNumber(1, randPayments, 4000, 10000, -0.5, 0, 0, 'payment', 'players')
    responseData = responseData.map(item => ({
      ...item,
      meanPayment: randomNumberInRange(1, 15, true),
      meanDaysToConvert: randomNumberInRange(1, 5),
      revenue: randomNumberInRange(1000, 10000),
      sales: randomNumberInRange(1000, 10000),
    }))

    res.status(200).json({ success: true, responseData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

//
// Overview page
//
app.post('/api/analytics/getActiveSessions', async (req, res) => {
  const {gameID, branchName, filterDate, filterSegments} = req.body

  try {

    const endDate = new Date(filterDate[1])
    const startDate = new Date(filterDate[0])


    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(23, 59, 59, 999);

    // Get difference between dates in milliseconds
    const dateDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);

    // Getting date for delta response, so if we get a query for "today" data, we get it and delta between today and yesterday.
    // If we get a data for this month, we will get delta for the previous month.
    const deltaEndDate = new Date(startDate)
    deltaEndDate.setDate(startDate.getDate() - 1)

    const deltaStartDate = new Date(startDate)
    deltaStartDate.setDate(startDate.getDate() - (dateDiff + 1))

    deltaStartDate.setUTCHours(0, 0, 0, 0);
    deltaEndDate.setUTCHours(23, 59, 59, 999);

    const deltaDateDiff = (deltaEndDate - deltaStartDate) / (1000 * 60 * 60 * 24);

    let clientIDs = []

    if (filterSegments && filterSegments.length !== 0) {
      clientIDs = await getPlayersFromSegment(gameID, branchName, filterSegments)
    }
    // const deltaResponse = await druidLib.getActiveSessions(gameID, branchName, deltaStartDate, deltaEndDate, deltaDateDiff, clientIDs)
    // const response = await druidLib.getActiveSessions(gameID, branchName, startDate, endDate, dateDiff, clientIDs)

    // const deltaValue = calculateDelta(deltaResponse, response)

    const responseData = [
      {
        timestamp: '2023-12-19T10:00:00.000Z',
        value: 2
      },
      {
        timestamp: '2023-12-20T10:00:00.000Z',
        value: 10
      },
      {
        timestamp: '2023-12-21T10:00:00.000Z',
        value: 25
      }
    ]

    res.status(200).json({success: true, message: {data: responseData, granularity: 'day', deltaValue: 25}})
    // if (response.success) {
    //   res.status(200).json({success: true, message: {data: response.data, granularity: response.granularity, deltaValue: deltaValue}})
    // } else{
    //   res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
    // }

  } catch (error) {
    console.log(error)
    res.status(200).json({success: false, message: 'Internal Server Error or No Data'})
  }


});

app.post('/api/analytics/getOfferAnalytics', async (req, res) => {
  const {gameID, branchName, offerID} = req.body

  try {

    const responseData = {
        revenue: 1346200,
        revenuePositive: true,
        declinerate: 27,
        declineratePositive: false,
        salesTotal: 9821,
        salesTotalPositive: true,
        impressions: 121021,
        impressionsPositive: true,
        avgProfile: [
          {
            name: 'Game Level',
            value: '4',
            templateID: '1',
            players: 321,
          },
          {
            name: 'Fav. Char',
            value: 'Leon',
            templateID: '2',
            players: 632,
          },
          {
            name: 'Winrate',
            value: '64%',
            templateID: '3',
            players: 345,
          },
          {
            name: 'Retention',
            value: '4',
            templateID: '4',
            players: 1231,
          },
          {
            name: 'Country',
            value: 'USA',
            templateID: '5',
            players: 1231,
          },
          {
            name: 'Total Summ Spent',
            value: '$341',
            templateID: '6',
            players: 561,
          },
          {
            name: 'IAP bought times',
            value: '12',
            templateID: '7',
            players: 456,
          },
          {
            name: 'Segment',
            value: 'New player',
            templateID: '8',
            players: 2312,
          },
        ],
        profile: [
          {
            name: 'Game Level',
            value: '4',
            players: 461,
            subProfile: [
              {
                name: 'Fav. Char',
                value: 'Leon',
                players: 461,
                subProfile: [
                  {
                    name: 'Fav. Char',
                    value: 'Crow',
                    players: 123,
                  },
                  {
                    name: 'Fav. Char',
                    value: 'Bull',
                    players: 53,
                  },
                ]
              },
              {
                name: 'Lose Streak',
                value: 'Lilith',
                players: 123,
                subProfiles: [
                  {
                    name: 'Lose Streak',
                    value: 'Crow',
                    players: 123,
                  },
                ]
              },
              {
                name: 'Fav. Char',
                value: 'Tanya',
                players: 252,
                subProfiles: [
                ]
              },
            ]
          },
          {
            name: 'Fav. Char',
            value: 'Leon',
            players: 7974,
            subProfile: [
              {
                name: 'Fav. Char',
                value: 'Crow',
                players: 461,
                subProfile: [
                  {
                    name: 'Fav. Char',
                    value: 'Shelly',
                    players: 123,
                  },
                  {
                    name: 'Fav. Char',
                    value: 'Bull',
                    players: 53,
                  },
                ]
              },
              {
                name: 'Lose Streak',
                value: '4',
                players: 243,
                subProfiles: [
                  {
                    name: 'Lose Streak',
                    value: '3',
                    players: 121,
                  },
                ]
              },
              {
                name: 'Fav. Char',
                value: 'Tanya',
                players: 252,
                subProfiles: [
                ]
              },
            ]
          }

        ],
        sales: [
          {
            date: '2023-01-01',
            sales: 400,
            revenue: 345,
          },
        ],
        behTree: [
          {
            name: 'This offer',
            type: 'iap',
            share: 100,
            subEvents: [
              {
                name: 'Level 4: Success',
                type: 'gameplay',
                share: 23,
                subEvents: [
                  {
                    name: 'User Registration',
                    type: 'registration',
                    share: 6
                  },
                  {
                    name: 'Item Purchased',
                    type: 'purchase',
                    share: 4
                  },
                  {
                    name: 'Tutorial Completed',
                    type: 'tutorial',
                    share: 2
                  },
                  {
                    name: 'Daily Login',
                    type: 'login',
                    share: 1
                  }
                ]
              },
              {
                name: 'Game Store open',
                type: 'ui',
                share: 15,
                subEvents: [
                  {
                    name: 'User Registration',
                    type: 'registration',
                    share: 3
                  },
                  {
                    name: 'Item Purchased',
                    type: 'purchase',
                    share: 2
                  },
                  {
                    name: 'Tutorial Completed',
                    type: 'tutorial',
                    share: 1
                  },
                  {
                    name: 'Daily Login',
                    type: 'login',
                    share: 1
                  }
                ]
              },
              {
                name: 'Battle pass open',
                type: 'ui',
                share: 5,
                subEvents: [
                  {
                    name: 'User Registration',
                    type: 'registration',
                    share: 1
                  },
                  {
                    name: 'Item Purchased',
                    type: 'purchase',
                    share: 1
                  },
                  {
                    name: 'Tutorial Completed',
                    type: 'tutorial',
                    share: 0
                  },
                  {
                    name: 'Daily Login',
                    type: 'login',
                    share: 0
                  }
                ]
              },
              {
                name: 'Battle pass open',
                type: 'ui',
                share: 5,
                subEvents: [
                  {
                    name: 'User Registration',
                    type: 'registration',
                    share: 1
                  },
                  {
                    name: 'Item Purchased',
                    type: 'purchase',
                    share: 1
                  },
                  {
                    name: 'Tutorial Completed',
                    type: 'tutorial',
                    share: 0
                  },
                  {
                    name: 'Daily Login',
                    type: 'login',
                    share: 0
                  }
                ]
              },
                            {
                name: 'Battle pass open',
                type: 'ui',
                share: 5,
                subEvents: [
                  {
                    name: 'User Registration',
                    type: 'registration',
                    share: 1
                  },
                  {
                    name: 'Item Purchased',
                    type: 'purchase',
                    share: 1
                  },
                  {
                    name: 'Tutorial Completed',
                    type: 'tutorial',
                    share: 0
                  },
                  {
                    name: 'Daily Login',
                    type: 'login',
                    share: 0
                  }
                ]
              },
            ]
        },
    ]
    }

    res.status(200).json({success: true, analytics: responseData})
  } catch (error) {
    console.log(error)
    res.status(500).json({success: false, message: 'Internal Server Error or No Data'})
  }
})

app.post('/api/analytics/getOfferSalesAndRevenue', async (req, res) => {
  const {gameID, branchName, filterDate, filterSegments, offerID} = req.body

  try {

    const endDate = new Date(filterDate[1])
    const startDate = new Date(filterDate[0])

    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(23, 59, 59, 999);

    let generatedData = await generateRandomDataByDays(startDate, endDate, 80, 400, 0.1, 0.05)
    let responseData = generatedData.map(item => ({
      timestamp: item.timestamp,
      sales: (item.value * randomNumberInRange(1.2, 2, true)).toFixed(0),
      revenue: item.value,
    }))
    deltaValue = arraySum(responseData.map(item => item.revenue))


    res.status(200).json({success: true, message: {data: responseData, granularity: 'day', deltaValue}})
  } catch (error) {
    console.log(error)
    res.status(500).json({success: false, message: 'Internal Server Error or No Data'})
  }
});

app.post('/api/analytics/getOverviewStatisticsForPublisher', async (req, res) => {
  const {studioIDs} = req.body

  try {

    let endDate = new Date();
    let startDate = new Date()
    startDate.setDate(startDate.getDate() - 6);

    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(23, 59, 59, 999);

    const dateDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);

    let overallData = []
    for (let i = 0; i <= Math.floor(dateDiff); i++) {
      overallData.push(
        {
        timestamp: '',
        revenue: 0,
        newUsers: 0,
        retention: 0,
        }
      )
    }

    let studiosData = await Promise.all(studioIDs.map(async (studioID, studioIndex) => {
      let generatedData = await generateRandomDataByDays(
        startDate, 
        endDate, 
        randomNumberInRange(-2000, 6000), 
        randomNumberInRange(-5000, 10000), 
        randomNumberInRange(-0.2, 0.2, true), 
        0.5
      )
      let retentionData = NonAsyncGenerateRandomDataByDays(
        startDate, 
        endDate, 
        randomNumberInRange(1000, 6000), 
        randomNumberInRange(1000, 10000), 
        randomNumberInRange(-0.6, -0.87, true), 
        0
      )
      
      generatedData = generatedData.map(item => ({
        timestamp: item.timestamp,
        users: (item.value * randomNumberInRange(1.2, 2, true)).toFixed(0),
        revenue: item.value,
      }))
      generatedData = {
        studioID: studioID,
        deltaDau: arraySum(generatedData.map(item => parseFloat(item.users))).toFixed(0),
        deltaRevenue: arraySum(generatedData.map(item => parseFloat(item.revenue))).toFixed(0),
        
        data: generatedData.map((item, i) => {
        
          let dataObj = {
            dau: {
              timestamp: item.timestamp,
              value: parseInt(item.users),
            },
  
            newUsers: {
              timestamp: item.timestamp,
              value: parseInt(item.users),
            },
  
            retention: {
              timestamp: item.timestamp,
              value: retentionData[i].value,
            },
    
            revenue: {
              timestamp: item.timestamp,
              value: item.revenue,
            },
          }
        overallData[i].timestamp = dataObj.revenue.timestamp
        overallData[i].revenue += dataObj.revenue.value
        overallData[i].newUsers += dataObj.newUsers.value
        overallData[i].retention += dataObj.retention.value
        return dataObj
        })
      }
      
      return generatedData

    }))

    res.status(200).json({success: true, data: {overall: overallData, studios: studiosData}})

  } catch (error) {
    console.log(error)
    res.status(500).json({success: false, message: 'Internal Server Error or No Data'})
  }
})

app.post('/api/analytics/getOverviewStatistics', async (req, res) => {
  const {gameIDs} = req.body

  try {

    let endDate = new Date();
    let startDate = new Date()
    startDate.setDate(startDate.getDate() - 6);

    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(23, 59, 59, 999);

    const dateDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);

    let overallData = []
    for (let i = 0; i <= Math.floor(dateDiff); i++) {
      overallData.push(
        {
        timestamp: '',
        revenue: 0,
        newUsers: 0,
        retention: 0,
        }
      )
    }

    let gamesData = await Promise.all(gameIDs.map(async (gameID, gameIndex) => {
      let generatedData = await generateRandomDataByDays(
        startDate, 
        endDate, 
        randomNumberInRange(-2000, 6000), 
        randomNumberInRange(-5000, 10000), 
        randomNumberInRange(-0.2, 0.2, true), 
        0.5
      )
      let retentionData = NonAsyncGenerateRandomDataByDays(
        startDate, 
        endDate, 
        randomNumberInRange(1000, 6000), 
        randomNumberInRange(1000, 10000), 
        randomNumberInRange(-0.6, -0.87, true), 
        0
      )
      
      generatedData = generatedData.map(item => ({
        timestamp: item.timestamp,
        users: (item.value * randomNumberInRange(1.2, 2, true)).toFixed(0),
        revenue: item.value,
      }))
      generatedData = {
        gameID: gameID,
        deltaDau: arraySum(generatedData.map(item => parseFloat(item.users))).toFixed(0),
        deltaRevenue: arraySum(generatedData.map(item => parseFloat(item.revenue))).toFixed(0),
        
        data: generatedData.map((item, i) => {
        
          let dataObj = {
            dau: {
              timestamp: item.timestamp,
              value: parseInt(item.users),
            },
  
            newUsers: {
              timestamp: item.timestamp,
              value: parseInt(item.users),
            },
  
            retention: {
              timestamp: item.timestamp,
              value: retentionData[i].value,
            },
    
            revenue: {
              timestamp: item.timestamp,
              value: item.revenue,
            },
          }
        overallData[i].timestamp = dataObj.revenue.timestamp
        overallData[i].revenue += dataObj.revenue.value
        overallData[i].newUsers += dataObj.newUsers.value
        overallData[i].retention += dataObj.retention.value
        return dataObj
        })
      }
      
      return generatedData

    }))

    res.status(200).json({success: true, data: {overall: overallData,games: gamesData}})

  } catch (error) {
    console.log(error)
    res.status(500).json({success: false, message: 'Internal Server Error or No Data'})
  }
})

app.post('/api/analytics/getRandomDataForABTest', async (req, res) => {
  const {gameID, branchName, filterDate, testID} = req.body

  const endDate = new Date(filterDate[1])
  const startDate = new Date(filterDate[0])
  startDate.setUTCHours(0, 0, 0, 0);
  endDate.setUTCHours(23, 59, 59, 999);

  let randStart_controlSamples = randomNumberInRange(1000, 10000)
  const controlDeviation = randomNumberInRange(0.025, 0.040, true)
  let randStart_control = parseInt(randStart_controlSamples*controlDeviation)

  let randStart_testSamples = randomNumberInRange(100, 1000)
  const testDeviation = controlDeviation + randomNumberInRange(-0.01, 0.01, true)
  let randStart_test = parseInt(randStart_testSamples*testDeviation)

  console.log('Generating control results', randStart_control)
  let generatedData = await generateRandomDataByDaysNonLinear(
    startDate, endDate, randStart_control, randStart_control, 0.2, 0.5, 0, 'timestamp', 'control')

  console.log('Generating test results', randStart_test)
  let generatedData_test = await generateRandomDataByDaysNonLinear(
    startDate, endDate, randStart_test, randStart_test, 0.2, 0.5, 0, 'timestamp', 'test')

  console.log('Generating control samples', randStart_controlSamples)
  let generatedData_controlSamples = await generateRandomDataByDaysNonLinear(
    startDate, endDate, randStart_controlSamples, randStart_controlSamples, 0.2, 0.5, 0, 'timestamp', 'controlSamples')

  console.log('Generating test samples', randStart_testSamples)
  let generatedData_testSamples = await generateRandomDataByDaysNonLinear(
    startDate, endDate, randStart_testSamples, randStart_testSamples, 0.2, 0.5, 0, 'timestamp', 'testSamples')


  generatedData = generatedData.map((item, index) => {
    let tempItem = item
    item.test = generatedData_test[index].test
    item.controlSamples = generatedData_controlSamples[index].controlSamples
    item.testSamples = generatedData_testSamples[index].testSamples
    return tempItem
  })

  function calculatePValue(controlSuccesses, controlTrials, testSuccesses, testTrials) {
    const p1 = controlSuccesses / controlTrials;
    const p2 = testSuccesses / testTrials;
    const p = (controlSuccesses + testSuccesses) / (controlTrials + testTrials);
    const z = (p1 - p2) / Math.sqrt(p * (1 - p) * (1 / controlTrials + 1 / testTrials));
    const pValue = 2 * (1 - jStat.normal.cdf(Math.abs(z), 0, 1));
    return {pValue, zScore: z};
  }

  // Проходимся по массиву данных игроков и обновляем значения p-value
  for (let i = 0; i < generatedData.length; i++) {
    const currentDate = new Date(generatedData[i].timestamp);
    const currentControl = generatedData[i].control;
    const currentTest = generatedData[i].test;
    const currentControlSamples = generatedData[i].controlSamples;
    const currentTestSamples = generatedData[i].testSamples;

    // Собираем данные за предыдущие дни
    const prevDaysData = generatedData
      .filter((item, index) => new Date(item.timestamp) < currentDate && index < i)
      .map(item => ({ control: item.control, test: item.test }));

    // Вычисляем p-value на основе данных за текущий и предыдущие дни
    const res = calculatePValue(currentControl, currentControlSamples, currentTest, currentTestSamples);
    // Обновляем значение p-value в элементе массива
    generatedData[i].pvalue = res.pValue;
    generatedData[i].zScore = res.zScore;
  }

  generatedData = generatedData.map((item, index) => {
    let tempItem = item
    item.control = item.control / item.controlSamples
    item.test = item.test / item.testSamples
    return tempItem
  })

  
  
  // console.log(generatedData)

  res.status(200).json({success: true, message: {data: generatedData}})
})


app.post('/api/getDashboards', async (req, res) => {
  const {gameID, branch} = req.body

  try {

    if (!gameID || !branch) {
      return res.status(400).json({success: false, message: 'Missing required parameters'})
    }

    let game = await CustomCharts.findOne({ 'gameID': gameID, 'branches.branch': branch }).lean()
      
    if (!game) {
      console.log('Game not found or branch does not exist');
    }

    const branchItem = game.branches.find(b => b.branch === branch);
    const dashboards = branchItem.dashboards.map(d => ({...d, charts: JSON.parse(d.charts)}));

    res.status(200).json({success: true, dashboards: dashboards})

  } catch (error) {
    console.log(error)
    res.status(500).json({success: false, message: 'Internal Server Error'})
  }
})
app.post('/api/getDashboardByLink', async (req, res) => {
  const {gameID, branch, linkName} = req.body

  try {

    if (!gameID || !branch) {
      return res.status(400).json({success: false, message: 'Missing required parameters'})
    }

    let game = await CustomCharts.findOne({ 'gameID': gameID, 'branches.branch': branch }).lean()
      
    if (!game) {
      console.log('Game not found or branch does not exist');
    }

    const branchItem = game.branches.find(b => b.branch === branch);
    const dashboards = branchItem.dashboards.map(d => ({...d, charts: JSON.parse(d.charts)}));
    let targetDashboard = dashboards.find(d => d.linkName === linkName)

    console.log(dashboards)
    res.status(200).json({success: true, dashboard: targetDashboard})

  } catch (error) {
    console.log(error)
    res.status(500).json({success: false, message: 'Internal Server Error'})
  }
})
app.post('/api/addCustomDashboard', async (req, res) => {
  const {gameID, branch, newDashboard} = req.body

  try {

    if (!gameID || !branch || !newDashboard) {
      return res.status(400).json({success: false, message: 'Missing required parameters'})
    }

    let game = await CustomCharts.findOne({ 'gameID': gameID, 'branches.branch': branch })
      
    if (!game) {
      console.log('Game not found or branch does not exist');
    }

    const branchItem = game.branches.find(b => b.branch === branch);
    let dashboards = branchItem.dashboards;
    let targetDashboard = newDashboard
    targetDashboard.charts = JSON.stringify(targetDashboard.charts)

    await CustomCharts.findOneAndUpdate(
      { 'gameID': gameID, 'branches.branch': branch }, 
    { 
      $push: { 'branches.$.dashboards': newDashboard } 
    })

    res.status(200).json({success: true, dashboards: dashboards})

  } catch (error) {
    console.log(error)
    res.status(500).json({success: false, message: 'Internal Server Error'})
  }
})
app.post('/api/removeCustomDashboard', async (req, res) => {
  const {gameID, branch, dashboardID} = req.body

  try {

    if (!gameID || !branch || !dashboardID) {
      return res.status(400).json({success: false, message: 'Missing required parameters'})
    }

    let game = await CustomCharts.findOne({ 'gameID': gameID, 'branches.branch': branch })
      
    if (!game) {
      console.log('Game not found or branch does not exist');
    }

    await CustomCharts.findOneAndUpdate(
      { 'gameID': gameID, 'branches.branch': branch }, 
    { 
      $pull: { 'branches.$.dashboards': { id: dashboardID } }
    })

    res.status(200).json({success: true})

  } catch (error) {
    console.log(error)
    res.status(500).json({success: false, message: 'Internal Server Error'})
  }
})
app.post('/api/updateCustomDashboard', async (req, res) => {
  const {gameID, branch, dashboardID, newDashboard} = req.body

  try {

    if (!gameID || !branch || !dashboardID || !newDashboard) {
      return res.status(400).json({success: false, message: 'Missing required parameters'})
    }

    let game = await CustomCharts.findOne({ 'gameID': gameID, 'branches.branch': branch })
      
    if (!game) {
      console.log('Game not found or branch does not exist');
    }

    const branchItem = game.branches.find(b => b.branch === branch);
    const dashboards = branchItem.dashboards;
    const targetIndex = dashboards.findIndex(d => d.id === dashboardID);

    let updatedDashboard = newDashboard;
    updatedDashboard.charts = JSON.stringify(updatedDashboard.charts);

    await CustomCharts.findOneAndUpdate(
      { 'gameID': gameID, 'branches.branch': branch, 'branches.dashboards.id': dashboardID },
    { 
      $set: { [`branches.$[outer].dashboards.${targetIndex}`]: updatedDashboard }
    },
    {
      arrayFilters: [{ 'outer.branch': branch }]
    }
    )

    res.status(200).json({success: true})

  } catch (error) {
    console.log(error)
    res.status(500).json({success: false, message: 'Internal Server Error'})
  }
})

app.post('/api/getABTests', async (req, res) => {
  const {gameID, branchName} = req.body

  try {

    const abTests = await ABTests.findOne({ gameID: gameID, 'branches.branch': branchName })
      
    if (!abTests) {
      console.log('ABTests not found or branch does not exist');
    }

    const branchItem = abTests.branches.find(b => b.branch === branchName);
    const result = branchItem.tests;

    res.status(200).json({success: true, abTests: result})

  } catch (error) {
    console.log(error)
    res.status(500).json({success: false, message: 'Internal Server Error'})
  }
})
app.post('/api/createABTest', async (req, res) => {
  const {gameID, branchName, testObject} = req.body

  try {

    let formattedTestObject = testObject;
    formattedTestObject.segments = JSON.stringify(formattedTestObject.segments)
    formattedTestObject.observedMetric = JSON.stringify(formattedTestObject.observedMetric)
    formattedTestObject.subject = JSON.stringify(formattedTestObject.subject)


    const abTests = await ABTests.findOneAndUpdate(
      { 'gameID': gameID, 'branches.branch': branchName },
      { $push: { 'branches.$.tests': testObject } },
      { new: true }
    )

    res.status(200).json({success: true})

  } catch (error) {
    console.log(error)
    res.status(500).json({success: false, message: 'Internal Server Error'})
  }
})
app.post('/api/removeABTest', async (req, res) => {
  const {gameID, branchName, testObject, archive, archiveResult} = req.body

  try {

    if (archive) {

      let formattedTestObject = testObject;
      formattedTestObject.segments = JSON.stringify(formattedTestObject.segments)
      formattedTestObject.observedMetric = JSON.stringify(formattedTestObject.observedMetric)
      formattedTestObject.subject = JSON.stringify(formattedTestObject.subject)
      formattedTestObject.archived = true
      formattedTestObject.archivedResult = archiveResult
      formattedTestObject.codename = ''
  
  
      const abTests = await ABTests.findOneAndUpdate(
        { 'gameID': gameID, 'branches.branch': branchName },
        { $set: { 'branches.$[outer].tests.$[inner]': formattedTestObject } },
        {
          arrayFilters: [
            { 'outer.branch': branchName },
            { 'inner.id': testObject.id },
          ],
        }
      )
    } else {
      const abTests = await ABTests.findOneAndUpdate(
        { 'gameID': gameID, 'branches.branch': branchName },
        { $pull: { 'branches.$.tests': { id: testObject.id } } },
        { new: true }
      )
    }
    

    res.status(200).json({success: true})

  } catch (error) {
    console.log(error)
    res.status(500).json({success: false, message: 'Internal Server Error'})
  }
})
app.post('/api/updateABTest', async (req, res) => {
  const {gameID, branchName, testObject} = req.body

  try {

    let formattedTestObject = testObject;
    formattedTestObject.segments = JSON.stringify(formattedTestObject.segments)
    formattedTestObject.observedMetric = JSON.stringify(formattedTestObject.observedMetric)
    formattedTestObject.subject = JSON.stringify(formattedTestObject.subject)


    const abTests = await ABTests.findOneAndUpdate(
      { 'gameID': gameID, 'branches.branch': branchName },
      { $set: { 'branches.$[outer].tests.$[inner]': formattedTestObject } },
      {
        arrayFilters: [
          { 'outer.branch': branchName },
          { 'inner.id': testObject.id },
        ],
      }
    )

    res.status(200).json({success: true})

  } catch (error) {
    console.log(error)
    res.status(500).json({success: false, message: 'Internal Server Error'})
  }
})

async function populateABtests(gameID) {
  const newABTests = new ABTests({
    gameID: gameID,
    branches: [
      {
        branch: 'development',
        tests: [],
      },
      {
        branch: 'stage',
        tests: [],
      },
      {
        branch: 'production',
        tests: [],
      },
    ],
  });
  await newABTests.save();
}




app.post('/api/testFunc', async (req, res) => {
  const {gameID, branchName, type, payload} = req.body

  function handleEconomyEvent(payload) {
    const {currencyID, amount, type, origin} = payload
    // Function
  }
  function handleInappEvent(payload) {
    const {offerID, price, amount} = payload
    // Function
  }

  switch (type) {
    case 'economyEvent':
      handleEconomyEvent(payload)
      break;
    case 'inappEvent':
      handleInappEvent(payload)
      break;
  }


  res.status(200).json({success: true, message: req.body})

});


function getRandomDateInRange(startDate, endDate) {
  const startTimestamp = startDate.getTime();
  const endTimestamp = endDate.getTime();
  const randomTimestamp = startTimestamp + Math.random() * (endTimestamp - startTimestamp);
  return new Date(randomTimestamp).toISOString();
}
async function populatePlayerWarehouse_brawlDemo(gameID, branchName) {

  const Aelements = [
    // Default elements
    'lastReturnDate', 
    'totalPaymentsCount', 
    'totalPaymentsSumm', 
    'meanPaymentRecency',
    'lastPaymentDate', 
    'country',
    'language',
    'platform',
    'meanSessionLength',
    'engineVersion',
    'gameVersion',

    // Fav map
    '663d181077b0dc8621b774c7',
    // Fav gamemode
    '663d182777b0dc8621b77590',
    // Wins
    '663d1b9677b0dc8621b78652',
    // Loses
    '663d1b9f77b0dc8621b7874a',

  ]
  const Selements = [
    // Cups
    '663bd07ccd73d3ab9452ee81',
    // Guild
    '663d095299aa302b3e13095e',
    // Total Matches
    '663d155b77b0dc8621b75750',
    // Fav hero
    '663e45e7be9b75936d06bf7d',
    // Winrate
    '663e4631be9b75936d06c04b',
    // Won in a row
    '663e480ea2e5dcd1c6966b31',
    // Lost in a row
    '663e484c7a10254518c2bdc5',
    // Chars unlocked
    '663e49a3fddd8932e8139146',
  ]
  let segmentCounts = {}

  async function generatePlayer() {


    function getRandomDateInRange(start, end) {
      return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    }
    
    function getRandomCountry() {
      const countries = [
        { name: 'United States', proportion: 0.30 },
        { name: 'India', proportion: 0.20 },
        { name: 'China', proportion: 0.15 },
        { name: 'Germany', proportion: 0.15 },
        { name: 'United Kingdom', proportion: 0.125 },
        { name: 'Portugal', proportion: 0.025 },
        { name: 'France', proportion: 0.025 },
        { name: 'Spain', proportion: 0.025 }
      ];
    
      // Генерация случайного числа от 0 до 1
      const randomValue = Math.random();
    
      // Применяем кумулятивное распределение
      let cumulative = 0;
      for (const country of countries) {
        cumulative += country.proportion;
        if (randomValue < cumulative) {
          return country.name;
        }
      }
    }
    
    function getRandomLanguage() {
      const languages = [
        { name: 'English', proportion: 0.65 },
        { name: 'Chinese', proportion: 0.13 },
        { name: 'Indian', proportion: 0.12 },
        { name: 'German', proportion: 0.07 },
        { name: 'Portuguese', proportion: 0.03 },
        { name: 'French', proportion: 0.03 },
        { name: 'Spanish', proportion: 0.03 },
      ];
    
      // Генерация случайного числа от 0 до 1
      const randomValue = Math.random();
    
      // Применяем кумулятивное распределение
      let cumulative = 0;
      for (const lang of languages) {
        cumulative += lang.proportion;
        if (randomValue < cumulative) {
          return lang.name;
        }
      }
    }
    
    function getRandomPlatform() {
      const platforms = ['Android 10', 'iOS 14', 'Windows 10', 'MacOS 11', 'Linux'];
      return platforms[Math.floor(Math.random() * platforms.length)];
    }
    
    function getRandomEngineVersion() {
      const engines = ['Unity 2021.3.9f1', 'Unity 2021.3.8f1', 'Unity 2021.3.7f1', 'Unity 2021.3.6f1', 'Unreal Engine 5.1', 'Unreal Engine 5.0', 'Unreal Engine 4.27'];
      return engines[Math.floor(Math.random() * engines.length)];
    }
    
    function getRandomGameVersion() {
      const versions = ['1.9.1', '1.9.0', '1.8.0', '1.7.0'];
      return versions[Math.floor(Math.random() * versions.length)];
    }

    function getRandomFavMap() {
      const favmaps = [
        { name: 'skull_creek', proportion: 0.25 },
        { name: 'rockwall_brawl', proportion: 0.20 },
        { name: 'dark_passage', proportion: 0.15 },
        { name: 'freezing_ripples', proportion: 0.1 },
        { name: 'double_trouble', proportion: 0.075 },
        { name: 'hard_rock_mine', proportion: 0.075 },
        { name: 'undermine', proportion: 0.075 },
        { name: 'cool_shapes', proportion: 0.075 },
      ];
    
      // Генерация случайного числа от 0 до 1
      const randomValue = Math.random();
    
      // Применяем кумулятивное распределение
      let cumulative = 0;
      for (const map of favmaps) {
        cumulative += map.proportion;
        if (randomValue < cumulative) {
          return map.name;
        }
      }
    }

    function getRandomFavHero() {
      const favhero = [
        { name: 'shelly', proportion: 0.35 },
        { name: 'edgar', proportion: 0.20 },
        { name: 'colt', proportion: 0.15 },
        { name: 'poko', proportion: 0.10 },
        { name: 'bull', proportion: 0.10 },
        { name: 'frank', proportion: 0.10 },
      ];
    
      // Генерация случайного числа от 0 до 1
      const randomValue = Math.random();
    
      // Применяем кумулятивное распределение
      let cumulative = 0;
      for (const hero of favhero) {
        cumulative += hero.proportion;
        if (randomValue < cumulative) {
          return hero.name;
        }
      }
    }

    function getRandomFavGamemode() {
      const favgms = [
        { name: 'sd', proportion: 0.35 },
        { name: 'gem_grab', proportion: 0.25 },
        { name: 'duo_sd', proportion: 0.25 },
        { name: 'brawlball', proportion: 0.15 },
      ];
    
      // Генерация случайного числа от 0 до 1
      const randomValue = Math.random();
    
      // Применяем кумулятивное распределение
      let cumulative = 0;
      for (const gm of favgms) {
        cumulative += gm.proportion;
        if (randomValue < cumulative) {
          return gm.name;
        }
      }
    }

    let global_lrd
    let global_tpc
    let global_mpr
    
    let uniformRandom = d3.randomUniform(0, 1);
    let normalRandom = d3.randomNormal(5, 2);

    let global_totalMatches = d3.randomNormal(500, 50)()
    let global_winrate = d3.randomNormal(0.5, 0.1)()

    let global_losestreak
    let global_favhero
    let global_charsunlocked
    
    const player = {
      gameID: gameID,
      branch: branchName,
      clientID: uuid(),
      elements: {
        statistics: Selements.map(element => {
          let tempVal;
          switch (element) {
              // Cups
              case '663bd07ccd73d3ab9452ee81':
                let tempWins = Math.round(global_totalMatches * global_winrate)
                let tempLoses = Math.round(global_totalMatches * (1-global_winrate))
                tempVal = Math.round(tempWins*d3.randomUniform(20, 25)()) + Math.round(tempLoses*d3.randomUniform(-5, 8)())
                break;

              // Guild
              case '663d095299aa302b3e13095e': 
                tempVal = uniformRandom(0, 1) <= 0.65 ? 'True' : 'False';
                break;

              // Fav hero
              case '663e45e7be9b75936d06bf7d': 
                tempVal = getRandomFavHero()
                global_favhero = tempVal
                break;

              // Total matches
              case '663d155b77b0dc8621b75750': 
                tempVal = global_totalMatches
                break;

              // Winrate
              case '663e4631be9b75936d06c04b': 
                tempVal = parseFloat((global_winrate*100).toFixed(2))
                break;

              // Won in a row
              case '663e480ea2e5dcd1c6966b31': 
                tempVal = Math.abs(Math.round(d3.randomNormal(2, 5)()))
                break;

              // Lost in a row
              case '663e484c7a10254518c2bdc5': 
                tempVal = Math.abs(Math.round(d3.randomNormal(3, 1)()))
                global_losestreak = tempVal
                break;

              // Chars unlocked
              case '663e49a3fddd8932e8139146': 
                tempVal = uniformRandom(0, 1) <= 0.39 ? 'True' : 'False';
                global_charsunlocked = tempVal
                break;
            }
            return { elementID: element, elementValue: tempVal };
        }),
        analytics: Aelements.map(element => {
            let tempVal;
            switch (element) {
              case 'lastReturnDate':
                tempVal = uniformRandom(0, 1) < 0.95 ? getRandomDateInRange(new Date(), new Date(Date.now() - 1000 * 60 * 60 * 24 * 25)) : getRandomDateInRange(new Date(), new Date(Date.now() - 1000 * 60 * 60 * 24 * 30));
                global_lrd = new Date(tempVal);
                break;
    
              case 'lastPaymentDate':
                if (global_mpr !== -1) {
                  // Устанавливаем диапазон дат в зависимости от meanPaymentRecency
                  const daysAgo = Math.min(15, Math.max(3, Math.ceil(global_mpr)));
                  tempVal = getRandomDateInRange(global_lrd, new Date(Date.now() - 1000 * 60 * 60 * 24 * daysAgo));
                } else {
                  tempVal = new Date(0); // Если нет платежей, установим нулевую дату
                }
                break;
    
              case 'totalPaymentsCount':
                const randValue = uniformRandom();
                if (randValue < 0.90) {
                  tempVal = 0;
                } else if (randValue < 0.95) {
                  tempVal = Math.max(1, Math.floor(normalRandom(5, 2))); // Значения между 1 и 10
                } else {
                  tempVal = Math.floor(normalRandom(20, 5)); // Значения выше 10
                }
                global_tpc = tempVal;
                break;
    
              case 'totalPaymentsSumm':
                tempVal = global_tpc * Math.max(1, d3.randomNormal(0.5, 1)());
                break;
    
              case 'meanPaymentRecency':
                if (global_tpc !== 0) {
                  // Более управляемый расчет meanPaymentRecency
                  const baseRecency = 30; // Базовое значение, для расчета средних дней между платежами
                  tempVal = baseRecency / global_tpc;
                  // Добавим немного случайности, чтобы значения не были слишком однообразными
                  tempVal *= uniformRandom(0.8, 1.2); 
                  tempVal = parseFloat(Math.max(0, tempVal).toFixed(1)); // Убедимся, что значение не меньше 1
                } else {
                  tempVal = -1;
                }
                global_mpr = tempVal;
                break;
    
              case 'country':
                tempVal = getRandomCountry();
                break;
    
              case 'language':
                tempVal = getRandomLanguage();
                break;
    
              case 'platform':
                tempVal = getRandomPlatform();
                break;
    
              case 'meanSessionLength':
                tempVal = Math.floor(d3.randomNormal(1800, 100)());
                break;
    
              case 'engineVersion':
                tempVal = getRandomEngineVersion();
                break;
    
              case 'gameVersion':
                tempVal = getRandomGameVersion();
                break;
  
              // Fav map
              case '663d181077b0dc8621b774c7':
                tempVal = getRandomFavMap()
                break;
  
              // Fav gamemode
              case '663d182777b0dc8621b77590':
                tempVal = getRandomFavGamemode()
                break;
  
              // Wins
              case '663d1b9677b0dc8621b78652': 
                tempVal = Math.round(global_totalMatches * global_winrate)
                break;
              
              // Loses
              case '663d1b9f77b0dc8621b7874a': 
                tempVal = Math.round(global_totalMatches * (1 - global_winrate))
                break;
            }
            return { elementID: element, elementValue: tempVal };
        }),
      },
      inventory: [],
      goods: [],
      abtests: [],
      segments: [],
    };

    const possibleSegments = [
    // Chars unlocked
    '663e2c06f9318aad701a93d9', 

    // FavHero edgar
    '663e611e511c1fb47b4e59f5',

    // FavHero bull
    '663e6132511c1fb47b4e5ae2',

    // Lose streak >3
    '663e6143511c1fb47b4e5b82'

    ]
    player.segments.push('everyone',);
    possibleSegments.forEach(segment => {
      switch (segment) {
        case '663e2c06f9318aad701a93d9':
          if (global_charsunlocked === 'True') {
            player.segments.push(segment)
          }
          break;
        case '663e611e511c1fb47b4e59f5':
          if (global_favhero === 'edgar') {
            player.segments.push(segment)
          }
          break;
        case '663e6132511c1fb47b4e5ae2':
          if (global_favhero === 'bull') {
            player.segments.push(segment)
          }
          break;
        case '663e6143511c1fb47b4e5b82':
          if (global_losestreak > 3) {
            player.segments.push(segment)
          }
          break;
      }
    })

    player.segments.forEach(segment => {
      if (!segmentCounts[segment]) {
        segmentCounts[segment] = 0
      }
      segmentCounts[segment]++
    })

    return player
  }

  const totalBatches = 10;
  const batchSize = 10000;

  const res = await PWplayers.deleteMany({gameID, branch: branchName})
  console.log('Deleted players', res)

  console.log('Generating players for PW. Batch size: ' + batchSize + ', total batches: ' + totalBatches);
  for (let i = 0; i < totalBatches; i++) {
    const playerPromises = Array.from({ length: batchSize }, () => generatePlayer());
    const players = await Promise.all(playerPromises);
    
    console.log('Populated player warehouse, saving')
    try {
      await PWplayers.collection.insertMany(players)
    } catch (error) {
      console.log('Error inserting players:', error)
    }
    console.log('Saved')
  }


  const segments = await Segments.findOne({ gameID, 'branches.branch': branchName })
  const branch = segments.branches.find(b => b.branch === branchName)
  branch.segments.forEach(segment => {
    segment.segmentPlayerCount = segmentCounts[segment.segmentID]
  })
  console.log('Populated segments, saving')
  await segments.save()

  
  
  console.log('Populated database')

}
async function hardPopulation() {
  // await populatePlayerWarehouse_brawlDemo('brawlDemo', 'development')
  // await cachePlayers('8e116fca-66c4-4669-beb9-56d99940f70d', 'development')
}
hardPopulation()

async function testFunctionPW() {
  const gameID = '8e116fca-66c4-4669-beb9-56d99940f70d'
  const branchName = 'development'
  const segmentID = 'everyone'
  const clientID = '99e0999b-e891-4782-bf18-c5833c73fa12'

  // const players = await PWplayers.find(
  //   {gameID, 'elements.analytics': { $elemMatch: {'elementID': 'totalPaymentsCount', 'elementValue': { $gt: 0 } } }}
  // ).count()
  // console.log('players', players)
  // let playerWarehouse = await PWtemplates.findOne({
  //   gameID,
  //   'branches.branch': branchName,
  // });
  // console.log('playerWarehouse', playerWarehouse)
}
testFunctionPW()

async function populateElements(gameID, branchName) {
  await PWtemplates.findOneAndUpdate(
    { gameID: gameID, 'branches.branch': branchName },
    { $push: { 'branches.$.templates.analytics': {

      templateID: 'lastReturnDate',
      templateName: 'Last Return Date',
      templateDefaultVariantType: 'date'
    } } },
    {
      new: true
    }
  )
  await PWtemplates.findOneAndUpdate(
    { gameID: gameID, 'branches.branch': branchName },
    { $push: { 'branches.$.templates.analytics': 
    {
      templateID: 'lastPaymentDate',
      templateName: 'Last Payment Date',
      templateDefaultVariantType: 'date'
    }
    } },
    {
      new: true
    }
  )
  await PWtemplates.findOneAndUpdate(
    { gameID: gameID, 'branches.branch': branchName },
    { $push: { 'branches.$.templates.analytics': 
    {
      templateID: 'totalPaymentsSumm',
      templateName: 'Total Payments Summ',
      templateDefaultVariantType: 'float'
    }
    } },
    {
      new: true
    }
  )
  await PWtemplates.findOneAndUpdate(
    { gameID: gameID, 'branches.branch': branchName },
    { $push: { 'branches.$.templates.analytics': 
    {
      templateID: 'totalPaymentsCount',
      templateName: 'Total Payments Count',
      templateDefaultVariantType: 'integer'
    }
    } },
    {
      new: true
    }
  )
  await PWtemplates.findOneAndUpdate(
    { gameID: gameID, 'branches.branch': branchName },
    { $push: { 'branches.$.templates.analytics': 
    {
      templateID: 'country',
      templateName: 'Country',
      templateDefaultVariantType: 'string'
    }
    } },
    {
      new: true
    }
  )
  await PWtemplates.findOneAndUpdate(
    { gameID: gameID, 'branches.branch': branchName },
    { $push: { 'branches.$.templates.analytics': 
    {
      templateID: 'engineVersion',
      templateName: 'Engine Version',
      templateDefaultVariantType: 'string'
    }
    } },
    {
      new: true
    }
  )
  await PWtemplates.findOneAndUpdate(
    { gameID: gameID, 'branches.branch': branchName },
    { $push: { 'branches.$.templates.analytics': 
    {
      templateID: 'gameVersion',
      templateName: 'Game Version',
      templateDefaultVariantType: 'string'
    }
    } },
    {
      new: true
    }
  )
  await PWtemplates.findOneAndUpdate(
    { gameID: gameID, 'branches.branch': branchName },
    { $push: { 'branches.$.templates.analytics': 
    {
      templateID: 'language',
      templateName: 'Language',
      templateDefaultVariantType: 'string'
    }
    } },
    {
      new: true
    }
  )
  await PWtemplates.findOneAndUpdate(
    { gameID: gameID, 'branches.branch': branchName },
    { $push: { 'branches.$.templates.analytics': 
    {
      templateID: 'platform',
      templateName: 'Platform',
      templateDefaultVariantType: 'string'
    }
    } },
    {
      new: true
    }
  )
  await PWtemplates.findOneAndUpdate(
    { gameID: gameID, 'branches.branch': branchName },
    { $push: { 'branches.$.templates.analytics': 
    {
      templateID: 'meanSessionLength',
      templateName: 'Mean. Session Length',
      templateDefaultVariantType: 'integer'
    } 
    } },
    {
      new: true
    }
  )

}
// populateElements('8e116fca-66c4-4669-beb9-56d99940f70d', 'development')


app.get('/api/health', async (req, res, next) => {
  res.json({health: 'OK.', message: `Current Version is ${process.env.CURRENT_VERSION}`});
});

const server = http.createServer(app);
server.listen(port, host, () => {
  console.log(`The server is running on http://${host}:${port}`);
});
