import { NextRequest, NextResponse } from '@/server/next-server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from '@/server/next-headers';
import { getDb } from '@/lib/db';
import { grupoDa } from '@/lib/empresa';

/**
 * Caixa/PDV: do código de barras bipado ao produto e à embalagem.
 * GET ?codigo=… -> { encontrado, produto: { id, sku, nome, unidadeSigla, precoBase }, embalagem: { id, sigla, descricao, fator, preco } | null }
 * Código de embalagem -> produto + embalagem (vende em fardo); código do produto -> embalagem null (vende em unidade).
 */
export async function GET(req: NextRequest) {
  try {
    const s = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!s.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const codigo = (new URL(req.url).searchParams.get('codigo') || '').replace(/\D/g, '');
    if (!codigo) return NextResponse.json({ error: 'Informe o código de barras.' }, { status: 400 });
    const db = await getDb();
    const bd = s.dbConfig?.database;
    const emp = grupoDa(s);
    const campos = `p.id, p.sku, p.nome, p.preco_venda, u.sigla AS unidade_sigla`;
    const juncao = `FROM ${bd}.cad_produtos p LEFT JOIN ${bd}.cad_produtos_unidades_medida u ON u.id = p.unidade_id`;
    const produto = (p: any) => ({ id: p.id, sku: p.sku, nome: p.nome, unidadeSigla: p.unidade_sigla, precoBase: Number(p.preco_venda) });

    try {
      const [e]: any = await db.execute(
        `SELECT ${campos}, e.id AS emb_id, e.sigla AS emb_sigla, e.descricao AS emb_descricao, e.fator, e.preco AS emb_preco
           FROM ${bd}.cad_produtos_embalagens e JOIN ${bd}.cad_produtos p ON p.id = e.produto_id ${juncao.replace(`FROM ${bd}.cad_produtos p `, '')}
          WHERE e.codigo_barras = ? AND e.ativo = 1 AND p.ativo = 1 AND p.grupo_id = ? LIMIT 1`,
        [codigo, emp],
      );
      if (e.length) {
        const x = e[0];
        return NextResponse.json({
          encontrado: true,
          produto: produto(x),
          embalagem: { id: x.emb_id, sigla: x.emb_sigla, descricao: x.emb_descricao, fator: Number(x.fator), preco: x.emb_preco === null ? null : Number(x.emb_preco) },
        });
      }
    } catch (err: any) {
      if (err.code !== 'ER_NO_SUCH_TABLE') throw err; // sem a tabela, só vale o código do produto
    }
    const [p]: any = await db.execute(`SELECT ${campos} ${juncao} WHERE p.codigo_barras = ? AND p.ativo = 1 AND p.grupo_id = ? LIMIT 1`, [codigo, emp]);
    if (p.length) return NextResponse.json({ encontrado: true, produto: produto(p[0]), embalagem: null });
    return NextResponse.json({ encontrado: false });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
