export async function initializeNewPlayerSession(gameID, branchName, clientID) {
  try {
    // Find the PlayerWarehouse document by gameID, branchName, and clientID
    let playerWarehouse = {};
    let ongoingTests = [];
    const promises = Array.from(
      () =>
        (playerWarehouse = PWplayers.findOne({
          gameID: gameID,
          branch: branchName,
          clientID,
        })),
      (ongoingTests = getOngoingABTests(gameID, branchName))
    );
    await Promise.all(promises);

    // If no player found, create a new one
    if (!playerWarehouse) {
      playerWarehouse = {
        gameID: gameID,
        branch: branchName,
        clientID: clientID,
        inventory: [],
        offers: [],
        abtests: [],
        segments: ["everyone"],
      };
      await PWplayers.collection.insert(playerWarehouse);

      // Increment the segment player count for "everyone" segment
      incrementSegmentPlayerCount("everyone", 1);
    }

    // Manage player's AB testing
    if (ongoingTests.success && ongoingTests.tests.length > 0) {
      // Clear non-existing tests from the player, actualizing tests list in player object
      const cleanedTests = clearNonExistingTestsFromPlayer(
        gameID,
        branchName,
        playerWarehouse,
        ongoingTests.tests.map((t) => t.id)
      );
      playerWarehouse.abtests = cleanedTests;

      // If any test exist, try to add player to it
      ongoingTests.tests.forEach((test) => {
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

    return playerWarehouse;
  } catch (error) {
    console.error(error);
    return {};
  }
}
