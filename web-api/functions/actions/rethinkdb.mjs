import rethinkdb from "rethinkdb";

let dbConnection = null;
const tablesNamespaces = [
  "analytics",
  "offers",
  "entities",
  "abtests",
  "localization",
  "stattemplates",
  "positionedOffers",
];

export function checkDBConnection() {
  return dbConnection;
}

async function initiateDatabase() {
  try {
    await connectToDatabase();
    if (!dbConnection)
      throw new Error("RethinkDB connection is not established");
  } catch (error) {
    console.error("Error connecting to RethinkDB:", error);
  }
}
initiateDatabase();

async function connectToDatabase() {
  try {
    const connection = await rethinkdb.connect({
      host: "localhost",
      port: 28015,
      user: "admin",
      password: process.env.RETHINK_PASSWORD,
    });
    console.log("Connected to RethinkDB");
    dbConnection = connection;
    return connection;
  } catch (err) {
    console.error("Error connecting to RethinkDB:", err);
    dbConnection = null;
  }
}

async function createTable(
  connection,
  dbName,
  tableName,
  userName,
  userPassword
) {
  try {
    // Check if database exists
    const dbList = await rethinkdb.dbList().run(connection);
    if (!dbList.includes(dbName)) {
      await rethinkdb.dbCreate(dbName).run(connection);
      await createAndAssignUser(connection, dbName, userName, userPassword);
      console.log(`Database ${dbName} created`);
    }

    // Check if table exists
    const tableList = await rethinkdb.db(dbName).tableList().run(connection);
    if (!tableList.includes(tableName)) {
      await rethinkdb.db(dbName).tableCreate(tableName).run(connection);
      console.log(`Table ${tableName} created in database ${dbName}`);
    } else {
      console.log(`Table ${tableName} already exists in database ${dbName}`);
    }
  } catch (err) {
    console.error("Error checking/creating table:", err);
  }
}
async function createAndAssignUser(connection, dbName, userName, userPassword) {
  try {
    // Create new user for the created database
    const create = await rethinkdb
      .db("rethinkdb")
      .table("users")
      .insert({ id: userName, password: userPassword })
      .run(connection);
    console.log("Attempting to create user", userName, "result:", create);
    // Grant read permissions to this user
    const grant = await rethinkdb
      .db(dbName)
      .grant(userName, { read: true, write: false, config: false })
      .run(connection);
    console.log(
      "Attempting to grant permissions to user",
      userName,
      "result:",
      grant
    );
  } catch (error) {
    throw error;
  }
}
export async function updateUserPassword(userName, userPassword) {
  try {
    const update = await rethinkdb
      .db("rethinkdb")
      .table("users")
      .update({ id: userName }, { password: userPassword })
      .run(dbConnection);
    console.log(`User ${userName} password updated. Result: ${update}`);
  } catch (err) {
    console.error("Error updating user password:", err);
  }
}

export async function insertData(tableName, body, gameID) {
  //
  // All inbound data must be in the following format: [ { id: 1, ...object }, { id: 2, ...object },... ]
  // Here we make a diff, removing the data that is not present in the current data, and inserting the new data.
  try {
    // Find checksums of all documents we want to insert
    const bodyWithChecksum = body.map((document) => {
      return {
        ...document,
        checksum: calculateChecksum(document),
      };
    });

    // Always try to populate the DB for this game
    // in case this is the first time the table is being used
    const { id, secretKey } = await getGameDocumentIdAndKey(gameID);
    for (const tableName of tablesNamespaces) {
      const dbName = `${id}`;
      await createTable(dbConnection, dbName, tableName, id, secretKey);
    }

    // Releasing the updates on all regions
    if (tablesNamespaces.includes(tableName)) {
      const dbName = `${id}`;

      let result;

      // Getting docs count in the table so we either just insert, or do more complex update
      const count = await rethinkdb
        .db(dbName)
        .table(tableName)
        .count()
        .run(dbConnection);

      if (count > 0) {
        // Get the current data from the table
        const currentData = await rethinkdb
          .db(dbName)
          .table(tableName)
          .coerceTo("array")
          .run(dbConnection);

        // Find the IDs that are absent in the new data and need to be removed from the table
        const newDataIds = body.map((item) => {
          const existingItemIndex = currentData.findIndex(
            (existingItem) => existingItem.id === item.id
          );
          if (existingItemIndex !== -1) {
            // If element exists, update it
            return { ...item, id: currentData[existingItemIndex].id };
          } else {
            // If element does not exist, insert it
            return item;
          }
        });

        // Find IDs to remove from the table as they are not present in the new data
        const idsToRemove = currentData
          .filter(
            (item) => !newDataIds.some((newItem) => newItem.id === item.id)
          )
          .map((item) => item.id);

        // Make diff changes
        result = await rethinkdb
          .db(dbName)
          .table(tableName)
          .forEach((doc) => {
            return rethinkdb.branch(
              rethinkdb.expr(idsToRemove).contains(doc("id")),
              rethinkdb.db(dbName).table(tableName).get(doc("id")).delete(),
              rethinkdb
                .db(dbName)
                .table(tableName)
                .insert(bodyWithChecksum, { conflict: "replace" })
            );
          })
          .run(dbConnection);
      } else {
        result = await rethinkdb
          .db(dbName)
          .table(tableName)
          .insert(bodyWithChecksum, { conflict: "replace" })
          .run(dbConnection);
      }

      // Make sure the data is saved to the persistent storage
      rethinkdb.db(dbName).table(tableName).sync().run(dbConnection);

      console.log(
        "Data inserted into:",
        dbName,
        tableName,
        "\nResult:",
        result
      );
    }
  } catch (err) {
    console.error("Error inserting data:", err);
  }
}

export async function getData(dbName, tableName) {
  try {
    const cursor = await rethinkdb
      .db(dbName)
      .table(tableName)
      .run(dbConnection);
    const result = await cursor.toArray();
    return result;
  } catch (err) {
    console.error("Error getting data:", err);
  }
}

function calculateChecksum(jsonDocument) {
  // We also need to calculate the checksum of the new body so the client can check it before updating
  const jsonString = JSON.stringify(jsonDocument);

  let checksum = 0;
  for (let i = 0; i < jsonString.length; i++) {
    checksum += jsonString.charCodeAt(i);
  }

  return checksum;
}
