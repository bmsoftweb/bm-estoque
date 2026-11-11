import { NextRequest, NextResponse } from '@/server/next-server';
import { abrirSessao, autenticar, ErroAcesso } from '@/lib/acessoErp';

// Mesmo login do Romaneio e do Master (conferência em lib/acessoErp.ts)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const login = String(body?.login || '').trim();
    const senha = typeof body?.senha === 'string' ? body.senha : '';
    const { u, filiais } = await autenticar(login, senha);

    // Mais de uma filial: a tela pergunta em qual entrar e reenvia login + senha + empresaId
    const pedida = body?.empresaId;
    const f = filiais.length === 1 ? filiais[0] : filiais.find((x) => pedida != null && pedida !== '' && Number(x.id) === Number(pedida));
    if (!f) {
      if (pedida != null && pedida !== '') return NextResponse.json({ error: 'Filial não liberada para este usuário.' }, { status: 403 });
      return NextResponse.json({ escolherFilial: true, filiais: filiais.map((x) => ({ id: Number(x.id), nome: x.nome, grupo: x.grupo_nome || '' })) });
    }
    const session = await abrirSessao(u, f);
    return NextResponse.json({ success: true, role: session.role });
  } catch (error: any) {
    if (error instanceof ErroAcesso) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor: ' + error.message }, { status: 500 });
  }
}
