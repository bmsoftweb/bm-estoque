import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './app/globals.css';
import '@/lib/origemMaster'; // antes das telas: guarda a marca ?master=1 antes que o roteamento troque o endereço
import { ThemeProvider } from '@/context/ThemeContext';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
