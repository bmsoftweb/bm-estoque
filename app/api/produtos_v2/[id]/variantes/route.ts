import { NextRequest, NextResponse } from '@/server/next-server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { getDb } from '@/lib/db';
import { cookies } from '@/server/next-headers';

// GET variants for a specific product
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { id: produto_id } = await params;
    const db = await getDb();
    const dbName = session.dbConfig?.database;

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
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { id: produto_id } = await params;
    const body = await req.json();
    const { sku_variante, nome_adicional, preco_custo, preco_venda, codigo_barras, ativo } = body;
    
    const db = await getDb();
    const dbName = session.dbConfig?.database;

    const [result]: any = await db.execute(
      `INSERT INTO ${dbName}.cad_produtos_variantes 
      (produto_id, sku_variante, nome_adicional, preco_custo, preco_venda, codigo_barras, ativo) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [produto_id, sku_variante, nome_adicional, preco_custo || 0, preco_venda || 0, codigo_barras || null, ativo ?? 1]
    );

    const [newVariant]: any = await db.execute(
      `SELECT * FROM ${dbName}.cad_produtos_variantes WHERE id = ?`,
      [result.insertId]
    );

    return NextResponse.json(newVariant[0]);
  } catch (error: any) {
    console.error('Error creating variant:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
