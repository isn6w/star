import { createClient, getClients } from "./api.js";

const CLIENTS_KEY = "startv:clients";

function normalizeMac(value) {
  const digits = String(value || "").replace(/[^0-9a-f]/gi, "").toUpperCase();
  return digits.length === 12 ? digits.match(/.{2}/g).join(":") : "";
}

function normalizeType(value) {
  const normalized = String(value || "").toLowerCase();
  return normalized === "tv" || normalized === "televisao" || normalized === "televisão" ? "tv" : "mobile";
}

function convertDevice(device = {}) {
  const type = normalizeType(device.type || device.dispositivo || device.deviceType);
  const brand = type === "tv" ? String(device.brand || device.marca || "").trim() : "";
  return {
    mac: normalizeMac(device.mac || device.macAddress || device.enderecoMac || device.endereçoMac),
    app: String(device.app || device.aplicativo || "").trim(),
    type,
    brand,
  };
}

function convertClient(client = {}) {
  const legacyDevices = Array.isArray(client.devices) && client.devices.length
    ? client.devices
    : [client];
  const devices = legacyDevices.map(convertDevice);
  return {
    name: String(client.name || client.nome || "").trim(),
    key: String(client.key || client.chave || "").trim(),
    devices,
  };
}

function fingerprint(client) {
  return `${client.key.toLowerCase()}|${client.devices.map((device) => device.mac).sort().join(",")}`;
}

export function inspectLocalData(username) {
  const raw = localStorage.getItem(CLIENTS_KEY);
  if (!raw) return { available: false, total: 0, clients: [], invalid: [] };

  try {
    const parsed = JSON.parse(raw);
    const records = Array.isArray(parsed) ? parsed : [];
    const owned = records.filter((client) => !client.owner || client.owner === username);
    const clients = owned.map(convertClient);
    const invalid = clients.filter((client) => !client.name || !client.key || client.devices.some((device) => !device.mac || !device.app || (device.type === "tv" && !device.brand)));
    return { available: clients.length > 0, total: clients.length, clients, invalid };
  } catch {
    return { available: false, total: 0, clients: [], invalid: [{ name: "localStorage inválido" }] };
  }
}

export async function migrateLocalData(username, onProgress = () => {}) {
  const inspected = inspectLocalData(username);
  if (!inspected.available) return { ...inspected, migrated: 0, skipped: 0, failed: [] };

  const existing = [];
  let page = 1;
  let pages = 1;
  do {
    const result = await getClients({ page, pageSize: 100 });
    existing.push(...result.data);
    pages = result.pagination.pages;
    page += 1;
  } while (page <= pages);

  const existingFingerprints = new Set(existing.map(fingerprint));
  const result = { total: inspected.total, migrated: 0, skipped: 0, failed: [...inspected.invalid.map((client) => ({ name: client.name || "Registro sem nome", reason: "Dados incompletos" }))] };
  const validClients = inspected.clients.filter((client) => !inspected.invalid.includes(client));

  for (let index = 0; index < validClients.length; index += 1) {
    const client = validClients[index];
    const key = fingerprint(client);
    onProgress({ current: index + 1, total: validClients.length, name: client.name });
    if (existingFingerprints.has(key)) {
      result.skipped += 1;
      continue;
    }

    try {
      const created = await createClient(client);
      const returned = created.data;
      const returnedFingerprint = fingerprint(returned);
      if (returned.name !== client.name || returned.key !== client.key || returnedFingerprint !== key || returned.devices.length !== client.devices.length) {
        throw new Error("A API retornou dados diferentes do registro local.");
      }
      existingFingerprints.add(key);
      result.migrated += 1;
    } catch (error) {
      result.failed.push({ name: client.name, reason: error.message });
    }
  }

  return result;
}
