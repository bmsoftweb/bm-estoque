import { NextRequest, NextResponse } from '@/server/next-server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from '@/server/next-headers';
import { getDb } from '@/lib/db';
import { grupoDa, ehDoGrupo } from '@/lib/empresa';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    
    const db = await getDb();
    const dbName = session.dbConfig?.database;
    if (!(await ehDoGrupo(db, dbName, 'cad_produtos', id, grupoDa(session)))) return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 });

    // First check if cad_produtos_atributos_valores exists
    let hasValoresTable = false;
    try {
      const [tableCheck]: any = await db.execute(`SHOW TABLES FROM ${dbName} LIKE 'cad_produtos_atributos_valores'`);
      if (tableCheck.length > 0) hasValoresTable = true;
    } catch (e) {}

    // Get assigned attributes
    const [attrs]: any = await db.execute(
      `SELECT a.id, a.nome 
       FROM ${dbName}.cad_produtos_atributos_produtos ap
       JOIN ${dbName}.cad_produtos_atributos a ON ap.atributo_id = a.id
       WHERE ap.produto_id = ?`,
      [id]
    );

    const result = [];
    for (const attr of attrs) {
      let valores = [];
      if (hasValoresTable) {
        try {
          const [vals]: any = await db.execute(
            `SELECT id, atributo_id, valor, codigo_hex FROM ${dbName}.cad_produtos_atributos_valores WHERE atributo_id = ?`,
            [attr.id]
          );
          valores = vals;
        } catch (e) {
          // Table structure might differ, ignore if error
        }
      }
      result.push({
        ...attr,
        valores
      });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
