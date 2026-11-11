import { NextRequest, NextResponse } from '@/server/next-server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from '@/server/next-headers';
import { getDb } from '@/lib/db';
import { empresaDa, ehDaEmpresa } from '@/lib/empresa';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const { id } = await params;
    const { codigo, descricao, pai_id, tipo, ativo } = await req.json();
    const db = await getDb();
    const dbName = session.dbConfig?.database;
    const emp = empresaDa(session);
    if (pai_id && !(await ehDaEmpresa(db, dbName, 'cad_produtos_localizacoes', pai_id, emp))) return NextResponse.json({ error: 'Localização pai não encontrada.' }, { status: 400 });
    const [r]: any = await db.execute(
      `UPDATE ${dbName}.cad_produtos_localizacoes SET codigo = ?, descricao = ?, pai_id = ?, tipo = ?, ativo = ? WHERE id = ? AND empresa_id = ?`,
      [codigo || null, descricao, pai_id || null, tipo || null, ativo, id, emp]
    );
    if (!r.affectedRows) return NextResponse.json({ error: 'Localização não encontrada.' }, { status: 404 });
    return NextResponse.json({ id, codigo, descricao, pai_id, tipo, ativo });
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
    await db.execute(`UPDATE ${dbName}.cad_produtos_localizacoes SET ativo = 0 WHERE id = ? AND empresa_id = ?`, [id, empresaDa(session)]);
    return NextResponse.json({ message: 'Excluído com sucesso' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
