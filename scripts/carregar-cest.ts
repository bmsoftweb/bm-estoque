/**
 * Carrega a tabela de CEST (Convênio ICMS 142/2018, CONFAZ) em fis_cest.
 *
 *   npx tsx scripts/carregar-cest.ts            -> SIMULAÇÃO: baixa, lê e mostra o que carregaria (não grava nada)
 *   npx tsx scripts/carregar-cest.ts --gravar   -> grava em fis_cest (a tabela é criada por você: extras/2026-11-09_fis_cest.sql)
 *
 * Fonte: https://www.confaz.fazenda.gov.br/legislacao/convenios/2018/CV142_18. Os anexos são tabelas HTML no corpo
 * da página (sem arquivo para baixar): ITEM | CEST | NCM/SH | DESCRIÇÃO. O NCM/SH vem como prefixo (4010.3, 6306.1,
 * 3815.12.10 …): o item da nota pertence ao CEST quando o NCM dele COMEÇA com o prefixo.
 * O Anexo XXVII é o da mercadoria "fabricada em escala industrial não relevante" (Cláusula 22ª do Conv. 142/18).
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const URL_CONFAZ = 'https://www.confaz.fazenda.gov.br/legislacao/convenios/2018/CV142_18';

const ENTIDADES: Record<string, string> = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&ordm;': 'º', '&ordf;': 'ª' };
const texto = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, (e) => ENTIDADES[e.toLowerCase()] ?? ' ')
    .replace(/\s+/g, ' ')
    .trim();

interface Linha {
  cest: string; // 7 dígitos
  ncm: string; // prefixo, só dígitos (2 a 8)
  descricao: string;
  anexo: string;
  item: string;
}

/** "13 e 15 a 23" -> 13, 15, 16 … 23 (prefixos de 2 dígitos) */
function capitulos(t: string): string[] {
  const r: string[] = [];
  for (const parte of t.split(/\s+e\s+|,/)) {
    const m = /^\s*(\d{1,2})(?:\s*a\s*(\d{1,2}))?\s*$/.exec(parte);
    if (!m) return [parte.trim()]; // vira anomalia
    for (let n = Number(m[1]); n <= Number(m[2] ?? m[1]); n++) r.push(String(n).padStart(2, '0'));
  }
  return r;
}

async function main() {
  const gravar = process.argv.includes('--gravar');
  const r = await fetch(URL_CONFAZ, { signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`CONFAZ respondeu ${r.status}`);
  const html = await r.text();

  // Cabeçalhos "ANEXO II" … (só quando o elemento é apenas isso)
  const titulos = [...html.matchAll(/>\s*ANEXO\s+([IVXL]+)\s*<\/(?:p|b|strong|span|h\d)>/gi)].map((m) => ({ pos: m.index!, anexo: m[1].toUpperCase() }));
  const tabelas = [...html.matchAll(/<table[\s\S]*?<\/table>/gi)];

  const linhas: Linha[] = [];
  const anomalias: string[] = [];
  const resumo: Record<string, { tabelas: number; linhas: number; tokens: number }> = {};
  const ignoradas: string[] = [];
  let revogados = 0;

  for (const t of tabelas) {
    const anexo = [...titulos].reverse().find((x) => x.pos < t.index!)?.anexo ?? '?';
    const trs = [...t[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((m) => [...m[0].matchAll(/<t[dh][\s\S]*?<\/t[dh]>/gi)].map((c) => texto(c[0])));
    const cab = (trs[0] ?? []).map((c) => c.toUpperCase());
    const iCest = cab.findIndex((c) => c === 'CEST');
    const iNcm = cab.findIndex((c) => c.startsWith('NCM'));
    const iDesc = cab.findIndex((c) => c.startsWith('DESCRI'));
    const iItem = cab.findIndex((c) => c === 'ITEM');
    if (iCest < 0 || iNcm < 0) {
      ignoradas.push(`Anexo ${anexo}: cabeçalho ${JSON.stringify(cab)} (${trs.length} linhas)`);
      continue;
    }
    const res = (resumo[anexo] ??= { tabelas: 0, linhas: 0, tokens: 0 });
    res.tabelas++;
    for (const c of trs.slice(1)) {
      const cestTxt = c[iCest] ?? '';
      const cest = cestTxt.replace(/\D/g, '');
      if (/^revogad/i.test(cestTxt)) {
        revogados++;
        continue;
      }
      if (!/^\d{2}\.\d{3}\.\d{2}$/.test(cestTxt) || cest.length !== 7) {
        if (cestTxt) anomalias.push(`Anexo ${anexo}: CEST fora do padrão "${cestTxt}"`);
        continue;
      }
      res.linhas++;
      const ncmTxt = c[iNcm] ?? '';
      // "Capítulos 33 e 34" -> prefixos de 2 dígitos
      const caps = /^cap[ií]tulos?\s+(.+)$/i.exec(ncmTxt);
      const tokens = caps ? capitulos(caps[1]) : ncmTxt.split(/[\s,;]+/).filter(Boolean);
      for (const tk of tokens) {
        const d = tk.replace(/\./g, '');
        if (!/^\d{2,8}$/.test(d)) {
          anomalias.push(`Anexo ${anexo}, CEST ${cestTxt}: NCM/SH "${tk}" não reconhecido (célula: "${ncmTxt}")`);
          continue;
        }
        res.tokens++;
        linhas.push({ cest, ncm: d, descricao: c[iDesc] ?? '', anexo, item: c[iItem] ?? '' });
      }
    }
  }

  // Repetidos (mesma tripla) saem uma vez só
  const chave = (l: Linha) => `${l.cest}|${l.ncm}|${l.anexo}`;
  const unicas = [...new Map(linhas.map((l) => [chave(l), l])).values()];

  console.log(`Fonte: ${URL_CONFAZ}`);
  console.log(`Tabelas na página: ${tabelas.length} • lidas como CEST/NCM: ${Object.values(resumo).reduce((s, x) => s + x.tabelas, 0)}`);
  console.log('Por anexo (linhas de CEST • pares CEST×NCM):');
  for (const [a, x] of Object.entries(resumo)) console.log(`  ${a.padEnd(7)} ${String(x.linhas).padStart(5)} • ${String(x.tokens).padStart(5)}`);
  console.log(`Linhas REVOGADAS ignoradas: ${revogados}`);
  console.log(`Total: ${linhas.length} pares (${unicas.length} únicos), ${new Set(unicas.map((l) => l.cest)).size} CEST distintos`);
  if (ignoradas.length) console.log(`\nTabelas ignoradas (cabeçalho diferente):\n  ` + ignoradas.join('\n  '));
  if (anomalias.length) console.log(`\nAnomalias (${anomalias.length}), primeiras 25:\n  ` + anomalias.slice(0, 25).join('\n  '));
  console.log('\nExemplos:', unicas.slice(0, 3));

  if (!gravar) {
    console.log('\nSIMULAÇÃO: nada foi gravado. Use --gravar para carregar em fis_cest.');
    return;
  }
  for (const n of ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_PASSWORD']) if (!process.env[n]) throw new Error(`${n} não definido no .env.`);
  const c = await mysql.createConnection({ host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT) || 3306, user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, database: process.env.MYSQL_DATABASE || 'bmerp_000000' });
  try {
    await c.beginTransaction();
    await c.query('DELETE FROM fis_cest');
    for (let i = 0; i < unicas.length; i += 500) {
      const lote = unicas.slice(i, i + 500);
      await c.query('INSERT INTO fis_cest (cest, ncm_prefixo, descricao, anexo, item, criado_em, atualizado_em) VALUES ?', [lote.map((l) => [l.cest, l.ncm, l.descricao, l.anexo, l.item, new Date(), new Date()])]);
    }
    await c.commit();
    console.log(`Gravado: ${unicas.length} linhas em fis_cest.`);
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error('ERRO:', e.message);
  process.exit(1);
});
