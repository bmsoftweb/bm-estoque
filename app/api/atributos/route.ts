import { NextRequest, NextResponse } from '@/server/next-server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from '@/server/next-headers';
import { getDb } from '@/lib/db';
import { grupoDa } from '@/lib/empresa';

export async function GET(req: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const db = await getDb();
    const dbName = session.dbConfig?.database;
    const [rows]: any = await db.execute(`SELECT * FROM ${dbName}.cad_produtos_atributos WHERE ativo = 1 AND grupo_id = ? ORDER BY nome ASC`, [grupoDa(session)]);
    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const { nome, ativo } = await req.json();
    if (!nome) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
    const db = await getDb();
    const dbName = session.dbConfig?.database;
    const [result]: any = await db.execute(
      `INSERT INTO ${dbName}.cad_produtos_atributos (grupo_id, nome, ativo) VALUES (?, ?, ?)`,
      [grupoDa(session), nome, ativo ?? 1]
    );
    return NextResponse.json({ id: result.insertId, nome, ativo: ativo ?? 1 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
