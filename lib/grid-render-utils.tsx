import React from 'react';
import { GridColumnConfig } from '@/lib/grid-config';
import { formatCurrency, formatNumber } from '@/lib/utils';

export const renderCellContent = (value: any, config: GridColumnConfig | undefined) => {
  if (value === null || value === undefined) return '-';

  const style = config?.estilo_apresentacao || 'Normal';
  const type = config?.tipo_apresentacao || 'texto';
  
  let content = value.toString();
  
  if (type === 'numero') content = formatCurrency(parseFloat(value) || 0);
  if (type === 'inteiro') content = formatNumber(parseInt(value) || 0, 0);

  if (style === 'Tag') {
    const tagText = content.toUpperCase();
    let tagClasses = "bg-elegant-accent/10 text-elegant-accent border-elegant-accent/20";
    if (tagText === 'SIM') tagClasses = "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
    else if (tagText === 'NÃO') tagClasses = "bg-red-500/10 text-red-500 border-red-500/20";
    
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-tight whitespace-nowrap ${tagClasses}`}>
        {content}
      </span>
    );
  }

  if (style === 'Destaque') {
    return <span className="font-bold underline decoration-elegant-accent/30 underline-offset-4 text-elegant-text-bright">{content}</span>;
  }

  return content;
};

export const calculateColumnTotal = (data: any[], colKey: string, config: GridColumnConfig | undefined) => {
  const totalizer = config?.totalizador || 'Nenhum';
  if (totalizer === 'Nenhum') return '';
  if (totalizer === 'Contagem') return data.length.toString();

  const numericValues = data.map(item => {
    let val = item[colKey];
    if (config?.tabela_display && item[`${colKey}_display`] !== undefined) val = item[`${colKey}_display`];
    
    if (typeof val === 'number') return val;
    const clean = String(val || '0').replace('R$', '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
    return parseFloat(clean);
  }).filter(v => !isNaN(v));

  if (numericValues.length === 0) return '-';
  const sum = numericValues.reduce((a, b) => a + b, 0);
  const result = totalizer === 'Soma' ? sum : sum / numericValues.length;

  return config?.tipo_apresentacao === 'numero' ? formatCurrency(result) : formatNumber(result, 2);
};
