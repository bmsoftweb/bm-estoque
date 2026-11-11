import React, { useEffect, useState } from 'react';
import { useRouter } from '@/lib/nav';
import { useRefreshDaTela } from '@/components/LayoutApp';
import { formatNumber } from '@/lib/utils';
import { motion } from 'motion/react';
import { AlertTriangle, CalendarDays, CalendarPlus, Loader2, Package } from 'lucide-react';

interface Item {
  nome: string;
  total: number;
}
interface Dados {
  total: number;
  novosSemana: number;
  novosHoje: number;
  precosDesatualizados: number;
  porCategoria: Item[];
  porMarca: Item[];
}

const TOP = 10;

/** Cada card: rótulo, número, legenda e o ícone com a cor do tema */
const Card: React.FC<{ rotulo: string; valor: number; legenda: string; icone: React.ReactNode; cor: string; atraso: number }> = ({ rotulo, valor, legenda, icone, cor, atraso }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: atraso }}
    className="bg-elegant-card border border-elegant-border p-5 rounded-xl shadow-sm flex items-start justify-between gap-3"
  >
    <div className="min-w-0">
      <p className="text-xs text-elegant-text-label uppercase tracking-wide">{rotulo}</p>
      <p className="mt-2 text-[28px] leading-none font-semibold text-elegant-text-bright tracking-tight">{formatNumber(valor, 0)}</p>
      <p className="mt-2 text-[11px] text-elegant-text-label">{legenda}</p>
    </div>
    <div className={'p-2.5 rounded-lg bg-elegant-accent-bg ' + cor}>{icone}</div>
  </motion.div>
);

/** Gráfico de barras horizontais: as 10 maiores e, se sobrar, "Outras" somando o resto */
const Barras: React.FC<{ titulo: string; itens: Item[] }> = ({ titulo, itens }) => {
  const resto = itens.slice(TOP).reduce((s, i) => s + i.total, 0);
  const lista = resto > 0 ? [...itens.slice(0, TOP), { nome: `Outras (${itens.length - TOP})`, total: resto }] : itens;
  const max = Math.max(1, ...lista.map((i) => i.total));
  const soma = lista.reduce((s, i) => s + i.total, 0);
  return (
    <div className="bg-elegant-card border border-elegant-border rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-elegant-border flex items-center justify-between">
        <h2 className="text-base font-semibold text-elegant-text-bright">{titulo}</h2>
        <span className="text-xs text-elegant-text-label">{formatNumber(soma, 0)} produtos</span>
      </div>
      {lista.length === 0 ? (
        <p className="px-6 py-8 text-center text-xs text-elegant-text-label">Nenhum produto cadastrado.</p>
      ) : (
        <ul className="px-6 py-4 flex flex-col gap-2.5">
          {lista.map((i) => (
            <li key={i.nome} className="grid grid-cols-[minmax(0,10rem)_1fr_3rem] items-center gap-3 text-xs">
              <span className="truncate text-elegant-text-muted" title={i.nome}>{i.nome}</span>
              <span className="h-5 rounded bg-black/5 dark:bg-white/5 overflow-hidden">
                <motion.span
                  initial={{ width: 0 }}
                  animate={{ width: `${(i.total / max) * 100}%` }}
                  transition={{ duration: 0.5 }}
                  className="block h-full rounded bg-elegant-accent"
                />
              </span>
              <span className="text-right font-mono text-elegant-text-bright">{formatNumber(i.total, 0)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default function Dashboard() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();

  const carregar = async () => {
    try {
      const r = await fetch('/api/dashboard');
      if (r.status === 401) return router.push('/');
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Não foi possível carregar o dashboard.');
      setDados(d);
      setErro(null);
    } catch (e: any) {
      setErro(e.message);
    }
  };

  useEffect(() => {
    carregar();
  }, []);
  useRefreshDaTela(carregar);

  if (!dados) {
    return (
      <div className="flex-1 flex items-center justify-center">
        {erro ? <p className="text-sm text-red-600">{erro}</p> : <Loader2 className="animate-spin text-elegant-text-label" size={32} />}
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="p-10 flex flex-col gap-8 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          <Card rotulo="Total de produtos" valor={dados.total} legenda="Todos os cadastrados" icone={<Package size={20} />} cor="text-elegant-accent" atraso={0} />
          <Card rotulo="Novos esta semana" valor={dados.novosSemana} legenda="Cadastrados desde segunda-feira" icone={<CalendarDays size={20} />} cor="text-green-500" atraso={0.05} />
          <Card rotulo="Novos hoje" valor={dados.novosHoje} legenda="Cadastrados hoje" icone={<CalendarPlus size={20} />} cor="text-purple-500" atraso={0.1} />
          <Card rotulo="Preços desatualizados" valor={dados.precosDesatualizados} legenda="Sem alteração há mais de 30 dias" icone={<AlertTriangle size={20} />} cor="text-orange-500" atraso={0.15} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <Barras titulo="Produtos por categoria" itens={dados.porCategoria} />
          <Barras titulo="Produtos por marca" itens={dados.porMarca} />
        </div>
      </div>
    </div>
  );
}
