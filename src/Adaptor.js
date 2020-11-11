import { execute as commonExecute, expandReferences } from 'language-common';
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
    connection.on('connect', err => {
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

  return state => {
    return commonExecute(
      createConnection,
      ...operations,
      cleanupState
    )({ ...initialState, ...state }).catch(e => {
      console.error(e);
      console.error('Unhandled error in the operations. Exiting process.');
      process.exit(1);
    });
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
 * Sets the returned rows from a query as the first item in the state.references
 * array, leaving state.data unchanged between operations.
 * @function
 * @param {State} state
 * @param {array} rows - the array of rows returned from the sql query
 * @returns {State}
 */
function addRowsToRefs(state, rows) {
  return {
    ...state,
    references: [rows, ...state.references],
  };
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
  return state => {
    const { connection } = state;

    try {
      const { query, options } = expandReferences(params)(state);

      return new Promise((resolve, reject) => {
        console.log(`Executing query: ${query}`);

        const request = new Request(query, (err, rowCount, rows) => {
          if (err) {
            console.error(err.message);
            throw err;
          } else {
            console.log(`Finished: ${rowCount} row(s).`);
            resolve(addRowsToRefs(state, rows));
          }
        });

        connection.execSql(request);
      });
    } catch (e) {
      connection.close();
      throw e;
    }
  };
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function handleValues(sqlString, nullString) {
  if (nullString == false) {
    return sqlString;
  }

  const re = new RegExp(escapeRegExp(nullString), 'g');
  return sqlString.replace(re, 'NULL');
}

function handleOptions(options) {
  if (options && options.setNull === false) {
    return false;
  }
  return (options && options.setNull) || "'undefined'";
}

function escapeQuote(stringExp) {
  if (typeof stringExp === 'object' && stringExp !== null) {
    return Object.values(stringExp).map(x => escapeQuote(x));
  } else if (typeof stringExp !== 'string') {
    return stringExp;
  }

  return stringExp.replace(/\'/g, "''");
}

/**
 * Insert a record
 * @example
 * execute(
 *   insert(table, record, {setNull: "'undefined'"})
 * )(state)
 * @constructor
 * @param {string} table - The target table
 * @param {object} record - Payload data for the record as a JS object
 * @param {object} options - Optional options argument
 * @returns {Operation}
 */
export function insert(table, record, options) {
  return state => {
    const { connection } = state;

    try {
      const recordData = expandReferences(record)(state);

      const columns = Object.keys(recordData).sort();
      const values = columns
        .map(key => escapeQuote(recordData[key]))
        .join("', '");

      const query = handleValues(
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES ('${values}');`,
        handleOptions(options)
      );

      const safeQuery = `INSERT INTO ${table} (${columns.join(
        ', '
      )}) VALUES [--REDACTED--]];`;

      return new Promise((resolve, reject) => {
        console.log(`Executing insert via: ${safeQuery}`);

        const request = new Request(query, (err, rowCount, rows) => {
          if (err) {
            console.error(err.message);
            throw err;
          } else {
            console.log(`Finished: ${rowCount} row(s).`);
            resolve(addRowsToRefs(state, rows));
          }
        });

        connection.execSql(request);
      });
    } catch (e) {
      connection.close();
      throw e;
    }
  };
}

/**
 * Insert many records, using the keys of the first as the column template
 * @example
 * execute(
 *   insertMany(table, records, { setNull: false })
 * )(state)
 * @constructor
 * @param {string} table - The target table
 * @param {function} records - A function that takes state and returns an array of records
 * @param {object} options - Optional options argument
 * @returns {Operation}
 */
export function insertMany(table, records, options) {
  return state => {
    const { connection } = state;

    try {
      const recordData = records(state);

      // Note: we select the keys of the FIRST object as the canonical template.
      const columns = Object.keys(recordData[0]);

      const valueSets = recordData.map(
        x => `('${escapeQuote(Object.values(x)).join("', '")}')`
      );
      const query = handleValues(
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${valueSets.join(
          ', '
        )};`,
        handleOptions(options)
      );

      const safeQuery = `INSERT INTO ${table} (${columns.join(
        ', '
      )}) VALUES [--REDACTED--]];`;

      return new Promise((resolve, reject) => {
        console.log(`Executing insert many via: ${safeQuery}`);

        const request = new Request(query, (err, rowCount, rows) => {
          if (err) {
            console.error(err.message);
            throw err;
          } else {
            console.log(`Finished: ${rowCount} row(s).`);
            resolve(addRowsToRefs(state, rows));
          }
        });

        connection.execSql(request);
      });
    } catch (e) {
      connection.close();
      throw e;
    }
  };
}

/**
 * Insert or update a record using SQL MERGE
 * @example
 * execute(
 *   upsert(table, uuid, record, { setNull: "'undefined'"})
 * )(state)
 * @constructor
 * @param {string} table - The target table
 * @param {string} uuid - The uuid column to determine a matching/existing record
 * @param {object} record - Payload data for the record as a JS object
 * @param {object} options - Optional options argument
 * @returns {Operation}
 */
export function upsert(table, uuid, record, options) {
  return state => {
    const { connection } = state;

    try {
      const recordData = expandReferences(record)(state);
      const columns = Object.keys(recordData).sort();

      const selectValues = columns
        .map(key => `'${escapeQuote(recordData[key])}' AS ${key}`)
        .join(', ');

      const updateValues = columns
        .map(key => `[Target].${key}='${escapeQuote(recordData[key])}'`)
        .join(', ');

      const insertColumns = columns.join(', ');
      const insertValues = columns.map(key => `[Source].${key}`).join(', ');

      const query = handleValues(
        `MERGE ${table} AS [Target]
        USING (SELECT ${selectValues}) AS [Source] 
        ON [Target].${uuid} = [Source].${uuid}
        WHEN MATCHED THEN
          UPDATE SET ${updateValues} 
        WHEN NOT MATCHED THEN
          INSERT (${insertColumns}) VALUES (${insertValues});`,
        handleOptions(options)
      );

      const safeQuery = `MERGE ${table} AS [Target]
        USING (SELECT [--REDACTED--]) 
        ON [Target].[--VALUE--] = [Source].[--VALUE--]
        WHEN MATCHED THEN
          UPDATE SET [--REDACTED--] 
        WHEN NOT MATCHED THEN
          INSERT (${insertColumns}) VALUES [--REDACTED--];`;

      return new Promise((resolve, reject) => {
        console.log(`Executing upsert via : ${safeQuery}`);

        const request = new Request(query, (err, rowCount, rows) => {
          if (err) {
            console.error(err.message);
            throw err;
          } else {
            console.log(`Finished: ${rowCount} row(s).`);
            resolve(addRowsToRefs(state, rows));
          }
        });

        connection.execSql(request);
      });
    } catch (e) {
      connection.close();
      throw e;
    }
  };
}

/**
 * Insert or update multiple records using ON CONFLICT UPDATE and excluded
 * @example
 * upsertMany(
 *  'users', 'email', records
 * )
 * @constructor
 * @param {string} table - The target table
 * @param {string} uuid - The uuid column to determine a matching/existing record
 * @param {function} records - A function that takes state and returns an array of records
 * @param {object} options - Optional options argument
 * @returns {Operation}
 */
export function upsertMany(table, uuid, records, options) {
  return state => {
    const { connection } = state;

    try {
      const recordData = records(state);

      // Note: we select the keys of the FIRST object as the canonical template.
      const columns = Object.keys(recordData[0]);

      const valueSets = recordData.map(
        x => `('${escapeQuote(Object.values(x)).join("', '")}')`
      );
      const insertColumns = columns.join(', ');
      const insertValues = columns.map(key => `[Source].${key}`).join(', ');

      const updateValues = columns
        .map(key => `[Target].${key}=[Source].${key}`)
        .join(', ');

      const query = handleValues(
        `MERGE ${table} AS [Target]
        USING (VALUES ${valueSets.join(', ')}) AS [Source] (${insertColumns})
        ON [Target].${uuid} = [Source].${uuid}
        WHEN MATCHED THEN
          UPDATE SET ${updateValues}
        WHEN NOT MATCHED THEN
          INSERT (${insertColumns}) VALUES (${insertValues});`,
        handleOptions(options)
      );

      const safeQuery = `MERGE ${table} AS [Target]
        USING (VALUES [--REDACTED--]) AS [SOURCE] (${insertColumns})
        ON [Target].[--VALUE--] = [Source].[--VALUE--]
        WHEN MATCHED THEN
          UPDATE SET [--REDACTED--] 
        WHEN NOT MATCHED THEN
          INSERT (${insertColumns}) VALUES [--REDACTED--];`;

      return new Promise((resolve, reject) => {
        console.log(`Executing upsert via : ${safeQuery}`);

        const request = new Request(query, (err, rowCount, rows) => {
          if (err) {
            console.error(err.message);
            throw err;
          } else {
            console.log(`Finished: ${rowCount} row(s).`);
            resolve(addRowsToRefs(state, rows));
          }
        });

        connection.execSql(request);
      });
    } catch (e) {
      connection.close();
      throw e;
    }
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
