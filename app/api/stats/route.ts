import { NextRequest, NextResponse } from '@/server/next-server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from '@/server/next-headers';
import { masterPool, getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const db = await getDb();
    const dbName = session.dbConfig?.database;

    // Get total products and total suppliers from BUSINESS DB
    const [prodRows]: any = await db.execute(`SELECT COUNT(*) as count FROM ${dbName}.cad_produtos`);
    const totalProducts = prodRows[0].count;

    const [fornRows]: any = await db.execute(`SELECT COUNT(*) as count FROM ${dbName}.cad_fornecedores`);
    const totalFornecedores = fornRows[0].count;

    return NextResponse.json({
      totalProducts,
      totalFornecedores,
      dbStatus: 'Ativo',
      dbIp: '45.224.130.145'
    });
  } catch (error: any) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Erro ao buscar estatísticas: ' + error.message }, { status: 500 });
  }
}
