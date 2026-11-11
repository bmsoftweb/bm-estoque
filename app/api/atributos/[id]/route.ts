import { NextRequest, NextResponse } from '@/server/next-server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from '@/server/next-headers';
import { getDb } from '@/lib/db';
import { grupoDa } from '@/lib/empresa';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const { id } = await params;
    const { nome, ativo } = await req.json();
    const db = await getDb();
    const dbName = session.dbConfig?.database;
    const [r]: any = await db.execute(
      `UPDATE ${dbName}.cad_produtos_atributos SET nome = ?, ativo = ? WHERE id = ? AND grupo_id = ?`,
      [nome, ativo, id, grupoDa(session)]
    );
    if (!r.affectedRows) return NextResponse.json({ error: 'Atributo não encontrado.' }, { status: 404 });
    return NextResponse.json({ id, nome, ativo });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const { id } = await params;
    const db = await getDb();
    const dbName = session.dbConfig?.database;
    await db.execute(`UPDATE ${dbName}.cad_produtos_atributos SET ativo = 0 WHERE id = ? AND grupo_id = ?`, [id, grupoDa(session)]);
    return NextResponse.json({ message: 'Excluído com sucesso' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
