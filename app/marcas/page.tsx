
import React, { useState, useEffect } from 'react';
import { useRefreshDaTela } from '@/components/LayoutApp';
import { motion } from 'motion/react';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Loader2,
  Save,
  Tag
} from 'lucide-react';
import { useRouter } from '@/lib/nav';
import { getGridConfigs, saveGridConfigs, GridColumnConfig } from '@/lib/grid-config';
import { formatNumber } from '@/lib/utils';
import { ListaCrm } from '@/components/ListaCrm';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AbasCrm } from '@/components/TelaHeader';
import { FormCrm, Campo, INPUT_CLASS } from '@/components/FormCrm';
import { BotaoAcao } from '@/components/MenuAcoes';

interface Marca {
  id: number;
  descricao: string;
}

export default function MarcasPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [gridConfigs, setGridConfigs] = useState<GridColumnConfig[]>([]);
  const [isSavingGrid, setIsSavingGrid] = useState(false);
  const [activeTab, setActiveTab] = useState<'grid' | 'edit'>('grid');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const [editingMarca, setEditingMarca] = useState<Marca | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: number | null }>({ isOpen: false, id: null });
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const [formData, setFormData] = useState({
    descricao: ''
  });

  const fetchData = React.useCallback(async (isRefresh = false) => {
    if (!isRefresh) setIsLoading(true);
    try {
      const [userRes, brandRes, configRes] = await Promise.all([
        fetch('/api/user'),
        fetch('/api/marcas'),
        getGridConfigs()
      ]);

      if (userRes.ok) {
        const userData = await userRes.json();
        setCurrentUser(userData);
      } else {
        router.push('/');
        return;
      }

      if (brandRes.ok) {
        const brandData = await brandRes.json();
        setMarcas(brandData);
      } else {
        const errorData = await brandRes.json().catch(() => ({}));
        setError(errorData.error || `Erro ${brandRes.status} ao buscar marcas`);
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

  const openForm = (marca: Marca | null = null) => {
    if (marca) {
      setEditingMarca(marca);
      setFormData({ 
        descricao: marca.descricao || ''
      });
    } else {
      setEditingMarca(null);
      setFormData({ 
        descricao: ''
      });
    }
    setError('');
    setActiveTab('edit');
  };

  const closeTab = () => setActiveTab('grid');

  const handleSaveMarca = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitLoading(true);
    setError('');

    const url = editingMarca ? `/api/marcas/${editingMarca.id}` : '/api/marcas';
    const method = editingMarca ? 'PATCH' : 'POST';

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
        setError(data.error || 'Erro ao salvar marca.');
      }
    } catch (err) {
      setError('Erro de conexão com o servidor.');
    } finally {
      setIsSubmitLoading(false);
    }
  };

  const handleDeleteMarca = (id: number) => {
    setDeleteConfirm({ isOpen: true, id });
  };

  const confirmDeleteMarca = async () => {
    const { id } = deleteConfirm;
    if (id === null) return;
    setDeleteConfirm({ isOpen: false, id: null });
    setIsDeleting(true);
    
    try {
      const res = await fetch(`/api/marcas/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchData(true);
      } else {
        alert('Erro ao excluir marca.');
      }
    } catch (err) {
      alert('Erro de conexão.');
    } finally {
      setIsDeleting(false);
    }
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
          lista="Marcas"
          total={marcas.length}
          abas={activeTab === 'edit' ? [{ key: 'edit', titulo: editingMarca ? 'Editar Marca' : 'Nova Marca', novo: !editingMarca }] : []}
          ativa={activeTab === 'edit' ? 'edit' : null}
          onAtivar={(k) => k === null && closeTab()}
          onFechar={() => closeTab()}
        />

        <div className="w-full flex-1 min-h-0 overflow-y-auto flex flex-col">
          {activeTab === 'grid' ? (
            <ListaCrm
              className="flex-1"
              onNovo={() => openForm()}
              id="marcas"
              chave={(m: Marca) => m.id}
              linhas={marcas}
              onEditar={openForm}
              vazio={error ? <span className="text-rose-600 font-bold">{error}</span> : 'Nenhuma marca cadastrada.'}
              colunas={[
                { key: 'id', label: 'ID', alinhar: 'numero', largura: 100, render: (m: Marca) => formatNumber(m.id, 0) },
                { key: 'descricao', label: 'Descrição', largura: 300 },
              ]}
              acoes={(m: Marca) => (
                <>
                  <BotaoAcao icone={Pencil} titulo="Editar" descricao="Abre o registro para edição" onClick={() => openForm(m)} />
                  <BotaoAcao icone={Trash2} titulo="Excluir" descricao="Apaga o registro (pede confirmação)" tom="perigo" onClick={() => handleDeleteMarca(m.id)} />
                </>
              )}
            />
          ) : (
            <FormCrm
              id="marcas"
              onSubmit={handleSaveMarca}
              onCancel={closeTab}
              saving={isSubmitLoading}
              erro={error}
              onFecharErro={() => setError('')}
              rodape={editingMarca ? `Registro #${editingMarca.id}` : 'Inclusão'}
            >
              <Campo rotulo="Descrição" span={2}>
                <input autoFocus 
                                required 
                                value={formData.descricao} 
                                onChange={(e) => setFormData({...formData, descricao: e.target.value})} 
                                onFocus={(e) => e.target.select()}
                                className={INPUT_CLASS} 
                              />
              </Campo>
            </FormCrm>
          )}
        </div>
        {deleteConfirm.isOpen && (
          <ConfirmDialog
            titulo="Confirmar exclusão"
            mensagem="Tem certeza que deseja excluir esta marca?"
            onConfirmar={confirmDeleteMarca}
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
