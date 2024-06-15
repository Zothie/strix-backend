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

export async function setPositionedOffers(gameID, branch, positions) {
  try {
    const result = await Offers.findOneAndUpdate(
      { gameID, "branches.branch": branch },
      { $set: { "branches.$.positions": positions } },
      { new: true, upsert: true }
    ).exec();

    return result;
  } catch (error) {
    throw error;
  }
}
export async function getOffers(gameID, branch) {
  try {
    let result = await Offers.aggregate([
      { $match: { gameID } }, 
      { $unwind: "$branches" }, 
      { $match: { "branches.branch": branch } }, 
      { $unwind: "$branches.offers" }, 
      { $replaceRoot: { newRoot: `$branches.offers` } }
    ]);
    
    result = result.filter(o => !o.removed)

    return result;
  } catch (error) {
    throw error;
  }
}

export async function getPositionedOffers(gameID, branch) {
  try {
    const result = await Offers.aggregate([
      { $match: { gameID } },
      { $unwind: "$branches" },
      { $match: { "branches.branch": branch } },
    ]);

    if (!result || result.length === 0) {
      return null;
    }

    const positions = JSON.parse(result[0].branches.positions);
    return positions;
  } catch (error) {
    throw error;
  }
}

export async function getOffersByContentNodeID(gameID, branch, nodeID) {
  try {
    const offers = await Offers.aggregate([
      { $match: { gameID } },
      { $unwind: "$branches" },
      { $match: { "branches.branch": branch } },
      { $unwind: "$branches.offers" },
      { $match: { "branches.offers.content": { $elemMatch: { nodeID } } } },
      {
        $replaceRoot: { newRoot: "$branches.offers" },
      },
      {
        $project: {
          _id: 0,
          offerID: 1,
          offerName: 1,
          offerIcon: 1,
          content: 1,
        },
      },
    ]);

    return offers;
  } catch (error) {
    throw error;
  }
}

export async function updateOfferAndPositions(gameID, branch, offerID) {
  try {
    let positions = await Offers.findOne({ gameID, "branches.branch": branch });
    if (!positions) {
      throw new Error("Offer not found");
    }

    positions = JSON.parse(
      positions.branches.find((b) => b.branch === branch).positions
    );
    positions = positions.map((p) => {
      p.segments = p.segments.map((s) => {
        s.offers = s.offers.filter((o) => o !== offerID);
        return s;
      });
      return p;
    });
    positions = JSON.stringify(positions);

    await Offers.findOneAndUpdate(
      { gameID, "branches.branch": branch },
      {
        $set: {
          "branches.$[branch].offers.$[offer].removed": true,
          "branches.$[branch].positions": positions,
        },
      },
      {
        arrayFilters: [
          { "branch.branch": branch },
          { "offer.offerID": offerID },
        ],
        new: true,
      }
    ).exec();

    return true;
  } catch (error) {
    throw error;
  }
}

export async function removeOfferLocalization(gameID, branch, offerID) {
  try {
    await Localization.findOneAndUpdate(
      { gameID, "branches.branch": branch },
      {
        $pull: {
          "branches.$[branch].localization.offers": {
            $or: [{ sid: offerID + "|name" }, { sid: offerID + "|desc" }],
          },
        },
      },
      {
        arrayFilters: [{ "branch.branch": branch }],
        new: true,
      }
    ).exec();

    return true;
  } catch (error) {
    throw error;
  }
}

export async function getOffersNames(gameID, branch) {
  try {
    const offers = await Offers.aggregate([
      { $match: { gameID } },
      { $unwind: "$branches" },
      { $match: { "branches.branch": branch } },
      { $unwind: "$branches.offers" },
      {
        $replaceRoot: { newRoot: "$branches.offers" },
      },
      {
        $project: {
          _id: 0,
          offerID: 1,
          offerName: 1,
        },
      },
    ]);

    return offers;
  } catch (error) {
    throw error;
  }
}

export async function updateOffer(gameID, branch, offerObj) {
  try {
    // content, price-moneyCurr, triggers fields must be stringified from JSON

    const offer = {
      offerID: offerObj.offerId,
      offerName: offerObj.name,
      offerCodeName: offerObj.offerCodeName,
      offerIcon: offerObj.icon,

      offerInGameName: offerObj.ingameNameStringId,
      offerInGameDescription: offerObj.descrStringId,

      offerTags: offerObj.tags,

      offerPurchaseLimit: offerObj.purchaseLimit,
      offerDuration: {
        value: offerObj.duration.value,
        timeUnit: offerObj.duration.timeUnit,
      },

      offerSegments: offerObj.segments,
      offerTriggers: offerObj.triggers,

      offerPrice: {
        targetCurrency: offerObj.price.targetCurrency,
        nodeID: offerObj.price.nodeID,
        amount: offerObj.price.amount,
        moneyCurr: offerObj.price.moneyCurr,
        discount: offerObj.price.discount,
      },

      content: offerObj.content,
    };

    const result = await Offers.findOneAndUpdate(
      {
        gameID,
        "branches.branch": branch,
        "branches.offers.offerID": offerObj.offerId,
      },
      {
        $set: {
          "branches.$[branch].offers.$[offer]": offer,
        },
      },
      {
        arrayFilters: [
          { "branch.branch": branch },
          { "offer.offerID": offerObj.offerId },
        ],
        new: true,
      }
    ).exec();

    return result;
  } catch (error) {
    throw error;
  }
}

export async function updatePricingItem(gameID, branch, pricingItem) {
  try {
    const updateResult = await Offers.updateOne(
      {
        gameID,
        "branches.branch": branch,
        "branches.pricing.code": pricingItem.code,
      },
      {
        $set: { "branches.$[branch].pricing.$[pricingItem]": pricingItem },
      },
      {
        arrayFilters: [
          { "branch.branch": branch },
          { "pricingItem.code": pricingItem.code },
        ],
        new: true,
      }
    );

    if (updateResult.modifiedCount === 0) {
      // If no documents were modified, it means the item does not exist
      await Offers.updateOne(
        {
          gameID,
          "branches.branch": branch,
        },
        {
          $addToSet: {
            "branches.$.pricing": pricingItem,
          },
        }
      );
    }
  } catch (error) {
    throw error;
  }
}

export async function getPricing(gameID, branch) {
  try {
    const pricing = await Offers.aggregate([
      { $match: { gameID } },
      { $unwind: "$branches" },
      { $match: { "branches.branch": branch } },
      { $unwind: "$branches.pricing" },
      { $replaceRoot: { newRoot: "$branches.pricing" } },
    ]);

    return pricing;
  } catch (error) {
    throw error;
  }
}

export async function createNewOffer(gameID, branch, offerObj) {
  try {
    const offer = {
      offerID: offerObj.offerId,
      offerName: offerObj.name,
      offerCodeName: offerObj.offerCodeName,
      offerIcon: offerObj.icon,

      offerInGameName: offerObj.ingameNameStringId,
      offerInGameDescription: offerObj.descrStringId,

      offerTags: offerObj.tags,

      offerPurchaseLimit: offerObj.purchaseLimit,
      offerDuration: {
        value: offerObj.duration.value,
        timeUnit: offerObj.duration.timeUnit,
      },

      offerSegments: offerObj.segments,
      offerTriggers: offerObj.triggers,

      offerPrice: {
        targetCurrency: offerObj.price.targetCurrency,
        nodeID: offerObj.price.nodeID,
        amount: offerObj.price.amount,
        moneyCurr: offerObj.price.moneyCurr,
      },

      content: offerObj.content,
    };

    const result = await Offers.findOneAndUpdate(
      { gameID },
      { $addToSet: { "branches.$[branch].offers": offer } },
      { arrayFilters: [{ "branch.branch": branch }], upsert: true, new: true }
    ).exec();

    const translationObjects = [
      {
        sid: offerObj.ingameNameStringId,
        key: offerObj.ingameNameStringId,
        translations: {
          en: "Localized name",
        },
      },
      {
        sid: offerObj.descrStringId,
        key: offerObj.descrStringId,
        translations: {
          en: "Localized description",
        },
      },
    ];

    await updateLocalization(gameID, branch, "offers", translationObjects);

    return result;
  } catch (error) {
    throw error;
  }
}

export async function removePlanningNode(gameID, branchName, nodeID) {
  try {
    // Get the node
    const node = await NodeModel.findOne({
      "branches.planningTypes.nodes.nodeID": nodeID,
    });
    if (!node) {
      throw new Error("Node not found");
    }

    // Trying to remove node from offers
    await Offers.updateMany(
      {
        gameID,
        "branches.branch": branchName,
      },
      {
        $pull: {
          "branches.$.offers.$[offer].content": { nodeID: nodeID },
        },
      },
      {
        arrayFilters: [{ "offer.content.nodeID": nodeID }],
      }
    );
    await Offers.updateMany(
      {
        gameID,
        "branches.branch": branchName,
        "branches.offers.offerPrice.nodeID": nodeID,
      },
      {
        $set: {
          "branches.$[branch].offers.$[offer].offerPrice.targetCurrency":
            "money",
          "branches.$[branch].offers.$[offer].offerPrice.moneyCurr": [
            { amount: 100, cur: "USD" },
          ],
          "branches.$[branch].offers.$[offer].offerPrice.nodeID": null,
          "branches.$[branch].offers.$[offer].offerPrice.amount": 0,
        },
      },
      {
        arrayFilters: [
          { "branch.branch": branchName },
          { "offer.offerPrice.nodeID": nodeID },
        ],
      }
    );

    return "Node and related data deleted successfully";
  } catch (error) {
    throw error;
  }
}

export async function updateOfferASKU(gameID, offerID, newASKU) {
  try {
    console.log('Offer has no ASKU, uploading. GameID:', gameID, 'OfferID: ' + offerID, "  ASKU: " + newASKU)
    const result = await Offers.updateOne(
      {
        gameID,
      },
      {
        $push: {
          "branches.$[branch].associations": {offerID: offerID, sku: newASKU},
        },
      },
      {
        arrayFilters: [
          // Since ASKU is only used in production, use only this branch
          { "branch.branch": "production" },
          { "offer.offerID": offerID },
        ],
      },
      {
        new: true,
        upsert: true,
      }
    );
    return result;
    
  } catch (error) {
    throw error;
  }
}

export async function getAssociatedSKUs(gameID, branch) {
  try {
    const result = await Offers.aggregate([
      { $match: { gameID } },
      { $unwind: "$branches" },
      { $match: { "branches.branch": branch } },
      { $unwind: "$branches.associations" },
      {
        $replaceRoot: { newRoot: "$branches.associations" },
      },
      {
        $project: {
          _id: 0,
          sku: 1,
          offerID: 1,
        },
      },
    ]);
    if (!result) return [];
    return result;
    
  } catch (error) {
    throw error;
  }
}