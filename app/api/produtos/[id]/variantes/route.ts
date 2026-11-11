import { NextRequest, NextResponse } from '@/server/next-server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { getDb } from '@/lib/db';
import { cookies } from '@/server/next-headers';
import { grupoDa, ehDoGrupo } from '@/lib/empresa';

const NAO_ACHOU = () => NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 });

// GET variants for a specific product
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { id: produto_id } = await params;
    const db = await getDb();
    const dbName = session.dbConfig?.database;
    if (!(await ehDoGrupo(db, dbName, 'cad_produtos', produto_id, grupoDa(session)))) return NAO_ACHOU();

    const [rows]: any = await db.execute(
      `SELECT id, produto_id, sku_variante, nome_adicional, preco_custo, preco_venda, codigo_barras, ativo, date_insert, date_update FROM ${dbName}.cad_produtos_variantes WHERE produto_id = ? AND ativo = 1 ORDER BY id DESC`,
      [produto_id]
    );

    return NextResponse.json(rows);
  } catch (error: any) {
    console.error('Error fetching variants:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST new variant for a specific product
// atributo_valor_ids: os valores escolhidos (ex.: Cor = Azul, Tamanho = A5), gravados em cad_produtos_variante_atributos
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let conn: any = null;
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { id: produto_id } = await params;
    const body = await req.json();
    const { sku_variante, nome_adicional, preco_custo, preco_venda, codigo_barras, ativo } = body;
    const valorIds = [...new Set<number>((Array.isArray(body.atributo_valor_ids) ? body.atributo_valor_ids : []).map(Number).filter((n: number) => Number.isInteger(n) && n > 0))];

    const db = await getDb();
    const dbName = session.dbConfig?.database;
    if (!(await ehDoGrupo(db, dbName, 'cad_produtos', produto_id, grupoDa(session)))) return NAO_ACHOU();

    // Cada valor tem de ser de um atributo deste produto, e no máximo um valor por atributo
    if (valorIds.length) {
      const [vals]: any = await db.query(
        `SELECT av.id, av.atributo_id FROM ${dbName}.cad_produtos_atributos_valores av
           JOIN ${dbName}.cad_produtos_atributos_produtos ap ON ap.atributo_id = av.atributo_id AND ap.produto_id = ?
          WHERE av.id IN (?)`,
        [produto_id, valorIds]
      );
      if (vals.length !== valorIds.length) return NextResponse.json({ error: 'Valor de atributo que não pertence a este produto.' }, { status: 400 });
      if (new Set(vals.map((v: any) => v.atributo_id)).size !== vals.length) return NextResponse.json({ error: 'Mais de um valor para o mesmo atributo.' }, { status: 400 });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();
    const [result]: any = await conn.execute(
      `INSERT INTO ${dbName}.cad_produtos_variantes
      (produto_id, sku_variante, nome_adicional, preco_custo, preco_venda, codigo_barras, ativo)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [produto_id, sku_variante, nome_adicional, preco_custo || 0, preco_venda || 0, codigo_barras || null, ativo ?? 1]
    );
    for (const valorId of valorIds) {
      await conn.execute(`INSERT INTO ${dbName}.cad_produtos_variante_atributos (variante_id, atributo_valor_id) VALUES (?, ?)`, [result.insertId, valorId]);
    }
    await conn.commit();

    const [newVariant]: any = await db.execute(
      `SELECT * FROM ${dbName}.cad_produtos_variantes WHERE id = ?`,
      [result.insertId]
    );

    return NextResponse.json(newVariant[0]);
  } catch (error: any) {
    if (conn) await conn.rollback().catch(() => {});
    console.error('Error creating variant:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    if (conn) conn.release();
  }
}
