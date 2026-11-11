import { NextRequest, NextResponse } from '@/server/next-server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from '@/server/next-headers';
import { getDb, colunasInfo } from '@/lib/db';
import { lerConfigGrid } from '@/lib/config-grid';

export async function GET(req: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn || !session.userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const db = await getDb();
    const dbName = session.dbConfig?.database;

    const { searchParams } = new URL(req.url);

    // Get list of valid columns to prevent arbitrary field filtering
    const validColumns: string[] = (await colunasInfo(db, dbName, 'cad_produtos')).map((c: any) => c.COLUMN_NAME);

    // Add standard joined fields to valid columns
    validColumns.push('categoria_nome', 'marca_nome', 'variantes_count', 'atributos_vinculados');

    // Fetch grid config to handle dynamic joins
    const gridConfigs = await lerConfigGrid(session.userId!);
    const prodConfigs = gridConfigs.filter((c: any) => 
      (c.nome_do_modulo === 'produtos_v2' || c.nome_do_modulo === 'Estoque') && 
      (c.nome_do_grid === 'grid_prod' || c.nome_do_grid === 'form_prod')
    );

    const extraFields: string[] = [];
    const extraJoins: string[] = [];
    const joinedTables = new Set<string>();

    prodConfigs.forEach((cfg: any) => {
      if (cfg.tabela_display && cfg.tabela_display.includes('.') && cfg.visivel !== false) {
        const parts = cfg.tabela_display.split('.');
        const targetTable = parts[0]?.trim();
        const targetField = parts[1]?.trim();
        const colKey = cfg.nome_da_coluna?.trim();
        
        // Dynamic join handling: aliasing the joined table specifically for this column 
        // to avoid conflicts if multiple columns join the same table
        if (targetTable && targetField && colKey && 
            /^[a-zA-Z0-9_]+$/.test(targetTable) && 
            /^[a-zA-Z0-9_]+$/.test(targetField) &&
            /^[a-zA-Z0-9_]+$/.test(colKey)) {
          const alias = `td_${colKey}`;
          extraFields.push(`, ${alias}.${targetField} AS ${colKey}_display`);
          extraJoins.push(` LEFT JOIN ${dbName}.${targetTable} ${alias} ON ${alias}.id = p.${colKey}`);
        }
      }
    });

    let query = `
        SELECT * FROM (
          SELECT p.*, c.nome as categoria_nome, m.descricao as marca_nome,
          (SELECT COUNT(*) FROM ${dbName}.cad_produtos_variantes WHERE produto_id = p.id AND ativo = 1) as variantes_count,
          (SELECT GROUP_CONCAT(atributo_id) FROM ${dbName}.cad_produtos_atributos_produtos WHERE produto_id = p.id) as atributos_vinculados
          ${extraFields.join('')}
          FROM ${dbName}.cad_produtos p 
          LEFT JOIN ${dbName}.cad_produtos_categorias c ON p.categoria_id = c.id
          LEFT JOIN ${dbName}.cad_produtos_marcas m ON p.marca_id = m.id
          ${extraJoins.join('')}
          WHERE p.ativo = 1
        ) AS p WHERE 1=1
      `;
    const params: any[] = [];

    // Map column types for smarter filtering
    const colTypes: Record<string, string> = {};
    prodConfigs.forEach((cfg: any) => {
      if (cfg.nome_da_coluna) {
        colTypes[cfg.nome_da_coluna] = cfg.tipo_apresentacao || 'texto';
      }
    });

    // Special handling for old "descricao" and "categoria" and "marca" params for backward compatibility
    const descricao = searchParams.get('descricao');
    
    searchParams.forEach((value, key) => {
      if (key === 'descricao' && value) {
        query += ` AND (p.descricao LIKE ? OR p.nome LIKE ? OR p.sku LIKE ?)`;
        params.push(`${value}%`, `${value}%`, `${value}%`);
      } else if (key === 'categoria_id' && value) {
        query += ` AND p.categoria_id = ?`;
        params.push(value);
      } else if (key === 'categoria' && value) { // backward compat
        query += ` AND p.categoria_id = ?`;
        params.push(value);
      } else if (key === 'marca_id' && value) {
        query += ` AND p.marca_id = ?`;
        params.push(value);
      } else if (key === 'marca' && value) { // backward compat
        if (!isNaN(parseInt(value))) {
          query += ` AND p.marca_id = ?`;
          params.push(value);
        } else {
          query += ` AND (p.nome LIKE ? OR p.descricao LIKE ?)`;
          params.push(`${value}%`, `${value}%`);
        }
      } else if (validColumns.includes(key) && value) {
        const type = colTypes[key];
        const isText = type === 'texto' || isNaN(Number(value)) || key.toLowerCase().includes('nome') || key.toLowerCase().includes('descricao') || key.toLowerCase().includes('sku') || key.toLowerCase().includes('barras');
        
        if (typeof value === 'string' && isText) {
          // Rule: If user types "BMW" -> "BMW%". If user types "%BMW" -> "%BMW%"
          query += ` AND p.${key} LIKE ?`;
          params.push(`${value}%`);
        } else {
          query += ` AND p.${key} = ?`;
          params.push(value);
        }
      }
    });

    const hasId = validColumns.some((c: string) => c.toLowerCase() === 'id');
    query += ` ORDER BY ${hasId ? 'p.id' : '1'} DESC`;

    const [rows]: any = await db.execute(query, params);
    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
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
    if (!nome) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
    const db = await getDb();
    const dbName = session.dbConfig?.database;
    const [result]: any = await db.execute(
      `INSERT INTO ${dbName}.cad_produtos (sku, nome, descricao, tipo_produto, categoria_id, marca_id, unidade_id, preco_custo, preco_venda, ativo, codigo_barras) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sku, nome, descricao, tipo_produto, categoria_id || null, marca_id || null, unidade_id, preco_custo, preco_venda, ativo, codigo_barras || null]
    );

    const newId = result.insertId;

    if (atributos_selecionados && Array.isArray(atributos_selecionados) && (tipo_produto === 'variacao_simples' || tipo_produto === 'variacao_atributo')) {
      for (const attrId of atributos_selecionados) {
        if (attrId && !isNaN(parseInt(attrId))) {
          await db.execute(
            `INSERT IGNORE INTO ${dbName}.cad_produtos_atributos_produtos (produto_id, atributo_id) VALUES (?, ?)`,
            [newId, parseInt(attrId)]
          );
        }
      }
    }

    const atributos_vinculados = (atributos_selecionados && Array.isArray(atributos_selecionados) && (tipo_produto === 'variacao_simples' || tipo_produto === 'variacao_atributo')) 
      ? atributos_selecionados.filter((a: any) => a && !isNaN(parseInt(a))).join(',')
      : null;

    return NextResponse.json({ id: newId, sku, nome, descricao, tipo_produto, categoria_id, marca_id, unidade_id, preco_custo, preco_venda, ativo, atributos_vinculados, codigo_barras });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
