import { useState, useMemo } from 'react';
import { GridColumnConfig } from '../lib/grid-config';

export function useDynamicGrid<T>(data: T[], gridConfigs: GridColumnConfig[], gridId: string) {
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | 'none' }>({ 
    key: '', 
    direction: 'none' 
  });

  const sortedData = useMemo(() => {
    if (sortConfig.direction === 'none' || !sortConfig.key) return data;

    return [...data].sort((a, b) => {
      const config = gridConfigs.find(c => c.nome_do_grid === gridId && c.nome_da_coluna === sortConfig.key);
      const isNumeric = config?.tipo_apresentacao === 'numero' || config?.tipo_apresentacao === 'inteiro';
      
      let aVal = (a as any)[sortConfig.key];
      let bVal = (b as any)[sortConfig.key];

      if (config?.tabela_display) {
        aVal = (a as any)[`${sortConfig.key}_display`] ?? aVal;
        bVal = (b as any)[`${sortConfig.key}_display`] ?? bVal;
      }

      if (isNumeric) {
        const nA = parseFloat(String(aVal).replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
        const nB = parseFloat(String(bVal).replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
        return sortConfig.direction === 'asc' ? nA - nB : nB - nA;
      }

      const sA = String(aVal || '').toLowerCase();
      const sB = String(bVal || '').toLowerCase();
      return sortConfig.direction === 'asc' ? sA.localeCompare(sB) : sB.localeCompare(sA);
    });
  }, [data, sortConfig, gridConfigs, gridId]);

  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (current.key === key) {
        if (current.direction === 'none') return { key, direction: 'asc' };
        if (current.direction === 'asc') return { key, direction: 'desc' };
        return { key: '', direction: 'none' };
      }
      return { key, direction: 'asc' };
    });
  };

  return { sortedData, sortConfig, handleSort };
}
