// Substitui next/headers: cookies() da requisição em andamento (guardada por requisição em AsyncLocalStorage).
// Devolve o mesmo formato que o iron-session espera (get e set).
import { AsyncLocalStorage } from 'node:async_hooks';
import { parse, serialize } from 'cookie';
import type { Request, Response } from 'express';

export const contextoRequisicao = new AsyncLocalStorage<{ req: Request; res: Response }>();

export async function cookies() {
  const ctx = contextoRequisicao.getStore();
  if (!ctx) throw new Error('cookies() chamado fora de uma requisição.');
  const lidos = parse(ctx.req.headers.cookie || '');
  return {
    get: (nome: string) => (nome in lidos ? { name: nome, value: lidos[nome] } : undefined),
    set: (a: any, valor?: string, opcoes?: any) => {
      const o = typeof a === 'string' ? { name: a, value: valor, ...opcoes } : a;
      ctx.res.append('Set-Cookie', serialize(o.name, o.value ?? '', o));
    },
  };
}
