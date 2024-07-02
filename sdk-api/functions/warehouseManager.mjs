import { PWplayers } from "../../models/PWplayers.js";
import { PWtemplates } from "../../models/PWtemplates.js";

export async function initializeNewPlayerSession(gameID, branchName, clientID) {
  try {
    // Find the PlayerWarehouse document by gameID, branchName, and clientID
    const playerWarehousePromise = PWplayers.findOne({
      gameID: gameID,
      branch: branchName,
      clientID,
    }).lean();
    // Also get all AB tests
    const ongoingTestsPromise = getOngoingABTests(gameID, branchName);

    let [playerWarehouse, ongoingTests] = await Promise.all([
      playerWarehousePromise,
      ongoingTestsPromise,
    ]);

    // console.log(playerWarehouse, ongoingTests);

    // If no player found, create a new one
    if (!playerWarehouse) {
      playerWarehouse = {
        gameID: gameID,
        branch: branchName,
        clientID: clientID,
        elements: {
          statistics: [],
          analytics: [],
        },
        inventory: [],
        offers: [],
        abtests: [],
        segments: ["everyone"],
      };
      await PWplayers.collection.insertOne(playerWarehouse);

      // Increment the segment player count for "everyone" segment
      incrementSegmentPlayerCount(gameID, branchName, "everyone", 1);
    }

    // Manage player's AB testing
    if (ongoingTests.success && ongoingTests.abTests.length > 0) {
      // Clear non-existing tests from the player, actualizing tests list in player object
      const cleanedTests = clearNonExistingTestsFromPlayer(
        gameID,
        branchName,
        playerWarehouse,
        ongoingTests.abTests.map((t) => t.id)
      );
      playerWarehouse.abtests = cleanedTests;

      // If any test exist, try to add player to it
      ongoingTests.abTests.forEach((test) => {
        const newTest = tryToAddPlayerToTest(
          gameID,
          branchName,
          playerWarehouse,
          test
        );
        if (newTest) {
          playerWarehouse.abtests.push(newTest);
        }
      });
    }

    // Remove unnecessary fields
    function removeFields(obj) {
      function traverse(obj) {
        // Check if array
        if (Array.isArray(obj)) {
          for (let i = 0; i < obj.length; i++) {
            if (typeof obj[i] === "object" && obj[i] !== null) {
              traverse(obj[i]);
            }
          }
          // Check if object
        } else if (typeof obj === "object" && obj !== null) {
          for (const key in obj) {
            if (key === "_id") {
              delete obj[key];
            } else if (typeof obj[key] === "object" && obj[key] !== null) {
              traverse(obj[key]);
            }
          }
        }
      }

      // Remove top-level fields
      delete obj._id;
      delete obj.gameID;
      delete obj.branch;

      // Recursively remove _id fields
      traverse(obj);
    }
    removeFields(playerWarehouse);

    playerWarehouse.elements = []
      .concat(playerWarehouse.elements.statistics)
      .concat(playerWarehouse.elements.analytics);

    return playerWarehouse;
  } catch (error) {
    console.error(error);
    return {};
  }
}

export async function addValueToStatisticElement(
  gameObj,
  build,
  device,
  elementID,
  value
) {
  const doc = await PWplayers.findOne({
    clientID: device,
    gameID: gameObj.gameID,
    branch: build,
    "elements.statistics.elementID": elementID,
  });

  const defaultElement = await getStatisticsTemplateByID(
    gameObj.gameID,
    build,
    elementID
  );
  const rangeMin = defaultElement.templateValueRangeMin;
  const rangeMax = defaultElement.templateValueRangeMax;

  let result;
  if (doc) {
    if (!rangeMin || !rangeMax) {
      result = await PWplayers.updateOne(
        {
          clientID: device,
          gameID: gameObj.gameID,
          branch: build,
          "elements.statistics": {
            $elemMatch: {
              elementID: elementID,
            },
          },
        },
        {
          $inc: {
            "elements.statistics.$.elementValue": value,
          },
        }
      );
    } else {
      result = await PWplayers.updateOne(
        {
          clientID: device,
          gameID: gameObj.gameID,
          branch: build,
          "elements.statistics": {
            $elemMatch: {
              elementID: elementID,
              elementValue: {
                $lte: parseFloat(rangeMax) - value,
                $gte: parseFloat(rangeMin),
              },
            },
          },
        },
        {
          $inc: {
            "elements.statistics.$.elementValue": value,
          },
        }
      );
    }
  } else {
    let newElement;
    // Element does not exist, create it.
    // Get default values from PWtemplates, modify them and insert
    let transformedDefaultValue = formatTemplateValueAsType(
      defaultElement.templateDefaultValue,
      defaultElement.templateType
    );

    newElement = await PWplayers.updateOne(
      {
        clientID: device,
        gameID: gameObj.gameID,
        branch: build,
      },
      {
        $push: {
          "elements.statistics": {
            elementID: defaultElement.templateID,
            elementValue: clamp(
              transformedDefaultValue + value,
              rangeMin,
              rangeMax
            ),
          },
        },
      }
    );
    if (newElement.modifiedCount > 0) {
      return;
    } else {
      throw new Error("Could not add value to statistics element");
    }
  }

  if (result.modifiedCount > 0) {
    return;
  } else {
    throw new Error(
      "Could not add value to statistics element. Probably hit max value threshold"
    );
  }
}

export async function subtractValueFromStatisticElement(
  gameObj,
  build,
  device,
  elementID,
  value
) {
  const doc = await PWplayers.findOne({
    clientID: device,
    gameID: gameObj.gameID,
    branch: build,
    "elements.statistics.elementID": elementID,
  });

  const defaultElement = await getStatisticsTemplateByID(
    gameObj.gameID,
    build,
    elementID
  );
  const rangeMin = defaultElement.templateValueRangeMin;
  const rangeMax = defaultElement.templateValueRangeMax;

  let result;
  if (doc) {
    if (!rangeMin || !rangeMax) {
      result = await PWplayers.updateOne(
        {
          clientID: device,
          gameID: gameObj.gameID,
          branch: build,
          "elements.statistics": {
            $elemMatch: {
              elementID: elementID,
            },
          },
        },
        {
          $inc: {
            "elements.statistics.$.elementValue": value * -1,
          },
        }
      );
    } else {
      result = await PWplayers.updateOne(
        {
          clientID: device,
          gameID: gameObj.gameID,
          branch: build,
          "elements.statistics": {
            $elemMatch: {
              elementID: elementID,
              elementValue: {
                $lte: parseFloat(rangeMax),
                $gte: parseFloat(rangeMin) + value,
              },
            },
          },
        },
        {
          $inc: {
            "elements.statistics.$.elementValue": value * -1,
          },
        }
      );
    }
  } else {
    let newElement;
    // Element does not exist, create it.
    // Get default values from PWtemplates, modify them and insert
    let transformedDefaultValue = formatTemplateValueAsType(
      defaultElement.templateDefaultValue,
      defaultElement.templateType
    );

    newElement = await PWplayers.updateOne(
      {
        clientID: device,
        gameID: gameObj.gameID,
        branch: build,
      },
      {
        $push: {
          "elements.statistics": {
            elementID: defaultElement.templateID,
            elementValue: clamp(
              transformedDefaultValue - value,
              rangeMin,
              rangeMax
            ),
          },
        },
      }
    );
    if (newElement.modifiedCount > 0) {
      return;
    } else {
      throw new Error("Could not add value to statistics element");
    }
  }

  if (result.modifiedCount > 0) {
    return;
  } else {
    throw new Error(
      "Could not subtrace value from statistics element. Probably hit max value threshold"
    );
  }
}

export async function setValueToStatisticElement(
  gameObj,
  build,
  device,
  elementID,
  value
) {
  const doc = await PWplayers.findOne({
    clientID: device,
    gameID: gameObj.gameID,
    branch: build,
    "elements.statistics.elementID": elementID,
  });

  const defaultElement = await getStatisticsTemplateByID(
    gameObj.gameID,
    build,
    elementID
  );
  const rangeMin = defaultElement.templateValueRangeMin;
  const rangeMax = defaultElement.templateValueRangeMax;

  let result;
  if (doc) {
    if (rangeMin && rangeMax) {
      if (value < rangeMin || value > rangeMax) {
        throw new Error("Value out of range for set operation");
      }
    }

    result = await PWplayers.updateOne(
      {
        clientID: device,
        gameID: gameObj.gameID,
        branch: build,
        "elements.statistics": {
          $elemMatch: {
            elementID: elementID,
          },
        },
      },
      {
        $set: {
          "elements.statistics.$.elementValue": value,
        },
      }
    );
  } else {
    let newElement;
    // Element does not exist, create it.
    // Get default values from PWtemplates, modify them and insert
    let transformedValue = formatTemplateValueAsType(
      value,
      defaultElement.templateType
    );

    newElement = await PWplayers.updateOne(
      {
        clientID: device,
        gameID: gameObj.gameID,
        branch: build,
      },
      {
        $push: {
          "elements.statistics": {
            elementID: defaultElement.templateID,
            elementValue: clamp(transformedValue, rangeMin, rangeMax),
          },
        },
      }
    );
    if (newElement.modifiedCount > 0) {
      return;
    } else {
      throw new Error("Could not add value to statistics element");
    }
  }

  if (result.matchedCount > 0) {
    return;
  } else {
    throw new Error(
      "Could not add value to statistics element. Probably hit max value threshold"
    );
  }
}

export async function getElementValue(gameObj, build, device, elementID) {
  // Search in player's data
  const queryPlayer = await PWplayers.aggregate([
    { $match: { gameID: gameObj.gameID, clientID: device, branch: build } },
    { $unwind: "$elements.statistics" },
    { $match: { "elements.statistics.elementID": elementID } },
    { $project: { _id: 0, "elements.statistics": 1 } },
  ]);
  let result = queryPlayer[0]?.elements?.statistics?.elementValue;

  // If player has no such element, return default
  if (!result) {
    const queryTemplate = await getStatisticsTemplateByID(
      gameObj.gameID,
      build,
      elementID
    );
    result = formatTemplateValueAsType(
      queryTemplate.templateDefaultValue,
      queryTemplate.templateType
    );
  }

  if (result) {
    return result;
  } else {
    return null;
  }
}

async function getStatisticsTemplateByID(gameID, branch, templateID) {
  try {
    const result = await PWtemplates.aggregate([
      { $match: { gameID: gameID } },
      { $unwind: "$branches" },
      { $match: { "branches.branch": branch } },
      { $unwind: "$branches.templates.statistics" },
      { $match: { "branches.templates.statistics.templateID": templateID } },
      { $project: { _id: 0, "branches.templates.statistics": 1 } },
    ]);

    // Get template object
    if (result.length > 0) {
      return result[0].branches.templates.statistics;
    } else {
      return null;
    }
  } catch (error) {
    throw error;
  }
}

function formatTemplateValueAsType(templateValue, templateType) {
  // Format template value according to it's type.
  // E.g. make 5.00 from "5" if template is a float.
  try {
    if (templateType === "integer") {
      return parseInt(templateValue);
    } else if (templateType === "float") {
      return paseFloat(templateValue);
    } else if (templateType === "string") {
      return templateValue;
    } else if (templateType === "bool") {
      return templateValue === "True";
    }
  } catch (err) {
    console.error("Error at formatTemplateValueAsType: " + err.message);
    return null;
  }
}
