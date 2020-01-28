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
 * Exequet an SQL statement
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
    let { connection } = state;
    let { query, options } = expandReferences(params)(state);

    return new Promise((resolve, reject) => {
      console.log(`Executing query: ${query}`);

      const request = new Request(query, (err, rowCount, rows) => {
        if (err) {
          console.error(err.message);
          reject(err);
        } else {
          console.log('Request finished.');
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
