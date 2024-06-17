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
import { currencies } from "./shared/currencies.js";
import { regions } from "./shared/regions.js";

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
        // console.log('Node Model:', nodeModel.branches.find(b => b.branch === sourceBranch).planningTypes);
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

        // 
        // AB tests
        // 
        console.log('Moving ab tests...');
        const abtests = await ABTests.findOne(
            { 
                gameID: gameID
            },
            { 
                branches: { $elemMatch: { branch: sourceBranch } }, _id: 0 
            }
        ).lean();
        await ABTests.findOneAndUpdate(
            {
              gameID: gameID,
              branches: { $elemMatch: { branch: targetBranch } }
            },
            {
              $set: {
                'branches.$.tests': abtests.branches.find(b => b.branch === sourceBranch).tests,
              }
            },
            {
                new: true,
                upsert: true,
            }
        );
        console.log('Done moving ab tests');
        console.log('-------END MOVING DB CONTENT-------');
    }
    await pushChanges();


    try {
        console.log('-------START COOKING CONTENT-------');


        console.log('Cooking events...');
        await cookAnalyticsEvents(gameID, sourceBranch)
        console.log('Events cooked');

        console.log('Cooking offers...');
        await cookOffers(gameID, sourceBranch);
        console.log('Offers cooked');
    
        console.log('Cooking entities...');
        await cookEntities(gameID, sourceBranch)
        console.log('Entities cooked')

        console.log('Cooking AB tests...');
        await cookABTests(gameID, sourceBranch)
        console.log('AB tests cooked');

        console.log('Cooking PW templates...');
        await cookPWTemplates(gameID, sourceBranch)
        console.log('PW templates cooked');


        console.log('-------END COOKING CONTENT-------');
    } catch (error) {
       throw error;
    }

  } catch (error) {
    console.error("Error cooking content:", error);
    throw error;
  }
}
async function cookPWTemplates(gameID, branch) {
  const config = await getWarehouseTemplates(gameID, branch);

  let cookedConfig = config.statistics.map((t) => {
    const ranges = {
      rangeMin: t.templateValueRangeMin,
      rangeMax: t.templateValueRangeMax,
    }
    const rangesValid = 
    (ranges.rangeMin && ranges.rangeMin !== '') 
    && 
    (ranges.rangeMax && ranges.rangeMax !== '')

    return {
      id: t.templateID,
      codename: t.templateCodeName,
      type: t.templateType,
      defaultValue: t.templateDefaultValue,
      ...rangesValid && rangesValid,
    }
  })

  // Uploading all offers to the DB
  insertData("stattemplates", cookedConfig);
  return {success: true}
}
async function cookABTests(gameID, branch) {
  const config = await getABTests(gameID, branch);

  if (config.abTests.length === 0) return {success: true}

  let cookedConfig = config.abTests.map((test, i) => {
    let tempSubj = JSON.parse(test.subject)
    return {
      id: test.id,
      codename: test.codename,
      segments: JSON.parse(test.segments),
      observedMetric: JSON.parse(test.observedMetric),
      subject: {
        type: tempSubj.type,
        itemID: tempSubj.itemID,
      },
    }
  })
  
  // Uploading all offers to the DB
  insertData("abtests", cookedConfig);
  return {success: true}
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

          if (t.subject.changedFields.icon) {
            testedOffer.offerIcon = t.subject.changedFields.icon;
          }
          if (t.subject.changedFields.content) {
            testedOffer.content = t.subject.changedFields.content;
          }
          if (t.subject.changedFields.price) {
            testedOffer.offerPrice = t.subject.changedFields.price;
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
    let asku = associatedSKUs.find((sku) => sku.offerID === offer.offerID)?.sku;
    if (!asku || asku === "") {
      asku = generateASKU(gameID, offer.offerID);
    }

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
      asku: asku,
    };
  });
  

  // Giving each offer pricing
  cookedConfig.forEach((offer, i) => {

    // Setting offer pricing
    if (offer.pricing.targetCurrency === "money") {
      if (Array.isArray(pricingTable.regions) && pricingTable.regions.length > 0) {
        // Applying pricing to the offer

        // Checking if offer has it's own pricing and applying what it has
        let offerPricing = offer.pricing.moneyCurr.map((curr) => {

            // console.log('Iterating currency: ', curr)

            // Getting all regions using that currency
            const currencyRegions = getCurrencyCountries(curr.cur)
            // console.log('Currency regions: ', currencyRegions)

            // Getting the default currency amount from pricing table
            const defaultCurrencyPrice = pricingTable.currencies.find(c => c.code === curr.cur).base
            // console.log('Default currency amount: ', defaultCurrencyPrice)

            // Getting regional pricing from the table
            const tableRegionalPrices = pricingTable.regions.filter(region => currencyRegions.map(r => r.code).includes(region.code))
            // console.log('Table regional prices: ', tableRegionalPrices)

            const discount = offer.pricing.moneyCurr.discount

            // Making combined regional pricing by iterating through all regions
            // and seeking any changes in the pricing table for them
            // and also applying difference calculations
            // console.log('Offer curr amount:', curr.amount)
            const regionalPrices = currencyRegions.map(r => {

                const pricingTableValue = tableRegionalPrices.find(tr => tr.code === r.code)?.base

                if (pricingTableValue) {
                    // If we have any pricing for this region in particular in pricing table, scale & use it
                    const defaultDifference = Math.abs(parseFloat(pricingTableValue) / parseFloat(defaultCurrencyPrice));
                    let resultPrice = 0
                    if (defaultDifference !== 0) {
                        resultPrice = defaultDifference * curr.amount;
                    } else {
                        resultPrice = curr.amount;
                    }
                    // console.log('Difference for region ', r.code, 'is', defaultDifference, 'from', pricingTableValue, 'and', defaultCurrencyPrice, 'Result price:', resultPrice)
                    if (discount && discount !== 0) {
                        resultPrice = resultPrice - (resultPrice * discount / 100)
                    }
                    return {
                        region: r.code,
                        value: resultPrice,
                        currency: r.currency,
                    }
                } else {
                    // If we dont have any pricing for this region, make it's price a currency value instead
                    let resultPrice = curr.amount
                    if (discount && discount !== 0) {
                        resultPrice = resultPrice - (resultPrice * discount / 100)
                    }
                    return {
                        region: r.code,
                        value: resultPrice,
                        currency: r.currency,
                    }
                }
            })
            return regionalPrices;
        })
        offerPricing = offerPricing.flat();

        // Filling missing regional pricing
        const arrayOfRegions = Object.keys(regions).map(r => ({code: r, ...regions[r]}))
        // console.log(arrayOfRegions)
        offerPricing = offerPricing.concat(
            arrayOfRegions
            .filter(region => offerPricing.map(p => p.region).includes(region.code) === false)
            .map(r => {
                // Getting the default currency amount from pricing table
                if (!offer.pricing.moneyCurr[0]) return null
                const defaultCurrencyPrice = pricingTable.currencies.find(c => c.code === offer.pricing.moneyCurr[0].cur).base
                // Getting the localized price (of any currency) from table
                const regionalPrice = pricingTable.regions.find(tr => tr.code === r.code)?.base
                if (regionalPrice === undefined) return null

                const discount = offer.pricing.moneyCurr.discount
                
                // Finding the multiplicator we need to apply to the regional price for it to match the scale
                const defaultDifference = Math.abs(parseFloat(regionalPrice) / parseFloat(defaultCurrencyPrice));
                let scaledPrice = defaultDifference * offer.pricing.moneyCurr[0].amount
                if (discount && discount !== 0) {
                    scaledPrice = scaledPrice - (scaledPrice * discount / 100)
                }
                // console.log('--------------------------------------------------------')
                // console.log('Missing price for region', r.name, r.code, r.currency)
                // console.log('def price:', defaultCurrencyPrice, 'regional:', regionalPrice, 'diff:', defaultDifference, 'offer:', offer.pricing.moneyCurr[0].amount, 'Result:', scaledPrice)
                // console.log('--------------------------------------------------------')
                return {
                    region: r.code,
                    value: scaledPrice,
                    currency: r.currency,
                }
            }).filter(Boolean)
        )

        offer.pricing.moneyCurr = offerPricing;
      }
    }
  });

  function getCurrencyCountries(code) {
    let array = []
    for (const r of Object.keys(regions)) {
      if (regions[r].currency === code) {
        array.push({code: r, ...regions[r]});
      }
    }
    return array;
  }

  // Harvesting offers that are intended to be actual IAPs for a real money purchase
  const realMoneyOffers = cookedConfig
    .filter(
      (o) =>
        // Keeping only the offers that have money pricing & the base currency isn't 0
        o.pricing.targetCurrency === "money" &&
        o.pricing.moneyCurr.some(v => v.value > 0)
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
          if (c.value === 0) return null;
          return c;
        })
        .filter(Boolean);
      return temp;
    });

  // Syncing with Google Play IAPs
  try {
    if (realMoneyOffers.length > 0) {
      await uploadIapConfig(gameID, realMoneyOffers);
    }
  } catch (error) {
    throw error;
  }

  // Uploading all offers to the DB
  insertData("offers", cookedConfig);
  return {success: true}
}
async function cookEntities(gameID, branch) {
  const localizationTable = await getLocalization(gameID, branch, "entities");
  let dataTree = await getNodeTree(gameID, branch, "entity");
  dataTree = dataTree[0];
  let config = await getPlanningNodes(gameID, branch, "entity");

  let cookedConfig = [];

  config.forEach((entity, i) => {
    let result = buildEntityConfig(entity);
    console.log('Building config for entity', entity)
    if (result !== null) {
      cookedConfig.push(result);
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
      result.config = result.specifics.mainConfigs !== '' ? JSON.parse(result.specifics.mainConfigs) : [];

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
