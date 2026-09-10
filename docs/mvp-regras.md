# StarTV - Escopo e regras do MVP

## Objetivo

Transformar o painel atual em um sistema multiusuário para gerenciamento de clientes StarTV, mantendo o fluxo existente de login, busca e cadastro de dispositivos.

O MVP deve permitir que cada usuário autenticado gerencie seus próprios clientes e os dispositivos vinculados a eles.

## Escopo incluído

- Cadastro e login de usuários.
- Autenticação com senha armazenada com hash no backend.
- Cadastro, edição e exclusão de clientes.
- Cadastro de um ou mais dispositivos para cada cliente.
- Formatação e validação de endereço MAC.
- Associação de aplicativo, tipo de dispositivo e marca da TV.
- Busca por nome, key, MAC, aplicativo, tipo ou marca.
- Separação dos dados por usuário autenticado.
- Feedback visual de carregamento, sucesso e erro.

## Fora do MVP

- Login social ou OAuth.
- Aplicativo mobile nativo.
- Cobranças e assinaturas.
- Integração automática com provedores IPTV.
- Relatórios financeiros.
- Compartilhamento de clientes entre usuários.
- Exclusão definitiva sem confirmação ou auditoria.

## Entidades

### Usuário

| Campo | Regra |
| --- | --- |
| `id` | Identificador único gerado pelo backend. |
| `username` | Obrigatório e único, ignorando maiúsculas e minúsculas. |
| `email` | Opcional no primeiro MVP; deve ser único quando utilizado. |
| `passwordHash` | Nunca expor pela API. Armazenar somente hash seguro. |
| `createdAt` | Preenchido pelo backend. |
| `updatedAt` | Atualizado pelo backend. |

### Cliente

| Campo | Regra |
| --- | --- |
| `id` | Identificador único gerado pelo backend. |
| `ownerId` | Usuário proprietário, obrigatório e imutável. |
| `name` | Obrigatório, com tamanho entre 2 e 120 caracteres. |
| `key` | Obrigatória para o MVP. O valor deve ser tratado como texto. |
| `createdAt` | Preenchido pelo backend. |
| `updatedAt` | Atualizado pelo backend. |

### Dispositivo

| Campo | Regra |
| --- | --- |
| `id` | Identificador único gerado pelo backend. |
| `clientId` | Cliente ao qual pertence, obrigatório. |
| `mac` | Obrigatório, normalizado para `00:1A:2B:3C:4D:5E`. |
| `app` | Obrigatório. Usar a lista oficial ou um nome personalizado. |
| `type` | Obrigatório: `tv` ou `mobile`. |
| `brand` | Obrigatória quando `type` for `tv`; vazia para `mobile`. |
| `createdAt` | Preenchido pelo backend. |
| `updatedAt` | Atualizado pelo backend. |

## Regras de negócio

1. Um usuário só pode visualizar, pesquisar, editar e excluir os próprios clientes.
2. Um cliente deve pertencer a exatamente um usuário.
3. Um cliente deve possuir pelo menos um dispositivo válido.
4. O mesmo MAC não pode aparecer em dois dispositivos do mesmo usuário.
5. A comparação de MAC deve ignorar separadores e diferença entre maiúsculas e minúsculas.
6. O MAC deve ser salvo sempre em letras maiúsculas com dois-pontos.
7. Um cliente pode possuir vários dispositivos.
8. Um dispositivo `tv` exige uma marca.
9. Um dispositivo `mobile` não deve armazenar marca de TV.
10. Quando o aplicativo for `Outro`, o nome personalizado será obrigatório.
11. Quando a marca for `Outra`, o nome personalizado será obrigatório.
12. A exclusão de um cliente deve excluir também os seus dispositivos.
13. Nenhuma rota de cliente deve aceitar `ownerId` vindo do frontend como fonte de autorização.
14. A autorização deve usar o usuário autenticado no token ou na sessão do backend.
15. O backend deve validar novamente todos os dados recebidos, mesmo que o frontend já valide.

## Aplicativos oficiais

- IBO Player
- IBO Pro
- IVO Player
- Smarters Player Lite
- XCIPTV
- VU Player Pro
- Duplex Play
- 9Xtream
- Flix IPTV
- Outro

## Marcas oficiais de TV

- Samsung
- LG
- TCL
- Philco
- AOC
- Multilaser
- Philips
- Sony
- Roku TV
- Outra

## Permissões do MVP

### Usuário autenticado

- Criar cliente.
- Visualizar seus clientes.
- Pesquisar seus clientes.
- Editar seus clientes.
- Excluir seus clientes.
- Adicionar, editar e remover dispositivos dos próprios clientes.

### Usuário não autenticado

- Criar conta.
- Entrar.
- Sair.
- Não acessar dados de clientes.

### Administrador

O papel administrativo será implementado depois do MVP. A existência da conta temporária `admin/admin` pertence apenas ao protótipo atual e não deve ser levada para produção.

## Contratos esperados da API

A API deverá oferecer, no mínimo:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /me`
- `GET /clients`
- `POST /clients`
- `GET /clients/:id`
- `PATCH /clients/:id`
- `DELETE /clients/:id`

A listagem de clientes deve aceitar busca, paginação e ordenação no servidor.

Exemplo de criação:

```json
{
  "name": "João Pereira",
  "key": "ABC123",
  "devices": [
    {
      "mac": "00:1A:2B:3C:4D:5E",
      "app": "IBO Pro",
      "type": "tv",
      "brand": "Samsung"
    }
  ]
}
```

## Critérios de aceite

- Um usuário consegue criar uma conta e entrar com segurança.
- Usuários diferentes não conseguem enxergar os clientes uns dos outros.
- É possível cadastrar um cliente com vários dispositivos.
- MACs são formatados e rejeitados quando inválidos.
- MAC duplicado é rejeitado para o mesmo usuário.
- O cliente pode ser editado sem perder dispositivos existentes.
- A busca encontra cliente por nome, key ou dados do dispositivo.
- O backend rejeita dados inválidos independentemente do frontend.
- A API possui testes para autenticação, autorização e CRUD de clientes.
- A aplicação não depende de `localStorage` para dados permanentes.

## Próxima etapa

Com estas regras aprovadas, a próxima etapa técnica é criar o backend, o schema do PostgreSQL e as migrações. O frontend React só deve ser conectado depois que os contratos da API estiverem definidos e testáveis.
