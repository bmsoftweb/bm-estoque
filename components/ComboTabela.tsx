import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Loader2, X } from 'lucide-react';
import { INPUT_CLASS } from '@/components/FormCrm';

/**
 * Lista com pesquisa para campos cujo valor vem de uma tabela (NCM, CEST, serviço, NBS): digita para filtrar por
 * código ou descrição e escolhe na lista, em vez de digitar o código à mão. Busca em /api/fiscal?tipo=buscar.
 */

export type TabelaFiscal = 'ncm' | 'cest' | 'servico' | 'nbs';

/** Código só com dígitos -> como a norma escreve */
export const FORMATOS: Record<TabelaFiscal, (c: string) => string> = {
  ncm: (c) => c.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1.$2.$3'),
  cest: (c) => c.replace(/^(\d{2})(\d{3})(\d{2})$/, '$1.$2.$3'),
  servico: (c) => c.replace(/^(\d{2})(\d{2})(\d{2})$/, '$1.$2.$3'),
  nbs: (c) => c.replace(/^(\d)(\d{4})(\d{2})(\d{2})$/, '$1.$2.$3.$4'),
};

interface Item {
  codigo: string;
  descricao: string;
}

interface Props {
  tabela: TabelaFiscal;
  value: string | null | undefined;
  onChange: (codigo: string | null) => void;
  disabled?: boolean;
  title?: string;
  placeholder?: string;
  /** Parâmetros extras da busca (ex.: item da LC 116 para a NBS, NCM para o CEST) */
  extra?: Record<string, string>;
  /** Abre a lista já com as opções sugeridas, sem precisar digitar (ex.: CEST do NCM) */
  sugerirAoAbrir?: boolean;
  required?: boolean;
}

const url = (tabela: string, params: Record<string, string>) => '/api/fiscal?' + new URLSearchParams({ tipo: 'buscar', tabela, ...params }).toString();

export const ComboTabela: React.FC<Props> = ({ tabela, value, onChange, disabled, title, placeholder, extra, sugerirAoAbrir, required }) => {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [itens, setItens] = useState<Item[]>([]);
  const [semTabela, setSemTabela] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [destaque, setDestaque] = useState(0);
  // Descrição do valor atual: null = ainda consultando, '' = código que não está na tabela
  const [descricao, setDescricao] = useState<string | null>(null);
  const fechar = useRef<ReturnType<typeof setTimeout> | null>(null);
  const extraKey = JSON.stringify(extra ?? {});
  const fmt = FORMATOS[tabela];

  useEffect(() => {
    if (!value) return setDescricao(null);
    let vivo = true;
    setDescricao(null);
    fetch(url(tabela, { codigo: value, ...(extra ?? {}) }))
      .then((r) => r.json())
      .then((r) => vivo && setDescricao(Array.isArray(r) && r[0] ? r[0].descricao : ''))
      .catch(() => vivo && setDescricao(''));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, tabela]);

  useEffect(() => {
    if (!aberto) return;
    if (!busca.trim() && !sugerirAoAbrir && tabela !== 'nbs') {
      setItens([]);
      return;
    }
    setCarregando(true);
    const t = setTimeout(() => {
      fetch(url(tabela, { q: busca.trim(), ...(extra ?? {}) }))
        .then((r) => r.json())
        .then((r) => {
          setSemTabela(Boolean(r?.semTabela));
          setItens(Array.isArray(r) ? r : []);
          setDestaque(0);
        })
        .catch(() => setItens([]))
        .finally(() => setCarregando(false));
    }, busca ? 250 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, busca, tabela, extraKey, sugerirAoAbrir]);

  const escolher = (it: Item) => {
    onChange(it.codigo);
    setAberto(false);
    setBusca('');
  };

  const exibicao = value ? fmt(value) + (descricao ? ' — ' + descricao : descricao === '' ? ' (fora da tabela)' : '') : '';

  return (
    <div className="relative">
      <div className="relative">
        <input
          type="text"
          required={required && !value}
          disabled={disabled}
          title={title}
          value={aberto ? busca : exibicao}
          placeholder={aberto ? 'Digite o código ou parte da descrição…' : placeholder ?? 'Selecione…'}
          onFocus={(e) => {
            if (fechar.current) clearTimeout(fechar.current);
            setAberto(true);
            setBusca('');
            e.target.select();
          }}
          onBlur={() => {
            fechar.current = setTimeout(() => setAberto(false), 150);
          }}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setAberto(false);
            else if (e.key === 'ArrowDown') {
              e.preventDefault();
              setDestaque((d) => Math.min(d + 1, itens.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setDestaque((d) => Math.max(d - 1, 0));
            } else if (e.key === 'Enter' && aberto && itens[destaque]) {
              e.preventDefault();
              escolher(itens[destaque]);
            }
          }}
          className={INPUT_CLASS + ' pr-14 truncate' + (aberto ? '' : ' font-mono') + (disabled ? ' opacity-50 cursor-not-allowed' : '')}
        />
        <div className="absolute inset-y-0 right-0 flex items-center gap-0.5 pr-2 text-stone-400">
          {carregando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {value && !disabled && (
            <button type="button" tabIndex={-1} title="Limpar" onMouseDown={(e) => e.preventDefault()} onClick={() => onChange(null)} className="p-0.5 rounded hover:text-rose-600 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className="w-3.5 h-3.5 pointer-events-none" />
        </div>
      </div>

      {aberto && !disabled && (
        <div className="absolute z-30 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-xl">
          {semTabela ? (
            <div className="px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400">Tabela ainda não carregada no banco.</div>
          ) : itens.length === 0 ? (
            <div className="px-3 py-2 text-[11px] text-stone-500 dark:text-stone-400">
              {carregando ? 'Procurando…' : busca.trim() || sugerirAoAbrir ? 'Nenhum resultado.' : 'Digite para pesquisar.'}
            </div>
          ) : (
            itens.map((it, i) => (
              <button
                key={it.codigo}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => escolher(it)}
                onMouseEnter={() => setDestaque(i)}
                className={'w-full text-left px-3 py-1.5 text-xs flex gap-2 cursor-pointer ' + (i === destaque ? 'bg-blue-50 dark:bg-blue-950/40' : '') + (it.codigo === value ? ' font-semibold' : '')}
              >
                <span className="font-mono shrink-0 text-stone-800 dark:text-stone-100">{fmt(it.codigo)}</span>
                <span className="text-stone-600 dark:text-stone-300 line-clamp-2">{it.descricao}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};
