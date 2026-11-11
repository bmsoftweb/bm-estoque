import { NextRequest, NextResponse } from '@/server/next-server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from '@/server/next-headers';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    
    const db = await getDb();
    const dbName = session.dbConfig?.database;

    // SCHEMA DE EXEMPLO - Retorna as colunas da tabela para montar os filtros dinamicamente
    const [columns]: any = await db.execute(`
      SELECT COLUMN_NAME as \`key\`, COLUMN_NAME as label, 
      DATA_TYPE as type, 
      IF(COLUMN_NAME LIKE '%id%', 1, 0) as isRelation
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'cad_produtos'
    `, [dbName]);

    return NextResponse.json(columns);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
