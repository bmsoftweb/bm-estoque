/**
 * Lançamento de estoque: grava o movimento e atualiza o saldo (est_estoque_saldo, por lote + localização) na
 * mesma transação. Substitui a procedure sp_movimentar_estoque, que não existe no banco.
 *
 * O lote diz de qual produto/variante é o saldo; produto com variação só movimenta lote de uma variante.
 * Não deixa o saldo disponível (quantidade - reservado) ficar negativo.
 */

/** Erro de validação: vira 400 com a mensagem para o usuário */
export class Invalido extends Error {}

const TIPOS = ['entrada', 'saida', 'transferencia', 'ajuste_positivo', 'ajuste_negativo', 'reserva', 'liberacao_reserva', 'perda', 'producao_entrada', 'producao_saida'] as const;
type Tipo = (typeof TIPOS)[number];
const ENTRA: Tipo[] = ['entrada', 'ajuste_positivo', 'producao_entrada'];
const SAI: Tipo[] = ['saida', 'ajuste_negativo', 'perda', 'producao_saida'];

export interface Movimento {
  tipo: Tipo;
  lote_id: number;
  localizacao_orig_id: number | null;
  localizacao_dest_id: number | null;
  quantidade: number;
  custo_unitario: number | null;
  referencia_tipo: string | null;
  referencia_id: number | null;
  observacao: string | null;
  produto_id: number;
  variante_id: number | null;
}

const id = (v: any) => (v === null || v === undefined || v === '' || Number(v) === 0 ? null : Number(v));

/** Produto com variação exige variante (e a variante tem de ser dele); produto sem variação não aceita variante */
export async function conferirVariante(db: any, bd: string, produtoId: number, varianteId: number | null) {
  const [p]: any = await db.execute(`SELECT tipo_produto FROM ${bd}.cad_produtos WHERE id = ?`, [produtoId]);
  if (!p.length) throw new Invalido('Produto não encontrado.');
  const comVariacao = String(p[0].tipo_produto).startsWith('variacao');
  if (comVariacao && !varianteId) throw new Invalido('Produto com variação: informe a variante.');
  if (!comVariacao && varianteId) throw new Invalido('Este produto não tem variação.');
  if (varianteId) {
    const [v]: any = await db.execute(`SELECT 1 FROM ${bd}.cad_produtos_variantes WHERE id = ? AND produto_id = ? AND ativo = 1`, [varianteId, produtoId]);
    if (!v.length) throw new Invalido('Variante não encontrada neste produto.');
  }
}

/** Confere o corpo da requisição contra o banco e devolve o movimento pronto (produto/variante vêm do lote) */
export async function validarMovimento(db: any, bd: string, body: any, grupo: number, empresa: number): Promise<Movimento> {
  const tipo = body.tipo as Tipo;
  if (!TIPOS.includes(tipo)) throw new Invalido('Tipo de movimento inválido.');
  const quantidade = Number(body.quantidade);
  if (!(quantidade > 0)) throw new Invalido('A quantidade tem de ser maior que zero.');

  const orig = id(body.localizacao_orig_id);
  const dest = id(body.localizacao_dest_id);
  const precisaOrig = !ENTRA.includes(tipo);
  const precisaDest = ENTRA.includes(tipo) || tipo === 'transferencia';
  if (precisaOrig && !orig) throw new Invalido('Informe a localização de origem.');
  if (precisaDest && !dest) throw new Invalido('Informe a localização de destino.');
  if (tipo === 'transferencia' && orig === dest) throw new Invalido('Origem e destino são a mesma localização.');
  const locs = [precisaOrig ? orig : null, precisaDest ? dest : null].filter((x): x is number => x !== null);
  for (const loc of locs) {
    const [l]: any = await db.execute(`SELECT 1 FROM ${bd}.cad_produtos_localizacoes WHERE id = ? AND empresa_id = ?`, [loc, empresa]);
    if (!l.length) throw new Invalido(`Localização ${loc} não encontrada nesta filial.`);
  }

  const loteId = id(body.lote_id);
  if (!loteId) throw new Invalido('Informe o lote.');
  const [lt]: any = await db.execute(`SELECT produto_id, variante_id, preco_custo FROM ${bd}.cad_produtos_lotes WHERE id = ? AND grupo_id = ?`, [loteId, grupo]);
  if (!lt.length) throw new Invalido('Lote não encontrado.');
  const produtoId = id(lt[0].produto_id);
  if (!produtoId) throw new Invalido('O lote não está ligado a nenhum produto.');
  const varianteId = id(lt[0].variante_id);
  await conferirVariante(db, bd, produtoId, varianteId);

  const custo = body.custo_unitario === '' || body.custo_unitario == null ? Number(lt[0].preco_custo) || null : Number(body.custo_unitario);
  return {
    tipo,
    lote_id: loteId,
    localizacao_orig_id: precisaOrig ? orig : null,
    localizacao_dest_id: precisaDest ? dest : null,
    quantidade,
    custo_unitario: custo,
    referencia_tipo: body.referencia_tipo || null,
    referencia_id: id(body.referencia_id),
    observacao: body.observacao || null,
    produto_id: produtoId,
    variante_id: varianteId,
  };
}

/** O que o movimento faz em cada saldo: localização, coluna e quantidade (positiva = soma) */
function efeitos(m: Pick<Movimento, 'tipo' | 'localizacao_orig_id' | 'localizacao_dest_id' | 'quantidade'>) {
  const q = Number(m.quantidade);
  const o = m.localizacao_orig_id!;
  const d = m.localizacao_dest_id!;
  if (ENTRA.includes(m.tipo)) return [{ loc: d, campo: 'quantidade', delta: q }];
  if (SAI.includes(m.tipo)) return [{ loc: o, campo: 'quantidade', delta: -q }];
  if (m.tipo === 'transferencia') return [{ loc: o, campo: 'quantidade', delta: -q }, { loc: d, campo: 'quantidade', delta: q }];
  if (m.tipo === 'reserva') return [{ loc: o, campo: 'reservado', delta: q }];
  return [{ loc: o, campo: 'reservado', delta: -q }]; // liberacao_reserva
}

/**
 * Aplica (sinal 1) ou desfaz (sinal -1) o efeito de um ou mais movimentos no saldo. Usar dentro de uma transação.
 * Os efeitos são somados por lote + localização antes de validar: ao alterar um movimento, desfazer o antigo e
 * aplicar o novo no mesmo saldo não passa por um valor intermediário negativo.
 */
export async function aplicarNoSaldo(conn: any, bd: string, itens: { m: Movimento; sinal: 1 | -1 }[]) {
  const somas = new Map<string, { lote: number; loc: number; quantidade: number; reservado: number }>();
  for (const { m, sinal } of itens) {
    for (const e of efeitos(m)) {
      const k = `${m.lote_id}|${e.loc}`;
      const s = somas.get(k) ?? { lote: m.lote_id, loc: e.loc, quantidade: 0, reservado: 0 };
      (s as any)[e.campo] += sinal * e.delta;
      somas.set(k, s);
    }
  }

  for (const d of somas.values()) {
    const [s]: any = await conn.execute(
      `SELECT quantidade, reservado FROM ${bd}.est_estoque_saldo WHERE lote_id = ? AND localizacao_id = ? FOR UPDATE`,
      [d.lote, d.loc]
    );
    const atual = { quantidade: Number(s[0]?.quantidade ?? 0), reservado: Number(s[0]?.reservado ?? 0) };
    // Arredonda nas 4 casas da coluna para não acumular erro de ponto flutuante
    const novo = {
      quantidade: Math.round((atual.quantidade + d.quantidade) * 10000) / 10000,
      reservado: Math.round((atual.reservado + d.reservado) * 10000) / 10000,
    };
    if (novo.reservado < 0) throw new Invalido(`Não há tanta quantidade reservada na localização ${d.loc}.`);
    if (novo.quantidade - novo.reservado < 0) {
      const disp = atual.quantidade - atual.reservado;
      throw new Invalido(`Saldo insuficiente na localização ${d.loc}: disponível ${disp.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}.`);
    }
    if (s.length) {
      await conn.execute(
        `UPDATE ${bd}.est_estoque_saldo SET quantidade = ?, reservado = ?, date_update = NOW() WHERE lote_id = ? AND localizacao_id = ?`,
        [novo.quantidade, novo.reservado, d.lote, d.loc]
      );
    } else {
      await conn.execute(
        `INSERT INTO ${bd}.est_estoque_saldo (lote_id, localizacao_id, quantidade, reservado, date_update) VALUES (?, ?, ?, ?, NOW())`,
        [d.lote, d.loc, novo.quantidade, novo.reservado]
      );
    }
  }
}

/** Lê um movimento gravado (da filial) no formato usado por aplicarNoSaldo */
export async function lerMovimento(conn: any, bd: string, movId: number | string, empresa: number): Promise<Movimento | null> {
  const [r]: any = await conn.execute(`SELECT * FROM ${bd}.est_estoque_movimentacoes WHERE id = ? AND empresa_id = ? FOR UPDATE`, [movId, empresa]);
  if (!r.length) return null;
  return { ...r[0], quantidade: Number(r[0].quantidade) };
}

/** Roda fn numa transação: confirma no fim, desfaz tudo se der erro */
export async function emTransacao<T>(db: any, fn: (conn: any) => Promise<T>): Promise<T> {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const r = await fn(conn);
    await conn.commit();
    return r;
  } catch (e) {
    await conn.rollback().catch(() => {});
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * Saldo disponível para venda (quantidade - reservado) de cada produto na filial, somando lotes e variantes.
 * Localizações virtuais (ex.: avarias) não contam.
 */
export async function disponivelPorProduto(db: any, bd: string, produtoIds: number[], empresa: number): Promise<Map<number, number>> {
  const r = new Map<number, number>();
  if (!produtoIds.length) return r;
  const [rows]: any = await db.query(
    `SELECT l.produto_id, SUM(s.quantidade - s.reservado) AS disponivel
       FROM ${bd}.est_estoque_saldo s
       JOIN ${bd}.cad_produtos_lotes l ON l.id = s.lote_id
       JOIN ${bd}.cad_produtos_localizacoes c ON c.id = s.localizacao_id AND c.empresa_id = ? AND c.tipo <> 'virtual'
      WHERE l.produto_id IN (?)
      GROUP BY l.produto_id`,
    [empresa, produtoIds]
  );
  for (const x of rows) r.set(Number(x.produto_id), Number(x.disponivel));
  return r;
}
