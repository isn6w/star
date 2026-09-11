import { useEffect, useState } from "react";
import * as api from "./api.js";
import LoadingButton from "./LoadingButton.jsx";
import { inspectLocalData, migrateLocalData } from "./migration.js";

const APPS = ["IBO Player", "IBO Pro", "IVO Player", "Smarters Player Lite", "XCIPTV", "VU Player Pro", "Duplex Play", "9Xtream", "Flix IPTV", "Outro"];
const BRANDS = ["Samsung", "LG", "TCL", "Philco", "AOC", "Multilaser", "Philips", "Sony", "Roku TV", "Outra"];

function newDevice() {
  return { mac: "", key: "", app: "", appCustom: "", type: "", brand: "", brandCustom: "" };
}

function newClient() {
  return { name: "", email: "", phone: "", subscriptionEndsAt: "", notifyBeforeDays: 3, devices: [newDevice()] };
}

function formatMac(value) {
  const digits = value.replace(/[^0-9a-f]/gi, "").toUpperCase().slice(0, 12);
  return digits.match(/.{1,2}/g)?.join(":") || "";
}

function validateClient(form) {
  const errors = {};
  if (form.name.trim().length < 2) errors.name = "Informe o nome do cliente.";
  const macs = new Set();
  errors.devices = form.devices.map((device) => {
    const error = {};
    const mac = device.mac.replace(/[^0-9a-f]/gi, "").toUpperCase();
    if (mac.length !== 12) error.mac = "Use o formato 00:1A:2B:3C:4D:5E.";
    else if (macs.has(mac)) error.mac = "Este MAC está repetido.";
    else macs.add(mac);
    if (device.key && !/^[a-zA-Z0-9]{1,10}$/.test(device.key)) error.key = "Key opcional: até 10 letras ou números.";
    if (!device.app) error.app = "Selecione o aplicativo.";
    if (device.app === "Outro" && !device.appCustom?.trim()) error.appCustom = "Informe o nome do player.";
    if (!device.type) error.type = "Selecione o dispositivo.";
    if (device.type === "tv" && !device.brand) error.brand = "Selecione a marca da TV.";
    if (device.brand === "Outra" && !device.brandCustom?.trim()) error.brandCustom = "Informe a marca da TV.";
    return error;
  });
  if (errors.devices.some((error) => Object.keys(error).length)) return errors;
  delete errors.devices;
  return Object.keys(errors).length ? errors : null;
}

function Landing({ onEnter }) {
  return <main className="landing-page">
    <div className="landing-noise" />
    <div className="landing-orbit landing-orbit--blue" />
    <div className="landing-orbit landing-orbit--pink" />
    <section className="landing-content">
      <div className="brand-mark brand-mark--hero">S</div>
      <p className="eyebrow">STARTV / CUSTOMER OS</p>
      <h1>Bem-vindo ao painel de cadastro</h1>
      <p className="landing-lede">Todos os seus clientes em um só lugar.</p>
      <button className="primary-button landing-cta" type="button" onClick={onEnter}><span aria-hidden="true">↗</span> Acessar o painel</button>
      <div className="landing-note"><span className="status-dot" /> Controle simples. Dados organizados.</div>
    </section>
  </main>;
}

function Login({ onSuccess, onBack }) {
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
    <main className="auth-page" onMouseMove={(event) => { const rect = event.currentTarget.getBoundingClientRect(); const x = event.clientX - rect.left; const y = event.clientY - rect.top; event.currentTarget.style.setProperty("--mouse-x", `${x}px`); event.currentTarget.style.setProperty("--mouse-y", `${y}px`); event.currentTarget.style.setProperty("--card-rotate-y", `${((x / rect.width) - .5) * 3}deg`); event.currentTarget.style.setProperty("--card-rotate-x", `${((.5 - y / rect.height) * 3)}deg`); }}>
      <div className="auth-glow auth-glow--blue" />
      <div className="auth-glow auth-glow--pink" />
      <section className="auth-card">
        <button className="back-button" type="button" onClick={onBack}>← Início</button>
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
  const [form, setForm] = useState(client ? { name: client.name, email: client.email || "", phone: client.phone || "", subscriptionEndsAt: client.subscriptionEndsAt ? client.subscriptionEndsAt.slice(0, 10) : "", notifyBeforeDays: client.notifyBeforeDays ?? 3, devices: client.devices.map(({ mac, key, app, type, brand }) => ({ mac, key: key || "", app: APPS.includes(app) ? app : "Outro", appCustom: APPS.includes(app) ? "" : app, type, brand: BRANDS.includes(brand) ? brand : "Outra", brandCustom: BRANDS.includes(brand) ? "" : brand })) } : newClient());
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
      const payload = { ...form, phone: form.phone.replace(/\D/g, ""), subscriptionEndsAt: form.subscriptionEndsAt ? new Date(`${form.subscriptionEndsAt}T23:59:59.000Z`).toISOString() : null, notifyBeforeDays: Number(form.notifyBeforeDays), devices: form.devices.map((device) => ({ mac: formatMac(device.mac), key: device.key.trim(), app: device.app === "Outro" ? device.appCustom.trim() : device.app, type: device.type, brand: device.type === "tv" ? (device.brand === "Outra" ? device.brandCustom.trim() : device.brand) : "" })) };
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
          <div className="form-grid"><label>E-mail <span className="field-hint">opcional</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="cliente@email.com" /></label><label>Telefone <span className="field-hint">opcional</span><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="(11) 99999-9999" /></label></div>
          <div className="form-grid subscription-fields"><label>Vencimento <span className="field-hint">opcional</span><input type="date" value={form.subscriptionEndsAt} onChange={(event) => setForm({ ...form, subscriptionEndsAt: event.target.value })} /></label><label>Avisar com antecedência<select value={form.notifyBeforeDays} onChange={(event) => setForm({ ...form, notifyBeforeDays: event.target.value })}><option value={0}>Não avisar</option><option value={3}>3 dias antes</option><option value={7}>7 dias antes</option><option value={15}>15 dias antes</option><option value={30}>30 dias antes</option></select></label></div>
          <div className="device-section"><div className="section-heading"><div><strong>Dispositivos</strong><span>Um ou mais MACs por cliente</span></div><button className="secondary-button" type="button" onClick={() => setForm({ ...form, devices: [...form.devices, newDevice()] })}>+ Adicionar MAC</button></div>
            <div className="device-list">
              {form.devices.map((device, index) => <div className="device-row" key={index}>
                <label>MAC<input className="mono" value={device.mac} onChange={(event) => updateDevice(index, { mac: formatMac(event.target.value) })} placeholder="00:1A:2B:3C:4D:5E" />{errors.devices?.[index]?.mac && <small className="form-error">{errors.devices[index].mac}</small>}</label>
                <label>Key do dispositivo <span className="field-hint">opcional · até 10</span><input value={device.key} maxLength={10} onChange={(event) => updateDevice(index, { key: event.target.value.replace(/[^a-zA-Z0-9]/g, "") })} placeholder="MACKEY" />{errors.devices?.[index]?.key && <small className="form-error">{errors.devices[index].key}</small>}</label>
                <label>Aplicativo<select value={device.app} onChange={(event) => updateDevice(index, { app: event.target.value })}><option value="">Selecione</option>{APPS.map((app) => <option key={app}>{app}</option>)}</select>{errors.devices?.[index]?.app && <small className="form-error">{errors.devices[index].app}</small>}{device.app === "Outro" && <><input value={device.appCustom} onChange={(event) => updateDevice(index, { appCustom: event.target.value })} placeholder="Nome do player" />{errors.devices?.[index]?.appCustom && <small className="form-error">{errors.devices[index].appCustom}</small>}</>}</label>
                <label>Dispositivo<div className="segmented"><button type="button" className={device.type === "tv" ? "active" : ""} onClick={() => updateDevice(index, { type: "tv" })}>TV</button><button type="button" className={device.type === "mobile" ? "active" : ""} onClick={() => updateDevice(index, { type: "mobile", brand: "" })}>Mobile</button></div>{errors.devices?.[index]?.type && <small className="form-error">{errors.devices[index].type}</small>}</label>
                {device.type === "tv" && <label>Marca<select value={device.brand} onChange={(event) => updateDevice(index, { brand: event.target.value })}><option value="">Selecione</option>{BRANDS.map((brand) => <option key={brand}>{brand}</option>)}</select>{errors.devices?.[index]?.brand && <small className="form-error">{errors.devices[index].brand}</small>}{device.brand === "Outra" && <><input value={device.brandCustom} onChange={(event) => updateDevice(index, { brandCustom: event.target.value })} placeholder="Nome da marca" />{errors.devices?.[index]?.brandCustom && <small className="form-error">{errors.devices[index].brandCustom}</small>}</>}</label>}
                <button className="remove-button" type="button" disabled={form.devices.length === 1} onClick={() => setForm({ ...form, devices: form.devices.filter((_, deviceIndex) => deviceIndex !== index) })} aria-label="Remover dispositivo" title="Remover dispositivo">⌫</button>
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

function AccountModal({ user, onClose, onUpdated, onDeleted }) {
  const [form, setForm] = useState({ username: user.username, email: user.email || "", currentPassword: "", newPassword: "" });
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [deleteStep, setDeleteStep] = useState(0);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletePhrase, setDeletePhrase] = useState("");

  async function save(event) {
    event.preventDefault();
    if (form.username.trim().length < 3 || !form.currentPassword || (form.newPassword && form.newPassword.length < 8)) {
      setError("Informe usuário, senha atual e uma nova senha válida, se desejar alterá-la.");
      return;
    }
    setStatus("pending");
    setError("");
    try {
      const result = await api.updateMe(form);
      setStatus("success");
      setTimeout(() => onUpdated(result.user), 650);
    } catch (requestError) {
      setStatus("error");
      setError(requestError.message);
      setTimeout(() => setStatus("idle"), 1400);
    }
  }

  async function deleteAccount() {
    if (deletePhrase !== "EXCLUIR" || !deletePassword) return;
    setStatus("pending");
    try {
      await api.deleteMe(deletePassword);
      onDeleted();
    } catch (requestError) {
      setStatus("error");
      setError(requestError.message);
      setDeleteStep(0);
      setTimeout(() => setStatus("idle"), 1400);
    }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="modal-card account-modal" role="dialog" aria-modal="true" aria-labelledby="account-modal-title">
      <div className="modal-heading"><div><p className="eyebrow">CONTA</p><h2 id="account-modal-title">Editar conta</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Fechar">×</button></div>
      <form onSubmit={save} className="stack-form"><label>Usuário<input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} autoComplete="username" /></label><label>E-mail<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="opcional" autoComplete="email" /></label><label>Senha atual<input type="password" value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} autoComplete="current-password" /></label><label>Nova senha <span className="field-hint">deixe vazio para manter</span><input type="password" value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} autoComplete="new-password" /></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancelar</button><LoadingButton state={status} pendingLabel="Salvando..." successLabel="Conta atualizada" errorLabel="Tentar novamente">Salvar alterações</LoadingButton></div></form>
      <div className="account-danger-zone"><strong>Excluir conta</strong><span>Todos os clientes e dispositivos serão removidos permanentemente.</span><button className="danger-button danger-button--box" type="button" onClick={() => setDeleteStep(1)}>Excluir minha conta</button></div>
    </section>
    {deleteStep === 1 && <div className="modal-backdrop confirm-layer"><section className="confirm-dialog" role="alertdialog" aria-modal="true"><p className="eyebrow">PRIMEIRA CONFIRMAÇÃO</p><h2>Tem certeza que deseja excluir?</h2><p>Essa ação removerá sua conta, clientes, dispositivos e sessões.</p><div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setDeleteStep(0)}>Cancelar</button><button className="danger-button danger-button--box" type="button" onClick={() => setDeleteStep(2)}>Continuar</button></div></section></div>}
    {deleteStep === 2 && <div className="modal-backdrop confirm-layer"><section className="confirm-dialog" role="alertdialog" aria-modal="true"><p className="eyebrow">ÚLTIMA CONFIRMAÇÃO</p><h2>Confirme a exclusão</h2><p>Digite <strong>EXCLUIR</strong> e sua senha atual para concluir.</p><input value={deletePhrase} onChange={(event) => setDeletePhrase(event.target.value.toUpperCase())} placeholder="EXCLUIR" /><input type="password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} placeholder="Senha atual" autoComplete="current-password" /><div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setDeleteStep(0)}>Cancelar</button><button className="danger-button danger-button--box" type="button" disabled={deletePhrase !== "EXCLUIR" || !deletePassword || status === "pending"} onClick={deleteAccount}>Excluir definitivamente</button></div></section></div>}
  </div>;
}

function Dashboard({ user, onLogout, onUserUpdated }) {
  const [clients, setClients] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("updated");
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [localData, setLocalData] = useState(() => inspectLocalData(user.username));
  const [migration, setMigration] = useState({ status: "idle", result: null, progress: null });
  const [accountOpen, setAccountOpen] = useState(false);

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

  const visibleClients = [...clients].sort((first, second) => {
    if (sort === "expiresSoon") return (first.subscriptionEndsAt || "9999").localeCompare(second.subscriptionEndsAt || "9999");
    if (sort === "expiresLate") return (second.subscriptionEndsAt || "0000").localeCompare(first.subscriptionEndsAt || "0000");
    return 0;
  });

  function expiryLabel(client) {
    if (!client.subscriptionEndsAt) return "Sem vencimento";
    const days = Math.ceil((new Date(client.subscriptionEndsAt) - new Date()) / 86400000);
    if (days < 0) return "Vencida";
    if (days === 0) return "Vence hoje";
    return `Vence em ${days}d`;
  }

  const expiringClients = clients.filter((client) => {
    if (!client.subscriptionEndsAt) return false;
    const days = Math.ceil((new Date(client.subscriptionEndsAt) - new Date()) / 86400000);
    return days >= 0 && days <= Number(client.notifyBeforeDays ?? 3);
  });

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
    <header className="topbar"><div className="brand"><span className="brand-mark small">S</span><div><strong>StarTV</strong><span>Painel de clientes</span></div></div><div className="topbar-actions"><span className="user-chip">{user.username}</span><button className="secondary-button" onClick={() => setAccountOpen(true)}>Minha conta</button><button className="secondary-button" onClick={async () => { await api.logout(); onLogout(); }}>Sair</button></div></header>
    <section className="dashboard-heading"><div><p className="eyebrow">VISÃO GERAL</p><h1>Seus clientes</h1><p className="muted">Organize chaves e dispositivos com precisão.</p></div><button className="primary-button" onClick={() => setModal("new")}>+ Novo cliente</button></section>
    <section className="toolbar"><div className="search-box"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, key ou MAC" /></div><label className="sort-control"><span aria-hidden="true">↕</span><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Ordenar clientes"><option value="updated">Mais recentes</option><option value="expiresSoon">Vencem primeiro</option><option value="expiresLate">Vencem por último</option></select></label><span className="result-count">{pagination.total} cliente{pagination.total === 1 ? "" : "s"}</span></section>
    {expiringClients.length > 0 && <div className="notice expiry-notice" role="status"><span aria-hidden="true">◷</span> {expiringClients.length} assinatura{expiringClients.length === 1 ? "" : "s"} perto do vencimento: {expiringClients.map((client) => client.name).join(", ")}.</div>}
    {localData.available && <section className="migration-panel"><div><p className="eyebrow">IMPORTAÇÃO SEGURA</p><strong>{localData.total} cliente{localData.total === 1 ? "" : "s"} encontrado{localData.total === 1 ? "" : "s"} no armazenamento local</strong><span>Os dados originais serão preservados como backup.</span></div><LoadingButton state={migration.status === "pending" ? "pending" : migration.status === "success" ? "success" : migration.status === "error" ? "error" : "idle"} pendingLabel="Migrando..." successLabel="Migração concluída" errorLabel="Tentar novamente" onClick={runMigration}>Migrar dados locais</LoadingButton></section>}
    {migration.progress && <div className="migration-progress">Migrando {migration.progress.current} de {migration.progress.total}: {migration.progress.name}</div>}
    {migration.result && <div className="notice migration-result" role="status">Migrados: {migration.result.migrated || 0} · Ignorados: {migration.result.skipped || 0} · Falhas: {migration.result.failed?.length || 0}{migration.result.failed?.length > 0 && <span> Revise os registros incompletos antes de tentar novamente.</span>}</div>}
    {error && <div className="notice error-notice" role="alert">{error}</div>}
    {loading ? <div className="empty-state">Carregando clientes...</div> : clients.length === 0 ? <div className="empty-state"><strong>Nenhum cliente encontrado</strong><span>Cadastre seu primeiro cliente para começar.</span></div> : <section className="client-grid">{visibleClients.map((client) => <article className="client-card" key={client.id}><div className="client-card-heading"><div><h2>{client.name}</h2></div><button className="more-button" type="button" onClick={() => setModal(client)} aria-label={`Editar ${client.name}`}>•••</button></div><div className="expiry-line"><span aria-hidden="true">◷</span>{expiryLabel(client)}</div><div className="device-summary">{client.devices.map((device) => <div className="device-summary-row" key={device.id}><span className="mono">{device.mac}</span><span>{device.app}</span><span className="device-tag">{device.key || (device.type === "tv" ? device.brand || "TV" : "Mobile")}</span></div>)}</div><div className="card-footer"><span>{client.devices.length} dispositivo{client.devices.length === 1 ? "" : "s"}</span><div><button className="text-button" onClick={() => setModal(client)}>Editar</button><button className="danger-button" onClick={() => removeClient(client)}>Remover</button></div></div></article>)}</section>}
    {pagination.pages > 1 && <nav className="pagination" aria-label="Paginação"><button disabled={pagination.page <= 1} onClick={() => loadClients(pagination.page - 1)}>Anterior</button><span>Página {pagination.page} de {pagination.pages}</span><button disabled={pagination.page >= pagination.pages} onClick={() => loadClients(pagination.page + 1)}>Próxima</button></nav>}
    {modal && <ClientModal client={modal === "new" ? null : modal} onClose={() => setModal(null)} onSaved={savedClient} />}
    {accountOpen && <AccountModal user={user} onClose={() => setAccountOpen(false)} onUpdated={(updatedUser) => { setAccountOpen(false); onUserUpdated(updatedUser); }} onDeleted={() => { setAccountOpen(false); onLogout(); }} />}
  </main>;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  useEffect(() => { if (api.hasSession()) api.getMe().then((result) => setUser(result.user)).catch(() => api.clearSession()).finally(() => setChecking(false)); else setChecking(false); }, []);
  if (checking) return <div className="boot-screen">Carregando StarTV...</div>;
  if (user) return <Dashboard user={user} onLogout={() => { api.clearSession(); setUser(null); }} onUserUpdated={setUser} />;
  return showAuth ? <Login onSuccess={setUser} onBack={() => setShowAuth(false)} /> : <Landing onEnter={() => setShowAuth(true)} />;
}
