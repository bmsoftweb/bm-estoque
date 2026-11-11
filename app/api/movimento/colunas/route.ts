import { NextRequest, NextResponse } from '@/server/next-server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from '@/server/next-headers';
import { getDb } from '@/lib/db';

/** Colunas da tabela est_estoque_movimentacoes: lidas do INFORMATION_SCHEMA, sem executar SQL vindo do navegador */
export async function GET(_req: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn || !session.userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const db = await getDb();
    const [linhas]: any = await db.execute(
      'SELECT COLUMN_NAME AS name, TABLE_NAME AS `table` FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION',
      [session.dbConfig?.database, 'est_estoque_movimentacoes'],
    );
    return NextResponse.json({ columns: linhas });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao ler as colunas' }, { status: 500 });
  }
}
