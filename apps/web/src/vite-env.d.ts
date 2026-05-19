/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_CX_TELEFONE?: string;
  readonly VITE_CX_WHATSAPP?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
