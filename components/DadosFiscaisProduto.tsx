import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { AvisoErro, NoCanto } from '@/components/AvisoErro';
import { Toggle } from '@/components/Toggle';
import { ComboTabela } from '@/components/ComboTabela';
import { Campo, GradeCampos, INPUT_CLASS, ResumoRegistro, SecaoCrm, TelaCheia } from '@/components/FormCrm';
import { formatNumber, parseBankingInput } from '@/lib/utils';

/**
 * Dados fiscais do produto (tela própria, aberta pela ação "Dados fiscais" da linha): o que a NF-e (bm-nfe)
 * e a NFS-e (bm-nfs) precisam do cadastro. Campos cujas colunas ainda não existem em cad_produtos aparecem
 * desabilitados; o script sugerido está em extras/2026-11-09_dados_fiscais_produtos.sql.
 */

interface Grupo {
  id: number;
  descricao: string;
  origem: string;
  cfop_dentro_uf: string | null;
  cfop_fora_uf: string | null;
  csosn: string | null;
  cst_icms: string | null;
  aliquota_icms: number;
  cst_pis: string;
  aliquota_pis: number;
  cst_cofins: string;
  aliquota_cofins: number;
  cst_ibscbs: string | null;
  cclass_trib: string | null;
}

const ORIGENS: Record<string, string> = {
  '0': '0 - Nacional', '1': '1 - Estrangeira (importação direta)', '2': '2 - Estrangeira (adquirida no mercado interno)',
  '3': '3 - Nacional, importação > 40% e ≤ 70%', '4': '4 - Nacional (processos produtivos básicos)', '5': '5 - Nacional, importação ≤ 40%',
  '6': '6 - Estrangeira, sem similar nacional (importação direta)', '7': '7 - Estrangeira, sem similar nacional (mercado interno)', '8': '8 - Nacional, importação > 70%',
};

const so = (v: string, n: number) => v.replace(/\D/g, '').slice(0, n);

/** GTIN-8/12/13/14 com dígito verificador (módulo 10) */
function gtinOk(g: string) {
  if (![8, 12, 13, 14].includes(g.length)) return false;
  const d = g.split('').map(Number);
  const dv = d.pop()!;
  return (10 - (d.reverse().reduce((s, n, i) => s + n * (i % 2 === 0 ? 3 : 1), 0) % 10)) % 10 === dv;
}

const AVISO_COLUNA = 'Coluna ainda não criada em cad_produtos (veja extras/2026-11-09_dados_fiscais_produtos.sql)';

export const DadosFiscaisProduto: React.FC<{ produtoId: number; onVoltar: () => void }> = ({ produtoId, onVoltar }) => {
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [produto, setProduto] = useState<any>(null);
  const [presentes, setPresentes] = useState<string[]>([]);
  const [ausentes, setAusentes] = useState<string[]>([]);
  const [form, setForm] = useState<Record<string, any>>({});
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [ncmInfo, setNcmInfo] = useState<{ encontrado: boolean; nome?: string; fim_vigencia?: string | null } | null>(null);
  const [cestInfo, setCestInfo] = useState<{ tabela: boolean; candidatos: { cest: string; descricao: string; anexos: string[]; generico?: boolean }[]; escala: boolean } | null>(null);
  const [servicoInfo, setServicoInfo] = useState<{ encontrado: boolean; descricao?: string } | null>(null);

  const tem = (c: string) => presentes.includes(c);
  const set = (c: string, v: any) => {
    setForm((f) => ({ ...f, [c]: v }));
    setErro(null);
  };

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [rf, rg] = await Promise.all([fetch(`/api/produtos/${produtoId}/fiscal`), fetch('/api/fiscal?tipo=grupos')]);
        const f = await rf.json();
        if (!rf.ok) throw new Error(f.error || 'Não foi possível carregar os dados fiscais.');
        if (!vivo) return;
        setProduto(f.produto);
        setPresentes(f.presentes);
        setAusentes(f.ausentes);
        setForm(f.produto);
        if (rg.ok) setGrupos(await rg.json());
      } catch (e: any) {
        if (vivo) setErro(e.message);
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [produtoId]);

  // Descrição oficial do NCM e do serviço, à medida que o código fica completo
  const ncm = so(String(form.ncm ?? ''), 8);
  useEffect(() => {
    if (ncm.length !== 8) return setNcmInfo(null);
    const t = setTimeout(() => fetch(`/api/fiscal?tipo=ncm&codigo=${ncm}`).then((r) => r.json()).then(setNcmInfo).catch(() => setNcmInfo(null)), 250);
    return () => clearTimeout(t);
  }, [ncm]);
  // CEST candidatos ao NCM e se o NCM consta na lista da escala (tabela fis_cest, quando carregada)
  useEffect(() => {
    if (ncm.length !== 8) return setCestInfo(null);
    const t = setTimeout(() => fetch(`/api/fiscal?tipo=cest&codigo=${ncm}`).then((r) => r.json()).then(setCestInfo).catch(() => setCestInfo(null)), 250);
    return () => clearTimeout(t);
  }, [ncm]);
  const cserv = so(String(form.cserv_nacional ?? ''), 6);
  useEffect(() => {
    if (cserv.length !== 6) return setServicoInfo(null);
    const t = setTimeout(() => fetch(`/api/fiscal?tipo=servico&codigo=${cserv}`).then((r) => r.json()).then(setServicoInfo).catch(() => setServicoInfo(null)), 250);
    return () => clearTimeout(t);
  }, [cserv]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const grupo = useMemo(() => grupos.find((g) => String(g.id) === String(form.grupo_tributario_id ?? '')), [grupos, form.grupo_tributario_id]);
  const gtin = so(String(form.codigo_barras ?? ''), 14);

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    try {
      const corpo: Record<string, any> = {};
      for (const c of presentes) corpo[c] = form[c] ?? null;
      const r = await fetch(`/api/produtos/${produtoId}/fiscal`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Não foi possível gravar os dados fiscais.');
      setToast('Dados fiscais salvos.');
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800">
        <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
      </div>
    );
  }

  const dica = (c: string) => (tem(c) ? undefined : AVISO_COLUNA);
  const campoTexto = (c: string, rotulo: string, tamanho: number, extra?: { span?: 1 | 2 | 3 | 4; hint?: string; mono?: boolean }) => (
    <Campo rotulo={rotulo} span={extra?.span} dica={extra?.hint}>
      <input
        type="text"
        inputMode="numeric"
        value={form[c] ?? ''}
        disabled={!tem(c)}
        title={dica(c)}
        maxLength={tamanho}
        onChange={(e) => set(c, so(e.target.value, tamanho))}
        onFocus={(e) => e.target.select()}
        className={INPUT_CLASS + (extra?.mono === false ? '' : ' font-mono') + (tem(c) ? '' : ' opacity-50 cursor-not-allowed')}
      />
    </Campo>
  );

  return (
    <TelaCheia
      rodape={'Produto #' + produtoId + ' • Dados fiscais'}
      onVoltar={onVoltar}
      onSubmit={salvar}
      rotuloPrincipal="Salvar"
      iconePrincipal={<Save className="w-4 h-4" />}
      salvando={salvando}
    >
      {erro && <AvisoErro mensagem={erro} onFechar={() => setErro(null)} />}

      {ausentes.length > 0 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
          <b>Faltam colunas em cad_produtos</b> para alguns campos desta tela ({ausentes.join(', ')}). Eles aparecem desabilitados. Rode o script{' '}
          <span className="font-mono">extras/2026-11-09_dados_fiscais_produtos.sql</span> (ou só o bloco que precisar) para habilitá-los.
        </div>
      )}

      <ResumoRegistro titulo="Dados fiscais do produto" nome={produto?.nome} sku={produto?.sku} id={produto?.id} />

      <SecaoCrm titulo="Identificação na nota">
        <GradeCampos>
          <Campo rotulo="Código interno (cProd)">
            <input type="text" value={produto?.sku ?? ''} disabled className={INPUT_CLASS + ' font-mono opacity-60'} />
          </Campo>
          <Campo rotulo="Unidade comercial (uCom)">
            <input type="text" value={produto?.unidade_sigla ?? ''} disabled className={INPUT_CLASS + ' opacity-60'} />
          </Campo>
          <Campo
            rotulo="Código de barras (GTIN)"
            span={2}
            dica={gtin ? (gtinOk(gtin) ? 'GTIN válido.' : 'GTIN inválido: 8, 12, 13 ou 14 dígitos com o dígito verificador. Em branco, a nota sai "SEM GTIN".') : 'Em branco, a nota sai "SEM GTIN".'}
          >
            <input
              type="text"
              inputMode="numeric"
              value={form.codigo_barras ?? ''}
              maxLength={14}
              onChange={(e) => set('codigo_barras', so(e.target.value, 14))}
              onFocus={(e) => e.target.select()}
              className={INPUT_CLASS + ' font-mono'}
            />
          </Campo>
        </GradeCampos>
      </SecaoCrm>

      <SecaoCrm titulo="Classificação fiscal">
        <GradeCampos>
          <Campo
            rotulo="NCM *"
            span={2}
            dica={
              !tem('ncm')
                ? AVISO_COLUNA
                : ncm.length === 8 && ncmInfo && !ncmInfo.encontrado
                ? 'NCM fora da tabela fiscal (fis_ncm): escolha um da lista.'
                : ncm.length === 8 && ncmInfo?.fim_vigencia
                ? 'Vigente até ' + ncmInfo.fim_vigencia.slice(0, 10).split('-').reverse().join('/') + '.'
                : 'Escolha na lista (código ou parte da descrição).'
            }
          >
            <ComboTabela tabela="ncm" value={form.ncm} onChange={(v) => set('ncm', v)} disabled={!tem('ncm')} required />
          </Campo>
          <Campo
            rotulo="CEST"
            span={2}
            dica={
              !tem('cest')
                ? AVISO_COLUNA
                : cestInfo && !cestInfo.tabela
                ? 'Tabela fis_cest ainda não carregada (extras/2026-11-09_fis_cest.sql e scripts/carregar-cest.ts).'
                : ncm.length === 8 && cestInfo && cestInfo.candidatos.filter((c) => !c.generico).length === 0
                ? cestInfo.candidatos.length
                  ? 'Sem CEST específico para este NCM no Conv. ICMS 142/18 (há só itens genéricos por capítulo, que costumam não se aplicar): informe só se o seu cadastro tiver um.'
                  : 'Nenhum CEST do Conv. ICMS 142/18 para este NCM: informe só se o seu cadastro tiver um.'
                : 'Obrigatório nos itens com substituição tributária. A lista já traz os CEST do NCM; digite para pesquisar os demais.'
            }
          >
            <ComboTabela tabela="cest" value={form.cest} onChange={(v) => set('cest', v)} disabled={!tem('cest')} extra={ncm.length === 8 ? { ncm } : undefined} sugerirAoAbrir={ncm.length === 8} />
          </Campo>
          {campoTexto('ex_tipi', 'EX da TIPI', 3)}
          <Campo rotulo="Benefício fiscal (cBenef)" dica={dica('cbenef') ?? 'Exigido por algumas UFs.'}>
            <input
              type="text"
              value={form.cbenef ?? ''}
              disabled={!tem('cbenef')}
              maxLength={10}
              onChange={(e) => set('cbenef', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              onFocus={(e) => e.target.select()}
              className={INPUT_CLASS + ' font-mono' + (tem('cbenef') ? '' : ' opacity-50 cursor-not-allowed')}
            />
          </Campo>
          <Campo rotulo="Escala relevante" dica={dica('ind_escala') ?? (cestInfo?.escala ? 'Este NCM consta no Anexo XXVII do Conv. ICMS 142/18 (escala industrial não relevante): informe S ou N. Em N, o CNPJ do fabricante é obrigatório.' : 'Obrigatório quando o NCM consta no Anexo XXVII do Conv. ICMS 142/18.')}>
            <select
              value={form.ind_escala ?? ''}
              disabled={!tem('ind_escala')}
              onChange={(e) => set('ind_escala', e.target.value || null)}
              className={INPUT_CLASS + (tem('ind_escala') ? '' : ' opacity-50 cursor-not-allowed')}
            >
              <option value="">Não informar</option>
              <option value="S">Sim (S)</option>
              <option value="N">Não (N)</option>
            </select>
          </Campo>
          {campoTexto('cnpj_fabricante', 'CNPJ do fabricante', 14, { hint: form.ind_escala === 'N' ? 'Obrigatório: escala não relevante.' : undefined })}
        </GradeCampos>
      </SecaoCrm>

      <SecaoCrm titulo="Tributação">
        <GradeCampos>
          <Campo rotulo="Grupo tributário" span={2} dica="Origem, CFOP, ICMS/CSOSN, PIS, COFINS e IBS/CBS vêm do grupo (cadastro fis_grupos_tributarios).">
            <select
              value={form.grupo_tributario_id ?? ''}
              disabled={!tem('grupo_tributario_id')}
              onChange={(e) => set('grupo_tributario_id', e.target.value ? Number(e.target.value) : null)}
              className={INPUT_CLASS}
            >
              <option value="">Sem grupo (usa o padrão da emissão)</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.descricao}
                </option>
              ))}
            </select>
          </Campo>
        </GradeCampos>
        {grupo && (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ['Origem', ORIGENS[grupo.origem] ?? grupo.origem],
              ['CFOP dentro / fora da UF', (grupo.cfop_dentro_uf || '—') + ' / ' + (grupo.cfop_fora_uf || '—')],
              ['CSOSN / CST ICMS', (grupo.csosn || '—') + ' / ' + (grupo.cst_icms || '—')],
              ['Alíquota ICMS', formatNumber(grupo.aliquota_icms, 2) + '%'],
              ['PIS (CST • alíquota)', grupo.cst_pis + ' • ' + formatNumber(grupo.aliquota_pis, 2) + '%'],
              ['COFINS (CST • alíquota)', grupo.cst_cofins + ' • ' + formatNumber(grupo.aliquota_cofins, 2) + '%'],
              ['CST IBS/CBS', grupo.cst_ibscbs || '—'],
              ['cClassTrib', grupo.cclass_trib || '—'],
            ].map(([rotulo, valor]) => (
              <div key={rotulo} className="rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950/40 px-3 py-2">
                <div className="text-[10px] text-stone-500 dark:text-stone-400">{rotulo}</div>
                <div className="text-xs font-mono text-stone-800 dark:text-stone-200">{valor}</div>
              </div>
            ))}
          </div>
        )}
      </SecaoCrm>

      <SecaoCrm titulo="Serviço (NFS-e)">
        <GradeCampos>
          <Campo rotulo="É serviço" dica={dica('servico')}>
            <Toggle checked={Boolean(form.servico)} onChange={(v) => set('servico', v ? 1 : 0)} disabled={!tem('servico')} />
          </Campo>
          <Campo
            rotulo="Código de tributação nacional (cTribNac)"
            span={3}
            dica={!tem('cserv_nacional') ? AVISO_COLUNA : 'Item, subitem e desdobro da LC 116: escolha na lista (código ou parte da descrição).'}
          >
            <ComboTabela tabela="servico" value={form.cserv_nacional} onChange={(v) => set('cserv_nacional', v)} disabled={!tem('cserv_nacional')} />
          </Campo>
          {campoTexto('cserv_municipal', 'Código municipal (cTribMun)', 3, { hint: '000 = sem código municipal' })}
          <Campo
            rotulo="NBS (cNBS)"
            span={2}
            dica={!tem('cnbs') ? AVISO_COLUNA : cserv.length === 6 ? 'Só as NBS aceitas para o serviço escolhido (Anexo VIII).' : 'Escolha antes o serviço (cTribNac) para ver só as NBS que correspondem a ele.'}
          >
            <ComboTabela tabela="nbs" value={form.cnbs} onChange={(v) => set('cnbs', v)} disabled={!tem('cnbs')} extra={cserv.length === 6 ? { item: cserv.slice(0, 4) } : undefined} sugerirAoAbrir />
          </Campo>
          <Campo rotulo="Alíquota do ISS (%)" dica={dica('aliquota_iss') ?? 'Em branco, vale a do município.'}>
            <input
              type="text"
              inputMode="numeric"
              value={form.aliquota_iss === null || form.aliquota_iss === undefined || form.aliquota_iss === '' ? '' : formatNumber(Number(form.aliquota_iss), 2)}
              disabled={!tem('aliquota_iss')}
              onChange={(e) => set('aliquota_iss', e.target.value.replace(/\D/g, '') === '' ? null : parseBankingInput(e.target.value, 2))}
              onFocus={(e) => e.target.select()}
              className={INPUT_CLASS + ' font-mono' + (tem('aliquota_iss') ? '' : ' opacity-50 cursor-not-allowed')}
            />
          </Campo>
          <Campo rotulo="ISS retido" dica={dica('iss_retido')}>
            <Toggle checked={Boolean(form.iss_retido)} onChange={(v) => set('iss_retido', v ? 1 : 0)} disabled={!tem('iss_retido')} />
          </Campo>
        </GradeCampos>
      </SecaoCrm>

      {toast && (
        <NoCanto>
          <div role="status" className="pointer-events-auto p-3 rounded-xl shadow-2xl border text-xs bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300">
            {toast}
          </div>
        </NoCanto>
      )}
    </TelaCheia>
  );
};
