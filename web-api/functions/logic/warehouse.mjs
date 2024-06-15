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


import mongoose from "mongoose";
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
export async function removeWarehouseTemplate(gameID, branchName, templateID) {
  if (!gameID || !branchName || !templateID) {
    throw new Error("Missing required parameters");
  }

  const result = await PWtemplates.findOneAndUpdate(
    { gameID, "branches.branch": branchName },
    {
      $pull: {
        "branches.$.templates.analytics": { templateID: templateID },
        "branches.$.templates.statistics": { templateID: templateID },
      },
    },
    { new: true }
  );

  if (!result) {
    throw new Error("Template not found or not deleted");
  }

  // Remove conditions from segments
  removeConditionsFromSegments(gameID, branchName, [templateID]);
}
export async function calculateInitialElementValue(
  gameID,
  branchName,
  template
) {
  const eventIDtoFind = template.templateAnalyticEventID;
  const valueIDtoFind = template.templateEventTargetValueId;

  try {
    // Поиск нужного ивента в базе данных
    const event = await AnalyticsEvents.findOne(
      {
        gameID: gameID,
        branches: {
          $elemMatch: {
            branch: branchName,
            "events.eventID": eventIDtoFind,
          },
        },
      },
      {
        "branches.$": 1, // Проекция на получение только первого совпадения в массиве branches
      }
    );

    if (!event) {
      throw new Error(`Event with ID ${eventIDtoFind} not found.`);
    }

    // Get event from object
    const foundEvent = event.branches.reduce((result, branch) => {
      const eventInBranch = branch.events.find(
        (e) => e.eventID === eventIDtoFind
      );
      return eventInBranch ? eventInBranch : result;
    }, null);

    if (!foundEvent) {
      throw new Error(`Event with ID ${eventIDtoFind} not found.`);
    }

    // Find value index, so we know which column in Druid to seek for (value1, value2, value3)
    const valueIndex = foundEvent.values.findIndex(
      (value) => value._id.toString() === valueIDtoFind
    );

    if (valueIndex !== 0 || valueIndex !== undefined) {
      try {
        // Getting all "recent" clientIDs from Druid
        const response = await druidLib.getRecentClientIDs(gameID, branchName);
        const clientIDs = response;

        // If there are no players, just return.
        if (!clientIDs || clientIDs.length === 0) return;

        let players = await PWplayers.find({
          gameID: isDemoGameID(gameID),
          branch: branchName,
          clientID: { $in: clientIDs.map(String) },
        });

        // Iterate each found client
        const promises = players.map(async (player) => {
          if (player) {
            // So we can find corresponding fields in Druid and get value from them. Can be "value1", "value2" and "value3"
            let targetValueColumn = `value${valueIndex + 1}`;

            // Needed for some calculations
            let isFloat;

            // String, int, float, money etc
            let eventValueFormat = foundEvent.values[valueIndex].valueFormat;

            // Give initial elementValue
            switch (template.templateMethod) {
              case "mostRecent":
                const mostRecentValue = await druidLib.getMostRecentValue(
                  gameID,
                  branchName,
                  player.clientID,
                  "designEvent",
                  foundEvent.eventCodeName,
                  targetValueColumn
                );
                playerWarehouseLib.setElementValue(
                  gameID,
                  branchName,
                  player.clientID,
                  template.templateID,
                  mostRecentValue
                );
                break;

              case "firstReceived":
                const firstReceived = await druidLib.getFirstEventValue(
                  gameID,
                  branchName,
                  player.clientID,
                  "designEvent",
                  foundEvent.eventCodeName,
                  targetValueColumn
                );
                playerWarehouseLib.setElementValueFirstTimeOnly(
                  gameID,
                  branchName,
                  player.clientID,
                  template.templateID,
                  firstReceived
                );
                break;

              case "mostCommon":
                const mostCommonValues = await druidLib.getMostCommonValue(
                  gameID,
                  branchName,
                  player.clientID,
                  "designEvent",
                  foundEvent.eventCodeName,
                  targetValueColumn
                );
                playerWarehouseLib.setElementValues(
                  gameID,
                  branchName,
                  player.clientID,
                  template.templateID,
                  mostCommonValues
                );
                break;

              case "leastCommon":
                const leastCommonValues = await druidLib.getLeastCommonValue(
                  gameID,
                  branchName,
                  player.clientID,
                  "designEvent",
                  foundEvent.eventCodeName,
                  targetValueColumn
                );
                playerWarehouseLib.setElementValue(
                  gameID,
                  branchName,
                  player.clientID,
                  template.templateID,
                  leastCommonValues
                );
                break;

              case "mean":
                switch (eventValueFormat) {
                  case "string":
                    isFloat = false;
                    break;
                  case "integer":
                    isFloat = false;
                    break;
                  case "float":
                    isFloat = true;
                    break;
                  case "percentile":
                    isFloat = true;
                    break;
                  case "money":
                    isFloat = true;
                    break;
                  default:
                    break;
                }
                const meanValue = await druidLib.getMeanValue(
                  gameID,
                  branchName,
                  player.clientID,
                  "designEvent",
                  foundEvent.eventCodeName,
                  targetValueColumn,
                  isFloat
                );
                playerWarehouseLib.setElementValue(
                  gameID,
                  branchName,
                  player.clientID,
                  template.templateID,
                  meanValue
                );
                break;

              case "meanForTime":
                switch (eventValueFormat) {
                  case "string":
                    isFloat = false;
                    break;
                  case "integer":
                    isFloat = false;
                    break;
                  case "float":
                    isFloat = true;
                    break;
                  case "percentile":
                    isFloat = true;
                    break;
                  case "money":
                    isFloat = true;
                    break;
                  default:
                    break;
                }
                const meanForTimeValue = await druidLib.getMeanValueForTime(
                  gameID,
                  branchName,
                  player.clientID,
                  "designEvent",
                  foundEvent.eventCodeName,
                  targetValueColumn,
                  isFloat,
                  template.templateMethodTime
                );
                playerWarehouseLib.setElementValue(
                  gameID,
                  branchName,
                  player.clientID,
                  template.templateID,
                  meanForTimeValue
                );
                break;

              case "numberOfEvents":
                const numberOfEvents = await druidLib.getEventNumber(
                  gameID,
                  branchName,
                  player.clientID,
                  "designEvent",
                  foundEvent.eventCodeName,
                  targetValueColumn
                );
                playerWarehouseLib.setElementValue(
                  gameID,
                  branchName,
                  player.clientID,
                  template.templateID,
                  numberOfEvents
                );
                break;

              case "numberOfEventsForTime":
                const numberOfEventsForTime =
                  await druidLib.getNumberOfEventsForTime(
                    gameID,
                    branchName,
                    player.clientID,
                    "designEvent",
                    foundEvent.eventCodeName,
                    template.templateMethodTime
                  );
                playerWarehouseLib.setElementValue(
                  gameID,
                  branchName,
                  player.clientID,
                  template.templateID,
                  numberOfEventsForTime
                );
                break;

              case "summ":
                switch (eventValueFormat) {
                  case "string":
                    isFloat = false;
                    break;
                  case "integer":
                    isFloat = false;
                    break;
                  case "float":
                    isFloat = true;
                    break;
                  case "percentile":
                    isFloat = true;
                    break;
                  case "money":
                    isFloat = true;
                    break;
                  default:
                    break;
                }
                const summ = await druidLib.getSummValue(
                  gameID,
                  branchName,
                  player.clientID,
                  "designEvent",
                  foundEvent.eventCodeName,
                  targetValueColumn,
                  isFloat
                );
                playerWarehouseLib.setElementValue(
                  gameID,
                  branchName,
                  player.clientID,
                  template.templateID,
                  summ
                );
                break;

              // Define which format is which format. This way we can either pick float mean from Druid
              // ...or transform it to integer.
              case "summForTime":
                switch (eventValueFormat) {
                  case "string":
                    isFloat = false;
                    break;
                  case "integer":
                    isFloat = false;
                    break;
                  case "float":
                    isFloat = true;
                    break;
                  case "percentile":
                    isFloat = true;
                    break;
                  case "money":
                    isFloat = true;
                    break;
                  default:
                    break;
                }
                const summForTime = await druidLib.getSummValueForTime(
                  gameID,
                  branchName,
                  player.clientID,
                  "designEvent",
                  foundEvent.eventCodeName,
                  targetValueColumn,
                  isFloat,
                  template.templateMethodTime
                );
                playerWarehouseLib.setElementValue(
                  gameID,
                  branchName,
                  player.clientID,
                  template.templateID,
                  summForTime
                );
                break;

              default:
                console.warn(
                  `Unknown templateMethod: ${template.templateMethod}`
                );
                break;
            }
          }
        });

        // Wait till everything is complete
        await Promise.all(promises);
      } catch (error) {
        console.error(error);
      }
    }
  } catch (error) {
    console.error(error.message);
    return null;
  }
}

export async function addAnalyticsTemplate(gameID, branchName, templateObject) {
  // Generate a unique ObjectID for templateID
  const templateID = new mongoose.Types.ObjectId();

  // Add the generated templateID to the template object
  templateObject.templateID = templateID;

  // Find or create playerWarehouse object
  let playerWarehouse = await PWtemplates.findOne({ gameID });

  if (!playerWarehouse) {
    playerWarehouse = new PlayerWarehouse({
      gameID,
      branches: [
        {
          branch: branchName,
          templates: { analytics: [], statistics: [] },
          players: [],
        },
      ],
    });
  }

  // Find or create branch object
  const branch = playerWarehouse.branches.find((b) => b.branch === branchName);

  // Add the template to analytics
  branch.templates.analytics.push(templateObject);

  // Save changes
  await playerWarehouse.save();

  // Set initial element values for all players based on existing data
  calculateInitialElementValue(gameID, branchName, templateObject);

  return templateObject;
}

export async function getWarehousePlayerData(gameID, branchName, clientID) {
  try {
    // Find the PlayerWarehouse document by gameID, branchName, and clientID
    const playerWarehouse = await PWplayers.findOne({
      gameID: isDemoGameID(gameID),
      branch: branchName,
      clientID,
    });

    if (!playerWarehouse) {
      const error = new Error("PlayerWarehouse not found");
      error.statusCode = 404;
      throw error;
    }

    return playerWarehouse;
  } catch (error) {
    throw error;
  }
}
export async function getWarehousePlayers(gameID, branchName) {
  try {
    // Find the PlayerWarehouse documents by gameID and branchName
    const playerWarehouse = await PWplayers.find(
      { gameID: isDemoGameID(gameID), branch: branchName },
      {
        elements: 0,
        inventory: 0,
        goods: 0,
        abtests: 0,
        segments: 0,
        branch: 0,
        _id: 0,
        gameID: 0,
      }
    );

    if (!playerWarehouse) {
      const error = new Error("PlayerWarehouse not found");
      error.statusCode = 404;
      throw error;
    }

    // Extract an array of clientID from players
    const playerIDs = playerWarehouse.map((player) => player.clientID);
    return playerIDs;
  } catch (error) {
    throw error;
  }
}

export async function assignNamesToAnalyticsEvents(
  gameID,
  branchName,
  analyticsTemplates
) {
  try {
    // Iterate through analyticsTemplates and update templateVisualEventName and templateVisualValueName
    if (analyticsTemplates && analyticsTemplates.length > 0) {
      const updatedTemplates = await Promise.all(
        analyticsTemplates.map(async (template) => {
          const gameDoc = await AnalyticsEvents.findOne({
            gameID: gameID,
            "branches.branch": branchName,
            "branches.events.eventID": template.templateAnalyticEventID,
          }).lean();

          if (gameDoc) {
            const targetEvent = gameDoc.branches
              .find((b) => b.branch === branchName)
              ?.events.find(
                (e) => e.eventID === template.templateAnalyticEventID
              );
            const targetEventValue = targetEvent.values.find(
              (value) =>
                value._id.toString() === template.templateEventTargetValueId
            );

            // Create a new object with updated fields
            const updatedTemplate = {
              ...template.toJSON(),
              templateVisualEventName:
                targetEvent?.eventName || "Event not found",
              templateVisualValueName:
                targetEventValue?.valueName || "Value not found",
            };

            return updatedTemplate;
          } else {
            // If the document is not found, return the original template
            return template;
          }
        })
      );

      return updatedTemplates;
    }
  } catch (error) {
    throw error;
  }
}
export async function getWarehouseTemplates(gameID, branchName) {
  // Find the PlayerWarehouse document by gameID and branchName
  let playerWarehouse = await PWtemplates.findOne({
    gameID,
    "branches.branch": branchName,
  });

  // Extract the required branch
  const branch = playerWarehouse?.branches.find((b) => b.branch === branchName);

  // Extract the templates object from the found branch
  const templates = branch ? branch.templates : {};

  // Assign names to analytics events
  const updatedAnalyticsTemplates = await assignNamesToAnalyticsEvents(
    gameID,
    branchName,
    templates.analytics
  );

  // Update the templates object with updated analytics templates
  const updatedTemplates = {
    _id: templates._id,
    analytics: updatedAnalyticsTemplates,
    statistics: templates.statistics,
  };

  return updatedTemplates;
}

export async function updateStatisticsTemplate(
  gameID,
  branchName,
  templateID,
  templateObject
) {
  try {
    // Update the statistics template in the database
    await PWtemplates.findOneAndUpdate(
      {
        gameID: gameID,
        "branches.branch": branchName,
        "branches.templates.statistics.templateID": templateID,
      },
      {
        $set: {
          "branches.$[branch].templates.statistics.$[template].templateName":
            templateObject.templateName,
          "branches.$[branch].templates.statistics.$[template].templateCodeName":
            templateObject.templateCodeName,
          "branches.$[branch].templates.statistics.$[template].templateDefaultValue":
            templateObject.templateDefaultValue,
          "branches.$[branch].templates.statistics.$[template].templateValueRangeMin":
            templateObject.templateValueRangeMin,
          "branches.$[branch].templates.statistics.$[template].templateValueRangeMax":
            templateObject.templateValueRangeMax,
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

    return {
      success: true,
      message: "Statistics template edited successfully",
    };
  } catch (error) {
    throw error;
  }
}

export async function addStatisticsTemplate(
  gameID,
  branchName,
  templateObject
) {
  try {
    // Find the PlayerWarehouse document by gameID
    let playerWarehouse = await PWtemplates.findOne({ gameID });

    // Check if a branch with the specified branchName already exists
    const branchIndex = playerWarehouse.branches.findIndex(
      (b) => b.branch === branchName
    );

    if (branchIndex === -1) {
      // If it does not exist, create a new branch
      playerWarehouse.branches.push({
        branch: branchName,
        templates: { statistics: [] },
      });
    }

    // Extract the branch after addition to access it by index
    const branch = playerWarehouse.branches[branchIndex];

    // Generate a new templateID
    const newTemplateID = new mongoose.Types.ObjectId();
    // Create a new template object
    const newTemplate = { ...templateObject, templateID: newTemplateID };

    // Add the new template to the statistics templates array
    if (!branch.templates) {
      branch.templates = { statistics: [newTemplate] };
    } else if (!branch.templates.statistics) {
      branch.templates.statistics = [newTemplate];
    } else {
      branch.templates.statistics.push(newTemplate);
    }

    // Save the changes to the database
    await playerWarehouse.save();

    return {
      success: true,
      message: "Statistics template added successfully",
      newTemplate,
    };
  } catch (error) {
    throw error;
  }
}

export async function getTemplatesForSegments(gameID, branchName) {
  try {
    // Check for missing gameID or branchName
    if (!gameID || !branchName) {
      throw new Error("Missing gameID or branchName in the request");
    }

    // Find player warehouse templates
    const playerWarehouse = await PWtemplates.findOne({
      gameID,
      "branches.branch": branchName,
    });

    // If player warehouse not found, return error
    if (!playerWarehouse) {
      throw new Error(
        "PlayerWarehouse not found for the specified gameID and branchName"
      );
    }

    // Find branch by branchName
    const branch = playerWarehouse.branches.find(
      (b) => b.branch === branchName
    );

    // If branch not found, return error
    if (!branch) {
      throw new Error("Branch not found for the specified branchName");
    }

    // If no templates found, return error
    if (
      branch.templates.analytics.length === 0 &&
      branch.templates.statistics.length === 0
    ) {
      throw new Error("No templates found");
    }

    // Return templates in branchSchema
    return branch.templates;
  } catch (error) {
    throw error;
  }
}

export async function countPlayersInWarehouse(gameID, branchName) {
  try {
    // Check for missing gameID or branchName
    if (!gameID || !branchName) {
      throw new Error("Missing gameID or branchName in the request");
    }

    // Find players by gameID and branchName
    const players = await PWplayers.find({
      gameID: isDemoGameID(gameID),
      branch: branchName,
    });

    // Return the number of players
    return players.length;
  } catch (error) {
    throw error;
  }
}
