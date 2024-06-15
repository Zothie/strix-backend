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

export async function changeLocalizationItemKey(
  gameID,
  branch,
  type,
  sid,
  newKey
) {
  try {
    const result = await Localization.findOneAndUpdate(
      {
        gameID,
        "branches.branch": branch,
        [`branches.localization.${type}.sid`]: sid,
      },
      {
        $set: {
          [`branches.$[branch].localization.${type}.$.key`]: newKey,
        },
      },
      {
        arrayFilters: [{ "branch.branch": branch }],
        new: true,
      }
    ).exec();

    return result;
  } catch (error) {
    throw error;
  }
}

export async function removeLocalizationItem(gameID, branch, type, sid) {
  try {
    const result = await Localization.findOneAndUpdate(
      {
        gameID,
        "branches.branch": branch,
      },
      {
        $pull: {
          [`branches.$[branch].localization.${type}`]: {
            sid: { $regex: new RegExp(`^${sid}\\|`) },
          },
        },
      },
      {
        arrayFilters: [{ "branch.branch": branch }],
        new: true,
      }
    ).exec();

    return result;
  } catch (error) {
    throw error;
  }
}

export async function getLocalizationItems(gameID, branch, type, sids) {
  try {
    let fieldToUpdate;
    switch (type) {
      case "offers":
        fieldToUpdate = `branches.$[branch].localization.offers`;
        break;
      case "entities":
        fieldToUpdate = `branches.$[branch].localization.entities`;
        break;
      case "custom":
        fieldToUpdate = `branches.$[branch].localization.custom`;
        break;
      default:
        throw new Error("Invalid localization type");
    }

    let localizations = await Localization.aggregate([
      { $match: { gameID } },
      { $unwind: "$branches" },
      { $match: { "branches.branch": branch } },
      { $unwind: "$branches.localization" },
      { $unwind: `$branches.localization.${type}` },
      { $match: { [`branches.localization.${type}.sid`]: { $in: sids } } },
      { $replaceRoot: { newRoot: `$branches.localization.${type}` } },
    ]);

    return localizations;
  } catch (error) {
    throw error;
  }
}

export async function getLocalization(gameID, branch, type) {
  try {
    let array = [];
    array = await Localization.aggregate([
      { $match: { gameID } },
      { $unwind: "$branches" },
      { $match: { "branches.branch": branch } },
      { $unwind: "$branches.localization" },
      { $unwind: `$branches.localization.${type}` },
      { $replaceRoot: { newRoot: `$branches.localization.${type}` } },
    ]);
    return array;
  } catch (error) {
    throw error;
  }
}

export async function updateLocalization(
  gameID,
  branch,
  type,
  translationObjects,
  categoryNodeID
) {
  let fieldToUpdate;
  switch (type) {
    case "offers":
      fieldToUpdate = `branches.$[branch].localization.offers`;
      break;
    case "entities":
      fieldToUpdate = `branches.$[branch].localization.entities`;
      break;
    case "custom":
      fieldToUpdate = `branches.$[branch].localization.custom`;
      break;
    default:
      return res.status(400).json({ error: "Invalid localization type" });
  }

  async function getLocalizationDocument(type) {
    let array = [];
    array = await Localization.aggregate([
      { $match: { gameID } },
      { $unwind: "$branches" },
      { $match: { "branches.branch": branch } },
      { $unwind: "$branches.localization" },
      { $unwind: `$branches.localization.${type}` },
      { $replaceRoot: { newRoot: `$branches.localization.${type}` } },
    ]);
    return array;
  }

  let localizations = await getLocalizationDocument(type);

  translationObjects.forEach((translation) => {
    const sid = translation.sid;
    const key = translation.key;
    let values = [];
    Object.keys(translation.translations).forEach((obj) => {
      values.push({
        code: obj,
        value: translation.translations[obj],
      });
    });

    const exists = localizations.some(
      (localization) => localization.sid === sid
    );
    if (exists) {
      const index = localizations.findIndex(
        (localization) => localization.sid === sid
      );
      localizations[index].translations = values;
      localizations[index].key = key;
    } else {
      // If we're creating inherited localization item, we need to also tell which node it was inherited from
      if (categoryNodeID) {
        localizations.push({
          sid: sid,
          key: key,
          translations: values,
          inheritedFrom: categoryNodeID,
        });
      } else {
        localizations.push({ sid: sid, key: key, translations: values });
      }

      if (type === "entities") {
        makeLocalizationForCategoryChildren(
          gameID,
          branch,
          translation.sid.split("|")[1],
          translationObjects
        );
      }
    }
  });

  const filter = { gameID };
  const arrayFilters = [{ gameID: gameID }, { "branch.branch": branch }];
  await Localization.updateMany(
    filter,
    {
      $set: { [`${fieldToUpdate}`]: localizations },
    },
    { arrayFilters, upsert: true }
  ).exec();
}

export async function insertLocalizationItem(
  gameID,
  branch,
  type,
  translationObject
) {
  try {
    const result = await Localization.findOneAndUpdate(
      {
        gameID,
        "branches.branch": branch,
      },
      {
        $push: {
          [`branches.$[branch].localization.${type}`]: translationObject,
        },
      },
      {
        arrayFilters: [{ "branch.branch": branch }],
        upsert: true,
        new: true,
      }
    ).exec();
  } catch (error) {
    console.error(error);
  }
}

export async function makeLocalizationForCategoryChildren(
  gameID,
  branch,
  categoryNodeID,
  translationObjects
) {
  try {
    let planningTree = await PlanningTreeModel.findOne({ gameID });
    if (!planningTree) {
      return { success: false, message: "PlanningTree not found" };
    }
    planningTree = planningTree.branches.find((b) => b.branch === branch);
    planningTree = planningTree.planningTypes.find(
      (pt) => pt.type === "entity"
    );

    const categoryNode = findNodeByNodeID(planningTree.nodes, categoryNodeID);
    if (!categoryNode) {
      return { success: false, message: "Category node not found" };
    }

    async function recursivelyMakeItems(node) {
      if (node.subnodes) {
        for (const subnode of node.subnodes) {
          let modifiedObjects = translationObjects.map((obj) => {
            obj.sid = obj.sid.split("|")[0] + "|" + subnode.nodeID;
            return obj;
          });
          await updateLocalization(
            gameID,
            branch,
            "entities",
            modifiedObjects,
            categoryNode.nodeID
          );
          await recursivelyMakeItems(subnode);
        }
      }
    }
    recursivelyMakeItems(categoryNode);
  } catch (error) {
    console.error(error);
  }
}
