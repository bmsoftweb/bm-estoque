
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from '@/lib/nav';
import { ListaCrm } from '@/components/ListaCrm';
import { DadosFiscaisProduto } from '@/components/DadosFiscaisProduto';
import { EmbalagensProduto } from '@/components/EmbalagensProduto';
import { ProdutosRelacionados } from '@/components/ProdutosRelacionados';
import { Receipt, Boxes, Replace, ShoppingBasket } from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AvisoErro } from '@/components/AvisoErro';
import { AbasCrm } from '@/components/TelaHeader';
import { FormCrm, Campo, INPUT_CLASS, TelaCheia, SecaoCrm, GradeCampos, ResumoRegistro } from '@/components/FormCrm';
import { BotaoAcao, SeparadorAcoes } from '@/components/MenuAcoes';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { 
  Plus, 
  Minus,
  MoreVertical, 
  Pencil, 
  Trash2, 
  X, 
  Loader2, 
  Package, 
  AlertCircle,
  Save,
  Layers,
  Search,
  Settings,
  Maximize,
  ChevronUp,
  ChevronDown,
  ChevronsDown
} from 'lucide-react';
import { getGridConfigs, saveGridConfigs, GridColumnConfig } from '@/lib/grid-config';
import { formatCurrency, formatNumber, parseBankingInput } from '@/lib/utils';

interface Produto {
  id: number;
  sku: string;
  nome: string;
  descricao: string | null;
  tipo_produto: 'simples' | 'composto' | 'variacao_simples' | 'variacao_atributo';
  categoria_id: number | null;
  marca_id: number | null;
  unidade_id: number;
  preco_custo: number;
  preco_venda: number;
  peso_kg: number | null;
  ativo: number;
  codigo_barras: string | null;
  date_insert: string;
  date_update: string;
  variantes_count?: number;
  atributos_vinculados?: string;
}

interface ProdutoVariante {
  id: number;
  produto_id: number;
  sku_variante: string;
  nome_adicional: string;
  preco_custo: number;
  preco_venda: number;
  codigo_barras: string | null;
  ativo: number;
  date_insert: string;
  date_update: string;
}

interface ProdutoComposicao {
  id: number;
  produto_pai_id: number;
  componente_prod_id: number;
  componente_var_id: number | null;
  quantidade: number;
  unidade_id: number;
  componente_prod_nome?: string;
  componente_var_nome?: string;
  unidade_sigla?: string;
  componente_prod_sku?: string;
  componente_var_sku?: string;
}

export default function ProdutosPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [unidades, setUnidades] = useState<any[]>([]);
  const [marcasLista, setMarcasLista] = useState<any[]>([]);
  const [atributosLista, setAtributosLista] = useState<any[]>([]);
  const [gridConfigs, setGridConfigs] = useState<GridColumnConfig[]>([]);
  const [isSavingGrid, setIsSavingGrid] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'grid' | 'edit' | 'variantes' | 'filter' | 'composicao' | 'fiscal' | 'embalagens' | 'similares' | 'sugestoes'>('grid');
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: number | null; type: 'produto' | 'variante' | 'composicao' }>({ isOpen: false, id: null, type: 'produto' });
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  const [variantes, setVariantes] = useState<ProdutoVariante[]>([]);
  const [isLoadingVariantes, setIsLoadingVariantes] = useState(false);
  
  // Composicao state
  const [composicaoLista, setComposicaoLista] = useState<ProdutoComposicao[]>([]);
  const [isLoadingComposicao, setIsLoadingComposicao] = useState(false);
  const [formDataComposicao, setFormDataComposicao] = useState<{
    componente_prod_id: string;
    componente_var_id: string;
    quantidade: number;
    unidade_id: string;
  }>({
    componente_prod_id: '',
    componente_var_id: '',
    quantidade: 1,
    unidade_id: ''
  });
  const [selectedComponenteVariantes, setSelectedComponenteVariantes] = useState<ProdutoVariante[]>([]);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [isProductSearchOpen, setIsProductSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsProductSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  const [selectedProduto, setSelectedProduto] = useState<Produto | null>(null);
  const [expandedRows, setExpandedRows] = useState<number[]>([]);
  const [isExpanding, setIsExpanding] = useState(false);
  const [variantsByProduct, setVariantsByProduct] = useState<{[key: number]: ProdutoVariante[]}>({});
  const [composicaoByProduct, setComposicaoByProduct] = useState<{[key: number]: ProdutoComposicao[]}>({});
  const [activeGridColumns, setActiveGridColumns] = useState<string[]>(['id', 'sku', 'categoria_id', 'nome', 'tipo_produto', 'preco_custo', 'preco_venda', 'ativo']);
  const [isGridColumnConfigOpen, setIsGridColumnConfigOpen] = useState(false);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [resizingCol, setResizingCol] = useState<string | null>(null);
  const [isExecutingSql, setIsExecutingSql] = useState(false);

  const handleMouseDown = (e: React.MouseEvent, col: string) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingCol(col);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (resizingCol) {
        const header = document.querySelector(`th[data-col="${resizingCol}"]`) as HTMLElement;
        if (header) {
          const newWidth = e.clientX - header.getBoundingClientRect().left;
          setColumnWidths(prev => ({ 
            ...prev, 
            [resizingCol]: Math.max(newWidth, 50)
          }));
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
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | 'none' }>({ key: '', direction: 'none' });

  const sortedProdutos = useMemo(() => {
    if (sortConfig.direction === 'none' || !sortConfig.key) return produtos;

    return [...produtos].sort((a, b) => {
      const config = gridConfigs.find(c => c.nome_do_grid === 'grid_produtos' && c.nome_da_coluna === sortConfig.key);
      const isNumeric = config?.tipo_apresentacao === 'numero' || config?.tipo_apresentacao === 'moeda' || config?.tipo_apresentacao === 'inteiro' || sortConfig.key === 'id';
      
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
      
      if (sA < sB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (sA > sB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [produtos, sortConfig, gridConfigs]);

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

  const [isSavingGridColumnConfig, setIsSavingGridColumnConfig] = useState(false);
  const [gridFieldSettings, setGridFieldSettings] = useState<Record<string, { 
    tipo?: 'texto' | 'numero' | 'moeda' | 'inteiro' | 'data', 
    display?: string,
    label?: string,
    estilo?: 'Normal' | 'Tag' | 'Destaque',
    totalizador?: 'Nenhum' | 'Soma' | 'Média' | 'Contagem'
  }>>({});
  const [activeMenuCoords, setActiveMenuCoords] = useState<{ top: number, left: number } | null>(null);

  const [filterSchema, setFilterSchema] = useState<any[]>([]);
  const [activeFilterFields, setActiveFilterFields] = useState<string[]>(['descricao', 'categoria_id', 'marca_id']);
  const [isFilterConfigOpen, setIsFilterConfigOpen] = useState(false);
  const [isSavingFilterConfig, setIsSavingFilterConfig] = useState(false);

  const [produtoAtributosDetalhes, setProdutoAtributosDetalhes] = useState<any[]>([]);
  const [valoresSelecionadosAtributo, setValoresSelecionadosAtributo] = useState<{[key: number]: string}>({});

  const [filterData, setFilterData] = useState<Record<string, any>>({
    descricao: '',
    categoria_id: '',
    marca_id: '',
  });

  const [formDataVariante, setFormDataVariante] = useState({
    sku_variante: '',
    nome_adicional: '',
    preco_custo: 0,
    preco_venda: 0,
    codigo_barras: '',
    ativo: 1
  });
  /** id da variante carregada no formulário para alteração (null = incluindo uma nova) */
  const [varianteEditando, setVarianteEditando] = useState<number | null>(null);
  const skuVarianteRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<{
    sku: string;
    nome: string;
    descricao: string;
    tipo_produto: 'simples' | 'composto' | 'variacao_simples' | 'variacao_atributo';
    categoria_id: string;
    unidade_id: number;
    marca_id: string;
    preco_custo: number;
    preco_venda: number;
    peso_kg: number;
    ativo: number;
    atributos_selecionados: number[];
    codigo_barras: string;
  }>({
    sku: '',
    nome: '',
    descricao: '',
    tipo_produto: 'simples',
    categoria_id: '',
    unidade_id: 1,
    marca_id: '',
    preco_custo: 0,
    preco_venda: 0,
    peso_kg: 0,
    ativo: 1,
    atributos_selecionados: [],
    codigo_barras: ''
  });
  const [error, setError] = useState('');

  const router = useRouter();
  const menuRef = useRef<HTMLTableSectionElement>(null);

  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, col: string) => {
    setDraggedColumn(col);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, col: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== col) {
      setDragOverColumn(col);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverColumn(null);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, targetCol: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    if (draggedColumn && draggedColumn !== targetCol) {
      const newColumns = [...activeGridColumns];
      const draggedIndex = newColumns.indexOf(draggedColumn);
      const targetIndex = newColumns.indexOf(targetCol);

      if (draggedIndex !== -1 && targetIndex !== -1) {
        newColumns.splice(draggedIndex, 1);
        newColumns.splice(targetIndex, 0, draggedColumn);
        setActiveGridColumns(newColumns);
      }
    }
    setDraggedColumn(null);
  };

  const loadProdutos = async (isRefresh = false) => {
    if (!isRefresh) setIsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      Object.entries(filterData).forEach(([key, value]) => {
        if (value) {
          if (key === 'marca' || key === 'marca_id') {
            queryParams.append('marca_id', value);
          } else if (key === 'categoria' || key === 'categoria_id') {
            queryParams.append('categoria_id', value);
          } else {
            queryParams.append(key, value);
          }
        }
      });

      const res = await fetch(`/api/produtos?${queryParams.toString()}`);
      if (res.ok) {
        setProdutos(await res.json());
      }
    } catch (err) {
      console.error('Error fetching produtos:', err);
    } finally {
      if (!isRefresh) setIsLoading(false);
    }
  };

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadProdutos();
    setActiveTab('grid');
  };

  const handleSaveFilterConfig = async () => {
    setIsSavingFilterConfig(true);
    try {
      const configs: GridColumnConfig[] = activeFilterFields.map(field => ({
        nome_do_modulo: 'Estoque',
        nome_do_grid: 'filters_produtos',
        nome_da_coluna: field,
        largura_da_coluna: 'auto'
      }));
      // The shared saveGridConfigs utility in /lib/grid-config.ts takes only one argument
      // actually, I should double check if I have a local one.
      await saveGridConfigs(configs);
      setIsFilterConfigOpen(false);
    } catch (err) {
      console.error('Error saving filter config:', err);
    } finally {
      setIsSavingFilterConfig(false);
    }
  };

  const clearFilter = () => {
    const novoFiltro: any = { descricao: '', categoria_id: '', marca_id: '' };
    // Clear all other dynamic filter fields
    activeFilterFields.forEach(field => {
      novoFiltro[field] = '';
    });
    setFilterData(novoFiltro);
    // Reload right away or let user click 'Filtrar' again? Better to just clear.
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [userRes, produtosRes, categoriasRes, unidadesRes, marcasRes, atributosRes, configRes, schemaRes] = await Promise.all([
          fetch('/api/user'),
          fetch('/api/produtos'),
          fetch('/api/categorias'),
          fetch('/api/unidades'),
          fetch('/api/marcas'),
          fetch('/api/atributos'),
          getGridConfigs(),
          fetch('/api/produtos/schema')
        ]);

        if (!userRes.ok) {
          router.push('/');
          return;
        }

        const userData = await userRes.json();
        setCurrentUser(userData);

        if (produtosRes.ok) {
          const prodData = await produtosRes.json();
          setProdutos(prodData);
        }

        if (categoriasRes.ok) {
          const catData = await categoriasRes.json();
          setCategorias(catData);
        }

        if (unidadesRes.ok) {
          const unitData = await unidadesRes.json();
          setUnidades(unitData);
        }

        if (marcasRes.ok) {
          const marcasData = await marcasRes.json();
          setMarcasLista(marcasData);
        }

        if (atributosRes.ok) {
          const attrData = await atributosRes.json();
          setAtributosLista(attrData.filter((a: any) => a.ativo === 1)); // Filter only active ones for UI
        }

        setGridConfigs(configRes);

        // Load filter config
        const filterConfigs = configRes.filter((c: any) => c.nome_do_grid === 'filters_produtos');
        if (filterConfigs.length > 0) {
          setActiveFilterFields(filterConfigs.map((c: any) => c.nome_da_coluna));
        }

        // Load grid config for products list
        let validColumnKeys: string[] = [];
        let finalSchema = [];
        if (schemaRes?.ok) {
          finalSchema = await schemaRes.json();
          validColumnKeys = finalSchema.map((s: any) => s.key);
        }

        const gridProdConfigs = configRes.filter((c: any) => c.nome_do_grid === 'grid_produtos');
        
        // Se houver configurações salvas que não estão no schema (campos customizados),
        // adicionamos elas ao filterSchema para que sejam reconhecidas como válidas
        gridProdConfigs.forEach((c: any) => {
          if (c.nome_da_coluna !== '__CUSTOM_SQL__' && !validColumnKeys.includes(c.nome_da_coluna)) {
            finalSchema.push({
              key: c.nome_da_coluna,
              label: c.nome_da_coluna,
              type: 'custom'
            });
            validColumnKeys.push(c.nome_da_coluna);
          }
        });
        setFilterSchema(finalSchema);

        const defaultColumns = ['id', 'sku', 'categoria_id', 'nome', 'tipo_produto', 'preco_custo', 'preco_venda', 'ativo'];

        if (gridProdConfigs.length > 0) {
          // Deduplicate configs
          const configMap = new Map<string, any>();
          gridProdConfigs.forEach((c: any) => {
            configMap.set(c.nome_da_coluna, c);
          });
          
          const uniqueConfigs = Array.from(configMap.values());
          const visibleCols = uniqueConfigs
            .filter((c: any) => c.nome_da_coluna !== '__CUSTOM_SQL__')
            .filter((c: any) => c.visivel === true || c.visivel === 1 || c.visivel === '1' || c.visivel === 'true' || (c.visivel === undefined && defaultColumns.includes(c.nome_da_coluna)))
            .filter((c: any) => validColumnKeys.includes(c.nome_da_coluna))
            .sort((a: any, b: any) => (a.ordem || 0) - (b.ordem || 0))
            .map((c: any) => c.nome_da_coluna);
          
          if (visibleCols.length > 0) {
            setActiveGridColumns(visibleCols);
          } else {
            setActiveGridColumns(defaultColumns);
          }
        } else {
          setActiveGridColumns(defaultColumns);
        }
      } catch (err) {
        console.error('Data fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [router]);

  const openGridConfig = () => {
    const settings: Record<string, { 
      tipo?: 'texto' | 'numero' | 'moeda' | 'inteiro' | 'data', 
      display?: string, 
      label?: string, 
      estilo?: 'Normal' | 'Tag' | 'Destaque', 
      totalizador?: 'Nenhum' | 'Soma' | 'Média' | 'Contagem' 
    }> = {};
    
    // First populate from gridConfigs
    gridConfigs.filter(c => c.nome_do_grid === 'grid_produtos').forEach(c => {
      settings[c.nome_da_coluna] = {
        tipo: c.tipo_apresentacao || 'texto',
        display: c.tabela_display || '',
        label: c.label || c.nome_da_coluna,
        estilo: c.estilo_apresentacao || 'Normal',
        totalizador: c.totalizador || 'Nenhum'
      };
    });

    // Then ensure all keys in filterSchema have at least a default
    filterSchema.forEach(field => {
      if (!settings[field.key]) {
        settings[field.key] = { 
          tipo: 'texto', 
          display: '', 
          label: field.label || field.key, 
          estilo: 'Normal', 
          totalizador: 'Nenhum' 
        };
      }
    });
    
    setGridFieldSettings(settings);
    setIsGridColumnConfigOpen(true);
  };

  const handleSaveGrid = async (gridName: string) => {
    setIsSavingGrid(true);
    const table = document.querySelector(`[data-grid="${gridName}"]`);
    if (!table) return;

    const headers = table.querySelectorAll('th[data-col]');
    const newConfigs: GridColumnConfig[] = [];

    // Primeiro, mantemos todas as configurações de outros grids ou colunas especiais (como __CUSTOM_SQL__)
    gridConfigs.forEach(c => {
      if (c.nome_do_grid !== gridName || c.nome_da_coluna === '__CUSTOM_SQL__') {
        newConfigs.push(c);
      }
    });

    // Depois, atualizamos as configurações das colunas visíveis no grid baseado no DOM
    headers.forEach((th: any) => {
      const colName = th.getAttribute('data-col');
      if (colName) {
        // Se já adicionamos essa coluna (por ser especial, embora __CUSTOM_SQL__ não devesse estar no DOM), pulamos
        if (newConfigs.find(c => c.nome_do_grid === gridName && c.nome_da_coluna === colName)) return;

        const existing = gridConfigs.find(c => c.nome_do_grid === gridName && c.nome_da_coluna === colName);
        const settings = gridFieldSettings[colName] || {};
        
        newConfigs.push({
          nome_do_modulo: 'Estoque',
          nome_do_grid: gridName,
          nome_da_coluna: colName,
          largura_da_coluna: th.offsetWidth + 'px',
          visivel: true, // Se está no DOM (header), está visível
          ordem: activeGridColumns.indexOf(colName) !== -1 ? activeGridColumns.indexOf(colName) : (existing?.ordem || 999),
          tipo_apresentacao: settings.tipo || existing?.tipo_apresentacao || 'texto',
          tabela_display: settings.display || existing?.tabela_display || '',
          label: settings.label || existing?.label || colName,
          estilo_apresentacao: settings.estilo || existing?.estilo_apresentacao || 'Normal',
          totalizador: settings.totalizador || existing?.totalizador || 'Nenhum'
        });
      }
    });

    // Também precisamos garantir que colunas que estão configuradas como visíveis mas talvez não foram renderizadas ainda (ou vice-versa)
    // sejam preservadas se estiverem em activeGridColumns
    activeGridColumns.forEach((colName, index) => {
      if (!newConfigs.find(c => c.nome_do_grid === gridName && c.nome_da_coluna === colName)) {
        const existing = gridConfigs.find(c => c.nome_do_grid === gridName && c.nome_da_coluna === colName);
        const settings = gridFieldSettings[colName] || {};
        newConfigs.push({
          nome_do_modulo: 'Estoque',
          nome_do_grid: gridName,
          nome_da_coluna: colName,
          largura_da_coluna: existing?.largura_da_coluna || '150px',
          visivel: true,
          ordem: index,
          tipo_apresentacao: settings.tipo || existing?.tipo_apresentacao || 'texto',
          tabela_display: settings.display || existing?.tabela_display || '',
          label: settings.label || existing?.label || colName,
          estilo_apresentacao: settings.estilo || existing?.estilo_apresentacao || 'Normal',
          totalizador: settings.totalizador || existing?.totalizador || 'Nenhum'
        });
      }
    });

    await saveGridConfigs(newConfigs);
    setGridConfigs(await getGridConfigs());
    setIsSavingGrid(false);
  };

  const handleResetGridConfig = async () => {
    setIsExecutingSql(true);
    try {
      const res = await fetch('/api/produtos/colunas');
      const data = await res.json();
      
      if (data.columns) {
        const newSettings: Record<string, any> = {};
        const newSchema: any[] = [];
        const newActiveCols: string[] = [];
        
        data.columns.forEach((col: any) => {
          newSettings[col.name] = {
            tipo: 'texto',
            display: '',
            label: col.name,
            estilo: 'Normal',
            totalizador: 'Nenhum'
          };
          newSchema.push({ key: col.name, label: col.name });
          newActiveCols.push(col.name);
        });
        
        setGridFieldSettings(newSettings);
        setFilterSchema(newSchema);
        setActiveGridColumns(newActiveCols);
      } else {
        alert(data.error || 'Erro ao processar colunas do SQL');
      }
    } catch (err) {
      console.error(err);
      alert('Erro de conexão ao executar SQL');
    } finally {
      setIsExecutingSql(false);
    }
  };

  const handleSaveGridColumnConfig = async () => {
    setIsSavingGridColumnConfig(true);
    try {
      const newGridConfigs: GridColumnConfig[] = filterSchema.map((field) => {
        const isActive = activeGridColumns.includes(field.key);
        const ordem = activeGridColumns.indexOf(field.key);
        const existing = gridConfigs.find(c => c.nome_do_grid === 'grid_produtos' && c.nome_da_coluna === field.key);
        const settings = gridFieldSettings[field.key] || {};

        return {
          nome_do_modulo: 'Estoque',
          nome_do_grid: 'grid_produtos',
          nome_da_coluna: field.key,
          largura_da_coluna: existing?.largura_da_coluna || '150px',
          visivel: isActive,
          ordem: isActive ? ordem : 999,
          tipo_apresentacao: settings.tipo || 'texto',
          tabela_display: settings.display || '',
          label: settings.label || field.label,
          estilo_apresentacao: settings.estilo || 'Normal',
          totalizador: settings.totalizador || 'Nenhum'
        };
      });

      // Requisito: excluir todas as configurações do JSON referentes a esta configuração e depois gravar novamente
      const currentConfigs = await getGridConfigs();
      const otherGridConfigs = currentConfigs.filter(c => c.nome_do_grid !== 'grid_produtos');
      const finalConfigs = [...otherGridConfigs, ...newGridConfigs];

      await fetch('/api/user/config-grid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalConfigs)
      });

      setGridConfigs(await getGridConfigs());
      loadProdutos(true);
      setIsGridColumnConfigOpen(false);
    } catch (err) {
      console.error('Error saving grid column config:', err);
    } finally {
      setIsSavingGridColumnConfig(false);
    }
  };

  const getColLabel = (key: string) => {
    const config = gridConfigs.find(c => c.nome_do_grid === 'grid_produtos' && c.nome_da_coluna === key);
    if (config?.label) return config.label;

    const field = filterSchema.find(f => f.key === key);
    if (field) return field.label;
    const labels: {[key: string]: string} = {
      id: 'ID',
      sku: 'SKU',
      categoria_id: 'Categoria',
      nome: 'Nome',
      tipo_produto: 'Tipo',
      preco_custo: 'Custo',
      preco_venda: 'Venda',
      ativo: 'Ativo',
      marca_id: 'Marca',
      unidade_id: 'Unidade',
      peso_kg: 'Peso (kg)',
      codigo_barras: 'Cód. Barras',
      descricao: 'Descrição'
    };
    return labels[key] || key;
  };

  const calculateFooterValue = (colKey: string) => {
    const config = gridConfigs.find(c => c.nome_do_grid === 'grid_produtos' && c.nome_da_coluna === colKey);
    const totalizer = config?.totalizador || 'Nenhum';
    if (totalizer === 'Nenhum') return '';

    const isNumericType = config?.tipo_apresentacao === 'numero' || config?.tipo_apresentacao === 'moeda' || config?.tipo_apresentacao === 'inteiro';

    const values = produtos.map(p => {
        // Para cálculos numéricos (Soma/Média), preferimos o valor bruto se a coluna for do tipo numérico
        if (isNumericType && totalizer !== 'Contagem') {
          return (p as any)[colKey];
        }
        
        let val = (p as any)[colKey];
        if (config?.tabela_display && (p as any)[`${colKey}_display`] !== undefined) {
          val = (p as any)[`${colKey}_display`];
        }
        return val;
    }).filter(v => v !== null && v !== undefined);

    if (totalizer === 'Contagem') return values.length.toString();

    const numericValues = values.map(v => {
      if (typeof v === 'number') return v;
      if (typeof v === 'string') {
        // Limpeza agressiva para formatos brasileiros (1.234,56) ou internacionais (1,234.56)
        let clean = v.trim();
        // Se houver R$, remove
        clean = clean.replace('R$', '').replace(/\s/g, '');
        
        // Identifica o último separador (ponto ou vírgula)
        const lastDot = clean.lastIndexOf('.');
        const lastComma = clean.lastIndexOf(',');
        
        if (lastDot !== -1 && lastComma !== -1) {
          if (lastComma > lastDot) {
            clean = clean.replace(/\./g, '').replace(',', '.');
          } else {
            clean = clean.replace(/,/g, '');
          }
        } else if (lastComma !== -1) {
          clean = clean.replace(',', '.');
        }
        
        // Remove qualquer caractere que não seja dígito, ponto ou sinal de menos
        clean = clean.replace(/[^\d.-]/g, '');
        return parseFloat(clean);
      }
      return parseFloat(String(v));
    }).filter(v => !isNaN(v) && isFinite(v));
    
    if (numericValues.length === 0) return '-';

    if (totalizer === 'Soma') {
        const sum = numericValues.reduce((a, b) => a + b, 0);
        if (config?.tipo_apresentacao === 'moeda') return formatCurrency(sum);
        if (config?.tipo_apresentacao === 'inteiro') return formatNumber(sum, 0);
        return formatNumber(sum, 2);
    }

    if (totalizer === 'Média') {
        const sum = numericValues.reduce((a, b) => a + b, 0);
        const avg = sum / numericValues.length;
        if (config?.tipo_apresentacao === 'moeda') return formatCurrency(avg);
        if (config?.tipo_apresentacao === 'inteiro') return formatNumber(avg, 0);
        return formatNumber(avg, 2);
    }

    return '';
  };

  const cellInfo = (p: Produto, colKey: string) => {
    const config = gridConfigs.find(c => c.nome_do_grid === 'grid_produtos' && c.nome_da_coluna === colKey);
    
    // Tentativa de resolver o valor dinamicamente se houver tabela_display
    let value = (p as any)[colKey];
    
    if (config?.tabela_display) {
      if ((p as any)[`${colKey}_display`] !== undefined) {
        value = (p as any)[`${colKey}_display`];
      } else {
        const parts = config.tabela_display.split('.');
        if (parts.length === 2) {
          const fieldName = parts[1];
          const prefix = parts[0].replace('cad_produtos_', '').replace(/s$/, '');
          const mappedKey = `${prefix}_${fieldName}`;
          if ((p as any)[mappedKey] !== undefined) {
            value = (p as any)[mappedKey];
          }
        }
      }
    }

    // Configurações baseadas no tipo de apresentação
    const type = config?.tipo_apresentacao || 'texto';
    let displayValue = value;
    let align = 'text-left';
    let mono = '';
    let textColor = 'text-elegant-text-muted';

    // Determinar alinhamento e formatação baseada no tipo ou na coluna
    if (type === 'moeda') {
      displayValue = formatCurrency(parseFloat(value) || 0);
      align = 'text-right';
      mono = 'font-mono';
    } else if (type === 'numero') {
      displayValue = formatNumber(parseFloat(value) || 0, 2);
      align = 'text-right';
      mono = 'font-mono';
    } else if (type === 'inteiro') {
      displayValue = formatNumber(parseInt(value) || 0, 0);
      align = 'text-right';
      mono = 'font-mono';
    } else if (type === 'data') {
      if (value) {
        try {
          const d = new Date(value);
          if (!isNaN(d.getTime())) {
            displayValue = d.toLocaleDateString('pt-BR');
          }
        } catch { /* keep as is */ }
      }
      align = 'text-center';
    } else if (colKey === 'id') {
      displayValue = formatNumber(p.id, 0);
      align = 'text-right';
      mono = 'font-mono';
    } else if (colKey === 'sku') {
      textColor = 'text-elegant-text-bright';
    } else if (colKey === 'ativo') {
      align = 'text-center';
      displayValue = p.ativo ? 'Sim' : 'Não';
      textColor = p.ativo ? 'text-emerald-500' : 'text-red-500';
    } else if (colKey === 'categoria_id' && !config?.tabela_display) {
      displayValue = getCategoryFullPath(p.categoria_id);
    } else if (colKey === 'marca_id' && !config?.tabela_display) {
      displayValue = (p as any).marca_nome || '-';
      align = 'text-center';
    }

    let finalContent: React.ReactNode = displayValue !== null && displayValue !== undefined ? displayValue.toString() : '-';
    const style = config?.estilo_apresentacao || 'Normal';

    // Se for o campo nome e não tiver estilo especial de Tag ou Destaque, mantém o render customizado de nome
    if (colKey === 'nome' && style === 'Normal') {
      finalContent = (
        <div className="flex items-center gap-2">
          <span>{value || p.nome}</span>
          {(p as any).marca_nome && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-elegant-accent/10 text-elegant-accent border border-elegant-accent/20 uppercase tracking-tight whitespace-nowrap">
              {(p as any).marca_nome}
            </span>
          )}
        </div>
      );
      textColor = 'text-elegant-text-bright font-medium';
    }

    if (style === 'Tag') {
      const tagText = (displayValue !== null && displayValue !== undefined ? displayValue.toString() : '').toUpperCase();
      let tagClasses = "bg-elegant-accent/10 text-elegant-accent border-elegant-accent/20";
      
      if (tagText === 'SIM') {
        tagClasses = "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      } else if (tagText === 'NÃO') {
        tagClasses = "bg-red-500/10 text-red-500 border-red-500/20";
      }

      finalContent = (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-tight whitespace-nowrap ${tagClasses}`}>
          {finalContent}
        </span>
      );
    } else if (style === 'Destaque') {
      finalContent = <span className="font-bold underline decoration-elegant-accent/30 underline-offset-4 text-elegant-text-bright">{finalContent}</span>;
      textColor = 'text-elegant-text-bright';
    }

    return { content: finalContent, align, mono, textColor };
  };

  const handleAutoWidth = () => {
    const table = document.querySelector('table[data-grid="grid_produtos"]') as HTMLTableElement;
    const container = table?.parentElement;
    if (!table || !container) return;

    const availableWidth = container.clientWidth;
    const fixedWidth = 120; // Checkbox/Expand (40px) + Actions (80px)
    
    const headers = Array.from(table.querySelectorAll('th[data-col]')) as HTMLTableCellElement[];
    if (headers.length === 0) return;

    let totalCurrentVariableWidth = 0;
    const headerWidths = headers.map(h => {
      const w = h.offsetWidth;
      totalCurrentVariableWidth += w;
      return { col: h.dataset.col as string, w };
    });

    const targetVariableWidth = availableWidth - fixedWidth;
    
    if (totalCurrentVariableWidth > 0 && targetVariableWidth > 0) {
      const scale = targetVariableWidth / totalCurrentVariableWidth;
      const newWidths: Record<string, number> = {};
      headerWidths.forEach(hw => {
        newWidths[hw.col] = Math.max(Math.floor(hw.w * scale), 50);
      });
      setColumnWidths(prev => ({ ...prev, ...newWidths }));
    }
  };

  const getColumnWidth = (gridName: string, colName: string, defaultWidth: string) => {
    const config = gridConfigs.find(c => 
      c.nome_do_modulo === 'Estoque' && 
      c.nome_do_grid === gridName && 
      c.nome_da_coluna === colName
    );
    return config ? config.largura_da_coluna : defaultWidth;
  };

  const getCategoryFullPath = (categoryId: number | string | null): string => {
    if (!categoryId) return '-';
    
    // Convert to number for comparison
    const id = typeof categoryId === 'string' ? parseInt(categoryId) : categoryId;
    if (isNaN(id)) return '-';

    const path: string[] = [];
    let currentId: number | null = id;
    const visited = new Set<number>(); // Prevent infinite loops just in case

    while (currentId !== null && !visited.has(currentId)) {
      visited.add(currentId);
      const category = categorias.find(c => c.id === currentId);
      if (!category) break;
      
      path.unshift(category.nome);
      currentId = category.categoria_pai;
    }

    return path.join(' / ');
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (activeMenu !== null && !target.closest('.dropdown-trigger')) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeMenu]);

  const toggleRow = async (produtoId: number) => {
    if (expandedRows.includes(produtoId)) {
      setExpandedRows(expandedRows.filter(id => id !== produtoId));
    } else {
      setExpandedRows([...expandedRows, produtoId]);
      
      const product = produtos.find(p => p.id === produtoId);
      if (product) {
        if (product.tipo_produto === 'composto') {
          if (!composicaoByProduct[produtoId]) {
            try {
              const res = await fetch(`/api/produtos/${produtoId}/composicao`);
              if (res.ok) {
                const data = await res.json();
                setComposicaoByProduct(prev => ({ ...prev, [produtoId]: data }));
              }
            } catch (err) {
              console.error('Error fetching composicao for expansion:', err);
            }
          }
        } else if (product.variantes_count && product.variantes_count > 0 || product.tipo_produto === 'variacao_simples' || product.tipo_produto === 'variacao_atributo') {
          if (!variantsByProduct[produtoId]) {
            try {
              const res = await fetch(`/api/produtos/${produtoId}/variantes`);
              if (res.ok) {
                const data = await res.json();
                setVariantsByProduct(prev => ({ ...prev, [produtoId]: data }));
              }
            } catch (err) {
              console.error('Error fetching variants for expansion:', err);
            }
          }
        }
      }
    }
  };

  const handleExpandAll = async () => {
    setIsExpanding(true);
    
    const productsToExpand = sortedProdutos.filter(
      p => (p.variantes_count || 0) > 0 || p.tipo_produto === 'variacao_simples' || p.tipo_produto === 'variacao_atributo' || p.tipo_produto === 'composto'
    );
    const idsToExpand = productsToExpand.map(p => p.id as number);

    // Fetch missing variants and composicoes
    const newVariants = { ...variantsByProduct };
    const newComposicoes = { ...composicaoByProduct };
    
    const missingVarIds = productsToExpand
      .filter(p => !newVariants[p.id as number] && p.tipo_produto !== 'composto')
      .map(p => p.id as number);
      
    const missingCompIds = productsToExpand
      .filter(p => !newComposicoes[p.id as number] && p.tipo_produto === 'composto')
      .map(p => p.id as number);

    await Promise.all([
      ...(missingVarIds.length > 0 ? missingVarIds.map(async (id) => {
        try {
          const res = await fetch(`/api/produtos/${id}/variantes`);
          if (res.ok) {
            const data = await res.json();
            newVariants[id] = data;
          }
        } catch (err) {
          console.error(`Error fetching variants for product ${id}:`, err);
        }
      }) : []),
      ...(missingCompIds.length > 0 ? missingCompIds.map(async (id) => {
        try {
          const res = await fetch(`/api/produtos/${id}/composicao`);
          if (res.ok) {
            const data = await res.json();
            newComposicoes[id] = data;
          }
        } catch (err) {
          console.error(`Error fetching composicao for product ${id}:`, err);
        }
      }) : [])
    ]);

    if (missingVarIds.length > 0) setVariantsByProduct(newVariants);
    if (missingCompIds.length > 0) setComposicaoByProduct(newComposicoes);
    
    setExpandedRows(idsToExpand);
    setIsExpanding(false);
  };
  const handleCurrencyChange = (key: string, value: string) => {
    const floatValue = parseBankingInput(value, 2);
    setFormData({ ...formData, [key]: floatValue });
  };

  const handleNumericFilterChange = (key: string, value: string, decimals: number) => {
    const floatValue = parseBankingInput(value, decimals);
    setFilterData({ ...filterData, [key]: floatValue });
  };

  const handleVariantNumericChange = (key: string, value: string, decimals: number = 2) => {
    const floatValue = parseBankingInput(value, decimals);
    setFormDataVariante({ ...formDataVariante, [key]: floatValue });
  };

  // Helper to render hierarchical categories in SELECT options
  const renderCategoryOptions = (parentId: number | null = null, depth = 0): React.ReactNode[] => {
    return categorias
      .filter(c => {
        if (parentId === null) return c.categoria_pai === null;
        return Number(c.categoria_pai) === Number(parentId);
      })
      .flatMap(cat => [
        <option key={cat.id} value={cat.id}>
          {getCategoryFullPath(cat.id)}
        </option>,
        ...renderCategoryOptions(cat.id, depth + 1)
      ]);
  };

  const openForm = (produto: Produto | null = null) => {
    if (produto) {
      setEditingProduto(produto);
      setFormData({
        sku: produto.sku,
        nome: produto.nome,
        descricao: produto.descricao || '',
        tipo_produto: produto.tipo_produto,
        categoria_id: produto.categoria_id?.toString() || '',
        marca_id: (produto as any).marca_id?.toString() || '',
        unidade_id: produto.unidade_id,
        preco_custo: produto.preco_custo,
        preco_venda: produto.preco_venda,
        peso_kg: produto.peso_kg || 0,
        ativo: produto.ativo,
        codigo_barras: (produto as any).codigo_barras || '',
        atributos_selecionados: produto.atributos_vinculados 
          ? produto.atributos_vinculados.split(',').map(Number) 
          : []
      });
    } else {
      setEditingProduto(null);
      setFormData({ 
        sku: '', 
        nome: '', 
        descricao: '', 
        codigo_barras: '',
        tipo_produto: 'simples',
        categoria_id: '',
        marca_id: '',
        unidade_id: 1,
        preco_custo: 0,
        preco_venda: 0,
        peso_kg: 0,
        ativo: 1,
        atributos_selecionados: []
      });
    }
    setError('');
    setActiveTab('edit');
  };

  const closeTab = () => setActiveTab('grid');

  const fetchComposicao = async (produtoId: number) => {
    try {
      setIsLoadingComposicao(true);
      const res = await fetch(`/api/produtos/${produtoId}/composicao`);
      if (res.ok) {
        const data = await res.json();
        setComposicaoLista(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingComposicao(false);
    }
  };

  // Dados fiscais (NF-e e NFS-e): tela própria do produto
  const openFiscal = (produto: Produto) => {
    setSelectedProduto(produto);
    setActiveTab('fiscal');
  };

  // Embalagens (fardo, caixa): tela própria do produto
  const openEmbalagens = (produto: Produto) => {
    setSelectedProduto(produto);
    setActiveTab('embalagens');
  };

  const openRelacionados = (produto: Produto, tipo: 'similares' | 'sugestoes') => {
    setSelectedProduto(produto);
    setActiveTab(tipo);
  };

  const openComposicao = async (produto: Produto) => {
    setSelectedProduto(produto);
    setActiveTab('composicao');
    setActiveMenu(null);
    setFormDataComposicao({
      componente_prod_id: '',
      componente_var_id: '',
      quantidade: 1,
      unidade_id: ''
    });
    setProductSearchTerm('');
    setSelectedComponenteVariantes([]);
    await fetchComposicao(produto.id);
  };

  const openVariantes = async (produto: Produto) => {
    setSelectedProduto(produto);
    setIsLoadingVariantes(true);
    setActiveTab('variantes');
    setActiveMenu(null);
    setProdutoAtributosDetalhes([]);
    limparVariante();

    try {
      const promises: Promise<any>[] = [
        fetch(`/api/produtos/${produto.id}/variantes`).then(r => r.json())
      ];

      if (produto.tipo_produto === 'variacao_simples' || produto.tipo_produto === 'variacao_atributo') {
        promises.push(fetch(`/api/produtos/${produto.id}/atributos`).then(r => r.json()));
      }

      const results = await Promise.all(promises);
      setVariantes(results[0]);
      
      if (results.length > 1) {
        setProdutoAtributosDetalhes(results[1]);
      }
    } catch (err) {
      console.error('Error fetching variants or attributes:', err);
    } finally {
      setIsLoadingVariantes(false);
    }
  };

  const handleVariantAttributeChange = (attrId: number, value: string) => {
    const newValues = { ...valoresSelecionadosAtributo, [attrId]: value };
    setValoresSelecionadosAtributo(newValues);

    const valuesList = Object.values(newValues).filter(Boolean);
    const textValues = valuesList.join(' ');
    const codeValues = valuesList.map(v => v.substring(0, 3).toUpperCase()).join('-');

    setFormDataVariante(prev => ({
      ...prev,
      nome_adicional: selectedProduto ? `${selectedProduto.nome} ${textValues}`.trim() : textValues,
      sku_variante: selectedProduto ? `${selectedProduto.sku}-${codeValues}` : ''
    }));
  };

  /** Volta o formulário de variante para inclusão, vazio */
  const limparVariante = () => {
    setVarianteEditando(null);
    setValoresSelecionadosAtributo({});
    setFormDataVariante({ sku_variante: '', nome_adicional: '', preco_custo: 0, preco_venda: 0, codigo_barras: '', ativo: 1 });
  };

  /** Carrega a variante no formulário para alteração (os atributos não mudam: outra combinação é outra variante) */
  const editarVariante = (v: ProdutoVariante) => {
    setVarianteEditando(v.id);
    setValoresSelecionadosAtributo({});
    setFormDataVariante({
      sku_variante: v.sku_variante,
      nome_adicional: v.nome_adicional || '',
      preco_custo: Number(v.preco_custo) || 0,
      preco_venda: Number(v.preco_venda) || 0,
      codigo_barras: v.codigo_barras || '',
      ativo: v.ativo ?? 1
    });
    // O formulário fica acima da lista: leva o foco (e a tela) até ele
    setTimeout(() => skuVarianteRef.current?.focus(), 0);
  };

  const handleSaveVariante = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation(); // form dentro do TelaCheia
    if (!selectedProduto) return;
    setIsSubmitLoading(true);

    try {
      const res = varianteEditando
        ? await fetch(`/api/produtos/variantes/${varianteEditando}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...formDataVariante, codigo_barras: formDataVariante.codigo_barras || null })
          })
        : await fetch(`/api/produtos/${selectedProduto.id}/variantes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...formDataVariante,
              // O valor escolhido em cada atributo (ex.: Cor = Azul), para a variante ficar ligada a ele
              atributo_valor_ids: produtoAtributosDetalhes
                .map(attr => (attr.valores || []).find((v: any) => (v.valor || v.nome || v.descricao) === valoresSelecionadosAtributo[attr.id])?.id)
                .filter(Boolean)
            })
          });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Erro ao salvar a variante.');
        return;
      }

      const lista = varianteEditando ? variantes.map(v => (v.id === varianteEditando ? data : v)) : [data, ...variantes];
      setVariantes(lista);
      // As variantes já abertas no grid (linha expandida) também mudam
      const pid = selectedProduto.id;
      setVariantsByProduct(prev => (prev[pid] ? { ...prev, [pid]: lista } : prev));
      // Atualiza o grid de produtos (contagem e linhas expandidas de variantes)
      await loadProdutos(true);
      limparVariante();
    } catch (err) {
      console.error('Error saving variant:', err);
      setError('Erro de conexão com o servidor.');
    } finally {
      setIsSubmitLoading(false);
    }
  };

  const handleDeleteVariante = (variantId: number) => {
    setDeleteConfirm({ isOpen: true, id: variantId, type: 'variante' });
  };

  const confirmDeleteVariante = async (variantId: number) => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/produtos/variantes/${variantId}`, { method: 'DELETE' });
      if (res.ok) {
        const lista = variantes.filter(v => v.id !== variantId);
        setVariantes(lista);
        if (variantId === varianteEditando) limparVariante();
        if (selectedProduto) {
          const pid = selectedProduto.id;
          setVariantsByProduct(prev => (prev[pid] ? { ...prev, [pid]: lista } : prev));
        }
        // Refresh product list to update variants_count in grid
        await loadProdutos(true);
      } else {
        setError('Erro ao excluir variante.');
      }
    } catch (err) {
      console.error('Error deleting variant:', err);
      setError('Erro de conexão com o servidor.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteComposicao = (composicaoId: number) => {
    setDeleteConfirm({ isOpen: true, id: composicaoId, type: 'composicao' });
  };

  const confirmDeleteComposicao = async (composicaoId: number) => {
    setIsDeleting(true);
    try {
      if (!selectedProduto) return;
      const res = await fetch(`/api/produtos/${selectedProduto.id}/composicao/${composicaoId}`, { method: 'DELETE' });
      if (res.ok) {
        setComposicaoLista(composicaoLista.filter(c => c.id !== composicaoId));
      } else {
        alert('Erro ao excluir componente.');
      }
    } catch (err) {
      console.error('Error deleting componente:', err);
      alert('Erro de conexão.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveComposicao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduto) return;
    if (!formDataComposicao.componente_prod_id || formDataComposicao.quantidade <= 0 || !formDataComposicao.unidade_id) {
      alert("Preencha todos os campos obrigatórios corretamente.");
      return;
    }
    
    setIsSubmitLoading(true);
    try {
      const payload = {
        componente_prod_id: parseInt(formDataComposicao.componente_prod_id),
        componente_var_id: formDataComposicao.componente_var_id ? parseInt(formDataComposicao.componente_var_id) : null,
        quantidade: formDataComposicao.quantidade,
        unidade_id: parseInt(formDataComposicao.unidade_id)
      };
      
      const res = await fetch(`/api/produtos/${selectedProduto.id}/composicao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        await fetchComposicao(selectedProduto.id);
        setFormDataComposicao({
          componente_prod_id: '',
          componente_var_id: '',
          quantidade: 1,
          unidade_id: ''
        });
        setProductSearchTerm('');
        setSelectedComponenteVariantes([]);
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Erro ao adicionar composição');
      }
    } catch (err) {
      console.error(err);
      alert('Erro de conexão');
    } finally {
      setIsSubmitLoading(false);
    }
  };
  
  const handleComponenteProdIdChange = async (val: string) => {
    setFormDataComposicao({ ...formDataComposicao, componente_prod_id: val, componente_var_id: '' });
    
    if (val) {
      const prodId = parseInt(val);
      const prod = produtos.find(p => p.id === prodId);
      if (prod) {
        try {
          const res = await fetch(`/api/produtos/${prodId}/variantes`);
          if (res.ok) {
            const data = await res.json();
            setSelectedComponenteVariantes(data);
          } else {
            setSelectedComponenteVariantes([]);
          }
        } catch(e) {
          console.error(e);
          setSelectedComponenteVariantes([]);
        }
      } else {
        setSelectedComponenteVariantes([]);
      }
    } else {
      setSelectedComponenteVariantes([]);
    }
  };

  const handleSaveProduto = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitLoading(true);
    setError('');

    const url = editingProduto ? `/api/produtos/${editingProduto.id}` : '/api/produtos';
    const method = editingProduto ? 'PATCH' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        await loadProdutos(true);
        closeTab();
      } else {
        const data = await res.json();
        setError(data.error || 'Erro ao salvar produto.');
      }
    } catch (err) {
      setError('Erro de conexão com o servidor.');
    } finally {
      setIsSubmitLoading(false);
    }
  };

  const handleDeleteProduto = (id: number) => {
    setDeleteConfirm({ isOpen: true, id, type: 'produto' });
  };

  const confirmDeleteProduto = async () => {
    const { id } = deleteConfirm;
    if (id === null) return;
    setDeleteConfirm({ isOpen: false, id: null, type: 'produto' });
    setIsDeleting(true);
    
    try {
      const res = await fetch(`/api/produtos/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await loadProdutos(true);
      } else {
        alert('Erro ao excluir produto.');
      }
    } catch (err) {
      alert('Erro de conexão.');
    } finally {
      setIsDeleting(false);
      setDeleteConfirm({ isOpen: false, id: null, type: 'produto' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="animate-spin text-elegant-text-label" size={32} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0">

      <div className="flex-1 flex flex-col min-h-0 min-w-0 relative">
        <AbasCrm
          lista="Produtos"
          total={sortedProdutos.length}
          abas={
            activeTab === 'grid'
              ? []
              : [{ key: activeTab, titulo: activeTab === 'edit' ? (editingProduto ? 'Editar Produto' : 'Novo Produto') : activeTab === 'variantes' ? 'Variantes' : activeTab === 'composicao' ? 'Composição' : activeTab === 'fiscal' ? 'Dados fiscais' : activeTab === 'embalagens' ? 'Embalagens' : activeTab === 'similares' ? 'Similares' : activeTab === 'sugestoes' ? 'Sugestões' : 'Filtrar', novo: activeTab === 'edit' && !editingProduto }]
          }
          ativa={activeTab === 'grid' ? null : activeTab}
          onAtivar={(k) => k === null && closeTab()}
          onFechar={() => closeTab()}
        />

        <div className="w-full flex-1 flex flex-col min-h-0 bg-elegant-bg">
          {activeTab === 'grid' ? (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <ListaCrm
                id="produtos"
                className="flex-1"
                onNovo={() => openForm()}
                rotuloNovo="Novo Produto"
                barraExtra={<>
                    <button type="button" onClick={handleExpandAll} title="Expandir tudo" className="flex items-center justify-center p-2 border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer">
                      <ChevronsDown className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => setExpandedRows([])} title="Recolher tudo" className="flex items-center justify-center p-2 border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer">
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => setActiveTab('filter')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-stone-300 text-stone-600 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800 transition-colors cursor-pointer shrink-0 whitespace-nowrap">
                    <Search className="w-3.5 h-3.5" />
                    <span>Filtrar</span>
                  </button>
                  </>}
                chave={(r: Produto) => r.id}
                linhas={sortedProdutos}
                ordemExterna={{ key: sortConfig.key, dir: sortConfig.direction }}
                onOrdenar={handleSort}
                onEditar={openForm}
                acoesEmMenu
                extraMenu={[{ rotulo: 'Configurar colunas…', onClick: openGridConfig }]}
                expansivel={(r: Produto) => (r.variantes_count || 0) > 0 || r.tipo_produto === 'variacao_simples' || r.tipo_produto === 'variacao_atributo' || r.tipo_produto === 'composto'}
                aberta={(r: Produto) => expandedRows.includes(r.id)}
                onAlternar={(r: Produto) => toggleRow(r.id)}
                vazio="Nenhum produto encontrado."
                colunas={activeGridColumns.map((col) => {
                  const info = cellInfo({} as Produto, col);
                  return {
                    key: col,
                    label: getColLabel(col),
                    alinhar: info.align === 'text-right' ? ('numero' as const) : info.align === 'text-center' ? ('centro' as const) : ('texto' as const),
                    largura: col === 'nome' ? 360 : undefined,
                    render: (r: Produto) => {
                      const c = cellInfo(r, col);
                      return <span className={`${c.textColor} ${c.mono}`}>{c.content}</span>;
                    },
                  };
                })}
                rodape={(col) => {
                  const config = gridConfigs.find((c) => c.nome_do_grid === 'grid_produtos' && c.nome_da_coluna === col);
                  const totalizer = config?.totalizador || 'Nenhum';
                  if (totalizer === 'Nenhum') return null;
                  return (
                    <div className="flex flex-col">
                      <span className="text-[8px] uppercase text-blue-600/70 tracking-tighter leading-none mb-0.5">{totalizer}</span>
                      <span className="font-mono">{calculateFooterValue(col)}</span>
                    </div>
                  );
                }}
                acoes={(r: Produto) => (
                  <>
                    <BotaoAcao icone={Pencil} titulo="Editar" descricao="Abre o registro para edição" onClick={() => openForm(r)} />
                    {(r.tipo_produto === 'variacao_simples' || r.tipo_produto === 'variacao_atributo') && (
                      <BotaoAcao icone={Layers} titulo="Variantes" descricao="Abre as variantes do produto" onClick={() => openVariantes(r)} />
                    )}
                    {r.tipo_produto === 'composto' && (
                      <BotaoAcao icone={Package} titulo="Composição" descricao="Abre a composição do produto" onClick={() => openComposicao(r)} />
                    )}
                    <BotaoAcao icone={Boxes} titulo="Embalagens" descricao="Fardo, caixa e outras embalagens do produto" onClick={() => openEmbalagens(r)} />
                    <BotaoAcao icone={Replace} titulo="Similares" descricao="Produtos a oferecer no lugar deste quando faltar estoque" onClick={() => openRelacionados(r, 'similares')} />
                    <BotaoAcao icone={ShoppingBasket} titulo="Sugestões" descricao="Produtos a oferecer junto com este na venda" onClick={() => openRelacionados(r, 'sugestoes')} />
                    <BotaoAcao icone={Receipt} titulo="Dados fiscais" descricao="NCM, CEST, grupo tributário e serviço (NF-e e NFS-e)" onClick={() => openFiscal(r)} />
                    <SeparadorAcoes />
                    <BotaoAcao icone={Trash2} titulo="Excluir" descricao="Apaga o registro (pede confirmação)" tom="perigo" onClick={() => handleDeleteProduto(r.id)} />
                  </>
                )}
                detalhe={(r: Produto) =>
                  r.tipo_produto === 'composto' ? (
                    composicaoByProduct[r.id] ? (
                      <div className="px-10 py-3">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="text-[10px] font-bold uppercase tracking-widest text-stone-500 border-b border-stone-200 dark:border-stone-800">
                              <th className="px-3 py-2">SKU</th>
                              <th className="px-3 py-2">Componente</th>
                              <th className="px-3 py-2 text-right">Qtd</th>
                              <th className="px-3 py-2 text-center">Un</th>
                            </tr>
                          </thead>
                          <tbody>
                            {composicaoByProduct[r.id].map((comp: any) => (
                              <tr key={comp.id} className="border-b border-stone-100 dark:border-stone-800/60">
                                <td className="px-3 py-1.5 font-mono">{comp.componente_var_sku || comp.componente_prod_sku}</td>
                                <td className="px-3 py-1.5">{comp.componente_prod_nome} {comp.componente_var_nome ? ` - ${comp.componente_var_nome}` : ''}</td>
                                <td className="px-3 py-1.5 text-right font-mono">{formatNumber(comp.quantidade, 4)}</td>
                                <td className="px-3 py-1.5 text-center font-bold">{comp.unidade_sigla}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null
                  ) : variantsByProduct[r.id] ? (
                    <div className="px-10 py-3">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="text-[10px] font-bold uppercase tracking-widest text-stone-500 border-b border-stone-200 dark:border-stone-800">
                            <th className="px-3 py-2">SKU Variante</th>
                            <th className="px-3 py-2">Nome Adicional</th>
                            <th className="px-3 py-2 text-right">Custo</th>
                            <th className="px-3 py-2 text-right">Venda</th>
                          </tr>
                        </thead>
                        <tbody>
                          {variantsByProduct[r.id].map((v: any) => (
                            <tr key={v.id} className="border-b border-stone-100 dark:border-stone-800/60">
                              <td className="px-3 py-1.5 font-mono">{v.sku_variante}</td>
                              <td className="px-3 py-1.5">{v.nome_adicional}</td>
                              <td className="px-3 py-1.5 text-right font-mono">{formatCurrency(v.preco_custo)}</td>
                              <td className="px-3 py-1.5 text-right font-mono">{formatCurrency(v.preco_venda)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null
                }
              />
            </div>
          ) : activeTab === 'embalagens' && selectedProduto ? (
            <EmbalagensProduto produtoId={selectedProduto.id} onVoltar={closeTab} />
          ) : (activeTab === 'similares' || activeTab === 'sugestoes') && selectedProduto ? (
            <ProdutosRelacionados key={activeTab} tipo={activeTab} produtoId={selectedProduto.id} produtos={produtos} onVoltar={closeTab} />
          ) : activeTab === 'fiscal' && selectedProduto ? (
            <DadosFiscaisProduto produtoId={selectedProduto.id} onVoltar={closeTab} />
          ) : activeTab === 'composicao' ? (
            <TelaCheia larga rodape={'Produto #' + selectedProduto?.id + ' • Composição'} onVoltar={closeTab}>
              <ResumoRegistro titulo="Composição do produto" nome={selectedProduto?.nome} sku={selectedProduto?.sku} id={selectedProduto?.id} />

              <SecaoCrm titulo="Adicionar componente">
                <form onSubmit={handleSaveComposicao}>
                  <GradeCampos>
                    <Campo rotulo="Componente *" span={2}>
                      <div className="relative" ref={searchRef}>
                        <input
                          type="text"
                          placeholder="Pesquisar produto..."
                          value={productSearchTerm}
                          onChange={(e) => {
                            setProductSearchTerm(e.target.value);
                            setIsProductSearchOpen(true);
                            if (!e.target.value) {
                              handleComponenteProdIdChange('');
                            }
                          }}
                          onFocus={() => setIsProductSearchOpen(true)}
                          className={INPUT_CLASS}
                        />
                        {isProductSearchOpen && productSearchTerm && (
                          <div className="absolute z-30 w-full mt-1 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg shadow-lg max-h-60 overflow-y-auto no-scrollbar">
                            {produtos
                              .filter(p =>
                                p.id !== selectedProduto?.id &&
                                (p.nome.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
                                 (p.sku && p.sku.toLowerCase().includes(productSearchTerm.toLowerCase())))
                              )
                              .map(p => (
                                <div
                                  key={p.id}
                                  className="px-3 py-2 cursor-pointer hover:bg-stone-100 dark:hover:bg-stone-800 border-b border-stone-100 dark:border-stone-800 last:border-0"
                                  onClick={() => {
                                    handleComponenteProdIdChange(p.id.toString());
                                    setProductSearchTerm((p.sku ? p.sku + ' - ' : '') + p.nome);
                                    setIsProductSearchOpen(false);
                                  }}
                                >
                                  <div className="font-semibold text-xs text-stone-800 dark:text-stone-100">{p.nome}</div>
                                  {p.sku && <div className="text-[11px] text-stone-500">{p.sku}</div>}
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    </Campo>
                    <Campo rotulo="Variação">
                      <select
                        value={formDataComposicao.componente_var_id}
                        onChange={(e) => setFormDataComposicao({ ...formDataComposicao, componente_var_id: e.target.value })}
                        disabled={selectedComponenteVariantes.length === 0}
                        required={selectedComponenteVariantes.length > 0}
                        className={INPUT_CLASS + ' disabled:opacity-50'}
                      >
                        <option value="">Selecione a variação</option>
                        {selectedComponenteVariantes.map(v => (
                          <option key={v.id} value={v.id}>{v.sku_variante} - {v.nome_adicional}</option>
                        ))}
                      </select>
                    </Campo>
                    <Campo rotulo="Qtd *">
                      <input
                        type="number"
                        step="0.0001"
                        required
                        value={formDataComposicao.quantidade}
                        onChange={(e) => setFormDataComposicao({ ...formDataComposicao, quantidade: parseFloat(e.target.value) || 0 })}
                        onFocus={(e) => e.target.select()}
                        className={INPUT_CLASS}
                      />
                    </Campo>
                    <Campo rotulo="Un *">
                      <select
                        required
                        value={formDataComposicao.unidade_id}
                        onChange={(e) => setFormDataComposicao({ ...formDataComposicao, unidade_id: e.target.value })}
                        className={INPUT_CLASS}
                      >
                        <option value="">--</option>
                        {unidades.map(u => (
                          <option key={u.id} value={u.id}>{u.sigla}</option>
                        ))}
                      </select>
                    </Campo>
                    <div className="flex items-end">
                      <button
                        type="submit"
                        disabled={isSubmitLoading}
                        className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer disabled:opacity-50 whitespace-nowrap"
                      >
                        {isSubmitLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                        <span>Adicionar</span>
                      </button>
                    </div>
                  </GradeCampos>
                </form>
              </SecaoCrm>

              <SecaoCrm titulo="Componentes do kit">
                <ListaCrm
                  id="produtos_composicao"
                  className="max-h-[60vh]"
                  paginar={false}
                  buscar={false}
                  chave={(c: any) => c.id}
                  linhas={composicaoLista}
                  carregando={isLoadingComposicao}
                  vazio="Nenhum componente adicionado a este kit."
                  colunas={[
                    { key: 'sku', label: 'SKU', largura: 140, render: (c: any) => <span className="font-mono">{produtos.find(p => p.id === c.componente_prod_id)?.sku || ''}</span> },
                    { key: 'componente_prod_nome', label: 'Componente', largura: 320, render: (c: any) => <>{c.componente_prod_nome}{c.componente_var_nome ? ' — ' + c.componente_var_nome : ''}</> },
                    { key: 'quantidade', label: 'Qtd', alinhar: 'numero', largura: 120, render: (c: any) => <span className="font-mono">{formatNumber(c.quantidade, 4)}</span> },
                    { key: 'unidade_sigla', label: 'Un', alinhar: 'centro', largura: 80 },
                  ]}
                  acoes={(c: any) => <BotaoAcao icone={Trash2} titulo="Remover" descricao="Remove o componente (pede confirmação)" tom="perigo" onClick={() => handleDeleteComposicao(c.id)} />}
                />
              </SecaoCrm>
            </TelaCheia>
          ) : activeTab === 'filter' ? (
            <TelaCheia
              rodape="Filtro dos produtos"
              onVoltar={() => setActiveTab('grid')}
              rotuloVoltar="Cancelar"
              onSubmit={handleFilterSubmit}
              rotuloPrincipal="Aplicar Filtro"
              iconePrincipal={<Search className="w-4 h-4" />}
              salvando={isLoading}
              acoes={<button type="button" onClick={clearFilter} className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold text-stone-600 dark:text-stone-300 border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer">Limpar</button>}
            >
              <SecaoCrm titulo="Parâmetros" direita={<button type="button" onClick={() => setIsFilterConfigOpen(true)} className="flex items-center gap-1 text-[11px] font-semibold text-stone-400 hover:text-blue-600 cursor-pointer" title="Configurar campos de filtro"><Settings className="w-3.5 h-3.5" /> Configurar campos</button>}>
                <GradeCampos>
                  {activeFilterFields.map(fieldKey => {
                      const schemaField = filterSchema.find(f => f.key === fieldKey);
                      if (!schemaField && fieldKey !== 'descricao') return null;

                      const label = fieldKey === 'descricao' ? 'Descrição' : schemaField?.label || fieldKey;
                      const isRelation = schemaField?.isRelation || fieldKey === 'categoria_id' || fieldKey === 'marca_id' || fieldKey === 'unidade_id';

                      return (
                      <Campo key={fieldKey} rotulo={label} span={fieldKey === 'descricao' ? 2 : 1}>
                            {fieldKey === 'categoria_id' ? (
                              <select
                                value={filterData.categoria_id}
                                onChange={(e) => setFilterData({ ...filterData, categoria_id: e.target.value })}
                                className={INPUT_CLASS}
                              >
                                <option value="">Todas as categorias</option>
                                {renderCategoryOptions()}
                              </select>
                            ) : fieldKey === 'marca_id' ? (
                              <select
                                value={filterData.marca_id}
                                onChange={(e) => setFilterData({ ...filterData, marca_id: e.target.value })}
                                className={INPUT_CLASS}
                              >
                                <option value="">Todas as marcas</option>
                                {marcasLista.map(m => (
                                  <option key={m.id} value={m.id}>{m.descricao}</option>
                                ))}
                              </select>
                            ) : fieldKey === 'unidade_id' ? (
                              <select
                                value={filterData.unidade_id}
                                onChange={(e) => setFilterData({ ...filterData, unidade_id: e.target.value })}
                                className={INPUT_CLASS}
                              >
                                <option value="">Todas as unidades</option>
                                {unidades.map(u => (
                                  <option key={u.id} value={u.id}>{u.sigla} - {u.nome}</option>
                                ))}
                              </select>
                            ) : fieldKey === 'ativo' ? (
                              <select
                                value={filterData.ativo || ''}
                                onChange={(e) => setFilterData({ ...filterData, ativo: e.target.value })}
                                className={INPUT_CLASS}
                              >
                                <option value="">Todos</option>
                                <option value="1">Sim (Ativo)</option>
                                <option value="0">Não (Inativo)</option>
                              </select>
                            ) : fieldKey === 'descricao' ? (
                              <input
                                type="text"
                                value={filterData.descricao}
                                onChange={(e) => setFilterData({ ...filterData, descricao: e.target.value })}
                                onFocus={(e) => e.target.select()}
                                className={INPUT_CLASS}
                                placeholder="Buscar por SKU, nome ou descrição..."
                              />
                            ) : (
                              <input
                                type="text"
                                value={
                                  schemaField?.type === 'int' || schemaField?.type === 'bigint' || schemaField?.type === 'tinyint' 
                                    ? formatNumber(filterData[fieldKey], 0)
                                    : (schemaField?.type === 'decimal' || schemaField?.type === 'float')
                                      ? formatNumber(filterData[fieldKey], 2)
                                      : filterData[fieldKey] || ''
                                }
                                onChange={(e) => {
                                  if (schemaField?.type === 'int' || schemaField?.type === 'bigint' || schemaField?.type === 'tinyint') {
                                    handleNumericFilterChange(fieldKey, e.target.value, 0);
                                  } else if (schemaField?.type === 'decimal' || schemaField?.type === 'float') {
                                    handleNumericFilterChange(fieldKey, e.target.value, 2);
                                  } else {
                                    setFilterData({ ...filterData, [fieldKey]: e.target.value });
                                  }
                                }}
                                onFocus={(e) => e.target.select()}
                                className={INPUT_CLASS + ' font-mono'}
                                placeholder={`Filtrar por ${label.toLowerCase()}...`}
                              />
                            )}
                      </Campo>
                    );
                  })}
                </GradeCampos>
              </SecaoCrm>
            </TelaCheia>
          ) : activeTab === 'edit' ? (
            <FormCrm
              id="produtos"
              onSubmit={handleSaveProduto}
              onCancel={closeTab}
              saving={isSubmitLoading}
              erro={error}
              onFecharErro={() => setError('')}
              rodape={editingProduto ? `Registro #${editingProduto.id}` : 'Inclusão'}
            >
              {[
                      { label: 'SKU', key: 'sku', type: 'text' },
                      { label: 'Categoria', key: 'categoria_id', type: 'category_select' },
                      { label: 'Nome', key: 'nome', type: 'text' },
                      { label: 'Marca', key: 'marca_id', type: 'brand_select' },
                      { label: 'Unidade', key: 'unidade_id', type: 'unit_select' },
                      { label: 'Tipo', key: 'tipo_produto', type: 'select' },
                      { label: 'Código Barras', key: 'codigo_barras', type: 'text', show: formData.tipo_produto === 'simples' || formData.tipo_produto === 'composto' },
                      { label: 'Custo', key: 'preco_custo', type: 'currency' },
                      { label: 'Venda', key: 'preco_venda', type: 'currency' },
                      { label: 'Peso (kg)', key: 'peso_kg', type: 'decimal' }
                    ].filter(f => f.show === undefined || f.show).map((field) => (
                <Campo key={field.key} rotulo={field.label} span={['nome', 'categoria_id'].includes(field.key) || field.type === 'select' ? 2 : 1}>
                          {field.type === 'textarea' ? (
                            <textarea value={(formData[field.key as keyof typeof formData] || '') as any} onChange={(e) => setFormData({...formData, [field.key]: e.target.value})} onFocus={(e) => e.target.select()} className={INPUT_CLASS} />
                          ) : field.type === 'select' ? (
                            <div className="flex flex-col gap-2">
                              <select value={formData.tipo_produto} onChange={(e) => setFormData({...formData, tipo_produto: e.target.value as any})} className={INPUT_CLASS}>
                                <option value="simples">Simples</option>
                                <option value="composto">Composto</option>
                                <option value="variacao_simples">Variação Simples</option>
                                <option value="variacao_atributo">Variação Atributo</option>
                              </select>
                              
                              {formData.tipo_produto === 'variacao_simples' && (
                                <div className="mt-2 p-3 bg-elegant-card border border-elegant-border rounded-lg shadow-sm">
                                  <label className="block text-xs font-semibold text-elegant-text-label mb-2">Selecione o Atributo para Variação</label>
                                  <select 
                                    value={formData.atributos_selecionados[0] || ''}
                                    onChange={(e) => setFormData({...formData, atributos_selecionados: [parseInt(e.target.value)]})}
                                    className={INPUT_CLASS}
                                  >
                                    <option value="">Selecione...</option>
                                    {atributosLista.map(attr => (
                                      <option key={attr.id} value={attr.id}>{attr.nome}</option>
                                    ))}
                                  </select>
                                </div>
                              )}

                              {formData.tipo_produto === 'variacao_atributo' && (
                                <div className="mt-2 p-3 bg-elegant-card border border-elegant-border rounded-lg shadow-sm">
                                  <label className="block text-xs font-semibold text-elegant-text-label mb-2">Adicionar Múltiplos Atributos</label>
                                  <div className="flex flex-col gap-2">
                                    {formData.atributos_selecionados.map((attrId, idx) => (
                                      <div key={idx} className="flex gap-2">
                                        <select 
                                          value={attrId}
                                          onChange={(e) => {
                                            const novoSelec = [...formData.atributos_selecionados];
                                            novoSelec[idx] = parseInt(e.target.value);
                                            setFormData({...formData, atributos_selecionados: novoSelec});
                                          }}
                                          className={`${INPUT_CLASS} flex-1`}
                                        >
                                          <option value="">Selecione...</option>
                                          {atributosLista.map(attr => (
                                            <option key={attr.id} value={attr.id}>{attr.nome}</option>
                                          ))}
                                        </select>
                                        <button 
                                          type="button"
                                          onClick={() => {
                                            const novoSelec = formData.atributos_selecionados.filter((_, i) => i !== idx);
                                            setFormData({...formData, atributos_selecionados: novoSelec});
                                          }}
                                          className="p-2 border border-red-500/20 text-red-500 rounded bg-red-500/5 hover:bg-red-500/10 transition-colors"
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      </div>
                                    ))}
                                    <button 
                                      type="button"
                                      onClick={() => {
                                        setFormData({...formData, atributos_selecionados: [...formData.atributos_selecionados, 0]}); // 0 as empty placeholder
                                      }}
                                      className="flex justify-center items-center gap-2 p-2 border border-emerald-500/20 text-emerald-500 rounded bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors text-sm font-semibold mt-1"
                                    >
                                      <Plus size={16} /> Incluir Atributo
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : field.type === 'unit_select' ? (
                            <select value={formData.unidade_id} onChange={(e) => setFormData({...formData, unidade_id: parseInt(e.target.value)})} className={INPUT_CLASS}>
                              {unidades.map(unit => (
                                <option key={unit.id} value={unit.id}>{unit.nome} ({unit.sigla})</option>
                              ))}
                            </select>
                          ) : field.type === 'brand_select' ? (
                            <select value={formData.marca_id} onChange={(e) => setFormData({...formData, marca_id: e.target.value})} className={INPUT_CLASS}>
                              <option value="">Nenhuma</option>
                              {marcasLista.map(brand => (
                                <option key={brand.id} value={brand.id}>{brand.descricao}</option>
                              ))}
                            </select>
                          ) : field.type === 'category_select' ? (
                            <select value={formData.categoria_id} onChange={(e) => setFormData({...formData, categoria_id: e.target.value})} className={INPUT_CLASS}>
                              <option value="">Nenhuma</option>
                              {renderCategoryOptions()}
                            </select>
                          ) : field.type === 'currency' ? (
                            <input 
                              type="text" 
                              value={formatCurrency(formData[field.key as keyof typeof formData] as number)} 
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => handleCurrencyChange(field.key, e.target.value)}
                              className={`${INPUT_CLASS} font-mono text-left`} 
                            />
                          ) : field.type === 'decimal' ? (
                            <input 
                              type="text" 
                              value={formatNumber(formData[field.key as keyof typeof formData] as number, 3)} 
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => setFormData({...formData, [field.key]: parseBankingInput(e.target.value, 3)})}
                              className={`${INPUT_CLASS} font-mono text-left`} 
                            />
                          ) : (
                            <input type={field.type} step="0.0001" value={(formData[field.key as keyof typeof formData] !== undefined ? formData[field.key as keyof typeof formData] : '') as any} onFocus={(e) => e.target.select()} onChange={(e) => setFormData({...formData, [field.key]: field.type === 'number' ? parseFloat(e.target.value) : e.target.value})} className={INPUT_CLASS} />
                          )}
                        </Campo>
              ))}
            </FormCrm>
          ) : (
            <TelaCheia rodape={'Produto #' + selectedProduto?.id + ' • Variantes'} onVoltar={closeTab}>
              <ResumoRegistro titulo="Gerenciando variantes" nome={selectedProduto?.nome} sku={selectedProduto?.sku} id={selectedProduto?.id} descricao={selectedProduto?.descricao ?? undefined} />

              {error && <AvisoErro mensagem={error} onFechar={() => setError('')} />}

              <SecaoCrm titulo={varianteEditando ? `Editar variante ${formDataVariante.sku_variante}` : 'Nova variante'}>
                <form onSubmit={handleSaveVariante}>
                  <GradeCampos>
                    {/* Os atributos só montam SKU e nome de uma variante nova; na alteração a combinação não muda */}
                    {!varianteEditando && produtoAtributosDetalhes.map(attr => (
                      <Campo key={attr.id} rotulo={attr.nome}>
                        {attr.valores && attr.valores.length > 0 ? (
                          <select
                            value={valoresSelecionadosAtributo[attr.id] || ''}
                            onChange={(e) => handleVariantAttributeChange(attr.id, e.target.value)}
                            className={INPUT_CLASS}
                            required
                          >
                            <option value="">Selecione...</option>
                            {attr.valores.map((v: any) => (
                              <option key={v.id} value={v.valor || v.nome || v.descricao}>{v.valor || v.nome || v.descricao}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            required
                            value={valoresSelecionadosAtributo[attr.id] || ''}
                            onChange={(e) => handleVariantAttributeChange(attr.id, e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className={INPUT_CLASS}
                            placeholder={'Digite o ' + attr.nome}
                          />
                        )}
                      </Campo>
                    ))}
                    <Campo rotulo="SKU Variante">
                      <input ref={skuVarianteRef} type="text" required value={formDataVariante.sku_variante} onChange={(e) => setFormDataVariante({ ...formDataVariante, sku_variante: e.target.value })} onFocus={(e) => e.target.select()} className={INPUT_CLASS} />
                    </Campo>
                    <Campo rotulo="Nome Adicional" span={2}>
                      <input type="text" required value={formDataVariante.nome_adicional} onChange={(e) => setFormDataVariante({ ...formDataVariante, nome_adicional: e.target.value })} onFocus={(e) => e.target.select()} className={INPUT_CLASS} placeholder="Ex: Tamanho P, Cor Azul" />
                    </Campo>
                    <Campo rotulo="Código Barras">
                      <input type="text" value={formDataVariante.codigo_barras || ''} onChange={(e) => setFormDataVariante({ ...formDataVariante, codigo_barras: e.target.value })} onFocus={(e) => e.target.select()} className={INPUT_CLASS} />
                    </Campo>
                    <Campo rotulo="Preço Custo">
                      <input type="text" value={formatCurrency(formDataVariante.preco_custo)} onFocus={(e) => e.target.select()} onChange={(e) => handleVariantNumericChange('preco_custo', e.target.value, 2)} className={INPUT_CLASS + ' font-mono'} />
                    </Campo>
                    <Campo rotulo="Preço Venda">
                      <input type="text" value={formatCurrency(formDataVariante.preco_venda)} onFocus={(e) => e.target.select()} onChange={(e) => handleVariantNumericChange('preco_venda', e.target.value, 2)} className={INPUT_CLASS + ' font-mono'} />
                    </Campo>
                    <div className="flex items-end gap-2">
                      <button
                        type="submit"
                        disabled={isSubmitLoading}
                        className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer disabled:opacity-50 whitespace-nowrap"
                      >
                        {isSubmitLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : varianteEditando ? <Save className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                        <span>{varianteEditando ? 'Salvar' : 'Adicionar'}</span>
                      </button>
                      {varianteEditando && (
                        <button
                          type="button"
                          onClick={limparVariante}
                          disabled={isSubmitLoading}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-stone-600 dark:text-stone-300 border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Cancelar edição</span>
                        </button>
                      )}
                    </div>
                  </GradeCampos>
                </form>
              </SecaoCrm>

              <SecaoCrm titulo="Variantes cadastradas">
                <ListaCrm
                  id="produtos_variantes"
                  className="max-h-96"
                  paginar={false}
                  buscar={false}
                  chave={(v: any) => v.id}
                  linhas={variantes}
                  carregando={isLoadingVariantes}
                  vazio="Nenhuma variante encontrada para este produto."
                  colunas={[
                    { key: 'sku_variante', label: 'SKU', largura: 160, render: (v: any) => <span className="font-mono">{v.sku_variante}</span> },
                    { key: 'nome_adicional', label: 'Nome', largura: 300 },
                    { key: 'preco_custo', label: 'Custo', alinhar: 'numero', largura: 140, render: (v: any) => <span className="font-mono">{formatCurrency(v.preco_custo)}</span> },
                    { key: 'preco_venda', label: 'Venda', alinhar: 'numero', largura: 140, render: (v: any) => <span className="font-mono">{formatCurrency(v.preco_venda)}</span> },
                  ]}
                  onEditar={editarVariante}
                  acoes={(v: any) => (
                    <>
                      <BotaoAcao icone={Pencil} titulo="Editar" descricao="Carrega a variante no formulário acima para alteração" onClick={() => editarVariante(v)} />
                      <BotaoAcao icone={Trash2} titulo="Excluir" descricao="Apaga a variante (pede confirmação)" tom="perigo" onClick={() => handleDeleteVariante(v.id)} />
                    </>
                  )}
                />
              </SecaoCrm>
            </TelaCheia>
          )}
        </div>


        {deleteConfirm.isOpen && (
          <ConfirmDialog
            titulo="Confirmar exclusão"
            mensagem={'Tem certeza que deseja excluir este ' + (deleteConfirm.type === 'produto' ? 'produto' : deleteConfirm.type === 'variante' ? 'variante' : 'componente') + '?'}
            onConfirmar={() => {
              if (deleteConfirm.id !== null) {
                if (deleteConfirm.type === 'produto') {
                  confirmDeleteProduto();
                } else if (deleteConfirm.type === 'variante') {
                  confirmDeleteVariante(deleteConfirm.id);
                } else if (deleteConfirm.type === 'composicao') {
                  confirmDeleteComposicao(deleteConfirm.id);
                }
                setDeleteConfirm({ isOpen: false, id: null, type: 'produto' });
              }
            }}
            onCancelar={() => setDeleteConfirm({ isOpen: false, id: null, type: 'produto' })}
          />
        )}

        {/* Modal Configuração de Colunas do Grid */}
        <AnimatePresence>
          {isGridColumnConfigOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4 font-sans">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-elegant-card border border-elegant-border rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]"
              >
                <div className="p-4 border-b border-elegant-border bg-elegant-bg flex justify-between items-center text-sm uppercase tracking-wider font-bold text-elegant-text-bright">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Settings size={18} className="text-elegant-accent" />
                      Personalizar Colunas do Grid
                    </div>
                    <button 
                      onClick={handleResetGridConfig}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[10px] px-3 py-1 rounded border border-red-500/20 transition-all flex items-center gap-1"
                    >
                      Reset
                    </button>
                  </div>
                  <button onClick={() => { setIsGridColumnConfigOpen(false); loadProdutos(true); }} className="text-elegant-text-muted hover:text-elegant-text-bright transition-colors">
                    <X size={20} />
                  </button>
                </div>
                
                <div className="p-4 overflow-y-auto flex-1 no-scrollbar">
                  <div className="grid grid-cols-12 gap-2 mb-2 px-2 text-[10px] uppercase font-bold text-elegant-text-label tracking-widest text-center">
                    <div className="col-span-2 text-left">Campo</div>
                    <div className="col-span-2">Rótulo</div>
                    <div className="col-span-2">Apresentação</div>
                    <div className="col-span-2">Estilo</div>
                    <div className="col-span-2">Totalizador</div>
                    <div className="col-span-2">Tab. Display</div>
                  </div>
                  
                  <div className="space-y-1">
                    {filterSchema.map((field) => {
                      const isVisible = activeGridColumns.includes(field.key);
                      const settings = gridFieldSettings[field.key] || { tipo: 'texto', display: '', label: field.label, estilo: 'Normal', totalizador: 'Nenhum' };
                      
                      return (
                        <div key={field.key} className={`grid grid-cols-12 gap-2 items-center p-2 rounded transition-all group ${isVisible ? 'bg-elegant-accent/5 shadow-sm border border-elegant-accent/10' : 'hover:bg-elegant-accent/5 border border-transparent'}`}>
                          <div className="col-span-2 flex items-center gap-2">
                            <input 
                              type="checkbox" 
                              checked={isVisible}
                              onChange={() => {
                                if (isVisible) {
                                  if (activeGridColumns.length > 1) {
                                    setActiveGridColumns(activeGridColumns.filter(c => c !== field.key));
                                  }
                                } else {
                                  setActiveGridColumns([...activeGridColumns, field.key]);
                                }
                              }}
                              className="w-4 h-4 rounded border-elegant-border text-elegant-accent focus:ring-elegant-accent bg-elegant-bg cursor-pointer"
                            />
                            <span className={`text-[11px] truncate transition-colors ${isVisible ? 'text-elegant-text-bright font-medium' : 'text-elegant-text-muted'}`} title={field.key}>
                              {field.key}
                            </span>
                          </div>

                          <div className="col-span-2">
                            <input 
                              type="text"
                              placeholder="Rótulo"
                              value={settings.label ?? field.label}
                              onChange={(e) => setGridFieldSettings({
                                ...gridFieldSettings,
                                [field.key]: { ...settings, label: e.target.value }
                              })}
                              disabled={!isVisible}
                              className="w-full bg-elegant-bg border border-elegant-border rounded p-1.5 text-xs text-elegant-text-bright focus:border-elegant-accent outline-none disabled:opacity-50"
                            />
                          </div>
                          
                          <div className="col-span-2">
                            <select 
                              value={settings.tipo || 'texto'}
                              onChange={(e) => setGridFieldSettings({
                                ...gridFieldSettings,
                                [field.key]: { ...settings, tipo: e.target.value as any }
                              })}
                              disabled={!isVisible}
                              className="w-full bg-elegant-bg border border-elegant-border rounded p-1.5 text-xs text-elegant-text-bright focus:border-elegant-accent outline-none disabled:opacity-50"
                            >
                              <option value="texto">Texto</option>
                              <option value="moeda">Moeda</option>
                              <option value="numero">Número</option>
                              <option value="inteiro">Inteiro</option>
                              <option value="data">Data</option>
                            </select>
                          </div>

                          <div className="col-span-2">
                            <select 
                              value={settings.estilo || 'Normal'}
                              onChange={(e) => setGridFieldSettings({
                                ...gridFieldSettings,
                                [field.key]: { ...settings, estilo: e.target.value as any }
                              })}
                              disabled={!isVisible}
                              className="w-full bg-elegant-bg border border-elegant-border rounded p-1.5 text-xs text-elegant-text-bright focus:border-elegant-accent outline-none disabled:opacity-50"
                            >
                              <option value="Normal">Normal</option>
                              <option value="Tag">Tag</option>
                              <option value="Destaque">Destaque</option>
                            </select>
                          </div>

                          <div className="col-span-2">
                            <select 
                              value={settings.totalizador || 'Nenhum'}
                              onChange={(e) => setGridFieldSettings({
                                ...gridFieldSettings,
                                [field.key]: { ...settings, totalizador: e.target.value as any }
                              })}
                              disabled={!isVisible}
                              className="w-full bg-elegant-bg border border-elegant-border rounded p-1.5 text-xs text-elegant-text-bright focus:border-elegant-accent outline-none disabled:opacity-50"
                            >
                              <option value="Nenhum">Nenhum</option>
                              <option value="Soma">Soma</option>
                              <option value="Média">Média</option>
                              <option value="Contagem">Contagem</option>
                            </select>
                          </div>
                          
                          <div className="col-span-2 relative">
                            <input 
                              type="text"
                              placeholder="tabela.campo"
                              value={settings.display || ''}
                              onChange={(e) => setGridFieldSettings({
                                ...gridFieldSettings,
                                [field.key]: { ...settings, display: e.target.value }
                              })}
                              disabled={!isVisible}
                              className="w-full bg-elegant-bg border border-elegant-border rounded p-1.5 text-xs text-elegant-text-bright focus:border-elegant-accent outline-none placeholder:text-elegant-text-muted/30 disabled:opacity-50"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                <div className="p-4 border-t border-elegant-border bg-elegant-bg flex justify-end gap-3">
                  <button 
                    onClick={() => { setIsGridColumnConfigOpen(false); loadProdutos(true); }}
                    className="px-6 py-2 bg-elegant-card border border-elegant-border rounded text-sm text-elegant-text-label hover:bg-elegant-accent/10 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleSaveGridColumnConfig}
                    disabled={isSavingGridColumnConfig}
                    className="px-6 py-2 bg-elegant-accent text-white rounded text-sm font-semibold hover:bg-elegant-accent/90 transition-colors shadow-lg shadow-elegant-accent/20 flex items-center gap-2"
                  >
                    {isSavingGridColumnConfig ? <Loader2 className="animate-spin" size={16} /> : <><Save size={16} /> Salvar Configuração</>}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        {(isDeleting || isSubmitLoading || isSavingGrid) && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-elegant-card p-6 rounded-lg border border-elegant-border shadow-xl flex items-center gap-3">
              <Loader2 className="animate-spin text-elegant-accent" />
              <p className="text-elegant-text-bright">Processando...</p>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Configuração de Filtros */}
      <AnimatePresence>
        {isFilterConfigOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            style={{ backdropFilter: 'blur(4px)' }}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-elegant-card border border-elegant-border rounded-xl shadow-2xl w-full max-w-xl overflow-hidden"
            >
              <div className="p-4 border-b border-elegant-border flex justify-between items-center bg-elegant-bg">
                <h2 className="text-lg font-bold text-elegant-text-bright">Configurar Filtros de Pesquisa</h2>
                <button onClick={() => setIsFilterConfigOpen(false)} className="p-2 hover:bg-elegant-accent/10 rounded-full transition-colors font-bold"><X size={20} /></button>
              </div>
              <div className="p-6 max-h-[60vh] overflow-y-auto no-scrollbar">
                <p className="text-sm text-elegant-text-label mb-4">Selecione os campos que deseja disponibilizar na tela de filtragem de produtos. Campos do tipo ID serão exibidos como listas de seleção.</p>
                <div className="grid grid-cols-2 gap-3">
                  {/* Field Descrição is special */}
                  <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${activeFilterFields.includes('descricao') ? 'bg-elegant-accent/10 border-elegant-accent shadow-sm' : 'bg-elegant-bg border-elegant-border hover:border-elegant-text-label/30'}`}>
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-elegant-border text-elegant-accent focus:ring-elegant-accent"
                      checked={activeFilterFields.includes('descricao')}
                      onChange={(e) => {
                        if (e.target.checked) setActiveFilterFields([...activeFilterFields, 'descricao']);
                        else setActiveFilterFields(activeFilterFields.filter(f => f !== 'descricao'));
                      }}
                    />
                    <span className="text-sm font-medium text-elegant-text-bright">Descrição (Geral)</span>
                  </label>

                  {filterSchema.filter(f => !['id', 'descricao', 'date_insert', 'date_update'].includes(f.key)).map(field => (
                    <label key={field.key} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${activeFilterFields.includes(field.key) ? 'bg-elegant-accent/10 border-elegant-accent shadow-sm' : 'bg-elegant-bg border-elegant-border hover:border-elegant-text-label/30'}`}>
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-elegant-border text-elegant-accent focus:ring-elegant-accent"
                        checked={activeFilterFields.includes(field.key)}
                        onChange={(e) => {
                          if (e.target.checked) setActiveFilterFields([...activeFilterFields, field.key]);
                          else setActiveFilterFields(activeFilterFields.filter(f => f !== field.key));
                        }}
                      />
                      <span className="text-sm font-medium text-elegant-text-bright">{field.label} {field.isRelation ? '(Lista)' : ''}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="p-4 bg-elegant-bg border-t border-elegant-border flex justify-end gap-3">
                <button 
                  onClick={() => setIsFilterConfigOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-elegant-text-label hover:text-elegant-text-bright transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSaveFilterConfig}
                  disabled={isSavingFilterConfig}
                  className="px-6 py-2 bg-elegant-accent hover:bg-elegant-accent/90 text-white rounded-lg text-sm font-bold shadow-lg shadow-elegant-accent/20 flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  {isSavingFilterConfig ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Salvar Configuração
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {isExpanding && (
          <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center">
             <div className="bg-elegant-card p-6 rounded-xl border border-elegant-border shadow-2xl flex items-center gap-4">
               <Loader2 className="animate-spin text-elegant-accent" size={24} />
               <p className="text-elegant-text-bright font-semibold">Expandindo...</p>
             </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
