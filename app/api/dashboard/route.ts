import { NextRequest, NextResponse } from '@/server/next-server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from '@/server/next-headers';
import { getDb } from '@/lib/db';
import { grupoDa } from '@/lib/empresa';

/**
 * Números do dashboard (horário de Brasília: a conexão usa -03:00, então CURDATE()/NOW() já são locais).
 * - novosSemana: cadastrados desde a segunda-feira da semana atual
 * - precosDesatualizados: sem alteração há mais de 30 dias. Não existe data própria do preço em cad_produtos,
 *   então vale a última alteração do produto (date_update; se nula, date_insert).
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const db = await getDb();
    const bd = session.dbConfig?.database;
    const emp = [grupoDa(session)];

    const [[cards]]: any = await db.execute(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(date_insert >= CURDATE() - INTERVAL WEEKDAY(CURDATE()) DAY), 0) AS novosSemana,
              COALESCE(SUM(date_insert >= CURDATE()), 0) AS novosHoje,
              COALESCE(SUM(COALESCE(date_update, date_insert) < NOW() - INTERVAL 30 DAY), 0) AS precosDesatualizados
       FROM ${bd}.cad_produtos WHERE grupo_id = ?`,
      emp,
    );
    const [porCategoria]: any = await db.execute(
      `SELECT COALESCE(c.nome, 'Sem categoria') AS nome, COUNT(*) AS total
       FROM ${bd}.cad_produtos p LEFT JOIN ${bd}.cad_produtos_categorias c ON c.id = p.categoria_id
       WHERE p.grupo_id = ? GROUP BY c.id, c.nome ORDER BY total DESC, nome`,
      emp,
    );
    const [porMarca]: any = await db.execute(
      `SELECT COALESCE(m.descricao, 'Sem marca') AS nome, COUNT(*) AS total
       FROM ${bd}.cad_produtos p LEFT JOIN ${bd}.cad_produtos_marcas m ON m.id = p.marca_id
       WHERE p.grupo_id = ? GROUP BY m.id, m.descricao ORDER BY total DESC, nome`,
      emp,
    );

    const n = (v: any) => Number(v) || 0;
    return NextResponse.json({
      total: n(cards.total),
      novosSemana: n(cards.novosSemana),
      novosHoje: n(cards.novosHoje),
      precosDesatualizados: n(cards.precosDesatualizados),
      porCategoria: porCategoria.map((r: any) => ({ nome: r.nome, total: n(r.total) })),
      porMarca: porMarca.map((r: any) => ({ nome: r.nome, total: n(r.total) })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
