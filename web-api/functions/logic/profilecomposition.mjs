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

export async function setProfileCompositionPreset(
  gameID,
  branchName,
  presets = []
) {
  try {
    const result = await CustomCharts.findOneAndUpdate(
      { gameID, "branches.branch": branchName },
      {
        $set: {
          "branches.$.profileCompositionPresets": JSON.stringify(presets),
        },
      }
    );
    return result;
  } catch (error) {
    console.error(error);
    throw new Error("Internal Server Error or No Data");
  }
}

export async function getProfileCompositionPreset(gameID, branchName) {
  try {
    const charts = await CustomCharts.findOne({
      gameID,
      "branches.branch": branchName,
    });
    if (!charts) {
      const error = new Error("Charts not found");
      error.statusCode = 404;
      throw error;
    }
    let branch = charts.branches.find((b) => b.branch === branchName);
    if (
      branch.profileCompositionPresets !== undefined &&
      branch.profileCompositionPresets !== ""
    ) {
      branch.profileCompositionPresets = JSON.parse(
        branch.profileCompositionPresets
      );
      return { success: true, presets: branch.profileCompositionPresets };
    } else {
      return { success: true, presets: [] };
    }
  } catch (error) {
    console.error(error);
    throw error;
  }
}
export async function getProfileComposition(
  gameID,
  branchName,
  baseSegment,
  filters,
  element1,
  element2,
  element3
) {
  try {
    let segmentCount = await Segments.findOne({
      gameID,
      "branches.branch": branchName,
    });
    segmentCount = segmentCount.branches
      .find((b) => b.branch === branchName)
      .segments.find((s) => s.segmentID === baseSegment)?.segmentPlayerCount;
    if (segmentCount == undefined) {
      segmentCount = 0;
    }

    let sampleSize = 0;
    if (element1 !== "" || element2 !== "" || element3 !== "") {
      sampleSize = getSampleSize(segmentCount, 0.999);
    }

    let warehouseTemplates = await PWtemplates.findOne({
      gameID,
      "branches.branch": branchName,
    });
    warehouseTemplates = warehouseTemplates.branches.find(
      (b) => b.branch === branchName
    ).templates;

    function getTemplateType(templateID) {
      if (
        warehouseTemplates.analytics.some((t) => t.templateID === templateID)
      ) {
        return "analytics";
      } else if (
        warehouseTemplates.statistics.some((t) => t.templateID === templateID)
      ) {
        return "statistics";
      } else {
        return null;
      }
    }

    async function buildQuery() {
      const queryConditions = [];

      for (const filter of filters) {
        if (filter.condition) {
          if (filter.condition === "and") {
            queryConditions.push({ $and: [] });
          } else if (filter.condition === "or") {
            queryConditions.push({ $or: [] });
          }
        } else {
          const targetElementPath = `elements.${getTemplateType(
            filter.templateID
          )}.elementID`;
          const targetValuePath = `elements.${getTemplateType(
            filter.templateID
          )}.elementValue`;

          let condition = {};
          let formattedValue = filter.filterValue;
          switch (filter.filterCondition) {
            case "is":
              formattedValue = filter.filterValue.toString();
              condition = {
                [`elements.${getTemplateType(filter.templateID)}`]: {
                  $elemMatch: {
                    elementID: filter.templateID,
                    elementValue: formattedValue,
                  },
                },
              };
              break;
            case "is not":
              formattedValue = filter.filterValue.toString();
              condition = {
                [`elements.${getTemplateType(filter.templateID)}`]: {
                  $elemMatch: {
                    elementID: filter.templateID,
                    elementValue: { $ne: formattedValue },
                  },
                },
              };
              break;
            case "contains":
              formattedValue = filter.filterValue.toString();
              condition = {
                [`elements.${getTemplateType(filter.templateID)}`]: {
                  $elemMatch: {
                    elementID: filter.templateID,
                    elementValue: { $regex: formattedValue, $options: "i" },
                  },
                },
              };
              break;
            case "starts with":
              formattedValue = filter.filterValue.toString();
              condition = {
                [`elements.${getTemplateType(filter.templateID)}`]: {
                  $elemMatch: {
                    elementID: filter.templateID,
                    elementValue: {
                      $regex: `^${formattedValue}`,
                      $options: "i",
                    },
                  },
                },
              };
              break;
            case "ends with":
              formattedValue = filter.filterValue.toString();
              condition = {
                [`elements.${getTemplateType(filter.templateID)}`]: {
                  $elemMatch: {
                    elementID: filter.templateID,
                    elementValue: {
                      $regex: `${formattedValue}$`,
                      $options: "i",
                    },
                  },
                },
              };
              break;
            case ">":
              formattedValue = parseFloat(filter.filterValue);
              condition = {
                [`elements.${getTemplateType(filter.templateID)}`]: {
                  $elemMatch: {
                    elementID: filter.templateID,
                    elementValue: { $gt: formattedValue },
                  },
                },
              };
              break;
            case "<":
              formattedValue = parseFloat(filter.filterValue);
              condition = {
                [`elements.${getTemplateType(filter.templateID)}`]: {
                  $elemMatch: {
                    elementID: filter.templateID,
                    elementValue: { $lt: formattedValue },
                  },
                },
              };
              break;
            case ">=":
              formattedValue = parseFloat(filter.filterValue);
              condition = {
                [`elements.${getTemplateType(filter.templateID)}`]: {
                  $elemMatch: {
                    elementID: filter.templateID,
                    elementValue: { $gte: formattedValue },
                  },
                },
              };
              break;
            case "<=":
              formattedValue = parseFloat(filter.filterValue);
              condition = {
                [`elements.${getTemplateType(filter.templateID)}`]: {
                  $elemMatch: {
                    elementID: filter.templateID,
                    elementValue: { $lte: formattedValue },
                  },
                },
              };
              break;
            case "=":
              formattedValue = parseFloat(filter.filterValue);
              condition = {
                [`elements.${getTemplateType(filter.templateID)}`]: {
                  $elemMatch: {
                    elementID: filter.templateID,
                    elementValue: formattedValue,
                  },
                },
              };
              break;
            case "!=":
              formattedValue = parseFloat(filter.filterValue);
              condition = {
                [`elements.${getTemplateType(filter.templateID)}`]: {
                  $elemMatch: {
                    elementID: filter.templateID,
                    elementValue: { $ne: formattedValue },
                  },
                },
              };
              break;
            case "dateRange":
              const [startDate, endDate] = filter.filterValue.map(
                (date) => new Date(date)
              );
              condition = {
                "elements.analytics": {
                  $elemMatch: {
                    elementID: filter.templateID,
                    elementValue: { $gte: startDate, $lte: endDate },
                  },
                },
              };
              break;
            default:
              continue;
          }

          if (
            queryConditions.length > 0 &&
            queryConditions[queryConditions.length - 1].$and
          ) {
            queryConditions[queryConditions.length - 1].$and.push(condition);
          } else if (
            queryConditions.length > 0 &&
            queryConditions[queryConditions.length - 1].$or
          ) {
            queryConditions[queryConditions.length - 1].$or.push(condition);
          } else {
            queryConditions.push(condition);
          }
        }
      }

      const baseSegmentFilter = {
        ["segments"]: { $in: [baseSegment] },
      };
      const defaultQuery = {
        gameID: isDemoGameID(gameID),
        branch: branchName,
      };

      return { $and: [defaultQuery, baseSegmentFilter, ...queryConditions] };
    }
    const query = await buildQuery();

    const result = await PWplayers.aggregate([
      { $match: query },
      {
        $facet: {
          totalCount: [{ $count: "count" }],
          ...(sampleSize > 0 && { players: [{ $limit: sampleSize }] }),
        },
      },
    ]);

    const totalCount = result[0].totalCount[0]
      ? result[0].totalCount[0].count
      : 0;
    let players = result[0].players === undefined ? [] : result[0].players;

    if (players && players.length > 0) {
      players = players.map((p) => {
        return {
          ...p,
          elements: []
            .concat(p.elements.analytics)
            .concat(p.elements.statistics),
        };
      });
    }

    return { success: true, composition: totalCount, sample: players };
  } catch (error) {
    console.error(error);
    throw error;
  }
}
