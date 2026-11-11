import { NextRequest, NextResponse } from '@/server/next-server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from '@/server/next-headers';
import { getDb } from '@/lib/db';
import { grupoDa } from '@/lib/empresa';
import { dataSql } from '@/server/listasPreco';
import { resolverItemVenda, type CampoCriterio, type ContextoVenda, type Embalagem, type ListaPreco } from '@/lib/precos';

/** Data de hoje no horário de Brasília (aaaa-mm-dd) */
const hojeBrasilia = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const num = (v: any) => (v === null || v === undefined ? null : Number(v));

/**
 * Preço dos itens de uma venda pelas listas de preço.
 * POST { itens: [{ produtoId, varianteId?, quantidade, embalagemId? }], clienteId?, vendedorId?, canal?, valorPedido?, prazoMedioDias?, data? }
 * -> { semListas, itens: [{ produtoId, quantidade, unidade, fator, quantidadeBase, preco, valorTotal, base, origem, lista?, regra?, diferencaPercentual, nfe }] }
 * Com embalagemId (fardo, caixa) a quantidade é de embalagens: o preço sai por embalagem, as listas contam em unidades do produto
 * e o campo nfe traz uCom/qCom/vUnCom (embalagem) e uTrib/qTrib/vUnTrib (unidade do produto) do item da nota.
 * Com varianteId o preço base é o da variante (sem preço próprio, o do pai) e vale a regra da variante antes da do produto.
 * O cliente preenche tipo, cidade, UF, região e vendedor; vendedorId no corpo vale sobre o do cadastro (vendedor da venda).
 * Sem as tabelas pre_* criadas (extras/2026-11-09_listas_de_preco.sql), tudo sai no preço base.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const corpo = (await req.json()) || {};
    const itens: { produtoId: number; varianteId?: number; quantidade: number; embalagemId?: number }[] = Array.isArray(corpo.itens) ? corpo.itens : [];
    if (!itens.length) return NextResponse.json({ error: 'Informe os itens.' }, { status: 400 });
    if (itens.some((i) => !Number.isFinite(Number(i.produtoId)) || !(Number(i.quantidade) > 0))) {
      return NextResponse.json({ error: 'Cada item precisa de produtoId e quantidade maior que zero.' }, { status: 400 });
    }
    const db = await getDb();
    const dbName = session.dbConfig?.database;
    const emp = grupoDa(session); // listas e produtos da empresa da sessão

    // Contexto do cliente
    const base: Omit<ContextoVenda, 'quantidade'> = {
      data: /^\d{4}-\d{2}-\d{2}$/.test(corpo.data ?? '') ? corpo.data : hojeBrasilia(),
      valorPedido: num(corpo.valorPedido) ?? undefined,
      prazoMedioDias: num(corpo.prazoMedioDias) ?? undefined,
      vendedor: corpo.vendedorId ?? null,
      cliente: corpo.clienteId ?? null,
      canal: corpo.canal ?? null,
    };
    if (corpo.clienteId) {
      const [p]: any = await db.execute(`SELECT * FROM ${dbName}.cad_pessoas WHERE id = ? LIMIT 1`, [corpo.clienteId]);
      if (!p.length) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 });
      base.tipo_cliente = p[0].tipo_cliente_id ?? null; // coluna sugerida: pode não existir ainda
      base.cidade = p[0].cidade_id ?? null;
      base.uf = p[0].cidade_uf ?? null;
      base.regiao = p[0].regiao_id ?? null;
      if (base.vendedor == null) base.vendedor = p[0].vendedor_id ?? null;
    }

    // Listas (tabelas criadas pelo usuário; ausentes = só preço base)
    let listas: ListaPreco[] = [];
    let semListas = false;
    try {
      const [ls]: any = await db.execute(`SELECT * FROM ${dbName}.pre_listas WHERE ativo = 1 AND grupo_id = ?`, [emp]);
      const [cs]: any = await db.execute(`SELECT lista_id, campo, valor FROM ${dbName}.pre_lista_criterios`);
      const [is]: any = await db.execute(`SELECT lista_id, escopo, escopo_id, tipo, valor FROM ${dbName}.pre_lista_itens`);
      listas = ls.map((l: any): ListaPreco => {
        const criterios: ListaPreco['criterios'] = {};
        for (const c of cs.filter((x: any) => x.lista_id === l.id)) (criterios[c.campo as CampoCriterio] ??= []).push(String(c.valor));
        return {
          id: l.id, nome: l.nome, prioridade: l.prioridade, ativo: Boolean(l.ativo),
          vigenciaInicio: dataSql(l.vigencia_inicio),
          vigenciaFim: dataSql(l.vigencia_fim),
          qtdMin: num(l.qtd_min), qtdMax: num(l.qtd_max),
          valorPedidoMin: num(l.valor_pedido_min), valorPedidoMax: num(l.valor_pedido_max),
          prazoMin: num(l.prazo_min), prazoMax: num(l.prazo_max),
          ajustePercentual: num(l.ajuste_percentual),
          criterios,
          itens: is.filter((x: any) => x.lista_id === l.id).map((x: any) => ({ escopo: x.escopo, escopoId: x.escopo_id, tipo: x.tipo, valor: Number(x.valor) })),
        };
      });
    } catch (e: any) {
      if (e.code !== 'ER_NO_SUCH_TABLE') throw e;
      semListas = true;
    }

    // Produtos
    const ids = [...new Set(itens.map((i) => Number(i.produtoId)))];
    const [prods]: any = await db.execute(
      `SELECT p.id, p.categoria_id, p.marca_id, p.preco_venda, u.sigla AS unidade_sigla FROM ${dbName}.cad_produtos p LEFT JOIN ${dbName}.cad_produtos_unidades_medida u ON u.id = p.unidade_id WHERE p.grupo_id = ? AND p.id IN (${ids.map(() => '?').join(',')})`,
      [emp, ...ids],
    );
    const porId = new Map<number, any>(prods.map((p: any) => [p.id, p]));

    // Variantes pedidas (só ativas)
    const varIds = [...new Set(itens.map((i) => Number(i.varianteId)).filter((n) => Number.isInteger(n) && n > 0))];
    const variantes = new Map<number, { produtoId: number; preco: number | null }>();
    if (varIds.length) {
      const [vs]: any = await db.query(`SELECT id, produto_id, preco_venda FROM ${dbName}.cad_produtos_variantes WHERE ativo = 1 AND id IN (?)`, [varIds]);
      for (const v of vs) variantes.set(v.id, { produtoId: v.produto_id, preco: v.preco_venda === null ? null : Number(v.preco_venda) });
    }

    // Embalagens pedidas (tabela criada pelo usuário; sem ela, só unidade)
    const embIds = [...new Set(itens.map((i) => Number(i.embalagemId)).filter((n) => Number.isInteger(n) && n > 0))];
    const embalagens = new Map<number, Embalagem & { produtoId: number }>();
    if (embIds.length) {
      try {
        const [es]: any = await db.execute(`SELECT id, produto_id, sigla, fator, preco FROM ${dbName}.cad_produtos_embalagens WHERE ativo = 1 AND id IN (${embIds.map(() => '?').join(',')})`, embIds);
        for (const e of es) embalagens.set(e.id, { id: e.id, produtoId: e.produto_id, sigla: e.sigla, fator: Number(e.fator), preco: e.preco === null ? null : Number(e.preco) });
      } catch (e: any) {
        if (e.code !== 'ER_NO_SUCH_TABLE') throw e;
      }
    }

    const saida = itens.map((i) => {
      const p = porId.get(Number(i.produtoId));
      if (!p) return { produtoId: i.produtoId, quantidade: i.quantidade, erro: 'Produto não encontrado.' };
      let emb: Embalagem | null = null;
      if (i.embalagemId) {
        const e = embalagens.get(Number(i.embalagemId));
        if (!e || e.produtoId !== p.id) return { produtoId: i.produtoId, quantidade: i.quantidade, erro: 'Embalagem não encontrada (ou não é deste produto, ou está inativa).' };
        emb = e;
      }
      let varianteId: number | null = null;
      let precoBase = Number(p.preco_venda);
      if (i.varianteId) {
        const v = variantes.get(Number(i.varianteId));
        if (!v || v.produtoId !== p.id) return { produtoId: i.produtoId, quantidade: i.quantidade, erro: 'Variante não encontrada (ou não é deste produto, ou está inativa).' };
        varianteId = Number(i.varianteId);
        if (v.preco !== null) precoBase = v.preco;
      }
      const r = resolverItemVenda(listas, base, { id: p.id, varianteId, categoriaId: p.categoria_id, marcaId: p.marca_id, precoBase }, Number(i.quantidade), emb, p.unidade_sigla || 'UN');
      return { produtoId: i.produtoId, varianteId, ...r };
    });
    return NextResponse.json({ semListas, itens: saida });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
