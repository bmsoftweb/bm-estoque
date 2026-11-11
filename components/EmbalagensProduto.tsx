import React, { useEffect, useState } from 'react';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { AvisoErro, NoCanto } from '@/components/AvisoErro';
import { Toggle } from '@/components/Toggle';
import { NumberField } from '@/components/NumberField';
import { INPUT_CLASS, ResumoRegistro, SecaoCrm, TelaCheia } from '@/components/FormCrm';
import { gtinValido } from '@/lib/gtin';
import { formatNumber } from '@/lib/utils';

/**
 * Embalagens do produto (fardo, caixa…): o produto continua um só e o estoque fica na unidade menor.
 * 1 embalagem = `fator` unidades. Tabela cad_produtos_embalagens (extras/2026-11-10_embalagens.sql).
 */

interface Linha {
  id?: number;
  sigla: string;
  descricao: string;
  fator: string;
  codigoBarras: string;
  preco: string;
  ativo: boolean;
}

const moeda = (v: number) => 'R$ ' + formatNumber(v, 2);
const s = (v: any) => (v === null || v === undefined ? '' : String(v));

export const EmbalagensProduto: React.FC<{ produtoId: number; onVoltar: () => void }> = ({ produtoId, onVoltar }) => {
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [produto, setProduto] = useState<any>(null);
  const [semTabela, setSemTabela] = useState(false);
  const [linhas, setLinhas] = useState<Linha[]>([]);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/produtos/${produtoId}/embalagens`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Não foi possível carregar as embalagens.');
        if (!vivo) return;
        setProduto(d.produto);
        setSemTabela(d.semTabela);
        setLinhas(d.embalagens.map((e: any): Linha => ({ id: e.id, sigla: e.sigla, descricao: e.descricao, fator: s(e.fator), codigoBarras: s(e.codigoBarras), preco: s(e.preco), ativo: e.ativo })));
      })
      .catch((e) => vivo && setErro(e.message))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [produtoId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const set = (i: number, p: Partial<Linha>) => setLinhas((l) => l.map((x, k) => (k === i ? { ...x, ...p } : x)));

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    try {
      const corpo = {
        embalagens: linhas.map((l) => ({ id: l.id, sigla: l.sigla, descricao: l.descricao, fator: Number(l.fator), codigoBarras: l.codigoBarras, preco: l.preco === '' ? null : Number(l.preco), ativo: l.ativo })),
      };
      const r = await fetch(`/api/produtos/${produtoId}/embalagens`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Não foi possível gravar as embalagens.');
      setToast('Embalagens salvas.');
      // Recarrega para pegar os ids das novas
      const r2 = await fetch(`/api/produtos/${produtoId}/embalagens`);
      const d2 = await r2.json();
      if (r2.ok) setLinhas(d2.embalagens.map((e: any): Linha => ({ id: e.id, sigla: e.sigla, descricao: e.descricao, fator: s(e.fator), codigoBarras: s(e.codigoBarras), preco: s(e.preco), ativo: e.ativo })));
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

  const base = Number(produto?.preco_venda ?? 0);
  const un = produto?.unidade_sigla || 'UN';
  const rotulo = 'text-xs font-semibold text-stone-500 dark:text-stone-400';

  return (
    <TelaCheia
      larga
      rodape={'Produto #' + produtoId + ' • Embalagens'}
      onVoltar={onVoltar}
      onSubmit={salvar}
      rotuloPrincipal="Salvar"
      iconePrincipal={<Save className="w-4 h-4" />}
      salvando={salvando}
    >
      {erro && <AvisoErro mensagem={erro} onFechar={() => setErro(null)} />}

      {semTabela && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
          <b>A tabela de embalagens ainda não existe no banco.</b> Rode o script <span className="font-mono">extras/2026-11-10_embalagens.sql</span> no banco do ERP e abra esta tela de novo.
        </div>
      )}

      <ResumoRegistro titulo="Embalagens do produto" nome={produto?.nome} sku={produto?.sku} id={produto?.id} />
      <p className="text-xs text-stone-500 dark:text-stone-400">
        O estoque e o preço base ficam na unidade do produto ({un}, {moeda(base)}). Cada embalagem diz quantas unidades ela traz: vender 2 fardos de 12 baixa 24 do estoque.
        Bipar o código de barras da embalagem no caixa já escolhe a embalagem.
      </p>

      <SecaoCrm
        titulo="Embalagens"
        direita={
          !semTabela && (
            <button type="button" onClick={() => setLinhas((l) => [...l, { sigla: 'CX', descricao: '', fator: '', codigoBarras: '', preco: '', ativo: true }])} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer">
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar</span>
            </button>
          )
        }
      >
        {linhas.length === 0 ? (
          <p className="text-xs text-stone-500 dark:text-stone-400">Nenhuma embalagem: o produto só é vendido em {un}.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {linhas.map((l, i) => {
              const fator = Number(l.fator);
              const gtin = l.codigoBarras.replace(/\D/g, '');
              const padrao = fator > 0 ? base * fator : 0;
              return (
                <div key={l.id ?? 'n' + i} className={'rounded-lg border p-3 ' + (l.ativo ? 'border-stone-200 dark:border-stone-800' : 'border-stone-200 dark:border-stone-800 opacity-60')}>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                    <div className="sm:col-span-1">
                      <label className={rotulo}>Sigla *</label>
                      <input required maxLength={6} value={l.sigla} onChange={(e) => set(i, { sigla: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} onFocus={(e) => e.target.select()} className={INPUT_CLASS + ' mt-1 font-mono'} />
                    </div>
                    <div className="sm:col-span-3">
                      <label className={rotulo}>Descrição *</label>
                      <input required maxLength={60} value={l.descricao} placeholder="Ex.: Fardo com 12" onChange={(e) => set(i, { descricao: e.target.value })} onFocus={(e) => e.target.select()} className={INPUT_CLASS + ' mt-1'} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={rotulo}>Unidades na embalagem *</label>
                      <div className="mt-1">
                        <NumberField required value={l.fator} onChange={(v) => set(i, { fator: v })} scale={4} className={INPUT_CLASS} />
                      </div>
                    </div>
                    <div className="sm:col-span-3">
                      <label className={rotulo}>Código de barras da embalagem</label>
                      <input inputMode="numeric" maxLength={14} value={l.codigoBarras} onChange={(e) => set(i, { codigoBarras: e.target.value.replace(/\D/g, '').slice(0, 14) })} onFocus={(e) => e.target.select()} className={INPUT_CLASS + ' mt-1 font-mono'} />
                      <p className="mt-1 text-[11px] text-stone-400 dark:text-stone-500">{gtin ? (gtinValido(gtin) ? 'GTIN válido.' : 'GTIN inválido: confira o dígito verificador.') : 'DUN-14 da caixa (opcional).'}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <label className={rotulo}>Preço da embalagem</label>
                      <div className="mt-1">
                        <NumberField placeholder={padrao > 0 ? moeda(padrao) : 'Fator × base'} value={l.preco} onChange={(v) => set(i, { preco: v })} scale={2} className={INPUT_CLASS} />
                      </div>
                      <p className="mt-1 text-[11px] text-stone-400 dark:text-stone-500">Vazio = fator × preço base.</p>
                    </div>
                    <div className="sm:col-span-1 flex sm:justify-end gap-1 pt-5">
                      <button type="button" title="Remover" onClick={() => setLinhas((x) => x.filter((_, k) => k !== i))} className="p-2 rounded text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-stone-500 dark:text-stone-400">
                    <span>
                      {fator > 0 ? (
                        <>
                          1 {l.sigla || '?'} = {formatNumber(fator, fator % 1 ? 4 : 0)} {un} • vende por {l.preco !== '' ? moeda(Number(l.preco)) : moeda(padrao) + ' (fator × base)'}
                          {l.preco !== '' && padrao > 0 && <> • {formatNumber(((Number(l.preco) - padrao) / padrao) * 100, 2)}% sobre {formatNumber(fator, 0)} × {moeda(base)}</>}
                        </>
                      ) : (
                        'Informe quantas unidades a embalagem traz.'
                      )}
                    </span>
                    <Toggle size="sm" checked={l.ativo} onChange={(v) => set(i, { ativo: v })} label="Ativa" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SecaoCrm>

      {toast && (
        <NoCanto>
          <div role="status" className="pointer-events-auto p-3 rounded-xl shadow-2xl border text-xs bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300">{toast}</div>
        </NoCanto>
      )}
    </TelaCheia>
  );
};
