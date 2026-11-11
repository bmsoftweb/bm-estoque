// Substitui next/server: as rotas em app/api/**/route.ts seguem como estão, agora servidas pelo Express.
// Só existe o que elas usam: req.json(), req.url e NextResponse.json().
export class NextRequest {
  url: string;
  headers: Headers;
  private corpo: unknown;

  constructor(url: string, init: { body?: unknown; headers?: Record<string, string | string[] | undefined> } = {}) {
    this.url = url;
    this.corpo = init.body;
    this.headers = new Headers();
    for (const [k, v] of Object.entries(init.headers ?? {})) if (v !== undefined) this.headers.set(k, Array.isArray(v) ? v.join(', ') : v);
  }

  async json(): Promise<any> {
    return this.corpo;
  }

  get nextUrl() {
    return new URL(this.url);
  }
}

export class NextResponse extends Response {
  static json(dados: unknown, init?: ResponseInit): NextResponse {
    return Response.json(dados, init) as NextResponse;
  }
}
