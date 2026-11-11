import { NextRequest, NextResponse } from '@/server/next-server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from '@/server/next-headers';
import { getDb } from '@/lib/db';
import { empresaDa, grupoDa } from '@/lib/empresa';
import { Invalido, validarMovimento, aplicarNoSaldo, lerMovimento, emTransacao } from '@/lib/estoque';

const NAO_ACHOU = () => NextResponse.json({ error: 'Movimentação não encontrada.' }, { status: 404 });

/** Altera o movimento: desfaz o efeito antigo no saldo e aplica o novo, na mesma transação */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const db = await getDb();
    const dbName = session.dbConfig!.database;
    const empresa = empresaDa(session);
    const m = await validarMovimento(db, dbName, await req.json(), grupoDa(session), empresa);

    const achou = await emTransacao(db, async (conn) => {
      const antigo = await lerMovimento(conn, dbName, id, empresa);
      if (!antigo) return false;
      await aplicarNoSaldo(conn, dbName, [{ m: antigo, sinal: -1 }, { m, sinal: 1 }]);
      await conn.execute(
        `UPDATE ${dbName}.est_estoque_movimentacoes SET tipo = ?, lote_id = ?, localizacao_orig_id = ?, localizacao_dest_id = ?, quantidade = ?, custo_unitario = ?, referencia_tipo = ?, referencia_id = ?, produto_id = ?, variante_id = ?, observacao = ? WHERE id = ? AND empresa_id = ?`,
        [m.tipo, m.lote_id, m.localizacao_orig_id, m.localizacao_dest_id, m.quantidade, m.custo_unitario, m.referencia_tipo, m.referencia_id, m.produto_id, m.variante_id, m.observacao, id, empresa]
      );
      return true;
    });
    if (!achou) return NAO_ACHOU();

    return NextResponse.json({ id, ...m });
  } catch (error: any) {
    if (error instanceof Invalido) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** Exclui o movimento desfazendo o efeito dele no saldo */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const db = await getDb();
    const dbName = session.dbConfig!.database;
    const empresa = empresaDa(session);

    const achou = await emTransacao(db, async (conn) => {
      const antigo = await lerMovimento(conn, dbName, id, empresa);
      if (!antigo) return false;
      await aplicarNoSaldo(conn, dbName, [{ m: antigo, sinal: -1 }]);
      await conn.execute(`DELETE FROM ${dbName}.est_estoque_movimentacoes WHERE id = ? AND empresa_id = ?`, [id, empresa]);
      return true;
    });
    if (!achou) return NAO_ACHOU();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error instanceof Invalido) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
