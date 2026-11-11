// "Lembrar neste dispositivo": usuário e senha do último acesso, guardados neste navegador (localStorage).
// ATENÇÃO: o base64 só evita que a senha apareça legível de relance; NÃO é criptografia.
const LEMBRETE = 'estoque_lembrar_login';

export interface Lembrete {
  login: string;
  senha: string;
}

/** O acesso ao storage pode lançar exceção (modo privado, bloqueio de cookies) */
function seguro<T>(fn: () => T, padrao: T): T {
  try {
    return fn();
  } catch {
    return padrao;
  }
}

export function lerLembrete(): Lembrete | null {
  return seguro(() => {
    const bruto = localStorage.getItem(LEMBRETE);
    if (!bruto) return null;
    const l = JSON.parse(bruto) as { login?: string; senha?: string };
    return { login: String(l.login || ''), senha: l.senha ? decodeURIComponent(escape(atob(l.senha))) : '' };
  }, null);
}

export function salvarLembrete(login: string, senha: string) {
  seguro(() => localStorage.setItem(LEMBRETE, JSON.stringify({ login, senha: senha ? btoa(unescape(encodeURIComponent(senha))) : '' })), undefined);
}

export function limparLembrete() {
  seguro(() => localStorage.removeItem(LEMBRETE), undefined);
}
