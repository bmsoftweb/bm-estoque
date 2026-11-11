import { NextRequest, NextResponse } from '@/server/next-server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from '@/server/next-headers';
import { getDb } from '@/lib/db';

/** Consultas auxiliares das telas fiscais: ?tipo=grupos | ncm&codigo=… | servico&codigo=… (todas só leitura) */
export async function GET(req: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const db = await getDb();
    const dbName = session.dbConfig?.database;
    const q = new URL(req.url).searchParams;
    const tipo = q.get('tipo');
    const codigo = (q.get('codigo') || '').replace(/\D/g, '');

    if (tipo === 'grupos') {
      const [rows]: any = await db.execute(`SELECT * FROM ${dbName}.fis_grupos_tributarios WHERE ativo = 1 ORDER BY descricao`);
      return NextResponse.json(rows);
    }
    // Listas com pesquisa: ?tipo=buscar&tabela=ncm|servico|nbs|cest [&q=texto | &codigo=exato] [&item=0107] [&ncm=44089090]
    if (tipo === 'buscar') {
      const tabela = q.get('tabela');
      const texto = (q.get('q') || '').trim().slice(0, 60);
      const num = texto.replace(/[\s.\-]/g, '');
      const soDigitos = /^\d+$/.test(num);
      const like = (v: string) => v.replace(/[\\%_]/g, (c) => '\\' + c);
      let sql = '';
      let params: any[] = [];
      const palavras = texto.split(/\s+/).filter(Boolean).slice(0, 5);
      const todas = (col: string) => palavras.map(() => col + ' LIKE ?').join(' AND ');
      const pal = () => palavras.map((p) => '%' + like(p) + '%');
      if (tabela === 'ncm') {
        const base = `SELECT ncm AS codigo, nome AS descricao FROM ${dbName}.fis_ncm`;
        if (codigo) { sql = `${base} WHERE ncm = ? LIMIT 1`; params = [codigo]; }
        else if (soDigitos) { sql = `${base} WHERE ncm LIKE ? AND (fim_vigencia IS NULL OR fim_vigencia >= CURDATE()) ORDER BY ncm LIMIT 30`; params = [like(num) + '%']; }
        else { sql = `${base} WHERE ${todas('nome')} AND (fim_vigencia IS NULL OR fim_vigencia >= CURDATE()) ORDER BY ncm LIMIT 30`; params = pal(); }
      } else if (tabela === 'servico') {
        const base = `SELECT codigo, descricao FROM ${dbName}.nfs_servicos_nacionais`;
        if (codigo) { sql = `${base} WHERE codigo = ? LIMIT 1`; params = [codigo]; }
        else if (soDigitos) { sql = `${base} WHERE codigo LIKE ? ORDER BY codigo LIMIT 30`; params = [like(num) + '%']; }
        else { sql = `${base} WHERE ${todas('descricao')} ORDER BY codigo LIMIT 30`; params = pal(); }
      } else if (tabela === 'nbs') {
        // Com o serviço escolhido (item = 4 primeiros dígitos do cTribNac), só as NBS que a Sefin aceita para ele (Anexo VIII)
        const item = (q.get('item') || '').replace(/\D/g, '').slice(0, 4);
        const juncao = item.length === 4 ? `JOIN ${dbName}.nfs_nbs_itens i ON i.nbs = n.codigo AND i.item = ?` : '';
        const base = `SELECT n.codigo, n.descricao FROM ${dbName}.nfs_nbs n ${juncao}`;
        const pj = item.length === 4 ? [item] : [];
        if (codigo) { sql = `${base} WHERE n.codigo = ? LIMIT 1`; params = [...pj, codigo]; }
        else if (soDigitos) { sql = `${base} WHERE n.codigo LIKE ? ORDER BY n.codigo LIMIT 30`; params = [...pj, like(num) + '%']; }
        else if (texto) { sql = `${base} WHERE ${todas('n.descricao')} ORDER BY n.codigo LIMIT 30`; params = [...pj, ...pal()]; }
        else { sql = `${base} ORDER BY n.codigo LIMIT 30`; params = pj; }
      } else if (tabela === 'cest') {
        const ncm = (q.get('ncm') || '').replace(/\D/g, '');
        const base = `SELECT cest AS codigo, MIN(descricao) AS descricao FROM ${dbName}.fis_cest`;
        if (codigo) { sql = `${base} WHERE cest = ? GROUP BY cest LIMIT 1`; params = [codigo]; }
        else if (!texto && ncm.length === 8) {
          // sem digitar: os CEST específicos do NCM (4+ dígitos de prefixo; fora o Anexo XXVII, que é o da escala)
          sql = `${base} WHERE ? LIKE CONCAT(ncm_prefixo, '%') AND CHAR_LENGTH(ncm_prefixo) >= 4 AND anexo <> 'XXVII' GROUP BY cest ORDER BY cest LIMIT 30`;
          params = [ncm];
        } else if (soDigitos) { sql = `${base} WHERE cest LIKE ? GROUP BY cest ORDER BY cest LIMIT 30`; params = [like(num) + '%']; }
        else if (texto) { sql = `${base} WHERE ${todas('descricao')} GROUP BY cest ORDER BY cest LIMIT 30`; params = pal(); }
        else return NextResponse.json([]);
      } else {
        return NextResponse.json({ error: 'tabela inválida' }, { status: 400 });
      }
      try {
        const [rows]: any = await db.execute(sql, params);
        return NextResponse.json(rows);
      } catch (e: any) {
        if (e.code === 'ER_NO_SUCH_TABLE') return NextResponse.json({ semTabela: true });
        throw e;
      }
    }
    if (tipo === 'ncm') {
      if (codigo.length !== 8) return NextResponse.json({ encontrado: false });
      const [rows]: any = await db.execute(`SELECT ncm, nome, fim_vigencia FROM ${dbName}.fis_ncm WHERE ncm = ? LIMIT 1`, [codigo]);
      return NextResponse.json(rows.length ? { encontrado: true, ...rows[0] } : { encontrado: false });
    }
    // CEST candidatos ao NCM (o NCM do item começa com o prefixo do anexo) e se consta na lista da escala (Anexo XXVII)
    if (tipo === 'cest') {
      if (codigo.length !== 8) return NextResponse.json({ tabela: true, candidatos: [], escala: false });
      try {
        const [rows]: any = await db.execute(
          `SELECT cest, descricao, anexo, ncm_prefixo FROM ${dbName}.fis_cest WHERE ? LIKE CONCAT(ncm_prefixo, '%') ORDER BY CHAR_LENGTH(ncm_prefixo) DESC, cest`,
          [codigo],
        );
        const escala = rows.some((r: any) => r.anexo === 'XXVII');
        // o mesmo CEST pode aparecer em mais de um anexo: uma linha por CEST, anexo(s) juntos
        const porCest = new Map<string, any>();
        for (const r of rows) {
          const x = porCest.get(r.cest);
          if (x) x.anexos.includes(r.anexo) || x.anexos.push(r.anexo);
          else porCest.set(r.cest, { cest: r.cest, descricao: r.descricao, anexos: [r.anexo], prefixo: r.ncm_prefixo, generico: r.ncm_prefixo.length <= 2 });
        }
        return NextResponse.json({ tabela: true, candidatos: [...porCest.values()].filter((c) => c.anexos.some((a: string) => a !== 'XXVII')), escala });
      } catch (e: any) {
        if (e.code === 'ER_NO_SUCH_TABLE') return NextResponse.json({ tabela: false, candidatos: [], escala: false });
        throw e;
      }
    }
    if (tipo === 'servico') {
      if (codigo.length !== 6) return NextResponse.json({ encontrado: false });
      const [rows]: any = await db.execute(`SELECT codigo, descricao FROM ${dbName}.nfs_servicos_nacionais WHERE codigo = ? LIMIT 1`, [codigo]);
      return NextResponse.json(rows.length ? { encontrado: true, ...rows[0] } : { encontrado: false });
    }
    return NextResponse.json({ error: 'tipo inválido' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
