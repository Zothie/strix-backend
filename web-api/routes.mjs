
import express from "express";
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


import { PlanningTreeModel } from "../models/planningTreeModel.js";
import { User } from "../models/userModel.js";
import { NodeModel } from "../models/nodeModel.js";
import { Game } from "../models/gameModel.js";
import { Studio } from "../models/studioModel.js";
import { Publisher } from "../models/publisherModel.js";
import { RemoteConfig } from "../models/remoteConfigModel.js";
import { AnalyticsEvents } from "../models/analyticsevents.js";
import { Segments } from "../models/segmentsModel.js";
import { Relations } from "../models/relationsModel.js";
import { Localization } from "../models/localizationModel.js";
import { OffersModel as Offers } from "../models/offersModel.js";
import { charts as CustomCharts } from "../models/charts.js";
import { ABTests } from "../models/abtests.js";
import { PWplayers } from "../models/PWplayers.js";
import { PWtemplates } from "../models/PWtemplates.js";

import * as segmentsLib from "../libs/segmentsLib.mjs";
import druidLib from "../libs/druidLib.cjs";
import * as playerWarehouseLib from "../libs/playerWarehouseLib.mjs";

import mongoose from "mongoose";
const mongoURI = process.env.MONGODB_URI;
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });

import {mailService} from "./startup/startup-scripts.mjs";

import * as startupScripts from './startup/startup-scripts.mjs';
Object.assign(global, startupScripts);
import * as startupTestScripts from './startup/test.mjs';
Object.assign(global, startupTestScripts);
import * as utilityFuncLib from './functions/utility.mjs';
Object.assign(global, utilityFuncLib);
import * as segmentsFuncLib from './functions/logic/segments.mjs';
Object.assign(global, segmentsFuncLib);
import * as abtestsFuncLib from './functions/logic/abtests.mjs';
Object.assign(global, abtestsFuncLib);
import * as analyticsEventsFuncLib from './functions/logic/analyticsevent.mjs';
Object.assign(global, analyticsEventsFuncLib);
import * as nodesFuncLib from './functions/logic/nodes.mjs';
Object.assign(global, nodesFuncLib);
import * as offersFuncLib from './functions/logic/offers.mjs';
Object.assign(global, offersFuncLib);
import * as authFuncLib from './functions/logic/auth.mjs';
Object.assign(global, authFuncLib);
import * as customDBFuncLib from './functions/logic/customdashboards.mjs';
Object.assign(global, customDBFuncLib);
import * as localizationFuncLib from './functions/logic/localization.mjs';
Object.assign(global, localizationFuncLib);
import * as demoDataFuncLib from './functions/logic/demodatagenerator.mjs';
Object.assign(global, demoDataFuncLib);
import * as organizationLib from './functions/logic/organizations.mjs';
Object.assign(global, organizationLib);
import * as profileCompositionFuncLib from './functions/logic/profilecomposition.mjs';
Object.assign(global, profileCompositionFuncLib);
import * as sharedFuncLib from './functions/logic/sharedfetch.mjs';
Object.assign(global, sharedFuncLib);
import * as warehouseFuncLib from './functions/logic/warehouse.mjs';
Object.assign(global, warehouseFuncLib);
import * as contentCooker from './functions/actions/cookLiveOpsContent.mjs';
Object.assign(global, contentCooker);



const app = express.Router();

app.post('/api/register', async (req, res, next) => {
  const { email, password } = req.body;

  try {
    const result = await registerUser(email, password);
    res.status(result.success ? 201 : 500).json(result);
  } catch (error) {
    next(error);
  }
});

app.post('/api/login', async (req, res, next) => {
  const { email, password } = req.body;

  try {
    const result = await authenticateUser(email, password);
    res.status(result.success ? 200 : 401).json(result);
  } catch (error) {
    next(error);
  }
});

app.post('/api/logout', async (req, res, next) => {
  const { token } = req.body;

  try {
    const result = await logoutUser(token);
    res.status(result === 'User logged out successfully' ? 200 : 500).send(result);
  } catch (error) {
    next(error);
  }
});



app.post('/api/finishInitialOnboarding', async (req, res, next) => {
  try {
    const { publisherName, email, username, jobTitle, studioName, studioApiKey, studioIcon } = req.body;
    const result = await finishUserOnboarding({ publisherName, email, username, jobTitle, studioName, studioApiKey, studioIcon });
    res.status(200).json({ success: true, message: 'User onboarded successfully', ...result });
  } catch (error) {
    console.error('Error during onboarding:', error);
    next(error); // Pass the error to the error handling middleware
  }
});

app.post('/api/removeUser', async (req, res, next) => {
  try {
    const { email, token } = req.body;
    const result = await scheduleUserRemoval(email, token);
    res.status(200).json({ success: true, message: 'User scheduled for removal successfully', date: result });
  } catch (error) {
    console.error('Error scheduling user removal:', error);
    next(error); // Pass the error to the error handling middleware
  }
});
app.post('/api/cancelRemoveUser', async (req, res, next) => {
  try {
    const { email, token } = req.body;
    await cancelRemoveUser(email, token);
    res.status(200).json({ success: true, message: 'Deletion canceled successfully!' });
  } catch (error) {
    console.error('Error canceling user removal:', error);
    next(error); // Pass the error to the error handling middleware
  }
});

app.post('/api/buildDemo', async (req, res, next) => {
  try {
    const customToken = await buildDemo();
    res.status(201).json({ success: true, token: customToken });
  } catch (error) {
    console.error('Error building demo:', error);
    next(error); // Pass the error to the error handling middleware
  }
});


// Получение списка всех паблишеров
app.post('/api/getPublishers', async (req, res, next) => {
  const { email } = req.body;

  try {
    const publishers = await getPublishers(email);
    res.json({ success: true, publishers });
  } catch (error) {
    console.error('Error getting publishers:', error);
    next(error); // Pass the error to the error handling middleware
  }
});
app.post('/api/getOrganizationsInfo', async (req, res, next) => {
  const { email } = req.body;

  try {
    const result = await getOrganizationsInfo(email);
    res.json({ success: true, publishers: result });
  } catch (error) {
    console.error('Error getting organizations info:', error);
    next(error); // Pass the error to the error handling middleware
  }
});

app.post('/api/removeUserFromOrganization', async (req, res, next) => {
  const { studioID, token, targetUserEmail } = req.body;

  try {
    await removeUserFromOrganization(studioID, token, targetUserEmail);
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing user from organization:', error);
    next(error); // Pass the error to the error handling middleware
  }
});

async function checkUserOrganizationAuthority(studioID, uid) {
  try {
    const studio = await Studio.findOne({ studioID });
    const user = studio.users.find(user => user.userID === uid);
    return user.userPermissions.some(p => p.permission === 'admin');
  } catch (err) {
    console.error('Error checking user authority:', err);
    return false
  }
}
app.post('/api/addUserToOrganization', async (req, res, next) => {
  const { studioID, token, targetUserEmail } = req.body;

  try {
    // Call the function to add the user to the organization
    const result = await addUserToOrganization(studioID, token, targetUserEmail);

    if (result.success) {
      res.json({ success: true });
    } else {
      res.status(result.status).send(result.message);
    }
  } catch (error) {
    console.error('Error adding user to organization:', error);
    next(error); // Pass the error to the error handling middleware
  }
});


app.post('/api/getUser', async (req, res, next) => {
  try {
    const { email, token } = req.body;

    // Call the function to get user details
    const result = await getUser(email);

    res.json(result);
  } catch (error) {
    console.error('Error fetching user details:', error);
    // Pass the error to the error handling middleware
    next(error);
  }
});

app.post('/api/startRegistrationProcess', async (req, res, next) => {
  try {
    const { email } = req.body;

    // Call the function to start the registration process
    const result = await startRegistrationProcess(email);

    res.json(result);
  } catch (error) {
    console.error('Error starting registration process:', error);
    // Pass the error to the error handling middleware
    next(error);
  }
});

app.post('/api/finishRegistrationProcess', async (req, res, next) => {
  try {
    const { code, email } = req.body;

    // Call the function to finish the registration process
    const result = await finishRegistrationProcess(code, email);

    res.json(result);
  } catch (error) {
    console.error('Error finishing registration process:', error);
    // Pass the error to the error handling middleware
    next(error);
  }
});




app.post('/api/initiateChangeUserProfile', async (req, res, next) => {
  try {
    const { type, email, newData } = req.body;

    // Call the function to initiate user profile change
    const result = await initiateChangeUserProfile(type, email, newData, mailService);

    res.json(result);
  } catch (error) {
    console.error('Error initiating user profile change:', error);
    // Pass the error to the error handling middleware
    next(error);
  }
});

app.post('/api/confirmUserChangeProfileCode', async (req, res, next) => {
  try {
    const { type, email, code, newData } = req.body;

    // Call the function to confirm user change profile code
    const result = await confirmUserChangeProfileCode(type, email, code, newData);

    res.json(result);
  } catch (error) {
    console.error('Error confirming user change profile code:', error);
    // Pass the error to the error handling middleware
    next(error);
  }
});

// Добавление студии к паблишеру
app.post('/api/addStudio', async (req, res, next) => {
  try {
    const { publisherID, studioName, apiKey, studioIcon } = req.body;

    // Call the function to add a new studio
    await addStudio(publisherID, studioName, apiKey, studioIcon);

    res.json({ success: true, message: 'Studio added successfully' });
  } catch (error) {
    console.error('Error adding studio:', error);
    // Pass the error to the error handling middleware
    next(error);
  }
});

app.post('/api/getPublisherStudios', async (req, res, next) => {
  try {
    const { publisherID } = req.body;

    // Call the function to get publisher studios
    const publisherStudios = await getPublisherStudios(publisherID);

    res.json(publisherStudios);
  } catch (error) {
    console.error('Error fetching publisher studios:', error);
    // Pass the error to the error handling middleware
    next(error);
  }
});



// Get all studio games
app.post('/api/getStudioGames', async (req, res, next) => {
  try {
    const { studioIDs } = req.body;

    // Call the function to get games of multiple studios
    const studiosAndGames = await getStudioGames(studioIDs);

    res.json(studiosAndGames);
  } catch (error) {
    console.error('Error fetching studio games:', error);
    // Pass the error to the error handling middleware
    next(error);
  }
});

// Создание игры в студии
app.post('/api/createGame', async (req, res) => {
  const { studioID, gameName, gameEngine, gameKey, gameIcon } = req.body;

  try {

    const result = await createGame(studioID, gameName, gameEngine, gameKey, gameIcon);

    res.json({ success: true, gameID: result });
  } catch (error) {
    console.error(error);
    res.status(200).json({ success: false, error: 'Internal server error' });
  }
});


// Removing game
app.post('/api/removeGame', async (req, res, next) => {
  try {
    const { studioID, gameID } = req.body;

    // Call the function to remove the game
    await removeGame(studioID, gameID);

    res.status(200).json({ success: true, message: 'Game scheduled for removal successfully' });
  } catch (error) {
    console.error('Error removing game:', error);
    // Pass the error to the error handling middleware
    next(error);
  }
});
app.post('/api/cancelRemoveGame', async (req, res, next) => {
  try {
    const { studioID, gameID } = req.body;

    // Call the function to cancel game removal
    await cancelRemoveGame(studioID, gameID);

    res.status(200).json({ success: true, message: 'Game unscheduled successfully' });
  } catch (error) {
    console.error('Error canceling game removal:', error);
    // Pass the error to the error handling middleware
    next(error);
  }
});


// Getting studio details for settings modal
app.post('/api/getStudioDetails', async (req, res, next) => {
  try {
    const { studioID } = req.body;

    // Call the function to fetch studio details
    const studioDetails = await getStudioDetails(studioID);

    res.json(studioDetails);
  } catch (error) {
    console.error('Error fetching studio details:', error.message);
    // Pass the error to the error handling middleware
    next(error);
  }
});


// Changing game details
app.post('/api/updateStudioDetails', async (req, res, next) => {
  try {
    const { studioID, studioName, studioIcon, apiKey } = req.body;

    // Call the function to update studio details
    await updateStudioDetails(studioID, studioName, studioIcon, apiKey);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating studio details:', error.message);
    // Pass the error to the error handling middleware
    next(error);
  }
});

app.post('/api/revokeStudioKey', async (req, res, next) => {
  try {
    const { studioID } = req.body;

    // Call the function to revoke the studio key
    const { success, message, apiKey } = await revokeStudioKey(studioID);

    if (!success) {
      return res.status(404).send(message);
    }

    res.json({ success: true, message: 'Studio key revoked', apiKey });
  } catch (error) {
    console.error('Error revoking studio key:', error.message);
    // Pass the error to the error handling middleware
    next(error);
  }
});
app.post('/api/revokeGameKey', async (req, res, next) => {
  try {
    const { gameID } = req.body;

    // Call the function to revoke the game key
    const { success, message, apiKey } = await revokeGameKey(gameID);

    if (!success) {
      return res.status(404).send(message);
    }

    res.json({ success: true, message: 'Game key revoked', apiKey });
  } catch (error) {
    console.error('Error revoking game key:', error.message);
    // Pass the error to the error handling middleware
    next(error);
  }
});
app.post('/api/checkOrganizationAuthority', async (req, res, next) => {
  const { token, orgID } = req.body;

  // Check for missing fields
  if (!token || !orgID) {
    return res.status(401).json({ success: false, message: 'Missing fields' });
  }

  try {
    // Verify the token
    const decodedToken = await firebase.auth().verifyIdToken(token);
    const uid = decodedToken.uid;
    if (!uid) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    // Call the function to check user organization authority
    const checkAuthority = await checkUserOrganizationAuthority(orgID, uid);
    if (!checkAuthority) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error checking organization authority:', error);
    // Pass the error to the error handling middleware
    next(error);
  }
});
app.post('/api/removeStudio', async (req, res, next) => {
  try {
    const { studioID, token } = req.body;

    // Verify the token
    const decodedToken = await firebase.auth().verifyIdToken(token);
    const uid = decodedToken.uid;
    if (!uid) {
      return res.status(401).send('Invalid or expired token');
    }

    // Check user organization authority
    const checkAuthority = await checkUserOrganizationAuthority(studioID, uid)
    if (!checkAuthority) {
      return res.status(401).send('Unauthorized');
    }

    // Call the function to remove studio
    await removeStudio(studioID);

    res.json({ success: true, message: 'Studio scheduled for removal successfully' });
  } catch (error) {
    console.error('Error removing studio:', error);
    // Pass the error to the error handling middleware
    next(error);
  }
});
app.post('/api/cancelRemoveStudio', async (req, res, next) => {
  try {
    const { studioID } = req.body;

    // Call the function to cancel studio removal
    await cancelRemoveStudio(studioID);

    res.json({ success: true, message: 'Studio removal cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling studio removal:', error);
    // Pass the error to the error handling middleware
    next(error);
  }
});


// Getting game details for settings modal
app.post('/api/getGameDetails', async (req, res, next) => {
  try {
    const { gameID } = req.body;

    // Call the function to get game details
    const gameDetails = await getGameDetails(gameID);

    res.json(gameDetails);
  } catch (error) {
    console.error('Error fetching game details:', error.message);
    // Pass the error to the error handling middleware
    next(error);
  }
});


// Changing game details
app.post('/api/updateGameDetails', async (req, res, next) => {
  try {
    const { gameID, gameName, gameEngine, gameIcon, apiKeys, gameSecretKey } = req.body;

    // Call the function to update game details
    await updateGameDetails(gameID, gameName, gameEngine, gameIcon, apiKeys, gameSecretKey);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating game details:', error.message);
    // Pass the error to the error handling middleware
    next(error);
  }
});

app.post('/api/getNode', async (req, res, next) => {
  try {
    const { gameID, branch, nodeID } = req.body;

    // Call the function to get the node
    const foundNode = await getNode(gameID, branch, nodeID);

    // Respond based on the result of the operation
    if (foundNode) {
      res.status(200).json(foundNode);
    } else {
      res.status(404).json({ error: 'Node not found' });
    }
  } catch (error) {
    console.error(error);
    // Pass the error to the error handling middleware
    next(error);
  }
});

// Обновить поле content в description или techDescription когда кто-то изменяет ноду
app.post('/api/updateNode', async (req, res, next) => {
  const { gameID, branchName, nodeID, fieldToUpdate, newField } = req.body;

  try {
    // Call the function to update the node
    const updateResult = await updateNode(gameID, branchName, nodeID, fieldToUpdate, newField);

    // Respond based on the result of the update operation
    if (updateResult.success) {
      res.status(200).json({ success: true, message: 'Node updated successfully' });
    } else {
      res.status(404).json({ success: false, message: updateResult.error });
    }
  } catch (error) {
    console.error('Error updating node:', error);
    // Pass the error to the error handling middleware
    next(error);
  }
});

app.post('/api/createPlanningNode', async (req, res) => {
  try {
    const { gameID, branch, planningType, nodeID, nodeName } = req.body;

    // Проверка наличия обязательных полей в запросе
    if (!gameID || !branch || !planningType || !nodeID || !nodeName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await createPlanningNode(gameID, branch, planningType, nodeID, nodeName)

    res.status(201).json({ message: 'Empty node created successfully' });
  } catch (error) {
    console.error(error);
    next(error);
  }
});

app.post('/api/createEntity', async (req, res, next) => {
  try {
    const { gameID, branch, entityObj } = req.body;

    // Call the function to create a single entity
    await createEntity(gameID, branch, entityObj);

    res.status(201).json({ message: 'Empty node created successfully' });
  } catch (error) {
    console.error(error);
    // Pass the error to the error handling middleware
    next(error);
  }
});


app.post('/api/createEntityBulk', async (req, res, next) => {
  try {
    const { gameID, branch, entityObjArray } = req.body;

    // Call the function to create entities in bulk
    await createEntityBulk(gameID, branch, entityObjArray);

    res.status(201).json({ message: 'Empty node created successfully' });
  } catch (error) {
    console.error(error);
    // Pass the error to the error handling middleware
    next(error);
  }
});
app.get('/api/findNodeById', async (req, res, next) => {
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
    next(error)
  }
});



app.post('/api/removePlanningNode', async (req, res, next) => {
  try {
    const { gameID, branchName, nodeID } = req.body;

    if (!gameID || !branchName || !nodeID) {
      return res.status(400).json({ success: false, message: 'Missing required parameters' });
    }

    const response = await removePlanningNode(gameID, branchName, nodeID);
    res.status(200).json({ success: true, message: response });
  } catch (error) {
    console.error('Error in /api/removePlanningNode:', error);
    next(error)
  }
});
app.post('/api/getPlanningNodes', async (req, res, next) => {
  try {
    const { gameID, branch, planningType } = req.body;

    if (!gameID || !branch || !planningType) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const nodes = await getPlanningNodes(gameID, branch, planningType);

    res.json({ success: true, nodes });
  } catch (error) {
    console.error(error);
    next(error);
  }
});

app.post('/api/getNodeTree', async (req, res, next) => {
  try {
    const { gameID, branch, planningType } = req.body;

    if (!gameID || !branch || !planningType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const nodes = await getNodeTree(gameID, branch, planningType);

    res.json({ nodes });
  } catch (error) {
    console.error(error);
    next(error);
  }
});
app.post('/api/addChildNodeInTree', async (req, res, next) => {
  const { gameID, branchName, planningType, parentId, newNode } = req.body;
  try {
    const result = await addChildNodeInPlanningTree(gameID, branchName, planningType, parentId, newNode)
    res.status(result.status).json({sucess: result.success})
  } catch (error) {
    console.error(error);
    next(error)
  }
});

app.post('/api/removeNodeFromTree', async (req, res, next) => {
  try {
    const { gameID, branchName, planningType, nodeID } = req.body;
    const response = await removeNodeFromTree(gameID, branchName, planningType, nodeID);
    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    next(error);
  }
});

app.post('/api/moveNodeInTree', async (req, res, next) => {
  try {
    const { gameID, branchName, planningType, nodeToMove, destinationID } = req.body;
    const response = await moveNodeInPlanningTree(gameID, branchName, planningType, nodeToMove, destinationID)
    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    next(error);
  }
});



app.post('/api/getEntitiesByNodeIDs', async (req, res, next) => {
  try {
    const { gameID, branch, nodeIDs } = req.body;
    const entities = await getEntitiesByNodeIDs(gameID, branch, nodeIDs);
    
    if (!entities || entities.length === 0) {
      return res.status(404).json({ message: 'Entities not found' });
    }
    res.status(200).json({ success: true, entities });
  } catch (error) {
    console.error(error);
    next(error);
  }
});
app.post('/api/getEntitiesIDs', async (req, res, next) => {
  try {
    const { gameID, branch } = req.body;
    const entities = await getEntitiesIDs(gameID, branch);
    
    if (!entities || entities.length === 0) {
      return res.status(200).json({ success: false, message: 'Entities not found' });
    }
    res.status(200).json({ success: true, entities });
  } catch (error) {
    console.error(error);
    next(error);
  }
});
app.post('/api/getEntitiesNames', async (req, res, next) => {
  try {
    const { gameID, branch } = req.body;
    const entities = await getEntitiesNames(gameID, branch);
    
    if (!entities || entities.length === 0) {
      return res.status(404).json({ message: 'Entities not found' });
    }
    res.status(200).json({ success: true, entities });
  } catch (error) {
    console.error(error);
    next(error);
  }
});
app.post('/api/getEntityIcon', async (req, res, next) => {
  try {
    const { gameID, branch, nodeID } = req.body;
    const entityIcon = await getEntityIcon(gameID, branch, nodeID);
    
    if (!entityIcon && entityIcon !== '') {
      return res.status(404).json({ message: 'Entity not found' });
    }
    res.status(200).json({ success: true, entityIcon });
  } catch (error) {
    console.error(error);
    next(error);
  }
});


app.post('/api/getEntityIcons', async (req, res, next) => {
  try {
    const { gameID, branch, nodeIDs } = req.body;

    let entityIcons = await fetchEntityIcons(gameID, branch, nodeIDs)

    if (!entityIcons) {
      return res.status(404).json({ message: 'Entity not found' });
    }
    res.status(200).json({ success: true, entityIcons });
  } catch (error) {
    console.error(error);
    next(error);
  }
});


app.post('/api/saveEntityBasicInfo', async (req, res, next) => {
  const { gameID, branch, nodeID, entityID, nodeName, isCategory } = req.body;
  
  try {
    await saveEntityBasicInfo(gameID, branch, nodeID, entityID, nodeName, isCategory);
    res.status(200).json({ success: true, message: 'Entity updated successfully' });
  } catch (error) {
    console.error(error);
    next(error);
  }
});
app.post('/api/saveEntityRoles', async (req, res, next) => {
  const { gameID, branch, nodeID, isCurrency, isInAppPurchase, realValueBase } = req.body;

  try {
    await saveEntityRoles(gameID, branch, nodeID, isCurrency, isInAppPurchase, realValueBase);
    res.status(200).json({ success: true, message: 'Entity updated successfully' });
  } catch (error) {
    console.error(error);
    next(error);
  }
});
app.post('/api/saveEntityIcon', async (req, res, next) => {
  const { gameID, branch, nodeID, entityIcon } = req.body;

  try {
    await saveEntityIcon(gameID, branch, nodeID, entityIcon);
    res.status(200).json({ success: true, message: 'Entity updated successfully' });
  } catch (error) {
    console.error(error);
    next(error);
  }
});
app.post('/api/saveEntityMainConfigs', async (req, res, next) => {
  const { gameID, branch, nodeID, mainConfigs, isCategory } = req.body;

  try {
    await saveEntityMainConfigs(gameID, branch, nodeID, mainConfigs, isCategory);
    res.status(200).json({ success: true, message: 'Entity updated successfully' });
  } catch (error) {
    console.error(error);
    next(error);
  }
});
app.post('/api/saveEntityInheritedConfigs', async (req, res, next) => {
  const { gameID, branch, nodeID, inheritedConfigs, isCategory } = req.body;

  try {
    await saveEntityInheritedConfigs(gameID, branch, nodeID, inheritedConfigs, isCategory);
    res.status(200).json({ success: true, message: 'Entity updated successfully' });
  } catch (error) {
    console.error(error);
    next(error);
  }
});



app.post('/api/updateLocalization', async (req, res, next) => {
  const { gameID, branch, type, translationObjects } = req.body;

  try {

    await updateLocalization(gameID, branch, type, translationObjects)

    res.status(200).json({ message: 'Localization updated successfully' });
  } catch (error) {
    console.error(error);
    next(error)
  }
});
app.post('/api/getLocalization', async (req, res, next) => {
  const { gameID, branch, type } = req.body;

  try {
    const localizations = await getLocalization(gameID, branch, type);
    res.status(200).json({ localizations, success: true, message: 'Localization fetched successfully' });
  } catch (error) {
    console.error(error);
    next(error);
  }
});
app.post('/api/getLocalizationItems', async (req, res, next) => {
  const { gameID, branch, type, sids } = req.body;

  try {
    const localizations = await getLocalizationItems(gameID, branch, type, sids);
    res.status(200).json({ localizations, success: true, message: 'Localization fetched successfully' });
  } catch (error) {
    console.error('Error getting localization items:', error);
    next(error);
  }
});
app.post('/api/removeLocalizationItem', async (req, res, next) => {
  const { gameID, branch, type, sid } = req.body;

  try {
    const result = await removeLocalizationItem(gameID, branch, type, sid);
    res.status(200).json({ success: true, message: 'Localization item removed successfully' });
  } catch (error) {
    console.error(error);
    next(error);
  }
});

app.post('/api/changeLocalizationItemKey', async (req, res, next) => {
  const { gameID, branch, type, sid, newKey } = req.body;
  try {
    const result = await changeLocalizationItemKey(gameID, branch, type, sid, newKey);
    res.status(200).json({ success: true, message: 'Localization item changed successfully' });
  } catch (error) {
    console.error(error);
    next(error);
  }
});

app.post('/api/createNewOffer', async (req, res, next) => {
  const { gameID, branch, offerObj } = req.body;
  try {
    const result = await createNewOffer(gameID, branch, offerObj);
    res.status(200).json({ success: true, message: 'Offer created successfully' });
  } catch (error) {
    console.error(error);
    next(error);
  }
});
app.post('/api/getPricing', async (req, res, next) => {
  const { gameID, branch } = req.body;
  try {
    const result = await getPricing(gameID, branch);

    res.status(200).json({ success: true, pricing: result });
  } catch (error) {
    console.error(error);
    next(error);
  }
});
app.post('/api/updatePricingItem', async (req, res, next) => {
  const { gameID, branch, pricingItem, type } = req.body;
  try {
    await updatePricingItem(gameID, branch, pricingItem, type);

    res.status(200).json({ success: true, message: 'Pricing updated successfully' });
  } catch (error) {
    console.error(error);
    next(error);
  }
});
app.post('/api/updateOffer', async (req, res, next) => {
  const { gameID, branch, offerObj } = req.body;
  try {
    const result = await updateOffer(gameID, branch, offerObj);

    res.status(200).json({ success: true, message: 'Offer updated successfully' });
  } catch (error) {
    console.error(error);
    next(error);
  }
});
app.post('/api/getOffersNames', async (req, res, next) => {
  try {
    const { gameID, branch } = req.body;

    const offers = await getOffersNames(gameID, branch);

    res.status(200).json({ success: true, offers });
  } catch (error) {
    console.error(error);
    next(error); // Pass the error to the error handler middleware
  }
});

app.post('/api/removeOffer', async (req, res, next) => {
  const { gameID, branch, offerID } = req.body;
  try {
    await updateOfferAndPositions(gameID, branch, offerID);
    await removeOfferLocalization(gameID, branch, offerID);

    res.status(200).json({ success: true, message: 'Offer removed successfully' });
  } catch (error) {
    console.error(error);
    next(error);
  }
});
app.post('/api/getOffersNames', async (req, res, next) => {
  try {
    const { gameID, branch } = req.body;

    const offers = await getOffersNames(gameID, branch);

    res.status(200).json({ success: true, offers });
  } catch (error) {
    console.error(error);
    next(error); // Pass the error to the error handler middleware
  }
});
app.post('/api/getOffersByContentNodeID', async (req, res, next) => {
  try {
    const { gameID, branch, nodeID } = req.body;

    const offers = await getOffersByContentNodeID(gameID, branch, nodeID);

    res.status(200).json({ success: true, offers });
  } catch (error) {
    console.error(error);
    next(error); // Pass the error to the error handler middleware
  }
});
app.post('/api/getPositionedOffers', async (req, res, next) => {
  try {
    const { gameID, branch } = req.body;

    const positions = await getPositionedOffers(gameID, branch);

    if (!positions) {
      return res.status(404).json({ success: false, message: 'Data not found' });
    }

    res.status(200).json({ success: true, positions });
  } catch (error) {
    console.error(error);
    next(error); // Pass the error to the error handler middleware
  }
});
app.post('/api/setPositionedOffers', async (req, res, next) => {
  try {
    const { gameID, branch, positions } = req.body;

    const result = await setPositionedOffers(gameID, branch, positions);

    res.status(200).json({ success: true, message: 'Positions set successfully' });
  } catch (error) {
    console.error(error);
    next(error); // Pass the error to the error handler middleware
  }
});

app.post('/api/checkEntityIDExists', async (req, res, next) => {
  try {
    const { gameID, branchName, entityID } = req.body;

    const exists = await checkEntityIDExists(gameID, branchName, entityID);

    res.json({ exists });
  } catch (error) {
    console.error(error);
    next(error); // Pass the error to the error handler middleware
  }
});

app.post('/api/getAnalyticsEventsConfig', async (req, res, next) => {
  try {
    const { gameID, branchName, eventIDs } = req.body;

    const matchingEvents = await getAnalyticsEventsConfig(gameID, branchName, eventIDs);

    res.status(200).json({ success: true, matchingEvents });
  } catch (error) {
    console.error('Error fetching events:', error);
    next(error); // Pass the error to the error handler middleware
  }
});
app.post('/api/createNewAnalyticsEvent', async (req, res, next) => {
  try {
    const { gameID, branchName } = req.body;

    const newEvent = await createNewAnalyticsEvent(gameID, branchName);

    res.status(200).json({
      success: true,
      message: 'New analytics event created',
      newEvent
    });
  } catch (error) {
    console.error('Error creating new analytics event:', error);
    next(error); // Pass the error to the error handler middleware
  }
});
app.post('/api/removeAnalyticsEvent', async (req, res, next) => {
  try {
    const { gameID, branchName, nodeID, eventID } = req.body;

    const { resultAnalyticsEvents, resultNodeModel } = await removeAnalyticsEvent(gameID, branchName, nodeID, eventID);

    if (!resultAnalyticsEvents || !resultNodeModel) {
      return res.status(404).json({ message: 'Analytics event not found' });
    }

    res.status(200).json({ success: true, message: 'Analytics event deleted' });
  } catch (error) {
    console.error('Error deleting analytics event:', error);
    next(error); // Pass the error to the error handler middleware
  }
});
app.post('/api/v2/removeAnalyticsEvent', async (req, res, next) => {
  try {
    const { gameID, branchName, eventID } = req.body;

    const result = await removeAnalyticsEvent(gameID, branchName, eventID);

    if (!result) {
      return res.status(404).json({ message: 'Analytics event not found' });
    }

    res.status(200).json({ success: true, message: 'Analytics event deleted' });
  } catch (error) {
    console.error('Error deleting analytics event:', error);
    next(error);
  }
});
app.post('/api/checkIfAnalyticsEventIDExists', async (req, res, next) => {
  try {
    const { gameID, branchName, eventID, eventCodeName } = req.body;
    const exists = await checkIfAnalyticsEventIDExists(gameID, branchName, eventID, eventCodeName);
    res.status(200).json({ exists });
  } catch (error) {
    console.error('Error checking analytics event ID existence:', error);
    next(error);
  }
});
app.post('/api/updateAnalyticsEvent', async (req, res, next) => {
  try {
    const { gameID, branchName, eventID, eventObject } = req.body;
    const updatedEvent = await updateAnalyticsEvent(gameID, branchName, eventID, eventObject);
    res.status(200).json({ success: true, message: 'Analytics event updated successfully' });
  } catch (error) {
    console.error('Error updating analytics event:', error);
    next(error);
  }
});

app.post('/api/getAllSegments', async (req, res, next) => {
  try {
    const { gameID, branchName } = req.body;
    const segments = await getAllSegments(gameID, branchName);
    res.status(200).json({ success: true, segments });
  } catch (error) {
    console.error('Error getting all segments:', error);
    next(error);
  }
});

// Only outputs IDs and Names. Needed to get segment names by their IDs in various places on website (Remote Config, Player Warehouse)
app.post('/api/getSegmentsByIdArray', async (req, res, next) => {
  try {
    const { gameID, branchName, segmentIDs } = req.body;
    const segments = await getSegmentsByIdArray(gameID, branchName, segmentIDs);
    res.status(200).json({ success: true, segments });
  } catch (error) {
    console.error('Error fetching segments by IDs:', error);
    next(error);
  }
});
app.post('/api/createNewSegment', async (req, res, next) => {
  try {
    const { gameID, branchName } = req.body;
    const segments = await createNewSegment(gameID, branchName);
    res.status(200).json({ success: true, segments });
  } catch (error) {
    console.error('Error creating new segment:', error);
    next(error);
  }
});
app.post('/api/setSegmentName', async (req, res, next) => {
  try {
    const { gameID, branchName, segmentID, newName } = req.body;
    const message = await setSegmentName(gameID, branchName, segmentID, newName);
    res.status(200).json({ success: true, message });
  } catch (error) {
    console.error('Error updating segmentName:', error);
    next(error);
  }
});
app.post('/api/setSegmentComment', async (req, res, next) => {
  try {
    const { gameID, branchName, segmentID, newComment } = req.body;
    const message = await setSegmentComment(gameID, branchName, segmentID, newComment);
    res.status(200).json({ success: true, message });
  } catch (error) {
    console.error('Error updating segmentComment:', error);
    next(error);
  }
});
app.post('/api/countPlayersInWarehouse', async (req, res, next) => {
  const { gameID, branchName } = req.body;

  try {
    const playerCount = await countPlayersInWarehouse(gameID, branchName);
    res.status(200).json({ success: true, playerCount });
  } catch (error) {
    console.error('Error counting players in warehouse:', error);
    next(error);
  }
});
app.post('/api/getTemplatesForSegments', async (req, res, next) => {
  const { gameID, branchName } = req.body;

  try {
    const templates = await getTemplatesForSegments(gameID, branchName);
    res.status(200).json({ success: true, templates });
  } catch (error) {
    console.error('Error getting templates for segments:', error);
    next(error);
  }
});
app.post('/api/setSegmentConditions', async (req, res, next) => {
  const { gameID, branchName, segmentID, segmentConditions } = req.body;

  try {
    const result = await setSegmentConditions(gameID, branchName, segmentID, segmentConditions);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error setting segment conditions:', error);
    next(error);
  }
});



app.post('/api/refreshSegmentPlayerCount', async (req, res, next) => {
  try {
    const { gameID, branchName, segmentID } = req.body;

    const playerCount = await refreshSegmentPlayerCount(gameID, branchName, segmentID)
    if (!playerCount) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    res.status(200).json({ success: true, playerCount: playerCount.length });

  } catch (error) {
    console.error('Error refreshing segmentPlayerCount:', error);
    next(error)
  }
});

app.post('/api/recalculateSegmentSize', async (req, res, next) => {
  const { gameID, branchName, segmentID } = req.body;
  try {

    const response = await recalculateSegment(gameID, branchName, segmentID)
    res.status(response.status).json(response.json)
  } catch (error) {
    console.error('Error at recalculateSegmentSize:', error)
    next(error)
  }
});

app.post('/api/removeSegmentByID', async (req, res, next) => {
  const { gameID, branchName, segmentID } = req.body;

  try {
    const result = await removeSegmentByID(gameID, branchName, segmentID);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error removing segment by ID:', error);
    next(error);
  }
});

app.post('/api/addStatisticsTemplate', async (req, res, next) => {
  const { gameID, branchName, templateObject } = req.body;

  try {
    const result = await addStatisticsTemplate(gameID, branchName, templateObject);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error adding statistics template:', error);
    next(error);
  }
});


app.post('/api/updateStatisticsTemplate', async (req, res, next) => {
  const { gameID, branchName, templateID, templateObject } = req.body;

  try {
    const result = await updateStatisticsTemplate(gameID, branchName, templateID, templateObject);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error editing statistics template:', error);
    next(error);
  }
});
    
app.post('/api/getWarehouseTemplates', async (req, res, next) => {
  const { gameID, branchName } = req.body;

  try {
    const templates = await getWarehouseTemplates(gameID, branchName);
    res.status(200).json({ success: true, message: 'Warehouse templates retrieved successfully', templates });
  } catch (error) {
    console.error('Error getting warehouse templates:', error);
    next(error);
  }
});


app.post('/api/getWarehousePlayers', async (req, res, next) => {
  const { gameID, branchName } = req.body;

  try {
    const playerIDs = await getWarehousePlayers(gameID, branchName);
    res.status(200).json({ success: true, playerIDs });
  } catch (error) {
    console.error('Error getting warehouse players:', error);
    next(error);
  }
});


app.post('/api/getWarehousePlayerData', async (req, res, next) => {
  const { gameID, branchName, clientID } = req.body;

  try {
    const playerWarehouse = await getWarehousePlayerData(gameID, branchName, clientID);
    res.status(200).json({ success: true, player: playerWarehouse });
  } catch (error) {
    console.error('Error getting warehouse player data:', error);
    next(error);
  }
});

app.post('/api/getAllAnalyticsEvents', async (req, res, next) => {
  try {
    const { gameID, branchName, shouldReturnValues } = req.body;
    const events = await getAllAnalyticsEvents(gameID, branchName, shouldReturnValues);
    res.json(events);
  } catch (error) {
    console.error(error);
    next(error); // Pass the error to the error-handling middleware
  }
});
app.post('/api/v2/getAllAnalyticsEvents', async (req, res, next) => {
  try {
    const { gameID, branchName, getRemoved } = req.body;
    const events = await getAllAnalyticsEventsv2(gameID, branchName, getRemoved);
    res.status(200).json({ success: true, message: 'Analytics events retrieved successfully', events: events });
  } catch (error) {
    console.error(error);
    next(error); // Pass the error to the error-handling middleware
  }
});
app.post('/api/getAnalyticsEvent', async (req, res, next) => {
  try {
    const { gameID, branchName, eventID } = req.body;
    const selectedEvent = await getAnalyticsEvent(gameID, branchName, eventID);
    res.json(selectedEvent);
  } catch (error) {
    console.error(error);
    next(error);
  }
});
app.post('/api/getAnalyticsEvents', async (req, res, next) => {
  try {
    const { gameID, branchName, eventIDs } = req.body;
    const selectedEvents = await getAnalyticsEvents(gameID, branchName, eventIDs);
    res.json(selectedEvents);
  } catch (error) {
    console.error(error);
    next(error)
  }
});
app.post('/api/addAnalyticsTemplate', async (req, res, next) => {
  const { gameID, branchName, templateObject } = req.body;

  try {
    const newTemplate = await addAnalyticsTemplate(gameID, branchName, templateObject);
    res.status(200).json({ success: true, message: 'Analytics template added successfully', newTemplate });
  } catch (error) {
    console.error(error);
    next(error);
  }
});


app.post('/api/removeWarehouseTemplate', async (req, res, next) => {
  try {
    const { gameID, branchName, templateID } = req.body;
    await removeWarehouseTemplate(gameID, branchName, templateID);
    res.status(200).json({ success: true, message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error removing template:', error);
    res.status(500).json({ message: 'Internal Server Error' });
    next(error);
  }
});

app.post('/api/getAllNodes', async (req, res, next) => {
  const { gameID, branchName } = req.body;

  try {
    const nodes = await getAllNodes(gameID, branchName);
    res.status(200).json(nodes);
  } catch (error) {
    console.error('Error fetching nodes:', error);
    res.status(500).json({ message: 'Internal Server Error' });
    next(error);
  }
});

app.post('/api/getOffers', async (req, res) => {
  const { gameID, branch } = req.body;

  try {

    const offers = await getOffers(gameID, branch)

    res.status(200).json({ success: true, offers });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})



// Analytics filter button. Fetching all segments to populate it's menu items.
app.post('/api/getAllSegmentsForAnalyticsFilter', async (req, res, next) => {
  const { gameID, branchName } = req.body;
  try {
    const segments = await getAllSegmentsForAnalyticsFilter(gameID, branchName);
    res.status(200).json({ success: true, message: segments });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
    next(error);
  }
});

app.post('/api/analytics/getDAU', async function (req, res, next) {
  const { gameID, branchName, filterDate, filterSegments } = req.body;

  try {
    const result = await getDAU(gameID, branchName, filterDate, filterSegments);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});
app.post('/api/analytics/getRevenue', async function (req, res, next) {
  const { gameID, branchName, filterDate, filterSegments } = req.body;

  try {
    const result = await getRevenue(gameID, branchName, filterDate, filterSegments);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});
app.post('/api/analytics/getRandomDataForUniversalChart', async function (req, res, next) {
  const { gameID, branchName, filterDate, filterSegments, categoryField } = req.body;

  try {
    const result = await getRandomDataForUniversalChart(gameID, branchName, filterDate, filterSegments, categoryField);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});
app.post('/api/analytics/getAvgCustomerProfile', async function (req, res, next) {
  const { gameID, branchName, filterDate, filterSegments } = req.body;

  try {
    const result = await getAvgCustomerProfile(gameID, branchName, filterDate, filterSegments);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});


app.post('/api/analytics/getEconomyBalanceForCurrency', async function (req, res, next) {
  const { gameID, branchName, filterDate, filterSegments } = req.body;

  try {
    const result = await getEconomyBalanceForCurrency(gameID, branchName, filterDate);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});
app.post('/api/analytics/getPaymentDriversOffers', async function (req, res, next) {
  const { gameID, branchName, filterDate, filterSegments } = req.body;

  try {
    const result = await getPaymentDriversOffers(gameID, branchName);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

app.post('/api/analytics/getSourcesAndSinks', async function (req, res, next) {
  const { gameID, branchName, filterDate, filterSegments } = req.body;

  try {
    const result = await getSourcesAndSinks(gameID, branchName, filterSegments);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});



app.post('/api/analytics/getProfileComposition', async function (req, res, next) {
  const {
    gameID, branchName, 
    baseSegment, filters, 
    element1, element2, element3,
  } = req.body;

  try {
    const result = await getProfileComposition(gameID, branchName, baseSegment, filters, element1, element2, element3);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

app.post('/api/getProfileCompositionPreset', async function (req, res, next) {
  const { gameID, branchName } = req.body;
  try {
    const result = await getProfileCompositionPreset(gameID, branchName);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});
app.post('/api/setProfileCompositionPreset', async function (req, res, next) {
  const { gameID, branchName, presets = [] } = req.body;
  try {
    const result = await setProfileCompositionPreset(gameID, branchName, presets);
    if (!result) {
      return res.status(404).json({ success: false, message: 'Charts not found' });
    }
    res.status(200).json({ success: true, message: 'Profile composition preset set' });
  } catch (error) {
    console.error(error);
    next(error);
  }
});






app.post('/api/analytics/getOffersDataTableWithProfile', async function (req, res, next) {
  const { gameID, branch, filterDate, filterSegments, priceType } = req.body;

  try {
    const offers = await getOffersDataTableWithProfile(gameID, branch, filterSegments, priceType);
    res.status(200).json({ success: true, offers });
  } catch (error) {
    console.error(error);
    next(error);
  }
});
app.post('/api/analytics/getFirstPaymentConversionTime', async function (req, res, next) {
  const { gameID, branch, filterDate, filterSegments } = req.body;

  try {
    const result = await getFirstPaymentConversionTime(gameID, branch, filterDate, filterSegments);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});
app.post('/api/analytics/getPaymentConversion', async function (req, res, next) {
  const { gameID, branchName, filterDate, filterSegments } = req.body;

  try {
    const result = await getPaymentConversion(gameID, branchName, filterDate, filterSegments);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});
app.post('/api/analytics/getMainPaymentConversionFunnel', async function (req, res, next) {
  const { gameID, branch, filterDate, filterSegments } = req.body;

  try {
    const result = await getMainPaymentConversionFunnel(gameID, branch, filterDate, filterSegments);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});


app.post('/api/analytics/getActiveSessions', async function (req, res, next) {
  const { gameID, branchName, filterDate, filterSegments } = req.body;

  try {
    const result = await getActiveSessions(gameID, branchName, filterDate, filterSegments);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

app.post('/api/analytics/getOfferAnalytics', async function (req, res, next) {
  const { gameID, branchName, offerID } = req.body;

  try {
    const result = await getOfferAnalytics(gameID, branchName, offerID);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

app.post('/api/analytics/getOfferSalesAndRevenue', async function (req, res, next) {
  const { gameID, branchName, filterDate, filterSegments, offerID } = req.body;

  try {
    const result = await getOfferSalesAndRevenue(gameID, branchName, filterDate, filterSegments, offerID);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

app.post('/api/analytics/getOverviewStatisticsForPublisher', async function (req, res, next) {
  const { studioIDs } = req.body;

  try {
    const result = await getOverviewStatisticsForPublisher(studioIDs);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

app.post('/api/analytics/getOverviewStatistics', async function (req, res, next) {
  const { gameIDs } = req.body;

  try {
    const result = await getOverviewStatistics(gameIDs);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

app.post('/api/analytics/getRandomDataForABTest', async function (req, res, next) {
  const { gameID, branchName, filterDate, testID } = req.body;

  try {
    const result = await getRandomDataForABTest(gameID, branchName, filterDate, testID);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});


app.post('/api/getDashboards', async function (req, res, next) {
  const { gameID, branch } = req.body;

  try {
    const result = await getDashboards(gameID, branch);
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    next(error);
  }
});
app.post('/api/getDashboardByLink', async function (req, res, next) {
  const { gameID, branch, linkName } = req.body;

  try {
    const result = await getDashboardByLink(gameID, branch, linkName);
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    next(error);
  }
});


app.post('/api/addCustomDashboard', async function (req, res, next) {
  const { gameID, branch, newDashboard } = req.body;

  try {
    const result = await addCustomDashboard(gameID, branch, newDashboard);
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    next(error);
  }
});
app.post('/api/removeCustomDashboard', async function (req, res, next) {
  const { gameID, branch, dashboardID } = req.body;

  try {
    const result = await removeCustomDashboard(gameID, branch, dashboardID);
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    next(error);
  }
});

app.post('/api/updateCustomDashboard', async function (req, res, next) {
  const { gameID, branch, dashboardID, newDashboard } = req.body;

  try {
    const result = await updateCustomDashboard(gameID, branch, dashboardID, newDashboard);
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    next(error);
  }
});

app.post('/api/getABTests', async function (req, res, next) {
  const { gameID, branchName } = req.body;

  try {
    const result = await getABTests(gameID, branchName);
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    next(error);
  }
});

app.post('/api/createABTest', async function (req, res, next) {
  const { gameID, branchName, testObject } = req.body;

  try {
    const result = await createABTest(gameID, branchName, testObject);
    if (result.success) {
      res.status(200).json({ success: true });
    } else {
      res.status(500).json({ success: false, message: result.message });
    }
  } catch (error) {
    next(error);
  }
});

app.post("/api/removeABTest", async function (req, res, next) {
  const { gameID, branchName, testObject, archive, archiveResult } = req.body;

  try {
    const result = await removeABTest(gameID, branchName, testObject, archive, archiveResult);
    if (result.success) {
      res.status(200).json({ success: true });
    } else {
      res.status(500).json({ success: false, message: result.message });
    }
  } catch (error) {
    next(error);
  }
});

app.post("/api/updateABTest", async function (req, res, next) {
  const { gameID, branchName, testObject } = req.body;

  try {
    const result = await updateABTest(gameID, branchName, testObject);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/pushChangesToBranch", async function (req, res, next) {
  const { gameID, sourceBranch, targetBranch } = req.body;

  try {
    const result = await pushChangesToBranch(gameID, sourceBranch, targetBranch);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});




app.get('/api/health', async (req, res, next) => {
  res.json({health: 'OK.', message: `Current Version is ${process.env.CURRENT_VERSION}`});
});

app.use((err, req, res, next) => {
  console.log('Error caught at endpoint:', req.originalUrl, err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
})


export default app;