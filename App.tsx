import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Login from './app/page';
import { LayoutApp } from '@/components/LayoutApp';
import Dashboard from './app/dashboard/page';
import Produtos from './app/produtos/page';
import Movimento from './app/movimento/page';
import Categorias from './app/categorias/page';
import Atributos from './app/atributos/page';
import Localizacoes from './app/localizacoes/page';
import Unidades from './app/unidades/page';
import Marcas from './app/marcas/page';
import Usuarios from './app/users/page';
import CadSample from './app/cad_sample/page';
import Precos from './app/precos/page';

/** Uma rota por tela (antes, uma pasta por tela no app/ do Next) */
export const App: React.FC = () => (
  <Routes>
    <Route path="/" element={<Login />} />
    <Route element={<LayoutApp />}>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/produtos" element={<Produtos />} />
      <Route path="/movimento" element={<Movimento />} />
      <Route path="/categorias" element={<Categorias />} />
      <Route path="/atributos" element={<Atributos />} />
      <Route path="/localizacoes" element={<Localizacoes />} />
      <Route path="/unidades" element={<Unidades />} />
      <Route path="/marcas" element={<Marcas />} />
      <Route path="/users" element={<Usuarios />} />
      <Route path="/precos" element={<Precos />} />
      <Route path="/cad_sample" element={<CadSample />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);
