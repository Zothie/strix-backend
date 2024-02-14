const fetch = require('node-fetch'); 
const moment = require('moment');
const dayjs = require('dayjs');
var utc = require('dayjs/plugin/utc')
dayjs.extend(utc)


const druidURL = 'http://192.168.243.128:8082/druid/v2/?pretty'

// 
// Player Warehouse management
// 

// Get all clientIDs for the last month and recalculate all their segments
async function getRecentClientIDs(gameID, buildType) {
    
    const endDate = moment().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'); // Today
    const startDate = moment().subtract(1, 'month').format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'); // Today minus month

    const interval = `${startDate}/${endDate}`;
    

    const query = {
        "queryType": "timeseries",
        "dataSource": {
          "type": "table",
          "name": "New Sessions"
        },
        "intervals": {
          "type": "intervals",
          "intervals": [
            `${interval}`
          ]
        },
        "filter": {
            "type": "and",
            "fields": [
              {
                "type": "equals",
                "column": "gameID",
                "matchValueType": "STRING",
                "matchValue": gameID
              },
              {
                "type": "equals",
                "column": "buildType",
                "matchValueType": "STRING",
                "matchValue": buildType
              }
            ]
        },
        "granularity": {
          "type": "all"
        },
        "aggregations": [
          {
            "type": "expression",
            "name": "uniqueIDs",
            "fields": [
              "clientID"
            ],
            "accumulatorIdentifier": "__acc",
            "initialValue": "ARRAY<STRING>[]",
            "initialCombineValue": "ARRAY<STRING>[]",
            "isNullUnlessAggregated": true,
            "shouldAggregateNullInputs": true,
            "shouldCombineAggregateNullInputs": false,
            "fold": "array_set_add(\"__acc\", \"clientID\")",
            "combine": "array_set_add_all(\"__acc\", \"uniqueIDs\")",
            "maxSizeBytes": 1024
          }
        ]
      }

    try {
        const response = await fetch(druidURL, {
            method: 'POST',
            body: JSON.stringify(query),
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();

        return data[0].result.uniqueIDs;

    } catch (error) {
        console.error(error)
    }
};

// Getting the latest or the earliest value of given event in Druid records
async function getMostRecentValue(gameID, buildType, clientID, eventType, eventID, valueColumn) {
  
  const query = {
    "queryType": "timeseries",
    "dataSource": {
      "type": "table",
      "name": "Design Events"
    },
    "intervals": {
      "type": "intervals",
      "intervals": [
        "-146136543-09-08T08:23:32.096Z/146140482-04-24T15:36:27.903Z"
      ]
    },
    "filter": {
      "type": "and",
      "fields": [
        {
          "type": "equals",
          "column": "gameID",
          "matchValueType": "STRING",
          "matchValue": gameID
        },
        {
          "type": "equals",
          "column": "buildType",
          "matchValueType": "STRING",
          "matchValue": buildType
        },
        {
          "type": "equals",
          "column": "clientID",
          "matchValueType": "STRING",
          "matchValue": clientID
        },
        {
          "type": "equals",
          "column": "eventType",
          "matchValueType": "STRING",
          "matchValue": eventType
        },
        {
          "type": "equals",
          "column": "eventID",
          "matchValueType": "STRING",
          "matchValue": eventID
        }
      ]
    },
    "granularity": {
      "type": "all"
    },
    "aggregations": [
      {
        "type": "stringLast",
        "name": "a0",
        "fieldName": valueColumn,
        "timeColumn": "__time",
        "maxStringBytes": 1024
      }
    ]
  }

  try {
      const response = await fetch(druidURL, {
          method: 'POST',
          body: JSON.stringify(query),
          headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();

      return data[0].result.a0

  } catch (error) {
      console.error(error)
  }
}
async function getFirstEventValue(gameID, buildType, clientID, eventType, eventID, valueColumn) {

  const query = {
    "queryType": "timeseries",
    "dataSource": {
      "type": "table",
      "name": "Design Events"
    },
    "intervals": {
      "type": "intervals",
      "intervals": [
        "-146136543-09-08T08:23:32.096Z/146140482-04-24T15:36:27.903Z"
      ]
    },
    "filter": {
      "type": "and",
      "fields": [
        {
          "type": "equals",
          "column": "gameID",
          "matchValueType": "STRING",
          "matchValue": gameID
        },
        {
          "type": "equals",
          "column": "buildType",
          "matchValueType": "STRING",
          "matchValue": buildType
        },
        {
          "type": "equals",
          "column": "clientID",
          "matchValueType": "STRING",
          "matchValue": clientID
        },
        {
          "type": "equals",
          "column": "eventType",
          "matchValueType": "STRING",
          "matchValue": eventType
        },
        {
          "type": "equals",
          "column": "eventID",
          "matchValueType": "STRING",
          "matchValue": eventID
        }
      ]
    },
    "granularity": {
      "type": "all"
    },
    "aggregations": [
      {
        "type": "stringFirst",
        "name": "a0",
        "fieldName": valueColumn,
        "timeColumn": "__time",
        "maxStringBytes": 1024
      }
    ]
  }

  try {
      const response = await fetch(druidURL, {
          method: 'POST',
          body: JSON.stringify(query),
          headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();

      return data[0].result.a0

  } catch (error) {
      console.error(error)
  }

}

// Finding an array of the most common values in given events.
async function getMostCommonValue(gameID, buildType, clientID, eventType, eventID, targetValue) {
    
    const query = {
        "queryType": "topN",
        "dataSource": {
          "type": "table",
          "name": "Design Events"
        },
        "dimension": {
          "type": "default",
          "dimension": targetValue,
          "outputName": "d0",
          "outputType": "STRING"
        },
        "metric": {
          "type": "numeric",
          "metric": "a0"
        },
        "threshold": 1001,
        "intervals": {
          "type": "intervals",
          "intervals": [
            "-146136543-09-08T08:23:32.096Z/146140482-04-24T15:36:27.903Z"
          ]
        },
        "filter": {
          "type": "and",
          "fields": [
            {
              "type": "equals",
              "column": "gameID",
              "matchValueType": "STRING",
              "matchValue": gameID
            },
            {
                "type": "equals",
                "column": "buildType",
                "matchValueType": "STRING",
                "matchValue": buildType
            },
            {
              "type": "equals",
              "column": "clientID",
              "matchValueType": "STRING",
              "matchValue": clientID
            },
            {
              "type": "equals",
              "column": "eventID",
              "matchValueType": "STRING",
              "matchValue": eventID
            },
            {
              "type": "equals",
              "column": "eventType",
              "matchValueType": "STRING",
              "matchValue": eventType
            }
          ]
        },
        "granularity": {
          "type": "all"
        },
        "aggregations": [
          {
            "type": "count",
            "name": "a0"
          }
        ],
        "context": {
          "queryId": "2de19945-2242-4c75-99f3-7b724a878260",
          "sqlOuterLimit": 1001,
          "sqlQueryId": "2de19945-2242-4c75-99f3-7b724a878260",
          "useNativeQueryExplain": true
        }
    }

    try {
        const response = await fetch(druidURL, {
            method: 'POST',
            body: JSON.stringify(query),
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();

        function findMostFrequentNumbers(arr) {
            if (arr.length === 0) {
              return [];
            }
          
            const maxCount = arr[0].a0;
            const result = [];
          
            for (const item of arr) {
              if (item.a0 === maxCount) {
                result.push(item.d0);
              } else {
                // Поскольку массив отсортирован по убыванию, когда мы достигаем
                // элемента с меньшим значением a0, можем завершить поиск.
                break;
              }
            }
          
            return result;
        }

        const cleanedResult = findMostFrequentNumbers(data[0].result)
        return cleanedResult;

    } catch (error) {
        console.error(error)
    }
};

// Finding an array of the least common values in given events.
async function getLeastCommonValue(gameID, buildType, clientID, eventType, eventID, targetValue) {
    
    const query = {
        "queryType": "topN",
        "dataSource": {
          "type": "table",
          "name": "Design Events"
        },
        "dimension": {
          "type": "default",
          "dimension": targetValue,
          "outputName": "d0",
          "outputType": "STRING"
        },
        "metric": {
            "type": "inverted",
            "metric": {
              "type": "numeric",
              "metric": "a0"
            }
        },
        "threshold": 1001,
        "intervals": {
          "type": "intervals",
          "intervals": [
            "-146136543-09-08T08:23:32.096Z/146140482-04-24T15:36:27.903Z"
          ]
        },
        "filter": {
          "type": "and",
          "fields": [
            {
              "type": "equals",
              "column": "gameID",
              "matchValueType": "STRING",
              "matchValue": gameID
            },
            {
                "type": "equals",
                "column": "buildType",
                "matchValueType": "STRING",
                "matchValue": buildType
            },
            {
              "type": "equals",
              "column": "clientID",
              "matchValueType": "STRING",
              "matchValue": clientID
            },
            {
              "type": "equals",
              "column": "eventID",
              "matchValueType": "STRING",
              "matchValue": eventID
            },
            {
              "type": "equals",
              "column": "eventType",
              "matchValueType": "STRING",
              "matchValue": eventType
            }
          ]
        },
        "granularity": {
          "type": "all"
        },
        "aggregations": [
          {
            "type": "count",
            "name": "a0"
          }
        ],
        "context": {
          "queryId": "2de19945-2242-4c75-99f3-7b724a878260",
          "sqlOuterLimit": 1001,
          "sqlQueryId": "2de19945-2242-4c75-99f3-7b724a878260",
          "useNativeQueryExplain": true
        }
      }

    try {
        const response = await fetch(druidURL, {
            method: 'POST',
            body: JSON.stringify(query),
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        
        function findLeastFrequentNumbers(arr) {
            if (arr.length === 0) {
              return [];
            }
          
            const minCount = arr[0].a0;
            const result = [];
          
            for (const item of arr) {
              if (item.a0 === minCount) {
                result.push(item.d0);
              } else {
                // Поскольку массив отсортирован по возрастанию, когда мы достигаем
                // элемента с большим значением a0, можем завершить поиск.
                break;
              }
            }
          
            return result;
        }
        const cleanedResult = findLeastFrequentNumbers(data[0].result)
        return cleanedResult;

    } catch (error) {
        console.error(error)
    }
};

// Finding median average with druid-median-extension
async function getMeanValue(gameID, buildType, clientID, eventType, eventID, targetValue, isFloat) {
    

    const query = {
        "queryType": "timeseries",
        "dataSource": {
          "type": "table",
          "name": "Design Events"
        },
        "intervals": {
          "type": "intervals",
          "intervals": [
            "-146136543-09-08T08:23:32.096Z/146140482-04-24T15:36:27.903Z"
          ]
        },
        "virtualColumns": [
            {
                "type": "expression",
                "name": "v0",
                "expression": `CAST(\"${targetValue}\", 'DOUBLE')`,
                "outputType": "FLOAT"
            }
        ],
        "filter": {
          "type": "and",
          "fields": [
            {
              "type": "equals",
              "column": "gameID",
              "matchValueType": "STRING",
              "matchValue": gameID
            },
            {
                "type": "equals",
                "column": "buildType",
                "matchValueType": "STRING",
                "matchValue": buildType
            },
            {
              "type": "equals",
              "column": "clientID",
              "matchValueType": "STRING",
              "matchValue": clientID
            },
            {
              "type": "equals",
              "column": "eventID",
              "matchValueType": "STRING",
              "matchValue": eventID
            },
            {
              "type": "equals",
              "column": "eventType",
              "matchValueType": "STRING",
              "matchValue": eventType
            }
          ]
        },
        "granularity": {
          "type": "all"
        },
        "aggregations": [
            {
              "type": "median",
              "name": "a0",
              "fieldName": "v0"
            }
        ],
        "context": {
          "queryId": "fb6be9d7-24e8-406d-bb65-e27f251e4b09",
          "sqlOuterLimit": 1001,
          "sqlQueryId": "fb6be9d7-24e8-406d-bb65-e27f251e4b09",
          "useNativeQueryExplain": true
        }
    }

    try {
        const response = await fetch(druidURL, {
            method: 'POST',
            body: JSON.stringify(query),
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();

        let result

        if (isFloat) {
            result = data[0].result.a0.toFixed(2)   
        } else {
            result = parseInt(data[0].result.a0)
        }
        return result;

    } catch (error) {
        console.error(error)
    }
};
async function getMeanValueForTime(gameID, buildType, clientID, eventType, eventID, targetValue, isFloat, days) {
    
    // Dont mind if I do
    let sanitizedDays = days
    if (days === '' || days === null || days === undefined || days === 0) {
        sanitizedDays = 1
    }


    const endDate = moment().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'); // Today
    const startDate = moment().subtract(sanitizedDays, 'days').format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'); // Today minus N days


    const interval = `${startDate}/${endDate}`;


    const query = {
        "queryType": "timeseries",
        "dataSource": {
          "type": "table",
          "name": "Design Events"
        },
        "intervals": {
          "type": "intervals",
          "intervals": [
            interval
          ]
        },
        "virtualColumns": [
            {
                "type": "expression",
                "name": "v0",
                "expression": `CAST(\"${targetValue}\", 'DOUBLE')`,
                "outputType": "FLOAT"
            }
        ],
        "filter": {
          "type": "and",
          "fields": [
            {
              "type": "equals",
              "column": "gameID",
              "matchValueType": "STRING",
              "matchValue": gameID
            },
            {
                "type": "equals",
                "column": "buildType",
                "matchValueType": "STRING",
                "matchValue": buildType
            },
            {
              "type": "equals",
              "column": "clientID",
              "matchValueType": "STRING",
              "matchValue": clientID
            },
            {
              "type": "equals",
              "column": "eventID",
              "matchValueType": "STRING",
              "matchValue": eventID
            },
            {
              "type": "equals",
              "column": "eventType",
              "matchValueType": "STRING",
              "matchValue": eventType
            }
          ]
        },
        "granularity": {
          "type": "all"
        },
        "aggregations": [
            {
              "type": "median",
              "name": "a0",
              "fieldName": "v0"
            }
        ],
        "context": {
          "queryId": "fb6be9d7-24e8-406d-bb65-e27f251e4b09",
          "sqlOuterLimit": 1001,
          "sqlQueryId": "fb6be9d7-24e8-406d-bb65-e27f251e4b09",
          "useNativeQueryExplain": true
        }
    }

    try {
        const response = await fetch(druidURL, {
            method: 'POST',
            body: JSON.stringify(query),
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();

        let result

        if (isFloat) {
            result = data[0].result.a0.toFixed(2)  
        } else {
            result = parseInt(data[0].result.a0)
        }
        return result;

    } catch (error) {
        console.error(error)
    }
};

// Finding summ of a given event
async function getSummValue(gameID, buildType, clientID, eventType, eventID, targetValue, isFloat) {
    
    
    const query = {
        "queryType": "timeseries",
        "dataSource": {
          "type": "table",
          "name": "Design Events"
        },
        "intervals": {
          "type": "intervals",
          "intervals": [
            "-146136543-09-08T08:23:32.096Z/146140482-04-24T15:36:27.903Z"
          ]
        },
        "virtualColumns": [
          {
            "type": "expression",
            "name": "v0",
            "expression": `CAST(\"${targetValue}\", 'DOUBLE')`,
            "outputType": "DOUBLE"
          }
        ],
        "filter": {
          "type": "and",
          "fields": [
            {
              "type": "equals",
              "column": "gameID",
              "matchValueType": "STRING",
              "matchValue": gameID
            },
            {
              "type": "equals",
              "column": "clientID",
              "matchValueType": "STRING",
              "matchValue": clientID
            },
            {
                "type": "equals",
                "column": "buildType",
                "matchValueType": "STRING",
                "matchValue": buildType
            },
            {
              "type": "equals",
              "column": "eventID",
              "matchValueType": "STRING",
              "matchValue": eventID
            },
            {
              "type": "equals",
              "column": "eventType",
              "matchValueType": "STRING",
              "matchValue": eventType
            }
          ]
        },
        "granularity": {
          "type": "all"
        },
        "aggregations": [
          {
            "type": "doubleSum",
            "name": "a0",
            "fieldName": "v0"
          }
        ],
        "context": {
          "queryId": "7ff9e1a5-368f-44d3-928b-153dba2b231a",
          "sqlOuterLimit": 1001,
          "sqlQueryId": "7ff9e1a5-368f-44d3-928b-153dba2b231a",
          "useNativeQueryExplain": true
        }
    }

    try {
        const response = await fetch(druidURL, {
            method: 'POST',
            body: JSON.stringify(query),
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();

        let result

        if (isFloat) {
            result = data[0].result.a0.toFixed(2)   
        } else {
            result = parseInt(data[0].result.a0)
        }
        return result;

    } catch (error) {
        console.error(error)
    }
};
async function getSummValueForTime(gameID, buildType, clientID, eventType, eventID, targetValue, isFloat, days) {
    
    // Dont mind if I do
    let sanitizedDays = days
    if (days === '' || days === null || days === undefined || days === 0) {
        sanitizedDays = 1
    }


    const endDate = moment().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'); // Today
    const startDate = moment().subtract(sanitizedDays, 'days').format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'); // Today minus N days


    const interval = `${startDate}/${endDate}`;
    
    const query = {
        "queryType": "timeseries",
        "dataSource": {
          "type": "table",
          "name": "Design Events"
        },
        "intervals": {
          "type": "intervals",
          "intervals": [
            interval
          ]
        },
        "virtualColumns": [
          {
            "type": "expression",
            "name": "v0",
            "expression": `CAST(\"${targetValue}\", 'DOUBLE')`,
            "outputType": "DOUBLE"
          }
        ],
        "filter": {
          "type": "and",
          "fields": [
            {
              "type": "equals",
              "column": "gameID",
              "matchValueType": "STRING",
              "matchValue": gameID
            },
            {
              "type": "equals",
              "column": "clientID",
              "matchValueType": "STRING",
              "matchValue": clientID
            },
            {
                "type": "equals",
                "column": "buildType",
                "matchValueType": "STRING",
                "matchValue": buildType
            },
            {
              "type": "equals",
              "column": "eventID",
              "matchValueType": "STRING",
              "matchValue": eventID
            },
            {
              "type": "equals",
              "column": "eventType",
              "matchValueType": "STRING",
              "matchValue": eventType
            }
          ]
        },
        "granularity": {
          "type": "all"
        },
        "aggregations": [
          {
            "type": "doubleSum",
            "name": "a0",
            "fieldName": "v0"
          }
        ],
        "context": {
          "queryId": "7ff9e1a5-368f-44d3-928b-153dba2b231a",
          "sqlOuterLimit": 1001,
          "sqlQueryId": "7ff9e1a5-368f-44d3-928b-153dba2b231a",
          "useNativeQueryExplain": true
        }
    }

    try {
        const response = await fetch(druidURL, {
            method: 'POST',
            body: JSON.stringify(query),
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();

        let result

        if (isFloat) {
            result = data[0].result.a0.toFixed(2)   
        } else {
            result = parseInt(data[0].result.a0)
        }
        return result;

    } catch (error) {
        console.error(error)
    }
};


// Finding number of events by given criteria for all time
async function getEventNumber(gameID, buildType, clientID, eventType, eventID, valueColumn) {

  const query = {
    "queryType": "timeseries",
    "dataSource": {
      "type": "table",
      "name": "Design Events"
    },
    "intervals": {
      "type": "intervals",
      "intervals": [
        "-146136543-09-08T08:23:32.096Z/146140482-04-24T15:36:27.903Z"
      ]
    },
    "filter": {
      "type": "and",
      "fields": [
        {
          "type": "equals",
          "column": "gameID",
          "matchValueType": "STRING",
          "matchValue": gameID
        },
        {
          "type": "equals",
          "column": "buildType",
          "matchValueType": "STRING",
          "matchValue": buildType
        },
        {
          "type": "equals",
          "column": "clientID",
          "matchValueType": "STRING",
          "matchValue": clientID
        },
        {
          "type": "equals",
          "column": "eventType",
          "matchValueType": "STRING",
          "matchValue": eventType
        },
        {
          "type": "equals",
          "column": "eventID",
          "matchValueType": "STRING",
          "matchValue": eventID
        }
      ]
    },
    "granularity": {
      "type": "all"
    },
    "aggregations": [
      {
        "type": "filtered",
        "aggregator": {
          "type": "count",
          "name": "a0"
        },
        "filter": {
          "type": "not",
          "field": {
            "type": "null",
            "column": valueColumn
          }
        },
        "name": "a0"
      }
    ]
  }

  try {
      const response = await fetch(druidURL, {
          method: 'POST',
          body: JSON.stringify(query),
          headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();

      return data[0].result.a0

  } catch (error) {
      console.error(error)
  }

}
// Finding number of events by given criteria for a given last N days
async function getNumberOfEventsForTime(gameID, buildType, clientID, eventType, eventID, days) {
    
    // Dont mind if I do
    let sanitizedDays = days
    if (days === '' || days === null || days === undefined || days === 0) {
        sanitizedDays = 1
    }


    const endDate = moment().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'); // Today
    const startDate = moment().subtract(sanitizedDays, 'days').format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'); // Today minus N days


    const interval = `${startDate}/${endDate}`;
    
    const query = {
        "queryType": "timeseries",
        "dataSource": {
          "type": "table",
          "name": "Design Events"
        },
        "intervals": {
          "type": "intervals",
          "intervals": [
            interval
          ]
        },
        "filter": {
          "type": "and",
          "fields": [
            {
              "type": "equals",
              "column": "gameID",
              "matchValueType": "STRING",
              "matchValue": gameID
            },
            {
              "type": "equals",
              "column": "clientID",
              "matchValueType": "STRING",
              "matchValue": clientID
            },
            {
                "type": "equals",
                "column": "buildType",
                "matchValueType": "STRING",
                "matchValue": buildType
            },
            {
              "type": "equals",
              "column": "eventID",
              "matchValueType": "STRING",
              "matchValue": eventID
            },
            {
              "type": "equals",
              "column": "eventType",
              "matchValueType": "STRING",
              "matchValue": eventType
            }
          ]
        },
        "granularity": {
          "type": "all"
        },
        "aggregations": [
          {
            "type": "count",
            "name": "a0"
          }
        ],
        "context": {
          "queryId": "3e97426b-1325-4b2a-a751-ccf2730211ad",
          "sqlOuterLimit": 1001,
          "sqlQueryId": "3e97426b-1325-4b2a-a751-ccf2730211ad",
          "useNativeQueryExplain": true
        }
    }

    try {
        const response = await fetch(druidURL, {
            method: 'POST',
            body: JSON.stringify(query),
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        
        let result = data[0].result.a0

        return result;

    } catch (error) {
        console.error(error)
    }
};



// 
// Analytics
// 
function getGranularity(dateDiff) {
  if (dateDiff <= 1) {
    return 'minute'
  } else if (dateDiff < 7) {
    return 'hour'
  } else if (dateDiff >= 7) {
    return 'day'
  }
}

// 
// Analytics Dashboard - General
// 
// New Users for the given time
async function getNewUsers(gameID, buildType, startDate, endDate, dateDiff, clientIDs) {
  function makeFilters() {
    let fields = [
        {
            "type": "equals",
            "column": "gameID",
            "matchValueType": "STRING",
            "matchValue": gameID
        },
        {
            "type": "equals",
            "column": "buildType",
            "matchValueType": "STRING",
            "matchValue": buildType
        },
        {
            "type": "equals",
            "column": "isNewPlayer",
            "matchValueType": "STRING",
            "matchValue": "true"
        }
    ];
  
    // Добавляем фильтр 'in' только если массив clientIDs содержит элементы
    if (clientIDs.length > 0) {
        fields.unshift({
            "type": "in",
            "dimension": "clientID",
            "values": clientIDs
        });
    }
    return fields
  }

  const intervalStartDate = startDate.toISOString()
  const intervalEndDate = endDate.toISOString()
  const daysBetweenDates = dateDiff;
  
    // Minutes by default if we're looking in range below 7 days
    let granularity = 'minute';
    granularity = getGranularity(daysBetweenDates);

    const interval = `${intervalStartDate}/${intervalEndDate}`;

    const query = {
        "queryType": "groupBy",
        "dataSource": {
          "type": "table",
          "name": "New Sessions"
        },
        "granularity": granularity,
        "filter": {
            "type": "and",
            "fields": makeFilters()
        },
          "aggregations":[
            {
               "type":"count",
               "name":"count"
            }
            ],
          "intervals": {
            "type": "intervals",
            "intervals": [
              interval
            ]
        }
    }

    try {
        const response = await fetch(druidURL, {
            method: 'POST',
            body: JSON.stringify(query),
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();

        
        if (data.error !== undefined) {
            return {success: false, error: data.error}
        }
        
        const cleanedData = data.map(item => ({
          timestamp: item.timestamp,
          value: item.event.count
        }));


      return {success: true, data: cleanedData, granularity}

    } catch (error) {
      console.error(error)
      return {success: false}
    }
};
// Daily Active Users
async function getDAU(gameID, buildType, startDate, endDate, dateDiff, clientIDs) {
  function makeFilters() {
    let fields = [
        {
            "type": "equals",
            "column": "gameID",
            "matchValueType": "STRING",
            "matchValue": gameID
        },
        {
            "type": "equals",
            "column": "buildType",
            "matchValueType": "STRING",
            "matchValue": buildType
        }
    ];
  
    // Добавляем фильтр 'in' только если массив clientIDs содержит элементы
    if (clientIDs.length > 0) {
        fields.unshift({
            "type": "in",
            "dimension": "clientID",
            "values": clientIDs
        });
    }
    return fields
  }

  const intervalStartDate = startDate.toISOString()
  const intervalEndDate = endDate.toISOString()
  const daysBetweenDates = dateDiff;
  
    // Minutes by default if we're looking in range below 7 days
    let granularity = 'minute';
    granularity = getGranularity(daysBetweenDates);

    const interval = `${intervalStartDate}/${intervalEndDate}`;
    
    const query = {
        "queryType": "topN",
        "dataSource": {
          "type": "table",
          "name": "New Sessions"
        },
        "dimension": {
          "type": "default",
          "dimension": "clientID",
          "outputName": "clientID",
          "outputType": "STRING"
        },
        "metric": {
          "type": "inverted",
          "metric": {
            "type": "numeric",
            "metric": "timestamp"
          }
        },
        "threshold": 1001,
        "intervals": {
          "type": "intervals",
          "intervals": [
            interval
          ]
        },
        "granularity": "all",
        "filter": {
            "type": "and",
            "fields": makeFilters()
        },
        "aggregations": [
          {
            "type": "longMin",
            "name": "timestamp",
            "fieldName": "__time"
          }
        ],
        "context" : {
          "skipEmptyBuckets": "true"
        }
    }

    try {
        const response = await fetch(druidURL, {
            method: 'POST',
            body: JSON.stringify(query),
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();

        if (data.error !== undefined) {
            return {success: false, error: data.error}
        }
        if (data.length === 0) {
          return {success: false, error: 'No Data returned'}
        }
        
        // Since Druid's granularity won't work for us and break things, we need to keep Druid's granularity as "all"
        // and process users on our own, rounding results to minutes/hours/days.
        // If we set any other type of granularity in Druid's granularity in query, it will return
        // unique user per this granularity. Because it counts unique values by the granularity, not by the interval.
        // I.e. if we need DAU and write "hour" in query, it will count the same user twice if he entered an app in different hours
        function countPeopleByTime(data, timeUnit) {
          const counts = {};

          data.forEach((entry) => {
            const timestamp = entry.timestamp;
            const roundedTime = roundTime(timestamp, timeUnit);
        
            if (!counts[roundedTime]) {
              counts[roundedTime] = new Set();
            }
        
            counts[roundedTime].add(entry.clientID);
          });
        
          const result = Object.keys(counts).map((key) => ({
            timestamp: Number(key),
            count: counts[key].size,
          }));
        
          return result;
        }
        
        // Here we round raw timestamp to a minute, hour or day
        function roundTime(timestamp, timeUnit) {
          const date = new Date(timestamp);
        
          if (timeUnit === 'minute') {
            date.setSeconds(0, 0);
          } else if (timeUnit === 'hour') {
            date.setMinutes(0, 0, 0);
          } else if (timeUnit === 'day') {
            date.setHours(0, 0, 0, 0);
          }
          
          return date.getTime();
        }

        // Finally process data to a unified format
        const cleanedData = countPeopleByTime(data[0].result, granularity).map(item => ({
          timestamp: new Date(item.timestamp),
          value: item.count
        }));
        
      return {success: true, data: cleanedData, granularity}

    } catch (error) {
      console.error(error)
      return {success: false}
    }
};
// Revenue from InApp Events
async function getRevenue(gameID, buildType, startDate, endDate, dateDiff, clientIDs) {
  function makeFilters() {
    let fields = [
        {
            "type": "equals",
            "column": "gameID",
            "matchValueType": "STRING",
            "matchValue": gameID
        },
        {
            "type": "equals",
            "column": "buildType",
            "matchValueType": "STRING",
            "matchValue": buildType
        }
    ];
  
    // Добавляем фильтр 'in' только если массив clientIDs содержит элементы
    if (clientIDs.length > 0) {
        fields.unshift({
            "type": "in",
            "dimension": "clientID",
            "values": clientIDs
        });
    }
    return fields
  }

  const intervalStartDate = startDate.toISOString()
  const intervalEndDate = endDate.toISOString()
  const daysBetweenDates = dateDiff;
  
    // Minutes by default if we're looking in range below 7 days
    let granularity = 'minute';
    granularity = getGranularity(daysBetweenDates);

    const interval = `${intervalStartDate}/${intervalEndDate}`;
    
    const query = {
        "queryType": "groupBy",
        "dataSource": {
          "type": "table",
          "name": "InApp Events"
        },
        "intervals": {
          "type": "intervals",
          "intervals": [
            interval
          ]
        },
        "granularity": granularity,
        "filter": {
            "type": "and",
            "fields": makeFilters()
        },
        "aggregations": [
          {
            "type": "doubleSum",
            "name": "total_revenue",
            "fieldName": "price"
          }
        ],
        "context" : {
          "skipEmptyBuckets": "true"
        }
    }

    try {
        const response = await fetch(druidURL, {
            method: 'POST',
            body: JSON.stringify(query),
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();

        if (data.error !== undefined) {
          return {success: false, error: data.error}
        }
        if (data.length === 0) {
          return {success: false, error: 'No Data returned'}
        }
        
        
        const cleanedData = data.map(item => ({
          timestamp: item.timestamp,
          value: item.event.total_revenue.toFixed(2)
        }));
        

      return {success: true, data: cleanedData, granularity}

    } catch (error) {
      console.error(error)
      return {success: false}
    }
};
// Get retention of users for the time interval (i.e. calculate the retention of new users who came this week)
async function getRetention(gameID, buildType, startDate, endDate, dateDiff, clientIDs) {
  function makeFilters() {
    let fields = [
        {
            "type": "equals",
            "column": "gameID",
            "matchValueType": "STRING",
            "matchValue": gameID
        },
        {
            "type": "equals",
            "column": "buildType",
            "matchValueType": "STRING",
            "matchValue": buildType
        },
        {
            "type": "equals",
            "column": "isNewPlayer",
            "matchValueType": "STRING",
            "matchValue": "true"
        }
    ];
  
    // Добавляем фильтр 'in' только если массив clientIDs содержит элементы
    if (clientIDs.length > 0) {
        fields.unshift({
            "type": "in",
            "dimension": "clientID",
            "values": clientIDs
        });
    }
    return fields
  }

  const intervalStartDate = startDate.toISOString()
  const intervalEndDate = endDate.toISOString()
  const daysBetweenDates = Math.round(dateDiff);
  
    // Minutes by default if we're looking in range below 7 days
    let granularity = 'minute';
    granularity = getGranularity(daysBetweenDates);

    const interval = `${intervalStartDate}/${intervalEndDate}`;
    
    // Query for new users in given interval. Use them later to query retention for each clientID
    const query = {
        "queryType": "topN",
        "dataSource": {
          "type": "table",
          "name": "New Sessions"
        },
        "dimension": {
          "type": "default",
          "dimension": "clientID",
          "outputName": "clientID",
          "outputType": "STRING"
        },
        "metric": {
          "type": "dimension",
          "ordering": {
            "type": "lexicographic"
          }
        },
        "granularity": {
          "type": "all"
        },
        "filter": {
            "type": "and",
            "fields": makeFilters()
        },
        "threshold": 1001,
        "aggregations": [],
        "intervals": {
          "type": "intervals",
          "intervals": [
            interval
          ]
        }
    }

    try {
        const response = await fetch(druidURL, {
            method: 'POST',
            body: JSON.stringify(query),
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();

        
        if (data.error !== undefined) {
            return {success: false, error: data.error}
        }
        if (data.length === 0) return {success: false, error: data.error}

        // Getting an array of new clients for a given time interval. We later use it to calculate retention for each one
        const newClients = data[0].result.map((obj) => obj.clientID);

        

        let clientSessions = newClients.map(clientID => ({ clientID, days: [] }));

        // Make it zero because sometimes we need to count retention from an array of clients
        // And if we offset the date, we will get Day0 retention for all clients except
        // those who were new at the startDate
        let retentionStartDayOffset = 0;

        // Add count to iteration number. Otherwise if we query users for the week, we will get
        // Day28 for the first day clients, but for the 7th day we will get Day21 at max since the
        // month for them is still not ended, but we stopped calculating because it is for the first guys.
        let daysToCountRetention = 28+daysBetweenDates

        for (let i = 0; i < daysToCountRetention; i++) {
          const date = dayjs.utc(startDate).add(i + retentionStartDayOffset, 'day').hour(0).minute(0).second(0).millisecond(0).format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
          const endDate = dayjs.utc(startDate).add(i + retentionStartDayOffset, 'day').hour(23).minute(59).second(59).millisecond(999).format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');

      
          // Query to get if given clientIDs called New Session event given day.
          // Returns an array of objects and true/false value
          const checkDayRetentionQuery = 
        {
          "queryType": "topN",
          "dataSource": {
            "type": "table",
            "name": "New Sessions"
          },
          "dimension": {
            "type": "default",
            "dimension": "clientID",
            "outputName": "clientID",
            "outputType": "STRING"
          },
          "metric": {
            "type": "dimension",
            "ordering": {
              "type": "lexicographic"
            }
          },
          "threshold": 1001,
          "intervals": {
            "type": "intervals",
            "intervals": [
              `${date}/${endDate}`
            ]
          },
          "filter": {
            "type": "and",
            "fields": [
            {
              "type": "equals",
              "column": "gameID",
              "matchValueType": "STRING",
              "matchValue": gameID
            },
            {
              "type": "equals",
              "column": "buildType",
              "matchValueType": "STRING",
              "matchValue": buildType
            },
            {
            
              "type": "in",
              "dimension": "clientID",
              "values": newClients
            }
            ]
          },
          "granularity": {
            "type": "all"
          },
          "aggregations": [
            {
              "type": "count",
              "name": "sessions"
            }
          ],
          "postAggregations": [
            {
              "type": "expression",
              "name": "wasPresent",
              "expression": "case_searched((\"sessions\" > 0),'true','false')",
              "outputType": "STRING"
            }
          ]
          }
      
          try {
            const response = await fetch(druidURL, {
              method: 'POST',
              body: JSON.stringify(checkDayRetentionQuery),
              headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();

            if (data.error !== undefined) {
              return {success: false, error: data.error}
            }

            if (data.length === 0) continue
            
            // Add corresponding day to an array, if client were there
            data[0].result.forEach(result => {
              if (result === undefined) return
              const clientID = result.clientID;
              const hadSession = result.wasPresent === 'true';
              if (hadSession) {
                const client = clientSessions.find(c => c.clientID === clientID);
                client.days.push(endDate);
              }
            });
      
          } catch (error) {
            console.error('Error fetching data:', error);
          }
        }
        

        // Calculate retention days for all users.
        // Turning i.e. [12-12-2023, 13-12-2023, 14-12-2023] to [0, 1, 2]
        clientSessions.forEach(client => {
          // Convert dates to dayjs objects and sort
          let sortedDates = client.days.map(day => dayjs.utc(day)).sort((a, b) => a - b);
        
          // Calculate retention days
          client.days = sortedDates.map(date => date.diff(sortedDates[0], 'day'));
        });
        
        // Summ up all retention values and count how many users are there for Day0, Day1 etc
        const resultRetention = Array.from({ length: 29 }, (_, i) => ({
          day: i,
          retentionCount: clientSessions.reduce((total, obj) => total + obj.days.filter(day => day === i).length, 0)
        }));
      

      return {success: true, data: resultRetention, granularity}

    } catch (error) {
      console.error(error)
      return {success: false}
    }
};
// Daily Active Users
async function getARPDAU(gameID, buildType, startDate, endDate, dateDiff, clientIDs) {
  function makeFilters() {
    let fields = [
        {
            "type": "equals",
            "column": "gameID",
            "matchValueType": "STRING",
            "matchValue": gameID
        },
        {
            "type": "equals",
            "column": "buildType",
            "matchValueType": "STRING",
            "matchValue": buildType
        }
    ];
  
    // Добавляем фильтр 'in' только если массив clientIDs содержит элементы
    if (clientIDs.length > 0) {
        fields.unshift({
            "type": "in",
            "dimension": "clientID",
            "values": clientIDs
        });
    }
    return fields
  }

  const intervalStartDate = startDate.toISOString()
  const intervalEndDate = endDate.toISOString()
  const daysBetweenDates = dateDiff;
  
    // Minutes by default if we're looking in range below 7 days
    let granularity = 'minute';
    granularity = getGranularity(daysBetweenDates);

    const interval = `${intervalStartDate}/${intervalEndDate}`;

    // Get Unique Users for the given time interval
    const uniqueUsers = {
      "queryType": "topN",
      "dataSource": {
        "type": "table",
        "name": "New Sessions"
      },
      "dimension": {
        "type": "default",
        "dimension": "clientID",
        "outputName": "clientID",
        "outputType": "STRING"
      },
      "metric": {
        "type": "dimension",
        "ordering": {
          "type": "lexicographic"
        }
      },
      "threshold": 1001,
      "intervals": {
        "type": "intervals",
        "intervals": [
          interval
        ]
      },
      "granularity": "day",
      "filter": {
          "type": "and",
          "fields": makeFilters()
      }
    }

    try {
        const response = await fetch(druidURL, {
            method: 'POST',
            body: JSON.stringify(uniqueUsers),
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        
        

        if (data.error !== undefined) {
            return {success: false, error: data.error}
        }
        if (data.length === 0) {
          return {success: false, error: 'No Data returned'}
        }

        // Calculate ARPU per day
        async function processUserData(data) {
          const results = [];
        
          for (const item of data) {

            const activeUsers = item.result.map((item) => item.clientID);

            // Find revenue per user for the given time interval
            const revenuePerUser = {
          "queryType": "groupBy",
          "dataSource": {
            "type": "table",
            "name": "InApp Events"
          },
          "dimensions": ["clientID"],
          "aggregations": [
            {
              "type": "doubleSum",
              "name": "total_revenue",
              "fieldName": "price"
            }
          ],
          "intervals": {
            "type": "intervals",
            "intervals": [
              interval
            ]
          },
          "granularity": "all",
          "filter": {
              "type": "and",
              "fields": [
                {
                    "type": "equals",
                    "column": "gameID",
                    "matchValueType": "STRING",
                    "matchValue": gameID
                },
                {
                    "type": "equals",
                    "column": "buildType",
                    "matchValueType": "STRING",
                    "matchValue": buildType
                },
                {
                  "type": "in",
                  "dimension": "clientID",
                  "values": activeUsers
                }
            ]
          }
            }

           
            const revenuePerUserResponse = await fetch(druidURL, {
              method: 'POST',
              body: JSON.stringify(revenuePerUser),
              headers: { 'Content-Type': 'application/json' },
            });
        
            const revenuePerUserData = await revenuePerUserResponse.json();

            if (revenuePerUserData.error !== undefined) {
              // Skip executing
            } else if (revenuePerUserData.length === 0) {
              // Skip executing
            } else {
              // Continue executing
              let cleanedRPUData = revenuePerUserData.map((item) => ({
                clientID: item.event.clientID,
                value: item.event.total_revenue.toFixed(2),
              }));
        
              activeUsers.forEach((clientID) => {
                if (!cleanedRPUData.some((client) => client.clientID === clientID)) {
                  cleanedRPUData.push({ clientID: clientID, value: '0.00' });
                }
              });
        
              const revenues = cleanedRPUData.map((client) => parseFloat(client.value));
              const medianRevenue = findAverage(revenues).toFixed(2);
              results.push({ timestamp: item.timestamp, value: medianRevenue });
            }
          }
        
          return results;
        }
        
        function findAverage(numbers) {
          if (numbers.length === 0) {
            return 0; 
          }
        
          const sum = numbers.reduce((accumulator, currentValue) => accumulator + currentValue, 0);
          const average = sum / numbers.length;
          return average;
        }


        try {
          let ARPDAU = {};
          ARPDAU = await processUserData(data);
          // console.log('arpdau', ARPDAU);
          return { success: true, data: ARPDAU, granularity: 'day' };
        } catch (error) {
          console.error(error);
          return { success: false, message: 'Internal Server Error' };
        }
        // Always do 'day' granularity because ARPDAU only counts pre day
      

    } catch (error) {
      console.error(error)
      return {success: false}
    }
};
// Cumulative ARPU. Calculated by taking new players at startDate and summing their ARPDAU till the endDate
async function getCumulativeARPU(gameID, buildType, startDate, endDate, dateDiff, clientIDs) {
      function makeFilters() {
    let fields = [
        {
            "type": "equals",
            "column": "gameID",
            "matchValueType": "STRING",
            "matchValue": gameID
        },
        {
            "type": "equals",
            "column": "buildType",
            "matchValueType": "STRING",
            "matchValue": buildType
        },
        {
            "type": "equals",
            "column": "isNewPlayer",
            "matchValueType": "STRING",
            "matchValue": "true"
        }
    ];
  
    // Добавляем фильтр 'in' только если массив clientIDs содержит элементы
    if (clientIDs.length > 0) {
        fields.unshift({
            "type": "in",
            "dimension": "clientID",
            "values": clientIDs
        });
    }
    return fields
      }

      const intervalStartDate = dayjs.utc(startDate).hour(0).minute(0).second(0).millisecond(0).format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
      const intervalEndDate = dayjs.utc(startDate).hour(23).minute(59).second(59).millisecond(999).format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
      const daysBetweenDates = Math.round(dateDiff);


      // Minutes by default if we're looking in range below 7 days
      let granularity = 'minute';
    
      // Always day for cumulative ARPU
      granularity = 'day'
      const interval = `${intervalStartDate}/${intervalEndDate}`;
      
      // Query for new users in given interval. Use them later to query retention for each clientID
      const query = {
      "queryType": "topN",
      "dataSource": {
        "type": "table",
        "name": "New Sessions"
      },
      "dimension": {
        "type": "default",
        "dimension": "clientID",
        "outputName": "clientID",
        "outputType": "STRING"
      },
      "metric": {
        "type": "dimension",
        "ordering": {
          "type": "lexicographic"
        }
      },
      "granularity": {
        "type": "all"
      },
      "filter": {
          "type": "and",
          "fields": makeFilters()
      },
      "threshold": 1001,
      "aggregations": [],
      "intervals": {
        "type": "intervals",
        "intervals": [
          interval
        ]
      }
      }
  
      try {
        const response = await fetch(druidURL, {
            method: 'POST',
            body: JSON.stringify(query),
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        
        
        if (data.error !== undefined) {
            return {success: false, error: data.error}
        }
        if (data.length === 0) return {success: false, error: data.error}

        // Building an array of new players for a given day
        const cohortOfNewPlayers = data[0].result.map((obj) => obj.clientID);
        // console.log(cohortOfNewPlayers)
        
        // Calculate ARPU per day
        async function processUserData(data) {
          const results = [];

          // Used exactly for finding cumulative ARPU, so we append all values of ARPUs here
          let cumulativeValue = 0;
        
          for (let i = 0; i <= daysBetweenDates; i++) {
            
            let targetDateStart = dayjs.utc(startDate).add(i, 'day');
            targetDateStart = targetDateStart.hour(0).minute(0).second(0).millisecond(0).format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
            
            let targetDateEnd = dayjs.utc(startDate).add(i, 'day');
            targetDateEnd = targetDateEnd.hour(23).minute(59).second(59).millisecond(999).format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');

            // Find revenue per user for the given time interval
            const revenuePerUser = {
          "queryType": "groupBy",
          "dataSource": {
            "type": "table",
            "name": "InApp Events"
          },
          "dimensions": ["clientID"],
          "aggregations": [
            {
              "type": "doubleSum",
              "name": "total_revenue",
              "fieldName": "price"
            }
          ],
          "intervals": {
            "type": "intervals",
            "intervals": [
              `${targetDateStart}/${targetDateEnd}`
            ]
          },
          "granularity": "all",
          "filter": {
              "type": "and",
              "fields": [
                {
                    "type": "equals",
                    "column": "gameID",
                    "matchValueType": "STRING",
                    "matchValue": gameID
                },
                {
                    "type": "equals",
                    "column": "buildType",
                    "matchValueType": "STRING",
                    "matchValue": buildType
                },
                {
                  "type": "in",
                  "dimension": "clientID",
                  "values": cohortOfNewPlayers
                }
            ]
          }
            }

           
            const revenuePerUserResponse = await fetch(druidURL, {
              method: 'POST',
              body: JSON.stringify(revenuePerUser),
              headers: { 'Content-Type': 'application/json' },
            });
        
            const revenuePerUserData = await revenuePerUserResponse.json();
            if (revenuePerUserData.error !== undefined) {
              results.push({ timestamp: targetDateStart, value: 0 });
            } else if (revenuePerUserData.length === 0) {
              results.push({ timestamp: targetDateStart, value: 0 });
            } else {
              // Continue executing
              let cleanedRPUData = revenuePerUserData.map((item) => ({
                clientID: item.event.clientID,
                value: item.event.total_revenue.toFixed(2),
              }));
        
              cohortOfNewPlayers.forEach((clientID) => {
                if (!cleanedRPUData.some((client) => client.clientID === clientID)) {
                  cleanedRPUData.push({ clientID: clientID, value: '0.00' });
                }
              });
        
              const revenues = cleanedRPUData.map((client) => parseFloat(client.value));
              const medianRevenue = findAverage(revenues).toFixed(2);
              cumulativeValue += parseFloat(medianRevenue);
              results.push({ timestamp: targetDateStart, value: cumulativeValue });
            }
          }
        
          return results;
        }
        
        function findAverage(numbers) {
          if (numbers.length === 0) {
            return 0; 
          }
        
          const sum = numbers.reduce((accumulator, currentValue) => accumulator + currentValue, 0);
          const average = sum / numbers.length;
          return average;
        }


        try {
          let ARPDAU = {};
          ARPDAU = await processUserData(data);
          
          return { success: true, data: ARPDAU, granularity: 'day' };
        } catch (error) {
          console.error(error);
          return { success: false, message: 'Internal Server Error' };
        }
        // Always do 'day' granularity because ARPDAU only counts pre day
        
      } catch (error) {

      }
          
};
// Daily Active Users
async function getPayingUsersShare(gameID, buildType, startDate, endDate, dateDiff, clientIDs) {
  function makeFilters() {
    let fields = [
        {
            "type": "equals",
            "column": "gameID",
            "matchValueType": "STRING",
            "matchValue": gameID
        },
        {
            "type": "equals",
            "column": "buildType",
            "matchValueType": "STRING",
            "matchValue": buildType
        }
    ];
  
    // Добавляем фильтр 'in' только если массив clientIDs содержит элементы
    if (clientIDs.length > 0) {
        fields.unshift({
            "type": "in",
            "dimension": "clientID",
            "values": clientIDs
        });
    }
    return fields
  }

  const intervalStartDate = startDate.toISOString()
  const intervalEndDate = endDate.toISOString()
  const daysBetweenDates = dateDiff;
  
    // Minutes by default if we're looking in range below 7 days
    let granularity = 'minute';
    granularity = getGranularity(daysBetweenDates);

    const interval = `${intervalStartDate}/${intervalEndDate}`;
    
    // Unique users in time interval
    const query = {
        "queryType": "topN",
        "dataSource": {
          "type": "table",
          "name": "New Sessions"
        },
        "dimension": {
          "type": "default",
          "dimension": "clientID",
          "outputName": "clientID",
          "outputType": "STRING"
        },
        "metric": {
          "type": "inverted",
          "metric": {
            "type": "numeric",
            "metric": "timestamp"
          }
        },
        "threshold": 1001,
        "intervals": {
          "type": "intervals",
          "intervals": [
            interval
          ]
        },
        "granularity": "all",
        "filter": {
            "type": "and",
            "fields": makeFilters()
        },
        "aggregations": [
          {
            "type": "longMin",
            "name": "timestamp",
            "fieldName": "__time"
          }
        ],
        "context" : {
          "skipEmptyBuckets": "true"
        }
    }

    try {
        const response = await fetch(druidURL, {
            method: 'POST',
            body: JSON.stringify(query),
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();

        if (data.error !== undefined) {
            return {success: false, error: data.error}
        }
        if (data.length === 0) {
          return {success: false, error: 'No Data returned'}
        }
        
        
        const clientIDs = data[0].result.map(item => item.clientID);
        
        // If there are no players in given time interval, dont bother calculating revenue and just return
        if (clientIDs === undefined || clientIDs.length === 0) return {success: false}

        // Find revenue per user for the given time interval
        const revenuePerUser = {
          "queryType": "groupBy",
          "dataSource": {
            "type": "table",
            "name": "InApp Events"
          },
          "dimensions": ["clientID"],
          "aggregations": [
            {
              "type": "doubleSum",
              "name": "total_revenue",
              "fieldName": "price"
            }
          ],
          "intervals": {
            "type": "intervals",
            "intervals": [
              interval
            ]
          },
          "granularity": "all",
          "filter": {
              "type": "and",
              "fields": makeFilters()
          }
        }

        const revenuePerUserResponse = await fetch(druidURL, {
          method: 'POST',
          body: JSON.stringify(revenuePerUser),
          headers: { 'Content-Type': 'application/json' },
        });
    
        const revenuePerUserData = await revenuePerUserResponse.json()

        if (revenuePerUserData.error !== undefined) {
          // Skip executing
        } else if (revenuePerUserData.length === 0) {
          // Skip executing
        } else {
          // Continue executing
          let cleanedRPUData = revenuePerUserData.map((item) => ({
            clientID: item.event.clientID,
            value: item.event.total_revenue.toFixed(2),
          }));
        }

        if (revenuePerUserData.length === 0) {
          return {success: true, data: [{data1: 0}, {data2: clientIDs.length}], granularity}
        } else {
          return {success: true, data: [{data1: revenuePerUserData.length}, {data2: clientIDs.length}], granularity}
        }
        
      
    } catch (error) {
      console.error(error)
      return {success: false}
    }
};
// Average Revenue per user
async function getARPPU(gameID, buildType, startDate, endDate, dateDiff, clientIDs) {
  function makeFilters() {
    let fields = [
        {
            "type": "equals",
            "column": "gameID",
            "matchValueType": "STRING",
            "matchValue": gameID
        },
        {
            "type": "equals",
            "column": "buildType",
            "matchValueType": "STRING",
            "matchValue": buildType
        }
    ];
  
    // Добавляем фильтр 'in' только если массив clientIDs содержит элементы
    if (clientIDs.length > 0) {
        fields.unshift({
            "type": "in",
            "dimension": "clientID",
            "values": clientIDs
        });
    }
    return fields
  }

  const intervalStartDate = startDate.toISOString()
  const intervalEndDate = endDate.toISOString()
  const daysBetweenDates = dateDiff;
  
    // Minutes by default if we're looking in range below 7 days
    let granularity = 'minute';
    granularity = getGranularity(daysBetweenDates);

    const interval = `${intervalStartDate}/${intervalEndDate}`;

    // Get Unique Users for the given time interval
    const uniqueUsers = {
      "queryType": "topN",
      "dataSource": {
        "type": "table",
        "name": "New Sessions"
      },
      "dimension": {
        "type": "default",
        "dimension": "clientID",
        "outputName": "clientID",
        "outputType": "STRING"
      },
      "metric": {
        "type": "dimension",
        "ordering": {
          "type": "lexicographic"
        }
      },
      "threshold": 1001,
      "intervals": {
        "type": "intervals",
        "intervals": [
          interval
        ]
      },
      "granularity": "day",
      "filter": {
          "type": "and",
          "fields": makeFilters()
      }
    }

    try {
        const response = await fetch(druidURL, {
            method: 'POST',
            body: JSON.stringify(uniqueUsers),
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        
        

        if (data.error !== undefined) {
            return {success: false, error: data.error}
        }
        if (data.length === 0) {
          return {success: false, error: 'No Data returned'}
        }

        // Calculate ARPPU per day
        async function processUserData(data) {
          const results = [];
        
          for (const item of data) {

            const activeUsers = item.result.map((item) => item.clientID);

            // Find revenue per user for the given time interval
            const revenuePerUser = {
          "queryType": "groupBy",
          "dataSource": {
            "type": "table",
            "name": "InApp Events"
          },
          "dimensions": ["clientID"],
          "aggregations": [
            {
              "type": "doubleSum",
              "name": "total_revenue",
              "fieldName": "price"
            }
          ],
          "intervals": {
            "type": "intervals",
            "intervals": [
              interval
            ]
          },
          "granularity": "all",
          "filter": {
              "type": "and",
              "fields": [
                {
                    "type": "equals",
                    "column": "gameID",
                    "matchValueType": "STRING",
                    "matchValue": gameID
                },
                {
                    "type": "equals",
                    "column": "buildType",
                    "matchValueType": "STRING",
                    "matchValue": buildType
                },
                {
                  "type": "in",
                  "dimension": "clientID",
                  "values": activeUsers
                }
            ]
          }
            }

           
            const revenuePerUserResponse = await fetch(druidURL, {
              method: 'POST',
              body: JSON.stringify(revenuePerUser),
              headers: { 'Content-Type': 'application/json' },
            });
        
            const revenuePerUserData = await revenuePerUserResponse.json();

            if (revenuePerUserData.error !== undefined) {
              // Skip executing
            } else if (revenuePerUserData.length === 0) {
              // Skip executing
            } else {
              // Continue executing
              let cleanedRPUData = revenuePerUserData.map((item) => ({
                clientID: item.event.clientID,
                value: item.event.total_revenue.toFixed(2),
              }));
        
              const revenues = cleanedRPUData.map((client) => parseFloat(client.value));
              const medianRevenue = findMedian(revenues).toFixed(2);
              results.push({ timestamp: item.timestamp, value: medianRevenue });
            }
          }
        
          return results;
        }
        
        function findMedian(numbers) {
          if (numbers.length === 0) {
            return 0; // Вернуть 0, если массив пустой, чтобы избежать ошибок
          }
        
          // Сортируем массив чисел
          const sortedNumbers = numbers.sort((a, b) => a - b);
        
          const middleIndex = Math.floor(sortedNumbers.length / 2);
        
          if (sortedNumbers.length % 2 === 0) {
            // Если массив четной длины, возвращаем среднее двух средних элементов
            const median = (sortedNumbers[middleIndex - 1] + sortedNumbers[middleIndex]) / 2;
            return median;
          } else {
            // Если массив нечетной длины, возвращаем средний элемент
            const median = sortedNumbers[middleIndex];
            return median;
          }
        }


        try {
          let ARPPU = {};
          ARPPU = await processUserData(data);
          // console.log('ARPPU', ARPPU);
          return { success: true, data: ARPPU, granularity: 'day' };
        } catch (error) {
          console.error(error);
          return { success: false, message: 'Internal Server Error' };
        }
        // Always do 'day' granularity because ARPPU only counts pre day
      

    } catch (error) {
      console.error(error)
      return {success: false}
    }
};
// Daily Active Users
async function getStickinessRate(gameID, buildType, startDate, endDate, dateDiff, clientIDs) {
  function makeFilters() {
    let fields = [
        {
            "type": "equals",
            "column": "gameID",
            "matchValueType": "STRING",
            "matchValue": gameID
        },
        {
            "type": "equals",
            "column": "buildType",
            "matchValueType": "STRING",
            "matchValue": buildType
        }
    ];
  
    // Добавляем фильтр 'in' только если массив clientIDs содержит элементы
    if (clientIDs.length > 0) {
        fields.unshift({
            "type": "in",
            "dimension": "clientID",
            "values": clientIDs
        });
    }
    return fields
  }

  const intervalStartDate = startDate.toISOString()
  const intervalEndDate = endDate.toISOString()
  const daysBetweenDates = dateDiff;
  
    // Minutes by default if we're looking in range below 7 days
    let granularity = 'minute';
    granularity = getGranularity(daysBetweenDates);

    const interval = `${intervalStartDate}/${intervalEndDate}`;
    
    // List of unique users in interval
    const query = {
        "queryType": "topN",
        "dataSource": {
          "type": "table",
          "name": "New Sessions"
        },
        "dimension": {
          "type": "default",
          "dimension": "clientID",
          "outputName": "clientID",
          "outputType": "STRING"
        },
        "metric": {
          "type": "inverted",
          "metric": {
            "type": "numeric",
            "metric": "timestamp"
          }
        },
        "threshold": 1001,
        "intervals": {
          "type": "intervals",
          "intervals": [
            interval
          ]
        },
        "granularity": "all",
        "filter": {
            "type": "and",
            "fields": makeFilters()
        },
        "aggregations": [
          {
            "type": "longMin",
            "name": "timestamp",
            "fieldName": "__time"
          }
        ],
        "context" : {
          "skipEmptyBuckets": "true"
        }
    }

    try {
        const response = await fetch(druidURL, {
            method: 'POST',
            body: JSON.stringify(query),
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();

        if (data.error !== undefined) {
            return {success: false, error: data.error}
        }
        if (data.length === 0) {
          return {success: false, error: 'No Data returned'}
        }
        
        // Since Druid's granularity won't work for us and break things, we need to keep Druid's granularity as "all"
        // and process users on our own, rounding results to minutes/hours/days.
        // If we set any other type of granularity in Druid's granularity in query, it will return
        // unique user per this granularity. Because it counts unique values by the granularity, not by the interval.
        // I.e. if we need DAU and write "hour" in query, it will count the same user twice if he entered an app in different hours
        function countPeopleByTime(data, timeUnit) {
          const counts = {};

          data.forEach((entry) => {
            const timestamp = entry.timestamp;
            const roundedTime = roundTime(timestamp, timeUnit);
        
            if (!counts[roundedTime]) {
              counts[roundedTime] = new Set();
            }
        
            counts[roundedTime].add(entry.clientID);
          });
        
          const result = Object.keys(counts).map((key) => ({
            timestamp: Number(key),
            count: counts[key].size,
          }));
        
          return result;
        }
        
        // Here we round raw timestamp to a minute, hour or day
        function roundTime(timestamp, timeUnit) {
          const date = new Date(timestamp);
        
          if (timeUnit === 'minute') {
            date.setSeconds(0, 0);
          } else if (timeUnit === 'hour') {
            date.setMinutes(0, 0, 0);
          } else if (timeUnit === 'day') {
            date.setHours(0, 0, 0, 0);
          }
          
          return date.getTime();
        }

        // Finally process data to a unified format
        const cleanedData = countPeopleByTime(data[0].result, granularity).map(item => ({
          timestamp: new Date(item.timestamp),
          value: item.count
        }));


        // We now need to get current month's interval
        const firstDayOfMonth = 
        dayjs().startOf('month').hour(0).minute(0).second(0).millisecond(0).format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');;
        const lastDayOfMonth = 
        dayjs().endOf('month').hour(23).minute(59).second(59).millisecond(999).format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');;
        
        const MAUquery = {
          "queryType": "timeseries",
          "dataSource": "New Sessions",
          "granularity": "all",
          "dimensions": ["clientID"],
          "aggregations": [
            {
              "type": "cardinality",
              "name": "mau",
              "fields": [
                {
                  "type": "default",
                  "dimension": "clientID",
                  "outputName": "clientID",
                  "outputType": "STRING"
                }
              ],
              "byRow": false,
              "round": true
            }
          ],
          "intervals": {
            "type": "intervals",
            "intervals": [
              `${firstDayOfMonth}/${lastDayOfMonth}`
            ]
          }
        }

        const MAUResponse = await fetch(druidURL, {
            method: 'POST',
            body: JSON.stringify(MAUquery),
            headers: { 'Content-Type': 'application/json' }
        });
        const MAUdata = await MAUResponse.json();
        
        if (MAUdata.error !== undefined) {
          return {success: false, error: MAUdata.error}
        }
        if (MAUdata.length === 0) {
          return {success: false, error: 'No MAU Data returned'}
        }
        const MAU = MAUdata[0].result.mau
        
        const stickiness = cleanedData.map(item => ({
          timestamp: item.timestamp,
          value: ((item.value / MAU) * 100).toFixed(0),
        }))
      
        return {success: true, data: stickiness, granularity}

    } catch (error) {
      console.error(error)
      return {success: false}
    }
};
// Session Length with custom granularity. Just a sum query, nothing fancy
async function getSessionLength(gameID, buildType, startDate, endDate, dateDiff, clientIDs) {
  function makeFilters() {
    let fields = [
        {
            "type": "equals",
            "column": "gameID",
            "matchValueType": "STRING",
            "matchValue": gameID
        },
        {
            "type": "equals",
            "column": "buildType",
            "matchValueType": "STRING",
            "matchValue": buildType
        }
    ];
  
    // Добавляем фильтр 'in' только если массив clientIDs содержит элементы
    if (clientIDs.length > 0) {
        fields.unshift({
            "type": "in",
            "dimension": "clientID",
            "values": clientIDs
        });
    }
    return fields
  }

  const intervalStartDate = startDate.toISOString()
  const intervalEndDate = endDate.toISOString()
  const daysBetweenDates = dateDiff;
  
    // Minutes by default if we're looking in range below 7 days
    let granularity = 'minute';
    granularity = getGranularity(daysBetweenDates);

    const interval = `${intervalStartDate}/${intervalEndDate}`;

    const query = {
        "queryType": "timeseries",
        "dataSource": {
          "type": "table",
          "name": "End Sessions"
        },
        "granularity": "all",
        "filter": {
            "type": "and",
            "fields": makeFilters()
        },
        "aggregations": [
          {
            "type": "median",
            "name": "sessionLength",
            "fieldName": "sessionLength"
          }
        ],
        "intervals": {
          "type": "intervals",
          "intervals": [
            interval
          ]
        }
    }

    try {
        const response = await fetch(druidURL, {
            method: 'POST',
            body: JSON.stringify(query),
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        
        if (data.error !== undefined) {
            return {success: false, error: data.error}
        }
        
        
        // Check if we get totally no data 
        if (data.length === 0 || data[0].result.sessionLength === null) return {success: false, error: data.error}
        


        // Remove all null elements like those below
        // [
        //   {
        //     timestamp: '2023-12-01T00:00:00.000Z',
        //     result: { sessionLength: null }
        //   }
        // ]
        const filteredData = data.filter(item => item.result.sessionLength !== null);

        const cleanedData = filteredData.map(item => ({
          timestamp: item.timestamp,
          value: item.result.sessionLength
        }));

      return {success: true, data: cleanedData, granularity}

    } catch (error) {
      console.error(error)
      return {success: false}
    }
};

// 
// Analytics Dashboard - User Acquisition
// 


// 
// Overview Page - Sidebar
// 

// Эту функцию надо доделать. Сейчас она ничего ничего путного не возвращает, а запрос к друиду просто возвращает массив уникальных sessionID
async function getActiveSessions(gameID, buildType, startDate, endDate, dateDiff, clientIDs) {
  function makeFilters() {
    let fields = [
        {
            "type": "equals",
            "column": "gameID",
            "matchValueType": "STRING",
            "matchValue": gameID
        },
        {
            "type": "equals",
            "column": "buildType",
            "matchValueType": "STRING",
            "matchValue": buildType
        }
    ];
  
    // Добавляем фильтр 'in' только если массив clientIDs содержит элементы
    if (clientIDs.length > 0) {
        fields.unshift({
            "type": "in",
            "dimension": "clientID",
            "values": clientIDs
        });
    }
    return fields
  }

  const intervalStartDate = startDate.toISOString()
  const intervalEndDate = endDate.toISOString()
  const daysBetweenDates = dateDiff;
  
  // Minutes by default if we're looking in range below 7 days
  let granularity = 'minute';
  granularity = getGranularity(daysBetweenDates);
  const interval = `${intervalStartDate}/${intervalEndDate}`;
  const queryCountNewSessions = {
        "queryType": "groupBy",
        "dataSource": {
          "type": "table",
          "name": "New Sessions"
        },
        "granularity": 'hour',
        "filter": {
            "type": "and",
            "fields": makeFilters()
        },
        "dimensions": ["sessionID"],
        "limitSpec": {
          "type": "default",
          "limit": 1001,
          "columns": [
            { "dimension": "sessionID" }
          ]
        },
        "intervals": {
          "type": "intervals",
          "intervals": [
            interval
          ]
        }
      }
  const queryCountEndSessions = {
    "queryType": "groupBy",
    "dataSource": {
      "type": "table",
      "name": "End Sessions"
    },
    "granularity": 'hour',
    "filter": {
        "type": "and",
        "fields": makeFilters()
    },
    "dimensions": ["sessionID"],
    "limitSpec": {
      "type": "default",
      "limit": 1001,
      "columns": [
        { "dimension": "sessionID" }
      ]
    },
    "intervals": {
      "type": "intervals",
      "intervals": [
        interval
      ]
    }
  }

  try {
        const response1 = await fetch(druidURL, {
            method: 'POST',
            body: JSON.stringify(queryCountNewSessions),
            headers: { 'Content-Type': 'application/json' }
        });
        const dataNewSessions = await response1.json();

        console.log(dataNewSessions)
        if (dataNewSessions.error !== undefined) {
            return {success: false, error: dataNewSessions.error}
        }
        
        const response2 = await fetch(druidURL, {
            method: 'POST',
            body: JSON.stringify(queryCountEndSessions),
            headers: { 'Content-Type': 'application/json' }
        });
        const dataEndSessions = await response2.json();

        
        if (dataEndSessions.error !== undefined) {
            return {success: false, error: dataEndSessions.error}
        }
        const activeSessions = dataNewSessions.map((item, index) => {
          let endedSessions = dataEndSessions.find(d => d.timestamp === item.timestamp)
          if (endedSessions === undefined) {
            endedSessions = 0
          } else {
            endedSessions = endedSessions.result.endSessions
          }
          return ({
          timestamp: item.timestamp,
          value: item.result.newSessions - endedSessions}) 
        });


      return {success: true, data: activeSessions, granularity}

  } catch (error) {
    console.error(error)
    return {success: false}
  }
};

module.exports = {


    getRecentClientIDs,
  
    // Player Warehouse
    getMostRecentValue,
    getFirstEventValue,
    getMostCommonValue,
    getLeastCommonValue,
    getMeanValue,
    getMeanValueForTime,
    getSummValue,
    getSummValueForTime,
    getEventNumber,
    getNumberOfEventsForTime,

    // Analytics
    getNewUsers,
    getDAU,
    getRevenue,
    getRetention,
    getARPDAU,
    getCumulativeARPU,
    getPayingUsersShare,
    getARPPU,
    getStickinessRate,
    getSessionLength,

    // Overview page
    getActiveSessions,

}