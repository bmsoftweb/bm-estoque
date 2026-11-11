import { NextRequest, NextResponse } from '@/server/next-server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { getDb } from '@/lib/db';
import { cookies } from '@/server/next-headers';
import { grupoDa } from '@/lib/empresa';

/** A variante é de um produto desta empresa */
const DO_GRUPO = (bd: string | undefined) => `produto_id IN (SELECT id FROM ${bd}.cad_produtos WHERE grupo_id = ?)`;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const { sku_variante, nome_adicional, preco_custo, preco_venda, codigo_barras, ativo } = body;

    const db = await getDb();
    const dbName = session.dbConfig?.database;

    const [r]: any = await db.execute(
      `UPDATE ${dbName}.cad_produtos_variantes
      SET sku_variante = ?, nome_adicional = ?, preco_custo = ?, preco_venda = ?, codigo_barras = ?, ativo = ?, date_update = CURRENT_TIMESTAMP
      WHERE id = ? AND ${DO_GRUPO(dbName)}`,
      [sku_variante, nome_adicional, preco_custo, preco_venda, codigo_barras, ativo, id, grupoDa(session)]
    );
    if (!r.affectedRows) return NextResponse.json({ error: 'Variante não encontrada.' }, { status: 404 });

    const [updated]: any = await db.execute(
      `SELECT * FROM ${dbName}.cad_produtos_variantes WHERE id = ?`,
      [id]
    );

    return NextResponse.json(updated[0]);
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

    await db.execute(`UPDATE ${dbName}.cad_produtos_variantes SET ativo = 0 WHERE id = ? AND ${DO_GRUPO(dbName)}`, [id, grupoDa(session)]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
