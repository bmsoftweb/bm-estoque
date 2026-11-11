import { NextRequest } from '@/server/next-server';
import { abrirSessao, autenticar, ErroAcesso } from '@/lib/acessoErp';

/**
 * Entrada vinda do Master (lançador de módulos), sem a tela de login:
 *   GET /api/entrar?user=base64(login:senha)&e=<empresa>&g=<grupo>&tema=<light|dark>&volta=<endereço do Master>
 * Confere o usuário e a filial como o login e abre a sessão. Deu certo: vai para a tela inicial. Deu erro (usuário
 * inativo, senha trocada, filial não liberada…): volta para o Master com ?erro=<mensagem>.
 * O endereço de volta só é aceito se for o do Master (MASTER_URL no .env, separado por vírgula; sem ele, localhost),
 * para o link não servir de redirecionamento para outro site.
 */
function voltaPermitida(v: string | null): URL | null {
  if (!v) return null;
  try {
    const url = new URL(v);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const permitidas = (process.env.MASTER_URL || '').split(',').map((s) => s.trim()).filter(Boolean);
    const ok = permitidas.length ? permitidas.some((p) => new URL(p).origin === url.origin) : ['localhost', '127.0.0.1'].includes(url.hostname);
    return ok ? url : null;
  } catch {
    return null;
  }
}

const redirecionar = (para: string) => new Response(null, { status: 302, headers: { Location: para } });

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const volta = voltaPermitida(q.get('volta'));
  try {
    const credencial = Buffer.from(q.get('user') || '', 'base64').toString('utf8');
    const i = credencial.indexOf(':');
    if (i < 1) throw new ErroAcesso(400, 'Acesso inválido: abra o módulo pelo Master.');
    const { u, filiais } = await autenticar(credencial.slice(0, i).trim(), credencial.slice(i + 1));
    // A empresa pedida pelo Master (a principal do usuário) quando liberada; senão, a primeira liberada
    const pedida = Number(q.get('e'));
    const f = filiais.find((x) => q.get('e') !== null && Number(x.id) === pedida) ?? filiais[0];
    await abrirSessao(u, f);
    // master=1: ao Sair, fecha a aba do Master (lib/origemMaster.ts); tema do Master (light/dark): a tela inicial
    // aplica e guarda (context/ThemeContext.tsx)
    const tema = q.get('tema');
    return redirecionar(tema === 'light' || tema === 'dark' ? `/?master=1&tema=${tema}` : '/?master=1');
  } catch (err: any) {
    const mensagem = err instanceof ErroAcesso ? err.message : 'Erro ao entrar no Estoque. Tente novamente.';
    if (!(err instanceof ErroAcesso)) console.error('Entrada pelo Master:', err);
    if (volta) {
      volta.searchParams.set('erro', `Estoque: ${mensagem}`);
      return redirecionar(volta.toString());
    }
    return new Response(mensagem, { status: err instanceof ErroAcesso ? err.status : 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}
