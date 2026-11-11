import { NextRequest, NextResponse } from '@/server/next-server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from '@/server/next-headers';
import { getDb } from '@/lib/db';
import { grupoDa } from '@/lib/empresa';

/**
 * Opções dos seletores da tela de listas de preço: ?tipo=…&q=texto  ou  ?tipo=…&ids=1,2,3 (rótulos de valores já escolhidos).
 * Devolve [{ valor, rotulo }] (produto e variante trazem também o preco de venda atual); { semTabela: true } quando o cadastro ainda não existe no banco.
 */
const FONTES: Record<string, { de: string; valor: string; rotulo: string; preco?: string; busca: string; filtro?: string; ordem: string; porGrupo?: boolean }> = {
  tipo_cliente: { de: 'cad_pessoas_tipos', valor: 'id', rotulo: 'nome', busca: 'nome', filtro: 'ativo = 1', ordem: 'nome' },
  regiao: { de: 'cad_regioes', valor: 'id', rotulo: 'nome', busca: 'nome', filtro: 'ativo = 1', ordem: 'nome' },
  cidade: { de: 'cad_cidades', valor: 'id', rotulo: "CONCAT(nome, ' - ', uf)", busca: 'nome', ordem: 'nome' },
  vendedor: { de: 'cad_pessoas', valor: 'id', rotulo: "COALESCE(NULLIF(nome_fantasia, ''), nome)", busca: 'COALESCE(NULLIF(nome_fantasia, \'\'), nome)', filtro: '(is_representante = 1 OR is_colaborador = 1) AND ativo = 1 AND date_delete IS NULL', ordem: 'nome' },
  cliente: { de: 'cad_pessoas', valor: 'id', rotulo: "COALESCE(NULLIF(nome_fantasia, ''), nome)", busca: 'COALESCE(NULLIF(nome_fantasia, \'\'), nome)', filtro: 'is_cliente = 1 AND ativo = 1 AND date_delete IS NULL', ordem: 'nome' },
  categoria: { de: 'cad_produtos_categorias', valor: 'id', rotulo: 'nome', busca: 'nome', filtro: 'ativo = 1', ordem: 'nome', porGrupo: true },
  marca: { de: 'cad_produtos_marcas', valor: 'id', rotulo: 'descricao', busca: 'descricao', ordem: 'descricao', porGrupo: true },
  produto: { de: 'cad_produtos', valor: 'id', rotulo: "CONCAT(sku, ' - ', nome)", preco: 'preco_venda', busca: "CONCAT(sku, ' ', nome)", filtro: 'ativo = 1', ordem: 'nome', porGrupo: true },
  // Variante com o produto pai: busca pelo SKU da variante ou pelo nome do produto ("caderno" traz todas as variantes)
  variante: {
    de: 'cad_produtos_variantes v JOIN {db}.cad_produtos p ON p.id = v.produto_id', valor: 'v.id',
    rotulo: "CONCAT(v.sku_variante, ' - ', COALESCE(NULLIF(v.nome_adicional, ''), p.nome))", preco: 'COALESCE(v.preco_venda, p.preco_venda)',
    busca: "CONCAT(v.sku_variante, ' ', p.sku, ' ', p.nome, ' ', COALESCE(v.nome_adicional, ''))", filtro: 'v.ativo = 1 AND p.ativo = 1', ordem: 'p.nome, v.sku_variante', porGrupo: true,
  },
};

export async function GET(req: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const db = await getDb();
    const dbName = session.dbConfig?.database;
    const q = new URL(req.url).searchParams;
    const f = FONTES[q.get('tipo') ?? ''];
    if (!f) return NextResponse.json({ error: 'tipo inválido' }, { status: 400 });

    const ids = (q.get('ids') || '').split(',').map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0).slice(0, 200);
    const texto = (q.get('q') || '').trim().slice(0, 60);
    const like = (v: string) => v.replace(/[\\%_]/g, (c) => '\\' + c);
    const palavras = texto.split(/\s+/).filter(Boolean).slice(0, 5);

    // Categorias, marcas, produtos e variantes (pelo produto pai) são do grupo; tipos, regiões, cidades e pessoas são compartilhados
    const onde: string[] = f.porGrupo ? ['grupo_id = ?'] : [];
    let params: any[] = f.porGrupo ? [grupoDa(session)] : [];
    if (q.get('ids') !== null) {
      if (!ids.length) return NextResponse.json([]);
      onde.push(`${f.valor} IN (${ids.map(() => '?').join(',')})`);
      params.push(...ids);
    } else {
      if (f.filtro) onde.push(f.filtro);
      for (const p of palavras) {
        onde.push(`${f.busca} LIKE ?`);
        params.push('%' + like(p) + '%');
      }
    }
    try {
      const [rows]: any = await db.execute(
        `SELECT ${f.valor} AS valor, ${f.rotulo} AS rotulo${f.preco ? `, ${f.preco} AS preco` : ''} FROM ${dbName}.${f.de.replace('{db}', String(dbName))} ${onde.length ? 'WHERE ' + onde.join(' AND ') : ''} ORDER BY ${f.ordem} LIMIT 30`,
        params,
      );
      return NextResponse.json(rows.map((r: any) => ({ valor: String(r.valor), rotulo: r.rotulo, ...(f.preco ? { preco: r.preco === null ? null : Number(r.preco) } : {}) })));
    } catch (e: any) {
      if (e.code === 'ER_NO_SUCH_TABLE') return NextResponse.json({ semTabela: true, tabela: f.de });
      throw e;
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
