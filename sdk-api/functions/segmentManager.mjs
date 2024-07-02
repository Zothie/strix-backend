import { Segments } from "../../models/segmentsModel.js";


export async function incrementSegmentPlayerCount(
  gameID,
  branch,
  segmentID,
  incrementNumber = 1
) {
  try {
    await Segments.updateOne(
      {
        gameID: gameID,
        "branches.branch": branch,
        "branches.segments.segmentID": segmentID,
      },
      {
        $inc: {
          "branches.$[i].segments.$[j].segmentPlayerCount": incrementNumber,
        },
      },
      {
        arrayFilters: [
          { "i.branch": branch },
          { "j.segmentID": segmentID },
        ],
      }
    );
  } catch (err) {
    console.error("Error incrementing segment player count:", err);
  }
}
