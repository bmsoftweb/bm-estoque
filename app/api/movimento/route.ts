import { NextRequest, NextResponse } from '@/server/next-server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from '@/server/next-headers';
import { getDb, colunasInfo } from '@/lib/db';
import { lerConfigGrid } from '@/lib/config-grid';
import { empresaDa, grupoDa } from '@/lib/empresa';
import { Invalido, validarMovimento, aplicarNoSaldo, emTransacao } from '@/lib/estoque';

export async function GET(req: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn || !session.userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const db = await getDb();
    const dbName = session.dbConfig?.database;

    const { searchParams } = new URL(req.url);

    // Get list of valid columns to prevent arbitrary field filtering
    const validColumns: string[] = (await colunasInfo(db, dbName, 'est_estoque_movimentacoes')).map((c: any) => c.COLUMN_NAME);

    // Add standard joined fields to valid columns
    // validColumns.push('produto_nome', 'usuario_nome', 'variante_nome');

    // Fetch grid config to handle dynamic joins
    const gridConfigs = await lerConfigGrid(session.userId!);
    const movConfigs = gridConfigs.filter((c: any) => 
      (c.nome_do_modulo === 'Estoque') && 
      (c.nome_do_grid === 'grid_movimento' || c.nome_do_grid === 'form_movimento')
    );

    const extraFields: string[] = [];
    const extraJoins: string[] = [];
    
    movConfigs.forEach((cfg: any) => {
      if (cfg.tabela_display && cfg.tabela_display.includes('.') && cfg.visivel !== false) {
        const parts = cfg.tabela_display.split('.');
        const targetTable = parts[0]?.trim();
        const targetField = parts[1]?.trim();
        const colKey = cfg.nome_da_coluna?.trim();
        
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
          SELECT p.*
          ${extraFields.join('')}
          FROM ${dbName}.est_estoque_movimentacoes p
          ${extraJoins.join('')}
          WHERE p.empresa_id = ?
        ) AS p WHERE 1=1
      `;
    const params: any[] = [empresaDa(session)];

    // Map column types for smarter filtering
    const colTypes: Record<string, string> = {};
    movConfigs.forEach((cfg: any) => {
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

/** Grava o movimento e atualiza o saldo na mesma transação (regras em lib/estoque.ts) */
export async function POST(req: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const db = await getDb();
    const dbName = session.dbConfig!.database;
    const empresa = empresaDa(session);
    const m = await validarMovimento(db, dbName, await req.json(), grupoDa(session), empresa);

    const novoId = await emTransacao(db, async (conn) => {
      await aplicarNoSaldo(conn, dbName, [{ m, sinal: 1 }]);
      const [r]: any = await conn.execute(
        `INSERT INTO ${dbName}.est_estoque_movimentacoes
          (empresa_id, tipo, lote_id, localizacao_orig_id, localizacao_dest_id, quantidade, custo_unitario, referencia_tipo, referencia_id, produto_id, variante_id, usuario, observacao, date_insert)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [empresa, m.tipo, m.lote_id, m.localizacao_orig_id, m.localizacao_dest_id, m.quantidade, m.custo_unitario, m.referencia_tipo, m.referencia_id, m.produto_id, m.variante_id, session.userName || 'Sistema', m.observacao]
      );
      return r.insertId;
    });

    return NextResponse.json({ id: novoId, ...m });
  } catch (error: any) {
    if (error instanceof Invalido) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
