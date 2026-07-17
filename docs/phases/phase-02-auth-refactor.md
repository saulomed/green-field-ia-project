# Fase 02 (Ajuste) — Fronteiras de domínio de Users e Channels

## Objetivo

Corrigir as fronteiras de módulo da Fase 02 entregue: dar ao `ChannelsModule` controle real sobre o canal (repositório próprio, criação e nickname), criar o `UsersService` como dono da persistência de `User`, e fazer o `AuthService` orquestrar em vez de acessar o banco diretamente — sem alterar nenhum comportamento externo da API.

---

## Contexto do ajuste

A revisão da implementação da Fase 02 encontrou quatro desvios entre o desenho pretendido e o código entregue. Nenhum deles é um bug de comportamento — a API responde corretamente hoje — mas todos comprometem a fronteira dos módulos e o princípio de Responsabilidade Única declarado no `CLAUDE.md`.

| # | Achado | Evidência |
|---|--------|-----------|
| A-1 | `ChannelsModule` declara um repositório que nunca usa. `ChannelService` não injeta `@InjectRepository(Channel)`; todo acesso ao banco depende de um `EntityManager` fornecido pelo chamador. O módulo não tem caminho autônomo de leitura/escrita. | `channels.module.ts:13`, `channel.service.ts:29` |
| A-2 | `ChannelsModule` e `UsersModule` vazam seus repositórios via `exports: [TypeOrmModule]`. `AuthModule` importa ambos e poderia injetar `Repository<Channel>`/`Repository<User>`, contornando os serviços. | `channels.module.ts:15`, `users.module.ts:13` |
| A-3 | `UsersModule` é uma casca vazia — não existe `UsersService`. Toda a persistência de `User` (`exists`, `create`, `save`, `findOne`, `update`) vive no `AuthService` via `dataSource.manager`. O domínio de usuários não tem dono. | `auth.service.ts:66-88`, `:113-128`, `:265` |
| A-4 | `AuthService` lê dados de canal diretamente com `relations: { channel: true }` em vez de pedir ao `ChannelService`. | `auth.service.ts:136-140`, `:243-247` |

**O que não é problema:** a passagem de `EntityManager` para manter `User` + `Channel` atômicos é o padrão correto do TypeORM e permanece. A documentação do TypeORM é explícita: dentro de uma transação é **obrigatório** resolver o repositório a partir do manager da transação (`manager.getRepository(Channel)`) — o repositório global injetado não participa dela. O ajuste preserva esse contrato.

**Decisões do usuário que guiam este plano:**

- **DT-A:** Criar `UsersService` como dono da persistência de `User`; `AuthService` delega.
- **DT-B:** Padrão híbrido de transação — `createForUser(user, manager?)` resolve o repositório do manager quando recebe um, e usa o repositório injetado quando não recebe.

**Restrição transversal:** este é um refactor sem mudança de comportamento. Contratos de API, códigos do Catálogo de Erros, schema do banco e migrations permanecem exatamente como estão. As 8 suítes e2e existentes são a rede de segurança e devem passar **sem edição** — qualquer necessidade de alterá-las indica que o comportamento mudou e o refactor saiu do escopo.

---

## Implementações de Etapa

### IE-02.17 — ChannelService com repositório próprio e módulo encapsulado

**Descrição:** Dar ao `ChannelsModule` controle autônomo sobre o canal — repositório injetado, criação transacional híbrida e leitura própria — e fechar o vazamento do repositório para outros módulos.

**Ações técnicas:**

- Injetar `@InjectRepository(Channel)` no `ChannelService` (construtor, `private readonly`), mantendo `TypeOrmModule.forFeature([Channel])` no módulo — que passa a ter uso real.
- Alterar `createForUser(user, manager?)` para manager opcional: quando recebido, resolver o repositório via `manager.getRepository(Channel)` (obrigatório para participar da transação do chamador); quando ausente, usar o repositório injetado. Aplicar a mesma resolução em `resolveNickname`/`nicknameExists`.
- Adicionar `findByUserId(userId)` ao `ChannelService`, retornando o `Channel` do usuário (ou `null`), para que outros módulos obtenham dados de canal sem carregar a relação por conta própria.
- Trocar `exports: [TypeOrmModule, ChannelService]` por `exports: [ChannelService]` em `channels.module.ts`, encerrando o acesso externo ao `Repository<Channel>`.
- Manter `normalizePrefix`, `resolveNickname` e `randomSuffix` como responsabilidade exclusiva do `ChannelService` — nenhum outro módulo deriva ou valida nickname.

**Testes:**

| Arquivo | Camada | Verifica |
|---------|--------|----------|
| src/channels/channel.service.spec.ts | Unitário | `createForUser` sem manager usa o repositório injetado; com manager resolve via `getRepository`; normalização do prefixo e sufixo em colisão preservados; `findByUserId` retorna o canal ou `null` |

**Dependências:** Nenhuma

**Critérios de aceitação:**

- Criar um canal sem passar `EntityManager` persiste a linha em `channels` — o `ChannelService` opera de forma autônoma, sem depender de transação do chamador.
- Criar um canal passando o `EntityManager` de uma transação em curso participa dessa transação — um rollback do chamador não deixa canal órfão.
- Para `john.doe@gmail.com` sem colisão, o canal é criado com nickname `johndoe`; havendo colisão, recebe sufixo aleatório curto e a unicidade é preservada (comportamento inalterado).
- `findByUserId` retorna o canal do usuário informado e `null` quando o usuário não tem canal.
- Um módulo que importe `ChannelsModule` e tente injetar `Repository<Channel>` falha no boot da aplicação — o repositório deixou de ser exportado.

---

### IE-02.18 — UsersService como dono da persistência de User

**Descrição:** Criar o serviço que passa a concentrar todo acesso à tabela `users`, com o mesmo padrão híbrido de transação, e encapsular o repositório dentro do `UsersModule`.

**Ações técnicas:**

- Criar `UsersService` (`src/users/users.service.ts`) injetando `@InjectRepository(User)`, expondo: `existsByEmail(email, manager?)`, `create({ email, passwordHash }, manager?)`, `findByEmail(email)`, `findById(id)`, `markConfirmed(userId)` e `updatePassword(userId, passwordHash)`.
- Aplicar o padrão híbrido de DT-B em `existsByEmail` e `create` (os únicos usados dentro da transação de `register`): resolver o repositório via `manager.getRepository(User)` quando um manager for recebido, senão usar o injetado.
- Registrar `UsersService` em `providers` e trocar `exports: [TypeOrmModule]` por `exports: [UsersService]` em `users.module.ts`, encerrando o acesso externo ao `Repository<User>`.
- Manter a entidade `User` com a relação `@OneToOne` para `Channel` inalterada — a relação é bidirecional no schema e não muda; o que muda é quem a consulta (ver IE-02.19).
- Não expor `passwordHash` em nenhum retorno agregado novo — os métodos retornam a entidade `User` como hoje, e a serialização de resposta segue sendo responsabilidade dos DTOs do `AuthModule`.

**Testes:**

| Arquivo | Camada | Verifica |
|---------|--------|----------|
| src/users/users.service.spec.ts | Unitário | `existsByEmail`/`create` usam o repositório injetado sem manager e `getRepository` com manager; `findByEmail`/`findById` retornam usuário ou `null`; `markConfirmed` e `updatePassword` persistem a alteração |

**Dependências:** Nenhuma

**Critérios de aceitação:**

- `create` sem `EntityManager` persiste a linha em `users`; com `EntityManager` de uma transação em curso, participa dela — rollback do chamador não deixa usuário persistido.
- `existsByEmail` retorna `true` para e-mail cadastrado e `false` para desconhecido.
- `findByEmail` e `findById` retornam `null` para e-mail/id inexistente, sem lançar exceção.
- `markConfirmed(userId)` faz o usuário passar a `is_confirmed = true`; `updatePassword(userId, hash)` grava o novo hash.
- Um módulo que importe `UsersModule` e tente injetar `Repository<User>` falha no boot da aplicação — o repositório deixou de ser exportado.

---

### IE-02.19 — AuthService delega persistência a UsersService e ChannelService

**Descrição:** Remover todo acesso direto ao banco do `AuthService`, que passa a orquestrar os serviços de domínio, mantendo a transação de cadastro e o comportamento externo idênticos.

**Ações técnicas:**

- Substituir em `register` as chamadas `manager.exists/create/save(User, ...)` por `usersService.existsByEmail(..., manager)` e `usersService.create(..., manager)`, preservando a transação `dataSource.transaction` e repassando o mesmo `manager` a `usersService.create` e `channelService.createForUser`.
- Substituir os acessos diretos de `confirmAccount`, `refresh` e `resetPassword` (`findOneBy`, `findOneByOrFail`, `update`) pelos métodos equivalentes do `UsersService` (`findById`, `markConfirmed`, `updatePassword`).
- Substituir em `resendConfirmation`, `validateCredentials` e `forgotPassword` o carregamento de `relations: { channel: true }` por `usersService.findByEmail` + `channelService.findByUserId`, eliminando o acesso do auth a colunas de canal.
- Ajustar `login` para obter o nickname via `channelService.findByUserId(user.id)` em vez de `user.channel.nickname`, e a `LocalStrategy`/`validateCredentials` para não depender mais da relação carregada.
- Manter `@InjectDataSource` no `AuthService` **exclusivamente** para abrir a transação de `register` (fronteira transacional que cruza os dois domínios); nenhuma outra operação pode usar `dataSource.manager`.

**Testes:**

| Arquivo | Camada | Verifica |
|---------|--------|----------|
| src/auth/auth.service.spec.ts | Unitário | Mocks de `UsersService`/`ChannelService` no lugar dos mocks de `EntityManager`; registro atômico repassa o mesmo manager aos dois serviços; e-mail duplicado rejeitado; senha hasheada; confirmação/reset/refresh delegam ao `UsersService` |

**Dependências:** IE-02.17, IE-02.18

**Critérios de aceitação:**

- `POST /auth/register` com e-mail e senha válidos retorna 201 com `{ id, email, channel: { nickname } }` e o cadastro segue atômico — se a criação do canal falhar, nenhuma linha de usuário é persistida.
- `POST /auth/register` com e-mail já cadastrado retorna 409 com `EMAIL_JA_EXISTE`.
- `POST /auth/login` com credenciais válidas de conta confirmada retorna 200 com o nickname do canal no corpo; conta não confirmada retorna 403 com `EMAIL_NAO_CONFIRMADO`; credenciais inválidas retornam 401 com `CREDENCIAIS_INVALIDAS`.
- `POST /auth/confirm`, `/auth/refresh`, `/auth/logout`, `/auth/forgot-password` e `/auth/reset-password` mantêm exatamente os mesmos status e códigos de erro da Fase 02 entregue.
- As 8 suítes e2e existentes passam sem nenhuma edição — nenhum comportamento externo mudou.

---

## Mapa de Dependências

```
IE-02.17 (sem deps) ──┐
                      ├── IE-02.19
IE-02.18 (sem deps) ──┘
```

_(IE-02.17 e IE-02.18 são independentes e podem ser implementadas em paralelo; IE-02.19 depende de ambas.)_

## Entregáveis

- [ ] `ChannelService` injeta `Repository<Channel>` e opera com ou sem `EntityManager` do chamador (padrão híbrido de DT-B)
- [ ] `ChannelService` é o único ponto que deriva, normaliza e resolve colisão de nickname; expõe `findByUserId` para consumo externo
- [ ] `UsersService` criado como dono exclusivo da persistência de `User`, com o mesmo padrão híbrido
- [ ] `ChannelsModule` e `UsersModule` deixam de exportar `TypeOrmModule` — repositórios encapsulados, acessíveis apenas via os serviços
- [ ] `AuthService` não executa nenhuma operação de banco direta, exceto abrir a transação de `register`
- [ ] `AuthService` não carrega mais `relations: { channel: true }` — dados de canal vêm do `ChannelService`
- [ ] Nenhuma migration, mudança de schema ou alteração de contrato de API
- [ ] Todos os testes unitários passam (`docker compose -f nestjs-project/compose.yaml exec nestjs-api npm test`)
- [ ] Testes E2E passam sem edição (`docker compose -f nestjs-project/compose.yaml exec nestjs-api npm run test:e2e`)
- [ ] Build e verificação de tipos passam (`docker compose -f nestjs-project/compose.yaml exec nestjs-api npm run build`)
