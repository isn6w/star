import { useEffect, useState } from "react";
import * as api from "./api.js";
import LoadingButton from "./LoadingButton.jsx";
import { inspectLocalData, migrateLocalData } from "./migration.js";

const APPS = ["IBO Player", "IBO Pro", "IVO Player", "Smarters Player Lite", "XCIPTV", "VU Player Pro", "Duplex Play", "9Xtream", "Flix IPTV", "Outro"];
const BRANDS = ["Samsung", "LG", "TCL", "Philco", "AOC", "Multilaser", "Philips", "Sony", "Roku TV", "Outra"];

function newDevice() {
  return { mac: "", app: "", type: "", brand: "" };
}

function newClient() {
  return { name: "", key: "", devices: [newDevice()] };
}

function formatMac(value) {
  const digits = value.replace(/[^0-9a-f]/gi, "").toUpperCase().slice(0, 12);
  return digits.match(/.{1,2}/g)?.join(":") || "";
}

function validateClient(form) {
  const errors = {};
  if (form.name.trim().length < 2) errors.name = "Informe o nome do cliente.";
  if (!form.key.trim()) errors.key = "Informe a key do cliente.";
  const macs = new Set();
  errors.devices = form.devices.map((device) => {
    const error = {};
    const mac = device.mac.replace(/[^0-9a-f]/gi, "").toUpperCase();
    if (mac.length !== 12) error.mac = "Use o formato 00:1A:2B:3C:4D:5E.";
    else if (macs.has(mac)) error.mac = "Este MAC está repetido.";
    else macs.add(mac);
    if (!device.app) error.app = "Selecione o aplicativo.";
    if (!device.type) error.type = "Selecione o dispositivo.";
    if (device.type === "tv" && !device.brand) error.brand = "Selecione a marca da TV.";
    return error;
  });
  if (errors.devices.some((error) => Object.keys(error).length)) return errors;
  delete errors.devices;
  return Object.keys(errors).length ? errors : null;
}

function Login({ onSuccess }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ username: "", password: "", email: "" });
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!form.username.trim() || form.password.length < 8) {
      setError("Informe usuário e senha. A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (mode === "register" && !form.email.includes("@")) {
      setError("Informe um e-mail válido.");
      return;
    }
    setStatus("pending");
    try {
      const user = mode === "login" ? await api.login(form) : await api.register(form);
      onSuccess(user);
    } catch (requestError) {
      setError(requestError.message);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 1400);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-glow auth-glow--blue" />
      <div className="auth-glow auth-glow--pink" />
      <section className="auth-card">
        <div className="brand-mark">S</div>
        <p className="eyebrow">STARTV / PAINEL</p>
        <h1>{mode === "login" ? "Acesse seu painel" : "Crie seu acesso"}</h1>
        <p className="muted">Gerencie clientes e dispositivos em um só lugar.</p>
        <form onSubmit={submit} className="stack-form">
          {mode === "register" && <label>E-mail<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="voce@empresa.com" autoComplete="email" /></label>}
          <label>Usuário<input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="seu.usuario" autoComplete="username" /></label>
          <label>Senha<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Mínimo de 8 caracteres" autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <LoadingButton state={status} pendingLabel="Entrando..." successLabel="Acesso liberado" errorLabel="Tentar novamente">{mode === "login" ? "Entrar no painel" : "Criar conta"}</LoadingButton>
        </form>
        <button className="text-button" type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
          {mode === "login" ? "Ainda não tenho uma conta" : "Já tenho uma conta"}
        </button>
      </section>
    </main>
  );
}

function ClientModal({ client, onClose, onSaved }) {
  const editing = Boolean(client);
  const [form, setForm] = useState(client ? { name: client.name, key: client.key, devices: client.devices.map(({ mac, app, type, brand }) => ({ mac, app: APPS.includes(app) ? app : "Outro", type, brand: BRANDS.includes(brand) ? brand : "Outra" })) } : newClient());
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});

  function updateDevice(index, patch) {
    setForm((current) => ({ ...current, devices: current.devices.map((device, deviceIndex) => deviceIndex === index ? { ...device, ...patch } : device) }));
  }

  async function submit(event) {
    event.preventDefault();
    const validation = validateClient(form);
    setErrors(validation || {});
    if (validation) return;
    setStatus("pending");
    setError("");
    try {
      const payload = { ...form, devices: form.devices.map((device) => ({ ...device, mac: formatMac(device.mac), brand: device.type === "tv" ? device.brand : "" })) };
      const result = editing ? await api.updateClient(client.id, payload) : await api.createClient(payload);
      setStatus("success");
      setTimeout(() => onSaved(result.data), 650);
    } catch (requestError) {
      setError(requestError.message);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 1400);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="client-modal-title">
        <div className="modal-heading"><div><p className="eyebrow">CADASTRO</p><h2 id="client-modal-title">{editing ? "Editar cliente" : "Novo cliente"}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Fechar">×</button></div>
        <form onSubmit={submit} className="stack-form">
          <label>Nome do cliente<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ex.: João Pereira" />{errors.name && <small className="form-error">{errors.name}</small>}</label>
          <label>Key de ativação<input value={form.key} onChange={(event) => setForm({ ...form, key: event.target.value })} placeholder="KEY-CLIENTE" />{errors.key && <small className="form-error">{errors.key}</small>}</label>
          <div className="device-section"><div className="section-heading"><div><strong>Dispositivos</strong><span>Um ou mais MACs por cliente</span></div><button className="secondary-button" type="button" onClick={() => setForm({ ...form, devices: [...form.devices, newDevice()] })}>+ Adicionar MAC</button></div>
            <div className="device-list">
              {form.devices.map((device, index) => <div className="device-row" key={index}>
                <label>MAC<input className="mono" value={device.mac} onChange={(event) => updateDevice(index, { mac: formatMac(event.target.value) })} placeholder="00:1A:2B:3C:4D:5E" />{errors.devices?.[index]?.mac && <small className="form-error">{errors.devices[index].mac}</small>}</label>
                <label>Aplicativo<select value={device.app} onChange={(event) => updateDevice(index, { app: event.target.value })}><option value="">Selecione</option>{APPS.map((app) => <option key={app}>{app}</option>)}</select>{errors.devices?.[index]?.app && <small className="form-error">{errors.devices[index].app}</small>}</label>
                <label>Dispositivo<div className="segmented"><button type="button" className={device.type === "tv" ? "active" : ""} onClick={() => updateDevice(index, { type: "tv" })}>TV</button><button type="button" className={device.type === "mobile" ? "active" : ""} onClick={() => updateDevice(index, { type: "mobile", brand: "" })}>Mobile</button></div>{errors.devices?.[index]?.type && <small className="form-error">{errors.devices[index].type}</small>}</label>
                {device.type === "tv" && <label>Marca<select value={device.brand} onChange={(event) => updateDevice(index, { brand: event.target.value })}><option value="">Selecione</option>{BRANDS.map((brand) => <option key={brand}>{brand}</option>)}</select>{errors.devices?.[index]?.brand && <small className="form-error">{errors.devices[index].brand}</small>}</label>}
                <button className="remove-button" type="button" disabled={form.devices.length === 1} onClick={() => setForm({ ...form, devices: form.devices.filter((_, deviceIndex) => deviceIndex !== index) })} aria-label="Remover dispositivo">−</button>
              </div>)}
            </div>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancelar</button><LoadingButton state={status} pendingLabel="Salvando..." successLabel="Salvo" errorLabel="Tentar novamente">{editing ? "Salvar alterações" : "Cadastrar cliente"}</LoadingButton></div>
        </form>
      </section>
    </div>
  );
}

function Dashboard({ user, onLogout }) {
  const [clients, setClients] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [localData, setLocalData] = useState(() => inspectLocalData(user.username));
  const [migration, setMigration] = useState({ status: "idle", result: null, progress: null });

  async function loadClients(page = 1, query = search) {
    setLoading(true);
    try {
      const result = await api.getClients({ search: query, page });
      setClients(result.data);
      setPagination(result.pagination);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadClients(); }, []);
  useEffect(() => { const timer = setTimeout(() => loadClients(1, search), 300); return () => clearTimeout(timer); }, [search]);

  async function removeClient(client) {
    if (!window.confirm(`Remover o cliente ${client.name}?`)) return;
    try { await api.deleteClient(client.id); await loadClients(pagination.page); } catch (requestError) { setError(requestError.message); }
  }

  function savedClient() { setModal(null); loadClients(pagination.page); }

  async function runMigration() {
    setMigration({ status: "pending", result: null, progress: null });
    try {
      const result = await migrateLocalData(user.username, (progress) => setMigration((current) => ({ ...current, progress })));
      setMigration({ status: "success", result, progress: null });
      await loadClients(1);
      setLocalData(inspectLocalData(user.username));
    } catch (requestError) {
      setMigration({ status: "error", result: { failed: [{ name: "Migração", reason: requestError.message }] }, progress: null });
    }
  }

  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark small">S</span><div><strong>StarTV</strong><span>Painel de clientes</span></div></div><div className="topbar-actions"><span className="user-chip">{user.username}</span><button className="secondary-button" onClick={async () => { await api.logout(); onLogout(); }}>Sair</button></div></header>
    <section className="dashboard-heading"><div><p className="eyebrow">VISÃO GERAL</p><h1>Seus clientes</h1><p className="muted">Organize chaves e dispositivos com precisão.</p></div><button className="primary-button" onClick={() => setModal("new")}>+ Novo cliente</button></section>
    <section className="toolbar"><div className="search-box"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, key ou MAC" /></div><span className="result-count">{pagination.total} cliente{pagination.total === 1 ? "" : "s"}</span></section>
    {localData.available && <section className="migration-panel"><div><p className="eyebrow">IMPORTAÇÃO SEGURA</p><strong>{localData.total} cliente{localData.total === 1 ? "" : "s"} encontrado{localData.total === 1 ? "" : "s"} no armazenamento local</strong><span>Os dados originais serão preservados como backup.</span></div><LoadingButton state={migration.status === "pending" ? "pending" : migration.status === "success" ? "success" : migration.status === "error" ? "error" : "idle"} pendingLabel="Migrando..." successLabel="Migração concluída" errorLabel="Tentar novamente" onClick={runMigration}>Migrar dados locais</LoadingButton></section>}
    {migration.progress && <div className="migration-progress">Migrando {migration.progress.current} de {migration.progress.total}: {migration.progress.name}</div>}
    {migration.result && <div className="notice migration-result" role="status">Migrados: {migration.result.migrated || 0} · Ignorados: {migration.result.skipped || 0} · Falhas: {migration.result.failed?.length || 0}{migration.result.failed?.length > 0 && <span> Revise os registros incompletos antes de tentar novamente.</span>}</div>}
    {error && <div className="notice error-notice" role="alert">{error}</div>}
    {loading ? <div className="empty-state">Carregando clientes...</div> : clients.length === 0 ? <div className="empty-state"><strong>Nenhum cliente encontrado</strong><span>Cadastre seu primeiro cliente para começar.</span></div> : <section className="client-grid">{clients.map((client) => <article className="client-card" key={client.id}><div className="client-card-heading"><div><h2>{client.name}</h2><span className="key-label">{client.key}</span></div><button className="more-button" type="button" onClick={() => setModal(client)} aria-label={`Editar ${client.name}`}>•••</button></div><div className="device-summary">{client.devices.map((device) => <div className="device-summary-row" key={device.id}><span className="mono">{device.mac}</span><span>{device.app}</span><span className="device-tag">{device.type === "tv" ? device.brand || "TV" : "Mobile"}</span></div>)}</div><div className="card-footer"><span>{client.devices.length} dispositivo{client.devices.length === 1 ? "" : "s"}</span><div><button className="text-button" onClick={() => setModal(client)}>Editar</button><button className="danger-button" onClick={() => removeClient(client)}>Remover</button></div></div></article>)}</section>}
    {pagination.pages > 1 && <nav className="pagination" aria-label="Paginação"><button disabled={pagination.page <= 1} onClick={() => loadClients(pagination.page - 1)}>Anterior</button><span>Página {pagination.page} de {pagination.pages}</span><button disabled={pagination.page >= pagination.pages} onClick={() => loadClients(pagination.page + 1)}>Próxima</button></nav>}
    {modal && <ClientModal client={modal === "new" ? null : modal} onClose={() => setModal(null)} onSaved={savedClient} />}
  </main>;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  useEffect(() => { if (api.hasSession()) api.getMe().then((result) => setUser(result.user)).catch(() => api.clearSession()).finally(() => setChecking(false)); else setChecking(false); }, []);
  if (checking) return <div className="boot-screen">Carregando StarTV...</div>;
  return user ? <Dashboard user={user} onLogout={() => setUser(null)} /> : <Login onSuccess={setUser} />;
}
