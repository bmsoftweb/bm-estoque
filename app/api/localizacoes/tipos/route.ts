import { NextRequest, NextResponse } from '@/server/next-server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from '@/server/next-headers';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    
    const db = await getDb();
    const dbName = session.dbConfig?.database;
    
    const [rows]: any = await db.execute(`SHOW COLUMNS FROM ${dbName}.cad_produtos_localizacoes LIKE 'tipo'`);
    
    if (rows.length > 0) {
      const typeStr = rows[0].Type; // e.g. "enum('A','B','C')"
      if (typeStr.startsWith('enum')) {
        const matches = typeStr.match(/enum\((.*)\)/);
        if (matches && matches[1]) {
          // split by comma, remove quotes
          const options = matches[1].split(',')
            .map((s: string) => s.replace(/^'|'$/g, ''))
            .map((s: string) => s.replace(/^"|"$/g, ''));
          return NextResponse.json(options);
        }
      }
    }
    
    // Fallback or not an enum
    return NextResponse.json([]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
