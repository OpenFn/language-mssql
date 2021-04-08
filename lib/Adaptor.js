"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.execute = execute;
exports.sql = sql;
exports.findValue = findValue;
exports.insert = insert;
exports.insertMany = insertMany;
exports.upsert = upsert;
exports.upsertMany = upsertMany;
Object.defineProperty(exports, "alterState", {
  enumerable: true,
  get: function get() {
    return _languageCommon.alterState;
  }
});
Object.defineProperty(exports, "combine", {
  enumerable: true,
  get: function get() {
    return _languageCommon.combine;
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
Object.defineProperty(exports, "each", {
  enumerable: true,
  get: function get() {
    return _languageCommon.each;
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
Object.defineProperty(exports, "http", {
  enumerable: true,
  get: function get() {
    return _languageCommon.http;
  }
});
Object.defineProperty(exports, "lastReferenceValue", {
  enumerable: true,
  get: function get() {
    return _languageCommon.lastReferenceValue;
  }
});
Object.defineProperty(exports, "merge", {
  enumerable: true,
  get: function get() {
    return _languageCommon.merge;
  }
});
Object.defineProperty(exports, "sourceValue", {
  enumerable: true,
  get: function get() {
    return _languageCommon.sourceValue;
  }
});

var _languageCommon = require("@openfn/language-common");

var _url = require("url");

var _tedious = require("tedious");

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && Symbol.iterator in Object(iter)) return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

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
    return _languageCommon.execute.apply(void 0, [createConnection].concat(operations, [cleanupState]))(_objectSpread(_objectSpread({}, initialState), state))["catch"](function (e) {
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
  return _objectSpread(_objectSpread({}, state), {}, {
    references: [rows].concat(_toConsumableArray(state.references))
  });
}
/**
 * Execute an SQL statement
 * @public
 * @example
 * execute(
 *   sql(sqlQuery)
 * )(state)
 * @constructor
 * @param {object} params - Payload data for the message
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

  var re = new RegExp(escapeRegExp(nullString), 'g');
  return sqlString.replace(re, 'NULL');
}

function handleOptions(options) {
  if (options && options.setNull === false) {
    return false;
  }

  return options && options.setNull || 'undefined';
}

function escapeQuote(stringExp) {
  if (_typeof(stringExp) === 'object' && stringExp !== null) {
    return Object.values(stringExp).map(function (x) {
      return escapeQuote(x);
    });
  } else if (typeof stringExp !== 'string') {
    return stringExp;
  }

  return stringExp.replace(/\'/g, "''");
}
/**
 * Fetch a uuid key given a condition
 * @public
 * @example
 * findValue({
 *    uuid: 'id',
 *    relation: 'users',
 *    where: { first_name: 'Mamadou' },
 *  })
 * @constructor
 * @param {object} filter - A filter object with the lookup table, a uuid and the condition
 * @returns {Operation}
 */


function findValue(filter) {
  return function (state) {
    var connection = state.connection;
    var uuid = filter.uuid,
        relation = filter.relation,
        where = filter.where;
    var whereData = (0, _languageCommon.expandReferences)(where)(state);
    var conditionsArray = [];

    for (var key in whereData) {
      conditionsArray.push("".concat(key, " = '").concat(whereData[key], "'"));
    }

    var condition = conditionsArray.join(' and '); // In a near future the 'and' can live in the filter.

    try {
      var body = "select ".concat(uuid, " from ").concat(relation, " where ").concat(condition);
      console.log('body', body);
      console.log('Preparing to execute sql statement');
      var returnValue = null;
      return new Promise(function (resolve, reject) {
        console.log("Executing query: ".concat(body));
        var request = new _tedious.Request(body, function (err, rowCount, rows) {
          if (err) {
            console.error(err.message);
            throw err;
          } else {
            if (rows.length > 0) {
              returnValue = rows[0][0].value;
            }

            resolve(returnValue);
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
 * Insert a record
 * @public
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
        return escapeQuote(recordData[key]);
      }).join("', '");
      var query = handleValues("INSERT INTO ".concat(table, " (").concat(columns.join(', '), ") VALUES ('").concat(values, "');"), handleOptions(options));
      var safeQuery = "INSERT INTO ".concat(table, " (").concat(columns.join(', '), ") VALUES [--REDACTED--]];");
      return new Promise(function (resolve, reject) {
        console.log("Executing insert via: ".concat(safeQuery));
        var request = new _tedious.Request(query, function (err, rowCount, rows) {
          if (err) {
            console.error(err.message);
            throw err;
          } else {
            console.log("Finished: ".concat(rowCount, " row(s)."));
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
 * @public
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


function insertMany(table, records, options) {
  return function (state) {
    var connection = state.connection;

    try {
      var recordData = (0, _languageCommon.expandReferences)(records)(state); // Note: we select the keys of the FIRST object as the canonical template.

      var columns = Object.keys(recordData[0]);
      var valueSets = recordData.map(function (x) {
        return "('".concat(escapeQuote(Object.values(x)).join("', '"), "')");
      });
      var query = handleValues("INSERT INTO ".concat(table, " (").concat(columns.join(', '), ") VALUES ").concat(valueSets.join(', '), ";"), handleOptions(options));
      var safeQuery = "INSERT INTO ".concat(table, " (").concat(columns.join(', '), ") VALUES [--REDACTED--]];");
      return new Promise(function (resolve, reject) {
        console.log("Executing insert many via: ".concat(safeQuery));
        var request = new _tedious.Request(query, function (err, rowCount, rows) {
          if (err) {
            console.error(err.message);
            throw err;
          } else {
            console.log("Finished: ".concat(rowCount, " row(s)."));
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
 * @public
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
      var columns = Object.keys(recordData).sort(); // console.log(recordData);

      var selectValues = columns.map(function (key) {
        return "".concat(escapeQuote(recordData[key]), " AS ").concat(key);
      }).join(', ');
      var updateValues = columns.map(function (key) {
        return "[Target].".concat(key, "=").concat(escapeQuote(recordData[key]));
      }).join(', ');
      var insertColumns = columns.join(', ');
      var insertValues = columns.map(function (key) {
        return "[Source].".concat(key);
      }).join(', ');
      var query = handleValues("MERGE ".concat(table, " AS [Target]\n        USING (SELECT ").concat(selectValues, ") AS [Source] \n        ON [Target].").concat(uuid, " = [Source].").concat(uuid, "\n        WHEN MATCHED THEN\n          UPDATE SET ").concat(updateValues, " \n        WHEN NOT MATCHED THEN\n          INSERT (").concat(insertColumns, ") VALUES (").concat(insertValues, ");"), handleOptions(options));
      var safeQuery = "MERGE ".concat(table, " AS [Target]\n        USING (SELECT [--REDACTED--]) \n        ON [Target].[--VALUE--] = [Source].[--VALUE--]\n        WHEN MATCHED THEN\n          UPDATE SET [--REDACTED--] \n        WHEN NOT MATCHED THEN\n          INSERT (").concat(insertColumns, ") VALUES [--REDACTED--];");
      return new Promise(function (resolve, reject) {
        console.log("Executing upsert via : ".concat(query));
        var request = new _tedious.Request(query, function (err, rowCount, rows) {
          if (err) {
            console.error(err.message);
            throw err;
          } else {
            console.log("Finished: ".concat(rowCount, " row(s)."));
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
 * @public
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


function upsertMany(table, uuid, records, options) {
  return function (state) {
    var connection = state.connection;

    try {
      var recordData = (0, _languageCommon.expandReferences)(records)(state); // Note: we select the keys of the FIRST object as the canonical template.

      var columns = Object.keys(recordData[0]);
      var valueSets = recordData.map(function (x) {
        return "('".concat(escapeQuote(Object.values(x)).join("', '"), "')");
      });
      var insertColumns = columns.join(', ');
      var insertValues = columns.map(function (key) {
        return "[Source].".concat(key);
      }).join(', ');
      var updateValues = columns.map(function (key) {
        return "[Target].".concat(key, "=[Source].").concat(key);
      }).join(', ');
      var query = handleValues("MERGE ".concat(table, " AS [Target]\n        USING (VALUES ").concat(valueSets.join(', '), ") AS [Source] (").concat(insertColumns, ")\n        ON [Target].").concat(uuid, " = [Source].").concat(uuid, "\n        WHEN MATCHED THEN\n          UPDATE SET ").concat(updateValues, "\n        WHEN NOT MATCHED THEN\n          INSERT (").concat(insertColumns, ") VALUES (").concat(insertValues, ");"), handleOptions(options));
      var safeQuery = "MERGE ".concat(table, " AS [Target]\n        USING (VALUES [--REDACTED--]) AS [SOURCE] (").concat(insertColumns, ")\n        ON [Target].[--VALUE--] = [Source].[--VALUE--]\n        WHEN MATCHED THEN\n          UPDATE SET [--REDACTED--] \n        WHEN NOT MATCHED THEN\n          INSERT (").concat(insertColumns, ") VALUES [--REDACTED--];");
      return new Promise(function (resolve, reject) {
        console.log("Executing upsert via : ".concat(safeQuery));
        var request = new _tedious.Request(query, function (err, rowCount, rows) {
          if (err) {
            console.error(err.message);
            throw err;
          } else {
            console.log("Finished: ".concat(rowCount, " row(s)."));
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
