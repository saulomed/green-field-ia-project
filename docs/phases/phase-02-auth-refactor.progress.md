# Fase 02 (Ajuste) — Fronteiras de domínio de Users e Channels — Progress

**Status:** completed
**SIs:** 3/3 completed

### IE-02.17 — ChannelService com repositório próprio e módulo encapsulado
- **Status:** completed
- **Tests:** `src/channels/channel.service.spec.ts` — 11/11 passando
- **Observations:** none

### IE-02.18 — UsersService como dono da persistência de User
- **Status:** completed
- **Tests:** `src/users/users.service.spec.ts` — 12/12 passando
- **Observations:** `auth.service.ts:67-80` roda `existsByEmail` duas vezes por registro — uma fora da transação e outra dentro. **Nota corrigida:** o diagnóstico inicial (“a de fora não agrega garantia, a de dentro cobre a corrida”) estava invertido. Sob READ COMMITTED a checagem interna também **não** fecha a corrida — `repository.exists` não trava linha, então duas transações concorrentes veem `false`, ambas inserem, e o índice único de `users.email` é o único árbitro real. A checagem **externa**, por outro lado, tem valor concreto: roda antes de `passwordService.hash` e evita ~100ms de argon2 + abrir transação no caminho de e-mail duplicado. Nenhuma das duas foi removida — ver follow-up em IE-02.19.

### IE-02.19 — AuthService delega persistência a UsersService e ChannelService
- **Status:** completed
- **Tests:** `src/auth/auth.service.spec.ts` — 32/32 passando (reescrito: mocka `UsersService`/`ChannelService` no lugar das entranhas do `EntityManager`)
- **Observations:** Duas decisões de borda tomadas na implementação: (1) `refresh` trocou `findOneByOrFail` por `findById` + `InvalidSessionException` no caso nulo — antes era `EntityNotFoundError` (500); o caso é inalcançável na prática, pois a rotação da sessão só sucede se o usuário existe, e nenhuma e2e o cobre. (2) `login`, `resendConfirmation` e `forgotPassword` usam `channel!.name`/`channel!.nickname` — o canal é invariante de cadastro (criado atomicamente com o usuário), e a asserção não-nula preserva o mesmo modo de falha do `user.channel.name` anterior. Follow-up sugerido ao usuário e adiado por decisão dele: extrair um `RegistrationService` para dar dono explícito ao invariante "todo usuário tem exatamente um canal", hoje dependente de o `AuthService` lembrar de chamar os dois serviços.

**Follow-ups levantados na revisão de qualidade pós-implementação (nenhum aplicado — todos exigem decisão do usuário por saírem do contrato do plano):**

- **Corrida de e-mail duplicado vira 500, não 409.** Nenhuma das duas checagens `existsByEmail` fecha a corrida (ver nota em IE-02.18); um registro concorrente com o mesmo e-mail estoura `QueryFailedError` (23505) não tratado. Correção adequada: manter só a checagem externa (fail-fast antes do argon2), remover a interna e tratar `23505` no `catch` da transação mapeando para `EmailAlreadyExistsException` — fecha a corrida de verdade e economiza um round-trip. É trabalho de **correção**, não de refactor, e por isso ficou fora.
- **`User.channel` virou relação morta e falsamente tipada.** Após IE-02.19 nenhum ponto do código popula a relação (o último `relations: { channel: true }` sumiu), mas `user.entity.ts:37` a declara como `channel: Channel` não-opcional. Quem escrever `user.channel.nickname` passa no type-check e quebra em runtime. Correção: tornar a relação unidirecional (remover `User.channel` e o callback do lado inverso em `Channel.user`), sem migration nem mudança de schema — a FK já vive em `channels.user_id`. **IE-02.18 mandava explicitamente manter a entidade inalterada**, então a mudança exige revisão do plano.
- **`refresh` seta cookies antes de buscar o usuário** (`auth.service.ts:214`): no caminho de usuário inexistente o cliente recebe cookies rotacionados *e* 401. Caminho inalcançável na prática; reordenar seria estritamente melhor.
