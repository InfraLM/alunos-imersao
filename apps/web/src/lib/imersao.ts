/**
 * Monta o local da imersão no formato "local - Cidade, Estado".
 * Omite as partes ausentes; retorna null quando os três campos estão vazios
 * (a UI então não renderiza a linha de localização).
 */
export function formatarLocal(
  local?: string | null,
  cidade?: string | null,
  estado?: string | null,
): string | null {
  const cidadeEstado = [cidade, estado]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(', ');
  const partes = [local?.trim(), cidadeEstado].filter(Boolean);
  return partes.length ? partes.join(' - ') : null;
}
