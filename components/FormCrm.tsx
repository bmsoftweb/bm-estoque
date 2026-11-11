
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Loader2, Move, RotateCcw, Save, Scaling, X } from 'lucide-react';
import { AvisoErro, NoCanto } from '@/components/AvisoErro';
import { gravarConfigLista, lerConfigListas } from '@/lib/config-listas-cliente';

/**
 * Formulário de edição no modelo do crmWeb (RecordForm): corpo rolável em grade de 4 colunas, rótulo acima
 * de cada campo e barra de ações fixa no pé com Cancelar e Salvar. A moldura dos campos (barra de 2px à
 * esquerda: âmbar obrigatório, verde opcional) vem da regra global do globals.css.
 *
 * Layout customizável (com `id`): ícone de escala liga o "Customizar layout" (alças nos cantos e meios de
 * cada campo: largura em colunas do grid, altura do controle); o olho mostra o ícone de mover em cada
 * rótulo (arrastar para reposicionar). Concluir/esconder grava em sys_usuarios.config_listas.
 */

/** Fundo, espaçamento e tipografia dos campos de digitação (a moldura é global) */
export const INPUT_CLASS =
  'w-full bg-stone-50 dark:bg-stone-800/80 p-2 px-3 text-xs font-medium text-stone-800 dark:text-stone-100 placeholder:text-stone-400 placeholder:font-normal transition-all';
export const LABEL_CLASS = 'text-xs font-semibold text-stone-500 dark:text-stone-400';
export const HINT_CLASS = 'text-[11px] font-medium text-stone-400 dark:text-stone-500';

const COLUNAS = 4;

const SPAN: Record<number, string> = { 1: '', 2: 'sm:col-span-2', 3: 'sm:col-span-2 lg:col-span-3', 4: 'sm:col-span-2 lg:col-span-4' };

interface Tamanho {
  span?: number;
  altura?: number;
}
interface Layout {
  ordem: string[];
  tamanhos: Record<string, Tamanho>;
}
const LAYOUT_VAZIO: Layout = { ordem: [], tamanhos: {} };

const ALCAS: { dir: string; className: string }[] = [
  { dir: 'nw', className: 'top-0 left-0 -translate-x-full -translate-y-full cursor-nwse-resize' },
  { dir: 'n', className: 'top-0 left-1/2 -translate-x-1/2 -translate-y-full cursor-ns-resize' },
  { dir: 'ne', className: 'top-0 right-0 translate-x-full -translate-y-full cursor-nesw-resize' },
  { dir: 'e', className: 'top-1/2 right-0 translate-x-full -translate-y-1/2 cursor-ew-resize' },
  { dir: 'se', className: 'bottom-0 right-0 translate-x-full translate-y-full cursor-nwse-resize' },
  { dir: 's', className: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-full cursor-ns-resize' },
  { dir: 'sw', className: 'bottom-0 left-0 -translate-x-full translate-y-full cursor-nesw-resize' },
  { dir: 'w', className: 'top-1/2 left-0 -translate-x-full -translate-y-1/2 cursor-ew-resize' },
];

interface CampoCtx {
  mostrarIcones: boolean;
  iniciarArraste: (nome: string, e: React.DragEvent) => void;
  fimArraste: () => void;
}
const Ctx = createContext<CampoCtx | null>(null);

interface FormCrmProps {
  /** Identifica o formulário nas preferências de layout (sem ele, o layout não é customizável) */
  id?: string;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  saving?: boolean;
  /** Erro da gravação: aviso flutuante no canto, fecha no X ou em 10 s */
  erro?: string | null;
  onFecharErro?: () => void;
  /** Texto da esquerda da barra de ações (ex.: "Registro #12") */
  rodape?: string;
  children: React.ReactNode;
}

export const FormCrm: React.FC<FormCrmProps> = ({ id, onSubmit, onCancel, saving, erro, onFecharErro, rodape, children }) => {
  const chave = id ? `${id}_form` : null;
  const [layout, setLayout] = useState<Layout>(LAYOUT_VAZIO);
  const [customizando, setCustomizando] = useState(false);
  const [mostrarIcones, setMostrarIcones] = useState(false);
  const [alvo, setAlvo] = useState<string | null>(null);
  const [toast, setToast] = useState<{ texto: string; erro?: boolean } | null>(null);
  const grade = useRef<HTMLDivElement>(null);
  const arrastando = useRef<string | null>(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  useEffect(() => {
    if (!chave) return;
    let vivo = true;
    lerConfigListas()
      .then((tudo) => {
        const c = tudo[chave];
        if (vivo && c) setLayout({ ordem: c.ordem || [], tamanhos: c.tamanhos || {} });
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [chave]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.erro ? 10000 : 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const salvarLayout = async (l: Layout = layoutRef.current) => {
    if (!chave) return;
    try {
      await gravarConfigLista(chave, { ordem: l.ordem.length ? l.ordem : undefined, tamanhos: Object.keys(l.tamanhos).length ? l.tamanhos : undefined });
      setToast({ texto: 'Layout salvo.' });
    } catch (e: any) {
      setToast({ texto: e.message, erro: true });
    }
  };

  // Campos (<Campo>) entram na ordem do usuário; qualquer outro filho fica antes da grade de campos
  const todos = React.Children.toArray(children).filter(React.isValidElement) as React.ReactElement<CampoProps>[];
  const campos = todos.filter((el) => el.type === Campo);
  const outros = todos.filter((el) => el.type !== Campo);
  const pos = (nome: string) => {
    const i = layout.ordem.indexOf(nome);
    return i < 0 ? layout.ordem.length : i;
  };
  const ordenados = [...campos].sort((a, b) => pos(a.props.rotulo) - pos(b.props.rotulo));
  const spanDe = (el: React.ReactElement<CampoProps>) => Math.min(COLUNAS, layout.tamanhos[el.props.rotulo]?.span ?? el.props.span ?? 1);

  const iniciarArraste = (nome: string, e: React.DragEvent) => {
    arrastando.current = nome;
    e.dataTransfer.effectAllowed = 'move';
    // A "fotografia" arrastada é o campo inteiro, não só o ícone
    const campo = (e.currentTarget as HTMLElement).closest('[data-campo]');
    if (campo) e.dataTransfer.setDragImage(campo, 12, 12);
  };
  const fimArraste = () => {
    arrastando.current = null;
    setAlvo(null);
  };

  const soltarEm = (destino: string) => {
    const origem = arrastando.current;
    fimArraste();
    if (!origem || origem === destino) return;
    const nomes = ordenados.map((c) => c.props.rotulo).filter((n) => n !== origem);
    nomes.splice(nomes.indexOf(destino), 0, origem);
    setLayout((l) => ({ ...l, ordem: nomes }));
  };

  const iniciarRedimensao = (e: React.PointerEvent, nome: string, dir: string) => {
    e.preventDefault();
    e.stopPropagation();
    const g = grade.current;
    const campo = (e.currentTarget as HTMLElement).closest('[data-campo]') as HTMLElement | null;
    if (!g || !campo) return;
    const estilo = getComputedStyle(g);
    const gap = parseFloat(estilo.columnGap) || 0;
    const colunas = estilo.gridTemplateColumns.split(' ').length;
    const larguraColuna = (g.clientWidth - gap * (colunas - 1)) / colunas;
    const controle = campo.querySelector('input:not([type=file]), select, textarea') as HTMLElement | null;
    const larguraInicial = campo.offsetWidth;
    const alturaInicial = controle?.offsetHeight || 0;
    const x0 = e.clientX;
    const y0 = e.clientY;
    const sinalX = dir.includes('e') ? 1 : dir.includes('w') ? -1 : 0;
    const sinalY = dir.includes('s') ? 1 : dir.includes('n') ? -1 : 0;

    const mover = (ev: PointerEvent) => {
      const t: Tamanho = {};
      // A largura só existe no grid de COLUNAS colunas (desktop)
      if (sinalX && colunas === COLUNAS) {
        const largura = larguraInicial + sinalX * (ev.clientX - x0);
        t.span = Math.min(COLUNAS, Math.max(1, Math.round((largura + gap) / (larguraColuna + gap))));
      }
      if (sinalY && controle) t.altura = Math.max(24, Math.round(alturaInicial + sinalY * (ev.clientY - y0)));
      if (t.span !== undefined || t.altura !== undefined) setLayout((l) => ({ ...l, tamanhos: { ...l.tamanhos, [nome]: { ...l.tamanhos[nome], ...t } } }));
    };
    const soltar = () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
      document.body.style.cursor = '';
    };
    document.body.style.cursor = getComputedStyle(e.currentTarget as Element).cursor;
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
  };

  const botaoBarra = 'flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-semibold cursor-pointer transition-colors';

  return (
    <Ctx.Provider value={{ mostrarIcones, iniciarArraste, fimArraste }}>
      <form
        onSubmit={(e) => {
          // Form dentro de portal: o submit de um filho não deve gravar este formulário
          if (e.target !== e.currentTarget) return;
          e.preventDefault(); // sem isso o navegador envia o formulário e recarrega a página
          onSubmit(e);
        }}
        className="flex-1 flex flex-col min-h-0 bg-white dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800"
      >
        {/* Corpo rolável; a barra de ações fica fixa no pé da tela */}
        <div className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-5xl w-full mx-auto px-5 py-5 space-y-4">
          {chave && (
            <div className="flex justify-end gap-1 -mt-3 mb-1">
              <button
                type="button"
                onClick={() => {
                  const vazio = LAYOUT_VAZIO;
                  setLayout(vazio);
                  salvarLayout(vazio);
                }}
                title="Voltar tamanhos e posições dos campos ao padrão do app"
                className={`${botaoBarra} text-stone-400 hover:text-stone-600 dark:hover:text-stone-300`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Padrão
              </button>
              <button
                type="button"
                onClick={() => {
                  if (customizando) salvarLayout(); // "Concluir" grava
                  setCustomizando(!customizando);
                }}
                title={customizando ? 'Concluir a customização do layout' : 'Customizar o tamanho dos campos'}
                aria-pressed={customizando}
                className={`${botaoBarra} ${customizando ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-300'}`}
              >
                <Scaling className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (mostrarIcones) salvarLayout(); // esconder os ícones grava o que foi mudado
                  setMostrarIcones(!mostrarIcones);
                }}
                title={mostrarIcones ? 'Esconder os ícones de customização dos campos' : 'Mostrar os ícones de customização dos campos'}
                aria-pressed={mostrarIcones}
                className={`${botaoBarra} ${mostrarIcones ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-300'}`}
              >
                {mostrarIcones ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}

          {erro && <AvisoErro mensagem={erro} onFechar={() => onFecharErro?.()} />}
          {outros}

          <div ref={grade} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ordenados.map((el) => {
              const nome = el.props.rotulo;
              const altura = layout.tamanhos[nome]?.altura;
              const span = spanDe(el);
              return (
                <div
                  key={nome}
                  data-campo={nome}
                  onDragOver={(e) => {
                    if (!arrastando.current) return;
                    e.preventDefault();
                    if (alvo !== nome) setAlvo(nome);
                  }}
                  onDragLeave={() => setAlvo((a) => (a === nome ? null : a))}
                  onDrop={(e) => {
                    e.preventDefault();
                    soltarEm(nome);
                  }}
                  style={{ ['--span' as string]: span, ...(altura ? { ['--altura' as string]: `${altura}px` } : {}) } as React.CSSProperties}
                  className={`campo-span ${span >= 2 ? 'sm:col-span-2' : ''} ${altura ? 'campo-altura' : ''} ${customizando ? 'relative outline outline-1 outline-blue-400 outline-offset-4' : ''} ${
                    alvo === nome ? 'outline-2 outline-dashed outline-blue-400 outline-offset-2' : ''
                  }`}
                >
                  {customizando &&
                    ALCAS.map((a) => <span key={a.dir} onPointerDown={(e) => iniciarRedimensao(e, nome, a.dir)} className={`absolute z-10 w-[7px] h-[7px] bg-blue-500 ${a.className}`} />)}
                  {el}
                </div>
              );
            })}
          </div>
        </div>
        </div>

        <div className="shrink-0 px-5 py-3 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between gap-2.5 bg-stone-50 dark:bg-stone-950">
          <span className="text-[11px] text-stone-500 dark:text-stone-400 truncate">{rodape}</span>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold text-stone-600 dark:text-stone-300 border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer disabled:opacity-40"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancelar</span>
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{saving ? 'Salvando…' : 'Salvar'}</span>
            </button>
          </div>
        </div>
      </form>

      {toast && (
        <NoCanto>
          <div role="status" className={`pointer-events-auto p-3 rounded-xl shadow-2xl border text-xs ${toast.erro ? 'bg-rose-50 dark:bg-rose-950 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300' : 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300'}`}>
            {toast.texto}
          </div>
        </NoCanto>
      )}
    </Ctx.Provider>
  );
};

interface CampoProps {
  rotulo: string;
  /** Largura padrão em colunas da grade de 4 (1 a 4); padrão 1, como no crmWeb. O usuário pode mudar em "Customizar layout" */
  span?: 1 | 2 | 3 | 4;
  dica?: string;
  children: React.ReactNode;
}

/** Rótulo acima do campo (com o ícone de mover quando os ícones de customização estão visíveis) e dica opcional abaixo */
export function Campo({ rotulo, span = 1, dica, children }: CampoProps) {
  const ctx = useContext(Ctx);
  return (
    // Dentro do FormCrm a largura é do contêiner do campo; solto numa GradeCampos, é daqui
    <div className={`flex flex-col gap-1 min-w-0 ${ctx ? '' : SPAN[span]}`}>
      <div className="flex items-center gap-1.5 min-h-[18px]">
        <label className={LABEL_CLASS}>{rotulo}</label>
        {ctx?.mostrarIcones && (
          <span
            draggable
            onDragStart={(e) => ctx.iniciarArraste(rotulo, e)}
            onDragEnd={ctx.fimArraste}
            title="Arraste para reposicionar o campo"
            className="ml-auto p-0.5 rounded cursor-grab active:cursor-grabbing text-stone-300 hover:text-stone-500 dark:text-stone-600 dark:hover:text-stone-400"
          >
            <Move className="w-3.5 h-3.5" />
          </span>
        )}
      </div>
      <div className="min-w-0">{children}</div>
      {dica && <p className={HINT_CLASS}>{dica}</p>}
    </div>
  );
}

/** Grade de campos do formulário (4 colunas no desktop), para campos fora do FormCrm */
export const GradeCampos: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{children}</div>
);

/** Seção da tela: título pequeno em caixa alta e o conteúdo */
export const SecaoCrm: React.FC<{ titulo: string; direita?: React.ReactNode; children: React.ReactNode }> = ({ titulo, direita, children }) => (
  <section>
    <div className="flex items-center justify-between gap-2 mb-2">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">{titulo}</h3>
      {direita}
    </div>
    {children}
  </section>
);

interface TelaCheiaProps {
  /** Texto da esquerda da barra de ações (ex.: "Produto #12 • Composição") */
  rodape?: string;
  /** Botão da esquerda da barra (Cancelar / Voltar para a Lista) */
  onVoltar: () => void;
  rotuloVoltar?: string;
  /** Com onSubmit a tela é um formulário e ganha o botão principal (rotuloPrincipal) */
  onSubmit?: (e: React.FormEvent) => void;
  rotuloPrincipal?: string;
  iconePrincipal?: React.ReactNode;
  salvando?: boolean;
  /** Botões extras da barra, antes do Voltar (ex.: Limpar) */
  acoes?: React.ReactNode;
  /** Usa a largura toda da tela, em vez do limite de 5xl */
  larga?: boolean;
  children: React.ReactNode;
}

/**
 * Tela inteira no padrão do formulário de edição: corpo rolável, centralizado, e a barra de ações
 * fixa no pé da página. Para telas que não são um registro só (composição, variantes, filtros).
 */
export const TelaCheia: React.FC<TelaCheiaProps> = ({ rodape, onVoltar, rotuloVoltar = 'Voltar para a Lista', onSubmit, rotuloPrincipal, iconePrincipal, salvando, acoes, larga, children }) => {
  const Raiz: any = onSubmit ? 'form' : 'div';
  return (
    <Raiz
      {...(onSubmit
        ? {
            onSubmit: (e: React.FormEvent) => {
              if (e.target !== e.currentTarget) return;
              e.preventDefault(); // sem isso o navegador envia o formulário e recarrega a página
              onSubmit(e);
            },
          }
        : {})}
      className="flex-1 flex flex-col min-h-0 bg-white dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800"
    >
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className={(larga ? "" : "max-w-5xl mx-auto ") + "w-full px-5 py-5 space-y-5"}>{children}</div>
      </div>
      <div className="shrink-0 px-5 py-3 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between gap-2.5 bg-stone-50 dark:bg-stone-950">
        <span className="text-[11px] text-stone-500 dark:text-stone-400 truncate">{rodape}</span>
        <div className="flex items-center gap-2.5 shrink-0">
          {acoes}
          <button
            type="button"
            onClick={onVoltar}
            disabled={salvando}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold text-stone-600 dark:text-stone-300 border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer disabled:opacity-40"
          >
            <X className="w-3.5 h-3.5" />
            <span>{rotuloVoltar}</span>
          </button>
          {onSubmit && (
            <button
              type="submit"
              disabled={salvando}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : iconePrincipal}
              <span>{rotuloPrincipal}</span>
            </button>
          )}
        </div>
      </div>
    </Raiz>
  );
};

/** Resumo do registro-pai no alto das telas de composição e variantes */
export const ResumoRegistro: React.FC<{ titulo: string; nome?: string; sku?: string; id?: number | string; descricao?: string }> = ({ titulo, nome, sku, id, descricao }) => (
  <div className="rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950/40 px-4 py-3">
    <div className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">{titulo}</div>
    <div className="mt-0.5 text-sm font-bold text-stone-900 dark:text-stone-100">{nome}</div>
    <div className="mt-0.5 flex items-center gap-3 text-[11px] text-stone-500 dark:text-stone-400">
      {sku && <span className="font-mono">SKU {sku}</span>}
      {id !== undefined && <span className="font-mono">#{id}</span>}
    </div>
    {descricao && <p className="mt-2 text-xs italic text-stone-500 dark:text-stone-400">{descricao}</p>}
  </div>
);
