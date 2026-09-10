# StarTV API

Backend inicial do StarTV com Express, Prisma e PostgreSQL.

## Requisitos

- Node.js 20+
- Docker Desktop, para executar o PostgreSQL localmente

## Configuração

```powershell
cd backend
Copy-Item .env.example .env
npm install
docker compose up -d
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

A API ficará disponível em `http://localhost:3333`.

Ao abrir `http://localhost:3333/`, a API retorna um resumo do serviço. Para verificar o banco, use `http://localhost:3333/health`.

## Rotas principais

- `GET /health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/me`
- `GET /api/clients`
- `POST /api/clients`
- `GET /api/clients/:id`
- `PATCH /api/clients/:id`
- `DELETE /api/clients/:id`
- `PATCH /api/clients/:clientId/devices/:deviceId`
- `DELETE /api/clients/:clientId/devices/:deviceId`

As rotas protegidas usam `Authorization: Bearer <token>`.

## Segurança

- Senhas com bcrypt.
- Access token JWT com expiração curta de 15 minutos.
- Refresh token aleatório, armazenado somente como hash no PostgreSQL, com validade de 30 dias.
- Rotação do refresh token a cada renovação e revogação no logout.
- Validação de payload com Zod.
- Helmet, CORS e rate limiting.
- Isolamento dos clientes pelo usuário autenticado.
- PostgreSQL com relação em cascata para dispositivos.
