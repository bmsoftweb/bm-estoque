
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Settings, 
  ChevronUp, 
  ChevronDown, 
  Minus, 
  Search,
  Plus,
  Loader2,
  Trash2,
  Save,
  X,
  Maximize,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GridColumnConfig } from '../lib/grid-config';
import { renderCellContent, calculateColumnTotal } from '../lib/grid-render-utils';

interface DataGridProps<T> {
  gridId: string;
  moduleName: string;
  data: T[];
  schema: { key: string; label: string; type?: string }[];
  gridConfigs: GridColumnConfig[];
  onSaveConfigs: (configs: GridColumnConfig[]) => Promise<void>;
  onRefresh: () => void;
  onEdit: (item: T) => void;
  onDelete: (item: T) => void;
  onCreate: () => void;
  isLoading?: boolean;
}

export function StandardDataGrid<T extends { id: string | number }>({ 
  gridId, 
  moduleName,
  data, 
  schema,
  gridConfigs,
  onSaveConfigs,
  onRefresh,
  onEdit,
  onDelete,
  onCreate,
  isLoading
}: DataGridProps<T>) {
  const [activeTab, setActiveTab] = useState<'grid' | 'filter'>('grid');
  const [activeGridColumns, setActiveGridColumns] = useState<string[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [resizingCol, setResizingCol] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | 'none' }>({ key: '', direction: 'none' });
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // Initialize columns
  useEffect(() => {
    const gridCols = gridConfigs.filter(c => c.nome_do_grid === gridId);
    if (gridCols.length > 0) {
      const visible = gridCols
        .filter(c => c.visivel)
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
        .map(c => c.nome_da_coluna);
      setActiveGridColumns(visible);
      
      const widths: Record<string, number> = {};
      gridCols.forEach(c => {
        if (c.largura_da_coluna) {
          widths[c.nome_da_coluna] = parseInt(c.largura_da_coluna);
        }
      });
      setColumnWidths(widths);
    } else {
      setActiveGridColumns(schema.slice(0, 8).map(s => s.key));
    }
  }, [gridConfigs, gridId, schema]);

  // Sort logic
  const sortedData = useMemo(() => {
    if (sortConfig.direction === 'none' || !sortConfig.key) return data;
    return [...data].sort((a, b) => {
      const aVal = (a as any)[sortConfig.key];
      const bVal = (b as any)[sortConfig.key];
      const sA = String(aVal || '').toLowerCase();
      const sB = String(bVal || '').toLowerCase();
      if (sA < sB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (sA > sB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortConfig]);

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

  // Drag and Drop
  const handleDragStart = (e: React.DragEvent, col: string) => {
    setDraggedColumn(col);
  };

  const handleDrop = (e: React.DragEvent, targetCol: string) => {
    e.preventDefault();
    if (draggedColumn && draggedColumn !== targetCol) {
      const newCols = [...activeGridColumns];
      const idx1 = newCols.indexOf(draggedColumn);
      const idx2 = newCols.indexOf(targetCol);
      newCols.splice(idx1, 1);
      newCols.splice(idx2, 0, draggedColumn);
      setActiveGridColumns(newCols);
    }
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  // Resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (resizingCol) {
        const header = document.querySelector(`[data-col="${resizingCol}"]`) as HTMLElement;
        if (header) {
          const newWidth = e.clientX - header.getBoundingClientRect().left;
          setColumnWidths(prev => ({ ...prev, [resizingCol]: Math.max(newWidth, 50) }));
        }
      }
    };
    const handleMouseUp = () => setResizingCol(null);
    if (resizingCol) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingCol]);

  return (
    <div className="flex flex-col h-full bg-elegant-card rounded-xl border border-elegant-border overflow-hidden">
        {/* Barra de Ferramentas */}
        <div className="p-4 border-b border-elegant-border flex items-center justify-between bg-elegant-card/50">
           <div className="flex items-center gap-3">
              <button 
                onClick={() => setActiveTab('grid')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'grid' ? 'bg-elegant-accent text-white shadow-lg shadow-elegant-accent/20' : 'text-elegant-text-muted hover:bg-elegant-accent/10'}`}
              >
                Visualização
              </button>
              <button 
                onClick={() => setActiveTab('filter')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'filter' ? 'bg-elegant-accent text-white shadow-lg shadow-elegant-accent/20' : 'text-elegant-text-muted hover:bg-elegant-accent/10'}`}
              >
                Filtros Avançados
              </button>
           </div>

           <div className="flex items-center gap-2">
              <button onClick={onCreate} className="p-2 bg-elegant-accent text-white rounded-lg hover:brightness-110 transition-all shadow-lg shadow-elegant-accent/20">
                <Plus size={18} />
              </button>
              <button onClick={() => setIsConfigOpen(true)} className="p-2 text-elegant-text-muted hover:bg-elegant-accent/10 rounded-lg transition-colors">
                <Settings size={18} />
              </button>
           </div>
        </div>

        {/* Área Principal */}
        <div className="flex-1 overflow-auto relative custom-scrollbar">
           {activeTab === 'grid' ? (
             <table className="w-full border-collapse" data-grid={gridId}>
                <thead className="sticky top-0 z-20 bg-elegant-card/95 backdrop-blur-sm">
                  <tr>
                    <th className="w-10 px-2 py-3 border-b border-r border-elegant-border"></th>
                    {activeGridColumns.map((col, idx) => (
                      <th 
                        key={col}
                        data-col={col}
                        draggable
                        onDragStart={(e) => handleDragStart(e, col)}
                        onDragOver={(e) => { e.preventDefault(); setDragOverColumn(col); }}
                        onDrop={(e) => handleDrop(e, col)}
                        style={{ width: columnWidths[col] || 150 }}
                        className={`px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-elegant-text-label border-b border-r border-elegant-border relative group ${dragOverColumn === col ? 'bg-elegant-accent/10' : ''}`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate">{schema.find(s => s.key === col)?.label || col}</span>
                          <button onClick={() => handleSort(col)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                            {sortConfig.key === col ? (
                              sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : 
                              sortConfig.direction === 'desc' ? <ChevronDown size={12} /> : <Minus size={12} />
                            ) : <Minus size={12} />}
                          </button>
                        </div>
                        <div 
                          className="absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-elegant-accent group-hover:bg-elegant-border/50"
                          onMouseDown={() => setResizingCol(col)}
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-elegant-border">
                  {sortedData.map((item) => (
                    <tr key={item.id} className="hover:bg-elegant-accent/5 transition-colors group">
                      <td className="px-2 py-2 text-center group-hover:bg-elegant-accent/10">
                        <button onClick={() => onEdit(item)} className="p-1 text-elegant-text-muted hover:text-elegant-accent">
                           <Settings size={14} />
                        </button>
                      </td>
                      {activeGridColumns.map(col => (
                        <td key={col} className="px-4 py-2 text-sm text-elegant-text-muted border-r border-elegant-border whitespace-nowrap overflow-hidden text-ellipsis">
                          {renderCellContent((item as any)[col], gridConfigs.find(c => c.nome_da_coluna === col))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
             </table>
           ) : (
             <div className="p-8 text-center text-elegant-text-muted">
                <Filter className="mx-auto mb-4 opacity-20" size={48} />
                <p>Configurações de Filtro</p>
             </div>
           )}
        </div>
    </div>
  );
}
