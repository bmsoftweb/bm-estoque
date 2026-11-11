
import React, { useEffect, useState } from 'react';

interface Info {
  base?: string;
  grupo?: string;
  empresa?: string;
  usuario?: string;
}

// Uma leitura por login: o rodapé aparece em todas as telas
let cache: Promise<Info> | null = null;
/** Chamado no login: outra filial (ou outro usuário) sem recarregar a página */
export const esquecerRodape = () => {
  cache = null;
};
const ler = () =>
  (cache ??= fetch('/api/user')
    .then((r) => (r.ok ? r.json() : {}))
    .then((u: any): Info => ({ base: u.dbConfig?.database, grupo: u.grupoNome, empresa: u.empresaNome, usuario: u.userName }))
    .catch(() => ({})));

/** Barra de status do pé da tela, igual à do Romaneio: versão, base, grupo, filial e usuário */
export const RodapeSistema: React.FC = () => {
  const [info, setInfo] = useState<Info>({});
  useEffect(() => {
    let vivo = true;
    ler().then((i) => vivo && setInfo(i));
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <footer className="h-6 shrink-0 px-4 flex items-center gap-4 overflow-hidden whitespace-nowrap border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-[10px] text-stone-500 dark:text-stone-400">
      <span>Versão {__APP_VERSION__}</span>
      {info.base && <span>Base: {info.base}</span>}
      {info.grupo && <span className="truncate">Grupo: {info.grupo}</span>}
      {info.empresa && <span className="truncate">Filial: {info.empresa}</span>}
      {info.usuario && <span className="truncate">Usuário: {info.usuario}</span>}
    </footer>
  );
};
