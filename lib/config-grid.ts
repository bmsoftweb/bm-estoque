import { masterPool } from './db';

// Preferências de grade do usuário: sys_usuarios.config_listas (JSON compartilhado com o Romaneio,
// que guarda as listas dele nas outras chaves). O estoque usa só a chave "estoque_grid".
const CHAVE = 'estoque_grid';

async function lerObjeto(userId: number): Promise<Record<string, unknown>> {
  const [rows]: any = await masterPool.execute('SELECT config_listas FROM sys_usuarios WHERE id = ? LIMIT 1', [userId]);
  try {
    const obj = JSON.parse(rows[0]?.config_listas || '{}');
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  } catch {
    return {};
  }
}

export async function lerConfigGrid(userId: number): Promise<any[]> {
  const v = (await lerObjeto(userId))[CHAVE];
  return Array.isArray(v) ? v : [];
}

export async function salvarConfigGrid(userId: number, config: unknown) {
  const obj = await lerObjeto(userId);
  obj[CHAVE] = config;
  await masterPool.execute('UPDATE sys_usuarios SET config_listas = ? WHERE id = ?', [JSON.stringify(obj), userId]);
}

// Preferências das listas no modelo do crmWeb (modo, larguras, ordem, grade, visíveis), por lista.
// Chave própria dentro de config_listas, para não colidir com as listas do Romaneio.
const CHAVE_LISTAS = 'estoque_listas';

export async function lerConfigListas(userId: number): Promise<Record<string, unknown>> {
  const v = (await lerObjeto(userId))[CHAVE_LISTAS];
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export async function salvarConfigListas(userId: number, config: Record<string, unknown>) {
  const obj = await lerObjeto(userId);
  obj[CHAVE_LISTAS] = config;
  const texto = JSON.stringify(obj);
  if (texto.length > 60000) throw new Error('Configuração muito grande.');
  const [r]: any = await masterPool.execute('UPDATE sys_usuarios SET config_listas = ? WHERE id = ?', [texto, userId]);
  if (!r.affectedRows) throw new Error('Usuário não encontrado.');
}
