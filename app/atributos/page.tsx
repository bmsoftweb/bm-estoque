
import React, { useState, useEffect } from 'react';
import { useRefreshDaTela } from '@/components/LayoutApp';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Loader2,
  Save,
  MoreVertical,
  X
} from 'lucide-react';
import { useRouter } from '@/lib/nav';
import { getGridConfigs, saveGridConfigs, GridColumnConfig } from '@/lib/grid-config';
import { formatNumber } from '@/lib/utils';
import { ListChecks } from 'lucide-react';
import { ListaCrm } from '@/components/ListaCrm';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AbasCrm } from '@/components/TelaHeader';
import { FormCrm, Campo, INPUT_CLASS, TelaCheia, SecaoCrm, GradeCampos } from '@/components/FormCrm';
import { BotaoAcao } from '@/components/MenuAcoes';

interface Atributo {
  id: number;
  nome: string;
  ativo: number;
}

export default function AtributosPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [atributos, setAtributos] = useState<Atributo[]>([]);
  const [gridConfigs, setGridConfigs] = useState<GridColumnConfig[]>([]);
  const [isSavingGrid, setIsSavingGrid] = useState(false);
  const [activeTab, setActiveTab] = useState<'grid' | 'edit'>('grid');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const [editingAtributo, setEditingAtributo] = useState<Atributo | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: number | null }>({ isOpen: false, id: null });
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  const [activeAttr, setActiveAttr] = useState<Atributo | null>(null);
  const [attrValores, setAttrValores] = useState<any[]>([]);
  const [editingValor, setEditingValor] = useState<any | null>(null);
  const [formDataValor, setFormDataValor] = useState({ valor: '', codigo_hex: '#000000' });
  const [error, setError] = useState('');

  const handleDeleteValor = (id: number) => {
    setDeleteConfirm({ isOpen: true, id });
  };

  const confirmDeleteValor = async () => {
    const { id } = deleteConfirm;
    if (id === null || !activeAttr) return;
    setDeleteConfirm({ isOpen: false, id: null });
    setIsDeleting(true);
    
    try {
       const res = await fetch(`/api/atributos/${activeAttr.id}/valores`, {
         method: 'DELETE',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ valor_id: id })
       });
       if (res.ok) {
         setAttrValores(attrValores.filter(v => v.id !== id));
       } else {
         alert('Erro ao excluir valor.');
       }
    } catch (err) {
      alert('Erro de conexão.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveValor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAttr) return;

    const isEdit = !!editingValor.id;
    const url = `/api/atributos/${activeAttr.id}/valores`;
    const method = isEdit ? 'PATCH' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formDataValor, valor_id: editingValor.id })
      });
      if (res.ok) {
        setEditingValor(null);
        // Refresh values
        const newRes = await fetch(`/api/atributos/${activeAttr.id}/valores`);
        setAttrValores(await newRes.json());
      }
    } catch (err) {
      console.error('Error saving valor:', err);
    }
  };

  useEffect(() => {
    if (activeAttr) {
      fetch(`/api/atributos/${activeAttr.id}/valores`)
        .then(res => res.json())
        .then(data => setAttrValores(data))
        .catch(err => console.error('Erro ao buscar valores:', err));
    }
  }, [activeAttr]);
  const router = useRouter();

  const [formData, setFormData] = useState({
    nome: '',
    ativo: 1
  });

  const fetchData = React.useCallback(async (isRefresh = false) => {
    if (!isRefresh) setIsLoading(true);
    try {
      const [userRes, attrRes, configRes] = await Promise.all([
        fetch('/api/user'),
        fetch('/api/atributos'),
        getGridConfigs()
      ]);

      if (userRes.ok) {
        const userData = await userRes.json();
        setCurrentUser(userData);
      } else {
        router.push('/');
        return;
      }

      if (attrRes.ok) {
        const attrData = await attrRes.json();
        setAtributos(attrData);
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

  const openForm = (atributo: Atributo | null = null) => {
    if (atributo) {
      setEditingAtributo(atributo);
      setFormData({ 
        nome: atributo.nome,
        ativo: atributo.ativo
      });
    } else {
      setEditingAtributo(null);
      setFormData({ 
        nome: '',
        ativo: 1
      });
    }
    setError('');
    setActiveTab('edit');
  };

  const closeTab = () => {
    setActiveAttr(null);
    setActiveTab('grid');
  };

  const handleSaveAtributo = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitLoading(true);
    setError('');

    const url = editingAtributo ? `/api/atributos/${editingAtributo.id}` : '/api/atributos';
    const method = editingAtributo ? 'PATCH' : 'POST';

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
        setError(data.error || 'Erro ao salvar atributo.');
      }
    } catch (err) {
      setError('Erro de conexão com o servidor.');
    } finally {
      setIsSubmitLoading(false);
    }
  };

  const handleDeleteAtributo = (id: number) => {
    setDeleteConfirm({ isOpen: true, id });
  };

  const confirmDeleteAtributo = async () => {
    const { id } = deleteConfirm;
    if (id === null) return;
    setDeleteConfirm({ isOpen: false, id: null });
    setIsDeleting(true);
    
    try {
      const res = await fetch(`/api/atributos/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchData(true);
      } else {
        alert('Erro ao excluir atributo.');
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
          lista="Atributos"
          total={atributos.length}
          abas={activeAttr ? [{ key: 'valores', titulo: 'Valores: ' + activeAttr.nome }] : activeTab === 'edit' ? [{ key: 'edit', titulo: editingAtributo ? 'Editar Atributo' : 'Novo Atributo', novo: !editingAtributo }] : []}
          ativa={activeAttr ? 'valores' : activeTab === 'edit' ? 'edit' : null}
          onAtivar={(k) => { if (k === null) closeTab(); }}
          onFechar={() => closeTab()}
        />

        <div className="w-full flex-1 min-h-0 overflow-y-auto flex flex-col">
          {activeAttr ? (
            <TelaCheia rodape={'Atributo #' + activeAttr.id + ' • Valores'} onVoltar={() => setActiveAttr(null)}>
              <SecaoCrm
                titulo={editingValor ? (editingValor.id ? 'Editar valor' : 'Novo valor') : 'Valores'}
                direita={
                  !editingValor && (
                    <button type="button" onClick={() => { setEditingValor({}); setFormDataValor({ valor: '', codigo_hex: '#000000' }); }} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer">
                      <Plus className="w-3.5 h-3.5" />
                      <span>Novo valor</span>
                    </button>
                  )
                }
              >
                {editingValor && (
                  <form onSubmit={handleSaveValor}>
                    <GradeCampos>
                      <Campo rotulo="Valor *" span={2}>
                        <input autoFocus type="text" required value={formDataValor.valor} onChange={(e) => setFormDataValor({ ...formDataValor, valor: e.target.value })} onFocus={(e) => e.target.select()} className={INPUT_CLASS} />
                      </Campo>
                      <Campo rotulo="Cor">
                        <input type="color" value={formDataValor.codigo_hex} onChange={(e) => setFormDataValor({ ...formDataValor, codigo_hex: e.target.value })} className="h-8 w-full cursor-pointer" />
                      </Campo>
                      <div className="flex items-end gap-2">
                        <button type="button" onClick={() => setEditingValor(null)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-stone-600 dark:text-stone-300 border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer">Cancelar</button>
                        <button type="submit" className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer">Salvar</button>
                      </div>
                    </GradeCampos>
                  </form>
                )}
              </SecaoCrm>

              <SecaoCrm titulo={'Valores de ' + activeAttr.nome}>
                <ListaCrm
                  id="atributos_valores"
                  className="max-h-[28rem]"
                  paginar={false}
                  buscar={false}
                  chave={(v: any) => v.id}
                  linhas={attrValores}
                  onEditar={(v: any) => { setEditingValor(v); setFormDataValor({ valor: v.valor, codigo_hex: v.codigo_hex }); }}
                  vazio="Nenhum valor cadastrado."
                  colunas={[
                    { key: 'valor', label: 'Valor', largura: 320 },
                    { key: 'codigo_hex', label: 'Cor', alinhar: 'centro', largura: 120, render: (v: any) => <span className="inline-block w-5 h-5 rounded border border-stone-300 dark:border-stone-600 align-middle" style={{ backgroundColor: v.codigo_hex }} title={v.codigo_hex} /> },
                  ]}
                  acoes={(v: any) => (
                    <>
                      <BotaoAcao icone={Pencil} titulo="Editar" descricao="Edita o valor" onClick={() => { setEditingValor(v); setFormDataValor({ valor: v.valor, codigo_hex: v.codigo_hex }); }} />
                      <BotaoAcao icone={Trash2} titulo="Excluir" descricao="Apaga o valor (pede confirmação)" tom="perigo" onClick={() => handleDeleteValor(v.id)} />
                    </>
                  )}
                />
              </SecaoCrm>
            </TelaCheia>
          ) : activeTab === 'grid' ? (
            <ListaCrm
              className="flex-1"
              onNovo={() => openForm()}
              id="atributos"
              chave={(r: any) => r.id}
              linhas={atributos}
              onEditar={openForm}
              vazio="Nenhum atributo cadastrado."
              colunas={[
                { key: 'id', label: 'ID', alinhar: 'numero', largura: 120, render: (r: any) => formatNumber(r.id, 0) },
                { key: 'nome', label: 'Nome', largura: 300 },
                { key: 'ativo', label: 'Ativo', alinhar: 'centro', largura: 100, render: (r: any) => <span className={`${r.ativo ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'} font-medium`}>{r.ativo ? 'Sim' : 'Não'}</span> },
              ]}
              acoes={(r: any) => (
                <>
                  <BotaoAcao icone={ListChecks} titulo="Valores" descricao="Abre os valores do atributo" onClick={() => setActiveAttr(r)} />
                  <BotaoAcao icone={Pencil} titulo="Editar" descricao="Abre o registro para edição" onClick={() => openForm(r)} />
                  <BotaoAcao icone={Trash2} titulo="Excluir" descricao="Apaga o registro (pede confirmação)" tom="perigo" onClick={() => handleDeleteAtributo(r.id)} />
                </>
              )}
            />
          ) : (
            <FormCrm
              id="atributos"
              onSubmit={handleSaveAtributo}
              onCancel={closeTab}
              saving={isSubmitLoading}
              erro={error}
              onFecharErro={() => setError('')}
              rodape={editingAtributo ? `Registro #${editingAtributo.id}` : 'Inclusão'}
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
            </FormCrm>
          )}
        </div>
        {deleteConfirm.isOpen && (
          <ConfirmDialog
            titulo="Confirmar exclusão"
            mensagem={'Tem certeza que deseja excluir ' + (activeAttr ? 'este valor' : 'este atributo') + '?'}
            onConfirmar={activeAttr ? confirmDeleteValor : confirmDeleteAtributo}
            onCancelar={() => setDeleteConfirm({ isOpen: false, id: null })}
          />
        )}
        
        {(isDeleting || isSubmitLoading || isSavingGrid) && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]">
            <div className="bg-elegant-card p-6 rounded-lg border border-elegant-border shadow-xl flex items-center gap-3">
              <Loader2 className="animate-spin text-elegant-accent" />
              <p className="text-elegant-text-bright font-medium">Processando...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
