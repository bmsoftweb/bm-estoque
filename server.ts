import 'dotenv/config';
import express, { Request, Response } from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { NextRequest } from './server/next-server';
import { contextoRequisicao } from './server/next-headers';

/**
 * Servidor: Express com as rotas /api (uma por arquivo app/**\/route.ts, pasta = caminho, [x] = :x)
 * e, por cima, o Vite (desenvolvimento) ou a pasta dist (produção) para o front-end.
 */
const RAIZ = process.cwd();
const METODOS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

/** Todos os route.ts de uma pasta, com o caminho da URL que cada um atende */
function listarRotas(pasta: string, prefixo = ''): { arquivo: string; caminho: string }[] {
  const achados: { arquivo: string; caminho: string }[] = [];
  for (const e of fs.readdirSync(pasta, { withFileTypes: true })) {
    if (e.isDirectory()) {
      const seg = /^\[(.+)\]$/.test(e.name) ? ':' + e.name.slice(1, -1) : e.name;
      achados.push(...listarRotas(path.join(pasta, e.name), `${prefixo}/${seg}`));
    } else if (e.name === 'route.ts') {
      achados.push({ arquivo: path.join(pasta, e.name), caminho: prefixo || '/' });
    }
  }
  return achados;
}

/** Segmentos fixos antes dos dinâmicos (/api/produtos/schema antes de /api/produtos/:id) */
const chaveOrdem = (caminho: string) => caminho.split('/').map((s) => (s.startsWith(':') ? '1' : '0')).join('');

async function main() {
  const app = express();
  // Um servidor HTTP só: o HMR do Vite usa a mesma porta do app (a 24678 padrão colide com os outros projetos Vite abertos)
  const servidor = http.createServer(app);
  app.use(express.json({ limit: '5mb' }));

  const rotas = listarRotas(path.join(RAIZ, 'app')).sort((a, b) => chaveOrdem(a.caminho).localeCompare(chaveOrdem(b.caminho)) || a.caminho.localeCompare(b.caminho));
  for (const r of rotas) {
    const mod = await import(pathToFileURL(r.arquivo).href);
    for (const m of METODOS) {
      const handler = mod[m] ?? mod.default?.[m];
      if (typeof handler !== 'function') continue;
      app[m.toLowerCase() as 'get'](r.caminho, async (req: Request, res: Response) => {
        try {
          const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
          const nreq = new NextRequest(url, { body: req.body, headers: req.headers });
          const out: globalThis.Response = await contextoRequisicao.run({ req, res }, () => handler(nreq, { params: Promise.resolve(req.params) }));
          res.status(out.status);
          out.headers.forEach((v, k) => k !== 'content-length' && res.setHeader(k, v));
          res.send(Buffer.from(await out.arrayBuffer()));
        } catch (err: any) {
          console.error(`${m} ${req.originalUrl}:`, err);
          if (!res.headersSent) res.status(500).json({ error: err.message || 'Erro interno do servidor' });
        }
      });
    }
  }

  // API desconhecida: 404 em JSON em vez de cair no index.html
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Rota não encontrada' }));

  if (process.env.NODE_ENV === 'production') {
    const dist = path.join(RAIZ, 'dist');
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true, hmr: { server: servidor } }, appType: 'spa' });
    app.use(vite.middlewares);
  }

  const porta = Number(process.env.PORT) || 3000;
  servidor.listen(porta, '0.0.0.0', () => console.log(`bm-estoque em http://localhost:${porta}`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
