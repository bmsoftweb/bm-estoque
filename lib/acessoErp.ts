import { getIronSession } from 'iron-session';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sessionOptions, SessionData } from '@/lib/session';
import { masterPool, dbConfig } from '@/lib/db';
import { cookies } from '@/server/next-headers';

// Login do ERP, usado pela tela de login (/api/login) e pela entrada vinda do Master (/api/entrar):
// sys_usuarios.login + senha_hash (bcrypt; aceita legado texto/md5/sha e converte; senha vazia = primeiro acesso)
const EMPRESA_PADRAO = Number(process.env.ID_EMPRESA) || 1;

const ehBcrypt = (hash: string) => /^\$2[aby]\$/.test(hash);

function senhaConfere(digitada: string, gravada: string): boolean {
  if (!gravada.trim()) return false;
  if (ehBcrypt(gravada)) {
    try {
      if (bcrypt.compareSync(digitada, gravada)) return true;
    } catch {
      // segue para os demais formatos
    }
  }
  if (digitada === gravada) return true;
  return ['md5', 'sha256', 'sha1'].some((alg) => crypto.createHash(alg).update(digitada).digest('hex') === gravada.toLowerCase());
}

const SQL_USUARIO = `
  SELECT u.id, u.login, u.senha_hash, u.empresa_id,
         (SELECT p.nome FROM sys_perfis p WHERE p.id = u.perfil_id) AS perfil
    FROM sys_usuarios u
   WHERE u.ativo = 1 AND LOWER(TRIM(u.login)) = ? LIMIT 1`;

const SQL_FILIAL = `
  SELECT e.id, COALESCE(NULLIF(e.nome_fantasia, ''), e.razao_social) AS nome, e.grupo_id, g.nome AS grupo_nome
    FROM sys_empresas e LEFT JOIN sys_grupos g ON g.id = e.grupo_id`;

export type Filial = { id: number; nome: string; grupo_id: number; grupo_nome: string | null };

/** Erro de acesso: a mensagem vai para o usuário */
export class ErroAcesso extends Error {
  constructor(public status: number, mensagem: string) {
    super(mensagem);
  }
}

/**
 * Filiais em que o usuário pode entrar (sys_usuarios_empresas). Sem nenhuma: a empresa do próprio usuário
 * quando ela existe em sys_empresas (a 0 é a de demonstração); senão, a padrão do .env.
 */
async function filiaisDo(u: any): Promise<Filial[]> {
  const [lista]: any = await masterPool.query(
    `${SQL_FILIAL} JOIN sys_usuarios_empresas ue ON ue.empresa_id = e.id WHERE ue.usuario_id = ? AND COALESCE(e.ativo, 1) = 1 ORDER BY e.id`,
    [u.id],
  );
  if (lista.length) return lista;
  const [propria]: any = await masterPool.query(`${SQL_FILIAL} WHERE e.id = ?`, [u.empresa_id]);
  if (propria.length) return propria;
  const [padrao]: any = await masterPool.query(`${SQL_FILIAL} WHERE e.id = ?`, [EMPRESA_PADRAO]);
  return padrao;
}

/** Confere usuário e senha (grava a senha no primeiro acesso) e devolve o usuário e as filiais liberadas */
export async function autenticar(login: string, senha: string): Promise<{ u: any; filiais: Filial[] }> {
  if (!login) throw new ErroAcesso(400, 'Informe o seu usuário.');
  const [rows]: any = await masterPool.query(SQL_USUARIO, [login.toLowerCase()]);
  if (!rows.length) throw new ErroAcesso(401, `O usuário "${login}" não foi localizado ou está inativo.`);

  const u = rows[0];
  const gravada = String(u.senha_hash ?? '');
  if (!gravada.trim() || gravada.toUpperCase() === 'NULL') {
    // Senha em branco no banco = primeiro acesso: grava o que foi digitado em bcrypt
    if (senha.trim().length < 4) throw new ErroAcesso(401, 'Primeiro acesso: defina uma senha com pelo menos 4 caracteres.');
    await masterPool.query('UPDATE sys_usuarios SET senha_hash = ? WHERE id = ?', [bcrypt.hashSync(senha, 10), u.id]);
  } else {
    if (!senhaConfere(senha, gravada)) throw new ErroAcesso(401, 'Usuário/senha inválido(s).');
    // Senha em formato legado passa para bcrypt
    if (!ehBcrypt(gravada)) await masterPool.query('UPDATE sys_usuarios SET senha_hash = ? WHERE id = ?', [bcrypt.hashSync(senha, 10), u.id]).catch(() => {});
  }
  const filiais = await filiaisDo(u);
  if (!filiais.length) throw new ErroAcesso(403, 'Nenhuma empresa liberada para este usuário.');
  return { u, filiais };
}

/** Abre a sessão do estoque na filial escolhida */
export async function abrirSessao(u: any, f: Filial) {
  await masterPool.query('UPDATE sys_usuarios SET ultimo_acesso = NOW() WHERE id = ?', [u.id]).catch(() => {});
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  session.userId = Number(u.id);
  session.userName = String(u.login);
  session.empresaId = Number(f.id);
  session.empresaNome = f.nome || `Empresa ${f.id}`;
  session.grupoId = Number(f.grupo_id);
  session.grupoNome = f.grupo_nome || `Grupo ${f.grupo_id}`;
  session.perfil = u.perfil || '';
  // ponytail: o ERP não tem o papel super/admin/operador do estoque antigo; todo usuário ativo entra como admin
  session.role = 'admin';
  session.isLoggedIn = true;
  session.dbConfig = dbConfig;
  await session.save();
  return session;
}
