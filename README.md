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

sql({ query: `SELECT * FROM Household` });
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
    // to NULL. It DEFAULTS to "'undefined'", and can be turned off w/ `false`.
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

## Insert Many records
This function allows the insert of a set of records inside a table all at once.
```js
// Note that insertMany takes a function which returns an array—this helps
// enforce that each item in the array has the same keys.
insertMany('SomeDB.dbo.Supplier', (state) =>
  state.data.supplierArray.map((s) => {
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
