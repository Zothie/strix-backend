import dotenv from "dotenv";

import { Schema, model } from "mongoose";
import { Kafka } from "kafkajs";

import express from "express";
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

app.post("/api/v1/analytics/init", (req, res) => {
  console.log("Incoming request to /api/v1/analytics/init", req.body);
  res.status(200).json({success: true})
});

app.post("/api/v1/analytics/designEvent", (req, res) => {
  const { device, secret, session, payload } = req.body;
  if (!secret)
    return res.status(400).json({ message: "API key is required" });
  if (!device)
    return res.status(400).json({ message: "Device ID is required" });
  if (!session)
    return res.status(400).json({ message: "Session ID is required" });
  if (!payload)
    return res.status(400).json({ message: "Payload is required" });
  res.send("Hello World!");
});



// {
//  "device": "sdfds54246514", 
//  "secret": "sdfdsfsdf", 
//  "session": "sdfsdc",
 
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
