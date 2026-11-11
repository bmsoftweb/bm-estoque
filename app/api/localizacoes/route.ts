import { NextRequest, NextResponse } from '@/server/next-server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from '@/server/next-headers';
import { getDb } from '@/lib/db';
import { empresaDa, ehDaEmpresa } from '@/lib/empresa';

export async function GET(req: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const db = await getDb();
    const dbName = session.dbConfig?.database;
    if (!dbName) return NextResponse.json({ error: 'Configuração de banco de dados não encontrada' }, { status: 400 });
    const [rows]: any = await db.execute(`
      SELECT 
        l1.*, 
        l2.descricao as pai_descricao,
        (SELECT COUNT(*) FROM ${dbName}.cad_produtos_localizacoes l3 WHERE l3.pai_id = l1.id AND l3.ativo = 1) as children_count
      FROM ${dbName}.cad_produtos_localizacoes l1
      LEFT JOIN ${dbName}.cad_produtos_localizacoes l2 ON l1.pai_id = l2.id
      WHERE l1.ativo = 1 AND l1.empresa_id = ?
      ORDER BY l1.codigo ASC, l1.descricao ASC
    `, [empresaDa(session)]);
    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const { codigo, descricao, pai_id, tipo, ativo } = await req.json();
    if (!descricao) return NextResponse.json({ error: 'Descrição é obrigatória' }, { status: 400 });
    const db = await getDb();
    const dbName = session.dbConfig?.database;
    if (!dbName) return NextResponse.json({ error: 'Configuração de banco de dados não encontrada' }, { status: 400 });
    const emp = empresaDa(session);
    if (pai_id && !(await ehDaEmpresa(db, dbName, 'cad_produtos_localizacoes', pai_id, emp))) return NextResponse.json({ error: 'Localização pai não encontrada.' }, { status: 400 });
    const [result]: any = await db.execute(
      `INSERT INTO ${dbName}.cad_produtos_localizacoes (empresa_id, codigo, descricao, pai_id, tipo, ativo) VALUES (?, ?, ?, ?, ?, ?)`,
      [emp, codigo || null, descricao, pai_id || null, tipo || null, ativo ?? 1]
    );
    return NextResponse.json({ id: result.insertId, codigo, descricao, pai_id, tipo, ativo: ativo ?? 1 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
