// Teste do motor de listas de preço. Rodar:  npx tsx lib/precos.test.ts
import assert from 'node:assert/strict';
import { resolverPreco, type ListaPreco, type ContextoVenda } from './precos';

// Produto: lâmina com base R$ 926,00 (categoria 10, marca 3)
const lamina = { id: 47, categoriaId: 10, marcaId: 3, precoBase: 926 };
const tora = { id: 48, categoriaId: 11, marcaId: null, precoBase: 1 };

const listas: ListaPreco[] = [
  // Região 5 + vendedor 7: 8% abaixo do base em tudo; a lâmina sai a preço fixo
  { id: 1, nome: 'Região Sul / Vendedor Y', prioridade: 10, ativo: true, ajustePercentual: -8, criterios: { regiao: ['5'], vendedor: ['7'] }, itens: [{ escopo: 'produto', escopoId: 47, tipo: 'preco', valor: 850 }] },
  // Atacado: 100 ou mais, 12% abaixo (só a categoria 10; a tora não tem regra e não tem ajuste padrão)
  { id: 2, nome: 'Atacado 100+', prioridade: 20, ativo: true, qtdMin: 100, ajustePercentual: null, criterios: {}, itens: [{ escopo: 'categoria', escopoId: 10, tipo: 'percentual', valor: -12 }] },
  // Revendas (tipo 2) de SC ou PR: 5% abaixo
  { id: 3, nome: 'Revenda Sul', prioridade: 30, ativo: true, ajustePercentual: -5, criterios: { tipo_cliente: ['2'], uf: ['SC', 'PR'] }, itens: [] },
  // Promoção vencida: não pode valer
  { id: 4, nome: 'Promoção de outubro', prioridade: 1, ativo: true, vigenciaFim: '2026-10-31', ajustePercentual: -30, criterios: {}, itens: [] },
  // Inativa
  { id: 5, nome: 'Inativa', prioridade: 1, ativo: false, ajustePercentual: -50, criterios: {}, itens: [] },
];

const ctx = (c: Partial<ContextoVenda>): ContextoVenda => ({ data: '2026-11-09', quantidade: 1, ...c });

// 1) Região 5 + vendedor 7 -> lista 1, preço fixo da lâmina (R$ 850,00 = -8,21% sobre 926,00)
let r = resolverPreco(listas, ctx({ regiao: 5, vendedor: 7 }), lamina);
assert.equal(r.preco, 850);
assert.equal(r.lista?.id, 1);
assert.equal(r.regra, 'produto');
assert.equal(r.diferencaPercentual, -8.21);

// 2) A mesma lista para a tora (sem regra de produto): ajuste padrão -8% sobre R$ 1,00 = R$ 0,92
r = resolverPreco(listas, ctx({ regiao: 5, vendedor: 7 }), tora);
assert.equal(r.preco, 0.92);
assert.equal(r.regra, 'padrao_da_lista');

// 3) Só a região bate (vendedor errado): lista 1 não serve; sem outros critérios -> preço base
r = resolverPreco(listas, ctx({ regiao: 5, vendedor: 9 }), lamina);
assert.equal(r.origem, 'base');
assert.equal(r.preco, 926);

// 4) Quantidade 150 sem outros critérios: Atacado -12% sobre 926,00 = R$ 814,88
r = resolverPreco(listas, ctx({ quantidade: 150 }), lamina);
assert.equal(r.preco, 814.88);
assert.equal(r.lista?.id, 2);
assert.equal(r.regra, 'categoria');

// 5) Atacado não tem regra para a tora e nenhuma outra lista casa: preço base
r = resolverPreco(listas, ctx({ quantidade: 150 }), tora);
assert.equal(r.origem, 'base');

// 6) Prioridade: região 5 + vendedor 7 + quantidade 150 -> lista 1 (prioridade 10) vence a de atacado (20)
r = resolverPreco(listas, ctx({ regiao: 5, vendedor: 7, quantidade: 150 }), lamina);
assert.equal(r.lista?.id, 1);

// 7) Revenda de SC (tipo 2): -5% sobre 926,00 = R$ 879,70; revenda do RS não casa
r = resolverPreco(listas, ctx({ tipo_cliente: 2, uf: 'SC' }), lamina);
assert.equal(r.preco, 879.7);
r = resolverPreco(listas, ctx({ tipo_cliente: 2, uf: 'RS' }), lamina);
assert.equal(r.origem, 'base');

// 8) Critério definido na lista e ausente no contexto não bate
r = resolverPreco(listas, ctx({ tipo_cliente: 2 }), lamina);
assert.equal(r.origem, 'base');

// 9) Promoção vencida (fim 31/10) não vale em 09/11, mas vale em 20/10 (prioridade 1, -30%: 926,00 -> R$ 648,20)
assert.equal(resolverPreco(listas, ctx({}), lamina).origem, 'base');
r = resolverPreco(listas, ctx({ data: '2026-10-20' }), lamina);
assert.equal(r.preco, 648.2);
assert.equal(r.lista?.id, 4);

// 10) Dinheiro nunca fica negativo e arredonda em centavos (1,005 -> 1,01)
r = resolverPreco([{ id: 9, nome: 'x', prioridade: 1, ativo: true, ajustePercentual: -150, criterios: {}, itens: [] }], ctx({}), lamina);
assert.equal(r.preco, 0);

// 11) Variante: -10% no pai (id 30) e R$ 12,90 fixo na variante 7. A variante 7 sai a 12,90; a 8 (preço próprio 16,90)
//     sai 10% abaixo do preço DELA (15,21); o pai sem variante, 10% abaixo de 14,90 (13,41)
{
  const promo: ListaPreco[] = [{ id: 20, nome: 'Promo capas', prioridade: 1, ativo: true, ajustePercentual: null, criterios: {}, itens: [
    { escopo: 'produto', escopoId: 30, tipo: 'percentual', valor: -10 },
    { escopo: 'variante', escopoId: 7, tipo: 'preco', valor: 12.9 },
  ] }];
  r = resolverPreco(promo, ctx({}), { id: 30, varianteId: 7, precoBase: 16.9 });
  assert.equal(r.preco, 12.9);
  assert.equal(r.regra, 'variante');
  r = resolverPreco(promo, ctx({}), { id: 30, varianteId: 8, precoBase: 16.9 });
  assert.equal(r.preco, 15.21);
  assert.equal(r.regra, 'produto');
  r = resolverPreco(promo, ctx({}), { id: 30, precoBase: 14.9 });
  assert.equal(r.preco, 13.41);
}

console.log('precos.test.ts: todos os casos passaram');

// ---------------- Embalagem: lata R$ 4,00 (UN) e fardo com 12 (CX) ----------------
import { resolverItemVenda } from './precos';
{
  const lata = { id: 100, categoriaId: 1, marcaId: 1, precoBase: 4 };
  const fardoFixo = { sigla: 'CX', fator: 12, preco: 44 };
  const fardoSemPreco = { sigla: 'CX', fator: 12 };
  const atacado: ListaPreco = { id: 1, nome: 'Atacado 24+ unidades', prioridade: 10, ativo: true, qtdMin: 24, ajustePercentual: -10, criterios: {}, itens: [] };
  const c = { data: '2026-11-10' };

  // 2 fardos, sem lista, com preço próprio da embalagem: 2 x R$ 44,00 = R$ 88,00; baixa 24 latas; NF: qTrib 24 e vUnTrib 88/24
  let r = resolverItemVenda([], c, lata, 2, fardoFixo);
  assert.equal(r.preco, 44);
  assert.equal(r.valorTotal, 88);
  assert.equal(r.quantidadeBase, 24);
  assert.deepEqual(r.nfe, { uCom: 'CX', qCom: 2, vUnCom: 44, uTrib: 'UN', qTrib: 24, vUnTrib: 3.6666666667, vProd: 88 });
  assert.equal(r.diferencaPercentual, -8.33); // 44,00 contra 12 x 4,00 = 48,00

  // Sem preço na embalagem: fator x preço base = R$ 48,00 por fardo
  r = resolverItemVenda([], c, lata, 1, fardoSemPreco);
  assert.equal(r.preco, 48);
  assert.equal(r.diferencaPercentual, 0);

  // A faixa conta em unidades: 2 fardos = 24 latas -> lista de atacado serve: R$ 3,60 por lata = R$ 43,20 por fardo
  r = resolverItemVenda([atacado], c, lata, 2, fardoFixo);
  assert.equal(r.origem, 'lista');
  assert.equal(r.preco, 43.2);
  assert.equal(r.valorTotal, 86.4);
  // 1 fardo = 12 latas: não chega em 24, volta ao preço da embalagem (R$ 44,00)
  r = resolverItemVenda([atacado], c, lata, 1, fardoFixo);
  assert.equal(r.origem, 'base');
  assert.equal(r.preco, 44);
  // 24 latas soltas casam a mesma lista: R$ 3,60 cada (mesma regra, vendendo em unidade)
  r = resolverItemVenda([atacado], c, lata, 24, null);
  assert.equal(r.preco, 3.6);
  assert.deepEqual(r.nfe, { uCom: 'UN', qCom: 24, vUnCom: 3.6, uTrib: 'UN', qTrib: 24, vUnTrib: 3.6, vProd: 86.4 });
}
console.log('precos.test.ts (embalagens): todos os casos passaram');
