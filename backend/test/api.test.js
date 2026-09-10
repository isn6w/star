import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { app, prisma } from "../src/server.js";

const api = request(app);
let user;
let token;
let clientId;
let deviceIds;

function uniqueUser() {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    username: `teste${suffix}`,
    email: `teste${suffix}@example.com`,
    password: "TesteSeguro2026!",
  };
}

before(async () => {
  user = uniqueUser();
  const response = await api.post("/api/auth/register").send(user);
  assert.equal(response.status, 201);
  assert.ok(response.body.accessToken);
  assert.ok(response.body.refreshToken);
  token = response.body.accessToken;
});

after(async () => {
  if (user?.username) {
    await prisma.user.deleteMany({ where: { username: user.username } });
  }
  await prisma.$disconnect();
});

test("health check confirma o serviço", async () => {
  const response = await api.get("/health");
  assert.equal(response.status, 200);
  assert.equal(response.body.status, "ok");
  assert.ok(response.headers["x-request-id"]);
});

test("login retorna nova sessão com bcrypt e JWT", async () => {
  const response = await api.post("/api/auth/login").send({ username: user.username, password: user.password });
  assert.equal(response.status, 200);
  assert.ok(response.body.accessToken);
  assert.ok(response.body.refreshToken);
});

test("validação rejeita cliente sem dispositivos válidos", async () => {
  const response = await api.post("/api/clients").set("Authorization", `Bearer ${token}`).send({ name: "Inválido", key: "KEY", devices: [] });
  assert.equal(response.status, 400);
  assert.equal(response.body.error, "Dados inválidos.");
  assert.ok(response.body.requestId);
});

test("CRUD cria cliente com múltiplos dispositivos", async () => {
  const response = await api.post("/api/clients").set("Authorization", `Bearer ${token}`).send({
    name: "Cliente Teste",
    key: "KEY-TESTE",
    devices: [
      { mac: "001A2B3C4D80", app: "IBO Pro", type: "tv", brand: "Samsung" },
      { mac: "00:1A:2B:3C:4D:81", app: "XCIPTV", type: "mobile", brand: "" },
    ],
  });
  assert.equal(response.status, 201);
  assert.equal(response.body.data.devices.length, 2);
  assert.equal(response.body.data.devices[0].mac, "00:1A:2B:3C:4D:80");
  clientId = response.body.data.id;
  deviceIds = response.body.data.devices.map((device) => device.id);
});

test("busca e pagina clientes", async () => {
  const response = await api.get("/api/clients?page=1&pageSize=1&search=KEY-TESTE").set("Authorization", `Bearer ${token}`);
  assert.equal(response.status, 200);
  assert.equal(response.body.pagination.total, 1);
  assert.equal(response.body.pagination.pageSize, 1);
  assert.equal(response.body.data[0].id, clientId);
});

test("edita e remove dispositivo individual", async () => {
  const updated = await api.patch(`/api/clients/${clientId}/devices/${deviceIds[0]}`).set("Authorization", `Bearer ${token}`).send({ mac: "001A2B3C4D82", app: "IBO Player", type: "tv", brand: "LG" });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.mac, "00:1A:2B:3C:4D:82");

  const removed = await api.delete(`/api/clients/${clientId}/devices/${deviceIds[1]}`).set("Authorization", `Bearer ${token}`);
  assert.equal(removed.status, 204);
});

test("protege rotas e impede remoção do último dispositivo", async () => {
  const unauthorized = await api.get("/api/clients");
  assert.equal(unauthorized.status, 401);

  const lastDevice = await api.delete(`/api/clients/${clientId}/devices/${deviceIds[0]}`).set("Authorization", `Bearer ${token}`);
  assert.equal(lastDevice.status, 400);
  assert.match(lastDevice.body.error, /pelo menos um dispositivo/);

  const removedClient = await api.delete(`/api/clients/${clientId}`).set("Authorization", `Bearer ${token}`);
  assert.equal(removedClient.status, 204);
});
