import mysql from 'mysql2/promise';

// Mesmo banco do ERP BMsoft usado pelo Romaneio (bmerp_000000). Credenciais só pelo .env.
for (const nome of ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_PASSWORD']) {
  if (!process.env[nome]) throw new Error(`${nome} não definido no .env.`);
}

export const dbConfig = {
  host: process.env.MYSQL_HOST as string,
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER as string,
  database: process.env.MYSQL_DATABASE || 'bmerp_000000',
};

export const masterPool = mysql.createPool({
  ...dbConfig,
  password: process.env.MYSQL_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// O sistema opera no horário de Brasília (UTC-3), qualquer que seja o fuso do servidor MySQL
masterPool.pool.on('connection', (conn: any) => {
  conn.query("SET time_zone = '-03:00'");
});

// Um só banco para tudo: mantido como função porque as rotas já chamam getDb()
export async function getDb(): Promise<any> {
  return masterPool;
}

export default masterPool;

// Colunas de uma tabela (INFORMATION_SCHEMA é lento): em memória por 60 s, porque quase nunca mudam
const cacheColunas = new Map<string, { em: number; linhas: any[] }>();
export async function colunasInfo(db: any, dbName: string | undefined, tabela: string): Promise<any[]> {
  const chave = `${dbName}.${tabela}`;
  const c = cacheColunas.get(chave);
  if (c && Date.now() - c.em < 60_000) return c.linhas;
  const [linhas]: any = await db.execute(
    'SELECT COLUMN_NAME, DATA_TYPE, COLUMN_COMMENT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION',
    [dbName, tabela],
  );
  cacheColunas.set(chave, { em: Date.now(), linhas });
  return linhas;
}
