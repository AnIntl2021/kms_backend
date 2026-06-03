import mysql from 'mysql2/promise';

async function check() {
  const connection = await mysql.createConnection({
    host: '64.227.182.87',
    user: 'fnf_user',
    password: 'FreshFast_Admin_2026!',
    database: 'fresh_n_fast_prod'
  });

  const [branches] = await connection.execute("SELECT * FROM partner_branches WHERE name_en LIKE '%Sharq%'");
  console.log('Branches:', branches);
  
  process.exit();
}
check();
