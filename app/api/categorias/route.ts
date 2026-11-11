import { NextRequest, NextResponse } from '@/server/next-server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from '@/server/next-headers';
import { getDb } from '@/lib/db';
import { grupoDa, ehDoGrupo } from '@/lib/empresa';

export async function GET(req: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const db = await getDb();
    const dbName = session.dbConfig?.database;
    const [rows]: any = await db.execute(`
      SELECT c1.*,
      (SELECT COUNT(*) FROM ${dbName}.cad_produtos_categorias c2 WHERE c2.categoria_pai = c1.id AND c2.ativo = 1) as children_count
      FROM ${dbName}.cad_produtos_categorias c1
      WHERE c1.ativo = 1 AND c1.grupo_id = ?
      ORDER BY c1.nome ASC
    `, [grupoDa(session)]);
    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const { nome, descricao, categoria_pai, ativo } = await req.json();
    if (!nome) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
    const db = await getDb();
    const dbName = session.dbConfig?.database;
    const emp = grupoDa(session);
    if (categoria_pai && !(await ehDoGrupo(db, dbName, 'cad_produtos_categorias', categoria_pai, emp))) return NextResponse.json({ error: 'Categoria pai não encontrada.' }, { status: 400 });
    const [result]: any = await db.execute(
      `INSERT INTO ${dbName}.cad_produtos_categorias (grupo_id, nome, descricao, categoria_pai, ativo) VALUES (?, ?, ?, ?, ?)`,
      [emp, nome, descricao, categoria_pai || null, ativo]
    );
    return NextResponse.json({ id: result.insertId, nome, descricao, categoria_pai, ativo });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
