import dotenv from "dotenv";

import { Schema, model } from "mongoose";
import { Kafka } from "kafkajs";

import express, { response } from "express";
import cors from "cors";
import mongoose from "mongoose";
import bodyParser from "body-parser";
import http from "http";
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

app.use(
  cors({
    origin: function (origin, callback) {
      callback(null, true);
    },
    credentials: true,
  })
);

app.post("/api/v1/analytics/sendEvent", async (req, res) => {
  const { device, secret, session, platform, payload } = req.body;

  console.log("Incoming request to /api/v1/analytics/sendEvent", req.body);

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
  if (!platform)
    return res
      .status(400)
      .json({ success: false, message: "Platform is required" });

  const gameId = await getGameIdBySecret(secret);
  if (!gameId) {
    res.status(400).json({ success: false, message: "Invalid secret" });
    return;
  }

  if (payload[payload.length - 1].type === "newSession") {
    console.log("Acquired new session", {
      success: true,
      message: "OK",
      data: gameId,
    });
    res.status(200).json({
      success: true,
      message: "OK",
      data: {
        key: gameId,
        playerData: [
          {
            elementID: "totalPaymentsSumm",
            value: 123,
          },
          {
            elementID: "totalPaymentsCount",
            value: 123,
          },
        ],
        currency: "USD",
      },
    });
    return;
  }

  payload.forEach((event) => {
    switch (event.type) {
      case "newSession":
        break;
      default:
        break;
    }
  });

  // res.status(500).json({
  //   success: false,
  //   message: "Wrong event type provided or Internal Server Error",
  // });

  res.status(200).json({ success: true, message: "OK" });
});

export async function getGameIdBySecret(secret) {
  const game = await Game.findOne({ gameSecretKey: secret }, "_id").lean();
  if (game) {
    return game._id.toString();
  } else {
    return null;
  }
}
async function getWarehousePlayerData(gameID, branchName, clientID) {
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
function isDemoGameID(gameID) {
  // Checking if gameID contains demo gameID at the start
  for (const demoGameID of demoGames) {
    if (gameID.startsWith(demoGameID)) {
      return demoGameID;
    }
  }
  return gameID;
}

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
