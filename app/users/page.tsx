
import React, { useState, useEffect, useRef } from 'react';
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
  UserPlus, 
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

interface User {
  id: number;
  nome: string;
  email: string;
  senha: string;
  role: string;
}

interface UserData {
  userName: string;
  empresaNome?: string;
  userEmail: string;
  role: string;
  isLoggedIn: boolean;
}

export default function UsersManagement() {
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    senha: '',
    role: 'user'
  });
  const [error, setError] = useState('');

  const router = useRouter();
  const menuRef = useRef<HTMLTableSectionElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [userRes, usersRes] = await Promise.all([
          fetch('/api/user'),
          fetch('/api/users')
        ]);

        if (!userRes.ok) {
          router.push('/');
          return;
        }

        const userData = await userRes.json();
        setCurrentUser(userData);

        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setUsers(usersData);
        }
      } catch (err) {
        console.error('Data fetch error:', err);
        router.push('/');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [router]);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openModal = (user: User | null = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        nome: user.nome,
        email: user.email,
        senha: user.senha,
        role: user.role || 'user'
      });
    } else {
      setEditingUser(null);
      setFormData({ nome: '', email: '', senha: '', role: 'user' });
    }
    setError('');
    setShowModal(true);
    setActiveMenu(null);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitLoading(true);
    setError('');

    const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
    const method = editingUser ? 'PATCH' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        const updatedUser = await res.json();
        if (editingUser) {
          setUsers(users.map(u => u.id === editingUser.id ? updatedUser : u));
        } else {
          setUsers([updatedUser, ...users]);
        }
        setShowModal(false);
      } else {
        const data = await res.json();
        setError(data.error || 'Erro ao salvar usuário.');
      }
    } catch (err) {
      setError('Erro de conexão com o servidor.');
    } finally {
      setIsSubmitLoading(false);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;
    
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setUsers(users.filter(u => u.id !== id));
      } else {
        alert('Erro ao excluir usuário.');
      }
    } catch (err) {
      alert('Erro de conexão.');
    }
    setActiveMenu(null);
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
        {/* Header */}

        <div className="w-full flex-1 min-h-0 overflow-y-auto flex flex-col">
          <ListaCrm
            className="flex-1"
            onNovo={() => openModal()}
            id="usuarios"
            chave={(u: any) => u.id}
            linhas={users}
            onEditar={openModal}
            vazio="Nenhum usuário cadastrado no sistema."
            colunas={[
              { key: 'id', label: 'ID', alinhar: 'numero', largura: 80 },
              { key: 'nome', label: 'Nome', largura: 260 },
              { key: 'email', label: 'Email', largura: 280 },
              { key: 'role', label: 'Tipo', alinhar: 'centro', largura: 140, render: (u: any) => (u.role === 'super' ? 'Super Admin' : u.role === 'admin' ? 'Administrador' : 'Operador') },
            ]}
            acoes={(u: any) => (
              <>
                <BotaoAcao icone={Pencil} titulo="Editar" descricao="Abre o registro para edição" onClick={() => openModal(u)} />
                <BotaoAcao icone={Trash2} titulo="Excluir" descricao="Apaga o registro (pede confirmação)" tom="perigo" onClick={() => handleDeleteUser(u.id)} />
              </>
            )}
          />
        </div>

        {/* Modal Overlay */}
        <AnimatePresence>
          {showModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setShowModal(false)}
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative bg-elegant-card border border-elegant-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
              >
                <div className="p-6 border-b border-elegant-border flex items-center justify-between bg-elegant-sidebar/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-elegant-accent/10 text-elegant-accent">
                      <UserPlus size={20} />
                    </div>
                    <h2 className="text-lg font-bold text-elegant-text-bright">
                      {editingUser ? 'Editar Usuário' : 'Novo Cadastro'}
                    </h2>
                  </div>
                  <button onClick={() => setShowModal(false)} className="text-elegant-text-label hover:text-elegant-text-bright transition-colors">
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleSaveUser} className="p-6 space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-elegant-text-label ml-1">Nome Completo</label>
                    <input
                      type="text"
                      required
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      className="w-full bg-elegant-bg border border-elegant-border focus:border-elegant-accent outline-none rounded-xl py-3 px-4 transition-all text-elegant-text-bright text-sm"
                      placeholder="Ex: João da Silva"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-elegant-text-label ml-1">Email de Acesso</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-elegant-bg border border-elegant-border focus:border-elegant-accent outline-none rounded-xl py-3 px-4 transition-all text-elegant-text-bright text-sm"
                      placeholder="usuario@login.com.br"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-elegant-text-label ml-1">Tipo de Usuário</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full bg-elegant-bg border border-elegant-border focus:border-elegant-accent outline-none rounded-xl py-3 px-4 transition-all text-elegant-text-bright text-sm appearance-none cursor-pointer"
                    >
                      <option value="user">Operador (user)</option>
                      <option value="admin">Administrador (admin)</option>
                      <option value="super">Super Admin (super)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-elegant-text-label ml-1">Senha (Texto Puro)</label>
                    <input
                      type="text"
                      required
                      value={formData.senha}
                      onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                      className="w-full bg-elegant-bg border border-elegant-border focus:border-elegant-accent outline-none rounded-xl py-3 px-4 transition-all text-elegant-text-bright text-sm"
                      placeholder="Defina a senha"
                    />
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-red-500 text-xs bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                      <AlertCircle size={14} />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="pt-4 flex gap-3">
                    <button 
                      type="button" 
                      onClick={() => setShowModal(false)}
                      className="flex-1 px-4 py-3 border border-elegant-border text-elegant-text-muted hover:text-elegant-text-bright hover:bg-white/5 rounded-xl transition-all text-sm font-semibold"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      disabled={isSubmitLoading}
                      className="flex-1 bg-elegant-accent hover:bg-elegant-accent/90 text-white py-3 rounded-xl transition-all shadow-lg shadow-elegant-accent/20 flex items-center justify-center font-semibold text-sm disabled:opacity-50"
                    >
                      {isSubmitLoading ? <Loader2 className="animate-spin" size={20} /> : (editingUser ? 'Atualizar Dados' : 'Criar Conta')}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
