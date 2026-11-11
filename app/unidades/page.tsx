
import React, { useState, useEffect } from 'react';
import { useRefreshDaTela } from '@/components/LayoutApp';
import { motion } from 'motion/react';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Loader2,
  Save,
  Check
} from 'lucide-react';
import { useRouter } from '@/lib/nav';
import { getGridConfigs, saveGridConfigs, GridColumnConfig } from '@/lib/grid-config';
import { formatNumber } from '@/lib/utils';
import { ListaCrm } from '@/components/ListaCrm';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AbasCrm } from '@/components/TelaHeader';
import { FormCrm, Campo, INPUT_CLASS } from '@/components/FormCrm';
import { BotaoAcao } from '@/components/MenuAcoes';

interface Unidade {
  id: number;
  sigla: string;
  nome: string;
  tipo: string;
  ativo: number;
}

export default function UnidadesPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [gridConfigs, setGridConfigs] = useState<GridColumnConfig[]>([]);
  const [isSavingGrid, setIsSavingGrid] = useState(false);
  const [activeTab, setActiveTab] = useState<'grid' | 'edit'>('grid');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const [editingUnidade, setEditingUnidade] = useState<Unidade | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: number | null }>({ isOpen: false, id: null });
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const [formData, setFormData] = useState({
    nome: '',
    sigla: '',
    tipo: 'Unidade',
    ativo: 1
  });

  const fetchData = React.useCallback(async (isRefresh = false) => {
    if (!isRefresh) setIsLoading(true);
    try {
      const [userRes, unitRes, configRes] = await Promise.all([
        fetch('/api/user'),
        fetch('/api/unidades'),
        getGridConfigs()
      ]);

      if (userRes.ok) {
        const userData = await userRes.json();
        setCurrentUser(userData);
      } else {
        router.push('/');
        return;
      }

      if (unitRes.ok) {
        const unitData = await unitRes.json();
        setUnidades(unitData);
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

  const openForm = (unidade: Unidade | null = null) => {
    if (unidade) {
      setEditingUnidade(unidade);
      setFormData({ 
        nome: unidade.nome, 
        sigla: unidade.sigla,
        tipo: unidade.tipo,
        ativo: unidade.ativo
      });
    } else {
      setEditingUnidade(null);
      setFormData({ 
        nome: '', 
        sigla: '',
        tipo: 'Unidade',
        ativo: 1
      });
    }
    setError('');
    setActiveTab('edit');
  };

  const closeTab = () => setActiveTab('grid');

  const handleSaveUnidade = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitLoading(true);
    setError('');

    const url = editingUnidade ? `/api/unidades/${editingUnidade.id}` : '/api/unidades';
    const method = editingUnidade ? 'PATCH' : 'POST';

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
        setError(data.error || 'Erro ao salvar unidade.');
      }
    } catch (err) {
      setError('Erro de conexão com o servidor.');
    } finally {
      setIsSubmitLoading(false);
    }
  };

  const handleDeleteUnidade = (id: number) => {
    setDeleteConfirm({ isOpen: true, id });
  };

  const confirmDeleteUnidade = async () => {
    const { id } = deleteConfirm;
    if (id === null) return;
    setDeleteConfirm({ isOpen: false, id: null });
    setIsDeleting(true);
    
    try {
      const res = await fetch(`/api/unidades/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchData(true);
      } else {
        alert('Erro ao excluir unidade.');
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
          lista="Unidades"
          total={unidades.length}
          abas={activeTab === 'edit' ? [{ key: 'edit', titulo: editingUnidade ? 'Editar Unidade' : 'Nova Unidade', novo: !editingUnidade }] : []}
          ativa={activeTab === 'edit' ? 'edit' : null}
          onAtivar={(k) => k === null && closeTab()}
          onFechar={() => closeTab()}
        />

        <div className="w-full flex-1 min-h-0 overflow-y-auto flex flex-col">
          {activeTab === 'grid' ? (
            <ListaCrm
              className="flex-1"
              onNovo={() => openForm()}
              id="unidades"
              chave={(r: any) => r.id}
              linhas={unidades}
              onEditar={openForm}
              vazio="Nenhuma unidade cadastrada."
              colunas={[
                { key: 'id', label: 'ID', alinhar: 'numero', largura: 100, render: (r: any) => formatNumber(r.id, 0) },
                { key: 'sigla', label: 'Sigla', alinhar: 'centro', largura: 100, render: (r: any) => <span className="font-bold">{r.sigla}</span> },
                { key: 'nome', label: 'Nome', largura: 300 },
                { key: 'tipo', label: 'Tipo', alinhar: 'centro', largura: 120 },
                { key: 'ativo', label: 'Ativo', alinhar: 'centro', largura: 80, render: (r: any) => <span className={`${r.ativo ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'} font-medium`}>{r.ativo ? 'Sim' : 'Não'}</span> },
              ]}
              acoes={(r: any) => (
                <>
                  <BotaoAcao icone={Pencil} titulo="Editar" descricao="Abre o registro para edição" onClick={() => openForm(r)} />
                  <BotaoAcao icone={Trash2} titulo="Excluir" descricao="Apaga o registro (pede confirmação)" tom="perigo" onClick={() => handleDeleteUnidade(r.id)} />
                </>
              )}
            />
          ) : (
            <FormCrm
              id="unidades"
              onSubmit={handleSaveUnidade}
              onCancel={closeTab}
              saving={isSubmitLoading}
              erro={error}
              onFecharErro={() => setError('')}
              rodape={editingUnidade ? `Registro #${editingUnidade.id}` : 'Inclusão'}
            >
              <Campo rotulo="Sigla" span={1}>
                <input autoFocus 
                                required 
                                value={formData.sigla} 
                                onChange={(e) => setFormData({...formData, sigla: e.target.value})} 
                                onFocus={(e) => e.target.select()}
                                className={`${INPUT_CLASS} uppercase font-bold`} 
                              />
              </Campo>
              <Campo rotulo="Nome" span={2}>
                <input 
                                required 
                                value={formData.nome} 
                                onChange={(e) => setFormData({...formData, nome: e.target.value})} 
                                onFocus={(e) => e.target.select()}
                                className={INPUT_CLASS} 
                              />
              </Campo>
              <Campo rotulo="Tipo" span={1}>
                <select 
                                value={formData.tipo} 
                                onChange={(e) => setFormData({...formData, tipo: e.target.value})} 
                                className={INPUT_CLASS}
                              >
                                <option value="Unidade">Unidade</option>
                                <option value="Área">Área</option>
                                <option value="Comprimento">Comprimento</option>
                                <option value="Massa">Massa</option>
                                <option value="Volume">Volume</option>
                                <option value="Tempo">Tempo</option>
                                <option value="Outros">Outros</option>
                              </select>
              </Campo>
            </FormCrm>
          )}
        </div>
        {deleteConfirm.isOpen && (
          <ConfirmDialog
            titulo="Confirmar exclusão"
            mensagem="Tem certeza que deseja excluir esta unidade?"
            onConfirmar={confirmDeleteUnidade}
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
