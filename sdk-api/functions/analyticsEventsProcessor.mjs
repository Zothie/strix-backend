export async function processNewSessionEvent(gameObj, build, device) {
  try {
    console.log("Acquired new session", {
      success: true,
      message: "OK",
      data: gameObj._id.ToString(),
    });

    // Init new player. Creates new player or returns the existing one
    const playerData = await initializeNewPlayerSession(
      gameObj.gameID,
      build,
      device
    );

    res.status(200).json({
      success: true,
      message: "OK",
      data: {
        key: gameObj._id.ToString(),
        playerData,
        currency: "USD",
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
    console.error(error);
  }
}
