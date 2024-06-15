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

export async function getRandomDataForABTest(
  gameID,
  branchName,
  filterDate,
  testID
) {
  const endDate = new Date(filterDate[1]);
  const startDate = new Date(filterDate[0]);
  startDate.setUTCHours(0, 0, 0, 0);
  endDate.setUTCHours(23, 59, 59, 999);

  let randStart_controlSamples = randomNumberInRange(1000, 10000);
  const controlDeviation = randomNumberInRange(0.025, 0.04, true);
  let randStart_control = parseInt(randStart_controlSamples * controlDeviation);

  let randStart_testSamples = randomNumberInRange(100, 1000);
  const testDeviation =
    parseFloat(controlDeviation) +
    parseFloat(randomNumberInRange(-0.01, 0.01, true));
  let randStart_test = parseInt(randStart_testSamples * testDeviation);

  console.log("Generating control results", randStart_control);
  let generatedData = await generateRandomDataByDaysNonLinear(
    startDate,
    endDate,
    randStart_control,
    randStart_control,
    0.2,
    0.5,
    0,
    "timestamp",
    "control"
  );

  console.log("Generating test results", randStart_test);
  let generatedData_test = await generateRandomDataByDaysNonLinear(
    startDate,
    endDate,
    randStart_test,
    randStart_test,
    0.2,
    0.5,
    0,
    "timestamp",
    "test"
  );

  console.log("Generating control samples", randStart_controlSamples);
  let generatedData_controlSamples = await generateRandomDataByDaysNonLinear(
    startDate,
    endDate,
    randStart_controlSamples,
    randStart_controlSamples,
    0.2,
    0.5,
    0,
    "timestamp",
    "controlSamples"
  );

  console.log("Generating test samples", randStart_testSamples);
  let generatedData_testSamples = await generateRandomDataByDaysNonLinear(
    startDate,
    endDate,
    randStart_testSamples,
    randStart_testSamples,
    0.2,
    0.5,
    0,
    "timestamp",
    "testSamples"
  );

  generatedData = generatedData.map((item, index) => {
    let tempItem = item;
    item.test = generatedData_test[index].test;
    item.controlSamples = generatedData_controlSamples[index].controlSamples;
    item.testSamples = generatedData_testSamples[index].testSamples;
    return tempItem;
  });

  function calculatePValue(
    controlSuccesses,
    controlTrials,
    testSuccesses,
    testTrials
  ) {
    const p1 = controlSuccesses / controlTrials;
    const p2 = testSuccesses / testTrials;
    const p = (controlSuccesses + testSuccesses) / (controlTrials + testTrials);
    const z =
      (p1 - p2) / Math.sqrt(p * (1 - p) * (1 / controlTrials + 1 / testTrials));
    const pValue = 2 * (1 - jStat.normal.cdf(Math.abs(z), 0, 1));
    return { pValue, zScore: z };
  }

  // Loop through the player data array and update p-value values
  for (let i = 0; i < generatedData.length; i++) {
    const currentDate = new Date(generatedData[i].timestamp);
    const currentControl = generatedData[i].control;
    const currentTest = generatedData[i].test;
    const currentControlSamples = generatedData[i].controlSamples;
    const currentTestSamples = generatedData[i].testSamples;

    // Calculate p-value based on data for the current and previous days
    const res = calculatePValue(
      currentControl,
      currentControlSamples,
      currentTest,
      currentTestSamples
    );
    // Update the p-value value in the array element
    generatedData[i].pvalue = res.pValue;
    generatedData[i].zScore = res.zScore;
  }

  generatedData = generatedData.map((item, index) => {
    let tempItem = item;
    item.control = item.control / item.controlSamples;
    item.test = item.test / item.testSamples;
    return tempItem;
  });

  return { success: true, message: { data: generatedData } };
}
export async function getOverviewStatistics(gameIDs) {
  let endDate = new Date();
  let startDate = new Date();
  startDate.setDate(startDate.getDate() - 6);

  startDate.setUTCHours(0, 0, 0, 0);
  endDate.setUTCHours(23, 59, 59, 999);

  const dateDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);

  let overallData = [];
  for (let i = 0; i <= Math.floor(dateDiff); i++) {
    overallData.push({
      timestamp: "",
      revenue: 0,
      newUsers: 0,
      retention: 0,
    });
  }

  try {
    let gamesData = await Promise.all(
      gameIDs.map(async (gameID, gameIndex) => {
        let generatedData = await generateRandomDataByDays(
          startDate,
          endDate,
          randomNumberInRange(-2000, 6000),
          randomNumberInRange(-5000, 10000),
          randomNumberInRange(-0.2, 0.2, true),
          0.5
        );
        let retentionData = NonAsyncGenerateRandomDataByDays(
          startDate,
          endDate,
          randomNumberInRange(1000, 6000),
          randomNumberInRange(1000, 10000),
          randomNumberInRange(-0.6, -0.87, true),
          0
        );

        generatedData = generatedData.map((item) => ({
          timestamp: item.timestamp,
          users: (item.value * randomNumberInRange(1.2, 2, true)).toFixed(0),
          revenue: item.value,
        }));
        generatedData = {
          gameID: gameID,
          deltaDau: arraySum(
            generatedData.map((item) => parseFloat(item.users))
          ).toFixed(0),
          deltaRevenue: arraySum(
            generatedData.map((item) => parseFloat(item.revenue))
          ).toFixed(0),

          data: generatedData.map((item, i) => {
            let dataObj = {
              dau: {
                timestamp: item.timestamp,
                value: parseInt(item.users),
              },

              newUsers: {
                timestamp: item.timestamp,
                value: parseInt(item.users),
              },

              retention: {
                timestamp: item.timestamp,
                value: retentionData[i].value,
              },

              revenue: {
                timestamp: item.timestamp,
                value: item.revenue,
              },
            };
            overallData[i].timestamp = dataObj.revenue.timestamp;
            overallData[i].revenue += dataObj.revenue.value;
            overallData[i].newUsers += dataObj.newUsers.value;
            overallData[i].retention += dataObj.retention.value;
            return dataObj;
          }),
        };

        return generatedData;
      })
    );

    return { success: true, data: { overall: overallData, games: gamesData } };
  } catch (error) {
    console.error(error);
    throw new Error("Internal Server Error or No Data");
  }
}

export async function getOverviewStatisticsForPublisher(studioIDs) {
  let endDate = new Date();
  let startDate = new Date();
  startDate.setDate(startDate.getDate() - 6);

  startDate.setUTCHours(0, 0, 0, 0);
  endDate.setUTCHours(23, 59, 59, 999);

  const dateDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);

  let overallData = [];
  for (let i = 0; i <= Math.floor(dateDiff); i++) {
    overallData.push({
      timestamp: "",
      revenue: 0,
      newUsers: 0,
      retention: 0,
    });
  }

  try {
    let studiosData = await Promise.all(
      studioIDs.map(async (studioID, studioIndex) => {
        let generatedData = await generateRandomDataByDays(
          startDate,
          endDate,
          randomNumberInRange(-2000, 6000),
          randomNumberInRange(-5000, 10000),
          randomNumberInRange(-0.2, 0.2, true),
          0.5
        );
        let retentionData = NonAsyncGenerateRandomDataByDays(
          startDate,
          endDate,
          randomNumberInRange(1000, 6000),
          randomNumberInRange(1000, 10000),
          randomNumberInRange(-0.6, -0.87, true),
          0
        );

        generatedData = generatedData.map((item) => ({
          timestamp: item.timestamp,
          users: (item.value * randomNumberInRange(1.2, 2, true)).toFixed(0),
          revenue: item.value,
        }));
        generatedData = {
          studioID: studioID,
          deltaDau: arraySum(
            generatedData.map((item) => parseFloat(item.users))
          ).toFixed(0),
          deltaRevenue: arraySum(
            generatedData.map((item) => parseFloat(item.revenue))
          ).toFixed(0),

          data: generatedData.map((item, i) => {
            let dataObj = {
              dau: {
                timestamp: item.timestamp,
                value: parseInt(item.users),
              },

              newUsers: {
                timestamp: item.timestamp,
                value: parseInt(item.users),
              },

              retention: {
                timestamp: item.timestamp,
                value: retentionData[i].value,
              },

              revenue: {
                timestamp: item.timestamp,
                value: item.revenue,
              },
            };
            overallData[i].timestamp = dataObj.revenue.timestamp;
            overallData[i].revenue += dataObj.revenue.value;
            overallData[i].newUsers += dataObj.newUsers.value;
            overallData[i].retention += dataObj.retention.value;
            return dataObj;
          }),
        };

        return generatedData;
      })
    );

    return {
      success: true,
      data: { overall: overallData, studios: studiosData },
    };
  } catch (error) {
    console.error(error);
    throw new Error("Internal Server Error or No Data");
  }
}

export async function getOfferSalesAndRevenue(
  gameID,
  branchName,
  filterDate,
  filterSegments,
  offerID
) {
  const endDate = new Date(filterDate[1]);
  const startDate = new Date(filterDate[0]);

  startDate.setUTCHours(0, 0, 0, 0);
  endDate.setUTCHours(23, 59, 59, 999);
  let deltaValue;

  try {
    let generatedData = await generateRandomDataByDays(
      startDate,
      endDate,
      80,
      400,
      0.1,
      0.05
    );
    let responseData = generatedData.map((item) => ({
      timestamp: item.timestamp,
      sales: (item.value * randomNumberInRange(1.2, 2, true)).toFixed(0),
      revenue: item.value,
    }));
    deltaValue = arraySum(responseData.map((item) => item.revenue));

    return {
      success: true,
      data: { responseData, granularity: "day", deltaValue },
    };
  } catch (error) {
    console.error(error);
    throw new Error("Internal Server Error or No Data");
  }
}
export async function getOfferAnalytics(gameID, branchName, offerID) {
  try {
    let fetchedAvgProfile1 = await generateAvgProfile({
      gameID,
      branchName,
      filterSegments: [],
      skipSubprofiles: true,
      salesCount: 9821,
    });
    let fetchedAvgProfile2 = await generateAvgProfile({
      gameID,
      branchName,
      filterSegments: [],
      salesCount: 9821,
    });

    const responseData = {
      revenue: 1346200,
      revenuePositive: true,
      declinerate: 27,
      declineratePositive: false,
      salesTotal: 9821,
      salesTotalPositive: true,
      impressions: 121021,
      impressionsPositive: true,
      avgProfile: fetchedAvgProfile1,
      profile: fetchedAvgProfile2,
      sales: [
        {
          date: "2023-01-01",
          sales: 400,
          revenue: 345,
        },
      ],
      behTree: [
        {
          name: "This offer",
          type: "iap",
          share: 100,
          subEvents: [
            {
              name: "Level 4: Success",
              type: "gameplay",
              share: 23,
              subEvents: [
                {
                  name: "User Registration",
                  type: "registration",
                  share: 6,
                },
                {
                  name: "Item Purchased",
                  type: "purchase",
                  share: 4,
                },
                {
                  name: "Tutorial Completed",
                  type: "tutorial",
                  share: 2,
                },
                {
                  name: "Daily Login",
                  type: "login",
                  share: 1,
                },
              ],
            },
            {
              name: "Game Store open",
              type: "ui",
              share: 15,
              subEvents: [
                {
                  name: "User Registration",
                  type: "registration",
                  share: 3,
                },
                {
                  name: "Item Purchased",
                  type: "purchase",
                  share: 2,
                },
                {
                  name: "Tutorial Completed",
                  type: "tutorial",
                  share: 1,
                },
                {
                  name: "Daily Login",
                  type: "login",
                  share: 1,
                },
              ],
            },
            {
              name: "Battle pass open",
              type: "ui",
              share: 5,
              subEvents: [
                {
                  name: "User Registration",
                  type: "registration",
                  share: 1,
                },
                {
                  name: "Item Purchased",
                  type: "purchase",
                  share: 1,
                },
                {
                  name: "Tutorial Completed",
                  type: "tutorial",
                  share: 0,
                },
                {
                  name: "Daily Login",
                  type: "login",
                  share: 0,
                },
              ],
            },
          ],
        },
      ],
    };

    return { success: true, analytics: responseData };
  } catch (error) {
    console.error(error);
    throw new Error("Internal Server Error or No Data");
  }
}
export async function getActiveSessions(
  gameID,
  branchName,
  filterDate,
  filterSegments
) {
  try {
    const endDate = new Date(filterDate[1]);
    const startDate = new Date(filterDate[0]);

    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(23, 59, 59, 999);

    // Get difference between dates in milliseconds
    const dateDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);

    // Getting date for delta response, so if we get a query for "today" data, we get it and delta between today and yesterday.
    // If we get a data for this month, we will get delta for the previous month.
    const deltaEndDate = new Date(startDate);
    deltaEndDate.setDate(startDate.getDate() - 1);

    const deltaStartDate = new Date(startDate);
    deltaStartDate.setDate(startDate.getDate() - (dateDiff + 1));

    deltaStartDate.setUTCHours(0, 0, 0, 0);
    deltaEndDate.setUTCHours(23, 59, 59, 999);

    const deltaDateDiff =
      (deltaEndDate - deltaStartDate) / (1000 * 60 * 60 * 24);

    let clientIDs = [];

    if (filterSegments && filterSegments.length !== 0) {
      clientIDs = await getPlayersFromSegment(
        gameID,
        branchName,
        filterSegments
      );
    }
    // const deltaResponse = await druidLib.getActiveSessions(gameID, branchName, deltaStartDate, deltaEndDate, deltaDateDiff, clientIDs)
    // const response = await druidLib.getActiveSessions(gameID, branchName, startDate, endDate, dateDiff, clientIDs)

    // const deltaValue = calculateDelta(deltaResponse, response)

    const responseData = [
      {
        timestamp: "2023-12-19T10:00:00.000Z",
        value: 2,
      },
      {
        timestamp: "2023-12-20T10:00:00.000Z",
        value: 10,
      },
      {
        timestamp: "2023-12-21T10:00:00.000Z",
        value: 25,
      },
    ];

    return {
      success: true,
      data: responseData,
      granularity: "day",
      deltaValue: 25,
    };
    // if (response.success) {
    //   return { success: true, data: response.data, granularity: response.granularity, deltaValue: deltaValue };
    // } else {
    //   throw new Error('Internal Server Error or No Data');
    // }
  } catch (error) {
    console.error(error);
    throw new Error("Internal Server Error or No Data");
  }
}
export async function getMainPaymentConversionFunnel(
  gameID,
  branch,
  filterDate,
  filterSegments
) {
  try {
    let randPayments = randomNumberInRange(1, 23);
    let responseData = await generateRandomDataByNumber(
      1,
      randPayments,
      4000,
      10000,
      -0.5,
      0,
      0,
      "payment",
      "players"
    );
    responseData = responseData.map((item) => ({
      ...item,
      meanPayment: randomNumberInRange(1, 15, true),
      meanDaysToConvert: randomNumberInRange(1, 5),
      revenue: randomNumberInRange(1000, 10000),
      sales: randomNumberInRange(1000, 10000),
    }));
    return { success: true, responseData };
  } catch (error) {
    console.error(error);
    throw new Error("Internal Server Error");
  }
}
export async function getPaymentConversion(
  gameID,
  branchName,
  filterDate,
  filterSegments
) {
  try {
    let sales = randomNumberInRange(1000, 10000);
    let fetchedAvgProfile = await generateAvgProfile({
      gameID,
      branchName,
      filterSegments,
      salesCount: sales,
    });

    let randPayments = randomNumberInRange(1, 23);
    let responseData = await generateRandomDataByNumber(
      1,
      randPayments,
      4000,
      10000,
      -0.5,
      0,
      0,
      "payment",
      "players"
    );
    responseData = responseData.map((item) => ({
      ...item,
      meanPayment: randomNumberInRange(1, 15, true),
      meanDaysToConvert: randomNumberInRange(1, 5),
      revenue: randomNumberInRange(1000, 10000),
      sales: sales,
      avgProfile: fetchedAvgProfile,
    }));

    return { success: true, responseData };
  } catch (error) {
    console.error(error);
    throw new Error("Internal Server Error");
  }
}
export async function getFirstPaymentConversionTime(
  gameID,
  branch,
  filterDate,
  filterSegments
) {
  try {
    let randDays = randomNumberInRange(11, 23);
    let responseData = await generateRandomDataByNumber(
      0,
      randDays,
      4000,
      10000,
      -0.5,
      0,
      0,
      "day",
      "players"
    );

    let randDeviation = randomNumberInRange(3, 5);
    responseData[randDeviation] = {
      day: responseData[randDeviation].day,
      players:
        responseData[randDeviation].players * randomNumberInRange(1.2, 2, true),
    };

    return {
      success: true,
      message: { data: responseData, granularity: "day" },
    };
  } catch (error) {
    console.error(error);
    throw new Error("Internal Server Error");
  }
}
export async function getOffersDataTableWithProfile(
  gameID,
  branch,
  filterSegments,
  priceType
) {
  try {
    let offers = await Offers.aggregate([
      { $match: { gameID } },
      { $unwind: "$branches" },
      { $match: { "branches.branch": branch } },
      { $unwind: "$branches.offers" },
      { $replaceRoot: { newRoot: `$branches.offers` } },
      { $project: { _id: 0, offerName: 1, offerIcon: 1, offerPrice: 1 } },
    ]);

    offers = offers.filter(
      (offer) => offer.offerPrice.targetCurrency === priceType
    );

    let sales =
      priceType === "entity"
        ? randomNumberInRange(1000, 10000) * 3
        : randomNumberInRange(1000, 10000);
    let fetchedAvgProfile = await generateAvgProfile({
      gameID,
      branchName: branch,
      filterSegments,
      salesCount: sales,
    });

    offers = offers.map((offer) => {
      let temp = {
        ...offer,
        sales: sales,
        revenue:
          priceType === "entity"
            ? randomNumberInRange(1000, 10000) * 600
            : randomNumberInRange(2000, 10000),
        avgProfile: fetchedAvgProfile,
      };
      if (priceType === "entity") {
        temp.entityNodeID = offer.offerPrice.nodeID;
      }
      return temp;
    });

    return offers;
  } catch (error) {
    console.error(error);
    throw new Error("Internal Server Error");
  }
}

export async function getSourcesAndSinks(gameID, branchName, filterSegments) {
  try {
    const sources = [
      "missionReward",
      "questReward",
      "eventReward",
      "inAppPurchase",
    ];
    const sinks = [
      "itemBought",
      "itemUpgraded",
      "characterUpgraded",
      "secondLifeBought",
    ];

    let nodes = await NodeModel.find(
      { gameID, "branches.branch": branchName },
      { "branches.$": 1 }
    ).lean();
    nodes = nodes[0].branches[0].planningTypes.find(
      (t) => t.type === "entity"
    ).nodes;
    nodes = nodes
      .filter((n) => n.entityBasic && n.entityBasic.isCurrency)
      .map((n) => n.nodeID);

    function getRandomNodeID() {
      return nodes[randomNumberInRange(0, nodes.length - 1)];
    }

    let icons = await fetchEntityIcons(gameID, branchName, nodes);
    let fetchedAvgProfile = await generateAvgProfile({
      gameID,
      branchName,
      filterSegments,
      salesCount: 400,
    });

    let responseData = {
      sources: sources.map((source) => ({
        name: source,
        mean: randomNumberInRange(100, 1000),
        total: randomNumberInRange(100, 10000),
        players: randomNumberInRange(1000, 7000),
        currencyEntity: getRandomNodeID(),
        avgProfile: fetchedAvgProfile,
      })),
      sinks: sinks.map((sink) => ({
        name: sink,
        mean: randomNumberInRange(100, 1000),
        total: randomNumberInRange(100, 10000),
        players: randomNumberInRange(1000, 7000),
        currencyEntity: getRandomNodeID(),
        avgProfile: fetchedAvgProfile,
      })),
    };

    function getIconByEntityNodeID(entityNodeID) {
      let icon = icons.find((n) => n.nodeID === entityNodeID);
      return icon ? icon.icon : "";
    }

    responseData = {
      sources: responseData.sources.map((source) => ({
        ...source,
        entityIcon: getIconByEntityNodeID(source.currencyEntity),
      })),
      sinks: responseData.sinks.map((sink) => ({
        ...sink,
        entityIcon: getIconByEntityNodeID(sink.currencyEntity),
      })),
    };

    return { success: true, data: responseData };
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function getPaymentDriversOffers(gameID, branchName) {
  try {
    let offers = await Offers.aggregate([
      { $match: { gameID } },
      { $unwind: "$branches" },
      { $match: { "branches.branch": branchName } },
      { $unwind: "$branches.offers" },
      { $replaceRoot: { newRoot: `$branches.offers` } },
      {
        $project: {
          _id: 0,
          offerName: 1,
          offerIcon: 1,
          offerPrice: 1,
          content: 1,
        },
      },
    ]);

    let driverOffers = offers.filter(
      (offer) => offer.offerPrice.targetCurrency === "entity"
    );
    let driverOffersPriceEntities = driverOffers.map(
      (offer) => offer.offerPrice.nodeID
    );
    let currencyOffers = offers.filter((offer) =>
      offer.content.some((content) =>
        driverOffersPriceEntities.includes(content.nodeID)
      )
    );

    let responseData = driverOffers.map((offer) => ({ driver: offer }));
    responseData = responseData.map((item, index) => {
      return {
        ...item,
        chainedPayments: randomNumberInRange(100, 10000),
        currencyOffer: currencyOffers.find((offer) =>
          offer.content.some(
            (content) => content.nodeID === item.driver.offerPrice.nodeID
          )
        ),
      };
    });

    return {
      success: true,
      message: { data: responseData, granularity: "day" },
    };
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function getEconomyBalanceForCurrency(
  gameID,
  branchName,
  filterDate
) {
  try {
    const endDate = new Date(filterDate[1]);
    const startDate = new Date(filterDate[0]);

    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(23, 59, 59, 999);

    // Get difference between dates in milliseconds
    const dateDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);

    // Getting date for delta response, so if we get a query for "today" data, we get it and delta between today and yesterday.
    // If we get a data for this month, we will get delta for the previous month.
    const deltaEndDate = new Date(startDate);
    deltaEndDate.setDate(startDate.getDate() - 1);

    const deltaStartDate = new Date(startDate);
    deltaStartDate.setDate(startDate.getDate() - (dateDiff + 1));

    deltaStartDate.setUTCHours(0, 0, 0, 0);
    deltaEndDate.setUTCHours(23, 59, 59, 999);

    let generatedData = await generateRandomDataByDays(
      startDate,
      endDate,
      80,
      400,
      0.1,
      0.05,
      0,
      "timestamp",
      "earn"
    );

    let responseData = generatedData.map((i) => {
      return {
        timestamp: i.timestamp,
      };
    });

    responseData = responseData.map((item, index) => {
      return {
        timestamp: item.timestamp,
        currencies: [
          {
            currencyNodeID: "d366e616-8012-4290-aea8-b13cf6a0be90",
            absolute: {
              sources: [
                {
                  id: "iapBought",
                  value: randomNumberInRange(1000, 10000),
                },
                {
                  id: "levelSuccess",
                  value: randomNumberInRange(1000, 10000),
                },
                {
                  id: "itemSold",
                  value: randomNumberInRange(100000, 150000),
                },
              ],
              sinks: [
                {
                  id: "itemBought",
                  value: randomNumberInRange(-80000, -50000),
                },
              ],
            },
            perPlayer: {
              sources: [
                {
                  id: "levelSuccess",
                  value: randomNumberInRange(1000, 2000),
                },
                {
                  id: "itemSold",
                  value: randomNumberInRange(1000, 5000),
                },
              ],
              sinks: [
                {
                  id: "itemBought",
                  value: randomNumberInRange(-8000, -2000),
                },
              ],
            },
          },
          {
            currencyNodeID: "99bd2cf7-110e-4a14-b7a3-aa597e84d534",
            absolute: {
              sources: [
                {
                  id: "iapBought",
                  value: randomNumberInRange(100, 1000),
                },
                {
                  id: "levelSuccess",
                  value: randomNumberInRange(100, 1000),
                },
                {
                  id: "itemSold",
                  value: randomNumberInRange(10000, 15000),
                },
              ],
              sinks: [
                {
                  id: "itemBought",
                  value: randomNumberInRange(-8000, -5000),
                },
              ],
            },
            perPlayer: {
              sources: [
                {
                  id: "levelSuccess",
                  value: randomNumberInRange(100, 200),
                },
                {
                  id: "itemSold",
                  value: randomNumberInRange(100, 500),
                },
              ],
              sinks: [
                {
                  id: "itemBought",
                  value: randomNumberInRange(-800, -200),
                },
              ],
            },
          },
        ],
      };
    });

    return {
      success: true,
      message: { data: responseData, granularity: "day" },
    };
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function getAvgCustomerProfile(
  gameID,
  branchName,
  filterDate,
  filterSegments
) {
  try {
    const endDate = new Date(filterDate[1]);
    const startDate = new Date(filterDate[0]);

    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(23, 59, 59, 999);

    // Get difference between dates in milliseconds
    const dateDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);

    // Getting date for delta response, so if we get a query for "today" data, we get it and delta between today and yesterday.
    // If we get a data for this month, we will get delta for the previous month.
    const deltaEndDate = new Date(startDate);
    deltaEndDate.setDate(startDate.getDate() - 1);

    const deltaStartDate = new Date(startDate);
    deltaStartDate.setDate(startDate.getDate() - (dateDiff + 1));

    deltaStartDate.setUTCHours(0, 0, 0, 0);
    deltaEndDate.setUTCHours(23, 59, 59, 999);

    const deltaDateDiff =
      (deltaEndDate - deltaStartDate) / (1000 * 60 * 60 * 24);

    let clientIDs = [];

    if (filterSegments && filterSegments.length !== 0) {
      clientIDs = await getPlayersFromSegment(
        gameID,
        branchName,
        filterSegments
      );
    }

    let generatedData_ARPPU = await generateRandomDataByDays(
      startDate,
      endDate,
      0.3,
      0.6,
      0.1,
      0.05
    );
    let generatedData_Recency = await generateRandomDataByDays(
      startDate,
      endDate,
      1,
      2,
      0.1,
      0.05
    );
    let generatedData_SalesPerLife = await generateRandomDataByDays(
      startDate,
      endDate,
      2,
      4,
      0.01,
      0.05
    );
    let fetchedAvgProfile = await generateAvgProfile({
      gameID,
      branchName,
      filterSegments,
      salesCount: 1000,
    });

    const avgProfile = {
      arppu: generatedData_ARPPU,
      arecppu: generatedData_Recency,
      asppu: generatedData_SalesPerLife,
      totalSales: 1000,
      avgProfile: fetchedAvgProfile,
    };

    return { success: true, message: { data: avgProfile, granularity: "day" } };
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function getRandomDataForUniversalChart(
  gameID,
  branchName,
  filterDate,
  filterSegments,
  categoryField
) {
  try {
    const engineVersions = [
      "ue4.27",
      "ue5.23",
      "unity2019.4",
      "unity2020.3",
      "unity2021.1",
    ];
    const gameVersions = [
      "2.23.1",
      "2.23.2",
      "2.24.0",
      "2.25.0",
      "2.26.0",
      "2.27.0",
      "2.28.0",
    ];
    const platforms = [
      "windows_11",
      "windows_10",
      "macos",
      "linux",
      "android",
      "ios",
    ];
    const languages = [
      "English",
      "German",
      "French",
      "Spanish",
      "Russian",
      "Chinese",
      "Japanese",
      "Korean",
    ];
    const countries = [
      "US",
      "UK",
      "Germany",
      "France",
      "Spain",
      "Russia",
      "China",
      "Japan",
      "Korea",
    ];

    let categoryArray = [];
    switch (categoryField) {
      case "engineVersion":
        categoryArray = engineVersions;
        break;
      case "gameVersion":
        categoryArray = gameVersions;
        break;
      case "platform":
        categoryArray = platforms;
        break;
      case "language":
        categoryArray = languages;
        break;
      case "country":
        categoryArray = countries;
        break;
    }

    const endDate = new Date(filterDate[1]);
    const startDate = new Date(filterDate[0]);
    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(23, 59, 59, 999);

    let deltaValue = 0;

    const dateDiff = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));

    let generatedData = [];

    switch (categoryField) {
      case "timestamp":
        generatedData = await generateRandomDataByDays(
          startDate,
          endDate,
          80,
          400,
          0.1,
          0.05
        );
        deltaValue = arraySum(generatedData.map((item) => item.value)).toFixed(
          2
        );
        return {
          success: true,
          message: {
            data: generatedData,
            granularity: "day",
            deltaValue: deltaValue,
          },
        };
      default:
        let values = [];
        for (let index = 0; index <= dateDiff - 1; index++) {
          values = categoryArray.map((item) => ({
            [categoryField]: item,
            value: randomNumberInRange(80, 1000),
          }));
        }
        generatedData = values;
        deltaValue = arraySum(generatedData.map((item) => item.value)).toFixed(
          2
        );
        return { success: true, message: { data: generatedData } };
    }
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function getRevenue(
  gameID,
  branchName,
  filterDate,
  filterSegments
) {
  try {
    const endDate = new Date(filterDate[1]);
    const startDate = new Date(filterDate[0]);

    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(23, 59, 59, 999);

    // Get difference between dates in milliseconds
    const dateDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);

    // Getting date for delta response, so if we get a query for "today" data, we get it and delta between today and yesterday.
    // If we get a data for this month, we will get delta for the previous month.
    const deltaEndDate = new Date(startDate);
    deltaEndDate.setDate(startDate.getDate() - 1);

    const deltaStartDate = new Date(startDate);
    deltaStartDate.setDate(startDate.getDate() - (dateDiff + 1));

    deltaStartDate.setUTCHours(0, 0, 0, 0);
    deltaEndDate.setUTCHours(23, 59, 59, 999);

    const deltaDateDiff =
      (deltaEndDate - deltaStartDate) / (1000 * 60 * 60 * 24);

    let clientIDs = [];
    let deltaValue = 0;

    if (filterSegments && filterSegments.length !== 0) {
      clientIDs = await getPlayersFromSegment(
        gameID,
        branchName,
        filterSegments
      );
    }
    // const deltaResponse = await druidLib.getRevenue(gameID, branchName, deltaStartDate, deltaEndDate, deltaDateDiff, clientIDs)
    // const response = await druidLib.getRevenue(gameID, branchName, startDate, endDate, dateDiff, clientIDs)

    // const deltaValue = calculateDelta(deltaResponse, response)
    let generatedData = await generateRandomDataByDays(
      startDate,
      endDate,
      80,
      400,
      0.1,
      0.05
    );
    let responseData = generatedData.map((item) => ({
      timestamp: item.timestamp,
      sales: parseFloat(item.value * 2 * randomNumberInRange(1.2, 2)).toFixed(
        0
      ),
      revenue: item.value * 2,
    }));
    deltaValue = arraySum(responseData.map((item) => item.revenue)).toFixed(2);

    return {
      success: true,
      message: {
        data: responseData,
        granularity: "day",
        deltaValue: deltaValue,
      },
    };
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function getDAU(gameID, branchName, filterDate, filterSegments) {
  try {
    const endDate = new Date(filterDate[1]);
    const startDate = new Date(filterDate[0]);

    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(23, 59, 59, 999);

    // Get difference between dates in milliseconds
    const dateDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);

    // Getting date for delta response, so if we get a query for "today" data, we get it and delta between today and yesterday.
    // If we get a data for this month, we will get delta for the previous month.
    const deltaEndDate = new Date(startDate);
    deltaEndDate.setDate(startDate.getDate() - 1);

    const deltaStartDate = new Date(startDate);
    deltaStartDate.setDate(startDate.getDate() - (dateDiff + 1));

    deltaStartDate.setUTCHours(0, 0, 0, 0);
    deltaEndDate.setUTCHours(23, 59, 59, 999);

    const deltaDateDiff =
      (deltaEndDate - deltaStartDate) / (1000 * 60 * 60 * 24);

    let clientIDs = [];

    if (filterSegments && filterSegments.length !== 0) {
      clientIDs = await getPlayersFromSegment(
        gameID,
        branchName,
        filterSegments
      );
    }

    // const deltaResponse = await druidLib.getDAU(gameID, branchName, deltaStartDate, deltaEndDate, deltaDateDiff, clientIDs)
    // const response = await druidLib.getDAU(gameID, branchName, startDate, endDate, dateDiff, clientIDs)

    // const deltaValue = calculateDelta(deltaResponse, response)

    const responseData = Array.from({ length: dateDiff + 1 }, (_, index) => ({
      timestamp: new Date(
        startDate.getTime() + index * 24 * 60 * 60 * 1000
      ).toISOString(),
      value: randomNumberInRange(1, 100),
    }));

    return {
      success: true,
      message: {
        data: responseData,
        granularity: "day",
        deltaValue: randomNumberInRange(1, 500),
      },
    };
  } catch (error) {
    console.error(error);
    throw error;
  }
}
