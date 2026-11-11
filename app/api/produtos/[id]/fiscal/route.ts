import { NextRequest, NextResponse } from '@/server/next-server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from '@/server/next-headers';
import { getDb } from '@/lib/db';
import { gtinValido } from '@/lib/gtin';
import { grupoDa } from '@/lib/empresa';

/**
 * Dados fiscais do produto (NF-e e NFS-e). Só as colunas que existem em cad_produtos são lidas e gravadas:
 * as sugeridas em extras/2026-11-09_dados_fiscais_produtos.sql entram sozinhas quando o usuário as criar.
 */
const COLUNAS_FISCAIS = [
  'codigo_barras', 'ncm', 'cest', 'ex_tipi', 'cbenef', 'ind_escala', 'cnpj_fabricante', 'grupo_tributario_id',
  'servico', 'cserv_nacional', 'cserv_municipal', 'cnbs', 'aliquota_iss', 'iss_retido',
] as const;
type Coluna = (typeof COLUNAS_FISCAIS)[number];

const digitos = (v: unknown) => String(v ?? '').replace(/\D/g, '');

function cnpjValido(c: string) {
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const calc = (n: number) => {
    let s = 0;
    let p = n - 7;
    for (let i = 0; i < n; i++) {
      s += Number(c[i]) * p--;
      if (p < 2) p = 9;
    }
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(c[12]) && calc(13) === Number(c[13]);
}

/** Normaliza e valida o campo recebido; devolve o valor para o banco ou lança a mensagem de erro */
function validar(v: Record<string, any>, campo: Coluna): string | number | null {
  const bruto = v[campo];
  const vazio = bruto === null || bruto === undefined || String(bruto).trim() === '';
  switch (campo) {
    case 'codigo_barras': {
      if (vazio) return null;
      const g = digitos(bruto);
      if (!gtinValido(g)) throw new Error('Código de barras inválido: informe um GTIN de 8, 12, 13 ou 14 dígitos com o dígito verificador correto (ou deixe em branco).');
      return g;
    }
    case 'ncm': {
      if (vazio) return null;
      const n = digitos(bruto);
      if (n.length !== 8) throw new Error('NCM deve ter 8 dígitos.');
      return n;
    }
    case 'cest': {
      if (vazio) return null;
      const n = digitos(bruto);
      if (n.length !== 7) throw new Error('CEST deve ter 7 dígitos.');
      return n;
    }
    case 'ex_tipi': {
      if (vazio) return null;
      const n = digitos(bruto);
      if (n.length < 2 || n.length > 3) throw new Error('EX da TIPI deve ter 2 ou 3 dígitos.');
      return n;
    }
    case 'cbenef': {
      if (vazio) return null;
      const t = String(bruto).trim().toUpperCase();
      if (!/^[A-Z0-9]{8,10}$/.test(t)) throw new Error('Código de benefício fiscal (cBenef) deve ter de 8 a 10 caracteres.');
      return t;
    }
    case 'ind_escala': {
      if (vazio) return null;
      if (bruto !== 'S' && bruto !== 'N') throw new Error('Escala relevante deve ser S, N ou vazio.');
      return bruto;
    }
    case 'cnpj_fabricante': {
      if (vazio) return null;
      const c = digitos(bruto);
      if (!cnpjValido(c)) throw new Error('CNPJ do fabricante inválido.');
      return c;
    }
    case 'grupo_tributario_id':
      return vazio ? null : Number(bruto);
    case 'servico':
    case 'iss_retido':
      return bruto ? 1 : 0;
    case 'cserv_nacional': {
      if (vazio) return null;
      const n = digitos(bruto);
      if (n.length !== 6) throw new Error('Código de tributação nacional (cTribNac) deve ter 6 dígitos.');
      return n;
    }
    case 'cserv_municipal': {
      if (vazio) return null;
      const n = digitos(bruto);
      if (n.length !== 3) throw new Error('Código de tributação municipal (cTribMun) deve ter 3 dígitos (000 = sem código municipal).');
      return n;
    }
    case 'cnbs': {
      if (vazio) return null;
      const n = digitos(bruto);
      if (n.length !== 9) throw new Error('NBS deve ter 9 dígitos.');
      return n;
    }
    case 'aliquota_iss': {
      if (vazio) return null;
      const a = Number(bruto);
      if (!Number.isFinite(a) || a < 0 || a > 100) throw new Error('Alíquota do ISS deve estar entre 0 e 100.');
      return Math.round(a * 100) / 100;
    }
  }
}

async function colunasExistentes(db: any, dbName?: string) {
  const [cols]: any = await db.execute('SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?', [dbName, 'cad_produtos']);
  return new Set<string>(cols.map((c: any) => c.COLUMN_NAME));
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const db = await getDb();
    const dbName = session.dbConfig?.database;
    const existentes = await colunasExistentes(db, dbName);
    const presentes = COLUNAS_FISCAIS.filter((c) => existentes.has(c));

    const [rows]: any = await db.execute(
      `SELECT p.id, p.sku, p.nome, u.sigla AS unidade_sigla${presentes.map((c) => `, p.\`${c}\``).join('')}
         FROM ${dbName}.cad_produtos p
         LEFT JOIN ${dbName}.cad_produtos_unidades_medida u ON u.id = p.unidade_id
        WHERE p.id = ? AND p.grupo_id = ?`,
      [id, grupoDa(session)],
    );
    if (!rows.length) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });
    return NextResponse.json({ produto: rows[0], presentes, ausentes: COLUNAS_FISCAIS.filter((c) => !existentes.has(c)) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const corpo = (await req.json()) || {};
    const db = await getDb();
    const dbName = session.dbConfig?.database;
    const existentes = await colunasExistentes(db, dbName);

    const sets: string[] = [];
    const valores: any[] = [];
    const final: Record<string, any> = {};
    for (const campo of COLUNAS_FISCAIS) {
      if (!existentes.has(campo) || !(campo in corpo)) continue;
      try {
        final[campo] = validar(corpo, campo);
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      sets.push(`\`${campo}\` = ?`);
      valores.push(final[campo]);
    }
    if (!sets.length) return NextResponse.json({ error: 'Nenhum campo para gravar.' }, { status: 400 });

    // Regras entre campos
    if (final.ind_escala === 'N' && existentes.has('cnpj_fabricante') && !final.cnpj_fabricante) {
      return NextResponse.json({ error: 'Escala não relevante (N): informe o CNPJ do fabricante.' }, { status: 400 });
    }
    if (final.grupo_tributario_id) {
      const [g]: any = await db.execute(`SELECT id FROM ${dbName}.fis_grupos_tributarios WHERE id = ? AND ativo = 1`, [final.grupo_tributario_id]);
      if (!g.length) return NextResponse.json({ error: 'Grupo tributário inexistente ou inativo.' }, { status: 400 });
    }
    if (final.cserv_nacional) {
      const [s]: any = await db.execute(`SELECT id FROM ${dbName}.nfs_servicos_nacionais WHERE codigo = ?`, [final.cserv_nacional]);
      if (!s.length) return NextResponse.json({ error: 'Código de tributação nacional não encontrado na lista da LC 116.' }, { status: 400 });
    }

    const [r]: any = await db.execute(`UPDATE ${dbName}.cad_produtos SET ${sets.join(', ')} WHERE id = ? AND grupo_id = ?`, [...valores, id, grupoDa(session)]);
    if (!r.affectedRows) return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
