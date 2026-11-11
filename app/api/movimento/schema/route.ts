import { NextRequest, NextResponse } from '@/server/next-server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from '@/server/next-headers';
import { getDb, colunasInfo } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const db = await getDb();
    const dbName = session.dbConfig?.database;

    // Use information_schema to get column details
    // We want to know column name, type, and if it looks like a foreign key (ends with _id)
    const columns = await colunasInfo(db, dbName, 'est_estoque_movimentacoes');

    // Map columns to a format useful for the UI
    const fields = columns.map((col: any) => ({
      key: col.COLUMN_NAME,
      label: col.COLUMN_NAME.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
      type: col.DATA_TYPE,
      isRelation: col.COLUMN_NAME.endsWith('_id'),
      relationTable: col.COLUMN_NAME.endsWith('_id') ? `cad_produtos_${col.COLUMN_NAME.replace('_id', 's')}` : null
    }));

    return NextResponse.json(fields);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
