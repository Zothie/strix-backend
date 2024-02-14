const PlayerWarehouse = require('./models/playerWarehouseModel')


// Set elementValue of a given player
async function setElementValue(gameID, branchName, clientID, elementID, elementValue) {
  
    try {
      // Находим объект в модели PlayerWarehouse по gameID и clientID
      let player = await PlayerWarehouse.findOne({
        'gameID': gameID,
        'branches.branch': branchName,
        'branches.players.clientID': clientID,
      });
      
      if (!player) {
        // Если игрок не найден, добавляем нового игрока в соответствующий документ с gameID и branchName
        await PlayerWarehouse.updateOne(
          { 'gameID': gameID, 'branches.branch': branchName },
          {
            $addToSet: {
              'branches.$.players': { clientID: clientID }
            }
          }
        );
      
        // Повторно пытаемся найти игрока после добавления
        player = await PlayerWarehouse.findOne({
          'gameID': gameID,
          'branches.branch': branchName,
          'branches.players.clientID': clientID,
        });
      }
  
      // Найти или создать соответствующую ветку
      let branch = player.branches.find(branch => branch.branch === branchName);
      if (!branch) {
        branch = {
          branch: branchName,
          players: {
            elements: {
              analytics: [],
            },
          },
        };
        player.branches.push(branch);
      }
  
      // Найти соответствующего игрока
      let targetPlayer = branch.players.find(player => player.clientID === clientID);
  
      // Проверка и создание вложенных структур
      if (!targetPlayer) {
        targetPlayer = { clientID: clientID, elements: { analytics: [] } };
        branch.players.push(targetPlayer);
      }
  
      // Найти или создать analyticsCategory
      let analyticsCategory = targetPlayer.elements?.analytics;
      if (!analyticsCategory) {
        targetPlayer.elements = {
          analytics: [],
        };
        analyticsCategory = targetPlayer.elements.analytics;
      }
  
      // Найти соответствующий элемент в массиве analytics
      const analyticsElement = analyticsCategory.find(element => element.elementID === elementID);
  
      if (analyticsElement) {
        // Обновляем значение элемента
        analyticsElement.elementValue = elementValue;
      } else {
        // Если элемент не найден, создаем новый элемент
        analyticsCategory.push({
          elementID: elementID,
          elementValue: elementValue,
        });
      }
      // Сохраняем изменения в базе данных
      await player.save();
  
      console.log(`Successfully updated/created elementValue for gameID: ${gameID}, clientID: ${clientID}, elementID: ${elementID}`);
    } catch (error) {
      console.error('Error updating/creating elementValue:', error);
    }
}
// Set elementValues of a given player. Used for such templateMethods as "mostCommon" & "leastCommon" as they return an array
async function setElementValues(gameID, branchName, clientID, elementID, elementValues) {
  
  
    try {
      // Находим объект в модели PlayerWarehouse по gameID и clientID
      let player = await PlayerWarehouse.findOne({
        'gameID': gameID,
        'branches.branch': branchName,
        'branches.players.clientID': clientID,
      });
      
      if (!player) {
        // Если игрок не найден, добавляем нового игрока в соответствующий документ с gameID и branchName
        await PlayerWarehouse.updateOne(
          { 'gameID': gameID, 'branches.branch': branchName },
          {
            $addToSet: {
              'branches.$.players': { clientID: clientID }
            }
          }
        );
      
        // Повторно пытаемся найти игрока после добавления
        player = await PlayerWarehouse.findOne({
          'gameID': gameID,
          'branches.branch': branchName,
          'branches.players.clientID': clientID,
        });
      }
  
      // Найти или создать соответствующую ветку
      let branch = player.branches.find(branch => branch.branch === branchName);
      if (!branch) {
        branch = {
          branch: branchName,
          players: {
            elements: {
              analytics: [],
            },
          },
        };
        player.branches.push(branch);
      }
  
      // Найти соответствующего игрока
      let targetPlayer = branch.players.find(player => player.clientID === clientID);
  
      // Проверка и создание вложенных структур
      if (!targetPlayer) {
        targetPlayer = { clientID: clientID, elements: { analytics: [] } };
        branch.players.push(targetPlayer);
      }
  
      // Найти или создать analyticsCategory
      let analyticsCategory = targetPlayer.elements?.analytics;
      if (!analyticsCategory) {
        targetPlayer.elements = {
          analytics: [],
        };
        analyticsCategory = targetPlayer.elements.analytics;
      }
  
      // Найти соответствующий элемент в массиве analytics
      const analyticsElement = analyticsCategory.find(element => element.elementID === elementID);
  
      if (analyticsElement) {
        // Обновляем значение элемента
        analyticsElement.elementValues = elementValues;
      } else {
        // Если элемент не найден, создаем новый элемент
        analyticsCategory.push({
          elementID: elementID,
          elementValues: elementValues,
        });
      }
      // Сохраняем изменения в базе данных
      await player.save();
  
      console.log(`Successfully updated/created elementValue for gameID: ${gameID}, clientID: ${clientID}, elementID: ${elementID}`);
    } catch (error) {
      console.error('Error updating/creating elementValue:', error);
    }
}
// Here we set elementValue but only if it doesnt exist
// Needed for 'first sent value' method of templates
async function setElementValueFirstTimeOnly(gameID, branchName, clientID, elementID, elementValue) {
  
    try {
      // Находим объект в модели PlayerWarehouse по gameID и clientID
      let player = await PlayerWarehouse.findOne({
        'gameID': gameID,
        'branches.branch': branchName,
        'branches.players.clientID': clientID,
      });
  
      if (!player) {
        // Если игрок не найден, добавляем нового игрока в соответствующий документ с gameID и branchName
        await PlayerWarehouse.updateOne(
          { 'gameID': gameID, 'branches.branch': branchName },
          {
            $addToSet: {
              'branches.$.players': { clientID: clientID }
            }
          }
        );
  
        // Повторно пытаемся найти игрока после добавления
        player = await PlayerWarehouse.findOne({
          'gameID': gameID,
          'branches.branch': branchName,
          'branches.players.clientID': clientID,
        });
      }
  
      // Найти или создать соответствующую ветку
      let branch = player.branches.find(branch => branch.branch === branchName);
      if (!branch) {
        branch = {
          branch: branchName,
          players: {
            elements: {
              analytics: [],
            },
          },
        };
        player.branches.push(branch);
      }
      // Найти соответствующего игрока
      let targetPlayer = branch.players.find(player => player.clientID === clientID);
  
      // Проверка и создание вложенных структур
      if (!targetPlayer) {
        targetPlayer = { clientID: clientID, elements: { analytics: [] } };
        branch.players.push(targetPlayer);
      }
  
      // Найти или создать analyticsCategory
      let analyticsCategory = targetPlayer.elements?.analytics;
      if (!analyticsCategory) {
        targetPlayer.elements = {
          analytics: [],
        };
        analyticsCategory = targetPlayer.elements.analytics;
      }
  
      // Найти соответствующий элемент в массиве analytics
      const analyticsElement = analyticsCategory.find(element => element.elementID === elementID);
  
      if (!analyticsElement) {
        // Если элемент с elementID не существует, создаем новый элемент
        analyticsCategory.push({
          elementID: elementID,
          elementValue: elementValue,
        });
  
        await player.save();
        console.log(`Successfully updated/created elementValue for gameID: ${gameID}, clientID: ${clientID}, elementID: ${elementID}`);
      } else {
        console.log('Element already exists, so we dont do anything')
      }
  
    } catch (error) {
      console.error('Error updating/creating elementValue:', error);
    }
}
// "Number of events" template method
async function incrementElementValue(gameID, branchName, clientID, elementID) {
  
    try {
      // Находим объект в модели PlayerWarehouse по gameID и clientID
      let player = await PlayerWarehouse.findOne({
        'gameID': gameID,
        'branches.branch': branchName,
        'branches.players.clientID': clientID,
      });
  
      if (!player) {
        // Если игрок не найден, добавляем нового игрока в соответствующий документ с gameID и branchName
        await PlayerWarehouse.updateOne(
          { 'gameID': gameID, 'branches.branch': branchName },
          {
            $addToSet: {
              'branches.$.players': { clientID: clientID }
            }
          }
        );
  
        // Повторно пытаемся найти игрока после добавления
        player = await PlayerWarehouse.findOne({
          'gameID': gameID,
          'branches.branch': branchName,
          'branches.players.clientID': clientID,
        });
      }
  
      // Найти или создать соответствующую ветку
      let branch = player.branches.find(branch => branch.branch === branchName);
      if (!branch) {
        branch = {
          branch: branchName,
          players: {
            elements: {
              analytics: [],
            },
          },
        };
        player.branches.push(branch);
      }
  
      // Найти соответствующего игрока
      let targetPlayer = branch.players.find(player => player.clientID === clientID);
  
      // Проверка и создание вложенных структур
      if (!targetPlayer) {
        targetPlayer = { clientID: clientID, elements: { analytics: [] } };
        branch.players.push(targetPlayer);
      }
  
      // Найти или создать analyticsCategory
      let analyticsCategory = targetPlayer.elements?.analytics;
      if (!analyticsCategory) {
        targetPlayer.elements = {
          analytics: [],
        };
        analyticsCategory = targetPlayer.elements.analytics;
      }
  
      // Найти соответствующий элемент в массиве analytics
      const analyticsElement = analyticsCategory.find(element => element.elementID === elementID);
  
      if (analyticsElement) {
        // Преобразовываем значение из строки в число и затем инкрементируем
        analyticsElement.elementValue = parseInt(analyticsElement.elementValue, 10) + 1;
      } else {
        // Если элемент не найден, создаем новый элемент со значением 1
        analyticsCategory.push({
          elementID: elementID,
          elementValue: 1,
        });
      }
  
      // Сохраняем изменения в базе данных
      await player.save();
  
      console.log(`Successfully updated/created elementValue for gameID: ${gameID}, clientID: ${clientID}, elementID: ${elementID}`);
    } catch (error) {
      console.error('Error updating/creating elementValue:', error);
    }
}
// "Summ" template method
async function addSummToElementValue(gameID, branchName, clientID, elementID, elementFormat, elementValueToAdd) {
  
    try {
      // Находим объект в модели PlayerWarehouse по gameID и clientID
      let player = await PlayerWarehouse.findOne({
        'gameID': gameID,
        'branches.branch': branchName,
        'branches.players.clientID': clientID,
      });
  
      if (!player) {
        // Если игрок не найден, добавляем нового игрока в соответствующий документ с gameID и branchName
        await PlayerWarehouse.updateOne(
          { 'gameID': gameID, 'branches.branch': branchName },
          {
            $addToSet: {
              'branches.$.players': { clientID: clientID }
            }
          }
        );
  
        // Повторно пытаемся найти игрока после добавления
        player = await PlayerWarehouse.findOne({
          'gameID': gameID,
          'branches.branch': branchName,
          'branches.players.clientID': clientID,
        });
      }
  
      // Найти или создать соответствующую ветку
      let branch = player.branches.find(branch => branch.branch === branchName);
      if (!branch) {
        branch = {
          branch: branchName,
          players: {
            elements: {
              analytics: [],
            },
          },
        };
        player.branches.push(branch);
      }
  
      // Найти соответствующего игрока
      let targetPlayer = branch.players.find(player => player.clientID === clientID);
  
      // Проверка и создание вложенных структур
      if (!targetPlayer) {
        targetPlayer = { clientID: clientID, elements: { analytics: [] } };
        branch.players.push(targetPlayer);
      }
  
      // Найти или создать analyticsCategory
      let analyticsCategory = targetPlayer.elements?.analytics;
      if (!analyticsCategory) {
        targetPlayer.elements = {
          analytics: [],
        };
        analyticsCategory = targetPlayer.elements.analytics;
      }
  
      // Найти соответствующий элемент в массиве analytics
      const analyticsElement = analyticsCategory.find(element => element.elementID === elementID);
  
      if (analyticsElement) {
  
        if (elementFormat === 'float' || elementFormat === 'money') {
          const result = parseFloat(analyticsElement.elementValue) + elementValueToAdd;
          analyticsElement.elementValue = result.toFixed(2);
          } else if (elementFormat === 'integer') {
          analyticsElement.elementValue = parseInt(analyticsElement.elementValue, 10) + elementValueToAdd;
        }
  
      } else {
        // Если элемент не найден, создаем новый элемент со значением 1
        analyticsCategory.push({
          elementID: elementID,
          elementValue: elementValueToAdd,
        });
      }
  
      // Сохраняем изменения в базе данных
      await player.save();
  
      console.log(`Successfully updated/created elementValue for gameID: ${gameID}, clientID: ${clientID}, elementID: ${elementID}`);
    } catch (error) {
      console.error('Error updating/creating elementValue:', error);
    }
}

module.exports = {
    setElementValue,
    setElementValues,
    setElementValueFirstTimeOnly,
    incrementElementValue,
    addSummToElementValue
}