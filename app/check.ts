import mysql from 'mysql2/promise';

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'gerenciadorweb'
  });

  const [tables] = await conn.execute(`SHOW TABLES`);
  console.log('TABLES:', tables);
  
  try {
    const [cols] = await conn.execute(`SHOW COLUMNS FROM cad_produtos_variantes`);
    console.log('VARIANTES:', cols);
  } catch (e) {}

  try {
    const [cols] = await conn.execute(`SHOW COLUMNS FROM est_atributos_valores`);
    console.log('VALORES:', cols);
  } catch (e: any) {
    console.log('VALORES ERROR:', e.message);
  }

  await conn.end();
}
run();
