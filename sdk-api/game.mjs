import dotenv from "dotenv";

import { Schema, model } from "mongoose";
import { Kafka } from "kafkajs";

import express, { response } from "express";
import cors from "cors";
import mongoose from "mongoose";
import bodyParser from "body-parser";
import http from "http";
import morgan from "morgan";
dotenv.config();

const app = express();
const host = "0.0.0.0";
const port = process.env.PORT || 3005;
const mongoURI = process.env.MONGODB_URI;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb" }));

import EventEmitter from "eventemitter3";
const emitter = new EventEmitter();

mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });

app.use(bodyParser.json());

app.use(morgan("tiny"));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb" }));

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

import * as abTestManager from "./functions/abTestManager.mjs";
Object.assign(global, abTestManager);
import * as analyticsEventsProcessor from "./functions/analyticsEventsProcessor.mjs";
Object.assign(global, analyticsEventsProcessor);
import * as segmentManager from "./functions/segmentManager.mjs";
Object.assign(global, segmentManager);
import * as utility from "./functions/utility.mjs";
Object.assign(global, utility);
import * as warehouseManager from "./functions/warehouseManager.mjs";
Object.assign(global, warehouseManager);

// app.use(
//   cors({
//     origin: function (origin, callback) {
//       callback(null, true);
//     },
//     credentials: true,
//   })
// );

app.post("/api/v1/analytics/sendEvent", async (req, res) => {
  const {
    device,
    secret,
    session,
    language,
    platform,
    gameVersion,
    engineVersion,
    build,
    payload,
  } = req.body;

  console.log("/api/v1/analytics/sendEvent", req.body);

  if (!secret)
    return res
      .status(400)
      .json({ success: false, message: "API key is required" });
  if (!device)
    return res
      .status(400)
      .json({ success: false, message: "Device ID is required" });
  if (!session)
    return res
      .status(400)
      .json({ success: false, message: "Session ID is required" });
  if (!payload)
    return res
      .status(400)
      .json({ success: false, message: "Payload is required" });
  if (!language)
    return res
      .status(400)
      .json({ success: false, message: "Language is required" });
  if (!platform)
    return res
      .status(400)
      .json({ success: false, message: "Platform is required" });
  if (!gameVersion)
    return res
      .status(400)
      .json({ success: false, message: "Game version is required" });
  if (!engineVersion)
    return res
      .status(400)
      .json({ success: false, message: "Engine version is required" });
  if (!build)
    return res
      .status(400)
      .json({ success: false, message: "Build type is required" });
  if (payload.length === 0)
    return res
      .status(400)
      .json({ success: false, message: "Payload cannot be 0 length" });

  const gameObj = await getCachedGameIdBySecret(secret);
  if (!gameObj) {
    res.status(400).json({ success: false, message: "Invalid secret" });
    return;
  }

  // Answering to the last event in payload
  switch (payload[payload.length - 1].type) {
    case "newSession":
      processNewSessionEvent(res, gameObj, build, device);
      return;
    default:
      res.status(200).json({ success: true, message: "OK" });
  }

  // Processing payload events
  payload.forEach((event) => {
    switch (event.type) {
      case "newSession":
        break;
      default:
        break;
    }
  });
});

app.post("/api/v1/addValueToStatisticElement", async (req, res) => {
  const { secret, device, build, elementID, value } = req.body;

  console.log("/api/v1/addValueToStatisticElement", req.body);

  try {
    if (!secret)
      return res
        .status(400)
        .json({ success: false, message: "API key is required" });
    if (!device)
      return res
        .status(400)
        .json({ success: false, message: "Device ID is required" });
    if (!build)
      return res
        .status(400)
        .json({ success: false, message: "Build type is required" });
    if (!elementID)
      return res
        .status(400)
        .json({ success: false, message: "Target element ID is required" });
    if (!value)
      return res
        .status(400)
        .json({ success: false, message: "Target element value is required" });

    const gameObj = await getCachedGameIdBySecret(secret);
    if (!gameObj) {
      res.status(400).json({ success: false, message: "Invalid secret" });
      return;
    }

    await addValueToStatisticElement(gameObj, build, device, elementID, value);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error at addValueToStatisticElement:", error);
    if (error.kind && error.valueType) {
      res.status(500).json({
        message: `Error trying to add value to statistic element. The element is '${error.kind}' type, got '${error.valueType}' instead.`,
      });
    } else {
      res.status(500).json({
        message: `Internal Server Error`,
      });
    }
  }
});

app.post("/api/v1/subtractValueFromStatisticElement", async (req, res) => {
  const { secret, device, build, elementID, value } = req.body;

  console.log("/api/v1/subtractValueFromStatisticElement", req.body);

  try {
    if (!secret)
      return res
        .status(400)
        .json({ success: false, message: "API key is required" });
    if (!device)
      return res
        .status(400)
        .json({ success: false, message: "Device ID is required" });
    if (!build)
      return res
        .status(400)
        .json({ success: false, message: "Build type is required" });
    if (!elementID)
      return res
        .status(400)
        .json({ success: false, message: "Target element ID is required" });
    if (!value)
      return res
        .status(400)
        .json({ success: false, message: "Target element value is required" });

    const gameObj = await getCachedGameIdBySecret(secret);
    if (!gameObj) {
      res.status(400).json({ success: false, message: "Invalid secret" });
      return;
    }

    await subtractValueFromStatisticElement(
      gameObj,
      build,
      device,
      elementID,
      value
    );

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error at subtractValueFromStatisticElement:", error);
    if (error.kind && error.valueType) {
      res.status(500).json({
        message: `Error trying to add value to statistic element. The element is '${error.kind}' type, got '${error.valueType}' instead.`,
      });
    } else {
      res.status(500).json({
        message: `Internal Server Error`,
      });
    }
  }
});

app.post("/api/v1/setValueToStatisticElement", async (req, res) => {
  const { secret, device, build, elementID, value } = req.body;

  console.log("/api/v1/setValueToStatisticElement", req.body);

  try {
    if (!secret)
      return res
        .status(400)
        .json({ success: false, message: "API key is required" });
    if (!device)
      return res
        .status(400)
        .json({ success: false, message: "Device ID is required" });
    if (!build)
      return res
        .status(400)
        .json({ success: false, message: "Build type is required" });
    if (!elementID)
      return res
        .status(400)
        .json({ success: false, message: "Target element ID is required" });
    if (!value)
      return res
        .status(400)
        .json({ success: false, message: "Target element value is required" });

    const gameObj = await getCachedGameIdBySecret(secret);
    if (!gameObj) {
      res.status(400).json({ success: false, message: "Invalid secret" });
      return;
    }

    await setValueToStatisticElement(gameObj, build, device, elementID, value);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error at setValueToStatisticElement:", error);
    if (error.kind && error.valueType) {
      res.status(500).json({
        message: `Error trying to add value to statistic element. The element is '${error.kind}' type, got '${error.valueType}' instead.`,
      });
    } else {
      res.status(500).json({
        message: `Internal Server Error`,
      });
    }
  }
});

app.post("/api/v1/getElementValue", async (req, res) => {
  const { secret, device, build, elementID } = req.body;

  console.log("/api/v1/getElementValue", req.body);

  try {
    if (!secret)
      return res
        .status(400)
        .json({ success: false, message: "API key is required" });
    if (!device)
      return res
        .status(400)
        .json({ success: false, message: "Device ID is required" });
    if (!build)
      return res
        .status(400)
        .json({ success: false, message: "Build type is required" });
    if (!elementID)
      return res
        .status(400)
        .json({ success: false, message: "Target element ID is required" });

    const gameObj = await getCachedGameIdBySecret(secret);
    if (!gameObj) {
      res.status(400).json({ success: false, message: "Invalid secret" });
      return;
    }

    const result = await getElementValue(gameObj, build, device, elementID);

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("Error at setValueToStatisticElement:", error);
    if (error.kind && error.valueType) {
      res.status(500).json({
        message: `Error trying to add value to statistic element. The element is '${error.kind}' type, got '${error.valueType}' instead.`,
      });
    } else {
      res.status(500).json({
        message: `Internal Server Error`,
      });
    }
  }
});

// {
//  "device": "sdfds54246514",
//  "secret": "sdfdsfsdf",
//  "session": "sdfsdc",
//  "language": "en",
//  "platform:" "Windows",
//  "gameVersion:" "1.0",
//  "engineVersion:" "1.0",
//  "build": "development",

//  "payload": [
//    {
//      "time": 13516513216,
//      "type": "eventType",
//      "actions": [
//       {"action1": "123"},
//       {"action2": "123"},
//       {"action3": "123"},
//      ]
//    },
//  ]
// }

app.get("/api/health", async (req, res, next) => {
  res.json({
    health: "OK.",
    message: `Current Version is ${process.env.CURRENT_VERSION}`,
  });
});

const server = http.createServer(app);
server.listen(port, host, () => {
  console.log(`The server is running on http://${host}:${port}`);
});
