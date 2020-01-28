'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.lastReferenceValue = exports.dataValue = exports.dataPath = exports.merge = exports.sourceValue = exports.fields = exports.field = exports.alterState = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

exports.execute = execute;
exports.sql = sql;

var _languageCommon = require('language-common');

Object.defineProperty(exports, 'alterState', {
  enumerable: true,
  get: function get() {
    return _languageCommon.alterState;
  }
});
Object.defineProperty(exports, 'field', {
  enumerable: true,
  get: function get() {
    return _languageCommon.field;
  }
});
Object.defineProperty(exports, 'fields', {
  enumerable: true,
  get: function get() {
    return _languageCommon.fields;
  }
});
Object.defineProperty(exports, 'sourceValue', {
  enumerable: true,
  get: function get() {
    return _languageCommon.sourceValue;
  }
});
Object.defineProperty(exports, 'merge', {
  enumerable: true,
  get: function get() {
    return _languageCommon.merge;
  }
});
Object.defineProperty(exports, 'dataPath', {
  enumerable: true,
  get: function get() {
    return _languageCommon.dataPath;
  }
});
Object.defineProperty(exports, 'dataValue', {
  enumerable: true,
  get: function get() {
    return _languageCommon.dataValue;
  }
});
Object.defineProperty(exports, 'lastReferenceValue', {
  enumerable: true,
  get: function get() {
    return _languageCommon.lastReferenceValue;
  }
});

var _url = require('url');

var _tedious = require('tedious');

/**
 * Creates a connection.
 * @example
 *  createConnection(state)
 * @function
 * @param {State} state - Runtime state.
 * @returns {State}
 */
function createConnection(state) {
  var _state$configuration = state.configuration,
      server = _state$configuration.server,
      userName = _state$configuration.userName,
      password = _state$configuration.password,
      database = _state$configuration.database;


  if (!server) {
    throw new Error('server missing from configuration.');
  }

  var config = {
    authentication: {
      options: { userName: userName, password: password },
      type: 'default'
    },
    server: server,
    options: {
      database: database,
      encrypt: true,
      rowCollectionOnRequestCompletion: true
    }
  };

  var connection = new _tedious.Connection(config);

  // Attempt to connect and execute queries if connection goes through
  return new Promise(function (resolve, reject) {
    connection.on('connect', function (err) {
      if (err) {
        console.error(err.message);
        reject(err);
      } else {
        resolve(_extends({}, state, { connection: connection }));
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
function execute() {
  for (var _len = arguments.length, operations = Array(_len), _key = 0; _key < _len; _key++) {
    operations[_key] = arguments[_key];
  }

  var initialState = {
    references: [],
    data: null
  };

  return function (state) {
    return _languageCommon.execute.apply(undefined, [createConnection].concat(operations, [cleanupState]))(_extends({}, initialState, state));
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
function sql(params) {
  return function (state) {
    var connection = state.connection;

    var _expandReferences = (0, _languageCommon.expandReferences)(params)(state),
        query = _expandReferences.query,
        options = _expandReferences.options;

    return new Promise(function (resolve, reject) {
      console.log('Executing query: ' + query);

      var request = new _tedious.Request(query, function (err, rowCount, rows) {
        if (err) {
          console.error(err.message);
          throw err;
        } else {
          console.log('Request finished:');
          console.log(rows);
          var nextState = (0, _languageCommon.composeNextState)(state, rows);
          resolve(nextState);
        }
      });

      connection.execSql(request);
    });
  };
}
