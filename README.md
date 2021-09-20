# Language MSSQL [![Build Status](https://travis-ci.org/OpenFn/language-mssql.svg?branch=master)](https://travis-ci.org/OpenFn/language-mssql)

Language Pack for connecting to Azure SQL Server via OpenFn.

## Documentation

### Sample state.json

```json
{
  "data": { "a": 1 },
  "configuration": {
    "userName": "shhh",
    "password": "secret",
    "server": "something.database.windows.net",
    "database": "my-demo"
  }
}
```

### Sample expression

## sql query

```js
sql({
  query: `
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE'
    AND TABLE_CATALOG='my-demo'
  `,
});

sql({
  query: `SELECT * FROM Household`,
  options: {
    writeSql: true, // Keep to true to log query (otherwise make it false).
    execute: true, // keep to false to not alter DB
  },
});
```

## Find a single value for a table

This helper function allows to build a specific query where `sql` would not be best suited. It returns a single value and not a promise. An example of usage would be in building a mapping object with a value from a lookup table.

```js
alterState(async state => {
  const user = {
    id: 1,
    name: 'Mamadou',
    user_id: await findValue({
      uuid: 'id',
      relation: 'users',
      where: { first_name: 'Mama%' },
      operator: { first_name: 'like' }, // operator is optional. "=" is used by default.
    })(state),
  };

  return upsert(...)(state);
});
```

## Insert one single record

```js
insert(
  'SomeDB.dbo.SupplierTest',
  {
    SupplierNumber: 1,
    Name: dataValue('name'),
    Address: 'Nunya Bihz-Nash',
  },
  {
    // The optional `options` argument allows for global string replacement with
    // NULL. This is useful if you want to map an undefined value (e.g., x.name)
    // to NULL. It can be a single string or an array of strings.
    // It DEFAULTS to "'undefined'", and can be turned off w/ `false`.
    setNull: "'undefined'",
  }
);
```

## Insert or Update using a unique column as a key

This function insert or update depending on the existence of a record in the database.

```js
upsert(
  'SomeDB.dbo.Supplier',
  'SupplierNumber',
  {
    SupplierNumber: 1,
    Name: dataValue('name'),
    Address: 'Now I can tell!',
  },
  // Do NOT replace any instances of 'undefined' in the final SQL statement.
  { setNull: false }
);
```

## Insert or Update if a value exist in the record

This function will upsert a record only if the logical given is true. In this case we check if `dataValue('name')` exists.

```js
upsertIf(
  dataValue('name'),
  'users',
  'user_id',
  {
    name: 'Elodie',
    id: 7,
  },
  // Replace any occurence of '' and 'undefined' to NULL
  { setNull: ["''", "'undefined'"] }
);
```

## Insert Many records

This function allows the insert of a set of records inside a table all at once.
Pass `logQuery` option to `true` to display the query.

```js
// Note that insertMany takes a function which returns an array—this helps
// enforce that each item in the array has the same keys.
insertMany('SomeDB.dbo.Supplier', state =>
  state.data.supplierArray.map(s => {
    return {
      SupplierNumber: s.id,
      Name: s.name,
      Address: s.address,
    };
  })
);
```

## Insert or Update Many records

This function inserts or updates many records all at once depending on their existence in the database.

```js
// Note that insertMany takes a function which returns an array—this helps
// enforce that each item in the array has the same keys.
upsertMany('SomeDB.dbo.Supplier', 'SupplierNumber', state =>
  state.data.supplierArray.map(s => {
    return {
      SupplierNumber: s.id,
      Name: s.name,
      Address: s.address,
    };
  })
);
```

## Development

Clone the repo, run `npm install`.

Run tests using `npm run test` or `npm run test:watch`

Build the project using `make`.

To build the docs for this repo, run `./node_modules/.bin/jsdoc --readme ./README.md ./lib -d docs`.
