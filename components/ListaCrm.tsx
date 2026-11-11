
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronUp, Loader2, Menu, Plus, Search, X } from 'lucide-react';
import { INPUT_CLASS } from '@/components/FormCrm';
import { Toggle } from '@/components/Toggle';
import { MenuAcoes } from '@/components/MenuAcoes';
import { NoCanto } from '@/components/AvisoErro';
import { gravarConfigLista, lerConfigListas } from '@/lib/config-listas-cliente';

/**
 * Lista no modelo do crmWeb (CrudView): ordem física [indicador 30px] [dados…] [sobra] [Ações].
 * Colunas redimensionáveis e reordenáveis, menu de contexto (ícone de 3 traços no cabeçalho do indicador)
 * e preferências gravadas só em "Salvar Configuração" (sys_usuarios.config_listas, chave estoque_listas).
 */

export interface ColunaLista<T> {
  key: string;
  label: string;
  /** numero = à direita; centro = centralizada (datas, Sim/Não); texto = à esquerda */
  alinhar?: 'texto' | 'numero' | 'centro';
  render?: (linha: T) => React.ReactNode;
  /** Largura inicial em px (modo manual sem largura gravada) */
  largura?: number;
}

type Modo = 'manual' | 'ajustar' | 'melhor';
type Grade = 'ambas' | 'horizontais' | 'verticais' | 'nenhuma';

interface Prefs {
  modo: Modo;
  larguras: Record<string, number>;
  ordem: string[];
  grade: Grade;
  visiveis: string[] | null;
}

const PADRAO: Prefs = { modo: 'manual', larguras: {}, ordem: [], grade: 'horizontais', visiveis: null };
const MIN = 50;
const W_IND = 30;
const W_ACOES = 96; // w-24


interface Props<T> {
  /** Identifica a lista nas preferências (ex.: "marcas") */
  id: string;
  colunas: ColunaLista<T>[];
  linhas: T[];
  chave: (linha: T) => string | number;
  carregando?: boolean;
  vazio?: React.ReactNode;
  /** Duplo clique na linha */
  onEditar?: (linha: T) => void;
  /** Itens (BotaoAcao) da coluna Ações; mais de 3 → usar menu */
  acoes?: (linha: T) => React.ReactNode;
  /** true quando há mais de 3 ações: um único "..." com menu */
  acoesEmMenu?: boolean;
  /** Linha extra renderizada logo abaixo de uma linha (mestre-detalhe) */
  detalhe?: (linha: T) => React.ReactNode;
  /** Linha com detalhe que abre/fecha pela seta do indicador (mestre-detalhe). Sem isso, o detalhe aparece na linha selecionada */
  expansivel?: (linha: T) => boolean;
  aberta?: (linha: T) => boolean;
  onAlternar?: (linha: T) => void;
  /** Rodapé fixo com totais: conteúdo de cada coluna (null = vazio) */
  rodape?: (key: string) => React.ReactNode;
  /** Ordenação controlada pela tela (ex.: no servidor): a lista só mostra o indicador e avisa o clique */
  ordemExterna?: { key: string; dir: 'asc' | 'desc' | 'none' };
  onOrdenar?: (key: string) => void;
  /** Itens extras no fim do menu de contexto, antes de "Salvar Configuração" */
  extraMenu?: { rotulo: string; onClick: () => void }[];
  /** Clique no cabeçalho ordena (padrão). Desligar em listas já ordenadas por si, como árvores */
  ordenavel?: boolean;
  /** Botão "Novo" da barra de ferramentas */
  onNovo?: () => void;
  rotuloNovo?: string;
  /** Conteúdo extra na barra de ferramentas (ex.: Filtrar, expandir tudo), antes de "por página" */
  barraExtra?: React.ReactNode;
  /** Busca por texto nas linhas (padrão: ligada) */
  buscar?: boolean;
  /** "N por página" e paginação (padrão: ligada). Desligar em árvores e painéis */
  paginar?: boolean;
  className?: string;
}

export function ListaCrm<T>({ id, colunas, linhas: linhasOrigem, chave, ordenavel = true, carregando, vazio, onEditar, acoes, acoesEmMenu, detalhe, expansivel, aberta, onAlternar, rodape, ordemExterna, onOrdenar, extraMenu, onNovo, rotuloNovo = 'Novo', barraExtra, buscar = true, paginar = true, className = 'max-h-[calc(100vh-var(--altura-topo))]' }: Props<T>) {
  const [prefs, setPrefs] = useState<Prefs>(PADRAO);
  const [ordem, setOrdem] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const [sobra, setSobra] = useState(true);
  const [selecionada, setSelecionada] = useState<string | number | null>(null);
  const [menu, setMenu] = useState<{ top: number; left: number } | null>(null);
  const [subColunas, setSubColunas] = useState(false);
  const [toast, setToast] = useState<{ texto: string; erro?: boolean } | null>(null);
  const area = useRef<HTMLDivElement>(null);
  const tabela = useRef<HTMLTableElement>(null);
  const botaoMenu = useRef<HTMLButtonElement>(null);
  const arrastada = useRef<string | null>(null);

  const ordemAtiva = onOrdenar ? (ordemExterna && ordemExterna.dir !== 'none' ? { key: ordemExterna.key, dir: ordemExterna.dir } : null) : ordem;

  const [busca, setBusca] = useState('');
  const [limite, setLimite] = useState(25);
  const [pagina, setPagina] = useState(1);

  const linhasOrd = useMemo(() => {
    if (!ordem || onOrdenar) return linhasOrigem;
    const f = ordem.dir === 'asc' ? 1 : -1;
    const val = (l: T) => (l as any)[ordem.key];
    return [...linhasOrigem].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      const nx = Number(x);
      const ny = Number(y);
      if (typeof x !== 'boolean' && !Number.isNaN(nx) && !Number.isNaN(ny) && String(x).trim() !== '' && String(y).trim() !== '') return (nx - ny) * f;
      return String(x).localeCompare(String(y), 'pt-BR', { numeric: true, sensitivity: 'base' }) * f;
    });
  }, [linhasOrigem, ordem, onOrdenar]);

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return t ? linhasOrd.filter((l) => JSON.stringify(Object.values(l as any)).toLowerCase().includes(t)) : linhasOrd;
  }, [linhasOrd, busca]);
  const totalPaginas = paginar ? Math.max(1, Math.ceil(filtradas.length / limite)) : 1;
  const paginaAtual = Math.min(pagina, totalPaginas);
  const linhas = paginar ? filtradas.slice((paginaAtual - 1) * limite, paginaAtual * limite) : filtradas;
  const total = filtradas.length;

  const ordenar = (key: string) => (onOrdenar ? onOrdenar(key) : ordenavel && setOrdem((o) => (o?.key !== key ? { key, dir: 'asc' } : o.dir === 'asc' ? { key, dir: 'desc' } : null)));

  useEffect(() => {
    let vivo = true;
    lerConfigListas().then((tudo) => {
      const p = (tudo as Record<string, any>)[id];
      if (vivo && p) {
        setPrefs({ ...PADRAO, ...p });
        setSobra(p.modo === 'manual' || !p.modo ? p.sobra !== false : p.modo === 'melhor');
      }
    }).catch(() => {});
    return () => {
      vivo = false;
    };
  }, [id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.erro ? 10000 : 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Colunas na ordem do usuário, só as visíveis
  const ordenadas = (() => {
    const mapa = new Map(colunas.map((c) => [c.key, c]));
    const ordem = [...prefs.ordem.filter((k) => mapa.has(k)), ...colunas.map((c) => c.key).filter((k) => !prefs.ordem.includes(k))];
    return ordem.map((k) => mapa.get(k)!).filter((c) => !prefs.visiveis || prefs.visiveis.includes(c.key));
  })();

  const ths = () => Array.from(tabela.current?.querySelectorAll<HTMLElement>('th[data-col]') ?? []);

  /** Largura natural do conteúdo de cada coluna (tabela em max-content, sem larguras inline).
   *  Limpa cabeçalhos E células: as td também levam width/min/max e, se ficassem, a medição devolveria a largura atual */
  const medir = useCallback((): Record<string, number> => {
    const t = tabela.current;
    if (!t) return {};
    const lista = ths();
    const celulas = Array.from(t.querySelectorAll<HTMLElement>('th, td')).filter((c) => c.style.width);
    const guardado = celulas.map((c) => [c.style.width, c.style.minWidth, c.style.maxWidth] as const);
    const largTab = t.style.width;
    celulas.forEach((c) => (c.style.width = c.style.minWidth = c.style.maxWidth = ''));
    t.style.width = 'max-content';
    const r: Record<string, number> = {};
    // getBoundingClientRect tem fração (offsetWidth arredonda para baixo e o texto ganhava "…"); +1 de folga
    lista.forEach((th) => (r[th.dataset.col!] = Math.max(MIN, Math.ceil(th.getBoundingClientRect().width) + 1)));
    t.style.width = largTab;
    celulas.forEach((c, i) => ([c.style.width, c.style.minWidth, c.style.maxWidth] = guardado[i] as any));
    return r;
  }, []);

  const aplicarModo = useCallback(
    (modo: Modo) => {
      if (modo === 'manual') return;
      const nat = medir();
      const chaves = Object.keys(nat);
      if (!chaves.length) return;
      // Mesmas larguras e mesmo modo: devolve o mesmo objeto para o React não renderizar de novo (evita laço)
      const gravar = (larguras: Record<string, number>) =>
        setPrefs((p) =>
          p.modo === modo && Object.keys(larguras).length === Object.keys(p.larguras).length && Object.keys(larguras).every((k) => p.larguras[k] === larguras[k])
            ? p
            : { ...p, modo, larguras },
        );
      if (modo === 'melhor') {
        setSobra(true);
        gravar(nat);
        return;
      }
      // ajustar: reparte a área livre proporcional às larguras naturais, sem sobra
      const disponivel = Math.max(0, (area.current?.clientWidth ?? 0) - W_IND - W_ACOES);
      const soma = chaves.reduce((s, k) => s + nat[k], 0) || 1;
      const r: Record<string, number> = {};
      let usado = 0;
      chaves.forEach((k, i) => {
        r[k] = i === chaves.length - 1 ? Math.max(MIN, disponivel - usado) : Math.max(MIN, Math.floor((nat[k] / soma) * disponivel));
        usado += r[k];
      });
      setSobra(false);
      gravar(r);
    },
    [medir],
  );

  // Modos recalculam quando chegam linhas, mudam colunas e no resize da janela.
  // Não depender de `linhas`: com paginação é um slice() novo a cada render e o efeito rodaria sem parar.
  const chaveColunas = ordenadas.map((c) => c.key).join('|');
  useLayoutEffect(() => {
    if (prefs.modo !== 'manual' && !carregando) aplicarModo(prefs.modo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.modo, filtradas, paginaAtual, limite, chaveColunas, carregando]);
  useEffect(() => {
    if (prefs.modo === 'manual') return;
    const f = () => aplicarModo(prefs.modo);
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, [prefs.modo, aplicarModo]);

  // Menu de contexto fecha ao clicar fora, rolar ou Esc
  useEffect(() => {
    if (!menu) return;
    const fechar = () => {
      setMenu(null);
      setSubColunas(false);
    };
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && fechar();
    const fora = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-menu-lista]')) return;
      fechar();
    };
    document.addEventListener('mousedown', fora);
    document.addEventListener('scroll', fechar, true);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('scroll', fechar, true);
      document.removeEventListener('keydown', tecla);
    };
  }, [menu]);

  const abrirMenu = () => {
    if (menu) return setMenu(null);
    const r = botaoMenu.current!.getBoundingClientRect();
    const altura = 360;
    setMenu({ top: r.bottom + 4 + altura > window.innerHeight ? Math.max(8, r.top - altura - 4) : r.bottom + 4, left: r.left });
    setSubColunas(false);
  };

  // Redimensionar: congela as larguras atuais; só a coluna arrastada muda (e a seguinte cede, sem sobra)
  const iniciarRedimensao = (e: React.PointerEvent, key: string) => {
    e.preventDefault();
    e.stopPropagation();
    const atuais: Record<string, number> = {};
    ths().forEach((th) => (atuais[th.dataset.col!] = th.offsetWidth));
    const x0 = e.clientX;
    const idx = ordenadas.findIndex((c) => c.key === key);
    const prox = !sobra ? ordenadas[idx + 1]?.key : undefined;
    setPrefs((p) => ({ ...p, modo: 'manual', larguras: atuais }));
    document.body.style.cursor = 'col-resize';
    const mover = (ev: PointerEvent) => {
      let delta = ev.clientX - x0;
      delta = Math.max(MIN - atuais[key], delta);
      if (prox) delta = Math.min(delta, atuais[prox] - MIN);
      setPrefs((p) => ({ ...p, larguras: { ...atuais, [key]: atuais[key] + delta, ...(prox ? { [prox]: atuais[prox] - delta } : {}) } }));
    };
    const soltar = () => {
      document.removeEventListener('pointermove', mover);
      document.removeEventListener('pointerup', soltar);
      document.body.style.cursor = '';
    };
    document.addEventListener('pointermove', mover);
    document.addEventListener('pointerup', soltar);
  };

  const soltarColuna = (alvo: string) => {
    const de = arrastada.current;
    arrastada.current = null;
    if (!de || de === alvo) return;
    const ordem = ordenadas.map((c) => c.key).filter((k) => k !== de);
    ordem.splice(ordem.indexOf(alvo), 0, de);
    // colunas ocultas ficam no fim
    setPrefs((p) => ({ ...p, ordem: [...ordem, ...colunas.map((c) => c.key).filter((k) => !ordem.includes(k))] }));
  };

  const alternarColuna = (key: string) =>
    setPrefs((p) => {
      const atuais = p.visiveis ?? colunas.map((c) => c.key);
      const novas = atuais.includes(key) ? atuais.filter((k) => k !== key) : [...atuais, key];
      return { ...p, visiveis: novas.length ? novas : atuais };
    });

  const salvar = async () => {
    setMenu(null);
    try {
      await gravarConfigLista(id, { ...prefs, sobra, larguras: prefs.modo === 'manual' ? prefs.larguras : {} });
      setToast({ texto: 'Configuração salva.' });
    } catch (e: any) {
      setToast({ texto: e.message, erro: true });
    }
  };

  const hor = prefs.grade === 'ambas' || prefs.grade === 'horizontais';
  const ver = prefs.grade === 'ambas' || prefs.grade === 'verticais';
  // Cor por lado (border-b-*, border-r-*): uma cor para todos os lados faria a "transparente" de um apagar a linha do outro
  const bB = `border-b ${hor ? 'border-b-stone-200 dark:border-b-stone-800' : 'border-b-transparent'}`;
  const bR = `border-r ${ver ? 'border-r-stone-200 dark:border-r-stone-800' : 'border-r-transparent'}`;
  const alinhaTd = (a?: string) => (a === 'numero' ? 'text-right' : a === 'centro' ? 'text-center' : 'text-left');
  const largura = (c: ColunaLista<T>): React.CSSProperties | undefined => {
    const w = prefs.larguras[c.key] ?? (prefs.modo === 'manual' ? c.largura : undefined);
    return w ? { width: w, minWidth: w, maxWidth: w } : undefined;
  };

  const itemMenu = (rotulo: string, onClick: () => void, ativo = false) => (
    <button type="button" role="menuitem" onClick={onClick} className={`w-full text-left px-3 py-2 text-xs font-medium cursor-pointer hover:bg-stone-100 dark:hover:bg-stone-800 ${ativo ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-stone-800 dark:text-stone-100'}`}>
      {rotulo}
    </button>
  );
  const linha = <div className="my-1 border-t border-stone-100 dark:border-stone-800" />;
  const setGrade = (g: Grade) => {
    setPrefs((p) => ({ ...p, grade: g }));
    setMenu(null);
  };

  const nCols = ordenadas.length + 2 + (sobra ? 1 : 0);

  return (
    <div className={`flex flex-col min-h-0 bg-white dark:bg-stone-900 ${className}`}>
      {(onNovo || barraExtra || buscar || paginar) && (
        <div className="px-4 py-2.5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between gap-3 shrink-0 bg-white dark:bg-stone-900 overflow-x-auto overflow-y-hidden">
          <div className="text-[11px] text-stone-500 dark:text-stone-400 truncate min-w-0">
            {carregando && !linhasOrigem.length
              ? 'Carregando registros…'
              : total === 0
              ? 'Nenhum registro encontrado'
              : paginar
              ? `${(paginaAtual - 1) * limite + 1}–${Math.min(paginaAtual * limite, total)} de ${total} registro(s)`
              : `${total} registro(s)`}
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            {buscar && (
              <div className="relative w-52 sm:w-64 shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                <input type="text" value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }} onFocus={(e) => e.target.select()} placeholder="Buscar…" className={`${INPUT_CLASS} pl-9 pr-8`} />
                {busca && (
                  <button type="button" onClick={() => { setBusca(''); setPagina(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
            {barraExtra}
            {paginar && (
              <select value={limite} onChange={(e) => { setLimite(Number(e.target.value)); setPagina(1); }} title="Registros por página" className={`${INPUT_CLASS} !w-auto shrink-0 cursor-pointer`}>
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n} por página
                  </option>
                ))}
              </select>
            )}
            {onNovo && (
              <button type="button" onClick={onNovo} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer shrink-0 whitespace-nowrap">
                <Plus className="w-3.5 h-3.5" />
                <span>{rotuloNovo}</span>
              </button>
            )}
          </div>
        </div>
      )}

      <div ref={area} className="relative overflow-auto flex-1 min-h-0 border-b border-stone-200 dark:border-stone-800">
      <table ref={tabela} className="w-full text-xs border-separate border-spacing-0">
        <thead className="sticky top-0 z-10">
          <tr>
            <th className="sticky left-0 z-20 w-[30px] min-w-[30px] max-w-[30px] px-0 text-center border-b border-r border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950">
              <button ref={botaoMenu} type="button" onClick={abrirMenu} title="Opções da lista" className="p-1 rounded text-stone-400 hover:text-blue-600 cursor-pointer">
                <Menu className="w-3.5 h-3.5" />
              </button>
            </th>
            {ordenadas.map((c) => (
              <th
                key={c.key}
                data-col={c.key}
                draggable
                onDragStart={() => (arrastada.current = c.key)}
                onDragOver={(e) => arrastada.current && e.preventDefault()}
                onDrop={() => soltarColuna(c.key)}
                style={largura(c)}
                className={`relative px-3 py-2.5 text-center font-semibold text-stone-600 dark:text-stone-300 whitespace-nowrap select-none border-b border-r border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 overflow-hidden text-ellipsis ${bR.includes('transparent') ? '' : ''}`}
              >
                <span onClick={() => ordenar(c.key)} className={ordenavel || onOrdenar ? 'cursor-pointer' : ''}>
                  {c.label}
                  {ordemAtiva?.key === c.key && (ordemAtiva.dir === 'asc' ? <ChevronUp className="w-3 h-3 inline ml-1 text-blue-600" /> : <ChevronDown className="w-3 h-3 inline ml-1 text-blue-600" />)}
                </span>
                <span
                  draggable={false}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => iniciarRedimensao(e, c.key)}
                  className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-blue-400/60"
                />
              </th>
            ))}
            {sobra && <th className="w-full border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950" />}
            <th className="sticky right-0 z-20 w-24 min-w-24 max-w-24 px-3 py-2.5 text-center font-semibold text-stone-600 dark:text-stone-300 border-b border-l border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950">Ações</th>
          </tr>
        </thead>
        <tbody className={carregando && linhas.length ? 'opacity-60' : ''}>
          {linhas.map((l) => {
            const k = chave(l);
            const sel = selecionada === k;
            const exp = expansivel?.(l) ?? false;
            const abertaL = aberta ? aberta(l) : sel;
            return (
              <React.Fragment key={k}>
                <tr
                  onClick={() => setSelecionada(k)}
                  onDoubleClick={() => onEditar?.(l)}
                  className={`group cursor-default transition-colors ${sel ? 'bg-blue-50 dark:bg-blue-950/30' : 'bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800/60'}`}
                >
                  <td className={`sticky left-0 z-[5] w-[30px] min-w-[30px] max-w-[30px] px-0 text-center align-middle bg-inherit border-r border-stone-200 dark:border-stone-800 ${bB}`}>
                    {exp ? (
                      <button type="button" onClick={(e) => { e.stopPropagation(); onAlternar?.(l); }} title={abertaL ? 'Recolher' : 'Expandir'} className="p-0.5 rounded text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer">
                        {abertaL ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </button>
                    ) : (
                      <ChevronRight className={`w-3.5 h-3.5 inline ${sel ? 'text-blue-600' : 'text-transparent group-hover:text-stone-400'}`} />
                    )}
                  </td>
                  {ordenadas.map((c) => (
                    <td key={c.key} style={largura(c)} className={`px-3 py-[7.5px] overflow-hidden text-ellipsis whitespace-nowrap text-stone-800 dark:text-stone-200 ${alinhaTd(c.alinhar)} ${bB} ${bR}`}>
                      {c.render ? c.render(l) : String((l as any)[c.key] ?? '')}
                    </td>
                  ))}
                  {sobra && <td className={bB} />}
                  <td className={`sticky right-0 z-[5] w-24 min-w-24 max-w-24 px-3 py-[7.5px] text-center whitespace-nowrap bg-inherit border-l border-stone-200 dark:border-stone-800 ${bB}`}>
                    <div className="flex items-center justify-center gap-0.5">{acoesEmMenu ? <MenuAcoes>{acoes?.(l)}</MenuAcoes> : acoes?.(l)}</div>
                  </td>
                </tr>
                {abertaL && detalhe && (
                  <tr>
                    <td colSpan={nCols} className="p-0 bg-stone-50 dark:bg-stone-950/60">
                      {detalhe(l)}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
          {!linhas.length && (
            <tr>
              <td colSpan={nCols} className="px-4 py-10 text-center text-stone-500 dark:text-stone-400 text-sm">
                {carregando ? <Loader2 className="w-5 h-5 animate-spin inline" /> : (vazio ?? 'Nenhum registro encontrado.')}
              </td>
            </tr>
          )}
        </tbody>
        {/* Só desenha o rodapé se alguma coluna tem total: senão sobra uma faixa vazia */}
        {rodape && ordenadas.some((c) => rodape(c.key) != null) && (
          <tfoot className="sticky bottom-0 z-10">
            <tr>
              <td className="sticky left-0 z-20 w-[30px] min-w-[30px] max-w-[30px] border-t border-r border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950" />
              {ordenadas.map((c) => (
                <td key={c.key} className={`px-3 py-2 text-[11px] font-bold border-t border-r border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 text-stone-800 dark:text-stone-100 ${alinhaTd(c.alinhar)}`}>
                  {rodape(c.key)}
                </td>
              ))}
              {sobra && <td className="border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950" />}
              <td className="sticky right-0 z-20 w-24 min-w-24 max-w-24 border-t border-l border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950" />
            </tr>
          </tfoot>
        )}
      </table>
      </div>

      {paginar && totalPaginas > 1 && (
        <div className="px-4 py-2.5 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950/40 flex items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] text-stone-500 dark:text-stone-400">
            Página {paginaAtual} de {totalPaginas} ({total.toLocaleString('pt-BR')} {total === 1 ? 'registro' : 'registros'})
          </span>
          <div className="flex items-center gap-1.5">
            {(
              [
                [ChevronsLeft, 'Primeira página', 1, paginaAtual <= 1],
                [ChevronLeft, 'Página anterior', Math.max(1, paginaAtual - 1), paginaAtual <= 1],
                [ChevronRight, 'Próxima página', Math.min(totalPaginas, paginaAtual + 1), paginaAtual >= totalPaginas],
                [ChevronsRight, 'Última página', totalPaginas, paginaAtual >= totalPaginas],
              ] as const
            ).map(([Icone, titulo, destino, desabilitado]) => (
              <button key={titulo} type="button" onClick={() => setPagina(destino)} disabled={desabilitado} title={titulo} className="p-1.5 rounded-lg border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors">
                <Icone className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>
      )}

      {menu &&
        createPortal(
          <div data-menu-lista role="menu" style={{ top: menu.top, left: menu.left }} className="fixed z-[60] w-56 py-1 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-xl">
            {itemMenu('Ajustar largura', () => (setMenu(null), aplicarModo('ajustar')), prefs.modo === 'ajustar')}
            {itemMenu('Melhor largura', () => (setMenu(null), aplicarModo('melhor')), prefs.modo === 'melhor')}
            {linha}
            {itemMenu('Mostrar linhas da grade', () => setGrade('ambas'), prefs.grade === 'ambas')}
            {itemMenu('Mostrar linhas horizontais', () => setGrade('horizontais'), prefs.grade === 'horizontais')}
            {itemMenu('Mostrar linhas verticais', () => setGrade('verticais'), prefs.grade === 'verticais')}
            {itemMenu('Não mostrar linhas da grade', () => setGrade('nenhuma'), prefs.grade === 'nenhuma')}
            {linha}
            <div className="relative" onMouseEnter={() => setSubColunas(true)}>
              <button type="button" onClick={() => setSubColunas((v) => !v)} className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-stone-800 dark:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer">
                Colunas <ChevronRight className="w-3.5 h-3.5" />
              </button>
              {subColunas && (
                <div className="absolute left-full top-0 -ml-1 z-50 w-52 max-h-[60vh] overflow-y-auto py-1 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-xl">
                  {colunas.map((c) => (
                    <div key={c.key} className="px-3 py-1.5">
                      <Toggle size="sm" checked={!prefs.visiveis || prefs.visiveis.includes(c.key)} onChange={() => alternarColuna(c.key)} label={c.label} />
                    </div>
                  ))}
                </div>
              )}
            </div>
            {linha}
            {extraMenu?.map((x) => itemMenu(x.rotulo, () => (setMenu(null), x.onClick())))}
            {extraMenu?.length ? linha : null}
            {itemMenu('Salvar Configuração', salvar)}
          </div>,
          document.body,
        )}

      {toast && (
        <NoCanto>
          <div role="status" className={`pointer-events-auto p-3 rounded-xl shadow-2xl border text-xs ${toast.erro ? 'bg-rose-50 dark:bg-rose-950 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300' : 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300'}`}>
            {toast.texto}
          </div>
        </NoCanto>
      )}
    </div>
  );
}
