import { Game } from "../../models/gameModel.js";


let gameIds = {};
export async function getCachedGameIdBySecret(secret) {
  let result = gameIds[secret];
  if (!result) {
    result = await getGameBySecret(secret);
    gameIds[secret] = result;
    return result;
  } else {
    return result;
  }
}

export async function getGameBySecret(secret) {
  const game = await Game.findOne(
    { gameSecretKey: secret },
    "_id gameID"
  ).lean();
  if (game) {
    return game;
  } else {
    return null;
  }
}

export const randomNumberInRange = (min, max, isFloat, toFixed = 3) => {
  if (isFloat) {
    return parseFloat(Math.random() * (max - min) + min).toFixed(toFixed);
  } else {
    return Math.round(Math.random() * (max - min)) + min;
  }
};


export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}