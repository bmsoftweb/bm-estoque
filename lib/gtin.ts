/** GTIN-8/12/13/14 (EAN, UPC e DUN-14): só dígitos e dígito verificador módulo 10 */
export function gtinValido(g: string): boolean {
  if (![8, 12, 13, 14].includes(g.length) || !/^\d+$/.test(g)) return false;
  const d = g.split('').map(Number);
  const dv = d.pop()!;
  const soma = d.reverse().reduce((s, n, i) => s + n * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (soma % 10)) % 10 === dv;
}
