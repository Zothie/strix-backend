import { ABTests } from "../../../models/abtests.js";


// Define a function to update an AB test
export async function updateABTest(gameID, branchName, testObject) {
  try {
    let formattedTestObject = testObject;
    formattedTestObject.segments = JSON.stringify(formattedTestObject.segments);
    formattedTestObject.observedMetric = JSON.stringify(
      formattedTestObject.observedMetric
    );
    formattedTestObject.subject = JSON.stringify(formattedTestObject.subject);

    const abTests = await ABTests.findOneAndUpdate(
      { gameID: gameID, "branches.branch": branchName },
      { $set: { "branches.$[outer].tests.$[inner]": formattedTestObject } },
      {
        arrayFilters: [
          { "outer.branch": branchName },
          { "inner.id": testObject.id },
        ],
      }
    );

    return { success: true };
  } catch (error) {
    console.log(error);
    throw new Error("Internal Server Error");
  }
}

export async function removeABTest(
  gameID,
  branchName,
  testObject,
  archive,
  archiveResult
) {
  try {
    if (archive) {
      let formattedTestObject = testObject;
      formattedTestObject.segments = JSON.stringify(
        formattedTestObject.segments
      );
      formattedTestObject.observedMetric = JSON.stringify(
        formattedTestObject.observedMetric
      );
      formattedTestObject.subject = JSON.stringify(formattedTestObject.subject);
      formattedTestObject.archived = true;
      formattedTestObject.archivedResult = archiveResult;
      formattedTestObject.codename = "";

      const abTests = await ABTests.findOneAndUpdate(
        { gameID: gameID, "branches.branch": branchName },
        { $set: { "branches.$[outer].tests.$[inner]": formattedTestObject } },
        {
          arrayFilters: [
            { "outer.branch": branchName },
            { "inner.id": testObject.id },
          ],
        }
      );
    } else {
      const abTests = await ABTests.findOneAndUpdate(
        { gameID: gameID, "branches.branch": branchName },
        { $pull: { "branches.$.tests": { id: testObject.id } } },
        { new: true }
      );
    }

    return { success: true };
  } catch (error) {
    console.log(error);
    return { success: false, message: "Internal Server Error" };
  }
}

export async function createABTest(gameID, branchName, testObject) {
  try {
    let formattedTestObject = testObject;
    formattedTestObject.segments = JSON.stringify(formattedTestObject.segments);
    formattedTestObject.observedMetric = JSON.stringify(
      formattedTestObject.observedMetric
    );
    formattedTestObject.subject = JSON.stringify(formattedTestObject.subject);

    const abTests = await ABTests.findOneAndUpdate(
      { gameID: gameID, "branches.branch": branchName },
      { $push: { "branches.$.tests": testObject } },
      { new: true }
    );

    return { success: true };
  } catch (error) {
    console.log(error);
    return { success: false, message: "Internal Server Error" };
  }
}

export async function getABTests(gameID, branchName) {
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
    const result = branchItem ? branchItem.tests : null;

    if (!result) {
      return {
        success: false,
        message: "Branch not found or no tests available",
      };
    }

    return { success: true, abTests: result };
  } catch (error) {
    console.error(error);
    return { success: false, message: "Internal Server Error" };
  }
}
