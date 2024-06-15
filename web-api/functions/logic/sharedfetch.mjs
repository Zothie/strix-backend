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

export async function getAllSegmentsForAnalyticsFilter(gameID, branchName) {
  const segments = await Segments.findOne(
    {
      gameID: gameID,
      "branches.branch": branchName,
    },
    {
      "branches.segments.segmentID": 1,
      "branches.segments.segmentName": 1,
      _id: 0,
    }
  );

  if (!segments) {
    throw new Error(
      `Segments not found for gameID: ${gameID} and branchName: ${branchName}`
    );
  }

  return segments.branches[0].segments;
}
export async function getAllNodes(gameID, branchName) {
  const nodesDocument = await NodeModel.findOne({ gameID });

  if (!nodesDocument) {
    throw new Error("Nodes not found");
  }

  const branch = nodesDocument.branches.find((b) => b.branch === branchName);

  if (!branch) {
    throw new Error("Branch not found");
  }

  return branch.planningTypes.map((planningType) => ({
    type: planningType.type,
    nodes: planningType.nodes,
  }));
}

export async function getAnalyticsEvents(gameID, branchName, eventIDs) {
  // Check for required parameters
  if (!gameID || !branchName || !eventIDs || eventIDs.length === 0) {
    throw new Error("Missing required parameters");
  }

  // Find the necessary events in the database
  const events = await AnalyticsEvents.findOne(
    {
      gameID: gameID,
      branches: {
        $elemMatch: {
          branch: branchName,
          "events.eventID": { $in: eventIDs },
        },
      },
    },
    {
      "branches.$": 1, // Projection to retrieve only the first match in the branches array
    }
  );

  if (!events) {
    throw new Error("Events not found");
  }

  // Find the corresponding events in the specified branch
  const branch = events.branches.find((b) => b.branch === branchName);
  if (!branch || !branch.events || branch.events.length === 0) {
    throw new Error("Events not found in the specified branch");
  }

  // Find events with the specified eventIDs
  const selectedEvents = branch.events.filter((e) =>
    eventIDs.includes(e.eventID)
  );
  if (selectedEvents.length === 0) {
    throw new Error(
      "No events found with specified eventIDs in the specified branch"
    );
  }

  return selectedEvents;
}

export async function getAnalyticsEvent(gameID, branchName, eventID) {
  // Check for required parameters
  if (!gameID || !branchName || !eventID) {
    throw new Error("Missing required parameters");
  }

  // Find the necessary event in the database
  const event = await AnalyticsEvents.findOne(
    {
      gameID: gameID,
      branches: {
        $elemMatch: {
          branch: branchName,
          "events.eventID": eventID,
        },
      },
    },
    {
      "branches.$": 1, // Projection to retrieve only the first match in the branches array
    }
  );

  if (!event) {
    throw new Error("Event not found");
  }

  // Find the corresponding event in the specified branch
  const branch = event.branches.find((b) => b.branch === branchName);
  if (!branch || !branch.events || branch.events.length === 0) {
    throw new Error("Event not found in the specified branch");
  }

  // Find the event with the specified eventID
  const selectedEvent = branch.events.find((e) => e.eventID === eventID);
  if (!selectedEvent) {
    throw new Error(
      "Event with specified eventID not found in the specified branch"
    );
  }

  return selectedEvent;
}

export async function getAllAnalyticsEvents(
  gameID,
  branchName,
  shouldReturnValues
) {
  try {
    const node = await NodeModel.findOne({
      "branches.branch": branchName,
      gameID: gameID,
    });

    if (!node) {
      const error = new Error("Node not found");
      error.statusCode = 404;
      throw error;
    }

    const result = [];

    for (const branch of node.branches) {
      if (branch.branch === branchName) {
        for (const planningType of branch.planningTypes) {
          for (const node of planningType.nodes) {
            const nodeInfo = {
              categoryName: planningType.type,
              nodes: [
                {
                  nodeName: node.name,
                  nodeID: node.nodeID,
                  events: await Promise.all(
                    node.analyticsEvents.map(async (eventID) => {
                      const event = await AnalyticsEvents.findOne({
                        "branches.branch": branchName,
                        gameID: gameID,
                        "branches.events.eventID": eventID,
                      });

                      return {
                        eventID: eventID,
                        eventName: event
                          ? event.branches
                              .find((b) => b.branch === branchName)
                              ?.events.find((e) => e.eventID === eventID)
                              ?.eventName || "Event not found"
                          : "Event not found",
                        eventCodeName: event
                          ? event.branches
                              .find((b) => b.branch === branchName)
                              ?.events.find((e) => e.eventID === eventID)
                              ?.eventCodeName || "Event ID not found"
                          : "Event ID not found",
                        values: shouldReturnValues
                          ? event.branches
                              .find((b) => b.branch === branchName)
                              ?.events.find((e) => e.eventID === eventID)
                              ?.values || "Event values not found"
                          : "Event values not found",
                      };
                    })
                  ),
                },
              ],
            };

            const existingCategory = result.find(
              (category) => category.categoryName === nodeInfo.categoryName
            );

            if (existingCategory) {
              const existingNode = existingCategory.nodes.find(
                (existingNode) =>
                  existingNode.nodeName === nodeInfo.nodes[0].nodeName
              );

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

    return result;
  } catch (error) {
    throw error;
  }
}

export async function getAllAnalyticsEventsv2(gameID, branchName, getRemoved) {
  // Check for required parameters
  if (!gameID || !branchName) {
    const error = new Error("Missing required parameters");
    error.statusCode = 400;
    throw error;
  }

  // Retrieve events from the database
  let events = await AnalyticsEvents.findOne(
    {
      gameID: gameID,
      "branches.branch": branchName,
    },
    {
      "branches.$": 1,
    }
  );

  // Process the events
  events = events?.branches[0].events;
  if (events && events.length > 0 && !getRemoved) {
    events = events.filter((event) => !event.removed);
  }

  return events;
}
