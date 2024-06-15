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

export async function removeAnalyticsEvent(gameID, branchName, eventID) {
  try {
    if (!gameID || !branchName || !eventID) {
      throw new Error("Missing required parameters");
    }

    // Set analytics event field "removed" to true
    const result = await AnalyticsEvents.findOneAndUpdate(
      { gameID, "branches.branch": branchName },
      { $set: { "branches.$.events.$[e].removed": true } },
      { arrayFilters: [{ "e.eventID": eventID }] }
    );

    return result;
  } catch (error) {
    throw error;
  }
}
export async function updateAnalyticsEvent(
  gameID,
  branchName,
  eventID,
  eventObject
) {
  try {
    if (!gameID || !branchName || !eventID || !eventObject) {
      throw new Error("Missing required parameters");
    }

    let tempObj = eventObject;

    // Find and update the event in the AnalyticsEvents collection
    const updatedAnalyticsEvent = await AnalyticsEvents.findOneAndUpdate(
      {
        gameID: gameID,
        "branches.branch": branchName,
        "branches.events.eventID": eventID,
      },
      {
        $set: {
          "branches.$[b].events.$[e].eventName": tempObj.eventName,
          "branches.$[b].events.$[e].eventCodeName": tempObj.eventCodeName,
          "branches.$[b].events.$[e].values": tempObj.values,
          "branches.$[b].events.$[e].comment": tempObj.comment,
          "branches.$[b].events.$[e].tags": tempObj.tags,
        },
      },
      {
        arrayFilters: [{ "b.branch": branchName }, { "e.eventID": eventID }],
        new: true,
      }
    );

    if (!updatedAnalyticsEvent) {
      throw new Error("Analytics event not found");
    }

    return updatedAnalyticsEvent;
  } catch (error) {
    throw error;
  }
}

export async function createNewAnalyticsEvent(gameID, branchName) {
  try {
    if (!gameID || !branchName) {
      throw new Error("Missing required parameters");
    }

    const eventID = new mongoose.Types.ObjectId().toString();
    const newEvent = {
      eventID,
      eventName: "New Event",
      eventCodeName: "",
      values: [],
      comment: "",
      tags: [],
    };

    // Add the new event to the AnalyticsEvents collection
    await AnalyticsEvents.findOneAndUpdate(
      { gameID, "branches.branch": branchName },
      { $addToSet: { "branches.$.events": newEvent } },
      { upsert: true, new: true }
    );

    return newEvent;
  } catch (error) {
    throw error;
  }
}

export async function getAnalyticsEventsConfig(gameID, branchName, eventIDs) {
  try {
    if (!gameID || !branchName || !eventIDs || !eventIDs.length) {
      throw new Error("Missing required parameters");
    }

    const analyticsData = await AnalyticsEvents.findOne(
      { gameID, "branches.branch": branchName },
      { "branches.$": 1 }
    );

    if (!analyticsData) {
      throw new Error("Data not found");
    }

    const branch = analyticsData.branches.find((b) => b.branch === branchName);
    const filteredEvents = branch.events.filter((event) =>
      eventIDs.includes(event.eventID)
    );

    return filteredEvents;
  } catch (error) {
    throw error;
  }
}
