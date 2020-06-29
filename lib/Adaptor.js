"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.execute = execute;
exports.sql = sql;
exports.insert = insert;
exports.insertMany = insertMany;
exports.upsert = upsert;
Object.defineProperty(exports, "alterState", {
  enumerable: true,
  get: function get() {
    return _languageCommon.alterState;
  }
});
Object.defineProperty(exports, "field", {
  enumerable: true,
  get: function get() {
    return _languageCommon.field;
  }
});
Object.defineProperty(exports, "fields", {
  enumerable: true,
  get: function get() {
    return _languageCommon.fields;
  }
});
Object.defineProperty(exports, "sourceValue", {
  enumerable: true,
  get: function get() {
    return _languageCommon.sourceValue;
  }
});
Object.defineProperty(exports, "merge", {
  enumerable: true,
  get: function get() {
    return _languageCommon.merge;
  }
});
Object.defineProperty(exports, "dataPath", {
  enumerable: true,
  get: function get() {
    return _languageCommon.dataPath;
  }
});
Object.defineProperty(exports, "dataValue", {
  enumerable: true,
  get: function get() {
    return _languageCommon.dataValue;
  }
});
Object.defineProperty(exports, "lastReferenceValue", {
  enumerable: true,
  get: function get() {
    return _languageCommon.lastReferenceValue;
  }
});

var _languageCommon = require("language-common");

var _url = require("url");

var _tedious = require("tedious");

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

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
      options: {
        userName: userName,
        password: password
      },
      type: 'default'
    },
    server: server,
    options: {
      database: database,
      encrypt: true,
      rowCollectionOnRequestCompletion: true
    }
  };
  var connection = new _tedious.Connection(config); // Attempt to connect and execute queries if connection goes through

  return new Promise(function (resolve, reject) {
    connection.on('connect', function (err) {
      if (err) {
        console.error(err.message);
        reject(err);
      } else {
        resolve(_objectSpread(_objectSpread({}, state), {}, {
          connection: connection
        }));
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
  for (var _len = arguments.length, operations = new Array(_len), _key = 0; _key < _len; _key++) {
    operations[_key] = arguments[_key];
  }

  var initialState = {
    references: [],
    data: null
  };
  return function (state) {
    return _languageCommon.execute.apply(void 0, [createConnection].concat(operations, [cleanupState]))(_objectSpread(_objectSpread({}, initialState), state));
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


function sql(params) {
  return function (state) {
    var connection = state.connection;

    try {
      var _expandReferences = (0, _languageCommon.expandReferences)(params)(state),
          query = _expandReferences.query,
          options = _expandReferences.options;

      return new Promise(function (resolve, reject) {
        console.log("Executing query: ".concat(query));
        var request = new _tedious.Request(query, function (err, rowCount, rows) {
          if (err) {
            console.error(err.message);
            throw err;
          } else {
            console.log("Finished: ".concat(rowCount, " row(s)."));
            var nextState = (0, _languageCommon.composeNextState)(state, rows);
            resolve(nextState);
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

function handleValues(sqlString, nullString) {
  if (nullString == false) {
    return sqlString;
  }

  var re = new RegExp(nullString, 'g');
  return sqlString.replace(re, 'NULL');
}

function handleOptions(options) {
  if (options && options.setNull === false) {
    return false;
  }

  return options && options.setNull || "'undefined'";
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


function insert(table, record, options) {
  return function (state) {
    var connection = state.connection;

    try {
      var recordData = (0, _languageCommon.expandReferences)(record)(state);
      var columns = Object.keys(recordData).sort();
      var values = columns.map(function (key) {
        return recordData[key];
      }).join("', '");
      var query = handleValues("INSERT INTO ".concat(table, " (").concat(columns.join(', '), ") VALUES ('").concat(values, "');"), handleOptions(options));
      return new Promise(function (resolve, reject) {
        console.log("Executing insert via: ".concat(query));
        var request = new _tedious.Request(query, function (err, rowCount, rows) {
          if (err) {
            console.error(err.message);
            throw err;
          } else {
            console.log("Finished: ".concat(rowCount, " row(s)."));
            var nextState = (0, _languageCommon.composeNextState)(state, rows);
            resolve(nextState);
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
 *   insert(table, records, { setNull: false })
 * )(state)
 * @constructor
 * @param {string} table - The target table
 * @param {function} records - A function that returns an array of records
 * @param {object} options - Optional options argument
 * @returns {Operation}
 */


function insertMany(table, records, options) {
  return function (state) {
    var connection = state.connection;

    try {
      // Note: we select the keys of the FIRST object as the canonical template.
      var columns = Object.keys(records[0]);
      var valueSets = records.map(function (x) {
        return "('".concat(Object.values(x).join("', '"), "')");
      });
      var query = handleValues("INSERT INTO ".concat(table, " (").concat(columns.join(', '), ") VALUES ").concat(valueSets.join(', '), ";"), handleOptions(options));
      return new Promise(function (resolve, reject) {
        console.log("Executing insert many via: ".concat(query));
        var request = new _tedious.Request(query, function (err, rowCount, rows) {
          if (err) {
            console.error(err.message);
            throw err;
          } else {
            console.log("Finished: ".concat(rowCount, " row(s)."));
            var nextState = (0, _languageCommon.composeNextState)(state, rows);
            resolve(nextState);
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


function upsert(table, uuid, record, options) {
  return function (state) {
    var connection = state.connection;

    try {
      var recordData = (0, _languageCommon.expandReferences)(record)(state);
      var columns = Object.keys(recordData).sort();
      var selectValues = columns.map(function (key) {
        return "'".concat(recordData[key], "' AS ").concat(key);
      }).join(', ');
      var updateValues = columns.map(function (key) {
        return "[Target].".concat(key, "='").concat(recordData[key], "'");
      }).join(', ');
      var insertColumns = columns.join(', ');
      var insertValues = columns.map(function (key) {
        return "[Source].".concat(key);
      }).join(', ');
      var query = handleValues("MERGE ".concat(table, " AS [Target]\n        USING (SELECT ").concat(selectValues, ") AS [Source] \n        ON [Target].").concat(uuid, " = [Source].").concat(uuid, "\n        WHEN MATCHED THEN\n          UPDATE SET ").concat(updateValues, " \n        WHEN NOT MATCHED THEN\n          INSERT (").concat(insertColumns, ") VALUES (").concat(insertValues, ");"), handleOptions(options));
      return new Promise(function (resolve, reject) {
        console.log("Executing upsert via : ".concat(query));
        var request = new _tedious.Request(query, function (err, rowCount, rows) {
          if (err) {
            console.error(err.message);
            throw err;
          } else {
            console.log("Finished: ".concat(rowCount, " row(s)."));
            var nextState = (0, _languageCommon.composeNextState)(state, rows);
            resolve(nextState);
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
