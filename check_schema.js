import mysql from 'mysql2/promise';

async function checkSchema() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'kms_master'
  });

  const [tenants] = await connection.execute('SELECT db_name FROM tenants LIMIT 1;');
  const dbName = tenants[0].db_name;
  console.log(`Checking schema in ${dbName}`);

  const c2 = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: dbName
  });

  const [schema] = await c2.execute('SHOW CREATE TABLE partner_branches;');
  console.log(schema[0]['Create Table']);
  
  await c2.end();
  await connection.end();
}

checkSchema().catch(console.error);
