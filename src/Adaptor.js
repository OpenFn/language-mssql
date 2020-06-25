import {
  execute as commonExecute,
  expandReferences,
  composeNextState,
} from 'language-common';
import { resolve as resolveUrl } from 'url';
import { Connection, Request } from 'tedious';

/**
 * Creates a connection.
 * @example
 *  createConnection(state)
 * @function
 * @param {State} state - Runtime state.
 * @returns {State}
 */
function createConnection(state) {
  const { server, userName, password, database } = state.configuration;

  if (!server) {
    throw new Error('server missing from configuration.');
  }

  const config = {
    authentication: {
      options: { userName, password },
      type: 'default',
    },
    server,
    options: {
      database,
      encrypt: true,
      rowCollectionOnRequestCompletion: true,
    },
  };

  var connection = new Connection(config);

  // Attempt to connect and execute queries if connection goes through
  return new Promise((resolve, reject) => {
    connection.on('connect', (err) => {
      if (err) {
        console.error(err.message);
        reject(err);
      } else {
        resolve({ ...state, connection });
      }
    });
  });
}

/**
 * Execute a sequence of operations.
 * Wraps `language-common/execute`, and prepends initial state for mssql.
 * @example
 * execute(
 *   create('foo'),
 *   delete('bar')
 * )(state)
 * @constructor
 * @param {Operations} operations - Operations to be performed.
 * @returns {Operation}
 */
export function execute(...operations) {
  const initialState = {
    references: [],
    data: null,
  };

  return (state) => {
    return commonExecute(
      createConnection,
      ...operations,
      cleanupState
    )({ ...initialState, ...state });
  };
}

/**
 * Removes unserializable keys from the state.
 * @example
 *  cleanupState(state)
 * @function
 * @param {State} state
 * @returns {State}
 */
function cleanupState(state) {
  if (state.connection) {
    state.connection.close();
  }
  delete state.connection;
  return state;
}

/**
 * Execute an SQL statement
 * @example
 * execute(
 *   sql(sqlQuery)
 * )(state)
 * @constructor
 * @param {object} sqlQuery - Payload data for the message
 * @returns {Operation}
 */
export function sql(params) {
  return (state) => {
    const { connection } = state;
    const { query, options } = expandReferences(params)(state);

    return new Promise((resolve, reject) => {
      console.log(`Executing query: ${query}`);

      const request = new Request(query, (err, rowCount, rows) => {
        if (err) {
          console.error(err.message);
          throw err;
        } else {
          console.log(`Finished: ${rowCount} row(s).`);
          console.log(rows);
          const nextState = composeNextState(state, rows);
          resolve(nextState);
        }
      });

      connection.execSql(request);
    });
  };
}

/**
 * Insert or update a record using SQL MERGE
 * @example
 * execute(
 *   upsert(table, uuid, record)
 * )(state)
 * @constructor
 * @param {string} table - The target table
 * @param {string} uuid - The uuid column to determine a matching/existing record
 * @param {object} record - Payload data for the record as a JS object
 * @returns {Operation}
 */
export function upsert(table, uuid, record) {
  return (state) => {
    const { connection } = state;
    const { recordData } = expandReferences(record)(state);

    const columns = Object.keys(recordData).sort();

    const selectValues = columns
      .map((key) => `${recordData[key]} AS ${key}`)
      .join(', ');

    const updateValues = columns
      .map((key) => `[Target].${key}=${recordData[key]}`)
      .join(', ');

    const insertColumns = columns.join(', ');
    const insertValues = columns.map((key) => `[Source].${key}`).join(', ');

    const query = `MERGE ${table} AS [Target]
    USING SELECT (${selectValues}) AS [Source] 
    ON [Target].${uuid} = [Source].${uuid}
    WHEN MATCHED THEN
      UPDATE SET ${updateValues} 
    WHEN NOT MATCHED THEN
      INSERT (${insertColumns}) VALUES (${insertValues});`;

    return new Promise((resolve, reject) => {
      console.log(`Executing upsert via SQL 'MERGE' function.`);

      const request = new Request(query, (err, rowCount, rows) => {
        if (err) {
          console.error(err.message);
          throw err;
        } else {
          console.log(`Finished: ${rowCount} row(s).`);
          console.log(rows);
          const nextState = composeNextState(state, rows);
          resolve(nextState);
        }
      });

      connection.execSql(request);
    });
  };
}

/**
 * Insert a record
 * @example
 * execute(
 *   insert(table, record)
 * )(state)
 * @constructor
 * @param {string} table - The target table
 * @param {object} record - Payload data for the record as a JS object
 * @returns {Operation}
 */
export function insert(table, record) {
  return (state) => {
    const { connection } = state;
    const { recordData } = expandReferences(record)(state);

    const columns = Object.keys(recordData).sort();
    const values = columns.map((key) => recordData[key]).join(', ');

    const query = `INSERT INTO ${table} (${columns.join(
      ', '
    )}) VALUES (${values});`;

    return new Promise((resolve, reject) => {
      console.log(`Executing upsert via SQL 'MERGE' function.`);

      const request = new Request(query, (err, rowCount, rows) => {
        if (err) {
          console.error(err.message);
          throw err;
        } else {
          console.log(`Finished: ${rowCount} row(s).`);
          console.log(rows);
          const nextState = composeNextState(state, rows);
          resolve(nextState);
        }
      });

      connection.execSql(request);
    });
  };
}

/**
 * Insert many records, using the keys of the first as the column template
 * @example
 * execute(
 *   insert(table, records)
 * )(state)
 * @constructor
 * @param {string} table - The target table
 * @param {array} records - Payload data for the record as a JS array
 * @returns {Operation}
 */
export function insertMany(table, records) {
  return (state) => {
    const { connection } = state;
    const { recordData } = expandReferences(records)(state);

    // Note: we select the keys of the FIRST object as the canonical template.
    const columns = Object.keys(recordData[0]);
    const valueSets = recordData.map((x) => `(${Object.values(x)})`);

    const query = `INSERT INTO ${table} (${columns.join(
      ', '
    )}) VALUES ${valueSets.join(', ')};`;

    return new Promise((resolve, reject) => {
      console.log(`Executing upsert via SQL 'MERGE' function.`);

      const request = new Request(query, (err, rowCount, rows) => {
        if (err) {
          console.error(err.message);
          throw err;
        } else {
          console.log(`Finished: ${rowCount} row(s).`);
          console.log(rows);
          const nextState = composeNextState(state, rows);
          resolve(nextState);
        }
      });

      connection.execSql(request);
    });
  };
}

export {
  alterState,
  field,
  fields,
  sourceValue,
  merge,
  dataPath,
  dataValue,
  lastReferenceValue,
} from 'language-common';
