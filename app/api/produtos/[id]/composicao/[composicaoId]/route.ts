import { NextResponse, NextRequest } from '@/server/next-server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from '@/server/next-headers';
import { getDb } from '@/lib/db';
import { grupoDa, ehDoGrupo } from '@/lib/empresa';

const NAO_ACHOU = () => NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 });

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string, composicaoId: string }> }) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const db = await getDb();
    const dbName = session.dbConfig?.database;

    const { id, composicaoId } = await params;
    if (!(await ehDoGrupo(db, dbName, 'cad_produtos', id, grupoDa(session)))) return NAO_ACHOU();
    const query = `DELETE FROM ${dbName}.cad_produtos_composicao WHERE id = ? AND produto_pai_id = ?`;
    await db.execute(query, [composicaoId, id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting component:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string, composicaoId: string }> }) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const db = await getDb();
    const dbName = session.dbConfig?.database;

    const { id, composicaoId } = await params;
    const body = await request.json();
    const { componente_prod_id, componente_var_id, quantidade, unidade_id } = body;
    const emp = grupoDa(session);
    if (!(await ehDoGrupo(db, dbName, 'cad_produtos', id, emp)) || !(await ehDoGrupo(db, dbName, 'cad_produtos', componente_prod_id, emp))) return NAO_ACHOU();

    const query = `
      UPDATE ${dbName}.cad_produtos_composicao 
      SET componente_prod_id = ?, componente_var_id = ?, quantidade = ?, unidade_id = ?
      WHERE id = ? AND produto_pai_id = ?
    `;
    
    const var_id = componente_var_id ? componente_var_id : null;
    await db.execute(query, [componente_prod_id, var_id, quantidade, unidade_id, composicaoId, id]);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating component:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
