import { NextRequest, NextResponse } from '@/server/next-server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from '@/server/next-headers';
import { getDb } from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const { 
      sku, 
      nome, 
      descricao, 
      tipo_produto, 
      categoria_id, 
      unidade_id, 
      preco_custo, 
      preco_venda, 
      ativo,
      atributos_selecionados,
      codigo_barras,
      marca_id
    } = await req.json();
    const db = await getDb();
    const dbName = session.dbConfig?.database;
    await db.execute(
      `UPDATE ${dbName}.cad_produtos SET sku = ?, nome = ?, descricao = ?, tipo_produto = ?, categoria_id = ?, marca_id = ?, unidade_id = ?, preco_custo = ?, preco_venda = ?, ativo = ?, codigo_barras = ? WHERE id = ?`,
      [sku, nome, descricao, tipo_produto, categoria_id || null, marca_id || null, unidade_id, preco_custo, preco_venda, ativo, codigo_barras || null, id]
    );

    // Update attributes
    await db.execute(`DELETE FROM ${dbName}.cad_produtos_atributos_produtos WHERE produto_id = ?`, [id]);
    if (atributos_selecionados && Array.isArray(atributos_selecionados) && (tipo_produto === 'variacao_simples' || tipo_produto === 'variacao_atributo')) {
      for (const attrId of atributos_selecionados) {
        if (attrId && !isNaN(parseInt(attrId))) {
          await db.execute(
            `INSERT IGNORE INTO ${dbName}.cad_produtos_atributos_produtos (produto_id, atributo_id) VALUES (?, ?)`,
            [id, parseInt(attrId)]
          );
        }
      }
    }

    const atributos_vinculados = (atributos_selecionados && Array.isArray(atributos_selecionados) && (tipo_produto === 'variacao_simples' || tipo_produto === 'variacao_atributo')) 
      ? atributos_selecionados.filter((a: any) => a && !isNaN(parseInt(a))).join(',')
      : null;

    return NextResponse.json({ id, sku, nome, descricao, tipo_produto, categoria_id, marca_id, unidade_id, preco_custo, preco_venda, ativo, atributos_vinculados, codigo_barras });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const db = await getDb();
    const dbName = session.dbConfig?.database;
    await db.execute(`UPDATE ${dbName}.cad_produtos SET ativo = 0 WHERE id = ?`, [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
