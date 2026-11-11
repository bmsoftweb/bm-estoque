import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Save, Trash2 } from 'lucide-react';
import { AvisoErro, NoCanto } from '@/components/AvisoErro';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Toggle } from '@/components/Toggle';
import { ListaCrm } from '@/components/ListaCrm';
import { BotaoAcao } from '@/components/MenuAcoes';
import { Campo, GradeCampos, INPUT_CLASS, ResumoRegistro, SecaoCrm, TelaCheia } from '@/components/FormCrm';
import { formatCurrency, formatNumber } from '@/lib/utils';

/**
 * Lista de produtos ligados a um produto, em ordem de preferência, com o saldo disponível na filial:
 *   similares → oferecidos no lugar dele quando faltar (cad_produtos_similares)
 *   sugestoes → oferecidos junto com ele na venda (cad_produtos_sugestoes)
 * API em app/api/produtos/[id]/<tipo> (lib/produtos-relacionados.ts).
 */

export type TipoRelacionado = 'similares' | 'sugestoes';

const TEXTOS: Record<TipoRelacionado, { titulo: string; aba: string; descricao: string; adicionar: string; lista: string; vazio: string; salvo: string; remover: string; script: string; reciproco: boolean; subir: string; descer: string }> = {
  similares: {
    titulo: 'Similares do produto',
    aba: 'Similares',
    descricao: 'Produtos que podem ser oferecidos no lugar deste quando ele faltar, em ordem de preferência.',
    adicionar: 'Adicionar similar',
    lista: 'Similares, em ordem de preferência',
    vazio: 'Nenhum similar cadastrado.',
    salvo: 'Similares salvos.',
    remover: 'similares',
    script: 'extras/2026-11-10_produtos_similares.sql',
    reciproco: true,
    subir: 'Oferecer antes',
    descer: 'Oferecer depois',
  },
  sugestoes: {
    titulo: 'Sugestões de venda',
    aba: 'Sugestões',
    descricao: 'Produtos que o vendedor pode oferecer junto com este na venda (ex.: no caderno, papel para encapar, caneta, lápis e borracha), em ordem de preferência.',
    adicionar: 'Adicionar sugestão',
    lista: 'Sugestões, em ordem de preferência',
    vazio: 'Nenhuma sugestão cadastrada.',
    salvo: 'Sugestões salvas.',
    remover: 'sugestões',
    script: 'extras/2026-11-10_produtos_sugestoes.sql',
    reciproco: false,
    subir: 'Oferecer antes',
    descer: 'Oferecer depois',
  },
};

interface ProdutoBase {
  id: number;
  sku: string;
  nome: string;
  preco_venda: number | string;
  ativo?: number | boolean;
}
interface Item extends ProdutoBase {
  /** Saldo disponível na filial; undefined = ainda não gravado (aparece depois de salvar) */
  disponivel?: number;
}

const qtd = (v: number) => formatNumber(v, v % 1 ? 4 : 0);

export const ProdutosRelacionados: React.FC<{ tipo: TipoRelacionado; produtoId: number; produtos: ProdutoBase[]; onVoltar: () => void }> = ({ tipo, produtoId, produtos, onVoltar }) => {
  const t = TEXTOS[tipo];
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [semTabela, setSemTabela] = useState(false);
  const [produto, setProduto] = useState<any>(null);
  const [lista, setLista] = useState<Item[]>([]);
  const [reciproco, setReciproco] = useState(t.reciproco);
  const [busca, setBusca] = useState('');
  const [aberta, setAberta] = useState(false);
  const [remover, setRemover] = useState<Item | null>(null);
  const buscaRef = useRef<HTMLInputElement>(null);

  const carregar = async () => {
    const r = await fetch(`/api/produtos/${produtoId}/${tipo}`);
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Não foi possível carregar a lista.');
    setProduto(d.produto);
    setSemTabela(d.semTabela);
    setLista(d.itens);
  };

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    setReciproco(TEXTOS[tipo].reciproco);
    carregar()
      .catch((e) => vivo && setErro(e.message))
      .finally(() => {
        if (!vivo) return;
        setCarregando(false);
        setTimeout(() => buscaRef.current?.focus(), 0);
      });
    return () => {
      vivo = false;
    };
  }, [produtoId, tipo]);

  useEffect(() => {
    if (!toast) return;
    const tm = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(tm);
  }, [toast]);

  const termo = busca.trim().toLowerCase();
  const candidatos = termo
    ? produtos
        .filter((p) => p.id !== produtoId && !lista.some((s) => s.id === p.id))
        .filter((p) => p.nome.toLowerCase().includes(termo) || (p.sku || '').toLowerCase().includes(termo))
        .slice(0, 30)
    : [];

  const adicionar = (p: ProdutoBase) => {
    setLista((l) => [...l, { id: p.id, sku: p.sku, nome: p.nome, preco_venda: p.preco_venda, ativo: p.ativo }]);
    setBusca('');
    setAberta(false);
    buscaRef.current?.focus();
  };

  const mover = (s: Item, passo: -1 | 1) =>
    setLista((l) => {
      const i = l.findIndex((x) => x.id === s.id);
      const j = i + passo;
      if (j < 0 || j >= l.length) return l;
      const n = [...l];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/produtos/${produtoId}/${tipo}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itens: lista.map((s) => s.id), reciproco }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Não foi possível gravar a lista.');
      await carregar(); // traz o saldo dos que entraram
      setToast(t.salvo);
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

  const disp = Number(produto?.disponivel ?? 0);

  return (
    <TelaCheia rodape={'Produto #' + produtoId + ' • ' + t.aba} onVoltar={onVoltar} onSubmit={salvar} rotuloPrincipal="Salvar" iconePrincipal={<Save className="w-4 h-4" />} salvando={salvando}>
      {erro && <AvisoErro mensagem={erro} onFechar={() => setErro(null)} />}

      {semTabela && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
          <b>A tabela de {t.remover} ainda não existe no banco.</b> Rode o script <span className="font-mono">{t.script}</span> no banco do ERP e abra esta tela de novo.
        </div>
      )}

      <ResumoRegistro titulo={t.titulo} nome={produto?.nome} sku={produto?.sku} id={produto?.id} />
      <p className="text-xs text-stone-500 dark:text-stone-400">
        {t.descricao}
        {!semTabela && (
          <>
            {' '}Disponível deste produto nesta filial: <b className={disp > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>{qtd(disp)}</b>.
          </>
        )}
      </p>

      {!semTabela && (
        <SecaoCrm titulo={t.adicionar}>
          <GradeCampos>
            <Campo rotulo="Produto" span={2}>
              <div className="relative">
                <input
                  ref={buscaRef}
                  type="text"
                  placeholder="Pesquisar por nome ou SKU…"
                  value={busca}
                  onChange={(e) => {
                    setBusca(e.target.value);
                    setAberta(true);
                  }}
                  onFocus={(e) => {
                    e.target.select();
                    setAberta(true);
                  }}
                  onBlur={() => setTimeout(() => setAberta(false), 150)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault(); // não grava a tela: escolhe o primeiro da lista
                      if (candidatos[0]) adicionar(candidatos[0]);
                    } else if (e.key === 'Escape') setAberta(false);
                  }}
                  className={INPUT_CLASS}
                />
                {aberta && termo && (
                  <div className="absolute z-30 w-full mt-1 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {candidatos.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-stone-500">Nenhum produto encontrado.</div>
                    ) : (
                      candidatos.map((p) => (
                        <div
                          key={p.id}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => adicionar(p)}
                          className="px-3 py-2 cursor-pointer hover:bg-stone-100 dark:hover:bg-stone-800 border-b border-stone-100 dark:border-stone-800 last:border-0"
                        >
                          <div className="font-semibold text-xs text-stone-800 dark:text-stone-100">{p.nome}</div>
                          <div className="text-[11px] text-stone-500 font-mono">{p.sku}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </Campo>
            <Campo rotulo="Inverso" span={2} dica={`Coloca este produto no fim da lista de ${t.remover} de cada produto adicionado aqui.`}>
              <div className="flex items-center h-[34px]">
                <Toggle checked={reciproco} onChange={setReciproco} label="Cadastrar também o inverso" />
              </div>
            </Campo>
          </GradeCampos>
        </SecaoCrm>
      )}

      <SecaoCrm titulo={t.lista}>
        <ListaCrm
          id={'produtos_' + tipo}
          className="max-h-[60vh]"
          ordenavel={false}
          paginar={false}
          buscar={false}
          chave={(s: Item) => s.id}
          linhas={lista}
          vazio={t.vazio}
          colunas={[
            { key: 'ordem', label: '#', alinhar: 'numero', largura: 50, render: (s: Item) => <span className="font-mono">{lista.indexOf(s) + 1}</span> },
            { key: 'sku', label: 'SKU', largura: 140, render: (s: Item) => <span className="font-mono">{s.sku}</span> },
            { key: 'nome', label: 'Produto', largura: 320, render: (s: Item) => <>{s.nome}{s.ativo === false || s.ativo === 0 ? <span className="ml-2 text-[10px] font-semibold text-rose-600">INATIVO</span> : null}</> },
            { key: 'preco_venda', label: 'Venda', alinhar: 'numero', largura: 120, render: (s: Item) => <span className="font-mono">{formatCurrency(Number(s.preco_venda) || 0)}</span> },
            {
              key: 'disponivel',
              label: 'Disponível',
              alinhar: 'numero',
              largura: 110,
              render: (s: Item) =>
                s.disponivel === undefined ? (
                  <span className="text-stone-400" title="Aparece depois de salvar">—</span>
                ) : (
                  <span className={'font-mono ' + (s.disponivel > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>{qtd(s.disponivel)}</span>
                ),
            },
          ]}
          acoes={(s: Item) => (
            <>
              <BotaoAcao icone={ChevronUp} titulo="Subir" descricao={t.subir} onClick={() => mover(s, -1)} />
              <BotaoAcao icone={ChevronDown} titulo="Descer" descricao={t.descer} onClick={() => mover(s, 1)} />
              <BotaoAcao icone={Trash2} titulo="Remover" descricao="Tira da lista (pede confirmação)" tom="perigo" onClick={() => setRemover(s)} />
            </>
          )}
        />
        <p className="mt-2 text-[11px] text-stone-400 dark:text-stone-500">As mudanças na lista só valem depois de Salvar.</p>
      </SecaoCrm>

      {remover && (
        <ConfirmDialog
          titulo="Remover da lista"
          mensagem={<>Tirar <b>{remover.nome}</b> da lista de {t.remover}? A lista só é gravada ao Salvar.</>}
          confirmar="Remover"
          tom="perigo"
          onConfirmar={() => {
            setLista((l) => l.filter((x) => x.id !== remover.id));
            setRemover(null);
          }}
          onCancelar={() => setRemover(null)}
        />
      )}

      {toast && (
        <NoCanto>
          <div role="status" className="pointer-events-auto p-3 rounded-xl shadow-2xl border text-xs bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300">{toast}</div>
        </NoCanto>
      )}
    </TelaCheia>
  );
};
