import { NextRequest, NextResponse } from '@/server/next-server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from '@/server/next-headers';
import { getDb } from '@/lib/db';
import { gtinValido } from '@/lib/gtin';
import { grupoDa } from '@/lib/empresa';

/**
 * Embalagens do produto (fardo, caixa…): 1 embalagem = `fator` unidades do produto. Tabela cad_produtos_embalagens
 * (extras/2026-11-10_embalagens.sql). Sem a tabela, a leitura devolve { semTabela: true }.
 */
const SEM_TABELA = 'A tabela de embalagens ainda não foi criada no banco (extras/2026-11-10_embalagens.sql).';

class Invalido extends Error {}

const num = (v: any) => (v === null || v === undefined || v === '' ? null : Number(v));

function validar(lista: any[]) {
  if (!Array.isArray(lista)) throw new Invalido('Embalagens inválidas.');
  if (lista.length > 20) throw new Invalido('No máximo 20 embalagens por produto.');
  const siglas = new Set<string>();
  const barras = new Set<string>();
  return lista.map((e) => {
    const sigla = String(e.sigla ?? '').trim().toUpperCase();
    if (!/^[A-Z0-9]{1,6}$/.test(sigla)) throw new Invalido('Sigla da embalagem: de 1 a 6 letras ou números (ex.: CX, FD).');
    if (siglas.has(sigla)) throw new Invalido(`A sigla ${sigla} está repetida.`);
    siglas.add(sigla);
    const descricao = String(e.descricao ?? '').trim();
    if (!descricao) throw new Invalido(`Informe a descrição da embalagem ${sigla}.`);
    if (descricao.length > 60) throw new Invalido(`Descrição da embalagem ${sigla}: no máximo 60 caracteres.`);
    const fator = Number(e.fator);
    if (!Number.isFinite(fator) || fator <= 0) throw new Invalido(`Embalagem ${sigla}: o fator (unidades na embalagem) deve ser maior que zero.`);
    const codigo = String(e.codigoBarras ?? '').replace(/\D/g, '');
    if (codigo) {
      if (!gtinValido(codigo)) throw new Invalido(`Embalagem ${sigla}: código de barras inválido (GTIN de 8, 12, 13 ou 14 dígitos com o dígito verificador correto).`);
      if (barras.has(codigo)) throw new Invalido(`O código de barras ${codigo} está repetido.`);
      barras.add(codigo);
    }
    const preco = num(e.preco);
    if (preco !== null && (!Number.isFinite(preco) || preco < 0)) throw new Invalido(`Embalagem ${sigla}: preço inválido.`);
    return { id: Number(e.id) || null, sigla, descricao, fator, codigo: codigo || null, preco, ativo: e.ativo === false || e.ativo === 0 ? 0 : 1 };
  });
}

async function sessao() {
  const s = await getIronSession<SessionData>(await cookies(), sessionOptions);
  return s.isLoggedIn ? s : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const s = await sessao();
    if (!s) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const db = await getDb();
    const bd = s.dbConfig?.database;
    const [p]: any = await db.execute(
      `SELECT p.id, p.sku, p.nome, p.codigo_barras, p.preco_venda, u.sigla AS unidade_sigla
         FROM ${bd}.cad_produtos p LEFT JOIN ${bd}.cad_produtos_unidades_medida u ON u.id = p.unidade_id WHERE p.id = ? AND p.grupo_id = ?`,
      [id, grupoDa(s)],
    );
    if (!p.length) return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 });
    try {
      const [e]: any = await db.execute(
        `SELECT id, sigla, descricao, fator, codigo_barras, preco, ativo FROM ${bd}.cad_produtos_embalagens WHERE produto_id = ? ORDER BY fator, sigla`,
        [id],
      );
      return NextResponse.json({ semTabela: false, produto: p[0], embalagens: e.map((x: any) => ({ id: x.id, sigla: x.sigla, descricao: x.descricao, fator: Number(x.fator), codigoBarras: x.codigo_barras, preco: x.preco === null ? null : Number(x.preco), ativo: Boolean(x.ativo) })) });
    } catch (e: any) {
      if (e.code === 'ER_NO_SUCH_TABLE') return NextResponse.json({ semTabela: true, produto: p[0], embalagens: [] });
      throw e;
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** Grava o conjunto: atualiza as que têm id, cria as novas e remove as que saíram da lista (numa transação) */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let conn: any = null;
  try {
    const { id } = await params;
    const s = await sessao();
    if (!s) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const lista = validar(((await req.json()) || {}).embalagens);
    const db = await getDb();
    const bd = s.dbConfig?.database;

    const emp = grupoDa(s);
    const [p]: any = await db.execute(`SELECT codigo_barras FROM ${bd}.cad_produtos WHERE id = ? AND grupo_id = ?`, [id, emp]);
    if (!p.length) return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 });
    // Na empresa, o código da embalagem não pode ser o de um produto nem o de embalagem de outro produto
    // (o índice do banco não é único: outra empresa pode usar o mesmo código)
    for (const e of lista.filter((x) => x.codigo)) {
      const [c]: any = await db.execute(`SELECT id FROM ${bd}.cad_produtos WHERE codigo_barras = ? AND grupo_id = ? LIMIT 1`, [e.codigo, emp]);
      if (c.length) throw new Invalido(`O código de barras ${e.codigo} já é de um produto (#${c[0].id}).`);
      const [o]: any = await db.execute(
        `SELECT e.produto_id FROM ${bd}.cad_produtos_embalagens e JOIN ${bd}.cad_produtos p ON p.id = e.produto_id
          WHERE e.codigo_barras = ? AND p.grupo_id = ? AND e.produto_id <> ? LIMIT 1`,
        [e.codigo, emp, id],
      );
      if (o.length) throw new Invalido(`O código de barras ${e.codigo} já é de uma embalagem do produto #${o[0].produto_id}.`);
    }

    conn = await db.getConnection();
    await conn.beginTransaction();
    const [atuais]: any = await conn.execute(`SELECT id FROM ${bd}.cad_produtos_embalagens WHERE produto_id = ?`, [id]);
    const existentes = new Set<number>(atuais.map((x: any) => x.id));
    const mantidos = new Set<number>();
    for (const e of lista) {
      if (e.id && existentes.has(e.id)) {
        mantidos.add(e.id);
        await conn.execute(
          `UPDATE ${bd}.cad_produtos_embalagens SET sigla = ?, descricao = ?, fator = ?, codigo_barras = ?, preco = ?, ativo = ?, atualizado_em = NOW() WHERE id = ? AND produto_id = ?`,
          [e.sigla, e.descricao, e.fator, e.codigo, e.preco, e.ativo, e.id, id],
        );
      }
    }
    // Remove as que saíram antes de inserir, para a sigla/código liberados poderem ser reaproveitados
    for (const antigo of existentes) if (!mantidos.has(antigo)) await conn.execute(`DELETE FROM ${bd}.cad_produtos_embalagens WHERE id = ?`, [antigo]);
    for (const e of lista) {
      if (!(e.id && existentes.has(e.id))) {
        await conn.execute(
          `INSERT INTO ${bd}.cad_produtos_embalagens (produto_id, sigla, descricao, fator, codigo_barras, preco, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [id, e.sigla, e.descricao, e.fator, e.codigo, e.preco, e.ativo],
        );
      }
    }
    await conn.commit();
    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (conn) await conn.rollback().catch(() => {});
    if (e instanceof Invalido) return NextResponse.json({ error: e.message }, { status: 400 });
    if (e.code === 'ER_NO_SUCH_TABLE') return NextResponse.json({ error: SEM_TABELA }, { status: 409 });
    if (e.code === 'ER_DUP_ENTRY') return NextResponse.json({ error: 'Sigla ou código de barras já usados em outra embalagem.' }, { status: 400 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally {
    if (conn) conn.release();
  }
}
