require('dotenv').config();


const express = require('express');
const cors = require('cors');
const axios = require('axios');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const uuid = require('uuid');
const jwt = require('jsonwebtoken');
const secretKey = '123';
const { Kafka } = require('kafkajs');



const app = express();
const port = process.env.PORT || 3005;
const mongoURI = process.env.MONGODB_URI;

app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb'}));

const EventEmitter = require('eventemitter3')
const emitter = new EventEmitter()


mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });

app.use(bodyParser.json());

app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb'}));

const NodeModel = require('./models/nodeModel')
const Game = require('./models/gameModel')
const PlayerWarehouse = require('./models/playerWarehouseModel')
const AnalyticsEvents = require('./models/analyticsevents')
const Segments = require('./models/segmentsModel')
const RemoteConfig = require('./models/remoteConfigModel')
const segmentsLib = require('./segmentsLib.cjs')
const druidLib = require('./druidLib.cjs')
const playerWarehouseLib = require('./playerWarehouseLib.cjs')


const druidRequestOptions = {
  method: 'post',
  headers: {
    'Content-Type': 'application/vnd.kafka.json.v2+json'
  }
};


// Разрешить запросы с указанных доменов и поддерживать учетные данные
const allowedOrigins = ['http://localhost:5173', 'http://26.250.173.89:5173', 'http://26.250.173.89'];

app.use(cors({
  origin: function (origin, callback) {
    callback(null, true);
  },
  credentials: true,
}));

// Getting gameID by secretKey
async function getGameID(secretKey) {
  try {
    // Поиск документа в коллекции Game по gameSecretKey
    const gameDocument = await Game.findOne({ gameSecretKey: secretKey }).exec();

    if (!gameDocument) {
      return false;
    }

    const { gameID } = gameDocument;
    return gameID;
  } catch (error) {
    console.error(error);
  }
};
// Clean up given values by their type and throw errors. Called from setWarehouseDataElement and other related calls
const validateAndTransformValue = (value, elementID, templates) => {
  // Найти соответствующий элемент в templates.statistics по elementID
  const template = templates.statistics.find((template) => template.templateCodeName === elementID);

  if (!template) {
    throw new Error('Template not found');
  }

  // Получить тип шаблона
  const templateType = template.templateType.toLowerCase();

  // Преобразовать значение в зависимости от типа шаблона
  switch (templateType) {
    case 'string':
      // Для типа string пропускаем любые значения
      return String(value);
    case 'integer':
      // Для типа integer пропускаем только числа 0-9
      const intValue = parseInt(value);
      if (isNaN(intValue)) {
        throw new Error(`Invalid value passed to element. Element '${template.templateName}' is '${template.templateType}', passed value '${value}' is not a number`);
      }
      return intValue;
    case 'float':
      // Для типа float пропускаем только числа с плавающей точкой
      const floatValue = parseFloat(value);
      if (isNaN(floatValue)) {
        throw new Error(`Invalid value passed to element. Element '${template.templateName}' is '${template.templateType}', passed value '${value}' is not a float`);
      }
      return floatValue;
    case 'bool':
      // Для типа bool пропускаем только true и false
      const lowerCaseValue = String(value).toLowerCase();
      if (lowerCaseValue === 'true') {
        return true;
      } else if (lowerCaseValue === 'false') {
        return false;
      } else {
        throw new Error(`Invalid value passed to element. Element '${template.templateName}' is '${template.templateType}', passed value '${value}' is not "true" or "false"`);
      }
    default:
      throw new Error('Invalid template type');
  }
};

// Returns entities from planning section and their custom properties
app.get('/api/sdk/getAllEntitiesID', async (req, res) => {
  try {
    const { secretKey } = req.query;


    const gameID = await getGameID(secretKey)

    // Поиск документов в коллекции nodes по gameID
    const nodes = await NodeModel.find({ 'branches.planningTypes.nodes.entityProperties.entityID': { $exists: true }, gameID }).exec();

    if (!nodes) {
      return res.status(404).json({ message: 'Game not found' });
    }


    // Извлечение entityID из всех найденных документов
    const allEntitiesID = nodes.reduce((acc, currentNode) => {
      currentNode.branches.forEach((branch) => {
        branch.planningTypes.forEach((planningType) => {
          planningType.nodes.forEach((node) => {
            const { entityID } = node.entityProperties;
            if (entityID) {
              acc.push(entityID);
            }
          });
        });
      });
      return acc;
    }, []);

    // Удаление пустых значений
    const nonEmptyEntitiesID = allEntitiesID.filter(Boolean);
    return res.status(200).json({ entitiesID: nonEmptyEntitiesID });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
// Gets a single entity with it's custom properties
app.get('/api/sdk/getEntityByID', async (req, res) => {
  const { secretKey, entityID } = req.query;

  const gameID = await getGameID(secretKey)

  try {
    // Найти соответствующую ноду
    const resultNode = await NodeModel.findOne({ gameID });
    if (!resultNode) {
      return res.status(404).json({ message: 'Game not found' });
    }

    // Найти соответствующую ветвь и узел внутри нее
    const selectedNode = resultNode.branches.reduce((acc, branch) => {
      const foundNode = branch.planningTypes.reduce((nodeAcc, planningType) => {
        const entityNode = planningType.nodes.find(node => node.entityProperties.entityID === entityID);
        return entityNode ? entityNode : nodeAcc;
      }, null);
      return foundNode ? foundNode : acc;
    }, null);

    if (!selectedNode) {
      return res.status(404).json({ message: 'Entity not found in the specified branch' });
    }

    // Вернуть entityProperties, если найдено
    res.status(200).json({ entityProperties: selectedNode.entityProperties });
  } catch (error) {
    console.error('Error fetching entity by ID:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Operating with Player Warehouse statistics elements
app.post('/api/sdk/setWarehouseDataElement', async (req, res) => {
  const { secretKey, clientID, elementID, value } = req.body;
  const branchName = 'development'; // Название ветки

  try {
    // Получить gameID на основе secretKey
    const gameID = await getGameID(secretKey);

    // Найти документ PlayerWarehouse по gameID
    let playerWarehouse = await PlayerWarehouse.findOne({
      gameID,
    });

    // Если не найден, создать новый документ с веткой
    if (!playerWarehouse) {
      playerWarehouse = await PlayerWarehouse.create({
        gameID,
        branches: [{ branch: branchName, templates: { statistics: [] }, players: [] }],
      });
    } else {
      // Если найден, проверить наличие ветки
      const branchIndex = playerWarehouse.branches.findIndex((b) => b.branch === branchName);
      
      if (branchIndex === -1) {
        // Если ветки нет, добавить новую ветку
        playerWarehouse.branches.push({ branch: branchName, templates: { statistics: [] }, players: [] });
      }
    }

    // Найти или создать player с соответствующим clientID
    let player = playerWarehouse.branches.find(
      (b) => b.branch === branchName
    ).players.find((p) => p.clientID === clientID);

    if (!player) {
      // Если не найден, создать нового player
      player = { clientID, elements: { statistics: [] } };
      playerWarehouse.branches.find((b) => b.branch === branchName).players.push(player);
    }

    // Проверить существование шаблона с соответствующим elementID в templates.statistics
    const template = playerWarehouse.branches
      .find((b) => b.branch === branchName)
      .templates.statistics.find((t) => t.templateCodeName === elementID);

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    // Используем функцию validateAndTransformValue для проверки и преобразования значения
    try {
      const transformedValue = validateAndTransformValue(value, elementID, playerWarehouse.branches.find((b) => b.branch === branchName).templates);
      
      // Найти элемент в elements.statistics с соответствующим elementID
      const elementIndex = player.elements.statistics.findIndex((element) => element.elementID === template.templateID,);

      if (elementIndex === -1) {
        // Если не найден, создать новый элемент
        const newElement = {
          elementID: template.templateID,
          elementValue: transformedValue,
        };

        player.elements.statistics.push(newElement);
      } else {
        // Обновить значение элемента
        player.elements.statistics[elementIndex].elementValue = transformedValue;
      }

      // Сохранить изменения в базе данных
      await playerWarehouse.save();

      res.status(200).json({ success: true, message: 'Warehouse data element updated successfully' });
      recalculateSegments(gameID, branchName, clientID, template)
    } catch (validationError) {
      // Обработка ошибок валидации
      return res.status(400).json({ message: validationError.message });
    }
  } catch (error) {
    console.error('Error setting warehouse data element:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});
app.post('/api/sdk/addWarehouseDataElement', async (req, res) => {
  const { secretKey, clientID, elementID, value } = req.body;
  const branchName = 'development'; // Название ветки

  try {
    // Получить gameID на основе secretKey
    const gameID = await getGameID(secretKey);

    // Найти документ PlayerWarehouse по gameID
    let playerWarehouse = await PlayerWarehouse.findOne({
      gameID,
    });

    // Если не найден, создать новый документ с веткой
    if (!playerWarehouse) {
      playerWarehouse = await PlayerWarehouse.create({
        gameID,
        branches: [{ branch: branchName, templates: { statistics: [] }, players: [] }],
      });
    } else {
      // Если найден, проверить наличие ветки
      const branchIndex = playerWarehouse.branches.findIndex((b) => b.branch === branchName);

      if (branchIndex === -1) {
        // Если ветки нет, добавить новую ветку
        playerWarehouse.branches.push({ branch: branchName, templates: { statistics: [] }, players: [] });
      }
    }

    // Найти или создать player с соответствующим clientID
    let player = playerWarehouse.branches.find(
      (b) => b.branch === branchName
    ).players.find((p) => p.clientID === clientID);

    if (!player) {
      // Если не найден, создать нового player
      player = { clientID, elements: { statistics: [] } };
      playerWarehouse.branches.find((b) => b.branch === branchName).players.push(player);
    }

    // Проверить существование шаблона с соответствующим elementID в templates.statistics
    const template = playerWarehouse.branches
      .find((b) => b.branch === branchName)
      .templates.statistics.find((t) => t.templateCodeName === elementID);

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    // Используем функцию validateAndTransformValue для проверки и преобразования значения
    try {
      const transformedValue = validateAndTransformValue(value, elementID, playerWarehouse.branches.find((b) => b.branch === branchName).templates);

      // Найти элемент в elements.statistics с соответствующим elementID
      const elementIndex = player.elements.statistics.findIndex((element) => element.elementID === template.templateID,);

      if (elementIndex === -1) {
        // Если не найден, создать новый элемент
        let transformedDefaultValue;
        if (template.templateType.toLowerCase() === 'float') {
          transformedDefaultValue = parseFloat(template.templateDefaultValue);
        } else if (template.templateType.toLowerCase() === 'integer') {
          transformedDefaultValue = parseInt(template.templateDefaultValue);
        }

        const newElement = {
          elementID: template.templateID,
          elementValue: transformedDefaultValue + transformedValue,
        };

        player.elements.statistics.push(newElement);
      } else {
        // Проверить templateType
        if (template.templateType.toLowerCase() === 'string' || template.templateType.toLowerCase() === 'bool') {
          throw new Error(`Cannot perform "add" operation on '${template.templateType}' element type`);
        }

        // Прибавить значение к текущему elementValue
        let currentValue;

        if (template.templateType.toLowerCase() === 'float') {
          currentValue = parseFloat(player.elements.statistics[elementIndex].elementValue);
        } else if (template.templateType.toLowerCase() === 'integer') {
          currentValue = parseInt(player.elements.statistics[elementIndex].elementValue);
        }
        
        let newValue = currentValue + transformedValue;

        // Обновить elementValue
        player.elements.statistics[elementIndex].elementValue = newValue;
      }

      // Сохранить изменения в базе данных
      await playerWarehouse.save();

      res.status(200).json({ success: true, message: 'Warehouse data element updated successfully' });

      recalculateSegments(gameID, branchName, clientID, template)


    } catch (validationError) {
      // Обработка ошибок валидации
      return res.status(400).json({ message: validationError.message });
    }
  } catch (error) {
    console.error('Error adding warehouse data element:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});
app.post('/api/sdk/subtractWarehouseDataElement', async (req, res) => {
  const { secretKey, clientID, elementID, value } = req.body;
  const branchName = 'development'; // Название ветки

  try {
    // Получить gameID на основе secretKey
    const gameID = await getGameID(secretKey);

    // Найти документ PlayerWarehouse по gameID
    let playerWarehouse = await PlayerWarehouse.findOne({
      gameID,
    });

    // Если не найден, создать новый документ с веткой
    if (!playerWarehouse) {
      playerWarehouse = await PlayerWarehouse.create({
        gameID,
        branches: [{ branch: branchName, templates: { statistics: [] }, players: [] }],
      });
    } else {
      // Если найден, проверить наличие ветки
      const branchIndex = playerWarehouse.branches.findIndex((b) => b.branch === branchName);

      if (branchIndex === -1) {
        // Если ветки нет, добавить новую ветку
        playerWarehouse.branches.push({ branch: branchName, templates: { statistics: [] }, players: [] });
      }
    }

    // Найти или создать player с соответствующим clientID
    let player = playerWarehouse.branches.find(
      (b) => b.branch === branchName
    ).players.find((p) => p.clientID === clientID);

    if (!player) {
      // Если не найден, создать нового player
      player = { clientID, elements: { statistics: [] } };
      playerWarehouse.branches.find((b) => b.branch === branchName).players.push(player);
    }

    // Проверить существование шаблона с соответствующим elementID в templates.statistics
    const template = playerWarehouse.branches
      .find((b) => b.branch === branchName)
      .templates.statistics.find((t) => t.templateCodeName === elementID);

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    // Используем функцию validateAndTransformValue для проверки и преобразования значения
    try {
      const transformedValue = validateAndTransformValue(value, elementID, playerWarehouse.branches.find((b) => b.branch === branchName).templates);

      // Найти элемент в elements.statistics с соответствующим elementID
      const elementIndex = player.elements.statistics.findIndex((element) => element.elementID === template.templateID);

      if (elementIndex === -1) {
        // Если не найден, создать новый элемент
        let transformedDefaultValue;
        if (template.templateType.toLowerCase() === 'float') {
          transformedDefaultValue = parseFloat(template.templateDefaultValue);
        } else if (template.templateType.toLowerCase() === 'integer') {
          transformedDefaultValue = parseInt(template.templateDefaultValue);
        }

        const newElement = {
          elementID: template.templateID,
          elementValue: transformedDefaultValue - transformedValue,
        };

        player.elements.statistics.push(newElement);
      } else {
        // Проверить templateType
        if (template.templateType.toLowerCase() === 'string' || template.templateType.toLowerCase() === 'bool') {
          throw new Error(`Cannot perform "add" operation on '${template.templateType}' element type`);
        }

        // Прибавить значение к текущему elementValue
        let currentValue;

        if (template.templateType.toLowerCase() === 'float') {
          currentValue = parseFloat(player.elements.statistics[elementIndex].elementValue);
        } else if (template.templateType.toLowerCase() === 'integer') {
          currentValue = parseInt(player.elements.statistics[elementIndex].elementValue);
        }
        
        let newValue = currentValue - transformedValue;

        // Обновить elementValue
        player.elements.statistics[elementIndex].elementValue = newValue;
      }

      // Сохранить изменения в базе данных
      await playerWarehouse.save();

      res.status(200).json({ success: true, message: 'Warehouse data element updated successfully' });

      recalculateSegments(gameID, branchName, clientID, template)


    } catch (validationError) {
      // Обработка ошибок валидации
      return res.status(400).json({ message: validationError.message });
    }
  } catch (error) {
    console.error('Error adding warehouse data element:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});
app.post('/api/sdk/getWarehouseDataElement', async (req, res) => {
  const { secretKey, clientID, elementID } = req.body;
  const branchName = 'development'; // Название ветки

  try {
    // Получить gameID на основе secretKey
    const gameID = await getGameID(secretKey);

    // Найти документ PlayerWarehouse по gameID
    let playerWarehouse = await PlayerWarehouse.findOne({
      gameID,
    });

    // Если не найден, создать новый документ с веткой
    if (!playerWarehouse) {
      playerWarehouse = await PlayerWarehouse.create({
        gameID,
        branches: [{ branch: branchName, templates: { statistics: [] }, players: [] }],
      });
    } else {
      // Если найден, проверить наличие ветки
      const branchIndex = playerWarehouse.branches.findIndex((b) => b.branch === branchName);
      
      if (branchIndex === -1) {
        // Если ветки нет, добавить новую ветку
        playerWarehouse.branches.push({ branch: branchName, templates: { statistics: [] }, players: [] });
      }
    }

    // Найти или создать player с соответствующим clientID
    let player = playerWarehouse.branches.find(
      (b) => b.branch === branchName
    ).players.find((p) => p.clientID === clientID);

    if (!player) {
      // Если не найден, создать нового player
      player = { clientID, elements: { statistics: [] } };
      playerWarehouse.branches.find((b) => b.branch === branchName).players.push(player);
    }

    // Проверить существование шаблона с соответствующим elementID в templates.statistics
    const template = playerWarehouse.branches
      .find((b) => b.branch === branchName)
      .templates.statistics.find((t) => t.templateCodeName === elementID);

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }
    let retrievedValue;
    // Найти элемент в elements.statistics с соответствующим elementID
    const elementIndex = player.elements.statistics.findIndex((element) => element.elementID === template.templateID);
    if (elementIndex === -1) {
      // Если не найден, создать новый элемент
      const newElement = {
        elementID: template.templateID,
        elementValue: template.templateDefaultValue,
      };
      player.elements.statistics.push(newElement);

      retrievedValue = template.templateDefaultValue

    } else {
      retrievedValue = player.elements.statistics[elementIndex].elementValue
    }
    res.status(200).json({ success: true, message: 'Warehouse data element sent successfully', value: retrievedValue });

  } catch (error) {
    console.error('Error setting warehouse data element:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Function for GeoIP
async function getCountryByIP(ip) {
  return 'United States';
}

// Checking if designEvent with given ID does exist
async function checkEventID(gameID, eventID) {
  const branchName = 'development';
  try {
    const events = await AnalyticsEvents.find(
      { 'gameID': gameID, 'branches.branch': branchName, 'branches.events.eventCodeName': eventID },
      { 'branches.$': 1 }
    );

    const matchingEvent = events.find(event => event.branches[0].events[0].eventCodeName === eventID);

    if (matchingEvent) {
      const eventDetails = {
        eventID: matchingEvent.branches[0].events[0].eventID,
        eventCodeName: matchingEvent.branches[0].events[0].eventCodeName,

        // Grabbing values
        valueID1: matchingEvent.branches[0].events[0].values[0] !== undefined ? matchingEvent.branches[0].events[0].values[0]._id.toString() : '',
        valueFormat1: matchingEvent.branches[0].events[0].values[0] !== undefined ? matchingEvent.branches[0].events[0].values[0].valueFormat : '',

        valueID2: matchingEvent.branches[0].events[0].values[1] !== undefined ? matchingEvent.branches[0].events[0].values[1]._id.toString() : '',
        valueFormat2: matchingEvent.branches[0].events[0].values[1] !== undefined ? matchingEvent.branches[0].events[0].values[1].valueFormat : '',

        valueID3: matchingEvent.branches[0].events[0].values[2] !== undefined ? matchingEvent.branches[0].events[0].values[2]._id.toString() : '',
        valueFormat3: matchingEvent.branches[0].events[0].values[2] !== undefined ? matchingEvent.branches[0].events[0].values[2].valueFormat : '',
      };
      return { found: true, eventDetails };
    } else {
      return { found: false, eventDetails: null };
    }
  } catch (error) {
    console.error(`Error fetching eventID ${eventID} for branch "${branchName}" for game ${gameID}:`, error);
  }
}

// Before trying to operate on player's element, check if his event passes template's conditions
function checkTemplateConditions(templateObject, eventObject, value1, value2, value3) {

  let conditionPassed = true;

  templateObject.templateConditions.forEach((condition, index) => {

    if (!conditionPassed) return conditionPassed;
    
    if (condition.conditionEnabled) {
      

      let valueToCheck;
      let valueFormat;
      switch (condition.conditionValueID) {

        case eventObject.eventDetails.valueID1:
          valueToCheck = value1;
          valueFormat = eventObject.eventDetails.valueFormat1;
          break;

        case eventObject.eventDetails.valueID2:
          valueToCheck = value2;
          valueFormat = eventObject.eventDetails.valueFormat2;
          break;

        case eventObject.eventDetails.valueID3:
          valueToCheck = value3;
          valueFormat = eventObject.eventDetails.valueFormat3;
          break;

        default:
          break;
      }

      let conditionalValue = condition.conditionValue;
      let conditionalSecondValue = condition.conditionSecondaryValue;
      let processedValueToCheck;

      switch (valueFormat) {
        case 'string':
          stringCheck();
          break;
        case 'integer':
          mathCheck();
          break;
        case 'float':
          mathCheck();
          break;
        case 'percentile':
          mathCheck();
          break;
        case 'money':
          mathCheck();
          break;
        default:
          break;
      }

      function stringCheck() {
        switch (condition.condition) {
          case 'is':
            processedValueToCheck = valueToCheck.toString()
            conditionalValue = conditionalValue.toString()
            if (processedValueToCheck === conditionalValue) {
            } else {
              conditionPassed = false;
            }
          break;
  
          case 'isNot':
            processedValueToCheck = valueToCheck.toString()
            conditionalValue = conditionalValue.toString()
            if (processedValueToCheck !== conditionalValue) {
            } else {
              conditionPassed = false;
            }
          break;
        
          default:
            break;
        }
      }

      function mathCheck() {

        switch (condition.condition) {
          case '=':
            processedValueToCheck = parseFloat(valueToCheck)
            conditionalValue = parseFloat(conditionalValue)
            if (conditionalValue === processedValueToCheck) {
            } else {
              conditionPassed = false;
            }
          break;
  
          case '!=':
            processedValueToCheck = parseFloat(valueToCheck)
            conditionalValue = parseFloat(conditionalValue)
            if (conditionalValue !== processedValueToCheck) {
            } else {
              conditionPassed = false;
            }
          break;
  
          case '>':
            processedValueToCheck = parseFloat(valueToCheck)
            conditionalValue = parseFloat(conditionalValue)
            if (processedValueToCheck > conditionalValue) {
            } else {
              conditionPassed = false;
            }
          break;
  
          case '<':
            processedValueToCheck = parseFloat(valueToCheck)
            conditionalValue = parseFloat(conditionalValue)
            if (processedValueToCheck < conditionalValue) {
            } else {
              conditionPassed = false;
            }
          break;
  
          case '>=':
            processedValueToCheck = parseFloat(valueToCheck)
            conditionalValue = parseFloat(conditionalValue)
            if (processedValueToCheck >= conditionalValue) {
            } else {
              conditionPassed = false;
            }
          break;
  
          case '<=':
            processedValueToCheck = parseFloat(valueToCheck)
            conditionalValue = parseFloat(conditionalValue)
            if (processedValueToCheck <= conditionalValue) {
            } else {
              conditionPassed = false;
            }
          break;
          
          case 'range':
            processedValueToCheck = parseFloat(valueToCheck)
            conditionalValue = parseFloat(conditionalValue)
            if (processedValueToCheck >= conditionalValue && processedValueToCheck <= conditionalSecondValue) {
            } else {
              conditionPassed = false;
            }
          break;
          default:
            break;
        }
      }
    }
  })


  return conditionPassed;
}
// Create new player on newSession call, if there is none.
async function createNewPlayer(gameID, branchName, clientID) {
  try {
    // Проверка существования игры с указанным gameID
    let playerWarehouse = await PlayerWarehouse.findOne({ gameID: gameID });
    if (!playerWarehouse) {
      // Если игра не найдена, создаем новую
      playerWarehouse = new PlayerWarehouse({
        gameID: gameID,
        branches: [],
      });
    }

    // Проверка существования ветки с указанным branchName
    let branch = playerWarehouse.branches.find(b => b.branch === branchName);
    if (!branch) {
      // Если ветка не найдена, создаем новую
      branch = {
        branch: branchName,
        templates: { analytics: [], statistics: [] },
        players: [],
      };
      playerWarehouse.branches.push(branch);
    }

    // Проверка существования клиента с указанным clientID
    let existingPlayer = branch.players.find(p => p.clientID === clientID);
    if (!existingPlayer) {
      // Если клиент не найден, создаем нового
      const newPlayer = {
        clientID: clientID,
        elements: { analytics: [], statistics: [] },
        inventory: { entities: [] },
        goods: [],
        abtests: [],
        segments: [],
      };

      branch.players.push(newPlayer);

      // Сохранение изменений в базе данных
      await playerWarehouse.save();

      segmentsLib.addSegmentToPlayer(gameID, branchName, clientID, 'everyone')

      console.log(`Successfully created new player for gameID: ${gameID}, branchName: ${branchName}, clientID: ${clientID}`);
      return true;
    } else {
      console.log(`Player with clientID ${clientID} already exists in gameID: ${gameID}, branchName: ${branchName}`);
      return false;
    }
  } catch (error) {
    console.error('Error creating new player:', error);
    return false;
  }
}


// Recalculate player segments if his elementValue was changed
async function recalculateSegments(gameID, branchName, clientID, changedTemplate) {
  try {
    // Находим все сегменты, у которых conditionElementID совпадает с changedTemplate.templateID
    const segments = await Segments.find({
      'gameID': gameID,
      'branches': {
        $elemMatch: {
          'branch': branchName,
          'segments.segmentConditions': {
            $elemMatch: {
              'conditionElementID': changedTemplate.templateID,
            },
          },
        },
      },
    });

    // Извлекаем массив сегментов, у которых conditionElementID совпадает с changedTemplate.templateID
    const matchingSegments = segments.reduce((acc, curr) => {
      const matchingBranch = curr.branches.find(branch => branch.branch === branchName);
      if (matchingBranch) {
        const matchingSegmentConditions = matchingBranch.segments
          .filter(segment => segment.segmentConditions.some(condition => condition.conditionElementID === changedTemplate.templateID));

        if (matchingSegmentConditions.length > 0) {

          
          matchingSegmentConditions.forEach((segment) => {

            const matchingSegment = {
              segmentID: segment.segmentID,
              segmentConditions: segment.segmentConditions,
            };
            acc.push(matchingSegment);
          })
        }
      }

      return acc;
    }, []);

    const playerObject = await getPlayerByClientID(gameID, branchName, clientID)
    if (!playerObject) return;

    const recalc = matchingSegments.forEach((segment) => {

      const check = segmentsLib.calculatePlayerSegment(playerObject, segment)

      if (check) {
        segmentsLib.addSegmentToPlayer(gameID, branchName, clientID, segment.segmentID)
      } else {
        segmentsLib.removeSegmentFromPlayer(gameID, branchName, clientID, segment.segmentID)
      }
    })

    return segments;
  } catch (error) {
    console.error('recalculateSegments: Error retrieving segments:', error);
  }
}

// Getting player document from Player Warehouse by clientID
async function getPlayerByClientID(gameID, branchName, clientID) {
  try {
    // Находим нужный документ
    const playerWarehouse = await PlayerWarehouse.findOne({
      'gameID': gameID,
      'branches': {
        $elemMatch: {
          'branch': branchName,
          'players.clientID': clientID,
        },
      },
    });

    if (!playerWarehouse) {
      // Если игрок не найден, возвращаем null или бросаем ошибку, в зависимости от вашего предпочтения
      return null;
    }

    // Находим нужного игрока в массиве players
    const branch = playerWarehouse.branches.find(branch => branch.branch === branchName);
    const player = branch.players.find(player => player.clientID === clientID);

    if (!player) {
      // Если игрок не найден в указанной ветке, возвращаем null или бросаем ошибку
      return null;
    }

    return player;
  } catch (error) {
    console.error('recalculateSegments: Error retrieving player:', error);
  }
}





// Clean up values and throw errors. Called from designEvent call.
function transformValue(valueFormat, value) {
  switch (valueFormat) {
    case 'string':
      return String(value);
    case 'integer':
      const intValue = parseInt(value);
      if (isNaN(intValue)) {
        throw new Error(`Invalid value. Expected an integer, but received '${value}'`);
      }
      return intValue;
    case 'float':
    case 'money':
      const floatValue = parseFloat(value);
      if (isNaN(floatValue)) {
        throw new Error(`Invalid value. Expected a float, but received '${value}'`);
      }
      return floatValue;
    case 'percentile':
      const percentileValue = parseInt(value);
      if (isNaN(percentileValue) || percentileValue < 0 || percentileValue > 100) {
        throw new Error(`Invalid value. Expected a percentile (integer between 0 and 100), but received '${value}'`);
      }
      return percentileValue;
    case 'bool':
      const lowerCaseValue = String(value).toLowerCase();
      if (lowerCaseValue === 'true') {
        return true;
      } else if (lowerCaseValue === 'false') {
        return false;
      } else {
        throw new Error(`Invalid value. Expected a boolean, but received '${value}'`);
      }
    default:
      return '';
  }
}

// After we got any designEvent, try to find corresponding template
// in Player Warehouse, and then procceed to change it
async function checkForTemplatesByDesignEvent(gameID, branchName, event, clientID, value1, value2, value3) {

  async function findAnalyticsTemplatesByEventID(gameID, branchName, eventID) {
    try {
      const foundTemplates = await PlayerWarehouse.aggregate([
        { $match: { gameID: gameID } },
        { $unwind: "$branches" },
        { $match: { "branches.branch": branchName } },
        { $unwind: "$branches.templates.analytics" },
        { $match: { "branches.templates.analytics.templateAnalyticEventID": eventID } },
        { $group: { _id: null, templates: { $push: "$branches.templates.analytics" } } }
      ]);
  
      return foundTemplates && foundTemplates.length > 0 ? foundTemplates[0].templates : [];
    } catch (error) {
      console.error('Error finding analytics templates:', error);
    }
  }
  const foundTemplates = await findAnalyticsTemplatesByEventID(gameID, branchName, event.eventDetails.eventID);

  if (foundTemplates && foundTemplates.length > 0) {
    for (const foundTemplate of foundTemplates) {
      let correspondingEventValue;
      let eventValueFormat;
  
      // We make it the same name as columns in "Design Events" datasource in Druid so we can later make a corresponding query
      let valueColumnName = '';

      if (foundTemplate.templateEventTargetValueId === event.eventDetails.valueID1) {
        correspondingEventValue = value1;
        eventValueFormat = event.eventDetails.valueFormat1;
        valueColumnName = 'value1'
      } else if (foundTemplate.templateEventTargetValueId === event.eventDetails.valueID2) {
        correspondingEventValue = value2;
        eventValueFormat = event.eventDetails.valueFormat2;
        valueColumnName = 'value2'
      } else if (foundTemplate.templateEventTargetValueId === event.eventDetails.valueID3) {
        correspondingEventValue = value3;
        eventValueFormat = event.eventDetails.valueFormat3;
        valueColumnName = 'value3'
      }

      const conditionsPassed = checkTemplateConditions(foundTemplate, event, value1, value2, value3)

      if (conditionsPassed) {

        let isFloat
        // Start processing newcame value if conditions are met
        switch (foundTemplate.templateMethod) {
          case 'mostRecent':
            playerWarehouseLib.setElementValue(gameID, branchName, clientID, foundTemplate.templateID, correspondingEventValue)
            break;
            
          case 'firstReceived':
            playerWarehouseLib.setElementValueFirstTimeOnly(gameID, branchName, clientID, foundTemplate.templateID, correspondingEventValue)
            break;

          case 'mostCommon':
            const mostCommonValues = await druidLib.getMostCommonValue(gameID, branchName, clientID, 'designEvent', event.eventDetails.eventID, valueColumnName)
            playerWarehouseLib.setElementValues(gameID, branchName, clientID, foundTemplate.templateID, mostCommonValues)
            break;

          case 'leastCommon':
            const leastCommonValues = await druidLib.getLeastCommonValue(gameID, branchName, clientID, 'designEvent', event.eventDetails.eventID, valueColumnName)
            playerWarehouseLib.setElementValue(gameID, branchName, clientID, foundTemplate.templateID, leastCommonValues)
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
            const meanValue = await druidLib.getMeanValue(gameID, branchName, clientID, 'designEvent', event.eventDetails.eventID, valueColumnName, isFloat)
            playerWarehouseLib.setElementValue(gameID, branchName, clientID, foundTemplate.templateID, meanValue)
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
            const meanForTimeValue = await druidLib.getMeanValueForTime(gameID, branchName, clientID, 'designEvent', event.eventDetails.eventID, valueColumnName, isFloat, foundTemplate.templateMethodTime)
            playerWarehouseLib.setElementValue(gameID, branchName, clientID, foundTemplate.templateID, meanForTimeValue)
            break;

          case 'numberOfEvents':
            playerWarehouseLib.incrementElementValue(gameID, branchName, clientID, foundTemplate.templateID)
            break;

          case 'numberOfEventsForTime':
            const numberOfEventsForTime = await druidLib.getNumberOfEventsForTime(gameID, branchName, clientID, 'designEvent', event.eventDetails.eventID, foundTemplate.templateMethodTime)
            playerWarehouseLib.setElementValue(gameID, branchName, clientID, foundTemplate.templateID, numberOfEventsForTime)
            break;

          case 'summ':
            playerWarehouseLib.addSummToElementValue(gameID, branchName, clientID, foundTemplate.templateID, eventValueFormat, correspondingEventValue)
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
            const summForTime = await druidLib.getSummValueForTime(gameID, branchName, clientID, 'designEvent', event.eventDetails.eventID, valueColumnName, isFloat, foundTemplate.templateMethodTime)
            playerWarehouseLib.setElementValue(gameID, branchName, clientID, foundTemplate.templateID, summForTime)
            break;

          default:
            console.warn(`Unknown templateMethod: ${foundTemplate.templateMethod}`);
            break;
        }

        recalculateSegments(gameID, branchName, clientID, foundTemplate)

      }
      

    }
  }
}

// Send data to Kafka -> Druid. We only send clean refined data and guarantee there is
// valid topic and valid data are given to function
const kafka = new Kafka({
  clientId: 'my-app123',
  brokers: ['192.168.243.128:9092'],
});
const producer = kafka.producer();

async function connectToKafka() {
  try {
    await producer.connect();
  } catch (error) {
    console.error(`Couldn't connect to kafka`, error)
  }
}
connectToKafka()

async function sendKafkaMessage(topic, data) {

  try {
    
    await producer.send({
      topic: topic,
      messages: [
        { value: JSON.stringify(data) },
      ],
    });

    console.log(`Message sent to topic ${topic}: ${data}`);
  } catch (error) {
    console.error(`Error sending message to topic ${topic}: ${error.message}`);
  } finally {
  }

}


// Kafka test events. Called manually from postman
app.post('/testSendKafkaMessage/adevents', async (req, res) => {
  const {kafkaTopic, data} = req.body
  console.log(req.body)
  sendKafkaMessage(kafkaTopic, data)
  res.status(200).json({success: true})
});
app.post('/testSendKafkaMessage/newsession', async (req, res) => {
  const {kafkaTopic, data} = req.body
  console.log(req.body)
  sendKafkaMessage(kafkaTopic, data)
  res.status(200).json({success: true})
});
app.post('/testSendKafkaMessage/endsession', async (req, res) => {
  const {kafkaTopic, data} = req.body
  console.log(req.body)
  sendKafkaMessage(kafkaTopic, data)
  res.status(200).json({success: true})
});
app.post('/testSendKafkaMessage/economyevents', async (req, res) => {
  const {kafkaTopic, data} = req.body
  console.log(req.body)
  sendKafkaMessage(kafkaTopic, data)
  res.status(200).json({success: true})
});
app.post('/testSendKafkaMessage/inappevents', async (req, res) => {
  const {kafkaTopic, data} = req.body
  console.log(req.body)
  sendKafkaMessage(kafkaTopic, data)
  res.status(200).json({success: true})
});
app.post('/testSendKafkaMessage/designevents', async (req, res) => {
  const {kafkaTopic, data} = req.body
  console.log(req.body)
  sendKafkaMessage(kafkaTopic, data)
  res.status(200).json({success: true})
});

// System events. Called automatically
app.post('/api/sdk/analytics/newSession', async (req, res) => {
  const { secretKey, sessionID, clientID, language, platform, gameVersion, engineVersion, buildType } = req.body;
try {
  const gameID = await getGameID(secretKey)
  if (!gameID || gameID === false) {
    res.status(500).json({success: false, message: 'Invalid secretKey value' })
  }
  const country = await getCountryByIP(req.ip)

  // Declare system event category
  const eventType = 'newSession';

  const playerCreated = await createNewPlayer(gameID, 'development', clientID)


  let isNewPlayer = false;
  if (playerCreated) {
    isNewPlayer = true
  } else {
    isNewPlayer = false
  }

  const rerouteData = {gameID, eventType, sessionID, clientID, country, language, platform, gameVersion, engineVersion, buildType, isNewPlayer}

  sendKafkaMessage('newsessionevents', rerouteData)

  res.status(200).json({success: true, message: 'New session event acquired' })
} catch (error) {
  console.error('Error processing newSession event:', error)
    res.status(500).json({success: false, message: 'Internal server error' })
}
});
app.post('/api/sdk/analytics/endSession', async (req, res) => {
  const { secretKey, sessionID, clientID, language, platform, gameVersion, engineVersion, buildType, sessionLength, crashID } = req.body;
try {
  console.log(req.body)
  const gameID = await getGameID(secretKey)
  if (!gameID || gameID === false) {
    res.status(500).json({success: false, message: 'Invalid secretKey value' })
  }
  const country = await getCountryByIP(req.ip)

  // Declare system event category
  const eventType = 'endSession';

  // If we have valid crashID in this request, we consider session ended with a crash and append crashID to data we send
  if (crashID !== null && crashID !== '' && crashID !== undefined) {

    const rerouteDataWithCrashID = {gameID, 
      eventType, 
      sessionID, 
      clientID, 
      country, 
      language, 
      platform, 
      gameVersion, 
      engineVersion, 
      buildType,
      sessionLength, 
      crashID
    }
    sendKafkaMessage('endsessionevents', rerouteDataWithCrashID)
  
  } else {

    const rerouteData = {gameID, 
      eventType, 
      sessionID, 
      clientID, 
      country, 
      language, 
      platform, 
      gameVersion,
      engineVersion, 
      buildType,
      sessionLength
    }
    sendKafkaMessage('endsessionevents', rerouteData)
  }

  
  res.status(200).json({success: true, message: 'End session event acquired' })
} catch (error) {
  console.error('Error processing endSession event:', error)
    res.status(500).json({success: false, message: 'Internal server error' })
}
  

});

// In-app call when player gives real money to game
app.post('/api/sdk/analytics/inappEvent', async (req, res) => {
  const { secretKey, sessionID, clientID, language, platform, gameVersion, engineVersion, buildType, offerID, price, amount } = req.body;
try {
  
  const gameID = await getGameID(secretKey)
  if (!gameID || gameID === false) {
    res.status(500).json({success: false, message: 'Invalid secretKey value' })
  }
  const country = await getCountryByIP(req.ip)

  // Declare system event category
  const eventType = 'inappEvent';

  const rerouteData = {gameID, eventType, sessionID, clientID, country, language, platform, gameVersion, engineVersion, buildType, offerID, price, amount}
  console.log(rerouteData)
  sendKafkaMessage('inappevents', rerouteData)

  res.status(200).json({success: true, message: 'In-App event acquired' })
} catch (error) {
  console.error('Error processing inappEvent:', error)
  res.status(500).json({success: false, message: 'Internal server error' })
}
});

// Economy event when player does something with soft or hard currency
app.post('/api/sdk/analytics/economyEvent', async (req, res) => {
  const { secretKey, sessionID, clientID, language, platform, gameVersion, engineVersion, buildType, entityID, price, amount, currencyType } = req.body;

  try {
    const gameID = await getGameID(secretKey)
    if (!gameID || gameID === false) {
      res.status(500).json({success: false, message: 'Invalid secretKey value' })
    }
    const country = await getCountryByIP(req.ip)
  
    // Declare system event category
    const eventType = 'economyEvent';
  
    createNewPlayer(gameID, 'development', clientID)
  
  
    const rerouteData = {gameID, eventType, sessionID, clientID, country, language, platform, gameVersion, engineVersion, buildType, entityID, price, amount, currencyType}
  
    sendKafkaMessage('economyevents', rerouteData)
  
    res.status(200).json({success: true, message: 'Economy event acquired' })
  } catch (error) {
    console.error('Error processing economyEvent:', error)
    res.status(500).json({success: false, message: 'Internal server error' })
  }

});
// Ad event when player watches ads in game
app.post('/api/sdk/analytics/adEvent', async (req, res) => {
  const { secretKey, sessionID, clientID, language, platform, gameVersion, engineVersion, buildType, adNetwork, adType } = req.body;

  try {
    const gameID = await getGameID(secretKey)
    if (!gameID || gameID === false) {
      res.status(500).json({success: false, message: 'Invalid secretKey value' })
    }
    const country = await getCountryByIP(req.ip)
  
    // Declare system event category
    const eventType = 'adEvent';
  
    createNewPlayer(gameID, 'development', clientID)
  
  
    const rerouteData = {gameID, eventType, sessionID, clientID, country, language, platform, gameVersion, engineVersion, buildType, adNetwork, adType}
  
    sendKafkaMessage('adevents', rerouteData)
  
    res.status(200).json({success: true, message: 'Ad event acquired' })
  } catch (error) {
    console.error('Error processing adEvent:', error)
    res.status(500).json({success: false, message: 'Internal server error', error })
  }

});
// Report event for crashlytics
app.post('/api/sdk/analytics/reportEvent', async (req, res) => {
  const { secretKey, sessionID, clientID, language, platform, gameVersion, engineVersion, buildType, reportID, severity, message } = req.body;

  try {
    const gameID = await getGameID(secretKey)
    if (!gameID || gameID === false) {
      res.status(500).json({success: false, message: 'Invalid secretKey value' })
    }
    const country = await getCountryByIP(req.ip)
  
    // Declare system event category
    const eventType = 'reportEvent';
  
    // createNewPlayer(gameID, 'development', clientID)
  
  
    const rerouteData = {gameID, eventType, sessionID, clientID, country, language, platform, gameVersion, engineVersion, buildType, reportID, severity, message}
  
    sendKafkaMessage('reportevents', rerouteData)
  
    res.status(200).json({success: true, message: 'Report event acquired' })
  } catch (error) {
    console.error('Error processing reportEvent:', error)
    res.status(500).json({success: false, message: 'Internal server error', error })
  }

});

// Custom design events
app.post('/api/sdk/analytics/designEvent', async (req, res) => {
    
  const { secretKey, sessionID, clientID, language, platform, gameVersion, engineVersion, buildType, eventID, value1, value2, value3 } = req.body;

  try {
  const branchName = buildType;
  const gameID = await getGameID(secretKey)
  if (!gameID || gameID === false) {
    res.status(500).json({success: false, message: 'Invalid secretKey value' })
  }
  const country = await getCountryByIP(req.ip)
  const eventType = 'designEvent';

  const foundEvent = await checkEventID(gameID, eventID)
  if (!foundEvent || !foundEvent.found) {
    res.status(404).send(`Event with ID "${eventID}" was not found. Doublecheck your naming on webpage and inside game engine`);
    return
  }


  let sanitizedValue1;
  let sanitizedValue2;
  let sanitizedValue3;

  try {
    sanitizedValue1 = transformValue(foundEvent.eventDetails.valueFormat1, value1)
    sanitizedValue2 = transformValue(foundEvent.eventDetails.valueFormat2, value2)
    sanitizedValue3 = transformValue(foundEvent.eventDetails.valueFormat3, value3)
  } catch (error) {
    res.status(404).send({ message: error.message });
    return
  }

  res.status(200).send({success: true, message: 'Request processed successfully'});

  // From now on we just process this event, segmenting the user, sending event to Kafka and other stuff

  checkForTemplatesByDesignEvent(gameID, branchName, foundEvent, clientID, sanitizedValue1, sanitizedValue2, sanitizedValue3)

  const rerouteData = {gameID, eventType, eventID, sessionID, clientID, country, language, platform, gameVersion, engineVersion, buildType, 
    value1: sanitizedValue1, value2: sanitizedValue2, value3: sanitizedValue3}

  sendKafkaMessage('designevents', rerouteData)

  } catch (error) {
    console.error('Error processing designEvent:', error)
    res.status(500).json({success: false, message: 'Internal server error', error })
  }

});
// Called by a player and returns him a value according to his segments from Player Warehouse
app.post('/api/sdk/getRemoteConfigParam', async (req, res) => {
  try {
    const { secretKey, clientID, paramID, buildType } = req.body;

    const gameID = await getGameID(secretKey)
    // 1. Создаем переменную branchName со значением development
    const branchName = buildType;

    // 2. paramID соответствует полю paramCodeName
    const paramCodeName = paramID;

    // 3. Находим соответствующего clientID игрока в модели playerWarehouse
    const [player, remoteConfig] = await Promise.all([
      PlayerWarehouse.findOne({ gameID, 'branches.branch': branchName, 'branches.players.clientID': clientID }),
      RemoteConfig.findOne({ gameID, 'branches.branch': branchName, 'branches.params.paramCodeName': paramID })
    ]);

    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }

    // Проверяем, найден ли RemoteConfig
    if (!remoteConfig) {
      return res.status(404).json({ message: 'RemoteConfig not found' });
    }
    // 4. Берем массив segments у этого игрока
    const segments = player.branches.find(b => b.branch === branchName).players.find(p => p.clientID === clientID).segments;

    const param = remoteConfig.branches.find(b => b.branch === branchName).params.find(p => p.paramCodeName === paramCodeName);

    // 6. Берем массив values из этого параметра
    const values = param.values;

    function getSegmentValue(segments, values) {
      // Находим значение из первого приоритетного сегмента
      for (const value of values) {
        if (segments.includes(value.segmentID)) {
          return value.value;
        }
      }
    
      // Если нет приоритетных сегментов, возвращаем значение сегмента "everyone"
      const everyoneObject = values.find(value => value.segmentID === 'everyone');
      return everyoneObject ? everyoneObject.value : null;
    }

    const resultValue = getSegmentValue(segments, values)

    // Все шаги выполнены, теперь можно вернуть результат
    res.status(200).json({ success: true, value: resultValue, valueType: param.valueType });
  } catch (error) {
    console.error('Error getting RemoteConfig param:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});



app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
});