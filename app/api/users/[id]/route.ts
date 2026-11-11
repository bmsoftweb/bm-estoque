import { NextRequest, NextResponse } from '@/server/next-server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from '@/server/next-headers';
import { masterPool } from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { nome, email, senha, role } = await req.json();

    if (!nome || !email || !senha) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 });
    }

    await masterPool.execute(
      'UPDATE usuarios SET nome = ?, email = ?, senha = ?, role = ? WHERE id = ?',
      [nome, email, senha, role || 'user', id]
    );

    return NextResponse.json({ id, nome, email, senha, role: role || 'user' });
  } catch (error: any) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Erro ao atualizar usuário: ' + error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    await masterPool.execute('DELETE FROM usuarios WHERE id = ?', [id]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Erro ao excluir usuário: ' + error.message }, { status: 500 });
  }
}
