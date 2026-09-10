import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { randomUUID } from "node:crypto";

const app = express();
const prisma = new PrismaClient();
const port = Number(process.env.PORT || 3333);
const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error("JWT_SECRET deve existir e ter pelo menos 32 caracteres.");
}

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5500")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());
app.use((req, res, next) => {
  const requestId = req.get("x-request-id") || randomUUID();
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  const startedAt = Date.now();
  res.on("finish", () => {
    console.log(JSON.stringify({
      event: "http_request",
      requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
    }));
  });
  next();
});
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origem não autorizada pelo CORS."));
  },
  credentials: true,
}));
app.use(express.json({ limit: "100kb" }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: "draft-8", legacyHeaders: false }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Muitas tentativas. Aguarde alguns minutos." },
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Muitas tentativas de renovação. Aguarde alguns minutos." },
});

app.get("/", (_req, res) => {
  res.json({
    name: "StarTV API",
    status: "online",
    health: "/health",
    documentation: "Consulte backend/README.md para as rotas disponíveis.",
  });
});

const deviceSchema = z.object({
  mac: z.string().min(1),
  app: z.string().trim().min(1).max(100),
  type: z.enum(["tv", "mobile"]),
  brand: z.string().trim().max(80).optional().default(""),
});

const clientSchema = z.object({
  name: z.string().trim().min(2).max(120),
  key: z.string().trim().min(1).max(255),
  devices: z.array(deviceSchema).min(1).max(100),
});

const authSchema = z.object({
  username: z.string().trim().min(3).max(60),
  password: z.string().min(8).max(200),
  email: z.string().email().optional(),
});

const refreshSchema = z.object({ refreshToken: z.string().min(40).max(200) });

function normalizeMac(raw) {
  const digits = raw.replace(/[^0-9a-f]/gi, "").toUpperCase();
  if (digits.length !== 12) return null;
  return digits.match(/.{2}/g).join(":");
}

function normalizeDevices(devices) {
  const normalized = devices.map((device) => {
    const mac = normalizeMac(device.mac);
    if (!mac) throw new Error("MAC_INVALID");
    if (device.type === "tv" && !device.brand.trim()) throw new Error("BRAND_REQUIRED");
    return {
      mac,
      app: device.app.trim(),
      type: device.type,
      brand: device.type === "tv" ? device.brand.trim() : "",
    };
  });

  const macs = normalized.map((device) => device.mac);
  if (new Set(macs).size !== macs.length) throw new Error("MAC_DUPLICATE");
  return normalized;
}

function createAccessToken(user) {
  return jwt.sign({ sub: user.id, username: user.username }, jwtSecret, { expiresIn: "15m" });
}

function hashRefreshToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

async function createSession(user) {
  const refreshToken = randomBytes(48).toString("base64url");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash: hashRefreshToken(refreshToken), expiresAt },
  });
  return { accessToken: createAccessToken(user), refreshToken, expiresAt };
}

function sessionResponse(user, session) {
  return {
    user: formatUser(user),
    token: session.accessToken,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    refreshTokenExpiresAt: session.expiresAt,
  };
}

function authRequired(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Autenticação necessária." });

  try {
    req.auth = jwt.verify(token, jwtSecret);
    return next();
  } catch {
    return res.status(401).json({ error: "Token inválido ou expirado." });
  }
}

function formatUser(user) {
  return { id: user.id, username: user.username, email: user.email, createdAt: user.createdAt };
}

function formatClient(client) {
  return {
    id: client.id,
    name: client.name,
    key: client.key,
    devices: client.devices,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
  };
}

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ status: "ok", database: "ok" });
  } catch {
    return res.status(503).json({ status: "degraded", database: "unavailable" });
  }
});

app.post("/api/auth/register", authLimiter, async (req, res, next) => {
  try {
    const input = authSchema.parse(req.body);
    const username = input.username.toLowerCase();
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await prisma.user.create({ data: { username, email: input.email?.toLowerCase(), passwordHash } });
    const session = await createSession(user);
    return res.status(201).json(sessionResponse(user, session));
  } catch (error) {
    if (error?.code === "P2002") return res.status(409).json({ error: "Usuário ou e-mail já cadastrado." });
    return next(error);
  }
});

app.post("/api/auth/login", authLimiter, async (req, res, next) => {
  try {
    const input = authSchema.pick({ username: true, password: true }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { username: input.username.toLowerCase() } });
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      return res.status(401).json({ error: "Usuário ou senha inválidos." });
    }
    const session = await createSession(user);
    return res.json(sessionResponse(user, session));
  } catch (error) {
    return next(error);
  }
});

app.post("/api/auth/refresh", refreshLimiter, async (req, res, next) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const tokenHash = hashRefreshToken(refreshToken);
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });

    if (!stored || stored.revokedAt || stored.expiresAt <= new Date()) {
      return res.status(401).json({ error: "Refresh token inválido ou expirado." });
    }

    const session = await prisma.$transaction(async (transaction) => {
      await transaction.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
      const nextRefreshToken = randomBytes(48).toString("base64url");
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await transaction.refreshToken.create({ data: { userId: stored.userId, tokenHash: hashRefreshToken(nextRefreshToken), expiresAt } });
      return { accessToken: createAccessToken(stored.user), refreshToken: nextRefreshToken, expiresAt };
    });

    return res.json(sessionResponse(stored.user, session));
  } catch (error) {
    return next(error);
  }
});

app.post("/api/auth/logout", refreshLimiter, async (req, res, next) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    await prisma.refreshToken.updateMany({ where: { tokenHash: hashRefreshToken(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

app.get("/api/me", authRequired, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.auth.sub } });
    if (!user) return res.status(401).json({ error: "Usuário não encontrado." });
    return res.json({ user: formatUser(user) });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/clients", authRequired, async (req, res, next) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page || "1", 10), 1);
    const pageSize = Math.min(Math.max(Number.parseInt(req.query.pageSize || "20", 10), 1), 100);
    const search = String(req.query.search || "").trim();
    const where = {
      ownerId: req.auth.sub,
      ...(search ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { key: { contains: search, mode: "insensitive" } },
          { devices: { some: { mac: { contains: search, mode: "insensitive" } } } },
        ],
      } : {}),
    };
    const [total, clients] = await prisma.$transaction([
      prisma.client.count({ where }),
      prisma.client.findMany({ where, include: { devices: true }, orderBy: { updatedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    ]);
    return res.json({ data: clients.map(formatClient), pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) } });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/clients", authRequired, async (req, res, next) => {
  try {
    const input = clientSchema.parse(req.body);
    const devices = normalizeDevices(input.devices);
    const client = await prisma.client.create({ data: { ownerId: req.auth.sub, name: input.name, key: input.key, devices: { create: devices } }, include: { devices: true } });
    return res.status(201).json({ data: formatClient(client) });
  } catch (error) {
    if (error.message === "MAC_INVALID") return res.status(400).json({ error: "Um ou mais MACs são inválidos." });
    if (error.message === "MAC_DUPLICATE") return res.status(400).json({ error: "Não é permitido repetir MACs no mesmo cliente." });
    if (error.message === "BRAND_REQUIRED") return res.status(400).json({ error: "A marca é obrigatória para TVs." });
    if (error?.code === "P2002") return res.status(409).json({ error: "Esse MAC já está cadastrado neste cliente." });
    return next(error);
  }
});

app.get("/api/clients/:id", authRequired, async (req, res, next) => {
  try {
    const client = await prisma.client.findFirst({ where: { id: req.params.id, ownerId: req.auth.sub }, include: { devices: true } });
    if (!client) return res.status(404).json({ error: "Cliente não encontrado." });
    return res.json({ data: formatClient(client) });
  } catch (error) {
    return next(error);
  }
});

app.patch("/api/clients/:id", authRequired, async (req, res, next) => {
  try {
    const input = clientSchema.parse(req.body);
    const devices = normalizeDevices(input.devices);
    const existing = await prisma.client.findFirst({ where: { id: req.params.id, ownerId: req.auth.sub } });
    if (!existing) return res.status(404).json({ error: "Cliente não encontrado." });
    const client = await prisma.$transaction(async (transaction) => {
      await transaction.device.deleteMany({ where: { clientId: existing.id } });
      return transaction.client.update({ where: { id: existing.id }, data: { name: input.name, key: input.key, devices: { create: devices } }, include: { devices: true } });
    });
    return res.json({ data: formatClient(client) });
  } catch (error) {
    if (error.message === "MAC_INVALID") return res.status(400).json({ error: "Um ou mais MACs são inválidos." });
    if (error.message === "MAC_DUPLICATE") return res.status(400).json({ error: "Não é permitido repetir MACs no mesmo cliente." });
    if (error.message === "BRAND_REQUIRED") return res.status(400).json({ error: "A marca é obrigatória para TVs." });
    return next(error);
  }
});

app.patch("/api/clients/:clientId/devices/:deviceId", authRequired, async (req, res, next) => {
  try {
    const input = deviceSchema.parse(req.body);
    const devices = normalizeDevices([input]);
    const existing = await prisma.device.findFirst({
      where: {
        id: req.params.deviceId,
        clientId: req.params.clientId,
        client: { ownerId: req.auth.sub },
      },
    });
    if (!existing) return res.status(404).json({ error: "Dispositivo não encontrado." });

    const device = await prisma.device.update({ where: { id: existing.id }, data: devices[0] });
    return res.json({ data: device });
  } catch (error) {
    if (error.message === "MAC_INVALID") return res.status(400).json({ error: "O MAC informado é inválido." });
    if (error.message === "BRAND_REQUIRED") return res.status(400).json({ error: "A marca é obrigatória para TVs." });
    if (error?.code === "P2002") return res.status(409).json({ error: "Esse MAC já está cadastrado neste cliente." });
    return next(error);
  }
});

app.delete("/api/clients/:clientId/devices/:deviceId", authRequired, async (req, res, next) => {
  try {
    const client = await prisma.client.findFirst({
      where: { id: req.params.clientId, ownerId: req.auth.sub },
      include: { _count: { select: { devices: true } } },
    });
    if (!client) return res.status(404).json({ error: "Cliente não encontrado." });
    if (client._count.devices <= 1) return res.status(400).json({ error: "O cliente precisa manter pelo menos um dispositivo." });

    const result = await prisma.device.deleteMany({ where: { id: req.params.deviceId, clientId: client.id } });
    if (!result.count) return res.status(404).json({ error: "Dispositivo não encontrado." });
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

app.delete("/api/clients/:id", authRequired, async (req, res, next) => {
  try {
    const result = await prisma.client.deleteMany({ where: { id: req.params.id, ownerId: req.auth.sub } });
    if (!result.count) return res.status(404).json({ error: "Cliente não encontrado." });
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

app.use((error, req, res, _next) => {
  const requestId = req.requestId || randomUUID();
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: "Dados inválidos.", details: error.issues, requestId });
  }
  console.error(JSON.stringify({ event: "http_error", requestId, method: req.method, path: req.originalUrl, message: error.message, stack: process.env.NODE_ENV === "production" ? undefined : error.stack }));
  return res.status(500).json({ error: "Erro interno do servidor.", requestId });
});

export { app, prisma };

const isMainModule = process.argv[1] && import.meta.url === new URL(process.argv[1], "file://").href;
const server = isMainModule ? app.listen(port, () => console.log(JSON.stringify({ event: "server_started", port }))) : null;

async function shutdown(signal) {
  console.log(`${signal}: encerrando API...`);
  const closeServer = server ? new Promise((resolve) => server.close(resolve)) : Promise.resolve();
  closeServer.then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
