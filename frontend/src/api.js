const configuredApiUrl = import.meta.env.VITE_API_URL || "http://localhost:3333/api";
const API_URL = configuredApiUrl.replace(/\/+$/, "").endsWith("/api")
  ? configuredApiUrl.replace(/\/+$/, "")
  : `${configuredApiUrl.replace(/\/+$/, "")}/api`;

if (import.meta.env.PROD && API_URL.includes("localhost")) {
  console.warn("VITE_API_URL ainda aponta para localhost. Configure a URL pública da API no painel da Vercel e faça um novo deploy.");
}

let accessToken = sessionStorage.getItem("startv:access-token");
let refreshToken = sessionStorage.getItem("startv:refresh-token");

export function hasSession() {
  return Boolean(accessToken && refreshToken);
}

export function clearSession() {
  accessToken = null;
  refreshToken = null;
  sessionStorage.removeItem("startv:access-token");
  sessionStorage.removeItem("startv:refresh-token");
}

function saveSession(session) {
  accessToken = session.accessToken || session.token;
  refreshToken = session.refreshToken;
  sessionStorage.setItem("startv:access-token", accessToken);
  sessionStorage.setItem("startv:refresh-token", refreshToken);
}

async function request(path, options = {}, retry = true) {
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch (error) {
    if (import.meta.env.PROD && API_URL.includes("localhost")) {
      throw new Error("A API de produção não está configurada. Defina VITE_API_URL na Vercel e publique novamente.");
    }
    throw new Error(`Não foi possível conectar à API (${API_URL}). Verifique se a API está online e se o CORS está configurado.`);
  }
  if (response.status === 401 && retry && refreshToken) {
    try {
      await refreshSession();
      return request(path, options, false);
    } catch {
      clearSession();
    }
  }

  const contentType = response.headers.get("content-type") || "";
  const payload = response.status === 204
    ? null
    : contentType.includes("application/json")
      ? await response.json().catch(() => null)
      : null;
  if (!response.ok) {
    const detail = payload?.error || `A API respondeu com HTTP ${response.status}.`;
    throw new Error(`${detail} Endpoint: ${API_URL}${path}`);
  }
  return payload;
}

export async function register(input) {
  const result = await request("/auth/register", { method: "POST", body: JSON.stringify(input) }, false);
  saveSession(result);
  return result.user;
}

export async function login(input) {
  const result = await request("/auth/login", { method: "POST", body: JSON.stringify(input) }, false);
  saveSession(result);
  return result.user;
}

export async function refreshSession() {
  if (!refreshToken) throw new Error("Sessão expirada.");
  const result = await request("/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken }) }, false);
  saveSession(result);
  return result.user;
}

export async function logout() {
  if (refreshToken) {
    await request("/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken }) }, false).catch(() => {});
  }
  clearSession();
}

export function getMe() {
  return request("/me");
}

export function getClients({ search = "", page = 1, pageSize = 12 } = {}) {
  const params = new URLSearchParams({ page, pageSize });
  if (search.trim()) params.set("search", search.trim());
  return request(`/clients?${params}`);
}

export function createClient(input) {
  return request("/clients", { method: "POST", body: JSON.stringify(input) });
}

export function updateClient(id, input) {
  return request(`/clients/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteClient(id) {
  return request(`/clients/${id}`, { method: "DELETE" });
}
