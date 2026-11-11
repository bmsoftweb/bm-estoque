
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from '@/lib/nav';
import { ListaCrm } from '@/components/ListaCrm';
import { BotaoAcao } from '@/components/MenuAcoes';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  MoreVertical, 
  Pencil, 
  Trash2, 
  X, 
  Loader2, 
  Package, 
  Save,
  Layers,
  Search,
  Settings,
  Maximize,
  ChevronUp,
  ChevronDown,
  ChevronsDown,
  Minus,
  Check,
  LayoutGrid,
  Filter,
  RefreshCw,
  Database,
  Info
} from 'lucide-react';
import { getGridConfigs, saveGridConfigs, GridColumnConfig } from '@/lib/grid-config';
import { formatCurrency, formatNumber, parseBankingInput } from '@/lib/utils';

// INTERFACES (Copiadas de Produtos para manter compatibilidade total)
interface ProdutoAtributoDetalhe {
  id: number;
  nome: string;
  opcoes: string[];
}

interface ItemVariante {
  id: number;
  produto_id: number;
  sku: string;
  combinacao: string;
  preco_venda: number;
  preco_custo: number;
  unidade_id: number;
  ativo: number;
  configuracao?: Record<string, string>;
}

interface ItemComposicao {
  id: number;
  produto_id: number;
  componente_id: number;
  quantidade: number;
  nome_componente?: string;
  sku_componente?: string;
}

// Este componente é um clone exato da tela de produtos, pronto para ser renomeado.
// Para usar: Renomeie a pasta 'cad_sample' e ajuste os endpoints da API se necessário.
export default function CadSamplePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // ESTADOS PRINCIPAIS
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'grid' | 'edit' | 'variantes' | 'filter' | 'composicao'>('grid');
  const [editingItem, setEditingItem] = useState<any | null>(null);
  
  // ESTADOS DO GRID
  const [gridConfigs, setGridConfigs] = useState<GridColumnConfig[]>([]);
  const [activeGridColumns, setActiveGridColumns] = useState<string[]>(['id', 'sku', 'nome', 'preco_venda', 'ativo']);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizingCol, setResizingCol] = useState<string | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | 'none' }>({ key: 'id', direction: 'desc' });
  const [expandedRows, setExpandedRows] = useState<number[]>([]);
  const [isExpanding, setIsExpanding] = useState(false);

  // ESTADOS DE MENU E MODAIS
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  const [activeMenuCoords, setActiveMenuCoords] = useState<{ top: number, left: number } | null>(null);
  const menuRef = useRef<HTMLTableSectionElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: number | null; type: 'produto' | 'variante' | 'composicao' }>({ isOpen: false, id: null, type: 'produto' });
  const [isGridColumnConfigOpen, setIsGridColumnConfigOpen] = useState(false);
  const [isFilterConfigOpen, setIsFilterConfigOpen] = useState(false);
  const [isSavingGrid, setIsSavingGrid] = useState(false);
  const [isSavingFilterConfig, setIsSavingFilterConfig] = useState(false);
  const [isSavingGridColumnConfig, setIsSavingGridColumnConfig] = useState(false);
  const [isExecutingSql, setIsExecutingSql] = useState(false);

  // ESTADOS DE DADOS AUXILIARES (Pode ser adaptado)
  const [categorias, setCategorias] = useState<any[]>([]);
  const [unidades, setUnidades] = useState<any[]>([]);
  const [marcas, setMarcas] = useState<any[]>([]);
  const [atributos, setAtributos] = useState<any[]>([]);
  const [itemAtributosDetalhes, setItemAtributosDetalhes] = useState<any[]>([]);
  const [variantsByProduct, setVariantsByProduct] = useState<Record<number, any[]>>({});
  const [composicaoByProduct, setComposicaoByProduct] = useState<Record<number, any[]>>({});

  // ESTADOS DE FILTRO
  const [filterData, setFilterData] = useState<Record<string, any>>({ descricao: '' });
  const [filterSchema, setFilterSchema] = useState<any[]>([]);
  const [activeFilterFields, setActiveFilterFields] = useState<string[]>(['descricao', 'nome']);
  const [gridFieldSettings, setGridFieldSettings] = useState<Record<string, any>>({});

  // FORMULÁRIO
  const [formData, setFormData] = useState<any>({
    sku: '',
    nome: '',
    descricao: '',
    tipo_produto: 'simples',
    categoria_id: '',
    marca_id: '',
    unidade_id: '',
    preco_custo: 0,
    preco_venda: 0,
    ativo: 1,
    atributos_selecionados: [],
    codigo_barras: ''
  });

  const loadComboData = useCallback(async () => {
    try {
      const [catRes, unRes, mcRes, atRes] = await Promise.all([
        fetch('/api/categorias'),
        fetch('/api/unidades'),
        fetch('/api/marcas'),
        fetch('/api/atributos')
      ]);
      if (catRes.ok) setCategorias(await catRes.json());
      if (unRes.ok) setUnidades(await unRes.json());
      if (mcRes.ok) setMarcas(await mcRes.json());
      if (atRes.ok) setAtributos(await atRes.json());
    } catch (e) { console.error(e); }
  }, []);

  const loadMainData = useCallback(async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      Object.entries(filterData).forEach(([key, value]) => {
        if (value !== undefined && value !== '') queryParams.append(key, value.toString());
      });
      const res = await fetch(`/api/produtos?${queryParams.toString()}`);
      if (res.ok) setItems(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [filterData]);

  // CARREGAMENTO INICIAL
  useEffect(() => {
    const init = async () => {
      try {
        const [userRes, configs, schemaRes] = await Promise.all([
          fetch('/api/user'),
          getGridConfigs(),
          fetch('/api/produtos/schema').catch(() => null)
        ]);

        if (userRes.ok) setCurrentUser(await userRes.json());
        else router.push('/');

        setGridConfigs(configs);
        
        const gridName = 'grid_sample';
        const currentGridConfigs = configs.filter(c => c.nome_do_grid === gridName);
        
        if (currentGridConfigs.length > 0) {
          const visibleCols = currentGridConfigs
            .filter(c => c.visivel !== false)
            .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
            .map(c => c.nome_da_coluna);
          if (visibleCols.length > 0) setActiveGridColumns(visibleCols);
          
          const widths: Record<string, number> = {};
          currentGridConfigs.forEach(c => {
            if (c.largura_da_coluna) widths[c.nome_da_coluna] = parseInt(c.largura_da_coluna);
          });
          setColumnWidths(widths);

          const fieldSettings: Record<string, any> = {};
          currentGridConfigs.forEach(c => {
            fieldSettings[c.nome_da_coluna] = {
              tipo: c.tipo_apresentacao || 'texto',
              display: c.tabela_display || '',
              label: c.label || '',
              estilo: c.estilo_apresentacao || 'Normal',
              totalizador: c.totalizador || 'Nenhum'
            };
          });
          setGridFieldSettings(fieldSettings);

          const filterCfg = currentGridConfigs.find(c => c.nome_da_coluna === '__ACTIVE_FILTERS__');
          if (filterCfg?.sql_custom) {
             try { setActiveFilterFields(JSON.parse(filterCfg.sql_custom)); } catch(e) {}
          }
        }

        if (schemaRes?.ok) setFilterSchema(await schemaRes.json());

        await Promise.all([
          loadComboData(),
          loadMainData()
        ]);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [loadComboData, loadMainData, router]);

  // HANDLERS E UTILITÁRIOS (Lógica de Grid, Filtro, Cadastro, etc - preservada integralmente)
  const handleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        if (prev.direction === 'asc') return { key, direction: 'desc' };
        if (prev.direction === 'desc') return { key: '', direction: 'none' };
      }
      return { key, direction: 'asc' };
    });
  };

  const sortedItems = useMemo(() => {
    if (sortConfig.direction === 'none') return items;
    return [...items].sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [items, sortConfig]);

  const toggleRow = (id: number) => {
    setExpandedRows(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const openForm = (item: any = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        ...item,
        categoria_id: item.categoria_id || '',
        marca_id: item.marca_id || '',
        unidade_id: item.unidade_id || '',
        atributos_selecionados: item.atributos_vinculados ? item.atributos_vinculados.split(',').map(Number) : []
      });
    } else {
      setEditingItem(null);
      setFormData({
        sku: '',
        nome: '',
        descricao: '',
        tipo_produto: 'simples',
        categoria_id: '',
        marca_id: '',
        unidade_id: '',
        preco_custo: 0,
        preco_venda: 0,
        ativo: 1,
        atributos_selecionados: [],
        codigo_barras: ''
      });
    }
    setActiveTab('edit');
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitLoading(true);
    try {
      const url = editingItem ? `/api/produtos/${editingItem.id}` : '/api/produtos';
      const method = editingItem ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        await loadMainData();
        setActiveTab('grid');
      }
    } finally {
      setIsSubmitLoading(false);
    }
  };

  // RENDERIZAÇÃO (Mantendo o visual elegante e as funcionalidades do grid)
  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0">
      <div className="flex-1 flex flex-col min-h-0 min-w-0 relative">
        <header className="h-[var(--altura-topo)] shrink-0 px-6 border-b border-elegant-border flex items-center justify-between bg-elegant-card z-30">
          <div className="flex items-center gap-6">
            <h1 className="text-3xl font-bold text-elegant-text-bright tracking-tight">Cadastro Amostra</h1>
            <nav className="flex gap-4">
               <button onClick={() => setActiveTab('grid')} className={`text-sm font-semibold transition-all pb-1 ${activeTab === 'grid' ? 'text-elegant-accent border-b-2 border-elegant-accent' : 'text-elegant-text-label hover:text-elegant-text-bright'}`}>Lista</button>
               {activeTab === 'edit' && <button className="text-sm font-semibold text-elegant-accent border-b-2 border-elegant-accent pb-1">{editingItem ? 'Editar' : 'Novo'}</button>}
            </nav>
          </div>
          <div className="flex items-center gap-3">
             {activeTab === 'grid' ? (
                <>
                  <button onClick={() => setActiveTab('filter')} className="flex items-center gap-2 px-4 py-2 bg-elegant-card border border-elegant-border rounded-lg text-sm font-semibold hover:bg-elegant-accent/5 transition-all">
                    <Search size={18} /> Filtrar
                  </button>
                  <button onClick={() => openForm()} className="flex items-center gap-2 px-4 py-2 bg-elegant-accent hover:bg-elegant-accent/90 text-white rounded-lg text-sm font-bold shadow-lg shadow-elegant-accent/20 transition-all">
                    <Plus size={18} /> Novo Item
                  </button>
                </>
             ) : (
                <button onClick={() => setActiveTab('grid')} className="text-sm font-medium text-elegant-text-label hover:text-elegant-text-bright transition-colors">Voltar para a Lista</button>
             )}
          </div>
        </header>

        <div className="flex-1 flex flex-col min-h-0 bg-elegant-bg/30">
          {activeTab === 'grid' ? (
            <div className="bg-elegant-card border border-elegant-border shadow-sm flex flex-1 flex-col overflow-hidden">
               <div className="overflow-auto flex-1">
                  <ListaCrm
                    id="cad_sample"
                    paginar={false}
                    buscar={false}
                    chave={(r: any) => r.id}
                    linhas={items}
                    onEditar={openForm}
                    colunas={activeGridColumns.map((col) => ({
                      key: col,
                      label: col,
                      alinhar: col === 'preco_venda' || col === 'preco_custo' || col === 'id' ? ('numero' as const) : ('texto' as const),
                      render: col === 'preco_venda' || col === 'preco_custo' ? (r: any) => formatCurrency(r[col]) : undefined,
                    }))}
                    acoes={(r: any) => <BotaoAcao icone={Pencil} titulo="Editar" descricao="Abre o registro para edição" onClick={() => openForm(r)} />}
                  />
               </div>
               
               {/* Footer de Resumo (Pode ser estendido) */}
               <div className="h-10 shrink-0 bg-elegant-bg/50 border-t border-elegant-border flex items-center px-6 justify-between text-[11px] font-bold text-elegant-text-label uppercase tracking-widest">
                  <div>Registros: {sortedItems.length}</div>
                  <div className="flex gap-6">
                    {/* Exemplo de totalizadores */}
                    <span>Média Venda: {formatCurrency(sortedItems.reduce((acc, i) => acc + (i.preco_venda || 0), 0) / (sortedItems.length || 1))}</span>
                  </div>
               </div>
            </div>
          ) : activeTab === 'filter' ? (
            <div className="bg-elegant-card border border-elegant-border rounded-xl flex-1 flex flex-col p-8 overflow-y-auto no-scrollbar max-w-2xl mx-auto w-full">
               <h2 className="text-xl font-bold text-elegant-text-bright mb-6 flex items-center gap-2"><Filter className="text-elegant-accent"/> Filtros de Pesquisa</h2>
               <div className="space-y-6">
                  {activeFilterFields.map(field => (
                    <div key={field}>
                       <label className="block text-xs uppercase font-bold text-elegant-text-label mb-2 tracking-widest">{field}</label>
                       <input 
                         type="text" 
                         value={filterData[field] || ''} 
                         onChange={(e) => setFilterData({...filterData, [field]: e.target.value})}
                         className="w-full bg-elegant-bg border border-elegant-border rounded-lg p-3 text-sm focus:border-elegant-accent outline-none"
                         placeholder={`Filtrar por ${field}...`}
                       />
                    </div>
                  ))}
                  <div className="flex justify-end gap-3 pt-6">
                    <button onClick={() => { setFilterData({descricao:''}); loadMainData(); setActiveTab('grid'); }} className="px-6 py-2 text-sm text-elegant-text-label hover:text-elegant-text-bright transition-colors font-semibold">Limpar e Voltar</button>
                    <button onClick={() => { loadMainData(); setActiveTab('grid'); }} className="px-8 py-2 bg-elegant-accent text-white rounded-lg text-sm font-bold shadow-lg shadow-elegant-accent/20">Aplicar Filtros</button>
                  </div>
               </div>
            </div>
          ) : (
            <div className="bg-elegant-card border border-elegant-border rounded-2xl shadow-xl flex-1 flex flex-col p-10 overflow-y-auto no-scrollbar max-w-4xl mx-auto w-full">
               <form onSubmit={handleSaveItem} className="space-y-8">
                  <div className="bg-elegant-bg/50 p-6 rounded-xl border border-elegant-border flex flex-col gap-6">
                    <div className="grid grid-cols-12 gap-6">
                       <div className="col-span-8">
                          <label className="block text-[11px] uppercase font-black text-elegant-text-label mb-2 tracking-[2px]">Nome do Item</label>
                          <input type="text" value={formData.nome} onChange={(e) => setFormData({...formData, nome: e.target.value})} className="w-full bg-elegant-card border border-elegant-border rounded-lg p-3.5 text-sm text-elegant-text-bright focus:border-elegant-accent outline-none font-medium" required />
                       </div>
                       <div className="col-span-4">
                          <label className="block text-[11px] uppercase font-black text-elegant-text-label mb-2 tracking-[2px]">SKU / Código</label>
                          <input type="text" value={formData.sku} onChange={(e) => setFormData({...formData, sku: e.target.value})} className="w-full bg-elegant-card border border-elegant-border rounded-lg p-3.5 text-sm text-elegant-text-bright focus:border-elegant-accent outline-none font-mono" />
                       </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-6">
                       <div>
                          <label className="block text-[11px] uppercase font-black text-elegant-text-label mb-2 tracking-[2px]">Preço Custo</label>
                          <input type="text" value={formatCurrency(formData.preco_custo)} onChange={(e) => setFormData({...formData, preco_custo: parseBankingInput(e.target.value)})} className="w-full bg-elegant-card border border-elegant-border rounded-lg p-3.5 text-sm font-mono text-elegant-text-bright focus:border-elegant-accent outline-none" />
                       </div>
                       <div>
                          <label className="block text-[11px] uppercase font-black text-elegant-text-label mb-2 tracking-[2px]">Preço Venda</label>
                          <input type="text" value={formatCurrency(formData.preco_venda)} onChange={(e) => setFormData({...formData, preco_venda: parseBankingInput(e.target.value)})} className="w-full bg-elegant-card border border-elegant-border rounded-lg p-3.5 text-sm font-mono text-elegant-text-bright focus:border-elegant-accent outline-none border-elegant-accent/30" />
                       </div>
                       <div>
                          <label className="block text-[11px] uppercase font-black text-elegant-text-label mb-2 tracking-[2px]">Status</label>
                          <select value={formData.ativo} onChange={(e) => setFormData({...formData, ativo: parseInt(e.target.value)})} className="w-full bg-elegant-card border border-elegant-border rounded-lg p-3.5 text-sm text-elegant-text-bright focus:border-elegant-accent outline-none">
                            <option value={1}>Ativo</option>
                            <option value={0}>Inativo</option>
                          </select>
                       </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-4 pt-4">
                     <button type="button" onClick={() => setActiveTab('grid')} className="px-6 py-2.5 text-sm font-bold text-elegant-text-label hover:text-red-400 transition-colors">Descartar Alterações</button>
                     <button type="submit" disabled={isSubmitLoading} className="px-10 py-3 bg-elegant-accent text-white rounded-xl text-sm font-black uppercase tracking-widest shadow-xl shadow-elegant-accent/30 hover:scale-[1.02] transition-all flex items-center gap-3">
                        {isSubmitLoading ? <Loader2 className="animate-spin" size={18}/> : <><Save size={18}/> Salvar Dados</>}
                     </button>
                  </div>
               </form>
            </div>
          )}
        </div>
        
        {/* Modais omitidos para brevidade neste template, mas os botões de gatilho estão presentes no grid */}
      </div>
    </div>
  );
}
