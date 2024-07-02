import { ABTests } from "../../models/abtests.js";
import { PWplayers } from "../../models/PWplayers.js";

export async function getOngoingABTests(gameID, branchName) {
  try {
    const abTests = await ABTests.findOne({
      gameID: gameID,
      "branches.branch": branchName,
    }).lean();

    if (!abTests) {
      console.log("ABTests not found or branch does not exist");
      return {
        success: false,
        message: "ABTests not found or branch does not exist",
      };
    }

    const branchItem = abTests.branches.find((b) => b.branch === branchName);
    let result = branchItem ? branchItem.tests : null;

    if (!result) {
      return {
        success: false,
        message: "Branch not found or no tests available",
      };
    }

    result = result
      .filter((t) => t.paused == false && t.archived == false)
      .filter(Boolean);

    return { success: true, abTests: result };
  } catch (error) {
    console.error(error);
    return { success: false, message: "Internal Server Error" };
  }
}
export function tryToAddPlayerToTest(gameID, branch, playerObj, testObj) {
  // Returns either null or string id of added test
  try {

    // Continue only if player does not participate in this test yet
    if (!playerObj.abtests.includes(testObj.id)) {
      let testSegments = JSON.parse(testObj.segments);

      // Continue only if player has the segment to be tested
      if (playerObj.segments.includes(testSegments.test)) {
        let rand = randomNumberInRange(0, 1, true, 1);

        // Check if generated random value landed in % range
        if (rand >= 0 && rand <= testSegments.testShare) {

          // Update test and player docs accordingly
          ABTests.updateOne(
            {
              gameID: gameID,
            },
            {
              $push: {
                "branches.$[branch].tests.$[test].participants":
                  playerObj.clientID,
              },
              $inc: {
                "branches.$[branch].tests.$[test].sampleSize": 1,
              },
              arrayFilters: [
                { "branch.branch": branch },
                { "test.id": testObj.id },
              ],
            }
          );

          PWplayers.updateOne({
            gameID: gameID,
            clientID: playerObj.clientID,
          }, {
            $push: {
              abtests: testObj.id,
            }
          })
          return testObj.id;
        }
      }
    }
    return null;
  } catch (error) {
    console.error(error);
  }
}

export function clearNonExistingTestsFromPlayer(gameID, branch, playerObj, testIDs) {
  // Returns cleaned test list
  try {
    
    let modifiedTestsList = playerObj.abtests.filter(t => testIDs.includes(t));

    // Update player doc accordingly
    PWplayers.updateOne({
      gameID: gameID,
      clientID: playerObj.clientID,
      branch: branch,
    }, {
      $set: {
        abtests: modifiedTestsList,
      }
    })

    return modifiedTestsList;
  } catch (error) {
    console.error(error);
  }
}
