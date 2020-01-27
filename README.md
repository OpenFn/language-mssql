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

## Development

Clone the repo, run `npm install`.

Run tests using `npm run test` or `npm run test:watch`

Build the project using `make`.
