import { CAMPOS_CRITERIO, type CampoCriterio, type ListaPreco } from '@/lib/precos';

/** Leitura, validação e gravação das listas de preço (tabelas pre_* do extras/2026-11-09_listas_de_preco.sql) */

export class ErroValidacao extends Error {}

const num = (v: any) => (v === null || v === undefined || v === '' ? null : Number(v));
/** Coluna DATE do banco em aaaa-mm-dd: o driver devolve Date à meia-noite local (String(Date) daria "Tue Nov 10") */
export const dataSql = (v: any): string | null =>
  !v ? null : v instanceof Date ? v.toLocaleDateString('sv-SE') : String(v).slice(0, 10);
const data = dataSql;

export type ListaCompleta = ListaPreco & { descricao: string | null };

export async function lerLista(db: any, dbName: string | undefined, id: number, emp: number): Promise<ListaCompleta | null> {
  const [ls]: any = await db.execute(`SELECT * FROM ${dbName}.pre_listas WHERE id = ? AND grupo_id = ?`, [id, emp]);
  if (!ls.length) return null;
  const l = ls[0];
  const [cs]: any = await db.execute(`SELECT campo, valor FROM ${dbName}.pre_lista_criterios WHERE lista_id = ? ORDER BY id`, [id]);
  const [is]: any = await db.execute(`SELECT escopo, escopo_id, tipo, valor FROM ${dbName}.pre_lista_itens WHERE lista_id = ? ORDER BY id`, [id]);
  const criterios: ListaPreco['criterios'] = {};
  for (const c of cs) (criterios[c.campo as CampoCriterio] ??= []).push(String(c.valor));
  return {
    id: l.id, nome: l.nome, descricao: l.descricao ?? null, prioridade: l.prioridade, ativo: Boolean(l.ativo),
    vigenciaInicio: data(l.vigencia_inicio), vigenciaFim: data(l.vigencia_fim),
    qtdMin: num(l.qtd_min), qtdMax: num(l.qtd_max), valorPedidoMin: num(l.valor_pedido_min), valorPedidoMax: num(l.valor_pedido_max),
    prazoMin: num(l.prazo_min), prazoMax: num(l.prazo_max), ajustePercentual: num(l.ajuste_percentual),
    criterios,
    itens: is.map((i: any) => ({ escopo: i.escopo, escopoId: i.escopo_id, tipo: i.tipo, valor: Number(i.valor) })),
  };
}

/** Confere o corpo recebido e devolve a lista normalizada (ou lança ErroValidacao com a mensagem para o usuário) */
export function validarCorpo(c: any): ListaCompleta {
  const nome = String(c?.nome ?? '').trim();
  if (!nome) throw new ErroValidacao('Informe o nome da lista.');
  if (nome.length > 80) throw new ErroValidacao('O nome da lista tem no máximo 80 caracteres.');
  const prioridade = Number(c.prioridade ?? 100);
  if (!Number.isInteger(prioridade) || prioridade < -32768 || prioridade > 32767) throw new ErroValidacao('Prioridade deve ser um número inteiro.');

  const faixa = (rotulo: string, min: any, max: any, inteiro = false) => {
    const a = num(min);
    const b = num(max);
    for (const v of [a, b]) if (v !== null && (!Number.isFinite(v) || v < 0 || (inteiro && !Number.isInteger(v)))) throw new ErroValidacao(`${rotulo}: valor inválido.`);
    if (a !== null && b !== null && a > b) throw new ErroValidacao(`${rotulo}: o mínimo não pode ser maior que o máximo.`);
    return [a, b] as const;
  };
  const [qtdMin, qtdMax] = faixa('Quantidade', c.qtdMin, c.qtdMax);
  const [valorPedidoMin, valorPedidoMax] = faixa('Valor do pedido', c.valorPedidoMin, c.valorPedidoMax);
  const [prazoMin, prazoMax] = faixa('Prazo médio', c.prazoMin, c.prazoMax, true);

  const dt = (rotulo: string, v: any) => {
    if (!v) return null;
    const s = String(v).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) throw new ErroValidacao(`${rotulo}: data inválida.`);
    return s;
  };
  const vigenciaInicio = dt('Início da vigência', c.vigenciaInicio);
  const vigenciaFim = dt('Fim da vigência', c.vigenciaFim);
  if (vigenciaInicio && vigenciaFim && vigenciaInicio > vigenciaFim) throw new ErroValidacao('A vigência termina antes de começar.');

  const ajustePercentual = num(c.ajustePercentual);
  if (ajustePercentual !== null && (!Number.isFinite(ajustePercentual) || ajustePercentual < -100 || ajustePercentual > 1000)) throw new ErroValidacao('Ajuste padrão deve ficar entre -100% e 1000%.');

  const criterios: ListaPreco['criterios'] = {};
  for (const campo of Object.keys(c.criterios ?? {})) {
    if (!CAMPOS_CRITERIO.includes(campo as CampoCriterio)) throw new ErroValidacao(`Critério desconhecido: ${campo}.`);
    const valores = [...new Set((c.criterios[campo] as any[]).map((v) => String(v).trim()).filter(Boolean))];
    if (valores.some((v) => v.length > 40)) throw new ErroValidacao(`Critério ${campo}: valor muito longo.`);
    if (valores.length) criterios[campo as CampoCriterio] = valores;
  }

  const vistos = new Set<string>();
  const itens: ListaPreco['itens'] = (c.itens ?? []).map((i: any) => {
    if (!['variante', 'produto', 'marca', 'categoria'].includes(i.escopo)) throw new ErroValidacao('Item com escopo inválido.');
    if (!['preco', 'percentual'].includes(i.tipo)) throw new ErroValidacao('Item com tipo de preço inválido.');
    const escopoId = Number(i.escopoId);
    const valor = Number(i.valor);
    if (!Number.isInteger(escopoId) || escopoId <= 0) throw new ErroValidacao('Item sem variante, produto, marca ou categoria.');
    if (!Number.isFinite(valor) || (i.tipo === 'preco' && valor < 0) || (i.tipo === 'percentual' && valor < -100)) throw new ErroValidacao('Item com valor inválido (preço não pode ser negativo; desconto passa de 100%).');
    const k = `${i.escopo}:${escopoId}`;
    if (vistos.has(k)) throw new ErroValidacao('Há uma variante, produto, marca ou categoria repetida nos itens.');
    vistos.add(k);
    return { escopo: i.escopo, escopoId, tipo: i.tipo, valor };
  });

  return {
    id: Number(c.id) || 0, nome, descricao: String(c.descricao ?? '').trim().slice(0, 255) || null, prioridade, ativo: Boolean(c.ativo ?? true),
    vigenciaInicio, vigenciaFim, qtdMin, qtdMax, valorPedidoMin, valorPedidoMax, prazoMin, prazoMax, ajustePercentual, criterios, itens,
  };
}

/** Grava (id = null cria) numa transação: a lista, os critérios e os itens vão juntos ou não vão */
export async function salvarLista(db: any, dbName: string | undefined, id: number | null, l: ListaCompleta, emp: number): Promise<number> {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const cols = [l.nome, l.descricao, l.prioridade, l.ativo ? 1 : 0, l.vigenciaInicio, l.vigenciaFim, l.qtdMin, l.qtdMax, l.valorPedidoMin, l.valorPedidoMax, l.prazoMin, l.prazoMax, l.ajustePercentual];
    let listaId = id;
    if (id === null) {
      const [r]: any = await conn.execute(
        `INSERT INTO ${dbName}.pre_listas (nome, descricao, prioridade, ativo, vigencia_inicio, vigencia_fim, qtd_min, qtd_max, valor_pedido_min, valor_pedido_max, prazo_min, prazo_max, ajuste_percentual, grupo_id, criado_em, atualizado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [...cols, emp],
      );
      listaId = r.insertId;
    } else {
      const [r]: any = await conn.execute(
        `UPDATE ${dbName}.pre_listas SET nome = ?, descricao = ?, prioridade = ?, ativo = ?, vigencia_inicio = ?, vigencia_fim = ?, qtd_min = ?, qtd_max = ?, valor_pedido_min = ?, valor_pedido_max = ?, prazo_min = ?, prazo_max = ?, ajuste_percentual = ?, atualizado_em = NOW() WHERE id = ? AND grupo_id = ?`,
        [...cols, id, emp],
      );
      if (!r.affectedRows) throw new ErroValidacao('Lista não encontrada.');
      await conn.execute(`DELETE FROM ${dbName}.pre_lista_criterios WHERE lista_id = ?`, [id]);
      await conn.execute(`DELETE FROM ${dbName}.pre_lista_itens WHERE lista_id = ?`, [id]);
    }
    for (const [campo, valores] of Object.entries(l.criterios)) {
      for (const v of valores ?? []) await conn.execute(`INSERT INTO ${dbName}.pre_lista_criterios (lista_id, campo, valor) VALUES (?, ?, ?)`, [listaId, campo, v]);
    }
    for (const i of l.itens) {
      await conn.execute(`INSERT INTO ${dbName}.pre_lista_itens (lista_id, escopo, escopo_id, tipo, valor) VALUES (?, ?, ?, ?, ?)`, [listaId, i.escopo, i.escopoId, i.tipo, i.valor]);
    }
    await conn.commit();
    return listaId as number;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
