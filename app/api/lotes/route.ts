import { NextRequest, NextResponse } from '@/server/next-server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from '@/server/next-headers';
import { getDb } from '@/lib/db';
import { grupoDa, ehDoGrupo } from '@/lib/empresa';
import { Invalido, conferirVariante } from '@/lib/estoque';

export async function GET(req: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    
    const db = await getDb();
    const dbName = session.dbConfig?.database;
    if (!dbName) return NextResponse.json({ error: 'Configuração de banco de dados não encontrada' }, { status: 400 });
    
    const [rows]: any = await db.execute(`SELECT * FROM ${dbName}.cad_produtos_lotes WHERE grupo_id = ? ORDER BY id DESC`, [grupoDa(session)]);
    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    
    const { codigo, data_fabricacao, data_validade, observacao, preco_custo, produto_id, variante_id } = await req.json();
    if (!codigo) return NextResponse.json({ error: 'Código do lote é obrigatório' }, { status: 400 });
    
    // Alinhado ao requisito: codigo e numero_lote gravam o mesmo conteúdo
    const numero_lote = codigo;
    
    const db = await getDb();
    const dbName = session.dbConfig?.database;
    if (!dbName) return NextResponse.json({ error: 'Configuração de banco de dados não encontrada' }, { status: 400 });
    
    const emp = grupoDa(session);
    if (produto_id && !(await ehDoGrupo(db, dbName, 'cad_produtos', produto_id, emp))) return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 });
    // O saldo do lote é de um produto/variante: produto com variação exige a variante
    if (produto_id) await conferirVariante(db, dbName, Number(produto_id), Number(variante_id) || null);
    // Check if lote exists
    const [existing]: any = await db.execute(`SELECT id, produto_id, variante_id FROM ${dbName}.cad_produtos_lotes WHERE codigo = ? AND grupo_id = ?`, [codigo, emp]);

    if (existing.length > 0) {
      const loteId = existing[0].id;
      // Um lote já ligado a outro produto/variante não muda de dono (o saldo dele iria junto)
      const atualProd = Number(existing[0].produto_id) || null;
      const atualVar = Number(existing[0].variante_id) || null;
      if (produto_id && atualProd && (atualProd !== Number(produto_id) || atualVar !== (Number(variante_id) || null))) {
        return NextResponse.json({ error: `O lote ${codigo} já é de outro produto ou variante. Use outro código.` }, { status: 409 });
      }
      if (preco_custo !== undefined || produto_id !== undefined || variante_id !== undefined) {
        await db.execute(
          `UPDATE ${dbName}.cad_produtos_lotes SET numero_lote = ?, preco_custo = COALESCE(?, preco_custo), produto_id = COALESCE(?, produto_id), variante_id = COALESCE(?, variante_id) WHERE id = ?`,
          [numero_lote, preco_custo ?? null, produto_id ?? null, variante_id ?? null, loteId]
        );
      }
      return NextResponse.json({ id: loteId, codigo, numero_lote, updated: true });
    }
    
    const [result]: any = await db.execute(
      `INSERT INTO ${dbName}.cad_produtos_lotes (grupo_id, codigo, numero_lote, produto_id, variante_id, data_fabricacao, data_validade, observacao, preco_custo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [emp, codigo, numero_lote, produto_id || null, variante_id || null, data_fabricacao || null, data_validade || null, observacao || null, preco_custo || 0]
    );
    
    return NextResponse.json({ id: result.insertId, codigo, numero_lote, produto_id, variante_id, data_fabricacao, data_validade, observacao, preco_custo });
  } catch (error: any) {
    if (error instanceof Invalido) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
