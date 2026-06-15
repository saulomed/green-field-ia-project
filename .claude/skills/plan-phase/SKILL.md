---
name: plan-phase
description: "Gera um plano técnico de implementação para uma fase do projeto. Use sempre que o usuário pedir para planejar, detalhar ou gerar o plano técnico de uma fase — incluindo variações como 'planejar fase X', 'detalhar a fase', 'gerar implementação da fase', 'criar o phase-XX.md', ou qualquer menção a criar o documento técnico de uma fase do projeto."
disable-model-invocation: true
---

# Plano de Fase

Gera um plano técnico de implementação para uma fase do projeto. Este documento conecta o plano geral (o que entregar) com a execução (código). Define implementações técnicas de etapas, ações de implementação, dependências e critérios de aceitação.

## Contexto — ler antes de gerar

1. **`docs/project-plan.md`** — plano geral do projeto. Contém a descrição da fase, suas capacidades e entregáveis. É a fonte primária.
2. **`docs/decisions/`** — Para fases anteriores: ler apenas a tabela **Resumo de Decisões** ao final de cada documento — é suficiente para detectar conflitos sem ler a discussão completa. Se o resumo indicar conflito com a fase atual, ler o documento completo dessa fase para confirmar antes de reportar. Essas escolhas são restrições fixas; não reabri-las. Para a fase atual: se existir um documento de decisões, lê-lo por completo e usar as escolhas do usuário. Se não existir, o usuário deve fornecer suas decisões técnicas junto com a solicitação.
3. **`docs/phases/`** — fases já planejadas. Ler todas para manter consistência de formato, nomenclatura e nível de detalhe.
4. **Convenções de testes** — Identificar o(s) subprojeto(s) alvo em `docs/project-plan.md`. Se a fase abrange múltiplos subprojetos, aplicar este passo a cada um. Se o subprojeto alvo tiver uma skill de guia de testes (ex: `testing-guide-{subproject}`), usar o Skill tool para carregá-la. Usá-la como referência para identificar quais camadas de teste (Unitário, Integração, E2E) e quais arquivos de teste são necessários para cada artefato criado em cada IE. Essa informação preenche a seção **Testes** de cada IE e informa os **Entregáveis**. Outras skills (boas práticas, guias de ORM) são preocupações de implementação e não devem ser carregadas durante o planejamento.

Se o usuário não forneceu decisões técnicas e nenhum documento de decisões existe, perguntar antes de gerar. Decisões técnicas são responsabilidade do usuário, não do agente. Exemplos: estratégia de autenticação, bibliotecas específicas, padrões de armazenamento, limites de upload, formatos aceitos.

## Validação — executar antes de gerar

Após ler todas as fontes de contexto, validar as entradas antes de produzir qualquer saída. O objetivo é detectar problemas que levariam a um plano de implementação falho. Verificar:

**Inconsistências entre documentos:**
- Capacidades em project-plan.md que contradizem decisões técnicas (ex: o plano diz "confirmação por email" mas as decisões dizem "sem serviço de email").
- Decisões técnicas que conflitam entre si (ex: "JWT stateless" mas também "revogação imediata de token").
- Decisões que conflitam com escolhas feitas em fases anteriores.

**Ambiguidades no escopo da fase:**
- Capacidades descritas de forma vaga demais para decompor em implementações de etapa acionáveis (ex: "tratar autenticação" — quais fluxos exatamente?).
- Fronteiras pouco claras — uma capacidade pertence a esta fase ou à próxima?
- Casos extremos ausentes, visíveis pela leitura da spec (ex: "login do usuário" sem menção ao que acontece quando o email não está confirmado). Reportar aqui apenas lacunas aparentes pela leitura estática; casos extremos que exigem rastreamento de caminhos de execução pertencem a "Consequências não mapeadas" abaixo.

**Decisões ausentes:**
- Capacidades que requerem uma escolha técnica mas não têm decisão correspondente (ex: a fase inclui "upload de arquivos grandes" mas sem decisão sobre chunked vs streaming vs resumable).
- Premissas implícitas que deveriam ser explícitas (ex: "rate limit em endpoints de auth" sem valores definidos).
- A fase expõe endpoints HTTP em um subprojeto mas o formato de resposta de erro ainda não foi decidido para esse subprojeto (nesta fase ou em anteriores).

**Lacunas de dependência:**
- A fase depende de algo de uma fase anterior que não foi planejado ou entregue.
- Dependências circulares ou ausentes entre capacidades dentro da fase.

**Consequências não mapeadas de requisitos funcionais:**

Ao contrário das categorias acima — que comparam documentos entre si de forma estática — esta exige simular mentalmente a execução de cada requisito funcional e verificar se todas as consequências estão endereçadas. Para cada capacidade da fase, percorrer a operação passo a passo e perguntar:

- **Quais são as entradas e seus casos extremos?** Considerar variações realistas nos dados que disparam a operação (ex: "handle de canal derivado do prefixo do email" — e se dois usuários compartilharem o mesmo prefixo? E se o prefixo for vazio, de um caractere, ou de 200 caracteres? E se contiver apenas caracteres especiais que são removidos?).
- **O que essa operação produz e suas saídas podem colidir, transbordar ou violar restrições?** Rastrear cada valor derivado ou gerado até onde é armazenado ou usado. Verificar se restrições de unicidade, limites de tamanho, requisitos de formato ou consumidores downstream podem ser violados por entradas legítimas (ex: um handle derivado que é único na spec mas não único na prática dado o algoritmo de derivação).
- **O que acontece com entidades relacionadas e efeitos colaterais?** Quando a operação cria, modifica ou exclui dados, rastrear o impacto em cada entidade tocada direta ou transitivamente. Verificar se efeitos em cascata, dependências de ordem ou transições de estado em entidades relacionadas estão especificados (ex: "deletar usuário" — vídeos, comentários e jobs de upload são tratados? "Alterar email" — o handle do canal é atualizado ou congelado?).
- **O que acontece sob concorrência ou execução repetida?** Considerar se dois usuários ou duas requisições realizando a mesma operação simultaneamente podem produzir condições de corrida, registros duplicados ou estados inconsistentes não endereçados na spec (ex: dois cadastros simultâneos com o mesmo email, rotações concorrentes de refresh token).
- **O caminho de falha está especificado?** Para cada passo que pode falhar, verificar se a spec define o que acontece — comportamento de rollback, resposta de erro, mensagem ao usuário ou limpeza de estado parcial (ex: "cadastro cria usuário + canal" — e se a criação do canal falhar após a inserção da linha do usuário? É transacional?).

O objetivo não é enumerar exaustivamente todos os casos extremos, mas simular caminhos de execução realistas e sinalizar consequências que nenhum documento endereça atualmente. Reportar cada achado da mesma forma que outros problemas de validação: citar o requisito, descrever a consequência não mapeada e pedir ao usuário que decida.

**Se problemas forem encontrados:** parar e apresentá-los ao usuário antes de gerar o plano. Agrupar por tipo (inconsistência, ambiguidade, decisão ausente, lacuna de dependência, consequência não mapeada). Ser específico — citar as declarações conflitantes ou apontar exatamente a capacidade que está pouco clara. Aguardar o usuário resolver. Depois que o usuário confirmar as resoluções (tipicamente atualizando `docs/decisions/` para a fase atual, o escopo da fase em `docs/project-plan.md`, ou fornecendo decisões explícitas de fora do escopo para consequências não mapeadas), reler as fontes afetadas e re-executar as verificações de validação antes de gerar o plano.

**Se nenhum problema for encontrado:** prosseguir para gerar o plano.

## Pesquisa durante o planejamento

Ao escrever ações técnicas, pode ser necessário verificar detalhes específicos sobre bibliotecas, APIs ou padrões referenciados nas decisões técnicas. Usar o MCP Context7 para buscar documentação atualizada de qualquer biblioteca ou framework mencionado nas decisões. Isso garante que as ações técnicas referenciem APIs, nomes de métodos e opções de configuração corretos — não desatualizados do treinamento do modelo.

**Disparar consultas ao Context7 em paralelo.** No início do rascunho do plano, emitir uma chamada por biblioteca mencionada no documento de decisões, todas em uma única mensagem. Por exemplo, para uma fase de autenticação que escolheu argon2, @nestjs/jwt, @nestjs-modules/mailer, class-validator e typeorm, enviar cinco chamadas `mcp__context7__query-docs` em paralelo. NÃO buscar bibliotecas uma a uma conforme escreve cada IE — agrupá-las no início e consultar os resultados ao longo do processo.

Usar web search para questões mais amplas: boas práticas, recomendações de segurança, detalhes de RFC ou comparações que vão além da documentação de uma única biblioteca.

## Estrutura de saída

O plano segue uma estrutura fixa. Cada fase gera um único arquivo markdown.

> **Lendo o template abaixo:** texto renderizado como `_(itálico entre parênteses)_` é orientação de autoria sobre *quando* incluir a seção ou subseção ao redor. **Não copiar** esses parênteses no documento de fase gerado — aplicá-los como condições e incluir o bloco somente quando a condição for satisfeita.

```markdown
# Fase NN — [Nome da Fase]

## Objetivo

Uma frase resumindo o que esta fase entrega.

---

## Implementações de Etapa

### IE-NN.1 — [Nome da IE]

**Descrição:** O que esta implementação de etapa implementa, em uma ou duas frases.

**Ações técnicas:**

- Ação concreta de implementação
- Ação concreta de implementação
- Ação concreta de implementação

**Testes:** _(omitir se a IE não cria artefatos testáveis)_

| Arquivo | Camada | Verifica |
|---------|--------|----------|
| file.spec.ts | Unitário/Integração/E2E | o que este arquivo testa |

**Dependências:** IE-NN.X (separadas por vírgula se múltiplas, ex: `IE-02.1, IE-02.3`) ou Nenhuma

**Critérios de aceitação:**

- Critério verificável específico desta implementação de etapa
- Critério verificável específico desta implementação de etapa

---

(repetir para cada implementação de etapa)

## Especificações Técnicas

_(incluir apenas as subseções aplicáveis à fase — ver checklist de aplicabilidade abaixo)_

### Modelo de Dados

#### [NomeDaEntidade]

| Coluna | Tipo | Restrições | Notas |
|--------|------|------------|-------|
| id | uuid | PK, gerado | |
| campo | tipo | restrições | |

**Relações:** NomeDaEntidade → OutraEntidade (many-to-one)
**Índices:** (campo_a, campo_b) — único

---

### Contratos de API

#### MÉTODO /recurso/caminho (IE-NN.X)

**Cabeçalhos da requisição:**
- Authorization: Bearer <access_token> (se autenticado)
- Content-Type: application/json

**Corpo da requisição:**
- campo: tipo, obrigatório/opcional — restrições

**Resposta 2XX:** _(escolher com base nas Convenções REST: 200 para dados, 201 para criação, 204 sem conteúdo)_
- campo: tipo _(omitir seção inteira para 204 — sem corpo)_

**Cabeçalhos da resposta:** _(se aplicável)_
- Location: /recurso/:id _(para 201 quando endpoint GET existe)_
- Nome-Cabeçalho: descrição

**Respostas de erro:**
- 4XX CÓDIGO_ERRO: quando este erro ocorre (para erros de domínio com códigos do Catálogo de Erros)
- 400 erro de validação: quando o corpo da requisição falha na validação de schema (sem código de domínio)

#### Regras de Validação — [NomeDaEntidade ou endpoint] _(opcional — apenas quando as regras de validação forem extensas)_

| Campo | Regra | Mensagem de erro |
|-------|-------|------------------|
| campo | descrição da regra | mensagem retornada na violação |

---

### Matriz de Autorização

| Endpoint | Público | Autenticado | Papel |
|----------|---------|-------------|-------|
| GET /recurso | ✓ | | |
| POST /recurso | | ✓ | |
| DELETE /recurso/:id | | | DONO ou ADMIN |

---

### Catálogo de Erros

**Formato da resposta de erro:** _(incluir apenas na primeira fase que introduz endpoints HTTP neste subprojeto — fases posteriores no mesmo subprojeto herdam este formato e não o redefinem)_
```
{ statusCode, error, message }
```
_O campo `error` carrega o código de erro de domínio do Catálogo de Erros (ex: `"EMAIL_JA_EXISTE"`). Ajustar o formato conforme as convenções do subprojeto._

| Código | HTTP | Mensagem | Gatilho |
|--------|------|----------|---------|
| CÓDIGO_ERRO | 4XX | Mensagem legível | Qual operação + qual branch dispara |

---

### Eventos/Mensagens

| Evento | Payload | Publicador | Consumidor | Entrega |
|--------|---------|------------|------------|---------|
| evento.nome | { campo: tipo } | NomeDoServiço | NomeDoWorker | fire-and-forget / ack-required |

---

## Mapa de Dependências

(árvore de texto mostrando a ordem de implementação — um nó por IE, filhos são IEs que dependem do pai)

```
IE-NN.1 (sem deps)
├── IE-NN.2
│   └── IE-NN.4
└── IE-NN.3
    └── IE-NN.5
```

## Entregáveis

- [ ] Entregável verificável
- [ ] Entregável verificável
- [ ] Todos os testes de IE passam (`<comando de teste do subprojeto>`)
- [ ] Testes E2E passam (`<comando de teste e2e, se aplicável>`)
- [ ] Verificação de tipos/compilação passa (`<comando de type-check do subprojeto>`)
- [ ] Build do projeto é bem-sucedido (`<comando de build do subprojeto>`)
```

## Como decompor a fase em Implementações de Etapa

Cada capacidade listada na fase em project-plan.md se torna uma ou mais implementações de etapa técnicas. A decomposição segue estas regras:

- **Uma implementação de etapa = uma unidade coesa de trabalho.** Se duas capacidades compartilham o mesmo módulo/serviço e não fazem sentido separadas, agrupá-las. Se uma capacidade for grande demais, dividi-la.
- **Numeração segue a fase.** Fase 02 → IE-02.1, IE-02.2, etc.
- **Dependências são entre implementações de etapa da mesma fase.** Dependências com outras fases já estão em project-plan.md e não precisam ser repetidas.
- **Restrição de tamanho.** Uma IE grande demais leva à degradação de qualidade durante a implementação. Use estas heurísticas para manter as IEs pequenas:
    - Máximo de 5 ações técnicas por IE.
    - Máximo de 5 arquivos de teste por IE.
    - Se uma IE instala dependências E configura módulos E cria entidades E implementa lógica de negócio — está fazendo demais. Separar infraestrutura (instalar, configurar) de comportamento (implementar, testar).
    - Na dúvida, preferir mais IEs menores a menos IEs maiores. A skill de execução gerencia as dependências entre elas.

## Como escrever Ações Técnicas

As ações técnicas são o coração do documento — elas guiam a implementação. Seguir estas diretrizes:

- Usar verbos de ação no infinitivo: criar, configurar, implementar, adicionar, habilitar.
- Ser específico o suficiente para que outro agente possa implementar sem ambiguidade. "Configurar rate limiting" é vago. "Instalar e configurar middleware de rate-limiting com janela de 10 requisições por minuto nos endpoints de auth" é acionável.
- Incluir nomes de bibliotecas, módulos, padrões e configurações relevantes. O plano deve refletir as decisões técnicas do usuário.
- Não incluir código. O plano descreve o que fazer, não como codificar. Referenciar APIs de bibliotecas, nomes de métodos e opções de configuração por nome em prosa é esperado.
- Ao introduzir novas dependências, listar o nome do pacote com um intervalo de versão compatível com a versão do framework existente no projeto. Exemplo: `Instalar @nestjs/jwt@^11.0.0, @nestjs/typeorm@^11.0.0 (compatível com NestJS 11)`. Isso evita conflitos de peer dependencies durante a implementação.

## Como escrever a seção de Testes

Cada IE que cria artefatos testáveis tem uma seção **Testes** (formato de tabela) listando os arquivos de teste a serem criados, sua camada e o que verificam. A camada e os requisitos de cobertura vêm do checklist de implementação de funcionalidades do guia de testes — não reinventá-los aqui.

### Processo

1. **Listar os artefatos** criados na IE (entidades, serviços, módulos, controllers, middlewares, DTOs e quaisquer outros tipos de artefato definidos pelo guia de testes do subprojeto).
2. **Para cada artefato**, consultar o guia de testes para determinar quais camadas de teste são necessárias. Se o subprojeto não tiver guia de testes, inserir um marcador `[DECIDIR: camadas de teste para <artefato> — unitário apenas | unitário + integração | unitário + integração + e2e]` (ver convenção de marcadores de rascunho) e continuar; não inventar requisitos de camada.
3. **Escrever uma linha por arquivo de teste** com: nome do arquivo, camada e o que o teste verifica (breve — não nomes completos de testes).

### Formato

| Arquivo | Camada | Verifica |
|---------|--------|----------|
| file.spec.ts | Unitário/Integração/E2E | o que este arquivo testa |

Testes E2E são listados por grupo de endpoint (uma linha por arquivo de spec e2e — tipicamente o conjunto de endpoints que compartilham um controller/feature), não por endpoint individual. Se a IE não cria artefatos testáveis, a seção Testes pode ser omitida.

## Como escrever Critérios de Aceitação

Os critérios de aceitação ficam dentro de cada implementação de etapa — descrevem como verificar que aquela IE específica está concluída, observando o comportamento do sistema de fora. Respondem: "Como confirmo que esta IE funciona sem ler o código-fonte?"

Detalhes de implementação (qual biblioteca, qual algoritmo, qual método ORM) pertencem às Ações técnicas. Quais arquivos de teste verificam os critérios pertence à seção Testes. Os CAs focam apenas no comportamento externamente observável.

### Fórmulas de template

Usar estes padrões de frase. Substituir os marcadores entre colchetes por especificidades das ações técnicas e contratos de API da IE.

**Comportamento de endpoint HTTP** (mais comum — um por endpoint por cenário relevante):

    [MÉTODO] [/caminho] com [descrição da entrada] retorna [status HTTP] com [corpo ou código de erro esperado]

Exemplo: `POST /auth/register com email já cadastrado retorna 409 com EMAIL_JA_EXISTE`

Para respostas 204 No Content (endpoints de ação sem corpo de resposta):

    [MÉTODO] [/caminho] com [descrição da entrada] retorna 204 sem corpo de resposta — [efeito colateral observável]

Exemplo: `POST /auth/logout com access token válido retorna 204 sem corpo de resposta — todos os refresh tokens do usuário são revogados`

**Comportamento de banco de dados/persistência** (restrições, atomicidade, integridade de dados):

    [descrição da operação] — [resultado de persistência esperado ou violação de restrição]

Exemplo: `Criar um usuário com canal é atômico — se a criação do canal falhar, nenhuma linha de usuário é persistida`

**Comportamento de efeito colateral** (email enviado, evento publicado, job enfileirado):

    [ação de disparo] causa [efeito colateral observável] contendo [elemento chave do payload]

Exemplo: `Cadastrar um novo usuário causa o envio de um email de confirmação contendo um link de confirmação com o token`

**Comportamento de segurança** (dados não vazados, timing-safe, tokens invalidados):

    [ação que sonda por informação] retorna [resposta que não revela nada ou aplica o limite]

Exemplo: `POST /auth/login com email inexistente retorna 401 com CREDENCIAIS_INVALIDAS — mesmo erro que senha incorreta, sem revelar existência do email`

### Passo a passo: derivando CAs de uma IE

1. **Começar pelo caminho feliz.** Ler as ações técnicas da IE do início ao fim. Escrever um CA descrevendo o resultado bem-sucedido que um observador externo veria (resposta HTTP, email recebido, registro criado).
2. **Percorrer cada ponto de bifurcação.** Para cada condicional nas ações técnicas (verificação de unicidade, verificação de permissão, validação de token, status de confirmação), escrever um CA para o caminho de falha. Usar o código de erro do Catálogo de Erros.
3. **Verificar efeitos colaterais.** Se a IE envia um email, publica um evento ou enfileira um job, escrever um CA para cada efeito colateral. Descrever o que é observável — não o mecanismo interno.
4. **Verificar limites de segurança.** Se a IE trata credenciais, tokens ou dados de identificação do usuário, escrever um CA garantindo que o sistema não vaza informações.
5. **Remover redundâncias.** Se um CA duplica o que outra IE já cobre (ex: comportamento global de validação testado uma vez na IE de infraestrutura), removê-lo. Cada CA deve verificar algo único desta IE.

### Exemplos ilustrativos

**Exemplo 1 — Endpoint HTTP (cadastro)**

RUIM: `Cadastro de usuário funciona e cria uma conta`
BOM: `POST /auth/register com email e senha válidos retorna 201 com { id, email, name }; um canal é automaticamente criado com handle derivado do prefixo do email`
POR QUÊ: Especifica método, caminho, entrada, código de status, formato da resposta e efeito colateral observável — verificável sem ler o código.

**Exemplo 2 — Segurança (login)**

RUIM: `Login falha quando as credenciais estão erradas`
BOM: `POST /auth/login com email inexistente retorna 401 com CREDENCIAIS_INVALIDAS — mesmo código de erro e status que senha incorreta, para não revelar a existência do email`
POR QUÊ: Torna o requisito de segurança explícito e verificável: um observador pode confirmar que ambos os casos retornam o mesmo erro.

**Exemplo 3 — Efeito colateral (confirmação de email)**

RUIM: `Email de confirmação é enviado após o cadastro`
BOM: `Cadastrar um novo usuário causa o envio de um email de confirmação para o endereço cadastrado, contendo o nome do usuário e um link de confirmação com o token`
POR QUÊ: Especifica resultado observável (email entregue), destinatário e conteúdo chave — verificável inspecionando o serviço de email de teste.

**Exemplo 4 — Persistência (detecção de reutilização de token)**

RUIM: `Rotação de refresh token trata roubo`
BOM: `POST /auth/refresh com refresh token já utilizado retorna 401 com TOKEN_REUTILIZADO e todos os refresh tokens da mesma família de rotação são revogados`
POR QUÊ: Descreve o gatilho exato, resposta e consequência de persistência — tudo observável sem ler o código-fonte.

### Checklist de validação

Antes de finalizar, verificar se cada critério passa:

1. **Observável?** Posso verificar isso chamando um endpoint, verificando uma caixa de email ou consultando um banco de dados — sem ler o código-fonte?
2. **Específico?** Nomeia o método HTTP, caminho, código de status, código de erro ou resultado observável?
3. **Delimitado?** Pertence exatamente a esta IE?
4. **Não redundante?** Já não está coberto por outro CA nesta ou em outra IE?
5. **Comportamental, não de implementação?** Descreve o que o sistema faz — não como faz internamente?
6. **Distinto das Ações técnicas?** Escolhas de implementação pertencem às Ações técnicas. CAs descrevem o resultado externamente visível.
7. **Distinto dos Testes?** CAs não referenciam camadas de teste ou arquivos de teste — esse mapeamento fica na seção Testes.

### Regras de fronteira

| Preocupação | Onde fica | Exemplo |
|-------------|-----------|---------|
| O que o sistema faz externamente | **Critérios de aceitação** | `POST /auth/login com credenciais válidas retorna 200 com { access_token, refresh_token }` |
| Como construir internamente | **Ações técnicas** | `Hashear senha usando argon2.hash(); verificar com argon2.verify()` |
| Quais arquivos de teste verificam | **Seção Testes** | `auth.e2e-spec.ts \| E2E \| login 200, 401, 403` |

### Quantos CAs por IE

- **Mínimo: 1** — CA do caminho feliz.
- **Típico: 3–7** — Um caminho feliz + branches de erro + efeitos colaterais + limites de segurança.
- **Limite suave: 10** — Quando uma IE excede 10 CAs, dividir a IE a menos que os critérios extras sejam genuinamente inseparáveis.

### Casos especiais

- **IEs de infraestrutura** (sem endpoint dedicado próprio — comportamento é exercido por qualquer requisição que interceptam, como middleware em nível de framework, handlers de erro ou interceptors de requisição): CAs descrevem o efeito observável nas requisições que passam por eles. Exemplo: `Uma requisição com corpo inválido retorna 400 com mensagens de erro de validação`.
- **IEs de efeito colateral** (email, fila, evento): CAs descrevem o efeito observável no sistema externo e mencionam a ferramenta de verificação se necessário.
- **IEs de persistência pura** (criação de entidade, migração): CAs descrevem comportamento de schema ou restrição. Exemplo: `Inserir email duplicado falha com violação de restrição de unicidade`.

## Como rascunhar o arquivo do plano

Escrever o arquivo do plano de forma incremental, não em uma única escrita grande. Isso limita cada chamada de ferramenta, facilita a revisão e evita atingir limites de tamanho de saída.

**Ordem recomendada:**

1. **Antes de criar o arquivo**, disparar consultas ao Context7 em paralelo para cada biblioteca mencionada no documento de decisões (ver `## Pesquisa durante o planejamento` acima). **Então criar o arquivo** com o cabeçalho, Objetivo e um placeholder `## Implementações de Etapa` (única chamada `Write`).
2. **Adicionar IEs uma por vez** — usar `Edit` para inserir cada IE (Descrição, Ações técnicas, Testes, Dependências, Critérios de aceitação) após a última IE. Finalizar os critérios de aceitação de cada IE usando o checklist de validação de CAs (ver `### Checklist de validação` em "Como escrever Critérios de Aceitação") antes de continuar.
3. **Adicionar Especificações Técnicas** após todas as IEs estarem escritas — uma subseção por vez (Modelo de Dados → Contratos de API → Matriz de Autorização → Catálogo de Erros → Eventos/Mensagens). Incluir apenas subseções aplicáveis.
4. **Adicionar Mapa de Dependências e Entregáveis** por último.

**Por que incremental:** uma única chamada `Write` com o plano completo pode exceder limites práticos de saída quando a fase tem muitas IEs, contratos de API extensos ou um catálogo de erros grande. Escritas incrementais também permitem capturar ambiguidades como marcadores inline sem interromper o fluxo de rascunho (ver convenção de marcadores abaixo).

**Tratando ambiguidades não resolvidas durante o rascunho:** Se encontrar um ponto onde uma decisão está ausente e não foi detectada durante a Validação, inserir um marcador inline `[DECIDIR: opção A | opção B — contexto breve]` no rascunho e continuar. Quando o rascunho estiver completo, apresentar todos os marcadores ao usuário via `AskUserQuestion` (uma pergunta por marcador). `AskUserQuestion` aceita até 4 perguntas por chamada, então se houver ≤4 marcadores usar uma única chamada; se houver mais, fazer chamadas sequenciais de até 4 perguntas até resolver todos. Aplicar as respostas com chamadas `Edit` direcionadas. Isso evita interromper o fluxo de rascunho com perguntas no meio do processo.

## Convenções REST para Contratos de API

Ao especificar contratos de API, seguir estas convenções para garantir definições de endpoint RESTful e compatíveis com os padrões.

### Seleção do Código de Status de Sucesso

| Status | Quando usar | Corpo da resposta |
|--------|-------------|-------------------|
| **200 OK** | Operação bem-sucedida e retorna dados significativos (representação de recurso, par de tokens, resultados de busca, valor computado) | Sim — o recurso ou dados produzidos |
| **201 Created** | POST que cria um novo recurso identificável | Sim — representação do recurso criado (no mínimo: ID + campos essenciais) |
| **204 No Content** | Operação bem-sucedida sem nada significativo a retornar | **Nenhum** — sem corpo de resposta |
| **202 Accepted** | Operação aceita para processamento assíncrono — resultado ainda não disponível | Opcional — referência ao job/task para polling |

### Regras do Corpo da Resposta

O corpo de uma resposta de sucesso contém a **representação do recurso/dados produzidos** ou **nada** (204). Nunca retornar `{ message: "..." }` como único conteúdo de uma resposta de sucesso — o código de status HTTP já comunica o resultado.

Guia de decisão:

- **Endpoint cria um recurso** (cadastrar usuário, criar vídeo) → 201 + representação do recurso
- **Endpoint retorna dados** (login → tokens, busca → resultados) → 200 + dados
- **Endpoint executa uma ação sem produzir dados** (logout, confirmar email, revogar token, enviar email) → 204 sem corpo
- **Endpoint neutro de segurança** (esqueci a senha, reenviar confirmação — sempre retorna a mesma resposta independente da entrada para evitar vazamento de informação) → 204 sem corpo (a ausência de corpo naturalmente evita vazamento de informação)

### Cabeçalho Location para 201 Created

Quando o recurso criado tem um endpoint de recuperação (GET), incluir um cabeçalho de resposta `Location` apontando para o URI do recurso (ex: `Location: /users/:id`). Omitir quando não existe endpoint GET para o recurso na fase atual.

### Endpoints de Ação vs. Endpoints de Recurso

Nem todo endpoint mapeia para CRUD em um recurso. Endpoints de ação (login, logout, confirmar, resetar) são válidos no REST. A regra:

- Ação que **produz um resultado** (login → tokens) → 200 com o resultado
- Ação que **dispara um efeito colateral sem produzir dados** (logout, confirmar) → 204 sem corpo

## Como escrever as Especificações Técnicas

Nem toda fase precisa de todas as seções de especificação. Usar este checklist para decidir quais incluir:

- A fase introduz ou altera entidades do banco de dados → **Modelo de Dados**
- A fase expõe endpoints HTTP → **Contratos de API** + **Regras de Validação** (inline nos Contratos de API se conciso; seção separada se extenso)
- A fase tem comportamento que depende de autenticação ou papéis → **Matriz de Autorização**
- A fase introduz um ou mais cenários de erro específicos do domínio → **Catálogo de Erros** (mesmo um único erro de domínio justifica uma entrada no catálogo para ser referenciado por código nos CAs e Contratos de API; a primeira fase a introduzir endpoints HTTP em um subprojeto também deve definir o formato da resposta de erro aqui)
- A fase envolve filas ou processamento assíncrono → **Eventos/Mensagens**

Se nenhum se aplicar (ex: uma fase puramente de infraestrutura), omitir a seção Especificações Técnicas inteiramente.

### Modelo de Dados

Especificar para cada entidade nova ou modificada:
- Todas as colunas com nome, tipo e restrições (PK, único, nullable, default, gerado). Usar a coluna **Notas** para observações que não cabem nas outras colunas (ex: valores computados, comportamento especial, exemplos de formato); deixar em branco quando não há nada extra a dizer.
- Relações com outras entidades (one-to-many, many-to-one, many-to-many) e qual lado possui a chave estrangeira.
- Índices necessários para performance de consulta ou restrições de unicidade.
- Não especificar decorators de ORM ou código de migração — descrever o schema pretendido.

### Contratos de API

Especificar para cada endpoint:
- Método HTTP e rota.
- Campos do corpo da requisição com tipo, obrigatório/opcional e restrições de validação (comprimento mín/máx, formato, valores permitidos).
- Campos do corpo da resposta com tipo para cada código de status relevante.
- Cabeçalhos de resposta quando significativos (ex: Set-Cookie, Location).
- Respostas de erro: código de status HTTP, código de erro do Catálogo de Erros (quando aplicável) e quando ocorre.
- Referenciar a implementação de etapa que implementa o endpoint (ex: IE-02.1).

Quando as regras de validação são simples (2-3 restrições por campo), descrevê-las inline no corpo da requisição. Quando extensas, agrupá-las em uma subseção separada **Regras de Validação** por endpoint ou por entidade.

**Código de status e corpo da resposta:** Seguir as convenções REST definidas em "Convenções REST para Contratos de API" acima. Em particular: usar 204 No Content para endpoints que têm sucesso sem produzir dados — não inventar wrappers `{ message: "..." }`. Usar 201 Created para endpoints POST que criam recursos.

### Matriz de Autorização

Uma tabela mapeando cada endpoint da fase para seu requisito de acesso:
- **Público:** sem necessidade de autenticação.
- **Autenticado:** requer token/sessão válido.
- **Papel:** requer um papel específico (especificar qual).

### Catálogo de Erros

Listar cada erro específico de domínio que a fase introduz. Cada entrada tem:

- **Código** — identificador em nível de aplicação em `SCREAMING_SNAKE_CASE` (ex: `EMAIL_JA_EXISTE`, `TOKEN_REUTILIZADO`). Globalmente único dentro do subprojeto que possui a API HTTP (nenhum dois códigos de erro emitidos pela mesma API podem colidir). Estável — não muda uma vez definido.
- **HTTP** — o código de status HTTP retornado com este erro.
- **Mensagem** — mensagem legível retornada no campo `message` do corpo da resposta.
- **Gatilho** — a operação específica e o branch que causa este erro (ex: "POST /auth/register quando email existe na tabela de usuários").

**Códigos de erro são referenciados nos Critérios de aceitação e Contratos de API** — um CA como `POST /auth/register com email duplicado retorna 409 com EMAIL_JA_EXISTE` refere-se a um código definido aqui.

**Formato da resposta de erro:** Definir o formato uma vez por subprojeto que expõe uma API HTTP, na primeira fase que introduz endpoints HTTP naquele subprojeto. Fases posteriores no mesmo subprojeto herdam e não redefinem — apenas adicionam novas linhas ao catálogo.

**O que incluir:**
- Erros específicos de domínio (regras de negócio, violações de estado): `EMAIL_JA_EXISTE`, `EMAIL_JA_CONFIRMADO`.
- Erros de autenticação/autorização com semântica específica da fase: `CREDENCIAIS_INVALIDAS`, `EMAIL_NAO_CONFIRMADO`, `TOKEN_REUTILIZADO`.

**O que NÃO incluir:**
- Erros genéricos do framework: 500 Internal Server Error, 404 para rotas não mapeadas.
- Erros genéricos de validação (400 da camada de validação do framework em corpos malformados) — esses são uniformes entre endpoints e não precisam de código de domínio. Referenciá-los nos Contratos de API como "400 erro de validação" sem código.

**Exemplo (preenchido completamente):**

| Código | HTTP | Mensagem | Gatilho |
|--------|------|----------|---------|
| EMAIL_JA_EXISTE | 409 | Email já está cadastrado | POST /auth/register com email que existe na tabela de usuários |
| CREDENCIAIS_INVALIDAS | 401 | Email ou senha inválidos | POST /auth/login com email desconhecido OU senha incorreta (mesmo código para ambos — não revelar qual) |
| EMAIL_NAO_CONFIRMADO | 403 | Email não confirmado | POST /auth/login com usuário onde is_confirmed = false |

### Eventos/Mensagens

Para cada evento ou mensagem:
- Nome do evento (ex: `video.uploaded`, `email.confirmacao.solicitada`).
- Campos do payload com tipos.
- Quem publica o evento (nome do serviço).
- Quem consome (worker, serviço ou sistema externo).
- Se é fire-and-forget ou requer acknowledgment.

## Regras

- Formato e nível de detalhe devem ser consistentes com as fases já planejadas em `docs/phases/`.
- Não repetir informações já em `docs/project-plan.md` (visão geral, stack, características do projeto).
- Se a fase depende de outras, assumir que tudo das fases anteriores já está implementado e funcional.
- Cada implementação de etapa deve ter um campo **Dependências** explícito (seu valor pode ser "Nenhuma").
- Cada implementação de etapa deve ter pelo menos um critério de aceitação.
- Entregáveis devem ser um checklist (com `- [ ]`), não prosa.
- Incluir apenas as seções de Especificação Técnica que se aplicam à fase com base no checklist de aplicabilidade. Omitir seções não relevantes.
- IEs que introduzem novas dependências devem listar pacotes com intervalos de versão compatíveis em suas Ações técnicas.
- Quando uma fase abrange múltiplos subprojetos, repetir os entregáveis de teste/type-check/build por subprojeto, cada um com seu próprio comando (ex: `Todos os testes de IE passam no nestjs-project (<comando>)` e `Todos os testes de IE passam no nextjs-project (<comando>)`).

## Saída

Salvar em: `docs/phases/phase-NN-[slug-do-nome].md`

Exemplo: `docs/phases/phase-02-auth.md`
