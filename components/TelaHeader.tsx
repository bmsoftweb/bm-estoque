
import React from 'react';
import { FilePlus2, FileText, List, RefreshCw, X } from 'lucide-react';

/** Cabeçalho da tela, igual ao do Romaneio: empresa • título, subtítulo e o botão de recarregar à direita */
export const TelaHeader: React.FC<{ titulo: string; subtitulo: string; empresaNome?: string; onRefresh?: () => void }> = ({ titulo, subtitulo, empresaNome, onRefresh }) => (
  <header className="h-[var(--altura-topo)] shrink-0 z-20 bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800">
    <div className="h-full pl-14 pr-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100 leading-tight truncate">
          {empresaNome && (
            <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mr-2 hidden sm:inline">{empresaNome} •</span>
          )}
          {titulo}
        </h2>
        <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate hidden sm:block">{subtitulo}</p>
      </div>
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          title="Recarregar os dados desta tela"
          className="p-2 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer shrink-0"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      )}
    </div>
  </header>
);

export interface AbaCrm {
  key: string;
  titulo: string;
  /** Inclusão (ícone de arquivo novo) em vez de edição */
  novo?: boolean;
}

/**
 * Barra de abas do Romaneio (MDI): a aba fixa da lista (nome + total) e as abas dos registros abertos, com "x" para
 * fechar. Só aparece quando há alguma aba aberta, para a lista não exibir uma "orelha" solitária.
 */
export const AbasCrm: React.FC<{
  lista: string;
  total?: number;
  abas: AbaCrm[];
  /** Chave da aba ativa; null = a lista */
  ativa: string | null;
  onAtivar: (key: string | null) => void;
  onFechar: (key: string) => void;
  /** Barra MDI invisível por padrão (regra do projeto); só liga se o usuário pedir para ficar visível */
  visivel?: boolean;
}> = ({ lista, total, abas, ativa, onAtivar, onFechar, visivel = false }) => {
  if (!visivel || !abas.length) return null;
  return (
    <div className="flex items-stretch bg-stone-100 dark:bg-stone-950 border-b border-stone-200 dark:border-stone-800 overflow-x-auto overflow-y-hidden shrink-0">
      <button
        type="button"
        onClick={() => onAtivar(null)}
        className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-r border-stone-200 dark:border-stone-800 border-b-2 transition-colors cursor-pointer ${
          ativa === null
            ? 'bg-white dark:bg-stone-900 text-blue-700 dark:text-blue-400 border-b-blue-600'
            : 'border-b-transparent text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800/60'
        }`}
      >
        <List className="w-3.5 h-3.5" />
        <span>{lista}</span>
        {total !== undefined && <span className="text-[10px] font-mono text-stone-400">{total}</span>}
      </button>

      {abas.map((aba) => {
        const ativaAba = ativa === aba.key;
        return (
          <div
            key={aba.key}
            className={`flex items-center gap-1.5 pl-4 pr-2 border-r border-stone-200 dark:border-stone-800 border-b-2 transition-colors ${
              ativaAba ? 'bg-white dark:bg-stone-900 border-b-blue-600' : 'border-b-transparent hover:bg-stone-200/60 dark:hover:bg-stone-800/60'
            }`}
          >
            <button
              type="button"
              onClick={() => onAtivar(aba.key)}
              className={`flex items-center gap-2 py-2.5 text-xs font-semibold whitespace-nowrap cursor-pointer ${ativaAba ? 'text-blue-700 dark:text-blue-400' : 'text-stone-600 dark:text-stone-400'}`}
            >
              {aba.novo ? <FilePlus2 className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
              <span>{aba.titulo}</span>
            </button>
            <button
              type="button"
              onClick={() => onFechar(aba.key)}
              title="Fechar aba"
              className="p-1 rounded text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:text-rose-400 dark:hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
