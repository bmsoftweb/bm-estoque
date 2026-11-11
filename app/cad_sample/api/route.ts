import { NextRequest, NextResponse } from '@/server/next-server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from '@/server/next-headers';
import { getDb } from '@/lib/db';
import { grupoDa } from '@/lib/empresa';

/**
 * ESTE É UM EXEMPLO DE API PARA O CADASTRO AMOSTRA
 * Para clonar:
 * 1. Renomeie a pasta 'cad_sample' para o nome do seu recurso (ex: 'clientes')
 * 2. Atualize as consultas SQL para apontar para sua tabela real no banco de dados.
 */

export async function GET(req: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn || !session.userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    
    const db = await getDb();
    const dbName = session.dbConfig?.database;

    // EXEMPLO DE QUERY - Substitua 'cad_produtos' pela sua tabela
    // Sempre filtrar pela empresa da sessão (tabelas com grupo_id)
    const [rows]: any = await db.execute(`
      SELECT * FROM ${dbName}.cad_produtos
      WHERE ativo = 1 AND grupo_id = ?
      LIMIT 100
    `, [grupoDa(session)]);

    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    
    const body = await req.json();
    const db = await getDb();
    const dbName = session.dbConfig?.database;

    // EXEMPLO DE INSERT - Ajuste os campos para sua tabela
    const [result]: any = await db.execute(
      `INSERT INTO ${dbName}.cad_produtos (grupo_id, nome, preco_venda, ativo) VALUES (?, ?, ?, ?)`,
      [grupoDa(session), body.nome, body.preco_venda || 0, body.ativo ?? 1]
    );

    return NextResponse.json({ id: result.insertId, ...body });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
