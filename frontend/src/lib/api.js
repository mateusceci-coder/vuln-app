// Cliente HTTP fino sobre fetch. Base /api (o Vite faz proxy p/ o backend).
// Injeta o token JWT guardado no localStorage (convenção intencional do laboratório).

const BASE = "/api";
const TOKEN_KEY = "aurora_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(extra = {}) {
  const token = getToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

async function handle(res) {
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text; // ex.: /pdf devolve text/plain
  }
  if (!res.ok) {
    const msg =
      (data && data.error) ||
      (typeof data === "string" && data) ||
      `Erro ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export function apiGet(path) {
  return fetch(BASE + path, { headers: authHeaders() }).then(handle);
}

function send(method, path, body) {
  return fetch(BASE + path, {
    method,
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: body != null ? JSON.stringify(body) : undefined,
  }).then(handle);
}

export const apiPost = (path, body) => send("POST", path, body);
export const apiPatch = (path, body) => send("PATCH", path, body);
export const apiDelete = (path) => send("DELETE", path);

// Upload multipart (anexos). Não fixa Content-Type — o browser define o boundary.
export function apiUpload(path, formData) {
  return fetch(BASE + path, {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  }).then(handle);
}
