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

export async function updateCustomDashboard(
  gameID,
  branch,
  dashboardID,
  newDashboard
) {
  if (!gameID || !branch || !dashboardID || !newDashboard) {
    return { success: false, message: "Missing required parameters" };
  }

  try {
    let game = await CustomCharts.findOne({
      gameID: gameID,
      "branches.branch": branch,
    });

    if (!game) {
      console.log("Game not found or branch does not exist");
      return {
        success: false,
        message: "Game not found or branch does not exist",
      };
    }

    const branchItem = game.branches.find((b) => b.branch === branch);
    if (!branchItem) {
      console.log("Branch not found");
      return { success: false, message: "Branch not found" };
    }

    const dashboards = branchItem.dashboards;
    const targetIndex = dashboards.findIndex((d) => d.id === dashboardID);
    if (targetIndex === -1) {
      console.log("Dashboard not found");
      return { success: false, message: "Dashboard not found" };
    }

    let updatedDashboard = newDashboard;
    updatedDashboard.charts = JSON.stringify(updatedDashboard.charts);

    await CustomCharts.findOneAndUpdate(
      {
        gameID: gameID,
        "branches.branch": branch,
        "branches.dashboards.id": dashboardID,
      },
      {
        $set: {
          [`branches.$[outer].dashboards.${targetIndex}`]: updatedDashboard,
        },
      },
      { arrayFilters: [{ "outer.branch": branch }] }
    );

    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false, message: "Internal Server Error" };
  }
}

export async function removeCustomDashboard(gameID, branch, dashboardID) {
  if (!gameID || !branch || !dashboardID) {
    return { success: false, message: "Missing required parameters" };
  }

  try {
    let game = await CustomCharts.findOne({
      gameID: gameID,
      "branches.branch": branch,
    });

    if (!game) {
      console.log("Game not found or branch does not exist");
      return {
        success: false,
        message: "Game not found or branch does not exist",
      };
    }

    await CustomCharts.findOneAndUpdate(
      { gameID: gameID, "branches.branch": branch },
      { $pull: { "branches.$.dashboards": { id: dashboardID } } }
    );

    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false, message: "Internal Server Error" };
  }
}
export async function addCustomDashboard(gameID, branch, newDashboard) {
  if (!gameID || !branch || !newDashboard) {
    return { success: false, message: "Missing required parameters" };
  }

  try {
    let game = await CustomCharts.findOne({
      gameID: gameID,
      "branches.branch": branch,
    });

    if (!game) {
      console.log("Game not found or branch does not exist");
      return {
        success: false,
        message: "Game not found or branch does not exist",
      };
    }

    const branchItem = game.branches.find((b) => b.branch === branch);
    let dashboards = branchItem.dashboards;
    let targetDashboard = newDashboard;
    targetDashboard.charts = JSON.stringify(targetDashboard.charts);

    await CustomCharts.findOneAndUpdate(
      { gameID: gameID, "branches.branch": branch },
      { $push: { "branches.$.dashboards": newDashboard } }
    );

    return { success: true, dashboards: dashboards };
  } catch (error) {
    console.error(error);
    return { success: false, message: "Internal Server Error" };
  }
}

export async function getDashboardByLink(gameID, branch, linkName) {
  if (!gameID || !branch) {
    return { success: false, message: "Missing required parameters" };
  }

  try {
    let game = await CustomCharts.findOne({
      gameID: gameID,
      "branches.branch": branch,
    }).lean();

    if (!game) {
      console.log("Game not found or branch does not exist");
    }

    const branchItem = game.branches.find((b) => b.branch === branch);
    const dashboards = branchItem.dashboards.map((d) => ({
      ...d,
      charts: JSON.parse(d.charts),
    }));
    let targetDashboard = dashboards.find((d) => d.linkName === linkName);

    console.log(dashboards);
    return { success: true, dashboard: targetDashboard };
  } catch (error) {
    console.error(error);
    throw new Error("Internal Server Error");
  }
}

export async function getDashboards(gameID, branch) {
  if (!gameID || !branch) {
    return { success: false, message: "Missing required parameters" };
  }

  try {
    let game = await CustomCharts.findOne({
      gameID: gameID,
      "branches.branch": branch,
    }).lean();

    if (!game) {
      console.log("Game not found or branch does not exist");
    }

    const branchItem = game.branches.find((b) => b.branch === branch);
    const dashboards = branchItem.dashboards.map((d) => ({
      ...d,
      charts: JSON.parse(d.charts),
    }));

    return { success: true, dashboards: dashboards };
  } catch (error) {
    console.error(error);
    throw new Error("Internal Server Error");
  }
}
