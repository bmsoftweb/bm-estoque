import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Search, X } from 'lucide-react';
import { INPUT_CLASS } from '@/components/FormCrm';

/**
 * Modal de pesquisa padrão do app: título, campo de busca e tabela no mesmo visual da ListaCrm.
 * Clique (ou setas + Enter) escolhe; Esc, X ou clique fora fecham.
 * Busca local (filtrar) ou no servidor (onBusca + carregando: quem chama faz o fetch).
 */
export interface ColunaPesquisa<T> {
  label: string;
  render: (l: T) => React.ReactNode;
  alinhar?: 'esquerda' | 'centro' | 'direita';
  /** classe de largura do Tailwind (ex.: 'w-28'); sem ela a coluna ocupa o que sobra */
  largura?: string;
}

interface Props<T> {
  titulo: string;
  placeholder?: string;
  itens: T[];
  chave: (l: T) => string | number;
  colunas: ColunaPesquisa<T>[];
  /** Busca local: o modal filtra os itens pelo texto digitado */
  filtrar?: (l: T, termo: string) => boolean;
  /** Busca no servidor: recebe o texto a cada mudança */
  onBusca?: (termo: string) => void;
  carregando?: boolean;
  /** Motivo para não poder escolher o item (aparece apagado, com o motivo no tooltip) */
  bloqueado?: (l: T) => string | null;
  onEscolher: (l: T) => void;
  onFechar: () => void;
  vazio?: string;
  rodape?: string;
}

const ALINHA = { esquerda: 'text-left', centro: 'text-center', direita: 'text-right' };

export function ModalPesquisa<T>({ titulo, placeholder, itens, chave, colunas, filtrar, onBusca, carregando, bloqueado, onEscolher, onFechar, vazio, rodape }: Props<T>) {
  const [busca, setBusca] = useState('');
  const [destaque, setDestaque] = useState(0);
  const corpo = useRef<HTMLTableSectionElement>(null);

  const termo = busca.trim().toLowerCase();
  const linhas = filtrar && termo ? itens.filter((l) => filtrar(l, termo)) : itens;

  useEffect(() => setDestaque(0), [busca, itens]);
  // Esc fecha mesmo com o foco fora do campo (ex.: depois de rolar a lista com o mouse)
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onFechar]);
  useEffect(() => {
    corpo.current?.children[destaque]?.scrollIntoView({ block: 'nearest' });
  }, [destaque]);

  const escolher = (l: T | undefined) => {
    if (l && !bloqueado?.(l)) onEscolher(l);
  };

  const TH = 'sticky top-0 z-10 px-3 py-2.5 font-semibold text-center text-stone-600 dark:text-stone-300 whitespace-nowrap border-b border-r last:border-r-0 border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950';
  const TD = 'px-3 py-[7.5px] border-b border-r last:border-r-0 border-stone-200 dark:border-stone-800 text-stone-800 dark:text-stone-200';

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-stone-950/70 backdrop-blur-xs" onClick={onFechar} aria-hidden="true" />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-2xl z-10 p-5 flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">{titulo}</h3>
          <button type="button" title="Fechar" onClick={onFechar} className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400 pointer-events-none" />
          <input
            autoFocus
            type="text"
            value={busca}
            placeholder={placeholder ?? 'Pesquisar…'}
            onFocus={(e) => e.target.select()}
            onChange={(e) => {
              setBusca(e.target.value);
              onBusca?.(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setDestaque((d) => Math.min(d + 1, linhas.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setDestaque((d) => Math.max(d - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                escolher(linhas[destaque]);
              }
            }}
            className={INPUT_CLASS + ' pl-8'}
          />
          {carregando && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-stone-400" />}
        </div>
        <div className="mt-3 overflow-y-auto rounded-lg border border-stone-200 dark:border-stone-800 min-h-[200px]">
          <table className="w-full text-xs border-separate border-spacing-0">
            <thead>
              <tr>
                {colunas.map((c) => (
                  <th key={c.label} className={TH + ' ' + (c.largura ?? '')}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody ref={corpo}>
              {linhas.map((l, i) => {
                const motivo = bloqueado?.(l) ?? null;
                return (
                  <tr
                    key={chave(l)}
                    onClick={() => escolher(l)}
                    onMouseEnter={() => setDestaque(i)}
                    title={motivo ?? undefined}
                    className={(motivo ? 'opacity-40 cursor-not-allowed ' : 'cursor-pointer ') + (i === destaque ? 'bg-blue-50 dark:bg-blue-950/40' : 'bg-white dark:bg-stone-900')}
                  >
                    {colunas.map((c) => (
                      <td key={c.label} className={TD + ' ' + ALINHA[c.alinhar ?? 'esquerda']}>{c.render(l)}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!carregando && linhas.length === 0 && <div className="px-4 py-10 text-center text-stone-500 dark:text-stone-400 text-sm">{vazio ?? 'Nenhum resultado.'}</div>}
        </div>
        <p className="mt-2 text-[11px] text-stone-500 dark:text-stone-400">{rodape ?? 'Clique ou use as setas e Enter para escolher; Esc fecha.'}</p>
      </div>
    </div>,
    document.body,
  );
}
