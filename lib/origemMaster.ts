// Estoque aberto pelo BM-Master (entrada automática, /api/entrar → /?master=1): ao Sair, fecha a aba do Master em
// vez de ir para o login. Marca guardada no sessionStorage desta aba; aberto direto, o Sair segue normal.
const CHAVE = 'bm_origem_master';

try {
  const url = new URL(window.location.href);
  if (url.searchParams.get('master') === '1') {
    sessionStorage.setItem(CHAVE, '1');
    url.searchParams.delete('master');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }
} catch {
  // sem storage: o Sair vai para o login
}

/**
 * Depois do logout: dentro do Master (iframe) pede para ele fechar a aba; numa aba do navegador aberta pelo Master,
 * fecha a aba. Devolve false quando o Estoque não veio do Master (segue para o login).
 */
export function fecharNoMaster(): boolean {
  try {
    if (sessionStorage.getItem(CHAVE) !== '1') return false;
  } catch {
    return false;
  }
  if (window.parent !== window) {
    window.parent.postMessage({ tipo: 'bm:fechar-modulo' }, '*'); // sem dado sigiloso: só o pedido de fechar
    return true;
  }
  // Aba do navegador aberta pelo Master: fecha; se o navegador não deixar, o chamador segue para o login
  if (window.opener) window.close();
  return false;
}
