import { PlanningTreeModel } from "../../../models/planningTreeModel.js";
import { User } from "../../../models/userModel.js";
import { NodeModel } from "../../../models/nodeModel.js";
import { Game } from "../../../models/gameModel.js";
import { Studio } from "../../../models/studioModel.js";
import { Publisher } from "../../../models/publisherModel.js";
import { RemoteConfig } from "../../../models/remoteConfigModel.js";
import { AnalyticsEvents } from "../../../models/analyticsevents.js";
import { Segments } from "../../../models/segmentsModel.js";
import { Relations } from "../../../models/relationsModel.js";
import { Localization } from "../../../models/localizationModel.js";
import { OffersModel as Offers } from "../../../models/offersModel.js";
import { charts as CustomCharts } from "../../../models/charts.js";
import { ABTests } from "../../../models/abtests.js";
import { PWplayers } from "../../../models/PWplayers.js";
import { PWtemplates } from "../../../models/PWtemplates.js";

import * as segmentsLib from "../../../libs/segmentsLib.mjs";
import druidLib from "../../../libs/druidLib.cjs";
import * as playerWarehouseLib from "../../../libs/playerWarehouseLib.mjs";

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
import mongoose from "mongoose";

export async function removeSegmentByID(gameID, branchName, segmentID) {
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
        return { success: true, message: 'Segment removed successfully' };
      } else {
        return { success: false, message: 'Segment not found' };
      }
    } catch (error) {
      throw error;
    }
  }

  export async function recalculateSegment(gameID, branchName, segmentID) {
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
  
        const players = await PWplayers.find({
          gameID: isDemoGameID(gameID),
          branch: branchName,
          clientID: { $in: clientIDs.map(String) },
        });
  
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

  export async function refreshSegmentPlayerCount(gameID, branchName, segmentID) {
    try {
  
      // Находим всех игроков, у которых в массиве segments есть указанный segmentID
      const playersWithSegment = await PWplayers.find({
        gameID: isDemoGameID(gameID),
        branch: branchName,
        segments: { $in: [segmentID] },
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

  export async function setSegmentConditions(gameID, branchName, segmentID, segmentConditions) {
    try {
      // Check for missing required parameters
      if (!gameID || !branchName || !segmentID || !segmentConditions) {
        throw new Error('Missing required parameters in the request');
      }
  
      // Find the segment
      const segment = await Segments.findOne({
        'gameID': gameID,
        'branches.branch': branchName,
        'branches.segments.segmentID': segmentID,
      });
  
      // Check if the segment exists
      if (!segment) {
        throw new Error('Segment not found');
      }
  
      // Update segment conditions
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
  
      return { success: true, message: 'Segment conditions updated successfully' };
    } catch (error) {
      throw error;
    }
  }

  export async function setSegmentComment(gameID, branchName, segmentID, newComment) {
    try {
      // Check if newComment is null or undefined, if so, set it to an empty string
      if (!newComment) {
        newComment = '';
      }
  
      // Check for missing gameID, branchName, segmentID, or newComment
      if (!gameID || !branchName || !segmentID) {
        throw new Error('Missing gameID, branchName, segmentID, or newComment in the request');
      }
  
      // Find segments by gameID and branchName
      let segments = await Segments.findOne({ gameID, 'branches.branch': branchName });
  
      // If segments are not found, throw an error
      if (!segments) {
        throw new Error('Segments not found for the specified gameID and branchName');
      }
  
      // Find the branch and segment
      const branch = segments.branches.find(b => b.branch === branchName);
      const segment = branch ? branch.segments.find(s => s.segmentID === segmentID) : null;
  
      // If the segment is not found, throw an error
      if (!segment) {
        throw new Error('Segment not found for the specified segmentID');
      }
  
      // Update segmentComment
      segment.segmentComment = newComment;
  
      // Save changes to the database
      await segments.save();
  
      // Return success message
      return 'SegmentComment updated successfully';
    } catch (error) {
      throw error;
    }
  }

  export async function setSegmentName(gameID, branchName, segmentID, newName) {
    try {
      // Check if newName is null or undefined, if so, set it to an empty string
      if (!newName) {
        newName = '';
      }
  
      // Check for missing gameID, branchName, segmentID, or newName
      if (!gameID || !branchName || !segmentID) {
        throw new Error('Missing gameID, branchName, segmentID, or newName in the request');
      }
  
      // Find segments by gameID and branchName
      let segments = await Segments.findOne({ gameID, 'branches.branch': branchName });
  
      // If segments are not found, throw an error
      if (!segments) {
        throw new Error('Segments not found for the specified gameID and branchName');
      }
  
      // Find the branch and segment
      const branch = segments.branches.find(b => b.branch === branchName);
      const segment = branch ? branch.segments.find(s => s.segmentID === segmentID) : null;
  
      // If the segment is not found, throw an error
      if (!segment) {
        throw new Error('Segment not found for the specified segmentID');
      }
  
      // Update segmentName
      segment.segmentName = newName;
  
      // Save changes to the database
      await segments.save();
  
      // Return success message
      return 'SegmentName updated successfully';
    } catch (error) {
      throw error;
    }
  }

  export async function createNewSegment(gameID, branchName) {
    try {
      // Check for missing gameID or branchName
      if (!gameID || !branchName) {
        throw new Error('Missing gameID or branchName in the request');
      }
  
      // Generate a unique identifier for the new segment
      const segmentID = new mongoose.Types.ObjectId().toString();
  
      // Create a new segment with empty fields
      const newSegment = {
        segmentID,
        segmentName: 'New segment',
        segmentConditions: [],
      };
  
      // Find or create a Segments document
      let segments = await Segments.findOne({ gameID, 'branches.branch': branchName });
  
      if (!segments) {
        segments = new Segments({
          gameID,
          branches: [{ branch: branchName, segments: [] }],
        });
      }
  
      // Add the new segment to the specified document
      const branch = segments.branches.find(b => b.branch === branchName);
      if (branch) {
        branch.segments.push(newSegment);
      } else {
        segments.branches.push({ branch: branchName, segments: [newSegment] });
      }
  
      // Save changes
      await segments.save();
  
      // Return the updated list of segments
      const updatedBranch = segments.branches.find(b => b.branch === branchName);
      const updatedSegments = updatedBranch ? updatedBranch.segments : [];
  
      return updatedSegments;
    } catch (error) {
      throw error;
    }
  }

  export async function getSegmentsByIdArray(gameID, branchName, segmentIDs) {
    try {
      // Check for missing gameID, branchName, or segmentIDs
      if (!gameID || !branchName || !segmentIDs) {
        throw new Error('Missing required parameters');
      }
  
      // Convert segmentIDs string to an array
      const segmentIDsArray = Array.isArray(segmentIDs) ? segmentIDs : [segmentIDs];
  
      // Find segments by gameID, branchName, and segmentIDs
      const segments = await Segments.findOne({
        gameID,
        'branches.branch': branchName,
        'branches.segments.segmentID': { $in: segmentIDsArray },
      });
  
      if (!segments) {
        throw new Error('Segments not found');
      }
  
      // Filter and extract segmentID and segmentName from the segments
      const filteredSegments = segments.branches
        .find(branch => branch.branch === branchName)
        .segments.filter(segment => segmentIDsArray.includes(segment.segmentID))
        .map(({ segmentID, segmentName }) => ({ segmentID, segmentName }));
  
      return filteredSegments;
    } catch (error) {
      throw error;
    }
  }

  export async function getAllSegments(gameID, branchName) {
    try {
      // Check for missing gameID or branchName
      if (!gameID || !branchName) {
        throw new Error('Missing gameID or branchName in the request');
      }
  
      // Find segments by gameID and branchName
      let segments = await Segments.findOne({ gameID, 'branches.branch': branchName });
  
      // If segments not found, create a new document with a default segment
      if (!segments) {
        segments = new Segments({
          gameID,
          branches: [{ branch: branchName, segments: [{ segmentID: 'everyone', segmentName: 'Everyone', segmentComment: '' }] }],
        });
  
        await segments.save();
      }
  
      // Return the array of segments
      const branch = segments.branches.find(b => b.branch === branchName);
      const segmentArray = branch ? branch.segments : [];
      return segmentArray;
    } catch (error) {
      throw error;
    }
  }




  // Remove all PW analytics templates by given eventIDs
export async function removeAnalyticsTemplatesByEventID(gameID, branchName, eventIDs) {
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
    console.log('Removed templates:', result.modifiedCount);

    // Удаление соответствующих условий из Segments
    if (templateIDs.length > 0) {
      await removeConditionsFromSegments(gameID, branchName, templateIDs);
    }
  } catch (error) {
    console.error('Error removing analytics templates:', error);
  }
}
// Clearing all segments' conditions that are dependent on removed template from PW
export async function removeConditionsFromSegments(gameID, branchName, templateIDs) {
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
      console.log('Objects with conditionElementID:', templateID, 'removed successfully.');
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