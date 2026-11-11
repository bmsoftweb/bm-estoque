import { NextRequest, NextResponse } from '@/server/next-server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from '@/server/next-headers';
import { getDb } from '@/lib/db';
import { grupoDa, ehDoGrupo } from '@/lib/empresa';

const NAO_ACHOU = () => NextResponse.json({ error: 'Atributo não encontrado.' }, { status: 404 });

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const db = await getDb();
    const dbName = session.dbConfig?.database;
    if (!(await ehDoGrupo(db, dbName, 'cad_produtos_atributos', id, grupoDa(session)))) return NAO_ACHOU();
    const [rows]: any = await db.execute(`SELECT * FROM ${dbName}.cad_produtos_atributos_valores WHERE atributo_id = ? ORDER BY valor ASC`, [id]);
    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const { valor, codigo_hex } = await req.json();
    if (!valor) return NextResponse.json({ error: 'Valor é obrigatório' }, { status: 400 });
    const db = await getDb();
    const dbName = session.dbConfig?.database;
    if (!(await ehDoGrupo(db, dbName, 'cad_produtos_atributos', id, grupoDa(session)))) return NAO_ACHOU();
    const [result]: any = await db.execute(
      `INSERT INTO ${dbName}.cad_produtos_atributos_valores (atributo_id, valor, codigo_hex) VALUES (?, ?, ?)`,
      [id, valor, codigo_hex]
    );
    return NextResponse.json({ id: result.insertId, atributo_id: id, valor, codigo_hex });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const { valor_id, valor, codigo_hex } = await req.json();
    const db = await getDb();
    const dbName = session.dbConfig?.database;
    if (!(await ehDoGrupo(db, dbName, 'cad_produtos_atributos', id, grupoDa(session)))) return NAO_ACHOU();
    await db.execute(
      `UPDATE ${dbName}.cad_produtos_atributos_valores SET valor = ?, codigo_hex = ? WHERE id = ? AND atributo_id = ?`,
      [valor, codigo_hex, valor_id, id]
    );
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const { valor_id } = await req.json();
    const db = await getDb();
    const dbName = session.dbConfig?.database;
    if (!(await ehDoGrupo(db, dbName, 'cad_produtos_atributos', id, grupoDa(session)))) return NAO_ACHOU();
    await db.execute(`UPDATE ${dbName}.cad_produtos_atributos_valores SET ativo = 0 WHERE id = ? AND atributo_id = ?`, [valor_id, id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
