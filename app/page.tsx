
import React, { useState, useEffect } from 'react';
import { useRouter } from '@/lib/nav';
import { User, Lock, ArrowRight, Loader2, Eye, EyeOff, Package, Sun, Moon, Building2 } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { AvisoErro } from '@/components/AvisoErro';
import { Toggle } from '@/components/Toggle';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { lerLembrete, salvarLembrete, limparLembrete } from '@/lib/lembrete';
import { esquecerRodape } from '@/components/RodapeSistema';

const LABEL = 'block text-[10px] font-bold uppercase tracking-widest ml-1 mb-1.5 text-stone-400 dark:text-stone-500';
const INPUT = 'w-full bg-stone-50 dark:bg-stone-800/80 p-3 text-sm font-medium text-stone-800 dark:text-stone-100 placeholder:text-stone-400 placeholder:font-normal transition-all';
const ICONE = 'absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 dark:text-stone-500 pointer-events-none';

export default function LoginPage() {
  // Um lembrete salvo pré-preenche usuário e senha e já deixa a opção marcada
  const [lembrete] = useState(() => lerLembrete());
  const [login, setLogin] = useState(() => lembrete?.login ?? '');
  const [password, setPassword] = useState(() => lembrete?.senha ?? '');
  const [lembrar, setLembrar] = useState(() => Boolean(lembrete));
  const [temDados, setTemDados] = useState(() => Boolean(lembrete));
  const [limpando, setLimpando] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/user');
        if (res.ok) router.push('/dashboard');
      } catch {
        // Sem sessão ou erro: fica no login
      } finally {
        setIsCheckingSession(false);
      }
    };
    checkSession();
  }, [router]);

  // Usuário com mais de uma filial: a API devolve a lista e a tela pergunta em qual entrar
  const [filiais, setFiliais] = useState<{ id: number; nome: string; grupo: string }[] | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    entrar();
  };

  const entrar = async (empresaId?: number) => {
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: login.trim(), senha: password, empresaId }),
      });

      const data = await res.json();

      if (res.ok && data.escolherFilial) {
        setFiliais(data.filiais);
      } else if (res.ok) {
        esquecerRodape();
        // Só guarda usuário e senha depois de um login válido
        if (lembrar) salvarLembrete(login.trim(), password);
        else limparLembrete();
        router.push('/dashboard');
      } else {
        setError(data.error || 'Falha ao autenticar. Verifique suas credenciais.');
      }
    } catch {
      setError('Ocorreu um erro ao conectar ao servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-white dark:bg-stone-900 flex items-center justify-center font-sans">
        <Loader2 className="animate-spin text-stone-400" size={32} />
      </div>
    );
  }

  /** Marca: ícone + nome, no painel esquerdo e, no celular, acima do formulário */
  const marca = (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200/50 dark:shadow-none shrink-0">
        <Package className="w-5 h-5 text-white" />
      </div>
      <span className="text-sm font-black tracking-wider uppercase text-stone-800 dark:text-stone-100">BM-Estoque</span>
    </div>
  );

  return (
    <main className="min-h-screen flex relative bg-white dark:bg-stone-900 text-stone-900 dark:text-white font-sans">
      {/* Painel esquerdo: identidade visual (oculto em telas pequenas) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col p-12 bg-white dark:bg-stone-950 isolate">
        <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden">
          <svg
            viewBox="0 0 380 470"
            aria-hidden="true"
            className="absolute top-1/2 right-[6%] -translate-y-1/2 w-[min(440px,70%)] text-indigo-200 dark:text-indigo-400/25"
          >
            <g fill="currentColor">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <rect key={i} x={30 + (i % 2) * 16} y={60 + i * 40} width={304} height={26} rx={4} opacity={0.35 + i * 0.07} />
              ))}
            </g>
          </svg>
          <div className="absolute top-[15%] left-[10%] w-[280px] h-[280px] rounded-[40%] rotate-12 blur-3xl bg-indigo-100/70 dark:bg-indigo-500/10" />
          <div className="absolute bottom-[10%] right-[5%] w-[220px] h-[220px] rounded-[45%] -rotate-12 blur-2xl bg-blue-100/60 dark:bg-blue-500/10" />
        </div>

        {marca}

        <div className="flex-1 flex flex-col justify-center">
          <h1 className="text-6xl font-black leading-[0.95] tracking-tight text-stone-900 dark:text-white">
            Gestão de<br />
            <span className="text-blue-600 dark:text-blue-400">Produtos</span>
          </h1>
          <p className="mt-4 text-sm font-medium max-w-xs text-stone-500 dark:text-stone-400">
            Produtos, movimentação de estoque, lotes e localizações.
          </p>
        </div>
      </div>

      {/* Painel direito: formulário de login */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 relative bg-stone-50 dark:bg-stone-900">
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
          className="absolute top-6 right-6 z-20 p-2 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
        >
          {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>

        <div className="w-full max-w-md">
          <div className="flex lg:hidden mb-8">{marca}</div>

          <h2 className="text-3xl font-black tracking-tight text-stone-900 dark:text-white">Login</h2>
          <p className="text-sm font-medium mt-1.5 text-stone-500 dark:text-stone-400">
            Entre com o usuário e a senha do sistema BMsoft. No primeiro acesso, a senha digitada passa a ser a sua.
          </p>

          {error && <AvisoErro mensagem={error} onFechar={() => setError('')} />}

          {filiais ? (
            <div className="flex flex-col gap-2 mt-8">
              <span className={LABEL}>Em qual filial você vai trabalhar?</span>
              {filiais.map((f, i) => (
                <button
                  key={f.id}
                  type="button"
                  autoFocus={i === 0}
                  disabled={isLoading}
                  onClick={() => entrar(f.id)}
                  className="w-full flex items-center gap-3 text-left bg-white dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 hover:border-indigo-400 dark:hover:border-indigo-500 focus:border-indigo-500 px-4 py-3 rounded-xl transition-colors cursor-pointer disabled:opacity-60"
                >
                  <Building2 className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-stone-800 dark:text-stone-100 truncate">{f.nome}</span>
                    {f.grupo && <span className="block text-[11px] text-stone-500 dark:text-stone-400 truncate">{f.grupo}</span>}
                  </span>
                  <ArrowRight className="w-4 h-4 text-stone-400 shrink-0" />
                </button>
              ))}
              <button
                type="button"
                onClick={() => setFiliais(null)}
                className="self-start mt-2 text-xs font-bold text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 cursor-pointer"
              >
                ← Voltar
              </button>
            </div>
          ) : (
          <form onSubmit={handleLogin} className="flex flex-col gap-5 mt-8">

            <div>
              <label htmlFor="input-login-usuario" className={LABEL}>Usuário</label>
              <div className="relative">
                <User className={ICONE} />
                <input
                  id="input-login-usuario"
                  type="text"
                  required
                  autoFocus
                  autoComplete="username"
                  value={login}
                  onChange={(e) => { setLogin(e.target.value); setError(''); }}
                  onFocus={(e) => e.target.select()}
                  className={`${INPUT} pl-11`}
                  placeholder="seu usuário"
                />
              </div>
            </div>

            <div>
              <label htmlFor="input-login-senha" className={LABEL}>Senha</label>
              <div className="relative">
                <Lock className={ICONE} />
                <input
                  id="input-login-senha"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  onFocus={(e) => e.target.select()}
                  className={`${INPUT} pl-11 pr-10`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer"
                  tabIndex={-1}
                  title={showPassword ? 'Esconder a senha' : 'Mostrar a senha'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 py-1">
              <Toggle
                id="input-login-lembrar"
                checked={lembrar}
                onChange={setLembrar}
                size="sm"
                label={<span className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Lembrar neste dispositivo</span>}
                title="Já traz usuário e senha preenchidos no próximo acesso. A senha fica guardada neste navegador."
              />
              {temDados && (
                <button
                  type="button"
                  onClick={() => setLimpando(true)}
                  title="Apaga o usuário e a senha guardados neste navegador"
                  className="text-xs font-bold text-stone-500 hover:text-rose-600 dark:text-stone-400 dark:hover:text-rose-400 cursor-pointer shrink-0"
                >
                  Limpar
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex items-center justify-center gap-2 mt-2 group disabled:opacity-70 cursor-pointer"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span className="uppercase tracking-wide">Entrar</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
          )}

          <div className="flex items-center justify-between mt-8 pt-4 border-t border-stone-200 dark:border-stone-800 text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
            <span>BM-Estoque by BMsoft Sistemas</span>
            <span className="normal-case">© {new Date().getFullYear()}</span>
          </div>
        </div>
      </div>

      {limpando && (
        <ConfirmDialog
          titulo="Limpar os dados deste dispositivo?"
          mensagem="Apaga o usuário e a senha guardados neste navegador. Você precisará digitar tudo de novo no próximo acesso."
          confirmar="Limpar"
          onConfirmar={() => {
            limparLembrete();
            setLogin('');
            setPassword('');
            setLembrar(false);
            setTemDados(false);
            setLimpando(false);
          }}
          onCancelar={() => setLimpando(false)}
        />
      )}
    </main>
  );
}
