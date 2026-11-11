
import React, { useState, useEffect } from 'react';
import { useRefreshDaTela } from '@/components/LayoutApp';
import { motion } from 'motion/react';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Loader2,
  Save,
  MapPin,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { useRouter } from '@/lib/nav';
import { getGridConfigs, saveGridConfigs, GridColumnConfig } from '@/lib/grid-config';
import { formatNumber } from '@/lib/utils';
import { ListaCrm } from '@/components/ListaCrm';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AbasCrm } from '@/components/TelaHeader';
import { FormCrm, Campo, INPUT_CLASS } from '@/components/FormCrm';
import { BotaoAcao } from '@/components/MenuAcoes';

interface Localizacao {
  id: number;
  codigo: string;
  descricao: string;
  pai_id: number | null;
  pai_descricao?: string;
  tipo: string;
  ativo: number;
  children_count?: number;
}

export default function LocalizacoesPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [localizacoes, setLocalizacoes] = useState<Localizacao[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [tiposLocalizacao, setTiposLocalizacao] = useState<string[]>([]);
  const [gridConfigs, setGridConfigs] = useState<GridColumnConfig[]>([]);
  const [isSavingGrid, setIsSavingGrid] = useState(false);
  const [activeTab, setActiveTab] = useState<'grid' | 'edit'>('grid');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const [editingLocalizacao, setEditingLocalizacao] = useState<Localizacao | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: number | null }>({ isOpen: false, id: null });
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const [formData, setFormData] = useState({
    codigo: '',
    descricao: '',
    pai_id: '',
    tipo: '',
    ativo: 1
  });

  const fetchData = React.useCallback(async () => {
    try {
      const [userRes, locRes, configRes, tiposRes] = await Promise.all([
        fetch('/api/user'),
        fetch('/api/localizacoes'),
        getGridConfigs(),
        fetch('/api/localizacoes/tipos')
      ]);

      if (userRes.ok) {
        const userData = await userRes.json();
        setCurrentUser(userData);
      } else {
        router.push('/');
        return;
      }

      if (locRes.ok) {
        const locData = await locRes.json();
        setLocalizacoes(locData);
      }

      if (tiposRes.ok) {
        const tiposData = await tiposRes.json();
        setTiposLocalizacao(tiposData);
      }

      setGridConfigs(configRes);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
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

  const openForm = (localizacao: Localizacao | null = null) => {
    if (localizacao) {
      setEditingLocalizacao(localizacao);
      setFormData({ 
        codigo: localizacao.codigo || '',
        descricao: localizacao.descricao,
        pai_id: localizacao.pai_id ? localizacao.pai_id.toString() : '',
        tipo: localizacao.tipo || '',
        ativo: localizacao.ativo
      });
    } else {
      setEditingLocalizacao(null);
      setFormData({ 
        codigo: '',
        descricao: '',
        pai_id: '',
        tipo: '',
        ativo: 1
      });
    }
    setError('');
    setActiveTab('edit');
  };

  const closeTab = () => setActiveTab('grid');

  const handleSaveLocalizacao = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitLoading(true);
    setError('');

    const url = editingLocalizacao ? `/api/localizacoes/${editingLocalizacao.id}` : '/api/localizacoes';
    const method = editingLocalizacao ? 'PATCH' : 'POST';

    const payload = {
      ...formData,
      pai_id: formData.pai_id ? parseInt(formData.pai_id) : null
    };

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        await fetchData();
        closeTab();
      } else {
        const data = await res.json();
        setError(data.error || 'Erro ao salvar localização.');
      }
    } catch (err) {
      setError('Erro de conexão com o servidor.');
    } finally {
      setIsSubmitLoading(false);
    }
  };

  const handleDeleteLocalizacao = (id: number) => {
    setDeleteConfirm({ isOpen: true, id });
  };

  const confirmDeleteLocalizacao = async () => {
    const { id } = deleteConfirm;
    if (id === null) return;
    setDeleteConfirm({ isOpen: false, id: null });
    setIsDeleting(true);
    
    try {
      const res = await fetch(`/api/localizacoes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchData();
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao excluir localização.');
      }
    } catch (err) {
      alert('Erro de conexão.');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleExpand = (id: number) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };


  // Lista achatada da árvore (só os ramos expandidos), com a profundidade de cada linha
  const linhasArvore = (paiId: number | null = null, depth = 0): any[] =>
    localizacoes.filter((c: any) => (paiId === null ? c.pai_id === null : Number(c.pai_id) === Number(paiId))).flatMap((c: any) => [
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

  useRefreshDaTela(() => fetchData());

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
          lista="Localizações"
          total={localizacoes.length}
          abas={activeTab === 'edit' ? [{ key: 'edit', titulo: editingLocalizacao ? 'Editar Localização' : 'Nova Localização', novo: !editingLocalizacao }] : []}
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
              id="localizacoes"
              chave={(r: any) => r.id}
              linhas={linhasArvore()}
              ordenavel={false}
              onEditar={openForm}
              vazio="Nenhuma localização encontrada."
              colunas={[
                { key: 'id', label: 'ID', alinhar: 'numero', largura: 120, render: (r: any) => formatNumber(r.id, 0) },
                { key: 'codigo', label: 'Código', largura: 120, render: (r: any) => <span className="font-mono">{r.codigo}</span> },
                { key: 'descricao', label: 'Descrição', largura: 320, render: (r: any) => celulaArvore(r, r.descricao) },
                { key: 'pai_descricao', label: 'Local Pai', largura: 180, render: (r: any) => r.pai_descricao || '-' },
                { key: 'tipo', label: 'Tipo', alinhar: 'centro', largura: 150, render: (r: any) => r.tipo || '-' },
                { key: 'ativo', label: 'Ativo', alinhar: 'centro', largura: 100, render: (r: any) => <span className={`${r.ativo ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'} font-medium`}>{r.ativo ? 'Sim' : 'Não'}</span> },
              ]}
              acoes={(r: any) => (
                <>
                  <BotaoAcao icone={Pencil} titulo="Editar" descricao="Abre o registro para edição" onClick={() => openForm(r)} />
                  <BotaoAcao icone={Trash2} titulo="Excluir" descricao="Apaga o registro (pede confirmação)" tom="perigo" onClick={() => handleDeleteLocalizacao(r.id)} />
                </>
              )}
            />
          ) : (
            <FormCrm
              id="localizacoes"
              onSubmit={handleSaveLocalizacao}
              onCancel={closeTab}
              saving={isSubmitLoading}
              erro={error}
              onFecharErro={() => setError('')}
              rodape={editingLocalizacao ? `Registro #${editingLocalizacao.id}` : 'Inclusão'}
            >
              <Campo rotulo="Descrição" span={2}>
                <input autoFocus
                                type="text"
                                required
                                value={formData.descricao}
                                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                                onFocus={(e) => e.target.select()}
                                className={INPUT_CLASS}
                                placeholder="EX: Prateleira A, Corredor 2..."
                              />
              </Campo>
              <Campo rotulo="Código" span={1}>
                <input
                                type="text"
                                value={formData.codigo}
                                onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                                onFocus={(e) => e.target.select()}
                                className={`${INPUT_CLASS} font-mono`}
                                placeholder="EX: PRAT-A"
                              />
              </Campo>
              <Campo rotulo="Local Pai (Hierarquia)" span={2}>
                <select
                                value={formData.pai_id}
                                onChange={(e) => setFormData({ ...formData, pai_id: e.target.value })}
                                className={INPUT_CLASS}
                              >
                                <option value="">Nenhum (Raiz)</option>
                                {localizacoes
                                  .filter(l => !editingLocalizacao || l.id !== editingLocalizacao.id) // Cannot be parent of itself
                                  .map(loc => (
                                    <option key={loc.id} value={loc.id}>{loc.codigo ? `[${loc.codigo}] ` : ''}{loc.descricao}</option>
                                ))}
                              </select>
              </Campo>
              <Campo rotulo="Tipo" span={1}>
                <select
                                value={formData.tipo}
                                onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                                className={INPUT_CLASS}
                              >
                                <option value="">Selecione o tipo</option>
                                {tiposLocalizacao.map(t => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
              </Campo>
            </FormCrm>
          )}
        </div>
        {deleteConfirm.isOpen && (
          <ConfirmDialog
            titulo="Confirmar exclusão"
            mensagem="Tem certeza que deseja excluir esta localização? Pode haver produtos vinculados a ela."
            onConfirmar={confirmDeleteLocalizacao}
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
