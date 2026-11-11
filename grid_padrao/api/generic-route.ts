import { NextRequest, NextResponse } from '@/server/next-server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from '@/server/next-headers';
import { getDb } from '@/lib/db';
import { lerConfigGrid } from '@/lib/config-grid';

/**
 * GENERIC API ROUTE FOR STANDARDIZED GRIDS
 * TO USE: Copy to /app/api/[your-entity]/route.ts
 * REPLACE: 'cad_produtos' with your table name
 * REPLACE: 'Estoque' with your module name
 * REPLACE: 'grid_prod' with your grid ID
 */

const TABLE_NAME = 'cad_produtos'; // <-- CHANGE THIS
const MODULE_NAME = 'Estoque';     // <-- CHANGE THIS
const GRID_ID = 'grid_prod';       // <-- CHANGE THIS

export async function GET(req: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn || !session.userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const db = await getDb();
    const dbName = session.dbConfig?.database;

    const { searchParams } = new URL(req.url);

    // Discover valid columns
    const [columnsResult]: any = await db.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
    `, [dbName, TABLE_NAME]);
    const validColumns: string[] = columnsResult.map((c: any) => c.COLUMN_NAME);

    // Fetch grid config
    const gridConfigs = await lerConfigGrid(session.userId!);
    const prodConfigs = gridConfigs.filter((c: any) => 
      (c.nome_do_modulo === MODULE_NAME) && 
      (c.nome_do_grid === GRID_ID)
    );

    const extraFields: string[] = [];
    const extraJoins: string[] = [];
    prodConfigs.forEach((cfg: any) => {
      if (cfg.tabela_display && cfg.tabela_display.includes('.') && cfg.visivel !== false) {
        const parts = cfg.tabela_display.split('.');
        const targetTable = parts[0]?.trim();
        const targetField = parts[1]?.trim();
        const colKey = cfg.nome_da_coluna?.trim();
        if (targetTable && targetField && colKey && /^[a-zA-Z0-9_]+$/.test(targetTable) && /^[a-zA-Z0-9_]+$/.test(targetField) && /^[a-zA-Z0-9_]+$/.test(colKey)) {
          const alias = `td_${colKey}`;
          extraFields.push(`, ${alias}.${targetField} AS ${colKey}_display`);
          extraJoins.push(` LEFT JOIN ${dbName}.${targetTable} ${alias} ON ${alias}.id = p.${colKey}`);
        }
      }
    });

    let query = `SELECT p.* ${extraFields.join('')} FROM ${dbName}.${TABLE_NAME} p ${extraJoins.join('')} WHERE 1=1`;
    
    const params: any[] = [];
    searchParams.forEach((value, key) => {
      if (validColumns.includes(key) && value) {
        // Standard Filtering Rule: "BMW" -> "BMW%", "%BMW" -> "%BMW%"
        query += ` AND p.${key} LIKE ?`;
        params.push(`${value}%`);
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
