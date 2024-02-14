require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const uuid = require('uuid');
const jwt = require('jsonwebtoken');
const secretKey = '123';
const axios = require('axios');
const moment = require('moment');
const http = require('http');
const dayjs = require('dayjs');

// const morgan = require('morgan');


const app = express();
const port = 3001;
const host = '0.0.0.0'
const mongoURI = process.env.MONGODB_URI;

app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb'}));
// app.use(morgan('combined'));

const PlanningTreeModel = require('./models/planningTreeModel');
const User = require('./models/userModel')
const NodeModel = require('./models/nodeModel')
const Game = require('./models/gameModel')
const Studio = require('./models/studioModel')
const Publisher = require('./models/publisherModel')
const RemoteConfig = require('./models/remoteConfigModel')
const AnalyticsEvents = require('./models/analyticsevents')
const Segments = require('./models/segmentsModel')
const PlayerWarehouse = require('./models/playerWarehouseModel')
const Relations = require('./models/relationsModel.js')
const segmentsLib = require('./segmentsLib.cjs')
const druidLib = require('./druidLib.cjs')
const playerWarehouseLib = require('./playerWarehouseLib.cjs')



mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });



app.use(bodyParser.json());

app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb'}));

// CORS
const whitelist = `${process.env.CORS_WHITELIST}`.split(',');
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || whitelist.includes(origin)) {
      callback(null, true);
    } else if (origin.match(/https?:\/\/localhost:?[0-9]*$/)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};
app.use(cors(corsOptions));

// Регистрация нового пользователя
app.post('/api/register', async (req, res) => {
  const { user, email, password } = req.body;

  try {
    // Проверяем, существует ли пользователь с таким именем
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Пользователь с таким Email уже существует' });
    }
    // Создаем нового пользователя
    const newUser = new User({ user, email, password });

    await newUser.save();
    res.status(201).json({ message: 'Пользователь успешно зарегистрирован' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Ошибка при регистрации пользователя' });
  }
});

// Аутентификация пользователя
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    console.log( user ? `User found by email` : 'User not found');

    if (user) {
      const isPasswordMatch = password === user.password;
      console.log('Comparing result: ', isPasswordMatch, '. Compared ', password, ' and ', user.password);

      // if (isPasswordMatch) {
      if (isPasswordMatch) {


        const login = (credentials) => {
          // Ваша логика аутентификации здесь, например, проверка ваших данных в базе данных

          // Здесь создается пример токена
          const token = jwt.sign({ userId: 'your-user-id' }, secretKey, { expiresIn: '1h' });

          return {
            success: true,
            token,
            expiresIn: 3600, // Время в секундах, на которое действителен токен
            authUserState: 'your-auth-user-state',
            // refreshToken: 'your-refresh-token',
            // refreshTokenExpireIn: 86400, // Пример: refreshToken действителен 24 часа
          };
        };

        // Пароль верен, генерируем JWT и отправляем клиенту
        const response = login({email, password})
        // token = jwt.sign({ email }, secretKey, { expiresIn: '100h' });
        res.status(200).json(response);
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

// Добавление нового паблишера, назначение создателя всеми правами на свете
app.post('/api/addPublisher', async (req, res) => {
  // console.log("Новый запрос на создание паблишера");
  const { publisherName, email } = req.body;
  // console.log(req.body);

  try {
    const user = await User.findOne({ email });
    if (user) {
      const publisherID = uuid.v4();
      // Создать нового паблишера
      const publisher = new Publisher({ publisherID, publisherName });
      // Сохранить паблишера в базу данных
      await publisher.save();
      // console.log("Сохраняем паблишера");

      // Создать объект разрешения для read
      const newPermission = { permission: 'read' };

      // Найти пользователя в паблишерах и добавить разрешение
      publisher.users.push({ userID: user.email, userPermissions: [newPermission] });

      // Сохранить обновленного паблишера
      await publisher.save();
      // console.log("Сейвим паблишера с разрешением read для пользователя");

      // Получить обновленный список паблишеров, у которых у пользователя есть права read
      res.json({
        publisherID: publisher.publisherID,
        publisherName: publisher.publisherName,
      });
      // console.log('Создан паблишер с именем:', publisherName, 'и ID:', publisherID);
    } else {
      // Вернуть сообщение об ошибке, если пользователь не найден
      res.status(404).json({ message: 'Пользователь не найден' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Произошла ошибка на сервере' });
  }
});

// Получение списка всех паблишеров
app.post('/api/getPublishers', async (req, res) => {
  const { email } = req.body;

  // Найдите пользователя по email
  const user = await User.findOne({ email });
  console.log(user ? `User found by email` : 'User not found');

  if (!user) {
    return res.status(200).json({ success: false, error: 'User not found' });
  }

  const publishers = await Publisher.find(
    {
      'users.userID': user.email,
    },
    // Выбирайте только нужные поля (publisherID и publisherName)
    'publisherID publisherName -_id'  // С указанием "-_id" исключите _id из результата
  );

  res.json({success: true, publishers});
});




// Добавление студии к паблишеру
app.post('/api/addStudio', async (req, res) => {
  // console.log("Новый запрос на создание студии");
  const { publisherID, studioName, email } = req.body;
  // console.log(req.body);

  try {
    const user = await User.findOne({ email });
    if (user) {
      const studioID = uuid.v4();
      // Создать нового паблишера
      const studio = new Studio({ studioID, studioName });
      // Сохранить паблишера в базу данных
      await studio.save();
      // console.log("Сохраняем студию");


      // Добавляем новоиспечённый uuid студии к паблишеру
      const publisher = await Publisher.findOne({ publisherID });
      if (publisher) {
        publisher.studios.push({ studioID });
        await publisher.save();
        // console.log("Сейвим студию в паблишера");
      } else {
        // console.log("Паблишер не найден.");
      }

      // Создать объект разрешения для read
      const newPermission = { permission: 'read' };

      // Найти пользователя в паблишерах и добавить разрешение
      studio.users.push({ userID: user.email, userPermissions: [newPermission] });

      // Сохранить обновленного паблишера
      await studio.save();
      // console.log("Сейвим студию с разрешением read для пользователя");

      // Получить обновленный список паблишеров, у которых у пользователя есть права read
      const studios = await Studio.find({ 'users.userID': user.email });

      const result = studios.map(studio => ({
        studioID: studio.studioID,
        studioName: studio.studioName // Используем studioName из найденной студии
      }));
      res.json(result);

    } else {
      // Вернуть сообщение об ошибке, если пользователь не найден
      res.status(404).json({ message: 'Пользователь не найден' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Произошла ошибка на сервере' });
  }
});

app.post('/api/getPublisherStudios', async (req, res) => {
  const { publisherID } = req.body;

  try {
    // Найти паблишера по его publisherID
    const publisher = await Publisher.findOne({ publisherID });

    if (publisher) {
      const studioIDs = publisher.studios.map(studio => studio.studioID);

      // Затем найдите названия студий по соответствующим studioID
      const studios = await Studio.find({ studioID: { $in: studioIDs } })
        .select('studioID studioName'); // Выбираем только studioID и studioName

      const result = studios.map(studio => ({
        studioID: studio.studioID,
        studioName: studio.studioName // Используем studioName из найденной студии
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



// Просмотр всех игр в студии
app.post('/api/getStudioGames', async (req, res) => {
  const { studioID } = req.body;
  // console.log(studioID);
  try {
    // Находим студию по studioID
    const studio = await Studio.findOne({ studioID: studioID });

    if (!studio) {
      return res.status(404).json({ error: 'Студия не найдена' });
    }

    // Получаем список gameID из схемы студии
    const gameIDs = studio.games.map(game => game.gameID);

    // Находим игры, соответствующие gameID
    const games = await Game.find({ gameID: { $in: gameIDs } });
    // console.log(games);
    res.json(games);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Произошла ошибка на сервере' });
  }
});

// Создание игры в студии
app.post('/api/createGame', async (req, res) => {
  const { studioID, gameName, gameEngine, gameKey, gameIcon } = req.body;

  // Создаем новый gameID с использованием uuid
  const newGameID = uuid.v4();

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
          planningTypes: [],
        },
        {
          branch: 'stage',
          planningTypes: [],
        },
        {
          branch: 'production',
          planningTypes: [],
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

    // Creating new game doc in PlayerWarehouse
    const newPlayerWarehouse = new PlayerWarehouse({
      gameID: newGameID,
      branches: [
        {
          branch: 'development',
          templates: {},
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
    await newPlayerWarehouse.save();

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

    // Creating new game doc in Segments
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
    Studio.findOneAndUpdate(
      { studioID: studioID },
      { $pull: { games: { gameID: gameID } } },
      { new: true }
    );
    NodeModel.findOneAndRemove({ gameID });
    Segments.findOneAndRemove({ gameID });
    Relations.findOneAndRemove({ gameID });
    PlayerWarehouse.findOneAndRemove({ gameID });
    AnalyticsEvents.findOneAndRemove({ gameID });
    RemoteConfig.findOneAndRemove({ gameID });
    PlanningTreeModel.findOneAndRemove({ gameID });

    await Game.findOneAndRemove({ gameID });

    res.status(200).json({success: true, message: 'Game removed successfully'})

  } catch (error) {
    console.error('Error removeGame:', error)
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

    const game = await Game.findOne({ gameID: gameID }, 'gameName gameEngine gameIcon gameSecretKey');
    if (!game) {
      return res.status(404).send('Game not found');
    }

    res.json({ success: true,
      gameName: game.gameName,
      gameEngine: game.gameEngine,
      gameIcon: game.gameIcon,
      gameSecretKey: game.gameSecretKey
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
    const templates = await PlayerWarehouse.find(
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
    const result = await PlayerWarehouse.updateMany(
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
      return inputNodes.map(({ _id, nodeID, subnodes, isGameplay, gameplayName }) => ({
        ID: nodeID,
        Subnodes: transformNodes(subnodes),
        _id: _id,
        isGameplay: isGameplay,
        gameplayName: gameplayName,
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
  try {
    const { gameID, branchName, planningType, parentId, newNode } = req.body;

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
    // Рекурсивная функция для поиска и обновления узла
    const findAndUpdateNode = (nodes) => {
      for (const node of nodes) {
        if (node._id.toString() === parentId) {
          // Найден узел с соответствующим parentId
          const newNodeObject = {
            nodeID: newNode,
            subnodes: [],
            _id: new mongoose.Types.ObjectId(),
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
      return res.status(200).json({ success: true });
    } else {
      // Если не найден узел с указанным parentId
      return res.status(404).json({ error: 'Node with parentId not found' });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
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

  try {
    // Найти документ PlanningTreeModel по gameID
    const planningTree = await PlanningTreeModel.findOne({ gameID });

    if (!planningTree) {
      return res.status(404).json({ message: 'PlanningTree not found' });
    }

    // Найти ветку с соответствующим именем
    const branchIndex = planningTree.branches.findIndex((b) => b.branch === branchName);

    if (branchIndex === -1) {
      return res.status(404).json({ message: 'Branch not found' });
    }

    // Найти планировочный тип с соответствующим типом
    const planningTypeIndex = planningTree.branches[branchIndex].planningTypes.findIndex(
      (p) => p.type === planningType
    );

    if (planningTypeIndex === -1) {
      return res.status(404).json({ message: 'PlanningType not found' });
    }

    // Найти ноду, куда нужно переместить
    const destinationNode = findNodeById(planningTree.branches[branchIndex].planningTypes[planningTypeIndex].nodes, destinationID);

    if (!destinationNode) {
      return res.status(404).json({ message: 'Destination node not found' });
    }

    // Удалить ноду из исходного места
    const removedNode = removeNodeById(planningTree.branches[branchIndex].planningTypes[planningTypeIndex].nodes, nodeToMove._id)

    if (removedNode === undefined) {
      return res.status(404).json({ message: 'Node to remove not found' });
    }

    // Переместить ноду в новое место
    const findAndUpdateNode = async (nodes) => {
      for (const node of nodes) {
        if (node._id.toString() === destinationID) {
          // Найден узел с соответствующим parentId
          const newNodeObject = {
            nodeID: nodeToMove.ID,
            gameplayName: nodeToMove.gameplayName,
            isGameplay: nodeToMove.isGameplay,
            subnodes: nodeToMove.subnodes,
          };
          node.subnodes.push(newNodeObject);
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
    res.status(200).json({ success: true, message: 'Node moved successfully' });
  } catch (error) {
    console.error('Error moving node in tree:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

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
    const { gameID, branchName, nodeID } = req.body;

    if (!gameID || !branchName || !nodeID) {
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
    const nodeModel = await NodeModel.findOne({ gameID, 'branches.branch': branchName });
    if (nodeModel) {
      nodeModel.branches.forEach(branch => {
        if (branch.branch === branchName) {
          branch.planningTypes.forEach(planningType => {
            planningType.nodes.forEach(node => {
              if (node.nodeID === nodeID) {
                node.analyticsEvents.push(eventID);
              }
            });
          });
        }
      });
      await nodeModel.save();
    }

    res.status(200).json({
      success: true,
      message: 'New analytics event created',
      eventID
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

    // Удаление нежелательных полей '_id' из массива 'values'
    if (eventObject.values && Array.isArray(eventObject.values)) {
      eventObject.values.forEach(value => {
        delete value._id;
      });
    }

    // Найти и обновить ивент в коллекции AnalyticsEvents
    const updatedAnalyticsEvent = await AnalyticsEvents.findOneAndUpdate(
      { 'gameID': gameID, 'branches.branch': branchName, 'branches.events.eventID': eventID },
      {
        $set: {
          'branches.$[b].events.$[e].eventName': eventObject.eventName,
          'branches.$[b].events.$[e].eventCodeName': eventObject.eventCodeName,
          'branches.$[b].events.$[e].values': eventObject.values,
          'branches.$[b].events.$[e].comment': eventObject.comment,
          'branches.$[b].events.$[e].tags': eventObject.tags,
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
    const playerWarehouse = await PlayerWarehouse.findOne({ gameID, 'branches.branch': branchName });

    // Если не найдены, возвращаем ошибку
    if (!playerWarehouse) {
      return res.status(404).json({ message: 'PlayerWarehouse not found for the specified gameID and branchName' });
    }

    // Поиск ветки по branchName
    const branch = playerWarehouse.branches.find(b => b.branch === branchName);

    // Если не найдена ветка, возвращаем ошибку
    if (!branch) {
      return res.status(404).json({ message: 'Branch not found for the specified branchName' });
    }

    // Получение количества игроков в массиве players
    const playerCount = branch.players.length;

    // Возвращаем успешный ответ с количеством игроков
    res.status(200).json({ success: true, playerCount });

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
    const playerWarehouse = await PlayerWarehouse.findOne({ gameID, 'branches.branch': branchName });

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

      // Обновление segmentConditions в найденном сегменте
      const updatedBranches = segment.branches.map(branch => {
          if (branch.branch === branchName) {
              const updatedSegments = branch.segments.map(segment => {
                  if (segment.segmentID === segmentID) {
                      segment.segmentConditions = segmentConditions;
                  }
                  return segment;
              });

              branch.segments = updatedSegments;
          }
          return branch;
      });

      // Сохранение обновленного документа
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
    const playersWithSegment = await PlayerWarehouse.find({
      'gameID': gameID,
      'branches.branch': branchName,
      'branches.players.segments': segmentID,
    });

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

      let players = await PlayerWarehouse.find({
        gameID,
        'branches.branch': branchName,
        'branches.players.clientID': { $in: clientIDs.map(String) },
      });

      players = players[0].branches.reduce((acc, branch) => {
        if (branch.branch === branchName) {
          acc = [...acc, ...branch.players];
        }
        return acc;
      }, []);
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
    let playerWarehouse = await PlayerWarehouse.findOne({ gameID });
    // Если не найден, создать новый документ
    if (!playerWarehouse) {
      playerWarehouse = await PlayerWarehouse.create({
        gameID,
        branches: [{ branch: branchName, templates: { statistics: [] } }],
      });
    } else {
      // Проверить, существует ли уже branch с указанным branchName
      const existingBranchIndex = playerWarehouse.branches.findIndex((b) => b.branch === branchName);
      // Если не существует, создать новый branch
      if (existingBranchIndex === -1) {
        playerWarehouse.branches.push({ branch: branchName, templates: { statistics: [] } });
      }
    }

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
app.post('/api/getWarehouseTemplates', async (req, res) => {
  const { gameID, branchName } = req.body;

  try {
    // Найти документ PlayerWarehouse по gameID и branchName
    let playerWarehouse = await PlayerWarehouse.findOne({
      gameID,
      'branches.branch': branchName,
    });

    // Если не найден, создать новый документ
    if (!playerWarehouse) {
      playerWarehouse = await PlayerWarehouse.create({
        gameID,
        branches: [{ branch: branchName, templates: {} }],
      });
    }

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
    const playerWarehouse = await PlayerWarehouse.findOne({ gameID, 'branches.branch': branchName });

    if (!playerWarehouse) {
      return res.status(404).json({ message: 'PlayerWarehouse not found' });
    }

    // Извлечь нужный branch
    const branch = playerWarehouse.branches.find((b) => b.branch === branchName);

    // Извлечь массив clientID из players
    const playerIDs = branch.players.map((player) => player.clientID);

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
    const playerWarehouse = await PlayerWarehouse.findOne({
      gameID,
      'branches.branch': branchName,
      'branches.players.clientID': clientID,
    });

    if (!playerWarehouse) {
      return res.status(404).json({ message: 'PlayerWarehouse not found' });
    }

    // Извлечь нужный branch
    const branch = playerWarehouse.branches.find((b) => b.branch === branchName);

    // Извлечь объект player с соответствующим clientID
    const player = branch.players.find((p) => p.clientID === clientID);

    res.status(200).json({ success: true, player });
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
                events: await Promise.all(node.analyticsEvents.map(async eventID => {
                  const event = await AnalyticsEvents.findOne({ 'branches.branch': branchName, 'gameID': gameID, 'branches.events.eventID': eventID });

                  return {
                    eventID: eventID,
                    eventName: event
                      ? event.branches.find(b => b.branch === branchName)?.events.find(e => e.eventID === eventID)?.eventName || 'Event not found'
                      : 'Event not found',
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
    let playerWarehouse = await PlayerWarehouse.findOne({ gameID });

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

        let players = await PlayerWarehouse.find({
          gameID,
          'branches.branch': branchName,
          'branches.players.clientID': { $in: clientIDs.map(String) },
        });

        players = players[0].branches.reduce((acc, branch) => {
          if (branch.branch === branchName) {
            acc = [...acc, ...branch.players];
          }
          return acc;
        }, []);

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

    const result = await PlayerWarehouse.findOneAndUpdate(
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
    const deltaResponse = await druidLib.getDAU(gameID, branchName, deltaStartDate, deltaEndDate, deltaDateDiff, clientIDs)
    const response = await druidLib.getDAU(gameID, branchName, startDate, endDate, dateDiff, clientIDs)

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
    const deltaResponse = await druidLib.getRevenue(gameID, branchName, deltaStartDate, deltaEndDate, deltaDateDiff, clientIDs)
    const response = await druidLib.getRevenue(gameID, branchName, startDate, endDate, dateDiff, clientIDs)

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
          admob: 111,
          applovin: 111,
          ironsource: 111,
          unityads: 444,
        }
      },
      {
        countryName: 'Japan',
        installs: {
          admob: 3223,
          applovin: 111,
          ironsource: 222,
          unityads: 222,
        }
      },
      {
        countryName: 'United States',
        installs: {
          admob: 111,
          applovin: 2,
          ironsource: 2,
          unityads: 444,
        }
      },
      {
        countryName: 'France',
        installs: {
          admob: 12,
          applovin: 300,
          ironsource: 0,
          unityads: 11,
        }
      },
      {
        countryName: 'Italy',
        installs: {
          admob: 111,
          applovin: 222,
          ironsource: 333,
          unityads: 444,
        }
      },
      {
        countryName: 'Switzerland',
        installs: {
          admob: 111,
          applovin: 222,
          ironsource: 333,
          unityads: 444,
        }
      },
      {
        countryName: 'China',
        installs: {
          admob: 111,
          applovin: 222,
          ironsource: 333,
          unityads: 444,
        }
      },
      {
        countryName: 'Germany',
        installs: {
          admob: 111,
          applovin: 222,
          ironsource: 333,
          unityads: 444,
        }
      },
      {
        countryName: 'Australia',
        installs: {
          admob: 111,
          applovin: 222,
          ironsource: 333,
          unityads: 444,
        }
      },
      {
        countryName: 'New Zealand',
        installs: {
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
        installs: 123,
        cpi: '1.02',
        costs: '59285.00',
        payingshare: '2.21',
        arpu: '1.21',
        revenue: '52285.00',
        roi: '89.71'
      },
      {
        networkName: 'adcolony',
        installs: 123,
        cpi: '1.02',
        costs: '59285.00',
        payingshare: '2.21',
        arpu: '1.21',
        revenue: '52285.00',
        roi: '89.71'
      },
      {
        networkName: 'unityads',
        installs: 123,
        cpi: '1.02',
        costs: '59285.00',
        payingshare: '2.21',
        arpu: '1.21',
        revenue: '52285.00',
        roi: '89.71'
      },
      {
        networkName: 'ironsource',
        installs: 123,
        cpi: '1.02',
        costs: '59285.00',
        payingshare: '2.21',
        arpu: '1.21',
        revenue: '52285.00',
        roi: '89.71'
      },
      {
        networkName: 'applovin',
        installs: 123,
        cpi: '1.02',
        costs: '59285.00',
        payingshare: '2.21',
        arpu: '1.21',
        revenue: '52285.00',
        roi: '89.71'
      },
      {
        networkName: 'fyber',
        installs: 123,
        cpi: '1.02',
        costs: '59285.00',
        payingshare: '2.21',
        arpu: '1.21',
        revenue: '52285.00',
        roi: '89.71'
      },
      {
        networkName: 'facebook',
        installs: 123,
        cpi: '1.02',
        costs: '59285.00',
        payingshare: '2.21',
        arpu: '1.21',
        revenue: '52285.00',
        roi: '89.71'
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



app.post('/api/testFunc', async (req, res) => {
  const {gameID, branchName} = req.body

  res.status(200).json({success: true, message: req.body})


  // const templateID = '657a3a59e70105297e4d70dc'

  // let playerWarehouse = await PlayerWarehouse.findOne({
  //   gameID,
  //   'branches.branch': branchName,
  //   'branches.templates.analytics.templateID': templateID
  // });

  // const template = playerWarehouse.branches[0].templates.analytics.find((template) => template.templateID === templateID)

  // const response = await calculateInitialElementValue(gameID, branchName, template)
  // const mostCOmmon = await druidLib.getMostCommonValue(gameID, branchName, 'abobaClientID', 'designEvent', 'someEventID', 'value1')
  // playerWarehouseLib.setElementValues(gameID, branchName, 'abobaClientID', template.templateID, mostCOmmon)

  // const endDate = moment()
  // const startDate = moment().subtract(1, 'days')

  // console.log('Date diff:', endDate.diff(startDate, 'days'))

  // const response = await druidLib.getNewUsers(gameID, branchName, startDate, endDate)

  // res.status(200).json({success: true, message: response})
});

app.get('/health', async (req, res, next) => {
  res.json({health: 'ok'});
});

const server = http.createServer(app);
server.listen(port, host, () => {
  console.log(`The server is running on http://${host}:${port}`);
});
