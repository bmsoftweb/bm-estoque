import React, { useCallback, useEffect, useState } from 'react';
import { useRefreshDaTela } from '@/components/LayoutApp';
import { BadgeCheck, Calculator, Loader2, Pencil, Plus, Save, Search, Trash2, X } from 'lucide-react';
import { ListaCrm } from '@/components/ListaCrm';
import { BotaoAcao } from '@/components/MenuAcoes';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AvisoErro, NoCanto } from '@/components/AvisoErro';
import { Toggle } from '@/components/Toggle';
import { NumberField } from '@/components/NumberField';
import { DateField } from '@/components/DateField';
import { SelecaoMultipla, type Opcao } from '@/components/SelecaoMultipla';
import { ModalPesquisa } from '@/components/ModalPesquisa';
import { Campo, GradeCampos, INPUT_CLASS, SecaoCrm, TelaCheia } from '@/components/FormCrm';
import { useRouter } from '@/lib/nav';
import { formatNumber } from '@/lib/utils';

/** Listas de preço: cadastro (critérios, faixas, itens) e simulador. Regra de escolha em lib/precos.ts. */

const UFS: Opcao[] = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ').map((u) => ({ valor: u, rotulo: u }));
const CANAIS: Opcao[] = ['Balcão', 'Representante', 'Telefone', 'E-commerce'].map((c) => ({ valor: c, rotulo: c }));
const ROTULO_CRITERIO: Record<string, string> = { tipo_cliente: 'Tipo', cidade: 'Cidade', uf: 'UF', regiao: 'Região', vendedor: 'Vendedor', cliente: 'Cliente', canal: 'Canal' };

interface ItemForm {
  escopo: 'variante' | 'produto' | 'marca' | 'categoria';
  escopoId: string;
  tipo: 'preco' | 'percentual';
  valor: string;
}
interface FormLista {
  id: number | null;
  nome: string;
  descricao: string;
  prioridade: string;
  ativo: boolean;
  criterios: Record<string, string[]>;
  vigenciaInicio: string;
  vigenciaFim: string;
  qtdMin: string;
  qtdMax: string;
  valorPedidoMin: string;
  valorPedidoMax: string;
  prazoMin: string;
  prazoMax: string;
  ajustePercentual: string;
  itens: ItemForm[];
}

const vazio = (): FormLista => ({
  id: null, nome: '', descricao: '', prioridade: '100', ativo: true, criterios: {}, vigenciaInicio: '', vigenciaFim: '',
  qtdMin: '', qtdMax: '', valorPedidoMin: '', valorPedidoMax: '', prazoMin: '', prazoMax: '', ajustePercentual: '', itens: [],
});

const s = (v: any) => (v === null || v === undefined ? '' : String(v));
const paraForm = (l: any): FormLista => ({
  id: l.id, nome: l.nome, descricao: s(l.descricao), prioridade: s(l.prioridade), ativo: Boolean(l.ativo), criterios: l.criterios ?? {},
  vigenciaInicio: s(l.vigenciaInicio), vigenciaFim: s(l.vigenciaFim), qtdMin: s(l.qtdMin), qtdMax: s(l.qtdMax),
  valorPedidoMin: s(l.valorPedidoMin), valorPedidoMax: s(l.valorPedidoMax), prazoMin: s(l.prazoMin), prazoMax: s(l.prazoMax),
  ajustePercentual: s(l.ajustePercentual), itens: (l.itens ?? []).map((i: any) => ({ escopo: i.escopo, escopoId: s(i.escopoId), tipo: i.tipo, valor: s(i.valor) })),
});
const n = (v: string) => (v === '' ? null : Number(v));
const paraCorpo = (f: FormLista) => ({
  nome: f.nome, descricao: f.descricao, prioridade: Number(f.prioridade || 100), ativo: f.ativo, criterios: f.criterios,
  vigenciaInicio: f.vigenciaInicio || null, vigenciaFim: f.vigenciaFim || null,
  qtdMin: n(f.qtdMin), qtdMax: n(f.qtdMax), valorPedidoMin: n(f.valorPedidoMin), valorPedidoMax: n(f.valorPedidoMax),
  prazoMin: n(f.prazoMin), prazoMax: n(f.prazoMax), ajustePercentual: n(f.ajustePercentual),
  itens: f.itens.map((i) => ({ escopo: i.escopo, escopoId: Number(i.escopoId), tipo: i.tipo, valor: Number(i.valor || 0) })),
});

/** aaaa-mm-dd -> dd/mm/aaaa */
const br = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');

function resumoCriterios(l: any): string {
  const partes = Object.entries(l.criterios ?? {}).map(([k, v]) => `${ROTULO_CRITERIO[k] ?? k}: ${v}`);
  if (l.qtdMin != null || l.qtdMax != null) partes.push('Qtd ' + (l.qtdMin != null ? '≥ ' + formatNumber(l.qtdMin, 0) : '') + (l.qtdMax != null ? ' ≤ ' + formatNumber(l.qtdMax, 0) : ''));
  return partes.join(' · ') || 'Qualquer venda';
}

export default function PrecosPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [listas, setListas] = useState<any[]>([]);
  const [semTabelas, setSemTabelas] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [modo, setModo] = useState<'lista' | 'form' | 'simulador'>('lista');
  const [form, setForm] = useState<FormLista>(vazio());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<any | null>(null);
  const [removendoItem, setRemovendoItem] = useState<number | null>(null);
  const [escolhendo, setEscolhendo] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [u, l] = await Promise.all([fetch('/api/user'), fetch('/api/precos/listas')]);
      if (!u.ok) return router.push('/');
      setUser(await u.json());
      const d = await l.json();
      if (!l.ok) throw new Error(d.error || 'Não foi possível carregar as listas.');
      setListas(d.listas);
      setSemTabelas(d.semTabelas);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [router]);
  useEffect(() => {
    carregar();
  }, [carregar]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const novo = () => {
    setForm(vazio());
    setErro(null);
    setModo('form');
  };
  const editar = async (l: any) => {
    setErro(null);
    try {
      const r = await fetch(`/api/precos/listas/${l.id}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Não foi possível abrir a lista.');
      setForm(paraForm(d));
      setModo('form');
    } catch (e: any) {
      setErro(e.message);
    }
  };

  const salvar = async () => {
    if (form.itens.some((i) => !i.escopoId)) return setErro('Há um item sem variante, produto, marca ou categoria escolhido.');
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch(form.id ? `/api/precos/listas/${form.id}` : '/api/precos/listas', { method: form.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(paraCorpo(form)) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Não foi possível salvar a lista.');
      setToast('Lista salva.');
      setModo('lista');
      carregar();
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async () => {
    const l = excluindo;
    setExcluindo(null);
    try {
      const r = await fetch(`/api/precos/listas/${l.id}`, { method: 'DELETE' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Não foi possível excluir a lista.');
      carregar();
    } catch (e: any) {
      setErro(e.message);
    }
  };

  const set = <K extends keyof FormLista>(k: K, v: FormLista[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setCrit = (campo: string, v: string[]) => setForm((f) => ({ ...f, criterios: { ...f.criterios, [campo]: v } }));
  const setItem = (i: number, p: Partial<ItemForm>) => setForm((f) => ({ ...f, itens: f.itens.map((x, k) => (k === i ? { ...x, ...p } : x)) }));

  useRefreshDaTela(carregar);

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0">
      <div className="flex-1 flex flex-col min-h-0 min-w-0 relative">

        <div className="w-full flex-1 min-h-0 overflow-y-auto flex flex-col">
          {modo === 'lista' && (
            <>
              {semTabelas && (
                <div className="mx-4 mt-4 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
                  <b>As tabelas de listas de preço ainda não existem no banco.</b> Rode o script <span className="font-mono">extras/2026-11-09_listas_de_preco.sql</span> no banco do ERP; depois volte aqui e atualize a tela.
                </div>
              )}
              <ListaCrm
                id="listas_preco"
                className="flex-1"
                chave={(l: any) => l.id}
                linhas={listas}
                carregando={carregando}
                vazio="Nenhuma lista de preço cadastrada: todas as vendas saem no preço base."
                onEditar={editar}
                onNovo={semTabelas ? undefined : novo}
                rotuloNovo="Nova lista"
                barraExtra={
                  <button type="button" onClick={() => setModo('simulador')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-stone-300 text-stone-600 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800 transition-colors cursor-pointer shrink-0 whitespace-nowrap">
                    <Calculator className="w-3.5 h-3.5" />
                    <span>Simulador</span>
                  </button>
                }
                colunas={[
                  { key: 'prioridade', label: 'Prioridade', alinhar: 'numero', largura: 110 },
                  { key: 'nome', label: 'Nome', largura: 240, render: (l: any) => <span className="font-semibold">{l.nome}</span> },
                  { key: 'criterios', label: 'Quando vale', largura: 380, render: (l: any) => resumoCriterios(l) },
                  { key: 'vigencia', label: 'Vigência', alinhar: 'centro', largura: 190, render: (l: any) => (l.vigenciaInicio || l.vigenciaFim ? `${br(l.vigenciaInicio) || '…'} a ${br(l.vigenciaFim) || '…'}` : 'Sempre') },
                  { key: 'ajustePercentual', label: 'Ajuste padrão', alinhar: 'numero', largura: 130, render: (l: any) => (l.ajustePercentual == null ? '—' : formatNumber(l.ajustePercentual, 2) + '%') },
                  { key: 'qtdItens', label: 'Itens', alinhar: 'numero', largura: 80 },
                  { key: 'ativo', label: 'Ativa', alinhar: 'centro', largura: 80, render: (l: any) => <span className={(l.ativo ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400') + ' font-medium'}>{l.ativo ? 'Sim' : 'Não'}</span> },
                ]}
                acoes={(l: any) => (
                  <>
                    <BotaoAcao icone={Pencil} titulo="Editar" descricao="Abre a lista para edição" onClick={() => editar(l)} />
                    <BotaoAcao icone={Trash2} titulo="Excluir" descricao="Apaga a lista (pede confirmação)" tom="perigo" onClick={() => setExcluindo(l)} />
                  </>
                )}
              />
            </>
          )}

          {modo === 'form' && (
            <TelaCheia
              larga
              rodape={form.id ? `Lista #${form.id}` : 'Inclusão'}
              rotuloVoltar="Cancelar"
              onVoltar={() => setModo('lista')}
              onSubmit={salvar}
              rotuloPrincipal="Salvar"
              iconePrincipal={<Save className="w-4 h-4" />}
              salvando={salvando}
            >
              {erro && <AvisoErro mensagem={erro} onFechar={() => setErro(null)} />}

              <SecaoCrm titulo="Lista">
                <GradeCampos>
                  <Campo rotulo="Nome *" span={2}>
                    <input autoFocus required value={form.nome} maxLength={80} onChange={(e) => set('nome', e.target.value)} onFocus={(e) => e.target.select()} className={INPUT_CLASS} />
                  </Campo>
                  <Campo rotulo="Prioridade" dica="Menor vale primeiro quando duas listas servem.">
                    <NumberField value={form.prioridade} onChange={(v) => set('prioridade', v)} scale={0} allowNegative className={INPUT_CLASS} />
                  </Campo>
                  <Campo rotulo="Ativa">
                    <Toggle checked={form.ativo} onChange={(v) => set('ativo', v)} />
                  </Campo>
                  <Campo rotulo="Descrição" span={4}>
                    <input value={form.descricao} maxLength={255} onChange={(e) => set('descricao', e.target.value)} className={INPUT_CLASS} />
                  </Campo>
                </GradeCampos>
              </SecaoCrm>

              <SecaoCrm titulo="Quando usar: critérios (vazio = qualquer)">
                <p className="mb-3 text-[11px] text-stone-500 dark:text-stone-400">
                  Dentro de um critério basta um dos valores (cidade A <b>ou</b> B). Entre critérios, todos precisam bater (região <b>e</b> vendedor).
                </p>
                <GradeCampos>
                  <Campo rotulo="Tipo de cliente" span={2}>
                    <SelecaoMultipla tipo="tipo_cliente" value={form.criterios.tipo_cliente ?? []} onChange={(v) => setCrit('tipo_cliente', v)} />
                  </Campo>
                  <Campo rotulo="Região do cliente" span={2}>
                    <SelecaoMultipla tipo="regiao" value={form.criterios.regiao ?? []} onChange={(v) => setCrit('regiao', v)} />
                  </Campo>
                  <Campo rotulo="Cidade" span={2}>
                    <SelecaoMultipla tipo="cidade" value={form.criterios.cidade ?? []} onChange={(v) => setCrit('cidade', v)} />
                  </Campo>
                  <Campo rotulo="UF" span={2}>
                    <SelecaoMultipla fixas={UFS} value={form.criterios.uf ?? []} onChange={(v) => setCrit('uf', v)} />
                  </Campo>
                  <Campo rotulo="Vendedor" span={2}>
                    <SelecaoMultipla tipo="vendedor" value={form.criterios.vendedor ?? []} onChange={(v) => setCrit('vendedor', v)} />
                  </Campo>
                  <Campo rotulo="Cliente específico" span={2}>
                    <SelecaoMultipla tipo="cliente" value={form.criterios.cliente ?? []} onChange={(v) => setCrit('cliente', v)} />
                  </Campo>
                  <Campo rotulo="Canal de venda" span={2} dica="Escolha ou digite um canal e tecle Enter.">
                    <SelecaoMultipla livre value={form.criterios.canal ?? []} onChange={(v) => setCrit('canal', v)} placeholder={'Ex.: ' + CANAIS.map((c) => c.rotulo).join(', ') + '…'} />
                  </Campo>
                </GradeCampos>
              </SecaoCrm>

              <SecaoCrm titulo="Faixas e vigência (vazio = sem limite)">
                <GradeCampos>
                  <Campo rotulo="Quantidade mínima do item">
                    <NumberField placeholder="Sem limite" value={form.qtdMin} onChange={(v) => set('qtdMin', v)} scale={4} className={INPUT_CLASS} />
                  </Campo>
                  <Campo rotulo="Quantidade máxima do item">
                    <NumberField placeholder="Sem limite" value={form.qtdMax} onChange={(v) => set('qtdMax', v)} scale={4} className={INPUT_CLASS} />
                  </Campo>
                  <Campo rotulo="Valor do pedido mínimo">
                    <NumberField placeholder="Sem limite" value={form.valorPedidoMin} onChange={(v) => set('valorPedidoMin', v)} scale={2} className={INPUT_CLASS} />
                  </Campo>
                  <Campo rotulo="Valor do pedido máximo">
                    <NumberField placeholder="Sem limite" value={form.valorPedidoMax} onChange={(v) => set('valorPedidoMax', v)} scale={2} className={INPUT_CLASS} />
                  </Campo>
                  <Campo rotulo="Prazo médio mínimo (dias)">
                    <NumberField placeholder="Sem limite" value={form.prazoMin} onChange={(v) => set('prazoMin', v)} scale={0} className={INPUT_CLASS} />
                  </Campo>
                  <Campo rotulo="Prazo médio máximo (dias)">
                    <NumberField placeholder="Sem limite" value={form.prazoMax} onChange={(v) => set('prazoMax', v)} scale={0} className={INPUT_CLASS} />
                  </Campo>
                  <Campo rotulo="Vigência: início">
                    <DateField value={form.vigenciaInicio} onChange={(v) => set('vigenciaInicio', v)} className={INPUT_CLASS} />
                  </Campo>
                  <Campo rotulo="Vigência: fim">
                    <DateField value={form.vigenciaFim} onChange={(v) => set('vigenciaFim', v)} className={INPUT_CLASS} />
                  </Campo>
                </GradeCampos>
              </SecaoCrm>

              <SecaoCrm titulo="Preço">
                <GradeCampos>
                  <Campo rotulo="Ajuste padrão sobre o preço base (%)" span={2} dica="-10 = 10% abaixo do base; 5 = 5% acima. Em branco, a lista só vale para os itens abaixo.">
                    <NumberField placeholder="Sem ajuste padrão" value={form.ajustePercentual} onChange={(v) => set('ajustePercentual', v)} scale={2} allowNegative className={INPUT_CLASS} />
                  </Campo>
                </GradeCampos>
              </SecaoCrm>

              <SecaoCrm
                titulo="Exceções: variante, produto, marca ou categoria (valem sobre o ajuste padrão)"
                direita={
                  <button type="button" onClick={() => {
                    set('itens', [...form.itens, { escopo: 'produto', escopoId: '', tipo: 'percentual', valor: '' }]);
                    setTimeout(() => document.querySelector<HTMLSelectElement>(`[data-vale-para="${form.itens.length}"]`)?.focus());
                  }} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer">
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar</span>
                  </button>
                }
              >
                {form.itens.length === 0 ? (
                  <p className="text-xs text-stone-500 dark:text-stone-400">Nenhuma exceção: vale só o ajuste padrão.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-stone-200 dark:border-stone-800">
                    <table className="w-full text-xs border-separate border-spacing-0">
                      <thead>
                        <tr>
                          <th className="px-3 py-2.5 text-center font-semibold text-stone-600 dark:text-stone-300 whitespace-nowrap border-b border-r border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 w-36">Vale para</th>
                          <th className="px-3 py-2.5 text-center font-semibold text-stone-600 dark:text-stone-300 whitespace-nowrap border-b border-r border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950">Produto, variante, marca ou categoria</th>
                          <th className="px-3 py-2.5 text-center font-semibold text-stone-600 dark:text-stone-300 whitespace-nowrap border-b border-r border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 w-28">Preço atual</th>
                          <th className="px-3 py-2.5 text-center font-semibold text-stone-600 dark:text-stone-300 whitespace-nowrap border-b border-r border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 w-36">Preço</th>
                          <th className="px-3 py-2.5 text-center font-semibold text-stone-600 dark:text-stone-300 whitespace-nowrap border-b border-r border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 w-36">Valor</th>
                          <th className="px-3 py-2.5 text-center font-semibold text-stone-600 dark:text-stone-300 whitespace-nowrap border-b border-r border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 w-16 border-r-0">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.itens.map((it, i) => (
                          <tr key={i} className="bg-white dark:bg-stone-900">
                            <td className="px-2 py-1.5 align-middle border-b border-r border-stone-200 dark:border-stone-800">
                              <select data-vale-para={i} value={it.escopo} onChange={(e) => setItem(i, { escopo: e.target.value as ItemForm['escopo'], escopoId: '' })} className={INPUT_CLASS}>
                                <option value="produto">Produto</option>
                                <option value="variante">Variante</option>
                                <option value="marca">Marca</option>
                                <option value="categoria">Categoria</option>
                              </select>
                            </td>
                            <td className="px-2 py-1.5 align-middle border-b border-r border-stone-200 dark:border-stone-800">
                              <ItemEscolhido escopo={it.escopo} id={it.escopoId} onAbrir={() => setEscolhendo(i)} />
                            </td>
                            <td className="px-2 py-1.5 align-middle border-b border-r border-stone-200 dark:border-stone-800 px-3 text-right">
                              <PrecoAtual escopo={it.escopo} id={it.escopoId} />
                            </td>
                            <td className="px-2 py-1.5 align-middle border-b border-r border-stone-200 dark:border-stone-800">
                              <select value={it.tipo} onChange={(e) => setItem(i, { tipo: e.target.value as ItemForm['tipo'], valor: '' })} className={INPUT_CLASS}>
                                <option value="percentual">Ajuste %</option>
                                <option value="preco">Preço fixo</option>
                              </select>
                            </td>
                            <td className="px-2 py-1.5 align-middle border-b border-r border-stone-200 dark:border-stone-800" title={it.tipo === 'preco' ? 'Preço (R$)' : 'Ajuste (%): negativo = desconto'}>
                              <NumberField value={it.valor} onChange={(v) => setItem(i, { valor: v })} scale={2} allowNegative={it.tipo === 'percentual'} className={INPUT_CLASS} />
                            </td>
                            <td className="px-2 py-1.5 align-middle border-b border-r border-stone-200 dark:border-stone-800 border-r-0 text-center">
                              <button type="button" title="Remover" onClick={() => setRemovendoItem(i)} className="p-1 rounded text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SecaoCrm>
            </TelaCheia>
          )}

          {modo === 'simulador' && <Simulador onVoltar={() => setModo('lista')} />}
        </div>

        {escolhendo !== null && form.itens[escolhendo] && (
          <EscolherItem
            escopo={form.itens[escolhendo].escopo}
            usados={form.itens.filter((x, k) => k !== escolhendo && x.escopo === form.itens[escolhendo].escopo).map((x) => x.escopoId)}
            onEscolher={(o) => {
              setItem(escolhendo, { escopoId: o.valor });
              setEscolhendo(null);
            }}
            onFechar={() => setEscolhendo(null)}
          />
        )}

        {removendoItem !== null && (
          <ConfirmDialog
            titulo="Remover item?"
            mensagem="A regra sai da lista. A remoção só vale depois de salvar."
            onConfirmar={() => {
              set('itens', form.itens.filter((_, k) => k !== removendoItem));
              setRemovendoItem(null);
            }}
            onCancelar={() => setRemovendoItem(null)}
          />
        )}

        {excluindo && (
          <ConfirmDialog titulo="Excluir lista?" mensagem={<><b>{excluindo.nome}</b> e seus critérios e itens serão removidos. As vendas voltam ao preço base ou à próxima lista que servir.</>} onConfirmar={excluir} onCancelar={() => setExcluindo(null)} />
        )}
        {modo === 'lista' && erro && <AvisoErro mensagem={erro} onFechar={() => setErro(null)} />}
        {toast && (
          <NoCanto>
            <div role="status" className="pointer-events-auto p-3 rounded-xl shadow-2xl border text-xs bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300">{toast}</div>
          </NoCanto>
        )}
      </div>
    </div>
  );
}

type OpcaoItem = Opcao & { preco?: number | null };
const NOME_ESCOPO: Record<ItemForm['escopo'], string> = { produto: 'produto', variante: 'variante', marca: 'marca', categoria: 'categoria' };

/** Rótulo e preço dos itens já escolhidos (só o id vem gravado): um pedido por item, guardado para a tela inteira */
const cacheOpcoes = new Map<string, Promise<OpcaoItem | null>>();
function useOpcao(escopo: ItemForm['escopo'], id: string) {
  const [op, setOp] = useState<OpcaoItem | null>(null);
  useEffect(() => {
    setOp(null);
    if (!id) return;
    const k = `${escopo}:${id}`;
    if (!cacheOpcoes.has(k)) {
      cacheOpcoes.set(k, fetch(`/api/precos/opcoes?tipo=${escopo}&ids=${id}`).then((r) => r.json()).then((d) => (Array.isArray(d) ? d[0] ?? null : null)).catch(() => null));
    }
    let vivo = true;
    cacheOpcoes.get(k)!.then((o) => vivo && setOp(o));
    return () => {
      vivo = false;
    };
  }, [escopo, id]);
  return op;
}

/** Preço de venda atual do produto ou da variante escolhida no item (marca e categoria não têm um preço) */
function PrecoAtual({ escopo, id }: { escopo: ItemForm['escopo']; id: string }) {
  const preco = useOpcao(escopo, id)?.preco;
  return <div className="font-bold text-stone-800 dark:text-stone-200">{preco == null ? '—' : 'R$ ' + formatNumber(preco, 2)}</div>;
}

/** Célula do item: mostra o escolhido; o clique abre o modal de escolha */
function ItemEscolhido({ escopo, id, onAbrir }: { escopo: ItemForm['escopo']; id: string; onAbrir: () => void }) {
  const op = useOpcao(escopo, id);
  return (
    <button type="button" onClick={onAbrir} title={`Escolher ${NOME_ESCOPO[escopo]}`} className={INPUT_CLASS + ' campo-botao flex items-center gap-2 text-left cursor-pointer'}>
      <Search className="w-3.5 h-3.5 shrink-0 text-stone-400" />
      <span className={'truncate ' + (id ? 'text-stone-800 dark:text-stone-100' : 'text-stone-400')}>
        {id ? op?.rotulo ?? '…' : escopo === 'produto' ? 'Escolher produto (vale para todas as variantes)…' : `Escolher ${NOME_ESCOPO[escopo]}…`}
      </span>
    </button>
  );
}

/** Modal de escolha do produto, variante, marca ou categoria do item (busca no servidor, até 30 resultados) */
function EscolherItem({ escopo, usados, onEscolher, onFechar }: { escopo: ItemForm['escopo']; usados: string[]; onEscolher: (o: OpcaoItem) => void; onFechar: () => void }) {
  const [busca, setBusca] = useState('');
  const [itens, setItens] = useState<OpcaoItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const comPreco = escopo === 'produto' || escopo === 'variante';

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    const t = setTimeout(() => {
      fetch('/api/precos/opcoes?' + new URLSearchParams({ tipo: escopo, q: busca.trim() }))
        .then((r) => r.json())
        .then((d) => vivo && setItens(Array.isArray(d) ? d : []))
        .catch(() => vivo && setItens([]))
        .finally(() => vivo && setCarregando(false));
    }, busca ? 250 : 0);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [busca, escopo]);

  return (
    <ModalPesquisa
      titulo={`Escolher ${NOME_ESCOPO[escopo]}`}
      placeholder={escopo === 'variante' ? 'SKU da variante ou nome do produto…' : escopo === 'produto' ? 'SKU ou nome do produto…' : 'Pesquisar…'}
      itens={itens}
      chave={(o) => o.valor}
      onBusca={setBusca}
      carregando={carregando}
      bloqueado={(o) => (usados.includes(o.valor) ? 'Já está na lista' : null)}
      colunas={[
        { label: 'Descrição', render: (o) => o.rotulo },
        ...(comPreco ? [{ label: 'Preço atual', largura: 'w-28', alinhar: 'direita' as const, render: (o: OpcaoItem) => <b>{o.preco == null ? '—' : 'R$ ' + formatNumber(o.preco, 2)}</b> }] : []),
      ]}
      rodape="Mostra até 30 resultados: refine a busca se não encontrar. Setas e Enter escolhem; Esc fecha."
      onEscolher={(o) => {
        cacheOpcoes.set(`${escopo}:${o.valor}`, Promise.resolve(o));
        onEscolher(o);
      }}
      onFechar={onFechar}
    />
  );
}

/** Simulador: escolhe cliente, vendedor, produto e quantidade e mostra qual lista vale e o preço (usa as listas salvas) */
function Simulador({ onVoltar }: { onVoltar: () => void }) {
  const [cliente, setCliente] = useState<string[]>([]);
  const [vendedor, setVendedor] = useState<string[]>([]);
  const [canal, setCanal] = useState<string[]>([]);
  const [produto, setProduto] = useState<string[]>([]);
  const [embalagens, setEmbalagens] = useState<any[]>([]);
  const [embalagemId, setEmbalagemId] = useState('');
  const [variantes, setVariantes] = useState<any[]>([]);
  const [varianteId, setVarianteId] = useState('');
  const [quantidade, setQuantidade] = useState('1');
  const [valorPedido, setValorPedido] = useState('');
  const [prazo, setPrazo] = useState('');
  const [data, setData] = useState(new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }));
  const [calculando, setCalculando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [res, setRes] = useState<any | null>(null);

  useEffect(() => {
    setEmbalagemId('');
    setEmbalagens([]);
    setVarianteId('');
    setVariantes([]);
    if (!produto[0]) return;
    let vivo = true;
    fetch(`/api/produtos/${produto[0]}/variantes`)
      .then((r) => r.json())
      .then((d) => vivo && Array.isArray(d) && setVariantes(d))
      .catch(() => {});
    fetch(`/api/produtos/${produto[0]}/embalagens`)
      .then((r) => r.json())
      .then((d) => vivo && setEmbalagens((d.embalagens ?? []).filter((e: any) => e.ativo)))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [produto]);

  const calcular = async () => {
    if (!produto[0]) return setErro('Escolha o produto.');
    if (variantes.length && !varianteId) return setErro('Produto com variação: escolha a variante.');
    if (!(Number(quantidade) > 0)) return setErro('Informe a quantidade.');
    setCalculando(true);
    setErro(null);
    try {
      const r = await fetch('/api/precos/resolver', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itens: [{ produtoId: Number(produto[0]), varianteId: varianteId ? Number(varianteId) : undefined, quantidade: Number(quantidade), embalagemId: embalagemId ? Number(embalagemId) : undefined }],
          clienteId: cliente[0] ? Number(cliente[0]) : undefined, vendedorId: vendedor[0] ? Number(vendedor[0]) : undefined,
          canal: canal[0] || undefined, valorPedido: valorPedido ? Number(valorPedido) : undefined, prazoMedioDias: prazo ? Number(prazo) : undefined, data,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Não foi possível calcular.');
      setRes(d);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setCalculando(false);
    }
  };

  const item = res?.itens?.[0];
  const moeda = (v: number) => 'R$ ' + formatNumber(v, 2);
  const REGRA: Record<string, string> = { variante: 'regra da variante', produto: 'regra do produto', marca: 'regra da marca', categoria: 'regra da categoria', padrao_da_lista: 'ajuste padrão da lista' };

  return (
    <TelaCheia larga rodape="Simulador de preço" rotuloVoltar="Voltar para a Lista" onVoltar={onVoltar} onSubmit={calcular} rotuloPrincipal="Calcular" iconePrincipal={<Calculator className="w-4 h-4" />} salvando={calculando}>
      {erro && <AvisoErro mensagem={erro} onFechar={() => setErro(null)} />}
      <p className="text-xs text-stone-500 dark:text-stone-400">Usa as listas salvas e o cadastro do cliente (tipo, cidade, UF e região) para mostrar qual lista vale e o preço.</p>
      <SecaoCrm titulo="Venda">
        <GradeCampos>
          <Campo rotulo="Cliente" span={2}><SelecaoMultipla tipo="cliente" unico value={cliente} onChange={setCliente} /></Campo>
          <Campo rotulo="Vendedor" span={2} dica="Em branco, vale o vendedor do cadastro do cliente."><SelecaoMultipla tipo="vendedor" unico value={vendedor} onChange={setVendedor} /></Campo>
          <Campo rotulo="Produto *" span={2}><SelecaoMultipla tipo="produto" unico value={produto} onChange={setProduto} /></Campo>
          {variantes.length > 0 && (
            <Campo rotulo="Variante *">
              <select value={varianteId} onChange={(e) => setVarianteId(e.target.value)} className={INPUT_CLASS}>
                <option value="">Escolha…</option>
                {variantes.map((v) => (
                  <option key={v.id} value={v.id}>{v.sku_variante}{v.nome_adicional ? ` — ${v.nome_adicional}` : ''}</option>
                ))}
              </select>
            </Campo>
          )}
          <Campo rotulo="Vender em" dica={embalagens.length ? undefined : 'O produto não tem embalagens cadastradas.'}>
            <select value={embalagemId} onChange={(e) => setEmbalagemId(e.target.value)} className={INPUT_CLASS}>
              <option value="">Unidade</option>
              {embalagens.map((e) => (
                <option key={e.id} value={e.id}>{e.sigla} — {e.descricao} (× {formatNumber(e.fator, e.fator % 1 ? 4 : 0)})</option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Quantidade *"><NumberField value={quantidade} onChange={setQuantidade} scale={4} className={INPUT_CLASS} /></Campo>
          <Campo rotulo="Canal"><SelecaoMultipla livre unico value={canal} onChange={setCanal} /></Campo>
          <Campo rotulo="Valor do pedido"><NumberField placeholder="Não informar" value={valorPedido} onChange={setValorPedido} scale={2} className={INPUT_CLASS} /></Campo>
          <Campo rotulo="Prazo médio (dias)"><NumberField placeholder="Não informar" value={prazo} onChange={setPrazo} scale={0} className={INPUT_CLASS} /></Campo>
          <Campo rotulo="Data da venda"><DateField value={data} onChange={setData} className={INPUT_CLASS} /></Campo>
        </GradeCampos>
      </SecaoCrm>

      {calculando && <Loader2 className="w-5 h-5 animate-spin text-stone-400" />}
      {res && item && (
        <SecaoCrm titulo="Resultado">
          {res.semListas && <p className="mb-2 text-xs text-amber-700 dark:text-amber-400">As tabelas de listas de preço não existem no banco: tudo sai no preço base.</p>}
          {item.erro ? (
            <p className="text-xs text-rose-600">{item.erro}</p>
          ) : (
            <div className="rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950/40 p-4 flex flex-wrap items-center gap-x-10 gap-y-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-stone-400">Preço base</div>
                <div className="text-sm font-mono text-stone-600 dark:text-stone-300">{moeda(item.base)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-stone-400">Preço por {item.unidade}</div>
                <div className="text-2xl font-black font-mono text-stone-900 dark:text-white">{moeda(item.preco)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-stone-400">Total</div>
                <div className="text-sm font-mono font-semibold text-stone-800 dark:text-stone-100">{moeda(item.valorTotal)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-stone-400">Diferença</div>
                <div className={'text-sm font-mono font-semibold ' + (item.diferencaPercentual < 0 ? 'text-emerald-600' : item.diferencaPercentual > 0 ? 'text-amber-600' : 'text-stone-500')}>{(item.diferencaPercentual > 0 ? '+' : '') + formatNumber(item.diferencaPercentual, 2)}%</div>
              </div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-stone-400">Origem</div>
                <div className="text-sm text-stone-700 dark:text-stone-200 flex items-center gap-1.5">
                  <BadgeCheck className="w-4 h-4 text-blue-600 shrink-0" />
                  {item.origem === 'lista' ? <span><b>{item.lista.nome}</b> ({REGRA[item.regra] ?? item.regra})</span> : <span>Preço base: nenhuma lista serviu</span>}
                </div>
              </div>
            </div>
          )}
          {!item.erro && item.nfe && (
            <p className="mt-3 text-[11px] font-mono text-stone-500 dark:text-stone-400">
              Na nota: {item.nfe.uCom} × {formatNumber(item.nfe.qCom, 4)} a {moeda(item.nfe.vUnCom)} = {moeda(item.nfe.vProd)} • tributável: {item.nfe.uTrib} × {formatNumber(item.nfe.qTrib, 4)} a R$ {formatNumber(item.nfe.vUnTrib, 4)} • baixa {formatNumber(item.quantidadeBase, 4)} {item.nfe.uTrib} do estoque
            </p>
          )}
        </SecaoCrm>
      )}
    </TelaCheia>
  );
}
