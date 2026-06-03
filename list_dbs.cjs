const mysql = require('mysql2/promise');
require('dotenv').config();

async function listDbs() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS
  });

  try {
    const [dbs] = await connection.execute('SHOW DATABASES');
    console.log("Databases on 64.227.182.87:");
    dbs.forEach(d => console.log(d.Database));
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

listDbs();
