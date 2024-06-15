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

// Function to register a new user
export async function registerUser(email, password) {
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.updateOne(
      { email },
      { password: hashedPassword },
      { upsert: true }
    );

    const customToken = await firebase.auth().createCustomToken(email);
    return { success: true, token: customToken };
  } catch (error) {
    console.error(error);
    return { success: false, message: "Internal Server Error" };
  }
}

// Function to authenticate a user
export async function authenticateUser(email, password) {
  try {
    const user = await User.findOne({ email });

    if (user) {
      const isPasswordMatch = await bcrypt.compare(password, user.password);

      if (isPasswordMatch) {
        const customToken = await firebase.auth().createCustomToken(email);
        return { success: true, token: customToken };
      } else {
        return { success: false, message: "Wrong username or password" };
      }
    } else {
      return { success: false, message: "Wrong username or password" };
    }
  } catch (error) {
    console.error(error);
    return { success: false, message: "Internal auth error" };
  }
}

// Function to logout/signout/revoke token
export async function logoutUser(token) {
  try {
    const decodedToken = await firebase.auth().verifyIdToken(token);
    const uid = decodedToken.uid;

    await firebase.auth().revokeRefreshTokens(uid);
    return "User logged out successfully";
  } catch (error) {
    console.error(error);
    return "Invalid or expired token";
  }
}
