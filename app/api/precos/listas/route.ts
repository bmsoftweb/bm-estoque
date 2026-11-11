import { NextRequest, NextResponse } from '@/server/next-server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from '@/server/next-headers';
import { getDb } from '@/lib/db';
import { ErroValidacao, salvarLista, validarCorpo, dataSql } from '@/server/listasPreco';
import { grupoDa } from '@/lib/empresa';

const SEM_TABELAS = 'As tabelas de listas de preço ainda não foram criadas no banco (extras/2026-11-09_listas_de_preco.sql).';

export async function GET() {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const db = await getDb();
    const dbName = session.dbConfig?.database;
    try {
      const [ls]: any = await db.execute(
        `SELECT l.*, (SELECT COUNT(*) FROM ${dbName}.pre_lista_itens i WHERE i.lista_id = l.id) AS qtd_itens FROM ${dbName}.pre_listas l WHERE l.grupo_id = ? ORDER BY l.prioridade, l.nome`,
        [grupoDa(session)],
      );
      const [cs]: any = await db.execute(`SELECT lista_id, campo, COUNT(*) AS n FROM ${dbName}.pre_lista_criterios GROUP BY lista_id, campo`);
      const listas = ls.map((l: any) => ({
        id: l.id, nome: l.nome, descricao: l.descricao, prioridade: l.prioridade, ativo: Boolean(l.ativo),
        vigenciaInicio: dataSql(l.vigencia_inicio),
        vigenciaFim: dataSql(l.vigencia_fim),
        qtdMin: l.qtd_min === null ? null : Number(l.qtd_min), qtdMax: l.qtd_max === null ? null : Number(l.qtd_max),
        ajustePercentual: l.ajuste_percentual === null ? null : Number(l.ajuste_percentual),
        qtdItens: Number(l.qtd_itens),
        criterios: Object.fromEntries(cs.filter((c: any) => c.lista_id === l.id).map((c: any) => [c.campo, Number(c.n)])),
      }));
      return NextResponse.json({ semTabelas: false, listas });
    } catch (e: any) {
      if (e.code === 'ER_NO_SUCH_TABLE') return NextResponse.json({ semTabelas: true, listas: [] });
      throw e;
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const lista = validarCorpo(await req.json());
    const id = await salvarLista(await getDb(), session.dbConfig?.database, null, lista, grupoDa(session));
    return NextResponse.json({ success: true, id });
  } catch (e: any) {
    if (e instanceof ErroValidacao) return NextResponse.json({ error: e.message }, { status: 400 });
    if (e.code === 'ER_NO_SUCH_TABLE') return NextResponse.json({ error: SEM_TABELAS }, { status: 409 });
    if (e.code === 'ER_DUP_ENTRY') return NextResponse.json({ error: 'Já existe uma lista com esse nome.' }, { status: 400 });
    if (e.code === 'WARN_DATA_TRUNCATED' || e.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD') return NextResponse.json({ error: 'Regra por variante: rode antes o script extras/2026-11-10_lista_preco_variante.sql.' }, { status: 409 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
