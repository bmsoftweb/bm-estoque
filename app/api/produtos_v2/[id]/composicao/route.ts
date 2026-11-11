import { NextResponse, NextRequest } from '@/server/next-server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from '@/server/next-headers';
import { getDb } from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const db = await getDb();
    const dbName = session.dbConfig?.database;

    const { id } = await params;
    const query = `
      SELECT 
        c.*, 
        p.nome as componente_prod_nome, 
        p.sku as componente_prod_sku,
        v.nome_adicional as componente_var_nome,
        v.sku_variante as componente_var_sku,
        u.sigla as unidade_sigla
      FROM ${dbName}.cad_produtos_composicao c
      LEFT JOIN ${dbName}.cad_produtos p ON c.componente_prod_id = p.id
      LEFT JOIN ${dbName}.cad_produtos_variantes v ON c.componente_var_id = v.id
      LEFT JOIN ${dbName}.cad_produtos_unidades_medida u ON c.unidade_id = u.id
      WHERE c.produto_pai_id = ?
    `;

    // Ensure table exists on first GET
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS ${dbName}.cad_produtos_composicao (
        id int UNSIGNED NOT NULL AUTO_INCREMENT,
        produto_pai_id int UNSIGNED NOT NULL COMMENT 'Produto composto (kit)',
        componente_prod_id int UNSIGNED DEFAULT NULL COMMENT 'Produto componente',
        componente_var_id int UNSIGNED DEFAULT NULL COMMENT 'Variante componente (opcional)',
        quantidade decimal(15, 4) NOT NULL DEFAULT 1.0000,
        unidade_id smallint UNSIGNED NOT NULL,
        PRIMARY KEY (id)
      )
    `;
    await db.execute(createTableQuery);

    const [rows]: any = await db.execute(query, [id]);
    return NextResponse.json(rows);
  } catch (error: any) {
    console.error('Error fetching composition:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const db = await getDb();
    const dbName = session.dbConfig?.database;

    const { id } = await params;
    const body = await request.json();
    const { componente_prod_id, componente_var_id, quantidade, unidade_id } = body;

    const query = `
      INSERT INTO ${dbName}.cad_produtos_composicao (produto_pai_id, componente_prod_id, componente_var_id, quantidade, unidade_id)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    // Convert undefined to null for DB insertion
    const var_id = componente_var_id ? componente_var_id : null;
    
    const [result]: any = await db.execute(query, [id, componente_prod_id, var_id, quantidade, unidade_id]);

    return NextResponse.json({ id: result.insertId, message: 'Component added successfully' });
  } catch (error: any) {
    console.error('Error adding component:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
