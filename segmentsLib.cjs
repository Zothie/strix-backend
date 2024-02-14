const Segments = require('./models/segmentsModel')
const PlayerWarehouse = require('./models/playerWarehouseModel')

// Here we calculate all conditions and return true or false if player should be in a given segment
function calculatePlayerSegment(playerObject, segment) {
    const segmentConditions = segment.segmentConditions;
  
    let resultToCalculate = '';
    // Dummy const for actual calculating
    const segmentMatches = segmentConditions.forEach(condition => {

      // console.log('iterating', condition)

      if (condition.conditionElementID) {

        const allElements = [...playerObject.elements.analytics, ...playerObject.elements.statistics];
        
        let playerElement = allElements.find((element) => element.elementID === condition.conditionElementID)
        if (!playerElement || playerElement === undefined || playerElement === null) {
          resultToCalculate += '0';
          return;
        }

        // Get "value" or "values" depending on what kind of value it is.
        // For reliability we store them in different arrays to explicitly separate possible array values from non-array
        let playerElementValue;
        playerElementValue = playerElement.elementValue;

        let playerElementValues;
        playerElementValues = playerElement.elementValues;


        let conditionalValue = condition.conditionValue;
        let conditionalSecondaryValue = condition.conditionSecondaryValue; 
  
        function checkCondition(condition) {
          switch (condition.condition) {
            // Int/floats only
            case '=':
              playerElementValue = parseFloat(playerElementValue)
              conditionalValue = parseFloat(conditionalValue)
              if (conditionalValue === playerElementValue) {
                return true;
              } else {
                return false;
              }
            break;
    
            case '!=':
              playerElementValue = parseFloat(playerElementValue)
              conditionalValue = parseFloat(conditionalValue)
              if (conditionalValue !== playerElementValue) {
                return true;
              } else {
                return false;
              }
            break;
    
            case '>':
              playerElementValue = parseFloat(playerElementValue)
              conditionalValue = parseFloat(conditionalValue)
              if (playerElementValue > conditionalValue) {
                return true;
              } else {
                return false;
              }
            break;
    
            case '<':
              playerElementValue = parseFloat(playerElementValue)
              conditionalValue = parseFloat(conditionalValue)
              if (playerElementValue < conditionalValue) {
                return true;
              } else {
                return false;
              }
            break;
    
            case '>=':
              playerElementValue = parseFloat(playerElementValue)
              conditionalValue = parseFloat(conditionalValue)
              if (playerElementValue >= conditionalValue) {
                return true;
              } else {
                return false;
              }
            break;
    
            case '<=':
              playerElementValue = parseFloat(playerElementValue)
              conditionalValue = parseFloat(conditionalValue)
              if (playerElementValue <= conditionalValue) {
                return true;
              } else {
                return false;
              }
            break;
            
            case 'range':
              playerElementValue = parseFloat(playerElementValue)
              conditionalValue = parseFloat(conditionalValue)
              if (playerElementValue >= conditionalValue && playerElementValue <= conditionalSecondaryValue) {
                return true;
              } else {
                return false;
              }
            break;
  
            // String only
            case 'is':
              playerElementValue = playerElementValue.toString()
              conditionalValue = conditionalValue.toString()
              if (playerElementValue === conditionalValue) {
                return true;
              } else {
                return false;
              }
            break;
    
            case 'isNot':
              playerElementValue = playerElementValue.toString()
              conditionalValue = conditionalValue.toString()
              if (playerElementValue !== conditionalValue) {
                return true;
              } else {
                return false;
              }
            break;

            // Array only (least/mostCommon template method values)
            case 'includes':
              if (playerElementValues.includes(conditionalValue)) {
                return true;
              } else {
                return false;
              }
            break;

            case 'notIncludes':
              if (!playerElementValues.includes(conditionalValue)) {
                return true;
              } else {
                return false;
              }
            break;

            case 'includesOnly':
              if (playerElementValues.includes(conditionalValue) && playerElementValues.length === 1) {
                return true;
              } else {
                return false;
              }
            break;
            
            default:
              break;
          }
        }
        
        let checkResult = checkCondition(condition);
        if (checkResult === true) {
          resultToCalculate += '1';
        } else {
          resultToCalculate += '0';
        }
        
        return;
      } else if (condition.conditionOperator) {
        
        if (condition.conditionOperator === 'and') {
          resultToCalculate += '*';
        } else if (condition.conditionOperator === 'or') {
          resultToCalculate += '+';
        }
  
  
        return;
      }
    });
  
    // Actual calculating. Given the expression i.e. "1+1+0*1*0" we can calculate if player should join segment
    let result = eval(resultToCalculate)
  
    if (result >= 1) {
      return true;
    } else if (result === 0) {
      return false;
    }
}
// Adding segmentID string to player segments[] in Player Warehouse
async function addSegmentToPlayer(gameID, branchName, clientID, newSegment) {
    try {
      // Находим игрока по gameID, branchName и clientID
      const player = await PlayerWarehouse.findOne({
        'gameID': gameID,
        'branches': {
          $elemMatch: {
            'branch': branchName,
            'players.clientID': clientID,
          },
        },
      });
  
      if (!player) {
        throw new Error('Player not found');
      }
  
      // Проверяем, существует ли уже такой сегмент у игрока
      if (!player.branches.find(b => b.branch === branchName).players.find(p => p.clientID === clientID).segments.includes(newSegment)) {
        // Если нет, то добавляем новый сегмент
        player.branches.find(b => b.branch === branchName).players.find(p => p.clientID === clientID).segments.push(newSegment);
  
        // Сохраняем изменения
        await player.save();
        incrementSegmentPlayerCount(gameID, branchName, newSegment)
        addClientToSegment(gameID, branchName, newSegment, clientID)
        console.log(`addSegmentToPlayer: Segment '${newSegment}' added to player '${clientID}'`);
      } else {
        console.log(`addSegmentToPlayer: Player '${clientID}' already has the segment '${newSegment}'`);
      }
  
    } catch (error) {
      console.error('addSegmentToPlayer: Error adding segment to player:', error);
    }
}
// Change segment document playerCount after we add new player to segment
async function incrementSegmentPlayerCount(gameID, branchName, segmentID) {
    try {
      const result = await Segments.updateOne(
        {
          'gameID': gameID,
          'branches.branch': branchName,
          'branches.segments.segmentID': segmentID,
        },
        {
          $inc: {
            'branches.$[i].segments.$[j].segmentPlayerCount': 1,
          },
        },
        {
          arrayFilters: [
            { 'i.branch': branchName },
            { 'j.segmentID': segmentID },
          ],
        }
      );
  
      if (result.modifiedCount > 0) {
        // console.log(`incrementSegmentPlayerCount: Successfully incremented segmentPlayerCount for segment '${segmentID}' in branch '${branchName}' of game '${gameID}'`);
      } else {
        // console.log(`incrementSegmentPlayerCount: No document matched for incrementing segmentPlayerCount`);
      }
    } catch (error) {
      console.error('incrementSegmentPlayerCount: Error incrementing segmentPlayerCount:', error);
    }
}

// Removing segmentID string from player's segments[] in Player Warehouse
async function removeSegmentFromPlayer(gameID, branchName, clientID, segmentToRemove) {
    try {
      // Используем $pull для удаления сегмента из массива в MongoDB
      const result = await PlayerWarehouse.updateOne(
        {
          'gameID': gameID,
          'branches.branch': branchName,
          'branches.players.clientID': clientID,
        },
        {
          $pull: {
            'branches.$[i].players.$[j].segments': segmentToRemove,
          },
        },
        {
          arrayFilters: [
            { 'i.branch': branchName },
            { 'j.clientID': clientID },
          ],
        }
      );
  
      if (result.modifiedCount > 0) {
        decrementSegmentPlayerCount(gameID, branchName, segmentToRemove);
        removeClientFromSegment(gameID, branchName, segmentToRemove, clientID)
        // console.log(`removeSegmentFromPlayer Segment '${segmentToRemove}' removed from player '${clientID}'`);
      } else {
        // console.log(`removeSegmentFromPlayer Player '${clientID}' does not have the segment '${segmentToRemove}'`);
      }
    } catch (error) {
      console.error('removeSegmentFromPlayer Error removeSegmentFromPlayer', error);
    }
}
// Change segment document playerCount after we remove player to segment
async function decrementSegmentPlayerCount(gameID, branchName, segmentID) {
    try {
      const result = await Segments.updateOne(
        {
          'gameID': gameID,
          'branches.branch': branchName,
          'branches.segments.segmentID': segmentID,
        },
        {
          $inc: {
            'branches.$[i].segments.$[j].segmentPlayerCount': -1,
          },
        },
        {
          arrayFilters: [
            { 'i.branch': branchName },
            { 'j.segmentID': segmentID },
          ],
        }
      );
  
      if (result.modifiedCount > 0) {
        // console.log(`decrementSegmentPlayerCount: Successfully decremented segmentPlayerCount for segment '${segmentID}' in branch '${branchName}' of game '${gameID}'`);
      } else {
        // console.log(`decrementSegmentPlayerCount: No document matched for decrementing segmentPlayerCount`);
      }
    } catch (error) {
      console.error('decrementSegmentPlayerCount: Error decrementing segmentPlayerCount:', error);
    }
}

async function addClientToSegment(gameID, branchName, segmentID, clientID) {
  try {
    // Найти сегмент по ID
    const segment = await Segments.findOne(
      {
        'gameID': gameID,
        'branches.branch': branchName,
        'branches.segments.segmentID': segmentID,
      });

    if (!segment) {
      throw new Error(`Segment with ID ${segmentID} not found.`);
    }

    // Найти нужный сегмент внутри ветки
    const branch = segment.branches.find((branch) =>
      branch.segments.some((seg) => seg.segmentID === segmentID)
    );

    if (!branch) {
      throw new Error(`Segment with ID ${segmentID} not found in any branch.`);
    }

    // Найти нужный сегмент по ID
    const targetSegment = branch.segments.find((seg) => seg.segmentID === segmentID);

    if (!targetSegment) {
      throw new Error(`Segment with ID ${segmentID} not found.`);
    }

    // Проверить, что clientID ещё не существует в массиве segmentPlayerIDs
    if (!targetSegment.segmentPlayerIDs.includes(clientID)) {
      // Если clientID отсутствует, добавить его
      targetSegment.segmentPlayerIDs.push(clientID);

      // Сохранить изменения
      await segment.save();
      console.log(`Client ID ${clientID} added to Segment ID ${segmentID}.`);
    } else {
      console.log(`Client ID ${clientID} already exists in Segment ID ${segmentID}.`);
    }
  } catch (error) {
    console.error(error.message);
  }
}
async function removeClientFromSegment(gameID, branchName, segmentID, clientID) {
  try {
    // Найти сегмент по ID
    const segment = await Segments.findOne(
      {
        'gameID': gameID,
        'branches.branch': branchName,
        'branches.segments.segmentID': segmentID,
      });

    if (!segment) {
      throw new Error(`Segment with ID ${segmentID} not found.`);
    }

    // Найти нужный сегмент внутри ветки
    const branch = segment.branches.find((branch) =>
      branch.segments.some((seg) => seg.segmentID === segmentID)
    );

    if (!branch) {
      throw new Error(`Segment with ID ${segmentID} not found in any branch.`);
    }

    // Найти нужный сегмент по ID
    const targetSegment = branch.segments.find((seg) => seg.segmentID === segmentID);

    if (!targetSegment) {
      throw new Error(`Segment with ID ${segmentID} not found.`);
    }

    // Проверить, что clientID существует в массиве segmentPlayerIDs
    const clientIndex = targetSegment.segmentPlayerIDs.indexOf(clientID);
    
    if (clientIndex !== -1) {
      // Если clientID существует, удалить его
      targetSegment.segmentPlayerIDs.splice(clientIndex, 1);

      // Сохранить изменения
      await segment.save();
      console.log(`Client ID ${clientID} removed from Segment ID ${segmentID}.`);
    } else {
      console.log(`Client ID ${clientID} does not exist in Segment ID ${segmentID}.`);
    }
  } catch (error) {
    console.error(error.message);
  }
}


module.exports = {
    calculatePlayerSegment,
    addSegmentToPlayer,
    incrementSegmentPlayerCount,
    removeSegmentFromPlayer,
    decrementSegmentPlayerCount,
};