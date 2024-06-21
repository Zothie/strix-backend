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

export async function removeStudio(studioID) {
  try {
    // Check if studioID is provided
    if (!studioID) {
      throw new Error("Studio ID is required");
    }

    // Set deletion date
    const currentDate = new Date();
    const deletionDate = new Date(currentDate);
    deletionDate.setHours(currentDate.getHours() + 72);

    // Find and update the studio to set the scheduledDeletionDate
    await Studio.findOneAndUpdate(
      { studioID: studioID },
      { $set: { scheduledDeletionDate: deletionDate } },
      { new: true, upsert: true }
    );

    // No need to return anything as the update was successful
  } catch (error) {
    throw error;
  }
}

export async function updateGameDetails(
  gameID,
  gameName,
  gameEngine,
  gameIcon,
  apiKeys,
  gameSecretKey
) {
  try {
    // Check if gameID is provided
    if (!gameID) {
      throw new Error("Game ID is required");
    }

    let game = await Game.findOne({ gameID: gameID });
    const oldGame = {...game.toObject()}

    // Construct the updated data object
    if (gameName) game.gameName = gameName;
    if (gameEngine) game.gameEngine = gameEngine;
    if (gameIcon) game.gameIcon = gameIcon;
    if (gameSecretKey) game.gameSecretKey = gameSecretKey;

    function isStringOfAsterisks(str) {
      return str === Array(str.length + 1).join('*');
    }

    let tempApiKeys = apiKeys.map(obj => {
      let temp = obj
      if (isStringOfAsterisks(temp.key)) {
        delete temp.key
      } else {
        temp.key = temp.key && temp.key !== '' ? encryptString(temp.key) : temp.key
      }
      return temp
    })
    
    game.apiKeys = tempApiKeys.map((key) => {
      let existingObj = game.apiKeys.find(obj => obj.service === key.service)
      if (existingObj) {
        return {
         ...existingObj,
         ...key,
        }
      } else {
        return {
          ...key,
        }
      }
    })
    
    // Update the game details
    await game.save()
    handleDefaultCurrencyChange(oldGame, game)

    // Check if the game exists
    if (!game) {
      throw new Error("Game not found");
    }
  } catch (error) {
    throw error;
  }
}

async function handleDefaultCurrencyChange(oldGameObj, newGameObj) {
  const defaultBranch = 'development'
  // Checking if game has any api keys
  try {
    if (oldGameObj.apiKeys && oldGameObj.apiKeys.length > 0) {
  
      // Getting google play services api object
      const gpOld = oldGameObj.apiKeys.find((s) => s.service = 'googleplayservices')
      const gpNew = newGameObj.apiKeys.find((s) => s.service = 'googleplayservices')

      // If both missing, then we don't have GP api object
      if (gpOld || gpNew) {
  
        // Compare their currencies
        if (gpOld.secondary !== gpNew.secondary) {
          // If currencies are different, then we need to update all the offers
          async function handleOffers() {
            const doc = await Offers.findOne({ gameID: oldGameObj.gameID })
            const branch = doc.branches.find((b) => b.branch === defaultBranch)
            let offers = branch.offers.filter(o => !o.removed)
  
            offers.forEach(async (offer) => {
              if (
                (offer.offerPrice && offer.offerPrice.moneyCurr) 
                || 
                (offer.offerPrice && offer.offerPrice.targetCurrency === 'entity' && offer.offerPrice.moneyCurr.length > 0)
              ) {
                
                // Checking if we already have this currency in the pricing. If so, just reinsert it at 0
                if (offer.offerPrice.moneyCurr.some(c => c.cur === gpNew.secondary)) {
                  let currency = 
                  JSON.parse(
                    JSON.stringify(
                      offer.offerPrice.moneyCurr.find(c => c.cur === gpNew.secondary)
                    )
                  );
                  offer.offerPrice.moneyCurr = offer.offerPrice.moneyCurr.filter(c => c.cur!== gpNew.secondary);
                  offer.offerPrice.moneyCurr = offer.offerPrice.moneyCurr.splice(0, 0, currency);
                  console.log('Currency found, result:', offer.offerPrice)
                } else {
                  if (offer.offerPrice.moneyCurr.length === 0) {
                    offer.offerPrice.moneyCurr = [{cur: gpNew.secondary, amount: 0}];
                  } else {
                    offer.offerPrice.moneyCurr = offer.offerPrice.moneyCurr.splice(0, 0, {cur: gpNew.secondary, amount: 0});
                  }
                  console.log('Inserting as no currency found: ', offer.offerPrice)
                }
                console.log('Post update offer', offer.offerID, offer.offerPrice);
  
              }
            })
            
            let pricing = branch.pricing.currencies
            if (pricing.some(c => c.code === gpNew.secondary)) {
              let currency = 
              JSON.parse(
                JSON.stringify(
                  pricing.find(c => c.code === gpNew.secondary)
                )
              );
              pricing = pricing.filter(c => c.code!== gpNew.secondary);
              pricing = pricing.splice(0, 0, currency);
            } else {
              
              if (pricing.length === 0) {
                pricing = [{code: gpNew.secondary, base: 1}];
              } else {
                pricing = pricing.splice(0, 0, {code: gpNew.secondary, base: 1});
              }
            }
            await doc.save()
          }
          handleOffers()

          async function handleTests() {
            const doc = await ABTests.findOne({
              gameID: oldGameObj.gameID,
              "branches.branch": defaultBranch,
            });
            if (!doc) {
              console.log("ABTests not found or branch does not exist");
              return {
                success: false,
                message: "ABTests not found or branch does not exist",
              };
            }
            const branchItem = doc.branches.find((b) => b.branch === defaultBranch);
            let tests = branchItem ? branchItem.tests : null;

            if (tests) {
              // Iterating through all the tests and find tests with changed offer price
              tests = tests.map(test => {
                let subjectObj = JSON.parse(test.subject)
                if (!test.archived && subjectObj.type === 'offer') {
                  if (
                    subjectObj.changedFields.price 
                    && 
                    subjectObj.changedFields.price.targetCurrency === 'money'
                  ) {
  
                    // Insert new field to pricing
                    let pricing = subjectObj.changedFields.price.moneyCurr
                    if (pricing.some(c => c.cur === gpNew.secondary)) {
                      let currency = 
                      JSON.parse(
                        JSON.stringify(
                          pricing.find(c => c.cur === gpNew.secondary)
                        )
                      );
                      pricing = pricing.filter(c => c.cur!== gpNew.secondary);
                      pricing = pricing.splice(0, 0, currency);
                    } else {
                      
                      if (pricing.length === 0) {
                        pricing = [{cur: gpNew.secondary, amount: 1}];
                      } else {
                        pricing = pricing.splice(0, 0, {cur: gpNew.secondary, amount: 1});
                      }
                    }
  
                  }
                }
                test.subject = JSON.stringify(subjectObj)
                return test
              })
              await doc.save()
            }
          }
          handleTests()

        }
      }
    }
  } catch (error) {
    throw error;
  }
}



export async function getGameDetails(gameID) {
  try {
    // Check if gameID is provided
    if (!gameID) {
      throw new Error("Game ID is required");
    }

    // Find the game by gameID
    const game = await Game.findOne({ gameID: gameID });

    // Check if the game exists
    if (!game) {
      throw new Error("Game not found");
    }

    const cleanedApiKeys = game.apiKeys.map((key) => {
      return {
        ...key,
        key: '*********************************'
      }
    })

    // Return game details
    return {
      success: true,
      gameName: game.gameName,
      gameEngine: game.gameEngine,
      gameIcon: game.gameIcon,
      gameSecretKey: game.gameSecretKey,
      gameScheduledDeletionDate: game.scheduledDeletionDate,
      apiKeys: cleanedApiKeys,
    };
  } catch (error) {
    throw error;
  }
}

export async function cancelRemoveStudio(studioID) {
  try {
    // Check if studioID is provided
    if (!studioID) {
      throw new Error("Studio ID is required");
    }

    // Find and update the studio to unset the scheduledDeletionDate
    const studio = await Studio.findOneAndUpdate(
      { studioID: studioID },
      { $unset: { scheduledDeletionDate: "" } },
      { new: true, upsert: true }
    );

    // Check if the studio exists
    if (!studio) {
      throw new Error("Studio not found");
    }

    // No need to return anything as the update was successful
  } catch (error) {
    throw error;
  }
}

export async function revokeGameKey(gameID) {
  try {
    const updatedData = {};
    updatedData.gameSecretKey = uuid();

    // Find and update the game
    const game = await Game.findOneAndUpdate({ gameID: gameID }, updatedData, {
      new: true,
    });
    if (!game) {
      return { success: false, message: "Game not found" };
    } else {
      // Updating user for this game right now
      await updateUserPassword(game._id, game.gameSecretKey);
    }

    return {
      success: true,
      message: "Game key revoked",
      apiKey: updatedData.gameSecretKey,
    };
  } catch (error) {
    throw error;
  }
}

export async function revokeStudioKey(studioID) {
  try {
    const updatedData = {};
    updatedData.apiKey = uuid();

    // Find and update the studio
    const studio = await Studio.findOneAndUpdate(
      { studioID: studioID },
      updatedData,
      { new: true }
    );
    if (!studio) {
      return { success: false, message: "Studio not found" };
    }

    return {
      success: true,
      message: "Studio key revoked",
      apiKey: updatedData.apiKey,
    };
  } catch (error) {
    throw error;
  }
}

export async function updateStudioDetails(
  studioID,
  studioName,
  studioIcon,
  apiKey
) {
  try {
    // Check if studio ID is provided
    if (!studioID) {
      throw new Error("Studio ID is required");
    }

    const updatedData = {};
    if (studioName) updatedData.studioName = studioName;
    if (studioIcon) updatedData.studioIcon = studioIcon;
    if (apiKey) updatedData.apiKey = apiKey;

    // Find and update the studio
    const studio = await Studio.findOneAndUpdate(
      { studioID: studioID },
      updatedData,
      { new: true }
    );
    if (!studio) {
      throw new Error("Studio not found");
    }
  } catch (error) {
    throw error;
  }
}

export async function getStudioDetails(studioID) {
  try {
    // Check if studio ID is provided
    if (!studioID) {
      throw new Error("Studio ID is required");
    }

    // Find the studio
    const studio = await Studio.findOne({ studioID: studioID });
    if (!studio) {
      throw new Error("Studio not found");
    }

    // Return studio details
    return {
      success: true,
      studioName: studio.studioName,
      studioIcon: studio.studioIcon,
      apiKey: studio.apiKey,
      scheduledDeletionDate: studio.scheduledDeletionDate,
    };
  } catch (error) {
    throw error;
  }
}

export async function cancelRemoveGame(studioID, gameID) {
  try {
    // Removing scheduled deletion date for the game
    await Game.findOneAndUpdate(
      { gameID },
      { $unset: { scheduledDeletionDate: "" } },
      { new: true, upsert: true }
    );
  } catch (error) {
    throw error;
  }
}

export async function removeGame(studioID, gameID) {
  try {
    const currentDate = new Date();
    const deletionDate = new Date(currentDate);
    deletionDate.setHours(currentDate.getHours() + 72);

    // Setting scheduled deletion date for the game
    await Game.findOneAndUpdate(
      { gameID },
      { $set: { scheduledDeletionDate: deletionDate } },
      { new: true, upsert: true }
    );
  } catch (error) {
    throw error;
  }
}

export async function createGame(
  studioID,
  gameName,
  gameEngine,
  gameKey,
  gameIcon
) {
  try {
    const newGameID = uuid();
    // Создаем новую игру
    const newGame = new Game({
      gameID: newGameID,
      gameName: gameName,
      gameEngine: gameEngine,
      gameIcon: gameIcon,
      gameSecretKey: gameKey,
    });

    // Сохраняем новую игру
    const savedGame = await newGame.save();

    // Обновляем массив games в схеме студии
    const updatedStudio = await Studio.findOneAndUpdate(
      { studioID: studioID },
      { $push: { games: { gameID: newGameID } } },
      { new: true }
    );

    //
    //
    // Populating existing collestions with new game
    //
    //
    // Creating new game doc in NodeModel
    const newNodeModel = new NodeModel({
      gameID: newGameID,
      branches: [
        {
          branch: "development",
          planningTypes: [
            {
              type: "entity",
              nodes: [
                {
                  nodeID: "Root",
                  name: "Root",
                  entityCategory: {
                    categoryID: "Root",
                    mainConfigs: "",
                    parentCategory: "",
                    inheritedConfigs: "",
                  },
                },
              ],
            },
            {
              type: "gameplay",
              nodes: [],
            },
          ],
        },
        {
          branch: "stage",
          planningTypes: [
            {
              type: "entity",
              nodes: [],
            },
            {
              type: "gameplay",
              nodes: [],
            },
          ],
        },
        {
          branch: "production",
          planningTypes: [
            {
              type: "entity",
              nodes: [],
            },
            {
              type: "gameplay",
              nodes: [],
            },
          ],
        },
      ],
    });
    await newNodeModel.save();

    // Creating new game doc in AnalyticsEvents
    const newAnalyticsEvents = new AnalyticsEvents({
      gameID: newGameID,
      branches: [
        {
          branch: "development",
          events: [],
        },
        {
          branch: "stage",
          events: [],
        },
        {
          branch: "production",
          events: [],
        },
      ],
    });
    await newAnalyticsEvents.save();

    const newPWtemplates = new PWtemplates({
      gameID: newGameID,
      branches: [
        {
          branch: "development",
          templates: {
            analytics: [
              {
                templateID: "lastReturnDate",
                templateName: "Last Return Date",
                templateDefaultVariantType: "date",
              },
              {
                templateID: "lastPaymentDate",
                templateName: "Last Payment Date",
                templateDefaultVariantType: "date",
              },
              {
                templateID: "totalPaymentsSumm",
                templateName: "Total Payments Summ",
                templateDefaultVariantType: "float",
              },
              {
                templateID: "totalPaymentsCount",
                templateName: "Total Payments Count",
                templateDefaultVariantType: "integer",
              },
              {
                templateID: "country",
                templateName: "Country",
                templateDefaultVariantType: "string",
              },
              {
                templateID: "engineVersion",
                templateName: "Engine Version",
                templateDefaultVariantType: "string",
              },
              {
                templateID: "gameVersion",
                templateName: "Game Version",
                templateDefaultVariantType: "string",
              },
              {
                templateID: "language",
                templateName: "Language",
                templateDefaultVariantType: "string",
              },
              {
                templateID: "meanSessionLength",
                templateName: "Mean. Session Length",
                templateDefaultVariantType: "float",
              },
            ],
            statistics: [],
          },
          players: [],
        },
        {
          branch: "stage",
          templates: {},
          players: [],
        },
        {
          branch: "production",
          templates: {},
          players: [],
        },
      ],
    });
    await newPWtemplates.save();

    // Creating new game doc in RemoteConfig
    const newRemoteConfig = new RemoteConfig({
      gameID: newGameID,
      branches: [
        {
          branch: "development",
          params: [],
        },
        {
          branch: "stage",
          params: [],
        },
        {
          branch: "production",
          params: [],
        },
      ],
    });
    await newRemoteConfig.save();

    // Creating new game doc in Segments
    const newSegments = new Segments({
      gameID: newGameID,
      branches: [
        {
          branch: "development",
          segments: [
            {
              segmentID: "everyone",
              segmentName: "Everyone",
              segmentComment: "",
            },
          ],
        },
        {
          branch: "stage",
          segments: [
            {
              segmentID: "everyone",
              segmentName: "Everyone",
              segmentComment: "",
            },
          ],
        },
        {
          branch: "production",
          segments: [
            {
              segmentID: "everyone",
              segmentName: "Everyone",
              segmentComment: "",
            },
          ],
        },
      ],
    });
    await newSegments.save();

    // Creating new game doc in Planning Tree
    const newTree = {
      gameID: newGameID,
      branches: [
        {
          branch: "development",
          planningTypes: [
            {
              type: "entity",
              nodes: [
                {
                  nodeID: "Root",
                  isCategory: true,
                  subnodes: [],
                },
              ],
            },
            {
              type: "gameplay",
              nodes: [
                {
                  nodeID: "Root",
                  subnodes: [],
                },
              ],
            },
          ],
        },
        {
          branch: "stage",
          planningTypes: [
            {
              type: "entity",
              nodes: [
                {
                  nodeID: "Root",
                  subnodes: [],
                },
              ],
            },
            {
              type: "gameplay",
              nodes: [
                {
                  nodeID: "Root",
                  subnodes: [],
                },
              ],
            },
          ],
        },
        {
          branch: "production",
          planningTypes: [
            {
              type: "entity",
              nodes: [
                {
                  nodeID: "Root",
                  subnodes: [],
                },
              ],
            },
            {
              type: "gameplay",
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
    await PlanningTreeModel.create(newTree);

    // Creating new game doc in Relations
    const newRelations = new Relations({
      gameID: newGameID,
      branches: [
        {
          branch: "development",
          relations: [],
          contexts: [],
        },
        {
          branch: "stage",
          relations: [],
          contexts: [],
        },
        {
          branch: "production",
          relations: [],
          contexts: [],
        },
      ],
    });
    await newRelations.save();

    // Creating new game doc in Localization
    const newLocalization = new Localization({
      gameID: newGameID,
      branches: [
        {
          branch: "development",
          localization: {
            offers: [],
            entities: [],
            custom: [],
          },
        },
        {
          branch: "stage",
          localization: {
            offers: [],
            entities: [],
            custom: [],
          },
        },
        {
          branch: "production",
          localization: {
            offers: [],
            entities: [],
            custom: [],
          },
        },
      ],
    });
    await newLocalization.save();

    const newOffers = new Offers({
      gameID: newGameID,
      branches: [
        {
          branch: "development",
          offers: [],
          associations: [],
        },
        {
          branch: "stage",
          offers: [],
          associations: [],
        },
        {
          branch: "production",
          offers: [],
          associations: [],
        },
      ],
    });
    await newOffers.save();

    const newCustomCharts = new CustomCharts({
      gameID: newGameID,
      branches: [
        {
          branch: "development",
          dashboards: [],
        },
        {
          branch: "stage",
          dashboards: [],
        },
        {
          branch: "production",
          dashboards: [],
        },
      ],
    });
    await newCustomCharts.save();

    const newABTests = new ABTests({
      gameID: newGameID,
      branches: [
        {
          branch: "development",
          tests: [],
        },
        {
          branch: "stage",
          tests: [],
        },
        {
          branch: "production",
          tests: [],
        },
      ],
    });
    await newABTests.save();

    return newGameID;
  } catch (error) {
    throw error;
  }
}

export async function getStudioGames(studioIDs) {
  try {
    // Find studios based on the provided IDs
    const studios = await Studio.find({ studioID: { $in: studioIDs } });

    // If no studios found, return an error
    if (!studios) {
      throw new Error("Studio not found");
    }

    // Extract game IDs from the studios
    const gameIDs = studios.flatMap((s) => s.games.map((game) => game.gameID));

    // Find games based on the extracted game IDs
    const games = await Game.find({ gameID: { $in: gameIDs } });

    // Create an array of studios with associated games
    const studiosAndGames = studios.map((studio) => ({
      studioID: studio.studioID,
      games: games.filter((game) =>
        studio.games.some((sGame) => sGame.gameID === game.gameID)
      ),
    }));

    return studiosAndGames;
  } catch (error) {
    throw error;
  }
}
export async function getPublisherStudios(publisherID) {
  try {
    if (!publisherID)
      return { success: false, message: "Missing required fields!" };
    // Find the publisher based on the provided ID
    const publisher = await Publisher.findOne({ publisherID });

    // If publisher not found, throw an error
    if (!publisher) {
      throw new Error("Publisher not found");
    }

    // Extract studio IDs from the publisher's studios
    const studioIDs = publisher.studios.map((studio) => studio.studioID);

    // Find studios based on the extracted studio IDs
    const studios = await Studio.find({ studioID: { $in: studioIDs } }).select(
      "studioID studioName studioIcon"
    );

    // Format the result
    const result = studios.map((studio) => ({
      studioID: studio.studioID,
      studioName: studio.studioName,
      studioIcon: studio.studioIcon,
    }));

    return { success: true, result };
  } catch (error) {
    throw error;
  }
}
export async function addStudio(publisherID, studioName, apiKey, studioIcon) {
  try {
    // Check for required parameters
    if (!publisherID || !studioName || !apiKey) {
      throw new Error("Missing required parameters");
    }

    // Generate a new UUID for the studio
    const studioID = uuid();

    // Create a new studio instance
    const studio = new Studio({ studioID, studioName, apiKey, studioIcon });

    // Save the studio to the database
    await studio.save();

    // Find the publisher based on the provided ID
    const publisher = await Publisher.findOne({ publisherID });

    // If publisher not found, throw an error
    if (!publisher) {
      throw new Error("Publisher not found");
    }

    // Add the newly created studio's ID to the publisher's studios array
    publisher.studios.push({ studioID });

    // Save the updated publisher
    await publisher.save();
  } catch (error) {
    throw error;
  }
}

export async function confirmUserChangeProfileCode(type, email, code, newData) {
  try {
    let user = await User.findOne({ email }).lean();

    if (!user) {
      return { success: false, error: "User not found" };
    }

    if (type === "email") {
      if (user.tempEmailConfirmCode === code) {
        await User.updateOne(
          { email },
          { $set: { email: newData, tempEmailConfirmCode: null } }
        );
        await Publisher.updateMany(
          { "users.userID": user.email },
          { $set: { "users.$.userID": newData } }
        );
        await Studio.updateMany(
          { "users.userID": user.email },
          { $set: { "users.$.userID": newData } }
        );
        return { success: true, message: "Email changed successfully" };
      } else {
        return { success: false, error: "Wrong code" };
      }
    } else if (type === "password") {
      if (user.tempPasswordConfirmCode === code) {
        await User.updateOne(
          { email },
          { $set: { password: newData, tempPasswordConfirmCode: null } }
        );
        return { success: true, message: "Password changed successfully" };
      } else {
        return { success: false, error: "Wrong code" };
      }
    }
  } catch (error) {
    throw error;
  }
}
export async function initiateChangeUserProfile(
  type,
  email,
  newData,
  mailService
) {
  try {
    if (!type || !email) {
      return { success: false, message: "Wrong type or email" };
    }

    let user = await User.findOne({ email }).lean();
    if (!user) {
      return { success: false, error: "User not found" };
    }

    const verificationCode = generateVerificationCode();
    let mail;

    switch (type) {
      case "email":
      case "password":
        mail = {
          from: "team@strixgameops.com",
          to: email,
          subject: `${
            type === "email" ? "Changing Email" : "Changing Password"
          } - Verification code`,
          text: `Your verification code is ${verificationCode}`,
        };
        break;
      case "avatar":
        await User.updateOne({ email }, { $set: { avatar: newData } });
        return { success: true, message: "Avatar updated" };
      case "username":
        await User.updateOne({ email }, { $set: { username: newData } });
        return { success: true, message: "Username updated" };
      case "role":
        await User.updateOne({ email }, { $set: { role: newData } });
        return { success: true, message: "Role updated" };
      default:
        return { success: false, message: "Wrong type" };
    }

    if (mail) {
      try {
        const sendEmail = await mailService.sendMail(mail);
      } catch (err) {
        return { success: false, message: "Error sending email: " + err };
      }

      if (type === "email") {
        await User.updateOne(
          { email },
          { $set: { tempEmailConfirmCode: verificationCode } }
        );
      } else if (type === "password") {
        await User.updateOne(
          { email },
          { $set: { tempPasswordConfirmCode: verificationCode } }
        );
      }

      return { success: true, message: "Sent email" };
    }
  } catch (error) {
    throw error;
  }
}

export async function finishRegistrationProcess(code, email) {
  try {
    const user = await User.findOne({ email }).lean();
    const userCode = user.tempRegistrationConfirmCode;

    if (userCode === code) {
      return { success: true, message: "Email confirmed" };
    } else {
      return { success: false, message: "Wrong verification code" };
    }
  } catch (error) {
    return { success: false, message: "Failed to confirm email" };
  }
}

export async function startRegistrationProcess(email) {
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return { success: false, message: "Email is already registered" };
    }

    const verificationCode = generateVerificationCode();
    const mail = {
      from: "team@strixgameops.com",
      to: email,
      subject: "Registration - Verification code",
      text: `Your verification code is ${verificationCode}`,
    };
    await mailService.sendMail(mail);

    const newUser = new User({
      email,
      tempRegistrationConfirmCode: verificationCode,
    });
    await newUser.save();

    return { success: true, message: "Email sent" };
  } catch (error) {
    return { success: false, message: "Failed to send email" };
  }
}

function generateVerificationCode() {
  const randomBytes = crypto.randomBytes(4).toString("hex");
  return randomBytes.toUpperCase();
}

export async function getUser(email) {
  try {
    // Find the user by email
    let user = await User.findOne({ email }).lean();
    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Remove sensitive fields from the user object
    delete user.password;
    delete user._id;
    delete user.__v;

    // Extract only necessary user information
    let isolatedUser = {
      email: user.email,
      username: user.username,
      isDemo: user.isDemo,
      role: user.role,
      avatar: user.avatar,
      scheduledDeletionDate: user.scheduledDeletionDate,
    };

    return { success: true, user: isolatedUser };
  } catch (error) {
    return { success: false, error: "Internal Server Error" };
  }
}

export async function addUserToOrganization(studioID, token, targetUserEmail) {
  try {
    const decodedToken = await firebase.auth().verifyIdToken(token);
    const uid = decodedToken.uid;
    if (!uid) {
      return {
        success: false,
        status: 401,
        message: "Invalid or expired token",
      };
    }

    const checkAuthority = await checkUserOrganizationAuthority(studioID, uid);
    if (!checkAuthority) {
      return { success: false, status: 401, message: "Unauthorized" };
    }

    const update = {
      $push: {
        users: {
          userID: targetUserEmail,
          userPermissions: { permission: "default" },
        },
      },
    };

    const options = { new: true };

    await Publisher.findOneAndUpdate(
      { studios: { $elemMatch: { studioID } } },
      update,
      options
    );
    const studio = await Studio.findOneAndUpdate({ studioID }, update, options);
    if (!studio) {
      return { success: false, status: 404, message: "Studio not found" };
    }

    return { success: true };
  } catch (error) {
    console.error("Error adding user to organization:", error);
    return { success: false, status: 500, message: "Internal server error" };
  }
}

export async function removeUserFromOrganization(
  studioID,
  token,
  targetUserEmail
) {
  try {
    const decodedToken = await firebase.auth().verifyIdToken(token);
    const uid = decodedToken.uid;

    if (!uid) {
      throw new Error("Invalid or expired token");
    }

    // Skip authority check if user is trying to remove himself from the organization
    if (uid !== targetUserEmail) {
      const checkAuthority = await checkUserOrganizationAuthority(
        studioID,
        uid
      );
      if (!checkAuthority) {
        throw new Error("Unauthorized");
      }
    }

    const update = {
      $pull: { users: { userID: targetUserEmail } },
    };

    const options = { new: true };

    await Publisher.findOneAndUpdate(
      { "studios.studioID": studioID },
      update,
      options
    );
    const studio = await Studio.findOneAndUpdate({ studioID }, update, options);

    if (!studio) {
      throw new Error("Studio not found");
    }
  } catch (error) {
    throw error;
  }
}

export async function getOrganizationsInfo(email) {
  try {
    // Find the user by email
    const user = await User.findOne({ email });

    if (!user) {
      throw new Error("User not found");
    }

    // Find publishers that include the user
    let publishers = await Publisher.find(
      { "users.userID": email },
      "-_id"
    ).lean();

    publishers = publishers.map((publisher) => {
      let temp = publisher;
      if (
        !temp.users
          .find((u) => u.userID === email)
          .userPermissions.find((p) => p.permission === "admin")
      ) {
        // Clear users so regular user cannot see who else is in the organization
        temp.users = [];
      }
      return temp;
    });

    // Fetch studios and their users
    const studioPromises = publishers.map((publisher) => {
      const studioIDs = publisher.studios.map((studio) => studio.studioID);
      return Studio.find({ studioID: { $in: studioIDs } })
        .select("studioID studioName users -_id")
        .lean();
    });

    const studioResults = await Promise.all(studioPromises);

    // Fetch usernames of users in studios
    const userEmails = studioResults.flatMap((studio) =>
      studio.flatMap((s) => s.users.map((u) => u.userID))
    );
    const users = await fetchUsersName(userEmails);

    // Construct the final result
    const result = publishers.map((publisher, index) => ({
      ...publisher,
      studios: studioResults[index].map((studio) => {
        const studioUsers = studio.users.map((user) => {
          const matchingUser = users.find((u) => u.email === user.userID);
          return {
            userID: user.userID,
            username: matchingUser ? matchingUser.username : "Unknown name",
            userPermissions: user.userPermissions,
          };
        });
        return {
          studioID: studio.studioID,
          studioName: studio.studioName,
          users: studioUsers,
        };
      }),
    }));

    return result;
  } catch (error) {
    throw error;
  }
}

export async function getPublishers(email) {
  try {
    // Find the user by email
    const user = await User.findOne({ email });

    if (!user) {
      throw new Error("User not found");
    }

    // Find publishers that include the user
    const publishers = await Publisher.find(
      {
        "users.userID": user.email,
      },
      "publisherID publisherName -_id"
    );

    return publishers;
  } catch (error) {
    throw error;
  }
}

export async function cancelRemoveUser(email, token) {
  if (!email || !token) {
    throw new Error("Email and token are required");
  }

  // Verify token if necessary (token verification logic should be added here)

  await User.findOneAndUpdate(
    { email },
    { $unset: { scheduledDeletionDate: "" } },
    { new: true, upsert: true }
  );
}

export async function scheduleUserRemoval(email, token) {
  if (!email || !token) {
    throw new Error("Email and token are required");
  }

  const decodedToken = await firebase.auth().verifyIdToken(token);
  if (!decodedToken) {
    throw new Error("Invalid or expired token");
  }

  const currentDate = new Date();
  const deletionDate = new Date(currentDate);
  deletionDate.setHours(currentDate.getHours() + 72);

  await User.findOneAndUpdate(
    { email },
    { $set: { scheduledDeletionDate: deletionDate } },
    { new: true, upsert: true }
  );

  return deletionDate;
}

export async function getGameServiceAPIObject(gameID, service) {
  //
  // FOR INTERNAL USE ONLY
  //
  try {
    const game = await Game.findOne({ gameID });
    if (!game) {
      throw new Error("Game not found");
    }

    let apiKey = game.apiKeys.find((apiKey) => apiKey.service === service);
    if (!apiKey) {
      throw new Error("API key not found");
    }
    apiKey.key = decryptString(apiKey.key);

    return apiKey;
  } catch (error) {
    throw error;
  }
}

export async function getGameDocumentIdAndKey(gameID) {
  const game = await Game.findOne(
    {gameID},
    "_id gameSecretKey"
  ).lean();
  return {id: game._id.toString(), secretKey: game.gameSecretKey};
}
