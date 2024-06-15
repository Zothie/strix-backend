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

export async function checkEntityIDExists(gameID, branchName, entityID) {
  try {
    const gameDocument = await NodeModel.findOne({
      "branches.branch": branchName,
      gameID,
    }).exec();

    if (!gameDocument) {
      return false;
    }

    const exists = gameDocument.branches.some(
      (branch) =>
        branch.branch === branchName &&
        branch.planningTypes.some((type) =>
          type.nodes.some((node) => node.entityID === entityID)
        )
    );

    return exists;
  } catch (error) {
    throw error;
  }
}

//  Serach node by nodeID
export function findNodeByNodeID(nodes, nodeID) {
  for (const node of nodes) {
    if (node.nodeID.toString() === nodeID) {
      return node;
    }
    const subnodeResult = findNodeByNodeID(node.subnodes, nodeID);
    if (subnodeResult) {
      return subnodeResult;
    }
  }
  return null;
}

// Search node by _id
export function findNodeById(nodes, id) {
  for (const node of nodes) {
    if (node._id.toString() === id) {
      return node;
    }
    const subnodeResult = findNodeById(node.subnodes, id);
    if (subnodeResult) {
      return subnodeResult;
    }
  }
  return null;
}

// Remove node by _id
export function removeNodeById(nodes, id) {
  const index = nodes.findIndex((node) => node._id.toString() === id);
  if (index !== -1) {
    return nodes.splice(index, 1)[0];
  }
  for (const node of nodes) {
    const removedNode = removeNodeById(node.subnodes, id);
    if (removedNode) {
      return removedNode;
    }
  }
  return null;
}

export async function saveEntityInheritedConfigs(
  gameID,
  branch,
  nodeID,
  inheritedConfigs,
  isCategory
) {
  try {
    const updateFields = {};

    if (isCategory) {
      updateFields[
        `branches.$[branch].planningTypes.$[planningType].nodes.$[node].entityCategory.inheritedConfigs`
      ] = inheritedConfigs;
    } else {
      updateFields[
        `branches.$[branch].planningTypes.$[planningType].nodes.$[node].entityBasic.inheritedConfigs`
      ] = inheritedConfigs;
    }

    await NodeModel.updateOne(
      {
        gameID,
        branches: { $elemMatch: { branch: branch } },
        "branches.planningTypes": { $elemMatch: { type: "entity" } },
        "branches.planningTypes.nodes": { $elemMatch: { nodeID: nodeID } },
      },
      { $set: updateFields },
      {
        arrayFilters: [
          { "branch.branch": branch },
          { "planningType.type": "entity" },
          { "node.nodeID": nodeID },
        ],
        new: true,
      }
    );
  } catch (error) {
    throw error;
  }
}

export async function saveEntityMainConfigs(
  gameID,
  branch,
  nodeID,
  mainConfigs,
  isCategory
) {
  try {
    const updateFields = {};

    if (isCategory) {
      updateFields[
        `branches.$[branch].planningTypes.$[planningType].nodes.$[node].entityCategory.mainConfigs`
      ] = mainConfigs;
    } else {
      updateFields[
        `branches.$[branch].planningTypes.$[planningType].nodes.$[node].entityBasic.mainConfigs`
      ] = mainConfigs;
    }

    await NodeModel.updateOne(
      {
        gameID,
        branches: { $elemMatch: { branch: branch } },
        "branches.planningTypes": { $elemMatch: { type: "entity" } },
        "branches.planningTypes.nodes": { $elemMatch: { nodeID: nodeID } },
      },
      { $set: updateFields },
      {
        arrayFilters: [
          { "branch.branch": branch },
          { "planningType.type": "entity" },
          { "node.nodeID": nodeID },
        ],
        new: true,
      }
    );
  } catch (error) {
    throw error;
  }
}

export async function saveEntityIcon(gameID, branch, nodeID, entityIcon) {
  try {
    const updateFields = {};
    updateFields[
      `branches.$[branch].planningTypes.$[planningType].nodes.$[node].entityBasic.entityIcon`
    ] = entityIcon;

    await NodeModel.updateOne(
      {
        gameID,
        branches: { $elemMatch: { branch: branch } },
        "branches.planningTypes": { $elemMatch: { type: "entity" } },
        "branches.planningTypes.nodes": { $elemMatch: { nodeID: nodeID } },
      },
      { $set: updateFields },
      {
        arrayFilters: [
          { "branch.branch": branch },
          { "planningType.type": "entity" },
          { "node.nodeID": nodeID },
        ],
        new: true,
      }
    );
  } catch (error) {
    throw error;
  }
}

export async function saveEntityRoles(
  gameID,
  branch,
  nodeID,
  isCurrency,
  isInAppPurchase,
  realValueBase
) {
  try {
    const updateFields = {
      [`branches.$[branch].planningTypes.$[planningType].nodes.$[node].entityBasic.isCurrency`]:
        isCurrency,
      [`branches.$[branch].planningTypes.$[planningType].nodes.$[node].entityBasic.isInAppPurchase`]:
        isInAppPurchase,
      [`branches.$[branch].planningTypes.$[planningType].nodes.$[node].entityBasic.realValueBase`]:
        realValueBase,
    };

    await NodeModel.updateOne(
      {
        gameID,
        branches: { $elemMatch: { branch: branch } },
        "branches.planningTypes": { $elemMatch: { type: "entity" } },
        "branches.planningTypes.nodes": { $elemMatch: { nodeID: nodeID } },
      },
      { $set: updateFields },
      {
        arrayFilters: [
          { "branch.branch": branch },
          { "planningType.type": "entity" },
          { "node.nodeID": nodeID },
        ],
        new: true,
      }
    );
  } catch (error) {
    throw error;
  }
}

export async function saveEntityBasicInfo(
  gameID,
  branch,
  nodeID,
  entityID,
  nodeName,
  isCategory
) {
  try {
    const updateFields = {};
    const planningType = "planningTypes";
    const node = "nodes";

    const nodePath = `branches.$[branch].${planningType}.$[planningType].${node}.$[node]`;
    updateFields[`${nodePath}.name`] = nodeName;

    if (isCategory) {
      updateFields[`${nodePath}.entityCategory.categoryID`] = entityID;
    } else {
      updateFields[`${nodePath}.entityBasic.entityID`] = entityID;
    }

    // Saving target node
    await NodeModel.updateOne(
      {
        gameID,
        branches: { $elemMatch: { branch: branch } },
        "branches.planningTypes": { $elemMatch: { type: "entity" } },
        "branches.planningTypes.nodes": { $elemMatch: { nodeID: nodeID } },
      },
      { $set: updateFields },
      {
        arrayFilters: [
          { "branch.branch": branch },
          { "planningType.type": "entity" },
          { "node.nodeID": nodeID },
        ],
        new: true,
      }
    );
  } catch (error) {
    throw error;
  }
}

export async function getEntityIcon(gameID, branch, nodeID) {
  try {
    let entityIcon = await NodeModel.aggregate([
      { $match: { gameID } },
      { $unwind: "$branches" },
      { $match: { "branches.branch": branch } },
      { $unwind: "$branches.planningTypes" },
      { $match: { "branches.planningTypes.type": "entity" } },
      { $unwind: "$branches.planningTypes.nodes" },
      { $match: { "branches.planningTypes.nodes.nodeID": nodeID } },

      { $unset: ["branches.planningTypes.nodes.entityBasic.mainConfigs"] },
      { $unset: ["branches.planningTypes.nodes.entityBasic.inheritedConfigs"] },
      { $unset: ["branches.planningTypes.nodes.entityCategory.mainConfigs"] },
      {
        $unset: [
          "branches.planningTypes.nodes.entityCategory.inheritedConfigs",
        ],
      },

      { $replaceRoot: { newRoot: "$branches.planningTypes.nodes" } },
      {
        $project: {
          _id: 0,
          nodeID: 1,
          entityBasic: 1,
          entityCategory: 1,
        },
      },
    ]);

    entityIcon = entityIcon[0];
    if (entityIcon.entityBasic) {
      entityIcon = entityIcon.entityBasic.entityIcon;
    } else if (entityIcon.entityCategory) {
      entityIcon = entityIcon.entityCategory.entityIcon;
    }

    return entityIcon;
  } catch (error) {
    throw error;
  }
}
export async function fetchEntityIcons(gameID, branch, nodeIDs) {
  let entityIcons = await NodeModel.aggregate([
    { $match: { gameID } },
    { $unwind: "$branches" },
    { $match: { "branches.branch": branch } },
    { $unwind: "$branches.planningTypes" },
    { $match: { "branches.planningTypes.type": "entity" } },
    { $unwind: "$branches.planningTypes.nodes" },
    { $match: { "branches.planningTypes.nodes.nodeID": { $in: nodeIDs } } },

    { $unset: ["branches.planningTypes.nodes.entityBasic.mainConfigs"] },
    { $unset: ["branches.planningTypes.nodes.entityBasic.inheritedConfigs"] },
    { $unset: ["branches.planningTypes.nodes.entityCategory.mainConfigs"] },
    {
      $unset: ["branches.planningTypes.nodes.entityCategory.inheritedConfigs"],
    },

    { $replaceRoot: { newRoot: "$branches.planningTypes.nodes" } },
    {
      $project: {
        _id: 0,
        nodeID: 1,
        entityBasic: 1,
        entityCategory: 1,
      },
    },
  ]);

  entityIcons = entityIcons.map((entity) => {
    if (entity.entityBasic) {
      return {
        nodeID: entity.nodeID,
        icon: entity.entityBasic.entityIcon,
      };
    } else if (entity.entityCategory) {
      return {
        nodeID: entity.nodeID,
        icon: entity.entityCategory.entityIcon,
      };
    }
  });
  return entityIcons;
}

export async function getEntitiesNames(gameID, branch) {
  try {
    let entities = await NodeModel.aggregate([
      { $match: { gameID } },
      { $unwind: "$branches" },
      { $match: { "branches.branch": branch } },
      { $unwind: "$branches.planningTypes" },
      { $match: { "branches.planningTypes.type": "entity" } },
      { $unwind: "$branches.planningTypes.nodes" },
      { $replaceRoot: { newRoot: "$branches.planningTypes.nodes" } },
      {
        $project: {
          _id: 0,
          name: 1,
          nodeID: 1,
        },
      },
    ]);

    entities = entities.filter((n) => !n.removed);

    return entities;
  } catch (error) {
    throw error;
  }
}

export async function getEntitiesIDs(gameID, branch) {
  try {
    let entities = await NodeModel.aggregate([
      { $match: { gameID } },
      { $unwind: "$branches" },
      { $match: { "branches.branch": branch } },
      { $unwind: "$branches.planningTypes" },
      { $match: { "branches.planningTypes.type": "entity" } },
      { $unwind: "$branches.planningTypes.nodes" },
      { $unset: ["branches.planningTypes.nodes.entityBasic.entityIcon"] },
      { $unset: ["branches.planningTypes.nodes.entityBasic.parentCategory"] },
      { $unset: ["branches.planningTypes.nodes.entityBasic.mainConfigs"] },
      { $unset: ["branches.planningTypes.nodes.entityBasic.inheritedConfigs"] },
      {
        $match: {
          "branches.planningTypes.nodes.entityCategory": { $exists: false },
        },
      },
      { $unset: ["branches.planningTypes.nodes.analyticsEvents"] },
      { $replaceRoot: { newRoot: "$branches.planningTypes.nodes" } },
    ]);

    entities = entities.filter((n) => !n.removed);

    return entities || [];
  } catch (error) {
    throw error;
  }
}

export async function getEntitiesByNodeIDs(gameID, branch, nodeIDs) {
  try {
    let entities = await NodeModel.aggregate([
      { $match: { gameID } },
      { $unwind: "$branches" },
      { $match: { "branches.branch": branch } },
      { $unwind: "$branches.planningTypes" },
      { $match: { "branches.planningTypes.type": "entity" } },
      { $unwind: "$branches.planningTypes.nodes" },
      { $match: { "branches.planningTypes.nodes.nodeID": { $in: nodeIDs } } },
      { $unset: ["branches.planningTypes.nodes.entityBasic.mainConfigs"] },
      { $unset: ["branches.planningTypes.nodes.entityBasic.inheritedConfigs"] },
      { $unset: ["branches.planningTypes.nodes.analyticsEvents"] },
      {
        $unset: ["branches.planningTypes.nodes.entityCategory.parentCategory"],
      },
      { $replaceRoot: { newRoot: "$branches.planningTypes.nodes" } },
    ]);

    return entities || [];
  } catch (error) {
    throw error;
  }
}

// It is crucial to resolve existing configs. What do we want to do:
// 1. Change entity's parentCategory ID
// 2. Change inheritedCategories array to know which categories are inherited now
// 3. Loop through inheritedCategories & existing inheritedConfigs, removing all configs that are now not inherited
// resolveEntityObjAfterMoving(
//   'c60079e9-9b64-4cb7-a35d-4ccb1cf63864',
// 'development',
// 'b1f60bcb-4a7c-45d6-9cf6-558f8668e6a5',
// '65f770b196a5dfe2ad8da040')
export async function resolveEntityObjAfterMoving(
  gameID,
  branch,
  node,
  newParentID
) {
  async function getTree() {
    const planningTree = await PlanningTreeModel.findOne({ gameID });

    if (!planningTree) {
      return { success: false, message: "PlanningTree not found" };
    }

    // Найти ветку с соответствующим именем
    const branchIndex = planningTree.branches.findIndex(
      (b) => b.branch === branch
    );

    if (branchIndex === -1) {
      return { success: false, message: "Branch not found" };
    }

    // Найти планировочный тип с соответствующим типом
    const planningTypeIndex = planningTree.branches[
      branchIndex
    ].planningTypes.findIndex((p) => p.type === "entity");

    if (planningTypeIndex === -1) {
      return { success: false, message: "PlanningType not found" };
    }

    // Найти ноду, куда нужно переместить
    const nodesTree =
      planningTree.branches[branchIndex].planningTypes[planningTypeIndex].nodes;

    if (!nodesTree) {
      return { success: false, message: "Destination node not found" };
    }
    return { success: true, nodes: nodesTree[0] };
  }
  let planningTree = await getTree();
  if (planningTree.success === false) return;
  planningTree = planningTree.nodes;

  async function getNodes() {
    const nodes = await NodeModel.aggregate([
      { $match: { gameID } },
      { $unwind: "$branches" },
      { $match: { "branches.branch": branch } },
      { $unwind: "$branches.planningTypes" },
      { $match: { "branches.planningTypes.type": "entity" } },
      { $unwind: "$branches.planningTypes.nodes" },
      { $unset: ["branches.planningTypes.nodes.entityBasic.mainConfigs"] },
      { $unset: ["branches.planningTypes.nodes.entityBasic.entityIcon"] },
      { $unset: ["branches.planningTypes.nodes.name"] },
      { $unset: ["branches.planningTypes.nodes.analyticsEvents"] },
      { $replaceRoot: { newRoot: "$branches.planningTypes.nodes" } },
    ]);

    if (!nodes) {
      return { success: false, error: "No document found" };
    }

    return { success: true, nodes: nodes };
  }
  let nodes = await getNodes();
  if (nodes.success === false) return;
  // Losing the unnecessary "success" field
  nodes = nodes.nodes;

  let targetNode = nodes.find((n) => n.nodeID === node.ID);
  let entityConfigField =
    targetNode.entityCategory !== undefined ? "entityCategory" : "entityBasic";

  function getInheritance(parentCategoryID) {
    let tempCategories = [];

    function getInheritanceRecursively(parentCategoryID) {
      let inheritedNodeID = findNodeById(
        planningTree.subnodes,
        parentCategoryID
      );

      // Check if null. If so, it's Root
      if (inheritedNodeID === null) {
        if (planningTree._id.toString() === parentCategoryID) {
          inheritedNodeID = planningTree;
        }
      }

      let entityConfigField = inheritedNodeID.isCategory
        ? "entityCategory"
        : "entityBasic";

      inheritedNodeID = inheritedNodeID.nodeID;

      let inheritedNodeParentID = nodes.find(
        (n) => n.nodeID === inheritedNodeID
      )[entityConfigField].parentCategory;

      // If this node is nested, go recursive until we hit the root
      tempCategories.push(inheritedNodeID);
      if (inheritedNodeParentID && inheritedNodeParentID !== "") {
        getInheritanceRecursively(inheritedNodeParentID);
      }
    }
    getInheritanceRecursively(parentCategoryID);

    return tempCategories;
  }
  let newInheritedCategories = getInheritance(newParentID);
  // console.log('Target nodes new cats:', newInheritedCategories)

  function clearInheritedConfigs() {
    const inheritedCategoriesSet = new Set(newInheritedCategories);
    
    if (targetNode[entityConfigField].inheritedConfigs === "") return [];
    let nodeConfigs = JSON.parse(
      targetNode[entityConfigField].inheritedConfigs
    );
    if (nodeConfigs.inheritedConfigs) {
      delete nodeConfigs.inheritedConfigs
    }

    const filteredInheritedConfigs = nodeConfigs
    .map((config) => {
      return {
        nodeID: config.nodeID,
        configs: config.configs,
      }
    })
    .filter((config) => {
      const { nodeID } = config;
      return inheritedCategoriesSet.has(nodeID);
    });
    

    return filteredInheritedConfigs;
  }

  let newInheritedConfigs = []

  function addMissingInheritedConfigs() {
    newInheritedCategories.forEach(c => {

      let category = nodes.find((n) => n.nodeID === c);
      // console.log('Category:', category)
      newInheritedConfigs.push({
        nodeID: c,
        configs: category.entityCategory.mainConfigs
      })

    })
  }
  addMissingInheritedConfigs()
  newInheritedConfigs = JSON.stringify(clearInheritedConfigs());



  targetNode = {
    ...targetNode,
    [entityConfigField]: {
      ...targetNode[entityConfigField],
      parentCategory: newParentID,
      inheritedCategories: newInheritedCategories,
      inheritedConfigs: newInheritedConfigs,
    },
  };
  // console.log('Resulted node:', targetNode)

  const updateFields = {};
  updateFields[
    `branches.$[branch].planningTypes.$[planningType].nodes.$[node].${entityConfigField}.parentCategory`
  ] = targetNode[entityConfigField].parentCategory;
  updateFields[
    `branches.$[branch].planningTypes.$[planningType].nodes.$[node].${entityConfigField}.inheritedCategories`
  ] = targetNode[entityConfigField].inheritedCategories;
  updateFields[
    `branches.$[branch].planningTypes.$[planningType].nodes.$[node].${entityConfigField}.inheritedConfigs`
  ] = targetNode[entityConfigField].inheritedConfigs;

  // console.log('Saving target fields', updateFields)

  // Saving target node
  try {
    const saveNode = await NodeModel.updateOne(
      {
        gameID,
        branches: { $elemMatch: { branch: branch } },
        "branches.planningTypes": { $elemMatch: { type: "entity" } },
        "branches.planningTypes.nodes": { $elemMatch: { nodeID: node.ID } },
      },
      {
        $set: updateFields,
      },
      {
        arrayFilters: [
          { "branch.branch": branch },
          { "planningType.type": "entity" },
          { "node.nodeID": node.ID },
        ],
        new: true,
      }
    );
    // console.log({ saveNode, success: true, message: 'Entity updated successfully' });
  } catch (error) {
    console.error("Error saving node while moving in tree:", error);
  }
  let updateLocalNodes = nodes.find((n) => n.nodeID === targetNode.nodeID);
  updateLocalNodes = Object.assign(updateLocalNodes, targetNode);

  // Now we must also resolve all children nodes' inheritedCategories
  async function resolveChildren() {
    const parentNode = findNodeById(planningTree.subnodes, node._id);

    if (parentNode.subnodes && parentNode.subnodes.length > 0) {
      parentNode.subnodes.forEach((subnode) => {
        async function resolveChildRecursively(subnode) {
          let child = nodes.find((n) => n.nodeID === subnode.nodeID);

          let entityConfigField = child.entityCategory
            ? "entityCategory"
            : "entityBasic";

          let inheritedCategories = getInheritance(
            child[entityConfigField].parentCategory
          );

          const updateFields = {};
          updateFields[
            `branches.$[branch].planningTypes.$[planningType].nodes.$[node].${entityConfigField}.inheritedCategories`
          ] = inheritedCategories;

          // console.log('Saving child inhcats:', inheritedCategories)

          // Saving child node
          const saveNode = NodeModel.updateOne(
            {
              gameID,
              branches: { $elemMatch: { branch: branch } },
              "branches.planningTypes": { $elemMatch: { type: "entity" } },
              "branches.planningTypes.nodes": {
                $elemMatch: { nodeID: child.nodeID },
              },
            },
            {
              $set: updateFields,
            },
            {
              arrayFilters: [
                { "branch.branch": branch },
                { "planningType.type": "entity" },
                { "node.nodeID": child.nodeID },
              ],
              new: true,
            }
          );

          if (subnode.subnodes && subnode.subnodes.length > 0) {
            subnode.subnodes.forEach((subnode) => {
              resolveChildRecursively(subnode);
            });
          }
        }
        resolveChildRecursively(subnode);
      });
    }
  }
  resolveChildren();

  async function resolveLocalizationItems() {
    // Get the new updated tree
    let newTree = await getTree();
    newTree = newTree.nodes;

    // Get the current node we just moved
    const targetNode = findNodeById(newTree.subnodes, node._id);

    async function resolveExitedItems(nodeID) {
      let localizationItems = await Localization.aggregate([
        { $match: { gameID } },
        { $unwind: "$branches" },
        { $match: { "branches.branch": branch } },
        { $unwind: "$branches.localization" },
        { $unwind: `$branches.localization.entities` },
        {
          $match: {
            [`branches.localization.entities.sid`]: {
              $regex: new RegExp(`^.*\\|${nodeID}$`),
            },
          },
        },
        { $replaceRoot: { newRoot: `$branches.localization.entities` } },
      ]);

      if (localizationItems && localizationItems.length > 0) {
        for (const item of localizationItems) {
          if (item.inheritedFrom) {
            // We want to get the category node that we inherit localized item from
            const parentCategory = findNodeByNodeID(
              newTree.subnodes,
              item.inheritedFrom
            );
            // Then we want to check if the target node is a child of the parent node
            // This way we know if it is moved from the parent node. If so, we need to remove outdated localization items
            if (parentCategory) {
              const targetNodeAsChild = findNodeByNodeID(
                parentCategory.subnodes,
                nodeID
              );
              if (!targetNodeAsChild) {
                // Remove all localization items that are inherited from the parent category
                // and "sid" contains this nodeID
                const result = await Localization.updateMany(
                  {
                    gameID,
                    "branches.branch": branch,
                    "branches.localization.entities.sid": new RegExp(
                      `^.*\\|${nodeID}$`
                    ),
                    "branches.localization.entities.inheritedFrom":
                      item.inheritedFrom,
                  },
                  {
                    $pull: {
                      "branches.$[branch].localization.entities": {
                        $and: [
                          { sid: new RegExp(`^.*\\|${nodeID}$`) },
                          { inheritedFrom: item.inheritedFrom },
                        ],
                      },
                    },
                  },
                  {
                    arrayFilters: [
                      { "branch.branch": branch },
                      {
                        "localization.entities.inheritedFrom":
                          item.inheritedFrom,
                      },
                    ],
                    new: true,
                    multi: true,
                  }
                ).exec();
              }
            }
          }
        }
      }
    }
    resolveExitedItems(targetNode.nodeID);

    async function resolveJoinedItems(nodeID) {
      let localizationItems = await Localization.aggregate([
        { $match: { gameID } },
        { $unwind: "$branches" },
        { $match: { "branches.branch": branch } },
        { $unwind: "$branches.localization" },
        { $unwind: `$branches.localization.entities` },
        {
          $match: {
            [`branches.localization.entities.inheritedFrom`]: {
              $exists: false,
            },
          },
        },
        { $replaceRoot: { newRoot: `$branches.localization.entities` } },
      ]);

      if (localizationItems && localizationItems.length > 0) {
        for (const item of localizationItems) {
          const categoryNodeID = item.sid.split("|")[1];
          const parentCategory = findNodeByNodeID(
            newTree.subnodes,
            categoryNodeID
          );
          const targetNodeAsChild = findNodeByNodeID(
            parentCategory.subnodes,
            nodeID
          );

          if (targetNodeAsChild) {
            let tempItem = item;
            tempItem.sid = tempItem.sid.split("|")[0] + "|" + nodeID;
            tempItem.inheritedFrom = categoryNodeID;

            await insertLocalizationItem(gameID, branch, "entities", tempItem);
          }
        }
      }
    }
    resolveJoinedItems(targetNode.nodeID);

    function recursivelyResolveItems(node) {
      if (node.subnodes) {
        for (const subnode of node.subnodes) {
          resolveJoinedItems(subnode.nodeID);
          resolveExitedItems(subnode.nodeID);
          recursivelyResolveItems(subnode);
        }
      }
    }
    recursivelyResolveItems(targetNode);
  }
  resolveLocalizationItems();

  return;
}

export async function removeNodeInheritance(
  gameID,
  branch,
  nodeID,
  isCategory
) {
  console.log(
    "Removing node inheritance for gameID:",
    gameID,
    "branch:",
    branch,
    "nodeID:",
    nodeID,
    "isCategory:",
    isCategory
  );

  try {
    const updateFields = {};

    if (isCategory) {
      updateFields[
        `branches.$[branch].planningTypes.$[planningType].nodes.$[node].entityCategory.parentCategory`
      ] = "";
      updateFields[
        `branches.$[branch].planningTypes.$[planningType].nodes.$[node].entityCategory.inheritedCategories`
      ] = [];
      updateFields[
        `branches.$[branch].planningTypes.$[planningType].nodes.$[node].entityCategory.inheritedConfigs`
      ] = "";
    } else {
      updateFields[
        `branches.$[branch].planningTypes.$[planningType].nodes.$[node].entityBasic.parentCategory`
      ] = "";
      updateFields[
        `branches.$[branch].planningTypes.$[planningType].nodes.$[node].entityBasic.inheritedCategories`
      ] = [];
      updateFields[
        `branches.$[branch].planningTypes.$[planningType].nodes.$[node].entityBasic.inheritedConfigs`
      ] = "";
    }

    // Saving target node
    const resp = await NodeModel.updateOne(
      {
        gameID,
        branches: { $elemMatch: { branch: branch } },
        "branches.planningTypes": { $elemMatch: { type: "entity" } },
        "branches.planningTypes.nodes": { $elemMatch: { nodeID: nodeID } },
      },
      {
        $set: updateFields,
      },
      {
        arrayFilters: [
          { "branch.branch": branch },
          { "planningType.type": "entity" },
          { "node.nodeID": nodeID },
        ],
        new: true,
      }
    );
    console.log({ success: true, message: "Entity updated successfully" });
  } catch (error) {
    console.error(error);
  }
}

export async function moveNodeInPlanningTree(
  gameID,
  branchName,
  planningType,
  nodeToMove,
  destinationID
) {
  try {
    // Найти документ PlanningTreeModel по gameID
    const planningTree = await PlanningTreeModel.findOne({ gameID });

    if (!planningTree) {
      // return res.status(404).json({ message: 'PlanningTree not found' });
    }

    // Найти ветку с соответствующим именем
    const branchIndex = planningTree.branches.findIndex(
      (b) => b.branch === branchName
    );

    if (branchIndex === -1) {
      // return res.status(404).json({ message: 'Branch not found' });
    }

    // Найти планировочный тип с соответствующим типом
    const planningTypeIndex = planningTree.branches[
      branchIndex
    ].planningTypes.findIndex((p) => p.type === planningType);

    if (planningTypeIndex === -1) {
      // return res.status(404).json({ message: 'PlanningType not found' });
    }

    // Найти ноду, куда нужно переместить
    const destinationNode = findNodeById(
      planningTree.branches[branchIndex].planningTypes[planningTypeIndex].nodes,
      destinationID
    );

    if (!destinationNode) {
      // return res.status(404).json({ message: 'Destination node not found' });
    }

    // Удалить ноду из исходного места
    const removedNode = removeNodeById(
      planningTree.branches[branchIndex].planningTypes[planningTypeIndex].nodes,
      nodeToMove._id
    );
    if (!removedNode) return;
    // Переместить ноду в новое место
    const findAndUpdateNode = async (nodes) => {
      for (const node of nodes) {
        if (node._id.toString() === destinationID) {
          // Найден узел с соответствующим parentId
          node.subnodes.push(removedNode);
          return;
        }

        if (node.subnodes.length > 0) {
          // Рекурсивный вызов для подузлов
          findAndUpdateNode(node.subnodes);
        }
      }
    };
    // Начало поиска и обновления узла
    findAndUpdateNode(
      planningTree.branches[branchIndex].planningTypes.find(
        (pt) => pt.type === planningType
      )?.nodes || []
    );

    await planningTree.save();

    if (planningType === "entity") {
      await resolveEntityObjAfterMoving(
        gameID,
        branchName,
        nodeToMove,
        destinationID
      );
    }

    // res.status(200).json({ success: true, message: 'Node moved successfully' });
  } catch (error) {
    console.error("Error moving node in tree:", error);
    // res.status(500).json({ message: 'Internal Server Error' });
  }
}

export async function removeNodeFromTree(
  gameID,
  branchName,
  planningType,
  nodeID
) {
  try {
    const planningDocument = await PlanningTreeModel.findOne({ gameID }).exec();
    if (!planningDocument) {
      throw new Error("Planning document not found");
    }

    const branch = planningDocument.branches.find(
      (b) => b.branch === branchName
    );
    if (!branch) {
      throw new Error("Branch not found");
    }

    const targetPlanningType = branch.planningTypes.find(
      (pt) => pt.type === planningType
    );
    if (!targetPlanningType) {
      throw new Error("PlanningType not found");
    }

    let success = false;
    findAndRemoveNode(targetPlanningType.nodes);

    function findAndRemoveNode(nodes) {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (node._id.toString() === nodeID) {
          nodes.splice(i, 1);
          removeChildrenInheritance(node);
          planningDocument.save();
          success = true;
          return;
        }
        if (node.subnodes && node.subnodes.length > 0) {
          findAndRemoveNode(node.subnodes);
        }
      }
    }

    function removeChildrenInheritance(node) {
      const iterateChildren = (children) => {
        for (const n of children) {
          removeNodeInheritance(gameID, branchName, n.nodeID, n.isCategory);
          if (n.subnodes && n.subnodes.length > 0) {
            iterateChildren(n.subnodes);
          }
        }
      };
      removeNodeInheritance(gameID, branchName, node.nodeID, node.isCategory);
      iterateChildren(node.subnodes);
    }

    if (success) {
      return { success: true };
    } else {
      throw new Error("Node with nodeID not found");
    }
  } catch (error) {
    throw error;
  }
}

export async function addChildNodeInPlanningTree(
  gameID,
  branchName,
  planningType,
  parentId,
  newNode
) {
  try {
    // Поиск документа в коллекции plannings по gameID
    const planningDocument = await PlanningTreeModel.findOne({ gameID }).exec();

    if (!planningDocument) {
      return res.status(404).json({ error: "Planning document not found" });
    }

    // Поиск ветки с соответствующим branchName
    const branch = planningDocument.branches.find(
      (b) => b.branch === branchName
    );

    if (!branch) {
      return res.status(404).json({ error: "Branch not found" });
    }

    let success = false;

    console.log(newNode);
    // Рекурсивная функция для поиска и обновления узла
    const findAndUpdateNode = (nodes) => {
      for (const node of nodes) {
        if (node._id.toString() === parentId) {
          // Найден узел с соответствующим parentId
          const newNodeObject = {
            nodeID: newNode.ID,
            subnodes: [],
            isCategory: newNode.isCategory ? newNode.isCategory : false,
            _id: newNode._id,
          };
          node.subnodes.push(newNodeObject);
          planningDocument.save(); // Сохранение изменений
          success = true;
          return;
        }

        if (node.subnodes.length > 0) {
          // Рекурсивный вызов для подузлов
          findAndUpdateNode(node.subnodes);
        }
      }
    };

    // Начало поиска и обновления узла
    findAndUpdateNode(
      branch.planningTypes.find((pt) => pt.type === planningType)?.nodes || []
    );

    if (success) {
      // Now we need to update the node itself with the new parentCategoryID
      let updateFields = {};
      if (newNode.isCategory) {
        updateFields[
          `branches.$[branch].planningTypes.$[planningType].nodes.$[node].entityCategory.parentCategory`
        ] = parentId;
      } else {
        updateFields[
          `branches.$[branch].planningTypes.$[planningType].nodes.$[node].entityBasic.parentCategory`
        ] = parentId;
      }

      // Saving target node
      const resp = await NodeModel.updateOne(
        {
          gameID,
          branches: { $elemMatch: { branch: branchName } },
          "branches.planningTypes": { $elemMatch: { type: "entity" } },
          "branches.planningTypes.nodes": {
            $elemMatch: { nodeID: newNode.ID },
          },
        },
        {
          $set: updateFields,
        },
        {
          arrayFilters: [
            { "branch.branch": branchName },
            { "planningType.type": "entity" },
            { "node.nodeID": newNode.ID },
          ],
          new: true,
        }
      );

      return { status: 200, success: true };
    } else {
      // Если не найден узел с указанным parentId
      return {
        status: 404,
        success: false,
        error: "Node with parentId not found",
      };
    }
  } catch (error) {
    console.error(error);
    return { status: 500, success: false, error: "Internal Server Error" };
  }
}

export async function getNodeTree(gameID, branch, planningType) {
  try {
    let existingDoc = await PlanningTreeModel.findOne({
      gameID,
      "branches.branch": branch,
    });

    if (!existingDoc) {
      // If document doesn't exist, create a new one
      const newNode = {
        gameID,
        branches: [
          {
            branch,
            planningTypes: [
              {
                type: planningType,
                nodes: [
                  {
                    nodeID: "Root",
                    subnodes: [],
                  },
                ],
              },
            ],
          },
        ],
      };
      existingDoc = await PlanningTreeModel.create(newNode);
    } else {
      // Check if planningType exists
      const planningTypeExists = existingDoc.branches
        .find((b) => b.branch === branch)
        ?.planningTypes.some((pt) => pt.type === planningType);

      if (!planningTypeExists) {
        // If planningType doesn't exist, add it to the existing document
        await PlanningTreeModel.updateOne(
          {
            gameID,
            "branches.branch": branch,
          },
          {
            $push: {
              "branches.$[b].planningTypes": {
                type: planningType,
                nodes: [
                  {
                    nodeID: "Root",
                    subnodes: [],
                  },
                ],
              },
            },
          },
          {
            arrayFilters: [{ "b.branch": branch }],
          }
        );
      }
    }

    // Get updated document
    existingDoc = await PlanningTreeModel.findOne({
      gameID,
      "branches.branch": branch,
      "branches.planningTypes.type": planningType,
    });

    // Transform data format
    const planningTypeObj = existingDoc?.branches
      .find((b) => b.branch === branch)
      ?.planningTypes.find((pt) => pt.type === planningType);
    const nodesList = planningTypeObj ? planningTypeObj.nodes : [];

    const transformNodes = (inputNodes) => {
      return inputNodes.map(
        ({ _id, nodeID, subnodes, isGameplay, gameplayName, isCategory }) => ({
          ID: nodeID,
          Subnodes: transformNodes(subnodes),
          _id: _id,
          isGameplay: isGameplay,
          gameplayName: gameplayName,
          isCategory: isCategory,
        })
      );
    };

    return transformNodes(nodesList);
  } catch (error) {
    throw error;
  }
}

export async function getPlanningNodes(gameID, branch, planningType) {
  try {
    const nodes = await NodeModel.findOne({ gameID }).exec();

    if (!nodes) {
      throw new Error("No document found");
    }

    // Find or create the corresponding branch
    let branchObj = nodes.branches.find((b) => b.branch === branch);

    if (!branchObj) {
      throw new Error("No branch found");
    }

    // Find or create the corresponding planningType
    let planningTypeObj = branchObj.planningTypes.find(
      (pt) => pt.type === planningType
    );

    if (!planningTypeObj) {
      throw new Error("No planning type found");
    }

    const nodesList = planningTypeObj.nodes.filter((n) => !n.removed);

    return nodesList;
  } catch (error) {
    throw error;
  }
}

export function findEntityCategoryNodeIDs(node) {
  const entityCategoryNodeIDs = [];

  // Рекурсивно обходим дерево
  function traverse(node, path = []) {
    if (node.isEntityCategory === false) {
      entityCategoryNodeIDs.push(node.nodeID);
    }
    path.push(node.nodeID);
    if (node.subnodes && node.subnodes.length > 0) {
      for (const subnode of node.subnodes) {
        traverse(subnode, [...path]);
      }
    }
  }

  traverse(node);

  return entityCategoryNodeIDs;
}

export async function findEntityById(gameID, branch, nodeID) {
  const query = {
    gameID: gameID,
    "branches.branch": branch,
  };
  const tree = await PlanningTreeModel.findOne(query);

  const branchObject = tree.branches.find((b) => b.branch === branch);
  const entityNodes = branchObject.planningTypes.find(
    (t) => t.type === "entity"
  ).nodes;

  function findNode(node) {
    if (node.nodeID === nodeID) {
      return node;
    }
    if (node.subnodes && node.subnodes.length > 0) {
      for (const subnode of node.subnodes) {
        const found = findNode(subnode);
        if (found) {
          return found;
        }
      }
    }
    return null;
  }

  return findNode(entityNodes[0]);
}

export async function addEntityToParent(
  gameID,
  branch,
  parentId,
  newNode,
  isCategory
) {
  try {
    // Поиск документа в коллекции plannings по gameID
    const planningDocument = await PlanningTreeModel.findOne({ gameID }).exec();

    if (!planningDocument) {
      return res.status(404).json({ error: "Planning document not found" });
    }

    // Поиск ветки с соответствующим branch
    const foundBranch = planningDocument.branches.find(
      (b) => b.branch === branch
    );

    if (!foundBranch) {
      return res.status(404).json({ error: "Branch not found" });
    }

    let success = false;
    // Рекурсивная функция для поиска и обновления узла
    const findAndUpdateNode = (nodes) => {
      for (const node of nodes) {
        if (node._id.toString() === parentId) {
          // Найден узел с соответствующим parentId
          const newNodeObject = {
            nodeID: newNode,
            subnodes: [],
            _id: new mongoose.Types.ObjectId(),
            isCategory: isCategory,
          };
          node.subnodes.push(newNodeObject);

          success = true;
          return;
        }

        if (node.subnodes.length > 0) {
          // Рекурсивный вызов для подузлов
          findAndUpdateNode(node.subnodes);
        }
      }
    };

    // Начало поиска и обновления узла
    await findAndUpdateNode(
      foundBranch.planningTypes.find((pt) => pt.type === "entity")?.nodes || []
    );
    planningDocument.save();

    if (success) {
      return { status: 200, success: true };
    } else {
      // Если не найден узел с указанным parentId
      return {
        status: 404,
        success: false,
        error: "Node with parentId not found",
      };
    }
  } catch (error) {
    console.error(error);
    return { status: 500, success: false, error: "Internal Server Error" };
  }
}

export async function addBasicEntityToParentInBulk(
  gameID,
  branch,
  parentIds,
  newNodes,
  isCategories
) {
  try {
    const planningDocument = await PlanningTreeModel.findOne({ gameID }).exec();

    if (!planningDocument) {
      return {
        status: 404,
        success: false,
        error: "Planning document not found",
      };
    }

    const foundBranch = planningDocument.branches.find(
      (b) => b.branch === branch
    );

    if (!foundBranch) {
      return { status: 404, success: false, error: "Branch not found" };
    }

    let success = false;

    const findAndUpdateNode = (nodes, index) => {
      for (const node of nodes) {
        if (node._id.toString() === parentIds[index]) {
          const newNodeObject = {
            nodeID: newNodes[index],
            subnodes: [],
            _id: new mongoose.Types.ObjectId(),
            isCategory: isCategories[index],
          };
          node.subnodes.push(newNodeObject);
          success = true;
          return;
        }

        if (node.subnodes.length > 0) {
          findAndUpdateNode(node.subnodes, index);
        }
      }
    };

    parentIds.forEach((parentId, index) => {
      findAndUpdateNode(
        foundBranch.planningTypes.find((pt) => pt.type === "entity")?.nodes ||
          [],
        index
      );
    });

    planningDocument.save();

    if (success) {
      return { status: 200, success: true };
    } else {
      return {
        status: 404,
        success: false,
        error: "Node with parentId not found",
      };
    }
  } catch (error) {
    console.error(error);
    return { status: 500, success: false, error: "Internal Server Error" };
  }
}

export async function createEntityBulk(gameID, branch, entityObjArray) {
  try {
    // Check for required fields in the request
    if (!gameID || !branch || !entityObjArray || entityObjArray.length === 0) {
      throw new Error("Missing required fields");
    }

    const query = {
      gameID: gameID,
      "branches.branch": branch,
    };

    const newNodes = entityObjArray.map((entityObj) => {
      const newNodeID = uuid();
      return {
        nodeID: newNodeID,
        name: entityObj.entityName,
        description: entityObj.entityDescription,
        techDescription: entityObj.entityTechDescription,
        entityCategory: entityObj.entityCategory,
        entityBasic: entityObj.entityBasic,
      };
    });

    const update = {
      $push: {
        "branches.$.planningTypes.$[type].nodes": {
          $each: newNodes,
        },
      },
    };

    const options = {
      arrayFilters: [
        { "type.type": "entity" }, // filter the required planning type
      ],
      new: true, // to get the updated document
    };

    await NodeModel.findOneAndUpdate(query, update, options);

    let nodesToPutInParents = [];

    newNodes.forEach((e) => {
      async function tryToAddEntityToParent(entityObj) {
        // If not empty, it is basic entity. Category otherwise
        if (entityObj.entityBasic && entityObj.entityBasic.entityID !== "") {
          // Trying to put it under parent category immediately
          if (entityObj.entityBasic.parentCategory !== "") {
            nodesToPutInParents.push(entityObj);
          }
        }
      }
      tryToAddEntityToParent(e);
    });
    if (nodesToPutInParents.length > 0) {
      await addBasicEntityToParentInBulk(
        gameID,
        branch,
        nodesToPutInParents.map((e) => e.entityBasic.parentCategory),
        nodesToPutInParents.map((e) => e.nodeID),
        nodesToPutInParents.map((e) => e.entityBasic.isCategory)
      );
    }
  } catch (error) {
    throw error;
  }
}

export async function createEntity(gameID, branch, entityObj) {
  try {
    // Check for required fields in the request
    if (!gameID || !branch || !entityObj) {
      throw new Error("Missing required fields");
    }

    const query = {
      gameID: gameID,
      "branches.branch": branch,
    };

    const newNodeID = uuid();

    const update = {
      $push: {
        "branches.$.planningTypes.$[type].nodes": {
          nodeID: newNodeID,
          name: entityObj.entityName,
          description: entityObj.entityDescription,
          techDescription: entityObj.entityTechDescription,
          entityCategory: entityObj.entityCategory,
          entityBasic: entityObj.entityBasic,
        },
      },
    };

    const options = {
      arrayFilters: [
        { "type.type": "entity" }, // filter the required planning type
      ],
      new: true, // to get the updated document
    };

    await NodeModel.findOneAndUpdate(query, update, options);

    // If not empty, it is basic entity. Category otherwise
    if (entityObj.entityBasic && entityObj.entityBasic.entityID !== "") {
      // Trying to put it under parent category immediately
      if (entityObj.entityBasic.parentCategory !== "") {
        await addEntityToParent(
          gameID,
          branch,
          entityObj.entityBasic.parentCategory,
          newNodeID,
          false
        );
      }
    } else {
      // Trying to put it under parent category immediately
      if (entityObj.entityCategory.parentCategory !== "") {
        await addEntityToParent(
          gameID,
          branch,
          entityObj.entityCategory.parentCategory,
          newNodeID,
          true
        );
      }
    }
  } catch (error) {
    throw error;
  }
}

export async function createPlanningNode(
  gameID,
  branch,
  planningType,
  nodeID,
  nodeName
) {
  try {
    const existingNode = await NodeModel.findOne({
      gameID,
      "branches.branch": branch,
    });

    if (existingNode) {
      // Если branch уже существует, проверим, существует ли planningType
      const branchExists = existingNode.branches.some(
        (b) => b.branch === branch
      );

      if (branchExists) {
        // Если planningType уже существует, добавим новую ноду
        const planningTypeExists = existingNode.branches
          .find((b) => b.branch === branch)
          .planningTypes.some((pt) => pt.type === planningType);

        if (planningTypeExists) {
          const nodeExists = existingNode.branches
            .find((b) => b.branch === branch)
            .planningTypes.find((pt) => pt.type === planningType)
            .nodes.some((n) => n.nodeID === nodeID);

          if (!nodeExists) {
            // Если нода с nodeID не существует, добавляем новую ноду
            await NodeModel.updateOne(
              {
                gameID,
                "branches.branch": branch,
                "branches.planningTypes.type": planningType,
              },
              {
                $push: {
                  "branches.$[b].planningTypes.$[pt].nodes": {
                    nodeID,
                    name: nodeName,
                    description: {
                      content: `<h1 class="PlaygroundEditorTheme__h1" dir="ltr"><span style="white-space: pre-wrap;">${nodeName}</span></h1>`,
                      media: [],
                    },
                    techDescription: {
                      content: `<h1 class="PlaygroundEditorTheme__h1" dir="ltr"><span style="white-space: pre-wrap;">Technical Documentation</span></h1>`,
                      media: [],
                    },
                    remoteConfigParams: [],
                    analyticsEvents: [],
                    entityProperties: {
                      entityID: "",
                      quantity: 0,
                      isInAppPurchase: false,
                      softValue: 0,
                      hardValue: 0,
                      realValue: 10,
                      customProperties: [],
                    },
                  },
                },
              },
              {
                arrayFilters: [
                  { "b.branch": branch },
                  { "pt.type": planningType },
                ],
              }
            );
          }
        } else {
          // Если planningType не существует, добавим его
          await NodeModel.updateOne(
            {
              gameID,
              "branches.branch": branch,
            },
            {
              $push: {
                "branches.$[b].planningTypes": {
                  type: planningType,
                  nodes: [
                    {
                      nodeID,
                      name: nodeName,
                      description: {
                        content: `<h1 class="PlaygroundEditorTheme__h1" dir="ltr"><span style="white-space: pre-wrap;">${nodeName}</span></h1>`,
                        media: [],
                      },
                      techDescription: {
                        content: `<h1 class="PlaygroundEditorTheme__h1" dir="ltr"><span style="white-space: pre-wrap;">Technical Documentation</span></h1>`,
                        media: [],
                      },
                      remoteConfigParams: [],
                      analyticsEvents: [],
                      entityProperties: {
                        entityID: "",
                        quantity: 0,
                        isInAppPurchase: false,
                        softValue: 0,
                        hardValue: 0,
                        realValue: 10,
                        customProperties: [],
                      },
                    },
                  ],
                },
              },
            },
            {
              arrayFilters: [{ "b.branch": branch }],
            }
          );
        }
      } else {
        // Если branch не существует, добавим его и новый planningType
        await NodeModel.updateOne(
          {
            gameID,
          },
          {
            $push: {
              branches: {
                branch: branch,
                planningTypes: [
                  {
                    type: planningType,
                    nodes: [
                      {
                        nodeID,
                        name: nodeName,
                        description: {
                          content: `<h1 class="PlaygroundEditorTheme__h1" dir="ltr"><span style="white-space: pre-wrap;">${nodeName}</span></h1>`,
                          media: [],
                        },
                        techDescription: {
                          content: `<h1 class="PlaygroundEditorTheme__h1" dir="ltr"><span style="white-space: pre-wrap;">Technical Documentation</span></h1>`,
                          media: [],
                        },
                        remoteConfigParams: [],
                        analyticsEvents: [],
                        entityProperties: {
                          entityID: "",
                          quantity: 0,
                          isInAppPurchase: false,
                          softValue: 0,
                          hardValue: 0,
                          realValue: 10,
                          customProperties: [],
                        },
                      },
                    ],
                  },
                ],
              },
            },
          }
        );
      }
    } else {
      // Если документа с таким gameID, branch, planningType нет, создаем новую ноду
      const newNode = {
        gameID,
        branches: [
          {
            branch,
            planningTypes: [
              {
                type: planningType,
                nodes: [
                  {
                    nodeID,
                    name: nodeName,
                    description: {
                      content: `<h1 class="PlaygroundEditorTheme__h1" dir="ltr"><span style="white-space: pre-wrap;">${nodeName}</span></h1>`,
                      media: [],
                    },
                    techDescription: {
                      content: `<h1 class="PlaygroundEditorTheme__h1" dir="ltr"><span style="white-space: pre-wrap;">Technical Documentation</span></h1>`,
                      media: [],
                    },
                    remoteConfigParams: [],
                    analyticsEvents: [],
                    entityProperties: {
                      entityID: "",
                      quantity: 0,
                      isInAppPurchase: false,
                      softValue: 0,
                      hardValue: 0,
                      realValue: 0,
                      customProperties: [],
                    },
                  },
                ],
              },
            ],
          },
        ],
      };
      await NodeModel.create(newNode);
    }
  } catch (error) {
    throw error;
  }
}

export async function updateNode(
  gameID,
  branchName,
  nodeID,
  fieldToUpdate,
  newField
) {
  try {
    // Find the node in the database
    const resultNode = await NodeModel.findOne({ gameID });
    if (!resultNode) {
      return { success: false, error: "Node not found" };
    }

    // Find the corresponding branch and node inside it
    const selectedBranch = resultNode.branches.find(
      (b) => b.branch === branchName
    );
    if (!selectedBranch) {
      return { success: false, error: "Branch not found" };
    }

    const selectedNode = selectedBranch.planningTypes.reduce((acc, pt) => {
      const foundNode = pt.nodes.find((n) => n.nodeID === nodeID);
      return foundNode ? foundNode : acc;
    }, null);

    if (!selectedNode) {
      return {
        success: false,
        error: "Node not found in the specified branch",
      };
    }

    // Update the value according to the provided parameters
    if (fieldToUpdate === "description") {
      selectedNode.description.content = newField;
    } else if (fieldToUpdate === "techDescription") {
      selectedNode.techDescription.content = newField;
    } else if (fieldToUpdate === "entityProperties") {
      selectedNode.entityProperties = newField;
    } else {
      return { success: false, error: "Invalid fieldToUpdate parameter" };
    }

    // Save the updated node
    await resultNode.save();

    return { success: true };
  } catch (error) {
    throw error;
  }
}

export async function getNode(gameID, branch, nodeID) {
  try {
    // Check for required parameters
    if (!gameID || !branch || !nodeID) {
      throw new Error("Missing required parameters: gameID, branch, nodeID");
    }

    // Search for the node using aggregation
    const foundNode = await NodeModel.aggregate([
      {
        $match: {
          gameID,
          "branches.branch": branch,
        },
      },
      {
        $unwind: "$branches",
      },
      {
        $unwind: "$branches.planningTypes",
      },
      {
        $unwind: "$branches.planningTypes.nodes",
      },
      {
        $match: {
          "branches.planningTypes.nodes.nodeID": nodeID,
        },
      },
      {
        $replaceWith: "$branches.planningTypes.nodes",
      },
    ]);

    // Return the found node
    return foundNode.length > 0 ? foundNode[0] : null;
  } catch (error) {
    throw error;
  }
}
