import { rotasRelacionados } from '@/lib/produtos-relacionados';

/** Similares: oferecidos no lugar do produto quando ele faltar (regras em lib/produtos-relacionados.ts) */
export const { GET, PUT } = rotasRelacionados('similares');
