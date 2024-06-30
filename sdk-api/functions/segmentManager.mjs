export async function incrementSegmentPlayerCount(
  segmentID,
  incrementNumber = 1
) {
  try {
    await Segments.updateOne(
      {
        gameID: gameID,
        "branches.branch": branchName,
        "branches.segments.segmentID": segmentID,
      },
      {
        $inc: {
          "branches.$[i].segments.$[j].segmentPlayerCount": incrementNumber,
        },
      },
      {
        arrayFilters: [
          { "i.branch": branchName },
          { "j.segmentID": segmentID },
        ],
      }
    );
  } catch (err) {
    console.error("Error incrementing segment player count:", err);
  }
}
