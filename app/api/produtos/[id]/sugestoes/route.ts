import { rotasRelacionados } from '@/lib/produtos-relacionados';

/** Sugestões: oferecidas junto com o produto na venda (regras em lib/produtos-relacionados.ts) */
export const { GET, PUT } = rotasRelacionados('sugestoes');
