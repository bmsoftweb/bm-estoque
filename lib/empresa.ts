import type { SessionData } from '@/lib/session';

/**
 * Empresa/filial da sessão (sys_empresas.id): localizações e movimentações (o saldo é de cada filial).
 * A 0 é a de demonstração: por isso ?? e não ||
 */
export const empresaDa = (s: SessionData): number => Number(s.empresaId ?? 1);

/** Grupo da sessão (sys_grupos.id): produtos, categorias, marcas, unidades, atributos, lotes e listas de preço */
export const grupoDa = (s: SessionData): number => Number(s.grupoId ?? 1);

const pertence = (coluna: string) => async (db: any, bd: string | undefined, tabela: string, id: unknown, dono: number): Promise<boolean> => {
  const [r]: any = await db.execute(`SELECT 1 FROM ${bd}.${tabela} WHERE id = ? AND ${coluna} = ? LIMIT 1`, [id, dono]);
  return r.length > 0;
};

/** O registro (de uma tabela com empresa_id) é desta filial? */
export const ehDaEmpresa = pertence('empresa_id');

/** O registro (de uma tabela com grupo_id) é deste grupo? */
export const ehDoGrupo = pertence('grupo_id');
