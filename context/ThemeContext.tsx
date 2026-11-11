
import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Tema vindo do Master (?tema=light|dark na entrada automática, /api/entrar): o Estoque abre no mesmo modo do Master
// e guarda a escolha. Lido antes de qualquer tela, para o redirecionamento da rota não perder o parâmetro.
try {
  const url = new URL(window.location.href);
  const tema = url.searchParams.get('tema');
  if (tema === 'light' || tema === 'dark') {
    localStorage.setItem('theme', tema);
    url.searchParams.delete('tema');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }
} catch {
  // sem storage: segue o tema salvo
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Read from localStorage inside useEffect but set the mounted trigger to handle the state
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
      if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
    }
    
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Skip rendering children until mounted to avoid hydration mismatch and flickering
  if (!mounted) {
    return <div className="min-h-screen bg-[#0A0A0B]" aria-hidden="true" />;
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
