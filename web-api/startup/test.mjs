function getRandomDateInRange(startDate, endDate) {
  const startTimestamp = startDate.getTime();
  const endTimestamp = endDate.getTime();
  const randomTimestamp =
    startTimestamp + Math.random() * (endTimestamp - startTimestamp);
  return new Date(randomTimestamp).toISOString();
}
async function populatePlayerWarehouse_brawlDemo(gameID, branchName) {
  const Aelements = [
    // Default elements
    "lastReturnDate",
    "totalPaymentsCount",
    "totalPaymentsSumm",
    "meanPaymentRecency",
    "lastPaymentDate",
    "country",
    "language",
    "platform",
    "meanSessionLength",
    "engineVersion",
    "gameVersion",

    // Fav map
    "663d181077b0dc8621b774c7",
    // Fav gamemode
    "663d182777b0dc8621b77590",
    // Wins
    "663d1b9677b0dc8621b78652",
    // Loses
    "663d1b9f77b0dc8621b7874a",
  ];
  const Selements = [
    // Cups
    "663bd07ccd73d3ab9452ee81",
    // Guild
    "663d095299aa302b3e13095e",
    // Total Matches
    "663d155b77b0dc8621b75750",
    // Fav hero
    "663e45e7be9b75936d06bf7d",
    // Winrate
    "663e4631be9b75936d06c04b",
    // Won in a row
    "663e480ea2e5dcd1c6966b31",
    // Lost in a row
    "663e484c7a10254518c2bdc5",
    // Chars unlocked
    "663e49a3fddd8932e8139146",
  ];
  let segmentCounts = {};

  async function generatePlayer() {
    function getRandomDateInRange(start, end) {
      return new Date(
        start.getTime() + Math.random() * (end.getTime() - start.getTime())
      );
    }

    function getRandomCountry() {
      const countries = [
        { name: "United States", proportion: 0.3 },
        { name: "India", proportion: 0.2 },
        { name: "China", proportion: 0.15 },
        { name: "Germany", proportion: 0.15 },
        { name: "United Kingdom", proportion: 0.125 },
        { name: "Portugal", proportion: 0.025 },
        { name: "France", proportion: 0.025 },
        { name: "Spain", proportion: 0.025 },
      ];

      // Генерация случайного числа от 0 до 1
      const randomValue = Math.random();

      // Применяем кумулятивное распределение
      let cumulative = 0;
      for (const country of countries) {
        cumulative += country.proportion;
        if (randomValue < cumulative) {
          return country.name;
        }
      }
    }

    function getRandomLanguage() {
      const languages = [
        { name: "English", proportion: 0.65 },
        { name: "Chinese", proportion: 0.13 },
        { name: "Indian", proportion: 0.12 },
        { name: "German", proportion: 0.07 },
        { name: "Portuguese", proportion: 0.03 },
        { name: "French", proportion: 0.03 },
        { name: "Spanish", proportion: 0.03 },
      ];

      // Генерация случайного числа от 0 до 1
      const randomValue = Math.random();

      // Применяем кумулятивное распределение
      let cumulative = 0;
      for (const lang of languages) {
        cumulative += lang.proportion;
        if (randomValue < cumulative) {
          return lang.name;
        }
      }
    }

    function getRandomPlatform() {
      const platforms = [
        "Android 10",
        "iOS 14",
        "Windows 10",
        "MacOS 11",
        "Linux",
      ];
      return platforms[Math.floor(Math.random() * platforms.length)];
    }

    function getRandomEngineVersion() {
      const engines = [
        "Unity 2021.3.9f1",
        "Unity 2021.3.8f1",
        "Unity 2021.3.7f1",
        "Unity 2021.3.6f1",
        "Unreal Engine 5.1",
        "Unreal Engine 5.0",
        "Unreal Engine 4.27",
      ];
      return engines[Math.floor(Math.random() * engines.length)];
    }

    function getRandomGameVersion() {
      const versions = ["1.9.1", "1.9.0", "1.8.0", "1.7.0"];
      return versions[Math.floor(Math.random() * versions.length)];
    }

    function getRandomFavMap() {
      const favmaps = [
        { name: "skull_creek", proportion: 0.25 },
        { name: "rockwall_brawl", proportion: 0.2 },
        { name: "dark_passage", proportion: 0.15 },
        { name: "freezing_ripples", proportion: 0.1 },
        { name: "double_trouble", proportion: 0.075 },
        { name: "hard_rock_mine", proportion: 0.075 },
        { name: "undermine", proportion: 0.075 },
        { name: "cool_shapes", proportion: 0.075 },
      ];

      // Генерация случайного числа от 0 до 1
      const randomValue = Math.random();

      // Применяем кумулятивное распределение
      let cumulative = 0;
      for (const map of favmaps) {
        cumulative += map.proportion;
        if (randomValue < cumulative) {
          return map.name;
        }
      }
    }

    function getRandomFavHero() {
      const favhero = [
        { name: "shelly", proportion: 0.35 },
        { name: "edgar", proportion: 0.2 },
        { name: "colt", proportion: 0.15 },
        { name: "poko", proportion: 0.1 },
        { name: "bull", proportion: 0.1 },
        { name: "frank", proportion: 0.1 },
      ];

      // Генерация случайного числа от 0 до 1
      const randomValue = Math.random();

      // Применяем кумулятивное распределение
      let cumulative = 0;
      for (const hero of favhero) {
        cumulative += hero.proportion;
        if (randomValue < cumulative) {
          return hero.name;
        }
      }
    }

    function getRandomFavGamemode() {
      const favgms = [
        { name: "sd", proportion: 0.35 },
        { name: "gem_grab", proportion: 0.25 },
        { name: "duo_sd", proportion: 0.25 },
        { name: "brawlball", proportion: 0.15 },
      ];

      // Генерация случайного числа от 0 до 1
      const randomValue = Math.random();

      // Применяем кумулятивное распределение
      let cumulative = 0;
      for (const gm of favgms) {
        cumulative += gm.proportion;
        if (randomValue < cumulative) {
          return gm.name;
        }
      }
    }

    let global_lrd;
    let global_tpc;
    let global_mpr;

    let uniformRandom = d3.randomUniform(0, 1);
    let normalRandom = d3.randomNormal(5, 2);

    let global_totalMatches = Math.round(d3.randomNormal(500, 50)());
    let global_winrate = d3.randomNormal(0.5, 0.1)();

    let global_losestreak;
    let global_favhero;
    let global_charsunlocked;

    const player = {
      gameID: gameID,
      branch: branchName,
      clientID: uuid(),
      elements: {
        statistics: Selements.map((element) => {
          let tempVal;
          switch (element) {
            // Cups
            case "663bd07ccd73d3ab9452ee81":
              let tempWins = Math.round(global_totalMatches * global_winrate);
              let tempLoses = Math.round(
                global_totalMatches * (1 - global_winrate)
              );
              tempVal =
                Math.round(tempWins * d3.randomUniform(20, 25)()) +
                Math.round(tempLoses * d3.randomUniform(-5, 8)());
              break;

            // Guild
            case "663d095299aa302b3e13095e":
              tempVal = uniformRandom(0, 1) <= 0.65 ? "True" : "False";
              break;

            // Fav hero
            case "663e45e7be9b75936d06bf7d":
              tempVal = getRandomFavHero();
              global_favhero = tempVal;
              break;

            // Total matches
            case "663d155b77b0dc8621b75750":
              tempVal = global_totalMatches;
              break;

            // Winrate
            case "663e4631be9b75936d06c04b":
              tempVal = parseFloat((global_winrate * 100).toFixed(2));
              break;

            // Won in a row
            case "663e480ea2e5dcd1c6966b31":
              tempVal = Math.abs(Math.round(d3.randomNormal(2, 5)()));
              break;

            // Lost in a row
            case "663e484c7a10254518c2bdc5":
              tempVal = Math.abs(Math.round(d3.randomNormal(3, 1)()));
              global_losestreak = tempVal;
              break;

            // Chars unlocked
            case "663e49a3fddd8932e8139146":
              tempVal = uniformRandom(0, 1) <= 0.39 ? "True" : "False";
              global_charsunlocked = tempVal;
              break;
          }
          return { elementID: element, elementValue: tempVal };
        }),
        analytics: Aelements.map((element) => {
          let tempVal;
          switch (element) {
            case "lastReturnDate":
              tempVal =
                uniformRandom(0, 1) < 0.95
                  ? getRandomDateInRange(
                      new Date(),
                      new Date(Date.now() - 1000 * 60 * 60 * 24 * 25)
                    )
                  : getRandomDateInRange(
                      new Date(),
                      new Date(Date.now() - 1000 * 60 * 60 * 24 * 30)
                    );
              global_lrd = new Date(tempVal);
              break;

            case "lastPaymentDate":
              if (global_mpr !== -1) {
                // Устанавливаем диапазон дат в зависимости от meanPaymentRecency
                const daysAgo = Math.min(
                  15,
                  Math.max(3, Math.ceil(global_mpr))
                );
                tempVal = getRandomDateInRange(
                  global_lrd,
                  new Date(Date.now() - 1000 * 60 * 60 * 24 * daysAgo)
                );
              } else {
                tempVal = new Date(0); // Если нет платежей, установим нулевую дату
              }
              break;

            case "totalPaymentsCount":
              const randValue = uniformRandom();
              if (randValue < 0.9) {
                tempVal = 0;
              } else if (randValue < 0.95) {
                tempVal = Math.max(1, Math.floor(normalRandom(5, 2))); // Значения между 1 и 10
              } else {
                tempVal = Math.floor(normalRandom(20, 5)); // Значения выше 10
              }
              global_tpc = tempVal;
              break;

            case "totalPaymentsSumm":
              tempVal = parseFloat(
                (global_tpc * Math.max(1, d3.randomNormal(0.5, 1)())).toFixed(2)
              );
              break;

            case "meanPaymentRecency":
              if (global_tpc !== 0) {
                // Более управляемый расчет meanPaymentRecency
                const baseRecency = 30; // Базовое значение, для расчета средних дней между платежами
                tempVal = baseRecency / global_tpc;
                // Добавим немного случайности, чтобы значения не были слишком однообразными
                tempVal *= uniformRandom(0.8, 1.2);
                tempVal = parseFloat(Math.max(0, tempVal).toFixed(1)); // Убедимся, что значение не меньше 1
              } else {
                tempVal = -1;
              }
              global_mpr = tempVal;
              break;

            case "country":
              tempVal = getRandomCountry();
              break;

            case "language":
              tempVal = getRandomLanguage();
              break;

            case "platform":
              tempVal = getRandomPlatform();
              break;

            case "meanSessionLength":
              tempVal = Math.floor(d3.randomNormal(1800, 100)());
              break;

            case "engineVersion":
              tempVal = getRandomEngineVersion();
              break;

            case "gameVersion":
              tempVal = getRandomGameVersion();
              break;

            // Fav map
            case "663d181077b0dc8621b774c7":
              tempVal = getRandomFavMap();
              break;

            // Fav gamemode
            case "663d182777b0dc8621b77590":
              tempVal = getRandomFavGamemode();
              break;

            // Wins
            case "663d1b9677b0dc8621b78652":
              tempVal = Math.round(global_totalMatches * global_winrate);
              break;

            // Loses
            case "663d1b9f77b0dc8621b7874a":
              tempVal = Math.round(global_totalMatches * (1 - global_winrate));
              break;
          }
          return { elementID: element, elementValue: tempVal };
        }),
      },
      inventory: [],
      goods: [],
      abtests: [],
      segments: [],
    };

    const possibleSegments = [
      // Chars unlocked
      "663e2c06f9318aad701a93d9",

      // FavHero edgar
      "663e611e511c1fb47b4e59f5",

      // FavHero bull
      "663e6132511c1fb47b4e5ae2",

      // Lose streak >3
      "663e6143511c1fb47b4e5b82",
    ];
    player.segments.push("everyone");
    possibleSegments.forEach((segment) => {
      switch (segment) {
        case "663e2c06f9318aad701a93d9":
          if (global_charsunlocked === "True") {
            player.segments.push(segment);
          }
          break;
        case "663e611e511c1fb47b4e59f5":
          if (global_favhero === "edgar") {
            player.segments.push(segment);
          }
          break;
        case "663e6132511c1fb47b4e5ae2":
          if (global_favhero === "bull") {
            player.segments.push(segment);
          }
          break;
        case "663e6143511c1fb47b4e5b82":
          if (global_losestreak > 3) {
            player.segments.push(segment);
          }
          break;
      }
    });

    player.segments.forEach((segment) => {
      if (!segmentCounts[segment]) {
        segmentCounts[segment] = 0;
      }
      segmentCounts[segment]++;
    });

    return player;
  }

  const totalBatches = 1;
  const batchSize = 10000;

  console.log(
    "Player generation started with totalBatches:",
    totalBatches,
    "and batchSize:",
    batchSize
  );

  const res = await PWplayers.deleteMany({
    gameID: isDemoGameID(gameID),
    branch: branchName,
  });
  console.log("Deleted players", res);

  console.log(
    "Generating players for PW. Batch size: " +
      batchSize +
      ", total batches: " +
      totalBatches
  );
  for (let i = 0; i < totalBatches; i++) {
    console.log("Generating batch " + (i + 1) + " of " + totalBatches);
    const playerPromises = Array.from({ length: batchSize }, () =>
      generatePlayer()
    );
    const players = await Promise.all(playerPromises);

    console.log("Populated player warehouse, saving");
    try {
      await PWplayers.collection.insertMany(players);
    } catch (error) {
      console.log("Error inserting players:", error);
    }
    console.log("Saved");
  }

  const segments = await Segments.findOne({
    gameID,
    "branches.branch": branchName,
  });
  const branch = segments.branches.find((b) => b.branch === branchName);
  branch.segments.forEach((segment) => {
    segment.segmentPlayerCount = segmentCounts[segment.segmentID];
  });
  console.log("Populated segments, saving");
  await segments.save();

  console.log("Populated database");
}
async function hardPopulation() {
  // await populatePlayerWarehouse_brawlDemo('brawlDemo', 'development')
  // await cachePlayers('8e116fca-66c4-4669-beb9-56d99940f70d', 'development')
}
// hardPopulation();

async function testFunctionPW() {
  const gameID = "8e116fca-66c4-4669-beb9-56d99940f70d";
  const branchName = "development";
  const segmentID = "everyone";
  const clientID = "99e0999b-e891-4782-bf18-c5833c73fa12";

  // const players = await PWplayers.find(
  //   {gameID, 'elements.analytics': { $elemMatch: {'elementID': 'totalPaymentsCount', 'elementValue': { $gt: 0 } } }}
  // ).count()
  // console.log('players', players)
  // let playerWarehouse = await PWtemplates.findOne({
  //   gameID,
  //   'branches.branch': branchName,
  // });
  // console.log('playerWarehouse', playerWarehouse)
}
// testFunctionPW()

async function populateElements(gameID, branchName) {
  await PWtemplates.findOneAndUpdate(
    { gameID: gameID, "branches.branch": branchName },
    {
      $push: {
        "branches.$.templates.analytics": {
          templateID: "lastReturnDate",
          templateName: "Last Return Date",
          templateDefaultVariantType: "date",
        },
      },
    },
    {
      new: true,
    }
  );
  await PWtemplates.findOneAndUpdate(
    { gameID: gameID, "branches.branch": branchName },
    {
      $push: {
        "branches.$.templates.analytics": {
          templateID: "lastPaymentDate",
          templateName: "Last Payment Date",
          templateDefaultVariantType: "date",
        },
      },
    },
    {
      new: true,
    }
  );
  await PWtemplates.findOneAndUpdate(
    { gameID: gameID, "branches.branch": branchName },
    {
      $push: {
        "branches.$.templates.analytics": {
          templateID: "totalPaymentsSumm",
          templateName: "Total Payments Summ",
          templateDefaultVariantType: "float",
        },
      },
    },
    {
      new: true,
    }
  );
  await PWtemplates.findOneAndUpdate(
    { gameID: gameID, "branches.branch": branchName },
    {
      $push: {
        "branches.$.templates.analytics": {
          templateID: "totalPaymentsCount",
          templateName: "Total Payments Count",
          templateDefaultVariantType: "integer",
        },
      },
    },
    {
      new: true,
    }
  );
  await PWtemplates.findOneAndUpdate(
    { gameID: gameID, "branches.branch": branchName },
    {
      $push: {
        "branches.$.templates.analytics": {
          templateID: "country",
          templateName: "Country",
          templateDefaultVariantType: "string",
        },
      },
    },
    {
      new: true,
    }
  );
  await PWtemplates.findOneAndUpdate(
    { gameID: gameID, "branches.branch": branchName },
    {
      $push: {
        "branches.$.templates.analytics": {
          templateID: "engineVersion",
          templateName: "Engine Version",
          templateDefaultVariantType: "string",
        },
      },
    },
    {
      new: true,
    }
  );
  await PWtemplates.findOneAndUpdate(
    { gameID: gameID, "branches.branch": branchName },
    {
      $push: {
        "branches.$.templates.analytics": {
          templateID: "gameVersion",
          templateName: "Game Version",
          templateDefaultVariantType: "string",
        },
      },
    },
    {
      new: true,
    }
  );
  await PWtemplates.findOneAndUpdate(
    { gameID: gameID, "branches.branch": branchName },
    {
      $push: {
        "branches.$.templates.analytics": {
          templateID: "language",
          templateName: "Language",
          templateDefaultVariantType: "string",
        },
      },
    },
    {
      new: true,
    }
  );
  await PWtemplates.findOneAndUpdate(
    { gameID: gameID, "branches.branch": branchName },
    {
      $push: {
        "branches.$.templates.analytics": {
          templateID: "platform",
          templateName: "Platform",
          templateDefaultVariantType: "string",
        },
      },
    },
    {
      new: true,
    }
  );
  await PWtemplates.findOneAndUpdate(
    { gameID: gameID, "branches.branch": branchName },
    {
      $push: {
        "branches.$.templates.analytics": {
          templateID: "meanSessionLength",
          templateName: "Mean. Session Length",
          templateDefaultVariantType: "integer",
        },
      },
    },
    {
      new: true,
    }
  );
  console.log("Populated templates");
}
// populateElements('c4a6f94b-fad9-481a-bb1e-3a1d42f40559', 'development')


async function populateABtests(gameID) {
  const newABTests = new ABTests({
    gameID: gameID,
    branches: [
      {
        branch: 'development',
        tests: [],
      },
      {
        branch: 'stage',
        tests: [],
      },
      {
        branch: 'production',
        tests: [],
      },
    ],
  });
  await newABTests.save();
}


async function cleanAllDemos() {
  // Remove all demo studios, publishers and users which IDs start with demo_
  

  // REMAKE THIS FUNCTION SO IT ONLY CLEANS DEMO DATA OF DEMO USERS
  // OTHERWISE IT WILL REMOVE DEMO GAMES GIVEN TO REGULAR USERS AFTER ONBOARDING
  await Studio.deleteMany({ studioID: /^demo_/ })
  await Publisher.deleteMany({ publisherID: /^demo_/ })
  await User.deleteMany({ isDemo: true })
  for (const demoID of demoGames) {
    const query = { gameID: new RegExp(`^${demoID}_`) };
    console.log('Removing demo games for:', demoID, '| Query:', query)
    await Game.deleteMany(query);
    await NodeModel.deleteMany(query);
    await Segments.deleteMany(query);
    await Relations.deleteMany(query);
    await PWtemplates.deleteMany(query);
    await AnalyticsEvents.deleteMany(query);
    await RemoteConfig.deleteMany(query);
    await PlanningTreeModel.deleteMany(query);
    await Offers.deleteMany(query);
    await CustomCharts.deleteMany(query);
    await ABTests.deleteMany(query);
    await Localization.deleteMany(query);
  }
}
// cleanAllDemos()