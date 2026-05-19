// Vercel descobre funções serverless em /api/*.
// Apontamos para o JS já compilado pelo `nest build`, não o TS fonte —
// senão o @vercel/node retranspila o grafo NestJS com decorators Stage 3
// (TS 5.x default), e os decorators legacy quebram em runtime.
// O `npm run build` da raiz garante que apps/api/dist/ existe antes do
// Vercel detectar as functions.
// @ts-ignore - dist é gerado em build-time (gitignored)
export { default } from '../apps/api/dist/api/index.js';
