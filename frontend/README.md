# StarTV Web

Frontend React + Vite do StarTV.

## Executar

```powershell
npm install
npm run dev -- --host 127.0.0.1
```

Acesse `http://127.0.0.1:5173` com a API executando em `http://localhost:3333`.

## Migração do protótipo

Depois de entrar, o dashboard mostra o painel de migração quando encontra `startv:clients` no `localStorage` da mesma origem. A migração:

- converte clientes antigos de MAC único ou múltiplos dispositivos;
- normaliza MACs para letras maiúsculas e dois-pontos;
- envia clientes válidos para a API;
- ignora registros já migrados usando `key + MACs`;
- valida nome, key, quantidade e MACs retornados;
- mantém o `localStorage` original como backup;
- mostra quantidades migradas, ignoradas e com falha.

O navegador separa `localStorage` por origem. Portanto, dados salvos em `http://localhost:5500` não são acessíveis automaticamente em `http://127.0.0.1:5173`. Para migrar diretamente, abra o novo frontend no mesmo host/porta onde os dados antigos foram salvos ou exporte o JSON antes da troca de origem.
