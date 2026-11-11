/**
 * Motor de listas de preço: a partir de um preço base, escolhe a lista pelo contexto da venda (cliente, vendedor,
 * quantidade…) e devolve o preço do item. Sem banco e sem tela: quem chama (API, NF) carrega as listas e o contexto.
 *
 * Regra de escolha:
 *  1. Só entram listas ativas, dentro da vigência e cujos critérios TODOS batem com o contexto
 *     (dentro de um critério, qualquer um dos valores serve: "cidade A ou B"; entre critérios é E).
 *     Critério definido na lista e ausente no contexto = não bate.
 *  2. Ordem: prioridade (menor primeiro), depois a lista com mais critérios (mais específica), depois o id.
 *  3. A primeira lista que tem preço PARA O PRODUTO vence: regra da variante > do produto > da marca > da categoria >
 *     ajuste padrão da lista (regra no produto pai vale para todas as variantes). Lista sem regra para o produto passa a vez para a próxima.
 *  4. Nenhuma lista serviu: preço base.
 * Dinheiro em 2 casas, arredondado em centavos.
 */

export type CampoCriterio = 'tipo_cliente' | 'cidade' | 'uf' | 'regiao' | 'vendedor' | 'cliente' | 'canal';
export const CAMPOS_CRITERIO: CampoCriterio[] = ['tipo_cliente', 'cidade', 'uf', 'regiao', 'vendedor', 'cliente', 'canal'];

export interface ItemRegra {
  escopo: 'variante' | 'produto' | 'marca' | 'categoria';
  escopoId: number;
  /** preco = preço fixo; percentual = ajuste sobre o base (-10 = 10% abaixo, +5 = 5% acima) */
  tipo: 'preco' | 'percentual';
  valor: number;
}

export interface ListaPreco {
  id: number;
  nome: string;
  prioridade: number;
  ativo: boolean;
  /** aaaa-mm-dd */
  vigenciaInicio?: string | null;
  vigenciaFim?: string | null;
  qtdMin?: number | null;
  qtdMax?: number | null;
  valorPedidoMin?: number | null;
  valorPedidoMax?: number | null;
  prazoMin?: number | null;
  prazoMax?: number | null;
  /** Ajuste padrão da lista sobre o preço base, em %; null = a lista só vale para os itens com regra própria */
  ajustePercentual?: number | null;
  criterios: Partial<Record<CampoCriterio, string[]>>;
  itens: ItemRegra[];
}

export interface ContextoVenda {
  /** aaaa-mm-dd */
  data: string;
  quantidade: number;
  valorPedido?: number;
  prazoMedioDias?: number;
  tipo_cliente?: string | number | null;
  cidade?: string | number | null;
  uf?: string | null;
  regiao?: string | number | null;
  vendedor?: string | number | null;
  cliente?: string | number | null;
  canal?: string | null;
}

export interface ProdutoPreco {
  id: number;
  /** Variante vendida (o precoBase já é o dela, quando tem preço próprio) */
  varianteId?: number | null;
  categoriaId?: number | null;
  marcaId?: number | null;
  precoBase: number;
}

export interface PrecoResolvido {
  preco: number;
  base: number;
  origem: 'lista' | 'base';
  lista?: { id: number; nome: string };
  regra?: 'variante' | 'produto' | 'marca' | 'categoria' | 'padrao_da_lista';
  /** Diferença sobre o base, em % (negativa = desconto) */
  diferencaPercentual: number;
}

const centavos = (v: number) => Math.max(0, Math.round((v + Number.EPSILON) * 100) / 100);

const dentro = (v: number | undefined, min?: number | null, max?: number | null) => {
  if (min == null && max == null) return true;
  if (v === undefined) return false;
  return (min == null || v >= min) && (max == null || v <= max);
};

/** A lista serve para este contexto? */
export function listaCasa(l: ListaPreco, c: ContextoVenda): boolean {
  if (!l.ativo) return false;
  if (l.vigenciaInicio && c.data < l.vigenciaInicio) return false;
  if (l.vigenciaFim && c.data > l.vigenciaFim) return false;
  if (!dentro(c.quantidade, l.qtdMin, l.qtdMax)) return false;
  if (!dentro(c.valorPedido, l.valorPedidoMin, l.valorPedidoMax)) return false;
  if (!dentro(c.prazoMedioDias, l.prazoMin, l.prazoMax)) return false;
  for (const campo of CAMPOS_CRITERIO) {
    const valores = l.criterios[campo];
    if (!valores?.length) continue;
    const v = c[campo];
    if (v === undefined || v === null || v === '') return false;
    if (!valores.map(String).includes(String(v))) return false;
  }
  return true;
}

/** Quantos critérios a lista define (desempate: mais específica primeiro) */
const especificidade = (l: ListaPreco) =>
  CAMPOS_CRITERIO.filter((k) => l.criterios[k]?.length).length +
  [l.qtdMin, l.qtdMax, l.valorPedidoMin, l.valorPedidoMax, l.prazoMin, l.prazoMax, l.vigenciaInicio, l.vigenciaFim].filter((x) => x != null).length;

export function resolverPreco(listas: ListaPreco[], contexto: ContextoVenda, produto: ProdutoPreco): PrecoResolvido {
  const base = centavos(produto.precoBase);
  const candidatas = listas
    .filter((l) => listaCasa(l, contexto))
    .sort((a, b) => a.prioridade - b.prioridade || especificidade(b) - especificidade(a) || a.id - b.id);

  for (const l of candidatas) {
    const regra =
      l.itens.find((i) => i.escopo === 'variante' && produto.varianteId != null && i.escopoId === produto.varianteId) ??
      l.itens.find((i) => i.escopo === 'produto' && i.escopoId === produto.id) ??
      l.itens.find((i) => i.escopo === 'marca' && produto.marcaId != null && i.escopoId === produto.marcaId) ??
      l.itens.find((i) => i.escopo === 'categoria' && produto.categoriaId != null && i.escopoId === produto.categoriaId);

    let preco: number | null = null;
    let origem: PrecoResolvido['regra'];
    if (regra) {
      preco = regra.tipo === 'preco' ? centavos(regra.valor) : centavos(base * (1 + regra.valor / 100));
      origem = regra.escopo;
    } else if (l.ajustePercentual != null) {
      preco = centavos(base * (1 + l.ajustePercentual / 100));
      origem = 'padrao_da_lista';
    }
    if (preco !== null) {
      return {
        preco,
        base,
        origem: 'lista',
        lista: { id: l.id, nome: l.nome },
        regra: origem,
        diferencaPercentual: base > 0 ? Math.round(((preco - base) / base) * 10000) / 100 : 0,
      };
    }
  }
  return { preco: base, base, origem: 'base', diferencaPercentual: 0 };
}

// ---------------------------------------------------------------------------------------------------------------
// Venda em embalagem (fardo, caixa): o produto é um só e o estoque fica na unidade menor.
// ---------------------------------------------------------------------------------------------------------------

export interface Embalagem {
  id?: number;
  sigla: string;
  /** Unidades do produto em 1 embalagem (12) */
  fator: number;
  /** Preço próprio da embalagem; ausente = fator x preço base */
  preco?: number | null;
}

export interface ItemVendaResolvido extends PrecoResolvido {
  /** Sigla vendida (CX) ou a unidade do produto (UN) */
  unidade: string;
  fator: number;
  quantidade: number;
  /** Quantidade em unidades do produto: é a que as listas e o estoque usam */
  quantidadeBase: number;
  /** preco = preço de UMA unidade vendida (de uma caixa, se vendeu em caixa) */
  valorTotal: number;
  /** Campos do item da NF-e/NFC-e: comercial (o que o cliente comprou) e tributável (a unidade do produto) */
  nfe: { uCom: string; qCom: number; vUnCom: number; uTrib: string; qTrib: number; vUnTrib: number; vProd: number };
}

const arred = (v: number, casas: number) => Math.round((v + Number.EPSILON) * 10 ** casas) / 10 ** casas;

/**
 * Preço de um item vendido em embalagem (ou em unidade, sem embalagem).
 * Lista que serve: preço por UNIDADE da lista x fator (a quantidade para a faixa conta em unidades: 2 fardos de 12 = 24).
 * Sem lista: preço da embalagem, se tiver; senão fator x preço base.
 */
export function resolverItemVenda(
  listas: ListaPreco[],
  contexto: Omit<ContextoVenda, 'quantidade'>,
  produto: ProdutoPreco,
  quantidade: number,
  embalagem?: Embalagem | null,
  unidadeProduto = 'UN',
): ItemVendaResolvido {
  const fator = embalagem?.fator ?? 1;
  const quantidadeBase = arred(quantidade * fator, 4);
  const r = resolverPreco(listas, { ...contexto, quantidade: quantidadeBase }, produto);

  let preco: number;
  if (r.origem === 'lista') preco = centavos(r.preco * fator);
  else preco = embalagem?.preco != null ? centavos(embalagem.preco) : centavos(r.base * fator);

  const referencia = centavos(r.base * fator);
  const valorTotal = centavos(preco * quantidade);
  const unidade = embalagem?.sigla ?? unidadeProduto;
  return {
    ...r,
    preco,
    diferencaPercentual: referencia > 0 ? arred(((preco - referencia) / referencia) * 100, 2) : 0,
    unidade,
    fator,
    quantidade,
    quantidadeBase,
    valorTotal,
    nfe: {
      uCom: unidade, qCom: quantidade, vUnCom: preco,
      uTrib: unidadeProduto, qTrib: quantidadeBase, vUnTrib: quantidadeBase > 0 ? arred(valorTotal / quantidadeBase, 10) : 0,
      vProd: valorTotal,
    },
  };
}
