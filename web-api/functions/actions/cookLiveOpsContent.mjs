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

import _ from "lodash";
import { currencies } from "./currencies.js";

import * as live_db_api from "./rethinkdb.mjs";
Object.assign(global, live_db_api);
import * as google_play_api from "./googleplay.mjs";
Object.assign(global, google_play_api);

export async function pushChangesToBranch(gameID, sourceBranch, targetBranch) {
  if (!checkDBConnection())
    throw new Error("RethinkDB connection is not established");

  try {

    console.log('----------------COOK CONTENT----------------')
    console.log('Game ID: '+ gameID);
    console.log('Source: '+ sourceBranch);
    console.log('Target: '+ targetBranch);

    // 
    // Apply everything in the source branch to the target branch
    // 
    async function pushChanges() {

        console.log('-------START MOVING DB CONTENT-------');
    
    
        // 
        // Nodes
        // 
        console.log('Moving nodes...');
        const nodeModel = await NodeModel.findOne(
            { 
                gameID: gameID
            },
            { 
                branches: { $elemMatch: { branch: sourceBranch } }, _id: 0 
            }
        ).lean();
        await NodeModel.findOneAndUpdate(
            {
              gameID: gameID,
              branches: { $elemMatch: { branch: targetBranch } }
            },
            {
              $set: {
                'branches.$.planningTypes': nodeModel.branches.find(b => b.branch === sourceBranch).planningTypes,
              }
            },
            {
                new: true,
                upsert: true,
            }
        );
        console.log('Done moving nodes');
    
        // 
        // Analytics Events
        // 
        console.log('Moving event...');
        const analyticsEvents = await AnalyticsEvents.findOne(
            { 
                gameID: gameID
            },
            { 
                branches: { $elemMatch: { branch: sourceBranch } }, _id: 0 
            }
        ).lean();
        await AnalyticsEvents.findOneAndUpdate(
            {
              gameID: gameID,
              branches: { $elemMatch: { branch: targetBranch } }
            },
            {
              $set: {
                'branches.$.events': analyticsEvents.branches.find(b => b.branch === sourceBranch).events,
              }
            },
            {
                new: true,
                upsert: true,
            }
        );
        console.log('Done moving events');
    
        // 
        // Offers
        // 
        console.log('Moving offers...');
        const offersModel = await Offers.findOne(
            { 
                gameID: gameID
            },
            { 
                branches: { $elemMatch: { branch: sourceBranch } }, _id: 0 
            }
        ).lean();
        await Offers.findOneAndUpdate(
            {
              gameID: gameID,
              branches: { $elemMatch: { branch: targetBranch } }
            },
            {
              $set: {
                'branches.$.offers': offersModel.branches.find(b => b.branch === sourceBranch).offers,
                'branches.$.positions': offersModel.branches.find(b => b.branch === sourceBranch).positions,
                'branches.$.pricing': offersModel.branches.find(b => b.branch === sourceBranch).pricing,
              }
            },
            {
                new: true,
                upsert: true,
            }
        );
        console.log('Done moving offers');
    
        // 
        // Localization
        // 
        console.log('Moving localization...');
        const localizationModel = await Localization.findOne(
            { 
                gameID: gameID
            },
            { 
                branches: { $elemMatch: { branch: sourceBranch } }, _id: 0 
            }
        ).lean();
        await Localization.findOneAndUpdate(
            {
              gameID: gameID,
              branches: { $elemMatch: { branch: targetBranch } }
            },
            {
              $set: {
                'branches.$.localization': localizationModel.branches.find(b => b.branch === sourceBranch).localization,
              }
            },
            {
                new: true,
                upsert: true,
            }
        );
        console.log('Done moving localization');
    
        // 
        // Planning Tree
        // 
        console.log('Moving planning tree...');
        const planningTreeModel = await PlanningTreeModel.findOne(
            { 
                gameID: gameID
            },
            { 
                branches: { $elemMatch: { branch: sourceBranch } }, _id: 0 
            }
        ).lean();
        await PlanningTreeModel.findOneAndUpdate(
            {
              gameID: gameID,
              branches: { $elemMatch: { branch: targetBranch } }
            },
            {
              $set: {
                'branches.$.planningTypes': planningTreeModel.branches.find(b => b.branch === sourceBranch).planningTypes,
              }
            },
            {
                new: true,
                upsert: true,
            }
        );
        console.log('Done moving planning tree');
    
        // 
        // PW templates
        // 
        console.log('Moving PW templates...');
        const PWtemplatesModel = await PWtemplates.findOne(
            { 
                gameID: gameID
            },
            { 
                branches: { $elemMatch: { branch: sourceBranch } }, _id: 0 
            }
        ).lean();
        await PWtemplates.findOneAndUpdate(
            {
              gameID: gameID,
              branches: { $elemMatch: { branch: targetBranch } }
            },
            {
              $set: {
                'branches.$.templates': PWtemplatesModel.branches.find(b => b.branch === sourceBranch).templates,
              }
            },
            {
                new: true,
                upsert: true,
            }
        );
        console.log('Done moving PW templates');
    
        // 
        // Segments
        // 
        console.log('Moving segments...');
        const segmentsModel = await Segments.findOne(
            { 
                gameID: gameID
            },
            { 
                branches: { $elemMatch: { branch: sourceBranch } }, _id: 0 
            }
        ).lean();
        await Segments.findOneAndUpdate(
            {
              gameID: gameID,
              branches: { $elemMatch: { branch: targetBranch } }
            },
            {
              $set: {
                'branches.$.segments': segmentsModel.branches.find(b => b.branch === sourceBranch).segments,
              }
            },
            {
                new: true,
                upsert: true,
            }
        );
        console.log('Done moving segments');
        console.log('-------END MOVING DB CONTENT-------');
    }
    await pushChanges();


    console.log('-------START COOKING CONTENT-------');
    console.log('Cooking events...');
    // await cookAnalyticsEvents(gameID, sourceBranch)
    console.log('Offers cooked');

    console.log('Cooking offers...');
    await cookOffers(gameID, sourceBranch);

    console.log('Cooking entities...');
    // await cookEntities(gameID, sourceBranch)
    console.log('Entities cooked')
    console.log('-------END COOKING CONTENT-------');


  } catch (error) {
    console.error("Error cooking content:", error);
  }
}
async function cookAnalyticsEvents(gameID, branch) {
  const config = await getAllAnalyticsEventsv2(gameID, branch);
  const cookedConfig = config.map((event, i) => {
    return {
      id: event.eventID,
      codename: event.eventCodeName,
      values: event.values.map((v) => {
        return {
          name: v.valueName,
          format: v.valueFormat,
          method: v.valueCountMethod,
        };
      }),
    };
  });
  await insertData("analytics", cookedConfig);
  const result = await getData("strix-eu", "analytics");
}
async function cookOffers(gameID, branch) {
  const localizationTable = await getLocalization(gameID, branch, "offers");
  const pricingTable = await getPricing(gameID, branch);
  const config = await getOffers(gameID, branch);
  const abtests = await getABTests(gameID, branch);
  const associatedSKUs = await getAssociatedSKUs(gameID, 'production');

  // Before we process any offers, we need to make copies of the ones that are in AB tests
  if (abtests.success && abtests.abTests.length > 0) {
    let tests = abtests.abTests;
    tests = tests.filter((t) => {
      if (t.archived === true) return false;
      if (t.startDate === "") return false;
      if (t.paused === true) return false;
      return true;
    });

    if (tests.length > 0) {
      const additiveOffers = tests
        .map((test) => {
          let t = { ...test };
          t.subject = JSON.parse(t.subject);

          if (!t.subject) return null;

          let testedOffer = config.find((o) => o.offerID === t.subject.itemID);
          if (!testedOffer) return null;

          if (t.subject.icon) {
            testedOffer.offerIcon = t.subject.icon;
          }
          if (t.subject.content) {
            testedOffer.content = t.subject.content;
          }
          if (t.subject.price) {
            testedOffer.offerPrice = t.subject.price;
          }

          testedOffer.offerID = testedOffer.offerID + "|" + t.id;
        })
        .filter(Boolean);

      if (additiveOffers.length > 0) {
        config.push(...additiveOffers);
      }
    }
  }

  let cookedConfig = config.map((offer, i) => {
    return {
      id: offer.offerID,
      name: offer.offerInGameName,
      desc: offer.offerInGameDescription,
      icon: offer.offerIcon,
      codename: offer.offerCodeName,
      purchaseLimit: offer.offerPurchaseLimit,
      duration: offer.offerDuration,
      segments: offer.offerSegments,
      triggers: offer.offerTriggers,
      content: offer.content,
      pricing: offer.offerPrice,
      asku: associatedSKUs.find((sku) => sku.offerID === offer.offerID)?.sku,
    };
  });

  // Giving each offer pricing
  cookedConfig.forEach((offer, i) => {

    // Setting offer pricing
    if (offer.pricing.targetCurrency === "money") {
      if (Array.isArray(pricingTable) && pricingTable.length > 0) {
        // Applying pricing to the offer

        // Checking if offer has it's own pricing
        let offerPricing = currencies
          .map((curr, j) => {
            const offerCurr = offer.pricing.moneyCurr.find(
              (c) => c.cur === curr.code
            );
            if (offerCurr) {
              // Offer pricing is #1 priority
              return {
                cur: offerCurr.cur,
                amount: offerCurr.amount,
              };
            } else {
              // If there is no such currency in offer, try to auto calculate it
              // based on the pricing table
              const tableCurr = pricingTable.find((c) => c.code === curr.code);
              if (tableCurr) {
                return {
                  cur: tableCurr.code,
                  amount: scaleCurrencyToPricingTable(offer, curr.code),
                };
              } else {
                // If no such currency in pricing table, return null
                return null;
              }
            }

            // Cleanup possible "nulls"
          })
          .filter(Boolean);

        offer.pricing.moneyCurr = offerPricing;
      }
    }
  });

  function scaleCurrencyToPricingTable(offer, code) {
    try {
      let defaultCurrencyAmount = offer.pricing.moneyCurr.find(
        (c) => c.cur === "USD"
      )?.amount;

      if (defaultCurrencyAmount === 0) {
        return 0;
      }

      let baseCurrencyValue = pricingTable.find((c) => c.code === "USD")?.base;
      let targetCurrencyValue = pricingTable.find((c) => c.code === code)?.base;
      let diff = (targetCurrencyValue - baseCurrencyValue) / baseCurrencyValue;

      let resultScaledBase =
        diff * defaultCurrencyAmount + defaultCurrencyAmount;
      if (isNaN(resultScaledBase)) {
        return 0;
      } else {
        resultScaledBase = parseFloat(resultScaledBase.toFixed(2));
      }
      return resultScaledBase;
    } catch (error) {
      return 0;
    }
  }

  // Harvesting offers that are intended to be actual IAPs for a real money purchase
  const realMoneyOffers = cookedConfig
    .filter(
      (o) =>
        // Keeping only the offers that have money pricing & the base currency isn't 0
        o.pricing.targetCurrency === "money" &&
        o.pricing.moneyCurr[0].amount > 0
    )
    .map((o) => {
      let temp = { ...o };

      // Setting offer localization
      const oName = localizationTable.find((l) => l.sid === temp.name);
      const oDesc = localizationTable.find((l) => l.sid === temp.desc);
      if (oName) {
        temp.name = oName.translations;
      } else {
        temp.name = [];
      }

      if (oDesc) {
        temp.desc = oDesc.translations;
      } else {
        temp.desc = [];
      }

      // Destroying currencies with 0 value amount, otherwise google play won't accept it
      temp.pricing.moneyCurr = temp.pricing.moneyCurr
        .map((c) => {
          if (c.amount === 0) return null;

          // Apply discount
          if (temp.pricing.discount && temp.pricing.discount > 0) {
            c.amount = c.amount * (1 - temp.pricing.discount / 100);
          }

          return c;
        })
        .filter(Boolean);
      return temp;
    });

  // Syncing with Google Play IAPs
  await uploadIapConfig(gameID, realMoneyOffers);

  // Uploading all offers to the DB
  //   insertData("offers", cookedConfig);
}
async function cookEntities(gameID, branch) {
  const localizationTable = await getLocalization(gameID, branch, "entities");
  let dataTree = await getNodeTree(gameID, branch, "entity");
  dataTree = dataTree[0];
  let config = await getPlanningNodes(gameID, branch, "entity");

  let cookedConfig = [];

  config.forEach((entity, i) => {
    let result = buildEntityConfig(entity);
    if (result !== null) {
      cookedConfig.push(result);
      console.log(result);
    }
  });

  function buildEntityConfig(e) {
    if (e.nodeID === "Root") {
      return null;
    }

    // Isolating the values we need, and putting entityCategory/entityBasic as "specifis" fields
    // We will remove it later
    let result = {
      nodeID: e.nodeID,
      specifics: e.entityCategory ? e.entityCategory : e.entityBasic,
    };

    // Continuing to populate values from "specific" field
    result = {
      ...result,
      isCurrency: result.specifics.isCurrency
        ? result.specifics.isCurrency
        : false,
      isInAppPurchase: result.specifics.isInAppPurchase
        ? result.specifics.isInAppPurchase
        : false,
      entityID: result.specifics.entityID
        ? result.specifics.entityID
        : result.specifics.categoryID,
      parent: result.specifics.parentCategory,
    };

    // Merging inherited configs of the given entity with configs of it's parents
    if (result.parent === "") {
      result.config = result.specifics.mainConfig;
    } else {
      const overrideConfigs =
        result.specifics.inheritedConfigs !== ""
          ? JSON.parse(result.specifics.inheritedConfigs)
          : [];
      const parentCategory = result.parent;

      let inheritedConfigs = [];
      let tempInheritedCategories = [];
      function gatherInheritedConfigs(_id) {
        // We do _id search instead of nodeID in case we would want to have same multiple nodes in tree, and
        // their nodeID would be the same, but different _id
        const nodeInTree = findNodeInTreeByID(dataTree, _id);

        // If we couldn't find node in tree, we can't gather inherited configs, therefore we return
        if (nodeInTree === null) return;

        const nodeInData = config.find((node) => node.nodeID === nodeInTree.ID);
        tempInheritedCategories.push(nodeInData.nodeID);
        inheritedConfigs.push({
          nodeID: nodeInData.nodeID,
          configs:
            nodeInData.entityCategory.mainConfigs !== ""
              ? JSON.parse(nodeInData.entityCategory.mainConfigs)
              : [],
          inheritedConfigs:
            nodeInData.entityCategory.inheritedConfigs !== ""
              ? JSON.parse(nodeInData.entityCategory.inheritedConfigs)
              : [],
        });

        // If the category we found has another parent category, we need to gather inherited configs from it too.
        // And do it recursively until there is no parent category (should be the root)
        if (
          nodeInData.entityCategory.parentCategory &&
          nodeInData.entityCategory.parentCategory !== ""
        ) {
          gatherInheritedConfigs(nodeInData.entityCategory.parentCategory);
        }
      }
      function findValueInConfig(configs, configID, sid) {
        let values = configs.find((config) => config.id === configID);
        if (values !== undefined) {
          values = values.values;
        } else {
          return undefined;
        }
        // console.log('CONFIG: ', configs, 'Trying to find value with sid', sid, 'in values', values)
        function cycleValues(values) {
          for (let value of values) {
            // console.log('CONFIG: ', configID, 'Iterating value', value, 'to find value with sid', sid);
            if (value.sid === sid) {
              // console.log('CONFIG: ', configID, 'Found value with sid', sid, 'in value', value);
              return value.segments;
            }
            if (value.values !== undefined) {
              let result = cycleValues(value.values);
              if (result !== null) {
                return result;
              }
            }
          }
          return null;
        }
        const result = cycleValues(values);
        return result;
      }

      // Here we merge original configs from nodes with their overrides from entities below,
      // so the changed values replace the original ones & we get the final overall config.
      let defConfig = [];
      function resolveInheritance(configs) {
        // Reverse, because we want to go from Root to the most specific category.
        // Going "Non-reversed" way, we would get wrong overrides, so we never want to do that.
        let reversedNodeConfigs = [...configs];
        reversedNodeConfigs.reverse();

        // console.log('Reversed node configs:', JSON.parse(JSON.stringify(reversedNodeConfigs)))

        reversedNodeConfigs.forEach((config) => {
          // Iterating through all current configs
          if (config) {
            // Checking if there is any override configs on this entity
            if (config.inheritedConfigs !== "") {
              // If any override configs are present, do the override to the original configs
              //
              // The logic behind this as we want to override only the values that are present in the original configs.
              // Otherwise we would desync both configs, as inheritedConfig would have already-non-existent values, and
              // they could be appended to the original config, which we never want to happen.
              //
              config.inheritedConfigs.forEach((overrideConfig) => {
                if (overrideConfig.configs !== "") {
                  // Iterating through all configs on this entity
                  let targetConfig = reversedNodeConfigs.find(
                    (item) => item.nodeID === overrideConfig.nodeID
                  );

                  // console.log('Target config', JSON.parse(JSON.stringify(targetConfig), 'override config', JSON.parse(JSON.stringify(overrideConfig))))

                  targetConfig.configs.map((conf) => {
                    // Iterating through all values on this config
                    conf.values = conf.values.map((value) => {
                      // console.log('CONFIG: ', conf.name, 'Iterating through value', value)
                      const overrideValueSegments = findValueInConfig(
                        overrideConfig.configs,
                        conf.id,
                        value.sid
                      );
                      // console.log('CONFIG: ', conf.name, 'Got value from override:', overrideValueSegments)
                      if (
                        !value.values &&
                        overrideValueSegments !== null &&
                        overrideValueSegments !== undefined &&
                        overrideValueSegments.length > 0
                      ) {
                        // Merge value so that the original untouched values are kept, but the changed ones are overridden
                        value.segments = Object.assign(
                          value.segments,
                          overrideValueSegments
                        );
                      }
                      if (value.values) {
                        value.values = value.values.map((subVal) => {
                          // console.log('CONFIG: ', conf.name, 'Iterating through subvalue', subVal)
                          const overrideSubValueSegments = findValueInConfig(
                            overrideConfig.configs,
                            conf.id,
                            subVal.sid
                          );
                          // console.log('CONFIG: ', conf.name, 'Got value from override:', overrideSubValueSegments)
                          if (
                            overrideSubValueSegments !== null &&
                            overrideSubValueSegments !== undefined &&
                            overrideSubValueSegments.length > 0
                          ) {
                            // Merge value so that the original untouched values are kept, but the changed ones are overridden
                            value.segments = Object.assign(
                              subVal.segments,
                              overrideSubValueSegments
                            );
                          }
                          return subVal;
                        });
                      }
                      // console.log('CONFIG: ', conf.name, 'RESULT VALUE AFTER ITERATING:', value)
                      return value;
                    });

                    // console.log('CONFIG: ', conf.name, 'RESULT CONFIG AFTER ITERATING:', conf, 'AT TARGETCONFIG:', targetConfig.configs)

                    return conf;
                  });
                  // console.log('Pre-result', JSON.parse(JSON.stringify(targetConfig.configs)))

                  let targetIndex = reversedNodeConfigs.findIndex(
                    (item) => item.nodeID === overrideConfig.nodeID
                  );
                  reversedNodeConfigs[targetIndex].configs = Object.assign(
                    reversedNodeConfigs[targetIndex].configs,
                    targetConfig.configs
                  );

                  // console.log('Result', reversedNodeConfigs[targetIndex].configs)
                }
              });
            }
          }
        });
        let tempOverrideConfigs = [...overrideConfigs];
        if (!tempOverrideConfigs) {
          tempOverrideConfigs =
            e.specifics.inheritedConfigs !== ""
              ? JSON.parse(e.specifics.inheritedConfigs)
              : [];
        }

        defConfig = JSON.parse(JSON.stringify(reversedNodeConfigs.reverse()));

        // Now we finally apply the inheritedConfigs of this exact current entity to all parents we can
        if (tempOverrideConfigs !== "") {
          tempOverrideConfigs.forEach((overrideConfig) => {
            if (
              overrideConfig.configs !== "" &&
              overrideConfig.configs.length > 0
            ) {
              // Iterating through all configs on this entity
              let targetConfig = reversedNodeConfigs.find(
                (item) => item.nodeID === overrideConfig.nodeID
              );

              if (targetConfig === undefined) {
                console.log(
                  "No target config found for",
                  overrideConfig.nodeID
                );
                return;
              }

              targetConfig.configs.map((conf) => {
                // Iterating through all values on this config
                conf.values = conf.values.map((value) => {
                  // console.log('CONFIG: ', conf, conf.name, 'Iterating through value', value, overrideConfig.configs, conf.id)
                  const overrideValueSegments = findValueInConfig(
                    overrideConfig.configs,
                    conf.id,
                    value.sid
                  );
                  // console.log('CONFIG: ', conf.name, 'Got value from override:', overrideValueSegments)
                  if (
                    !value.values &&
                    overrideValueSegments !== null &&
                    overrideValueSegments !== undefined
                  ) {
                    // Merge value so that the original untouched values are kept, but the changed ones are overridden
                    value.segments = Object.assign(
                      value.segments,
                      overrideValueSegments
                    );
                  }
                  if (value.values) {
                    value.values = value.values.map((subVal) => {
                      // console.log('CONFIG: ', conf.name, 'Iterating through subvalue', subVal)
                      const overrideSubValueSegments = findValueInConfig(
                        overrideConfig.configs,
                        conf.id,
                        subVal.sid
                      );
                      // console.log('CONFIG: ', conf.name, 'Got value from override:', overrideSubValueSegments)
                      if (
                        overrideSubValueSegments !== null &&
                        overrideSubValueSegments !== undefined
                      ) {
                        // Merge value so that the original untouched values are kept, but the changed ones are overridden
                        value.segments = Object.assign(
                          subVal.segments,
                          overrideSubValueSegments
                        );
                      }
                      return subVal;
                    });
                  }
                  // console.log('CONFIG: ', conf.name, 'RESULT VALUE AFTER ITERATING:', value)
                  return value;
                });
                // console.log('CONFIG: ', conf.name, 'RESULT CONFIG AFTER ITERATING:', conf, 'AT TARGETCONFIG:', targetConfig.configs)

                return conf;
              });
              // console.log('Pre-result', JSON.parse(JSON.stringify(targetConfig.configs)))

              let targetIndex = reversedNodeConfigs.findIndex(
                (item) => item.nodeID === overrideConfig.nodeID
              );
              reversedNodeConfigs[targetIndex].configs = Object.assign(
                reversedNodeConfigs[targetIndex].configs,
                targetConfig.configs
              );

              // console.log('Result', reversedNodeConfigs[targetIndex].configs)
            }
          });
        }

        // console.log('Resolving inheritance:', reversedNodeConfigs)

        return reversedNodeConfigs.reverse();
      }

      gatherInheritedConfigs(parentCategory);

      result.inheritedCategories = tempInheritedCategories;
      result.config = JSON.parse(result.specifics.mainConfigs);

      if (inheritedConfigs.length > 0) {
        inheritedConfigs = resolveInheritance(inheritedConfigs);

        // Making the unified config. It must be plain array containing all configs
        inheritedConfigs.forEach((i) => {
          result.config = [...result.config, ...i.configs];
        });
      }
    }

    delete result.specifics;
    return result;
  }
}

function findNodeInTreeByID(node, targetNodeID) {
  if (node._id.toString() === targetNodeID) {
    return node;
  }
  for (const subnode of node.Subnodes) {
    const result = findNodeInTreeByID(subnode, targetNodeID);
    if (result) {
      return result;
    }
  }
  return null;
}
