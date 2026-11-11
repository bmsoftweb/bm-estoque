import { NextRequest, NextResponse } from '@/server/next-server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from '@/server/next-headers';
import { masterPool, getDb } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function GET(req: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Fetch all users from the 'usuarios' table in MANAGEMENT base
    const [users]: any = await masterPool.execute(
      'SELECT id, nome, email, senha, role, perfil_id FROM usuarios ORDER BY id DESC'
    );

    return NextResponse.json(users);
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Erro ao buscar usuários: ' + error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { nome, email, senha, role } = await req.json();

    if (!nome || !email || !senha) {
      return NextResponse.json({ error: 'Nome, email e senha são obrigatórios' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(senha, 10);

    const [result]: any = await masterPool.execute(
      'INSERT INTO usuarios (nome, email, senha, role) VALUES (?, ?, ?, ?)',
      [nome, email, hashedPassword, role || 'user']
    );

    return NextResponse.json({ id: result.insertId, nome, email, role: role || 'user' });
  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Erro ao criar usuário: ' + error.message }, { status: 500 });
  }
}
