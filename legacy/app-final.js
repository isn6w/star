"use strict";

const APPS = [
  "IBO Player",
  "IBO Pro",
  "IVO Player",
  "Smarters Player Lite",
  "XCIPTV",
  "VU Player Pro",
  "Duplex Play",
  "9Xtream",
  "Flix IPTV",
  "Outro",
];

const MARCAS_TV = [
  "Samsung",
  "LG",
  "TCL",
  "Philco",
  "AOC",
  "Multilaser",
  "Philips",
  "Sony",
  "Roku TV",
  "Outra",
];

const USERS_KEY = "startv:users";
const CLIENTS_KEY = "startv:clients";

const dataLayer = {
  async loadUsers() {
    try {
      const raw = localStorage.getItem(USERS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      return {};
    }
  },

  async saveUsers(users) {
    try {
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      return true;
    } catch (error) {
      return false;
    }
  },

  async loadClients() {
    try {
      const raw = localStorage.getItem(CLIENTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (error) {
      return [];
    }
  },

  async saveClients(clients) {
    try {
      localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
      return true;
    } catch (error) {
      return false;
    }
  },
};

function normalizeMac(raw) {
  const digits = (raw || "").replace(/[^0-9a-fA-F]/g, "").toUpperCase();
  if (digits.length !== 12) return null;
  return digits.match(/.{1,2}/g).join(":");
}

function formatMacInput(raw) {
  const digits = (raw || "").replace(/[^0-9a-fA-F]/g, "").toUpperCase().slice(0, 12);
  const parts = [];
  for (let i = 0; i < digits.length; i += 2) {
    parts.push(digits.slice(i, i + 2));
  }
  return parts.join(":");
}

async function hashPassword(username, password) {
  const input = `startv::${username.toLowerCase()}::${password}`;

  try {
    if (window.crypto && window.crypto.subtle) {
      const encoder = new TextEncoder();
      const digest = await window.crypto.subtle.digest("SHA-256", encoder.encode(input));
      return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch (error) {
    // fallback below
  }

  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }

  return `fb-${Math.abs(hash)}-${input.length}`;
}

function createDeviceRow() {
  return {
    id: `device-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    mac: "",
    app: "",
    appCustom: "",
    dispositivo: "",
    marca: "",
    marcaCustom: "",
  };
}

function emptyForm() {
  return {
    nome: "",
    key: "",
    devices: [createDeviceRow()],
  };
}

const SPINNER_SVG = '<svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden="true" class="confirm-spinner"><circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.5" stroke-opacity="0.28" /><path d="M10.5 6A4.5 4.5 0 0 0 6 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>';
const CHECK_SVG = '<svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2.6 6.3 4.9 8.6 9.4 3.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>';

const state = {
  users: {},
  clients: [],
  session: null,
  authMode: "login",
  authBusy: false,
  authError: "",
  editId: null,
  submitStatus: "idle",
  search: "",
  form: emptyForm(),
  errors: { nome: "", key: "", devices: [{}] },
};

let el = {};

function cacheRefs() {
  el = {
    bootScreen: document.getElementById("boot-screen"),
    authScreen: document.getElementById("auth-screen"),
    mainScreen: document.getElementById("main-screen"),
    authTitle: document.getElementById("auth-title"),
    authSubtitle: document.getElementById("auth-subtitle"),
    authHint: document.getElementById("auth-hint"),
    authForm: document.getElementById("auth-form"),
    authUsername: document.getElementById("auth-username"),
    authPassword: document.getElementById("auth-password"),
    authConfirmField: document.getElementById("auth-confirm-field"),
    authConfirm: document.getElementById("auth-confirm"),
    authError: document.getElementById("auth-error"),
    authSubmit: document.getElementById("auth-submit"),
    authSwitchText: document.getElementById("auth-switch-text"),
    authSwitchLink: document.getElementById("auth-switch-link"),
    userTagName: document.getElementById("user-tag-name"),
    btnNewClient: document.getElementById("btn-new-client"),
    btnLogout: document.getElementById("btn-logout"),
    searchInput: document.getElementById("search-input"),
    countTag: document.getElementById("count-tag"),
    clientsGrid: document.getElementById("clients-grid"),
    modalOverlay: document.getElementById("modal-overlay"),
    modalCard: document.getElementById("modal-card"),
    modalTitle: document.getElementById("modal-title"),
    btnCloseModal: document.getElementById("btn-close-modal"),
    clientForm: document.getElementById("client-form"),
    fNome: document.getElementById("f-nome"),
    fKey: document.getElementById("f-key"),
    macRows: document.getElementById("mac-rows"),
    btnAddMac: document.getElementById("btn-add-mac"),
    confirmBtn: document.getElementById("confirm-btn"),
  };
}

function showScreen(name) {
  el.bootScreen.classList.toggle("hidden", name !== "boot");
  el.authScreen.classList.toggle("hidden", name !== "auth");
  el.mainScreen.classList.toggle("hidden", name !== "main");
}

async function boot() {
  let users = {};
  let clients = [];

  try {
    [users, clients] = await Promise.all([dataLayer.loadUsers(), dataLayer.loadClients()]);
  } catch (error) {
    // First load
  }

  if (!users.admin) {
    const passHash = await hashPassword("admin", "admin");
    users = { ...users, admin: { username: "admin", passHash, criadoEm: new Date().toISOString() } };
    dataLayer.saveUsers(users).catch(() => {});
  }

  state.users = users;
  state.clients = clients;
  showScreen("auth");
  renderAuthScreen();
}

function renderAuthScreen() {
  el.authTitle.textContent = state.authMode === "login" ? "Entrar no painel" : "Criar conta";
  el.authSubtitle.textContent = state.authMode === "login"
    ? "Acesse com seu usuário para ver seus clientes cadastrados."
    : "Cadastre um usuário para começar a gerenciar clientes.";
  el.authHint.classList.toggle("hidden", state.authMode !== "login");
  el.authConfirmField.classList.toggle("hidden", state.authMode !== "register");
  el.authPassword.setAttribute("autocomplete", state.authMode === "login" ? "current-password" : "new-password");
  el.authSubmit.disabled = state.authBusy;
  el.authSubmit.textContent = state.authBusy ? "Aguarde…" : state.authMode === "login" ? "Entrar" : "Criar conta";
  el.authSwitchText.textContent = state.authMode === "login" ? "Ainda não tem conta?" : "Já tem conta?";
  el.authSwitchLink.textContent = state.authMode === "login" ? "Criar conta" : "Entrar";

  if (state.authError) {
    el.authError.textContent = state.authError;
    el.authError.classList.remove("hidden");
  } else {
    el.authError.textContent = "";
    el.authError.classList.add("hidden");
  }
}

function toggleAuthMode() {
  state.authMode = state.authMode === "login" ? "register" : "login";
  state.authError = "";
  el.authConfirm.value = "";
  renderAuthScreen();
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  state.authError = "";

  const username = el.authUsername.value.trim();
  const password = el.authPassword.value;

  if (!username || !password) {
    state.authError = "Preencha usuário e senha.";
    renderAuthScreen();
    return;
  }

  if (username.toLowerCase() === "admin" && password === "admin") {
    finishLogin({ username: "admin" });
    return;
  }

  state.authBusy = true;
  renderAuthScreen();

  if (state.authMode === "register") {
    if (password.length < 4) {
      state.authBusy = false;
      state.authError = "A senha precisa ter pelo menos 4 caracteres.";
      renderAuthScreen();
      return;
    }

    if (password !== el.authConfirm.value) {
      state.authBusy = false;
      state.authError = "As senhas não coincidem.";
      renderAuthScreen();
      return;
    }

    const key = username.toLowerCase();
    if (state.users[key]) {
      state.authBusy = false;
      state.authError = "Esse usuário já existe. Faça login.";
      renderAuthScreen();
      return;
    }

    const passHash = await hashPassword(username, password);
    const nextUsers = { ...state.users, [key]: { username, passHash, criadoEm: new Date().toISOString() } };
    state.users = nextUsers;
    state.authBusy = false;
    finishLogin({ username });
    dataLayer.saveUsers(nextUsers).catch(() => {});
    return;
  }

  const key = username.toLowerCase();
  const record = state.users[key];
  if (!record) {
    state.authBusy = false;
    state.authError = "Usuário não encontrado.";
    renderAuthScreen();
    return;
  }

  const passHash = await hashPassword(username, password);
  if (passHash !== record.passHash) {
    state.authBusy = false;
    state.authError = "Senha incorreta.";
    renderAuthScreen();
    return;
  }

  state.authBusy = false;
  finishLogin({ username: record.username });
}

function finishLogin(session) {
  state.session = session;
  state.authError = "";
  el.authUsername.value = "";
  el.authPassword.value = "";
  el.authConfirm.value = "";
  el.userTagName.textContent = session.username;
  showScreen("main");
  renderClientsGrid();
}

function handleLogout() {
  state.session = null;
  state.authMode = "login";
  state.search = "";
  el.searchInput.value = "";
  closeModal();
  showScreen("auth");
  renderAuthScreen();
}

function getMyClients() {
  if (!state.session) return [];
  return state.clients.filter((client) => client.owner === state.session.username);
}

function getFilteredClients() {
  const mine = getMyClients();
  const query = state.search.trim().toLowerCase();

  if (!query) return mine;

  return mine.filter((client) => {
    const deviceText = (client.devices || [])
      .map((device) => `${device.mac || ""} ${device.app || ""} ${device.dispositivo || ""} ${device.marca || ""}`)
      .join(" ");

    return client.nome.toLowerCase().includes(query)
      || client.key.toLowerCase().includes(query)
      || deviceText.toLowerCase().includes(query);
  });
}

function renderClientsGrid() {
  const mine = getMyClients();
  const list = getFilteredClients();

  el.countTag.textContent = `${mine.length} cliente${mine.length === 1 ? "" : "s"}`;
  el.clientsGrid.innerHTML = "";

  if (list.length === 0) {
    const empty = document.createElement("div");
    empty.className = "glass-panel empty-card";
    const paragraph = document.createElement("p");
    paragraph.className = "empty-text";
    paragraph.textContent = mine.length === 0
      ? "Nenhum cliente cadastrado ainda. Clique em “Cadastrar cliente” para começar."
      : "Nenhum cliente encontrado para essa busca.";
    empty.appendChild(paragraph);
    el.clientsGrid.appendChild(empty);
    return;
  }

  list.forEach((client) => el.clientsGrid.appendChild(buildClientCard(client)));
}

function buildClientCard(client) {
  const card = document.createElement("div");
  card.className = "glass-panel client-card";

  const devicesHtml = (client.devices || []).map((device) => `
    <div class="client-device-item">
      <div class="device-meta">
        <span class="mono">${device.mac}</span>
        <span class="device-pill ${device.dispositivo === "tv" ? "pill-tv" : "pill-mobile"}">${device.dispositivo === "tv" ? "TV" : "Mobile"}</span>
      </div>
      <div class="device-submeta">
        <span>${device.app}</span>
        ${device.marca ? `<span>• ${device.marca}</span>` : ""}
      </div>
    </div>
  `).join("");

  card.innerHTML = `
    <div class="client-card-top">
      <h3 class="client-name">${client.nome}</h3>
      <span class="status-pill pill-tv">Cliente</span>
    </div>
    <div class="client-devices">${devicesHtml}</div>
    <dl class="dl">
      <dt>Key</dt><dd class="mono key-dd">${client.key}</dd>
    </dl>
    <div class="card-actions">
      <button type="button" class="glass-btn-ghost btn-edit">Editar</button>
      <button type="button" class="glass-btn-ghost btn-remove">Remover</button>
    </div>
  `;

  card.querySelector(".btn-edit").addEventListener("click", () => handleEdit(client));
  card.querySelector(".btn-remove").addEventListener("click", () => handleDelete(client.id));
  return card;
}

function setFieldError(id, message) {
  const node = document.getElementById(id);
  if (!node) return;

  if (message) {
    node.textContent = message;
    node.classList.remove("hidden");
  } else {
    node.textContent = "";
    node.classList.add("hidden");
  }
}

function renderFormErrors() {
  setFieldError("err-nome", state.errors.nome || "");
  setFieldError("err-key", state.errors.key || "");

  const rows = el.macRows.querySelectorAll(".mac-row");
  rows.forEach((row, index) => {
    const issue = state.errors.devices[index] || {};

    [
      ["err-mac", issue.mac],
      ["err-app", issue.app],
      ["err-app-custom", issue.appCustom],
      ["err-dispositivo", issue.dispositivo],
      ["err-marca", issue.marca],
      ["err-marca-custom", issue.marcaCustom],
    ].forEach(([role, text]) => {
      const node = row.querySelector(`[data-role="${role}"]`);
      if (!node) return;
      node.textContent = text || "";
      node.classList.toggle("hidden", !text);
    });
  });
}

function renderDeviceRow(device, index) {
  const row = document.createElement("div");
  row.className = "mac-row";

  const appCustomVisible = device.app === "Outro";
  const marcaCustomVisible = device.dispositivo === "tv" && device.marca === "Outra";

  row.innerHTML = `
    <div class="field">
      <label>MAC ${index + 1}</label>
      <input class="glass-input mono" data-role="mac" data-index="${index}" value="${device.mac}" placeholder="00:1A:2B:3C:4D:5E" />
      <p class="error-text hidden" data-role="err-mac"></p>
    </div>

    <div class="field">
      <label>Aplicativo</label>
      <select class="glass-input" data-role="app" data-index="${index}">
        <option value="">Selecione o app</option>
        ${APPS.map((app) => `<option value="${app}" ${device.app === app ? "selected" : ""}>${app}</option>`).join("")}
      </select>
      <p class="error-text hidden" data-role="err-app"></p>
      <div class="field ${appCustomVisible ? "" : "hidden"}" style="margin-top: 8px;">
        <label>Nome do aplicativo</label>
        <input class="glass-input" data-role="app-custom" data-index="${index}" value="${device.appCustom || ""}" placeholder="Nome do app" />
        <p class="error-text hidden" data-role="err-app-custom"></p>
      </div>
    </div>

    <div class="field">
      <label>Dispositivo</label>
      <div class="device-row">
        <button type="button" class="device-card ${device.dispositivo === "tv" ? "active" : ""}" data-role="device" data-index="${index}" data-value="tv">TV</button>
        <button type="button" class="device-card ${device.dispositivo === "mobile" ? "active" : ""}" data-role="device" data-index="${index}" data-value="mobile">Mobile</button>
      </div>
      <p class="error-text hidden" data-role="err-dispositivo"></p>
      <div class="field ${device.dispositivo === "tv" ? "" : "hidden"}" style="margin-top: 8px;">
        <label>Marca da TV</label>
        <select class="glass-input" data-role="marca" data-index="${index}">
          <option value="">Selecione a marca</option>
          ${MARCAS_TV.map((marca) => `<option value="${marca}" ${device.marca === marca ? "selected" : ""}>${marca}</option>`).join("")}
        </select>
        <p class="error-text hidden" data-role="err-marca"></p>
        <div class="field ${marcaCustomVisible ? "" : "hidden"}" style="margin-top: 8px;">
          <label>Qual marca?</label>
          <input class="glass-input" data-role="marca-custom" data-index="${index}" value="${device.marcaCustom || ""}" placeholder="Marca da TV" />
          <p class="error-text hidden" data-role="err-marca-custom"></p>
        </div>
      </div>
    </div>

    <button type="button" class="glass-btn-ghost remove-mac-btn" data-role="remove" data-index="${index}" title="Remover MAC">−</button>
  `;

  const macInput = row.querySelector('[data-role="mac"]');
  macInput.addEventListener("input", (event) => {
    const formatted = formatMacInput(event.target.value);
    state.form.devices[index].mac = formatted;
    event.target.value = formatted;
    if (state.errors.devices[index]) state.errors.devices[index].mac = "";
    renderFormErrors();
  });

  row.querySelector('[data-role="app"]').addEventListener("change", (event) => {
    state.form.devices[index].app = event.target.value;
    if (event.target.value !== "Outro") state.form.devices[index].appCustom = "";
    if (state.errors.devices[index]) {
      state.errors.devices[index].app = "";
      state.errors.devices[index].appCustom = "";
    }
    renderClientForm();
  });

  const appCustomInput = row.querySelector('[data-role="app-custom"]');
  if (appCustomInput) {
    appCustomInput.addEventListener("input", (event) => {
      state.form.devices[index].appCustom = event.target.value;
      if (state.errors.devices[index]) state.errors.devices[index].appCustom = "";
      renderFormErrors();
    });
  }

  row.querySelectorAll('[data-role="device"]').forEach((button) => {
    button.addEventListener("click", () => {
      state.form.devices[index].dispositivo = button.dataset.value;
      if (button.dataset.value !== "tv") state.form.devices[index].marca = "";
      if (state.errors.devices[index]) state.errors.devices[index].dispositivo = "";
      renderClientForm();
    });
  });

  row.querySelector('[data-role="marca"]').addEventListener("change", (event) => {
    state.form.devices[index].marca = event.target.value;
    if (event.target.value !== "Outra") state.form.devices[index].marcaCustom = "";
    if (state.errors.devices[index]) {
      state.errors.devices[index].marca = "";
      state.errors.devices[index].marcaCustom = "";
    }
    renderClientForm();
  });

  const marcaCustomInput = row.querySelector('[data-role="marca-custom"]');
  if (marcaCustomInput) {
    marcaCustomInput.addEventListener("input", (event) => {
      state.form.devices[index].marcaCustom = event.target.value;
      if (state.errors.devices[index]) state.errors.devices[index].marcaCustom = "";
      renderFormErrors();
    });
  }

  row.querySelector('[data-role="remove"]').addEventListener("click", () => {
    if (state.form.devices.length <= 1) {
      state.form.devices = [createDeviceRow()];
      state.errors.devices = [{}];
      renderClientForm();
      return;
    }

    state.form.devices.splice(index, 1);
    state.errors.devices.splice(index, 1);
    renderClientForm();
  });

  return row;
}

function renderClientForm() {
  el.fNome.value = state.form.nome;
  el.fKey.value = state.form.key;
  el.macRows.innerHTML = "";

  state.form.devices.forEach((device, index) => {
    el.macRows.appendChild(renderDeviceRow(device, index));
  });

  renderFormErrors();
  renderConfirmButton();
}

function renderConfirmButton() {
  const editMode = !!state.editId;
  const labels = editMode
    ? { idle: "Confirmar alterações", pending: "Salvando…", success: "Alterações salvas" }
    : { idle: "Confirmar cadastro", pending: "Cadastrando…", success: "Cliente cadastrado" };

  const status = state.submitStatus;
  el.confirmBtn.disabled = status !== "idle";
  el.confirmBtn.classList.remove("confirm-btn--pending", "confirm-btn--success");
  if (status === "pending") el.confirmBtn.classList.add("confirm-btn--pending");
  if (status === "success") el.confirmBtn.classList.add("confirm-btn--success");

  let icon = "";
  if (status === "pending") icon = SPINNER_SVG;
  else if (status === "success") icon = CHECK_SVG;

  const oldFace = document.getElementById("confirm-face");
  const newFace = document.createElement("span");
  newFace.className = "confirm-face";
  newFace.id = "confirm-face";
  newFace.innerHTML = `${icon}${labels[status]}`;
  oldFace.replaceWith(newFace);
}

function openNewClient() {
  state.editId = null;
  state.form = emptyForm();
  state.errors = { nome: "", key: "", devices: [{}] };
  state.submitStatus = "idle";
  el.modalTitle.textContent = "Novo cliente";
  renderClientForm();
  el.modalOverlay.classList.remove("hidden");
}

function handleEdit(client) {
  state.editId = client.id;
  state.form = {
    nome: client.nome || "",
    key: client.key || "",
    devices: (client.devices || []).map((device) => ({
      id: device.id || `device-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      mac: device.mac || "",
      app: APPS.includes(device.app) ? device.app : "Outro",
      appCustom: APPS.includes(device.app) ? "" : device.app || "",
      dispositivo: device.dispositivo || "",
      marca: device.dispositivo === "tv" && MARCAS_TV.includes(device.marca) ? device.marca : "",
      marcaCustom: device.dispositivo === "tv" && device.marca && !MARCAS_TV.includes(device.marca) ? device.marca : "",
    })),
  };

  if (state.form.devices.length === 0) state.form.devices = [createDeviceRow()];
  state.errors = { nome: "", key: "", devices: state.form.devices.map(() => ({})) };
  state.submitStatus = "idle";
  el.modalTitle.textContent = "Editar cliente";
  renderClientForm();
  el.modalOverlay.classList.remove("hidden");
}

function handleDelete(clientId) {
  const next = state.clients.filter((client) => client.id !== clientId);
  state.clients = next;
  renderClientsGrid();
  dataLayer.saveClients(next);
}

function closeModal() {
  if (state.submitStatus === "pending") return;
  el.modalOverlay.classList.add("hidden");
  state.editId = null;
  state.form = emptyForm();
  state.errors = { nome: "", key: "", devices: [{}] };
  state.submitStatus = "idle";
}

function validateClientForm() {
  const form = state.form;
  const errs = { nome: "", key: "", devices: form.devices.map(() => ({})) };

  if (!form.nome.trim()) errs.nome = "Informe o nome do cliente.";
  if (!form.key.trim()) errs.key = "Informe a key do cliente.";

  const usedMacs = new Set();
  form.devices.forEach((device, index) => {
    const issue = errs.devices[index];

    if (!device.mac.trim()) {
      issue.mac = "Informe o endereço MAC.";
    } else {
      const normalized = normalizeMac(device.mac);
      if (!normalized) {
        issue.mac = "MAC inválido. Use o formato 00:1A:2B:3C:4D:5E.";
      } else if (usedMacs.has(normalized)) {
        issue.mac = "Este MAC já foi cadastrado nesta lista.";
      } else {
        usedMacs.add(normalized);
      }
    }

    if (!device.app) issue.app = "Selecione o aplicativo.";
    else if (device.app === "Outro" && !device.appCustom.trim()) issue.appCustom = "Informe o nome do aplicativo.";

    if (!device.dispositivo) issue.dispositivo = "Selecione o dispositivo.";
    if (device.dispositivo === "tv") {
      if (!device.marca) issue.marca = "Selecione a marca da TV.";
      else if (device.marca === "Outra" && !device.marcaCustom.trim()) issue.marcaCustom = "Informe a marca da TV.";
    }

    errs.devices[index] = issue;
  });

  state.errors = errs;
  renderFormErrors();

  const hasAnyValidDevice = form.devices.some((device) => device.mac.trim() || device.app || device.dispositivo);
  const hasErrors = errs.devices.some((issue) => Object.values(issue).some(Boolean));

  return !!form.nome.trim() && !!form.key.trim() && hasAnyValidDevice && !errs.nome && !errs.key && !hasErrors;
}

async function handleClientSubmit(event) {
  event.preventDefault();
  if (state.submitStatus !== "idle") return;
  if (!validateClientForm()) return;

  const normalizedDevices = state.form.devices.map((device) => ({
    id: device.id || `device-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    mac: normalizeMac(device.mac),
    app: device.app === "Outro" ? device.appCustom.trim() : device.app,
    dispositivo: device.dispositivo,
    marca: device.dispositivo === "tv" ? (device.marca === "Outra" ? device.marcaCustom.trim() : device.marca) : "",
  }));

  const nextClient = {
    id: state.editId || `client-${Date.now()}`,
    owner: state.session.username,
    nome: state.form.nome.trim(),
    key: state.form.key.trim(),
    devices: normalizedDevices,
    criadoEm: state.editId ? (state.clients.find((client) => client.id === state.editId)?.criadoEm || new Date().toISOString()) : new Date().toISOString(),
  };

  const next = state.editId
    ? state.clients.map((client) => (client.id === state.editId ? nextClient : client))
    : [nextClient, ...state.clients];

  state.submitStatus = "pending";
  renderConfirmButton();
  state.clients = next;
  renderClientsGrid();

  await dataLayer.saveClients(next);

  state.submitStatus = "success";
  renderConfirmButton();
  setTimeout(() => {
    state.submitStatus = "idle";
    closeModal();
  }, 1000);
}

function bindEvents() {
  el.authForm.addEventListener("submit", handleAuthSubmit);
  el.authSwitchLink.addEventListener("click", toggleAuthMode);
  el.btnNewClient.addEventListener("click", openNewClient);
  el.btnLogout.addEventListener("click", handleLogout);
  el.btnCloseModal.addEventListener("click", closeModal);
  el.modalOverlay.addEventListener("click", (event) => {
    if (event.target === el.modalOverlay) closeModal();
  });
  el.modalCard.addEventListener("click", (event) => event.stopPropagation());

  el.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value;
    renderClientsGrid();
  });

  el.clientForm.addEventListener("submit", handleClientSubmit);

  el.fNome.addEventListener("input", (event) => {
    state.form.nome = event.target.value;
    state.errors.nome = "";
    renderFormErrors();
  });

  el.fKey.addEventListener("input", (event) => {
    state.form.key = event.target.value;
    state.errors.key = "";
    renderFormErrors();
  });

  el.btnAddMac.addEventListener("click", () => {
    state.form.devices.push(createDeviceRow());
    state.errors.devices.push({});
    renderClientForm();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  cacheRefs();
  state.errors = { nome: "", key: "", devices: [{}] };
  bindEvents();
  boot();
});
