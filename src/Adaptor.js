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
    let response = [];

    return new Promise((resolve, reject) => {
      queryDatabase();

      function queryDatabase() {
        console.log('Reading rows from the Table...');

        // Read all rows from table
        const request = new Request(query, (err, rowCount) => {
          if (err) {
            console.error(err.message);
            reject(err);
          } else {
            if (rowCount === 0) {
              console.log(`${rowCount} row(s) returned. Not updating state.`);
              resolve(state);
            }
          }
        });

        request.on('row', columns => {
          console.log(columns);
          response.push(columns);
        });

        request.on('requestCompleted', () => {
          console.log('Request finished.');
          const nextState = composeNextState(state, response);
          resolve(nextState);
        });

        connection.execSql(request);
      }
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
