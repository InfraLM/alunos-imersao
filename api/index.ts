// Vercel descobre funções serverless em /api/*.
// Este arquivo é um wrapper que reusa o handler real do NestJS,
// que vive dentro do monorepo em apps/api/api/index.ts.
export { default } from '../apps/api/api/index';
