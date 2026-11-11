import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';
import { INPUT_CLASS } from '@/components/FormCrm';

/**
 * Seleção de vários valores com busca, mostrados como etiquetas: critérios das listas de preço (cidades, vendedores…).
 * Três fontes: o cadastro do banco (tipo → /api/precos/opcoes), uma lista fixa (UF) ou texto livre (canal).
 */

export interface Opcao {
  valor: string;
  rotulo: string;
}

interface Props {
  value: string[];
  onChange: (v: string[]) => void;
  /** Cadastro do banco: tipo_cliente, regiao, cidade, vendedor, cliente, categoria, marca, produto */
  tipo?: string;
  /** Lista fixa (ex.: UFs) */
  fixas?: Opcao[];
  /** Texto livre: Enter adiciona o que foi digitado (ex.: canal de venda) */
  livre?: boolean;
  /** Só um valor (escolher outro troca) */
  unico?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

const buscar = (tipo: string, params: Record<string, string>) => fetch('/api/precos/opcoes?' + new URLSearchParams({ tipo, ...params }).toString()).then((r) => r.json());

export const SelecaoMultipla: React.FC<Props> = ({ value, onChange, tipo, fixas, livre, unico, placeholder, disabled }) => {
  const [rotulos, setRotulos] = useState<Record<string, string>>({});
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [itens, setItens] = useState<Opcao[]>([]);
  const [semTabela, setSemTabela] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [destaque, setDestaque] = useState(0);
  const fechar = useRef<ReturnType<typeof setTimeout> | null>(null);
  const campo = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<React.CSSProperties | null>(null);

  // A lista abre fora da árvore (portal, position fixed): tabela ou tela com rolagem não a cortam. Abre para cima se não couber.
  useLayoutEffect(() => {
    if (!aberto) return;
    const posicionar = () => {
      const r = campo.current?.getBoundingClientRect();
      if (!r) return;
      const abaixo = window.innerHeight - r.bottom;
      const paraCima = abaixo < 250 && r.top > abaixo;
      setPos({ position: 'fixed', left: r.left, width: r.width, ...(paraCima ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }) });
    };
    posicionar();
    window.addEventListener('scroll', posicionar, true);
    window.addEventListener('resize', posicionar);
    return () => {
      window.removeEventListener('scroll', posicionar, true);
      window.removeEventListener('resize', posicionar);
    };
  }, [aberto]);

  // Rótulos dos valores já escolhidos (só o id vem gravado)
  const faltando = value.filter((v) => !(v in rotulos) && !(fixas && fixas.some((f) => f.valor === v)) && !livre);
  const chaveFalta = faltando.join(',');
  useEffect(() => {
    if (!tipo || !faltando.length) return;
    let vivo = true;
    buscar(tipo, { ids: faltando.join(',') })
      .then((r) => {
        if (!vivo || !Array.isArray(r)) return;
        setRotulos((a) => ({ ...a, ...Object.fromEntries(r.map((o: Opcao) => [o.valor, o.rotulo])) }));
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveFalta, tipo]);

  // Resultados da lista aberta
  useEffect(() => {
    if (!aberto) return;
    if (fixas) {
      const t = busca.trim().toLowerCase();
      setItens(fixas.filter((o) => !value.includes(o.valor) && (!t || o.rotulo.toLowerCase().includes(t) || o.valor.toLowerCase().includes(t))));
      setDestaque(0);
      return;
    }
    if (!tipo) return;
    setCarregando(true);
    const t = setTimeout(() => {
      buscar(tipo, { q: busca.trim() })
        .then((r) => {
          if (r?.semTabela) {
            setSemTabela(r.tabela);
            setItens([]);
            return;
          }
          setSemTabela(null);
          setItens((Array.isArray(r) ? r : []).filter((o: Opcao) => !value.includes(o.valor)));
          setRotulos((a) => ({ ...a, ...Object.fromEntries((Array.isArray(r) ? r : []).map((o: Opcao) => [o.valor, o.rotulo])) }));
          setDestaque(0);
        })
        .catch(() => setItens([]))
        .finally(() => setCarregando(false));
    }, busca ? 250 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, busca, tipo, value.join(',')]);

  const adicionar = (v: string, rotulo?: string) => {
    const limpo = v.trim();
    if (!limpo || value.includes(limpo)) return;
    if (rotulo) setRotulos((a) => ({ ...a, [limpo]: rotulo }));
    onChange(unico ? [limpo] : [...value, limpo]);
    setBusca('');
    if (unico) setAberto(false);
  };
  const rotuloDe = (v: string) => rotulos[v] ?? fixas?.find((f) => f.valor === v)?.rotulo ?? v;

  return (
    <div className="relative">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {value.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 max-w-full px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-[11px] font-medium text-blue-800 dark:text-blue-300">
              <span className="truncate">{rotuloDe(v)}</span>
              {!disabled && (
                <button type="button" title="Remover" onClick={() => onChange(value.filter((x) => x !== v))} className="shrink-0 text-blue-500 hover:text-rose-600 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {!(unico && value.length) && (
        <div ref={campo} className="relative">
          <input
            type="text"
            disabled={disabled}
            value={busca}
            placeholder={placeholder ?? (livre ? 'Digite e tecle Enter…' : 'Pesquisar para adicionar…')}
            onFocus={() => {
              if (fechar.current) clearTimeout(fechar.current);
              setAberto(true);
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
              } else if (e.key === 'Enter') {
                e.preventDefault();
                if (livre) adicionar(busca);
                else if (aberto && itens[destaque]) adicionar(itens[destaque].valor, itens[destaque].rotulo);
              }
            }}
            className={INPUT_CLASS + (disabled ? ' opacity-50 cursor-not-allowed' : '')}
          />
          {carregando && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-stone-400" />}
        </div>
      )}
      {aberto && !disabled && !livre && pos && createPortal(
        <div style={pos} className="z-[60] max-h-60 overflow-y-auto rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-xl">
          {semTabela ? (
            <div className="px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400">O cadastro ainda não existe no banco (tabela {semTabela}). Rode o script das listas de preço.</div>
          ) : itens.length === 0 ? (
            <div className="px-3 py-2 text-[11px] text-stone-500 dark:text-stone-400">{carregando ? 'Procurando…' : 'Nenhum resultado.'}</div>
          ) : (
            itens.map((o, i) => (
              <button
                key={o.valor}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => adicionar(o.valor, o.rotulo)}
                onMouseEnter={() => setDestaque(i)}
                className={'w-full text-left px-3 py-1.5 text-xs cursor-pointer text-stone-700 dark:text-stone-200 ' + (i === destaque ? 'bg-blue-50 dark:bg-blue-950/40' : '')}
              >
                {o.rotulo}
              </button>
            ))
          )}
        </div>,
        document.body,
      )}
    </div>
  );
};
