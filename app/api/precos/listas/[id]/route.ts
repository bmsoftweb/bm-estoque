import { NextRequest, NextResponse } from '@/server/next-server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from '@/server/next-headers';
import { getDb } from '@/lib/db';
import { ErroValidacao, lerLista, salvarLista, validarCorpo } from '@/server/listasPreco';
import { grupoDa } from '@/lib/empresa';

const SEM_TABELAS = 'As tabelas de listas de preço ainda não foram criadas no banco (extras/2026-11-09_listas_de_preco.sql).';

async function sessao() {
  const s = await getIronSession<SessionData>(await cookies(), sessionOptions);
  return s.isLoggedIn ? s : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const s = await sessao();
    if (!s) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const lista = await lerLista(await getDb(), s.dbConfig?.database, Number(id), grupoDa(s));
    return lista ? NextResponse.json(lista) : NextResponse.json({ error: 'Lista não encontrada.' }, { status: 404 });
  } catch (e: any) {
    if (e.code === 'ER_NO_SUCH_TABLE') return NextResponse.json({ error: SEM_TABELAS }, { status: 409 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const s = await sessao();
    if (!s) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const lista = validarCorpo(await req.json());
    await salvarLista(await getDb(), s.dbConfig?.database, Number(id), lista, grupoDa(s));
    return NextResponse.json({ success: true, id: Number(id) });
  } catch (e: any) {
    if (e instanceof ErroValidacao) return NextResponse.json({ error: e.message }, { status: e.message === 'Lista não encontrada.' ? 404 : 400 });
    if (e.code === 'ER_NO_SUCH_TABLE') return NextResponse.json({ error: SEM_TABELAS }, { status: 409 });
    if (e.code === 'ER_DUP_ENTRY') return NextResponse.json({ error: 'Já existe uma lista com esse nome.' }, { status: 400 });
    if (e.code === 'WARN_DATA_TRUNCATED' || e.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD') return NextResponse.json({ error: 'Regra por variante: rode antes o script extras/2026-11-10_lista_preco_variante.sql.' }, { status: 409 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const s = await sessao();
    if (!s) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    // Os critérios e os itens saem junto (ON DELETE CASCADE)
    const [r]: any = await (await getDb()).execute(`DELETE FROM ${s.dbConfig?.database}.pre_listas WHERE id = ? AND grupo_id = ?`, [Number(id), grupoDa(s)]);
    return r.affectedRows ? NextResponse.json({ success: true }) : NextResponse.json({ error: 'Lista não encontrada.' }, { status: 404 });
  } catch (e: any) {
    if (e.code === 'ER_NO_SUCH_TABLE') return NextResponse.json({ error: SEM_TABELAS }, { status: 409 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
