// Preferências de listas e formulários (sys_usuarios.config_listas, chave estoque_listas), lidas uma vez
// e gravadas por chave. Se a leitura falhar, nada é gravado: um PUT só com uma chave apagaria as demais.
let cache: Promise<Record<string, any>> | null = null;

export function lerConfigListas(): Promise<Record<string, any>> {
  if (!cache) {
    cache = fetch('/api/user/config-listas')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Não foi possível ler a configuração.'))))
      .catch((e) => {
        cache = null;
        throw e;
      });
  }
  return cache;
}

export async function gravarConfigLista(chave: string, valor: unknown) {
  const tudo = await lerConfigListas();
  const novo = { ...tudo, [chave]: valor };
  const r = await fetch('/api/user/config-listas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(novo) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Não foi possível salvar a configuração.');
  cache = Promise.resolve(novo);
}
