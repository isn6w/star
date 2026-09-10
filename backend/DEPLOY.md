# Deploy de produção

## Vercel + Render

O frontend React fica na Vercel. A API e o PostgreSQL ficam no Render. O arquivo `../render.yaml` pode criar a API e o banco como Blueprint.

### Render

1. No painel do Render, escolha **New > Blueprint**.
2. Conecte o repositório e selecione `render.yaml`.
3. Confirme o serviço `startv-api` e o banco `startv-db`.
4. Preencha `CORS_ORIGIN` com o domínio da Vercel depois que ele for criado.
5. Aguarde o health check em `/health` ficar verde.

O Render usa o `backend/Dockerfile`. A variável `DATABASE_URL` é preenchida pelo banco do Blueprint, e `JWT_SECRET` é gerada pelo Render.

### Vercel

1. No painel da Vercel, escolha **Add New > Project**.
2. Conecte o mesmo repositório.
3. Em **Root Directory**, escolha `frontend`.
4. Use `npm run build` como build command e `dist` como output.
5. Adicione `VITE_API_URL` apontando para a API do Render com `/api` no final.
6. Publique o projeto.
7. Copie o domínio final da Vercel para `CORS_ORIGIN` no Render e faça um novo deploy.

Exemplo:

```text
VITE_API_URL=https://startv-api.onrender.com/api
CORS_ORIGIN=https://startv.vercel.app
```

O arquivo `frontend/vercel.json` já contém o fallback do React para `index.html`.

## Pré-requisitos

- Docker com Compose v2.
- Um PostgreSQL persistente ou o serviço `postgres` do compose.
- Domínio HTTPS para o frontend.
- Segredos fortes fora do Git.

## Deploy com Docker Compose

1. Copie `.env.production.example` para `.env`.
2. Troque `POSTGRES_PASSWORD`, `JWT_SECRET` e `CORS_ORIGIN`.
3. Gere uma chave JWT com pelo menos 32 caracteres aleatórios.
4. Suba os serviços:

```powershell
docker compose --env-file .env -f docker-compose.prod.yml up -d --build
```

5. Aplique as migrações usando uma imagem temporária da API:

```powershell
docker compose -f docker-compose.prod.yml run --rm api npx prisma migrate deploy
```

6. Verifique:

```powershell
Invoke-RestMethod http://localhost:3333/health
```

O resultado esperado contém `status: ok` e `database: ok`.

## Backup e restauração

Execute backup diariamente e armazene o arquivo fora da máquina do banco:

```powershell
.\scripts\backup.ps1
```

Para restaurar, pare a API, confirme o arquivo e execute:

```powershell
.\scripts\restore.ps1 -File .\backups\startv-20260910-120000.sql
```

Teste restaurações periodicamente. Backup que nunca foi restaurado não é uma garantia.

## Frontend

O frontend React deve ser publicado em um host estático, como Vercel, Netlify ou Nginx. Configure `VITE_API_URL` para a URL pública da API e configure a mesma URL em `CORS_ORIGIN` no backend.

```powershell
npm run build
```

Publique a pasta `frontend/dist`.

## Checklist antes de liberar

- `NODE_ENV=production` configurado.
- `JWT_SECRET` forte e exclusivo.
- HTTPS ativo.
- CORS limitado ao domínio do frontend.
- PostgreSQL com volume persistente.
- Migração executada com `prisma migrate deploy`.
- Backup automático configurado.
- Endpoint `/health` monitorado.
- Logs enviados para um agregador e sem senhas/tokens.
- Testes automatizados passando com `npm test`.
