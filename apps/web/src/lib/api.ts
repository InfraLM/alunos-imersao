const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers ?? {}),
    },
  });

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const message =
      (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string'
        ? data.message
        : `Erro ${res.status}`);
    throw new ApiError(message, res.status, data);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export interface MeResponse {
  matricula: string;
  nome: string | null;
  email: string | null;
  primeiroNome: string;
  turma: string | null;
  bloqueios: {
    inadimplente: boolean;
    punicao: boolean;
    pendenciaMulta: boolean;
  };
}

export type LoginCpfResponse =
  | { status: 'otp_enviado'; emailMascarado: string }
  | { status: 'bloqueado'; motivo: 'sem_email'; mensagem: string }
  | { status: 'nao_encontrado'; mensagem: string };

export type OtpResponse = { status: 'ok'; primeiroNome: string; matricula: string };

export interface ImersaoDisponivel {
  idImersao: number;
  tipo: { idTipo: number; nome: string };
  dataImersao: string;
  dataAbertura: string;
  vagasTotal: number;
  vagasOcupadas: number;
  vagasRestantes: number;
  local: string | null;
  cidade: string | null;
  estado: string | null;
  linkGrupoWhatsapp: string | null;
}

export interface HistoricoItem {
  idImersao: number;
  tipo: string;
  tipoId: number;
  dataImersao: string;
  statusPresenca: 'presente' | 'faltou' | 'pendente';
}

export interface MinhaInscricao {
  idImersao: number;
  tipo: string;
  tipoId: number;
  dataImersao: string;
  diasRestantes: number;
  podeAlterarSemFinanceiro: boolean;
  dataSolicitacao: string;
  status: number | null;
  pagouMulta: boolean;
  pendenteMulta: boolean;
  local: string | null;
  cidade: string | null;
  estado: string | null;
  linkGrupoWhatsapp: string | null;
}
