
import React, { useState, useEffect, useRef } from 'react';
import { useRefreshDaTela } from '@/components/LayoutApp';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Loader2, 
  ChevronRight, 
  ChevronDown,
  Database,
  Save
} from 'lucide-react';
import { useRouter } from '@/lib/nav';
import { getGridConfigs, saveGridConfigs, GridColumnConfig } from '@/lib/grid-config';
import { formatNumber } from '@/lib/utils';
import { ListaCrm } from '@/components/ListaCrm';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AbasCrm } from '@/components/TelaHeader';
import { FormCrm, Campo, INPUT_CLASS } from '@/components/FormCrm';
import { BotaoAcao } from '@/components/MenuAcoes';

interface Categoria {
  id: number;
  nome: string;
  descricao: string | null;
  categoria_pai: number | null;
  ativo: number;
  children_count: number;
  date_insert: string;
  date_update: string;
}

export default function CategoriasPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [gridConfigs, setGridConfigs] = useState<GridColumnConfig[]>([]);
  const [isSavingGrid, setIsSavingGrid] = useState(false);
  const [activeTab, setActiveTab] = useState<'grid' | 'edit'>('grid');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState<Categoria | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: number | null }>({ isOpen: false, id: null });
  const [error, setError] = useState('');
  const router = useRouter();

  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    categoria_pai: '' as string | number,
    ativo: 1
  });

  const fetchData = React.useCallback(async (isRefresh = false) => {
    if (!isRefresh) setIsLoading(true);
    try {
      const [userRes, catRes, configRes] = await Promise.all([
        fetch('/api/user'),
        fetch('/api/categorias'),
        getGridConfigs()
      ]);

      if (userRes.ok) {
        const userData = await userRes.json();
        setCurrentUser(userData);
      } else {
        router.push('/');
        return;
      }

      if (catRes.ok) {
        const catData = await catRes.json();
        setCategorias(catData);
      }

      setGridConfigs(configRes);
    } catch (err) {
      console.error(err);
    } finally {
      if (!isRefresh) setIsLoading(false);
    }
  }, [router]);

  const handleSaveGrid = async (gridName: string) => {
    setIsSavingGrid(true);
    const table = document.querySelector(`[data-grid="${gridName}"]`);
    if (!table) return;

    const headers = table.querySelectorAll('th[data-col]');
    const newConfigs: GridColumnConfig[] = [];

    headers.forEach((th: any) => {
      const colName = th.getAttribute('data-col');
      if (colName) {
        newConfigs.push({
          nome_do_modulo: 'Estoque',
          nome_do_grid: gridName,
          nome_da_coluna: colName,
          largura_da_coluna: th.offsetWidth + 'px'
        });
      }
    });

    await saveGridConfigs(newConfigs);
    setGridConfigs(await getGridConfigs());
    setIsSavingGrid(false);
  };

  const getColumnWidth = (gridName: string, colName: string, defaultWidth: string) => {
    const config = gridConfigs.find(c => 
      c.nome_do_modulo === 'Estoque' && 
      c.nome_do_grid === gridName && 
      c.nome_da_coluna === colName
    );
    return config ? config.largura_da_coluna : defaultWidth;
  };

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (isMounted) await fetchData();
    };
    load();
    return () => { isMounted = false; };
  }, [fetchData]);

  const toggleExpand = (id: number) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const openForm = (categoria: Categoria | null = null) => {
    if (categoria) {
      setEditingCategoria(categoria);
      setFormData({
        nome: categoria.nome,
        descricao: categoria.descricao || '',
        categoria_pai: categoria.categoria_pai || '',
        ativo: categoria.ativo
      });
    } else {
      setEditingCategoria(null);
      setFormData({
        nome: '',
        descricao: '',
        categoria_pai: '',
        ativo: 1
      });
    }
    setError('');
    setActiveTab('edit');
  };

  const closeTab = () => setActiveTab('grid');

  const handleSaveCategoria = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitLoading(true);
    setError('');

    const url = editingCategoria ? `/api/categorias/${editingCategoria.id}` : '/api/categorias';
    const method = editingCategoria ? 'PATCH' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        await fetchData(true);
        closeTab();
      } else {
        const data = await res.json();
        setError(data.error || 'Erro ao salvar categoria.');
      }
    } catch (err) {
      setError('Erro de conexão com o servidor.');
    } finally {
      setIsSubmitLoading(false);
    }
  };

  const handleDeleteCategoria = (id: number) => {
    setDeleteConfirm({ isOpen: true, id });
  };

  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDeleteCategoria = async () => {
    const { id } = deleteConfirm;
    if (id === null) return;
    setDeleteConfirm({ isOpen: false, id: null });
    setIsDeleting(true); // Show loading modal
    
    try {
      const res = await fetch(`/api/categorias/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchData(true);
      } else {
        alert('Erro ao excluir categoria.');
      }
    } catch (err) {
      alert('Erro de conexão.');
    } finally {
      setIsDeleting(false); // Hide loading modal
    }
  };


  // Lista achatada da árvore (só os ramos expandidos), com a profundidade de cada linha
  const linhasArvore = (paiId: number | null = null, depth = 0): any[] =>
    categorias.filter((c: any) => (paiId === null ? c.categoria_pai === null : Number(c.categoria_pai) === Number(paiId))).flatMap((c: any) => [
      { ...c, depth },
      ...(expandedIds.has(c.id) && (c.children_count || 0) > 0 ? linhasArvore(c.id, depth + 1) : []),
    ]);

  /** Célula do nome: recuo pela profundidade, seta de expandir e contagem de filhos */
  const celulaArvore = (r: any, texto: string) => {
    const filhos = r.children_count || 0;
    const aberto = expandedIds.has(r.id);
    return (
      <div className="flex items-center gap-2" style={{ paddingLeft: `${r.depth * 28}px` }}>
        {filhos > 0 ? (
          <button type="button" onClick={(e) => { e.stopPropagation(); toggleExpand(r.id); }} className="p-0.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded cursor-pointer">
            {aberto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <div className="w-[18px]" />
        )}
        <span className={r.depth > 0 ? 'text-stone-500 dark:text-stone-400' : 'font-semibold'}>{texto}</span>
        {filhos > 0 && !aberto && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-[9px] font-bold">{filhos}</span>}
      </div>
    );
  };

  // Helper to render hierarchical categories in SELECT options
  const renderCategoryOptions = (parentId: number | null = null, depth = 0): React.ReactNode[] => {
    return categorias
      .filter(c => {
        if (parentId === null) return c.categoria_pai === null;
        return Number(c.categoria_pai) === Number(parentId);
      })
      .filter(c => !editingCategoria || c.id !== editingCategoria.id) // Don't allow selecting self as parent
      .flatMap(cat => [
        <option key={cat.id} value={cat.id}>
          {'\u00A0'.repeat(depth * 4)}{cat.nome}
        </option>,
        ...renderCategoryOptions(cat.id, depth + 1)
      ]);
  };

  useRefreshDaTela(() => fetchData(true));

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
          lista="Categorias"
          total={categorias.length}
          abas={activeTab === 'edit' ? [{ key: 'edit', titulo: editingCategoria ? 'Editar Categoria' : 'Nova Categoria', novo: !editingCategoria }] : []}
          ativa={activeTab === 'edit' ? 'edit' : null}
          onAtivar={(k) => k === null && closeTab()}
          onFechar={() => closeTab()}
        />

        <div className="w-full flex-1 min-h-0 overflow-y-auto flex flex-col">
          {activeTab === 'grid' ? (
            <ListaCrm
              className="flex-1"
              onNovo={() => openForm()}
              paginar={false}
              buscar={false}
              id="categorias"
              chave={(r: any) => r.id}
              linhas={linhasArvore()}
              ordenavel={false}
              onEditar={openForm}
              vazio="Nenhuma categoria cadastrada."
              colunas={[
                { key: 'id', label: 'ID', alinhar: 'numero', largura: 120, render: (r: any) => formatNumber(r.id, 0) },
                { key: 'nome', label: 'Nome', largura: 320, render: (r: any) => celulaArvore(r, r.nome) },
                { key: 'descricao', label: 'Descrição', largura: 300, render: (r: any) => r.descricao || '-' },
                { key: 'categoria_pai', label: 'Pai', alinhar: 'numero', largura: 100, render: (r: any) => (r.categoria_pai ? formatNumber(r.categoria_pai, 0) : '-') },
                { key: 'ativo', label: 'Ativo', alinhar: 'centro', largura: 80, render: (r: any) => <span className={`${r.ativo ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'} font-medium`}>{r.ativo ? 'Sim' : 'Não'}</span> },
              ]}
              acoes={(r: any) => (
                <>
                  <BotaoAcao icone={Pencil} titulo="Editar" descricao="Abre o registro para edição" onClick={() => openForm(r)} />
                  <BotaoAcao icone={Trash2} titulo="Excluir" descricao="Apaga o registro (pede confirmação)" tom="perigo" onClick={() => handleDeleteCategoria(r.id)} />
                </>
              )}
            />
          ) : (
            <FormCrm
              id="categorias"
              onSubmit={handleSaveCategoria}
              onCancel={closeTab}
              saving={isSubmitLoading}
              erro={error}
              onFecharErro={() => setError('')}
              rodape={editingCategoria ? `Registro #${editingCategoria.id}` : 'Inclusão'}
            >
              <Campo rotulo="Nome" span={2}>
                <input autoFocus 
                                required 
                                value={formData.nome} 
                                onChange={(e) => setFormData({...formData, nome: e.target.value})} 
                                onFocus={(e) => e.target.select()}
                                className={INPUT_CLASS} 
                              />
              </Campo>
              <Campo rotulo="Descrição" span={4}>
                <textarea 
                                value={formData.descricao} 
                                onChange={(e) => setFormData({...formData, descricao: e.target.value})} 
                                onFocus={(e) => e.target.select()}
                                className={`${INPUT_CLASS} h-24 resize-none`} 
                              />
              </Campo>
              <Campo rotulo="Categoria Pai" span={2}>
                <select 
                                value={formData.categoria_pai} 
                                onChange={(e) => setFormData({...formData, categoria_pai: e.target.value})} 
                                className={INPUT_CLASS}
                              >
                                <option value="">Nenhuma (Raiz)</option>
                                {renderCategoryOptions()}
                              </select>
              </Campo>
            </FormCrm>
          )}
        </div>
        {deleteConfirm.isOpen && (
          <ConfirmDialog
            titulo="Confirmar exclusão"
            mensagem="Tem certeza que deseja excluir esta categoria?"
            onConfirmar={confirmDeleteCategoria}
            onCancelar={() => setDeleteConfirm({ isOpen: false, id: null })}
          />
        )}
        {(isDeleting || isSubmitLoading || isSavingGrid) && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-elegant-card p-6 rounded-lg border border-elegant-border shadow-xl flex items-center gap-3">
              <Loader2 className="animate-spin text-elegant-accent" />
              <p className="text-elegant-text-bright">Processando...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
