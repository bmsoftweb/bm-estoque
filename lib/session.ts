import { SessionOptions } from 'iron-session';

export interface SessionData {
  userId?: number;
  userName?: string;
  userEmail?: string;
  /** Filial escolhida no login (sys_empresas.id) */
  empresaId?: number;
  empresaNome?: string;
  /** Grupo da filial (sys_grupos.id): os cadastros do estoque são do grupo */
  grupoId?: number;
  grupoNome?: string;
  perfil?: string;
  role?: string;
  isLoggedIn: boolean;
  /** Só o que as telas precisam saber do banco; a senha nunca vai para a sessão */
  dbConfig?: {
    host: string;
    port: number;
    user: string;
    database: string;
  };
}

// Sem segredo no .env o app não sobe: um valor padrão no código permitiria forjar o cookie de sessão
const secret = process.env.SESSION_SECRET;
if (!secret || secret.length < 32) {
  throw new Error('SESSION_SECRET não definido (ou com menos de 32 caracteres) no .env.');
}

export const sessionOptions: SessionOptions = {
  password: secret,
  // Nome trocado quando a sessão ganhou o grupo: as sessões antigas (sem grupoId) pedem login de novo
  cookieName: 'bm_estoque_sessao',
  cookieOptions: {
    secure: true, // MUST be true for SameSite=None
    sameSite: 'none', // Required for cross-origin iframe in AI Studio
    httpOnly: true,
    path: '/',
  },
};
