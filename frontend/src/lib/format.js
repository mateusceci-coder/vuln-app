// Rótulos e formatação em pt-BR.

export const STATUS = {
  aberto: { label: "Aberto", color: "var(--st-aberto)" },
  em_andamento: { label: "Em andamento", color: "var(--st-andamento)" },
  resolvido: { label: "Resolvido", color: "var(--st-resolvido)" },
  fechado: { label: "Fechado", color: "var(--st-fechado)" },
};

export const PRIORIDADE = {
  baixa: { label: "Baixa", color: "var(--pr-baixa)" },
  media: { label: "Média", color: "var(--pr-media)" },
  alta: { label: "Alta", color: "var(--pr-alta)" },
};

export const PAPEL = {
  cliente: { label: "Cliente" },
  agente: { label: "Agente" },
  admin: { label: "Admin" },
};

export const STATUS_OPCOES = Object.entries(STATUS).map(([value, m]) => ({
  value,
  label: m.label,
}));
export const PRIORIDADE_OPCOES = Object.entries(PRIORIDADE).map(([value, m]) => ({
  value,
  label: m.label,
}));
export const PAPEL_OPCOES = Object.entries(PAPEL).map(([value, m]) => ({
  value,
  label: m.label,
}));

const dtLong = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const dtShort = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : dtLong.format(d);
}

export function formatDateShort(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : dtShort.format(d);
}

export function relativo(iso) {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "—";
  const diff = Date.now() - d;
  const min = Math.round(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const dias = Math.round(h / 24);
  if (dias < 30) return `há ${dias} d`;
  return formatDateShort(iso);
}

export function initials(nome = "") {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
