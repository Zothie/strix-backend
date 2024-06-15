// rethinkdb.js

import rdb from "rethinkdb";

// Establish RethinkDB connection
export const connectToRethinkDB = async () => {
  try {
    const conn = await rdb.connect({ host: "localhost", port: 28015 });
    return conn;
  } catch (err) {
    throw err;
  }
};

// Other RethinkDB related functions
export const createTable = async (conn, tableName) => {
  try {
    const result = await rdb.db("test").tableCreate(tableName).run(conn);
    return result;
  } catch (err) {
    throw err;
  }
};

// Export other RethinkDB related functions as needed
