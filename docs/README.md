# Guia técnico do Mercantil PDV

Este documento descreve como o Mercantil PDV foi organizado, quais decisões foram tomadas, como os módulos se relacionam e como uma pessoa ou outra IA deve trabalhar no projeto sem quebrar o fluxo de vendas.

O documento é complementar ao [`README.md`](../README.md), que contém instalação e instruções de uso. Aqui o objetivo é explicar **como o sistema funciona internamente**.

## 1. Resumo arquitetural

O projeto é uma aplicação web fullstack executada como um processo Node.js. O frontend é uma aplicação React servida pelo Vite em desenvolvimento e pelos arquivos compilados em produção. O backend é um servidor Express que expõe procedures tRPC em `/api/trpc`. O banco é MySQL/TiDB e o acesso é feito com Drizzle ORM.

A autenticação usa Manus OAuth. O template fornece o callback, o cookie de sessão e o contexto tRPC. Procedures de negócio devem usar `protectedProcedure` para exigir usuário autenticado. A aplicação não manipula cookies de sessão diretamente no frontend.

A divisão principal é:

```text
React + Tailwind
      │
      │ tRPC client com tipos derivados de AppRouter
      ▼
Express + tRPC
      │
      │ Drizzle ORM
      ▼
MySQL/TiDB
```

O frontend atual usa uma única página principal, `client/src/pages/Home.tsx`, com navegação interna por estado. Isso é intencional no MVP: o caixa, o cadastro e o controle operacional devem estar acessíveis com poucos cliques. O backend já separa os domínios em routers aninhados, permitindo que a interface seja dividida em rotas reais no futuro sem alterar o modelo de dados.

## 2. Mapa do repositório

```text
mercantil-pdv/
├── client/
│   ├── index.html
│   ├── public/
│   └── src/
│       ├── _core/hooks/useAuth.ts
│       ├── components/
│       │   └── ui/
│       ├── contexts/ThemeContext.tsx
│       ├── hooks/
│       ├── lib/trpc.ts
│       ├── pages/Home.tsx
│       ├── pages/NotFound.tsx
│       ├── App.tsx
│       ├── index.css
│       └── main.tsx
├── drizzle/
│   ├── migrations/
│   ├── meta/
│   ├── relations.ts
│   └── schema.ts
├── server/
│   ├── _core/
│   ├── db.ts
│   ├── domain.ts
│   ├── domain.test.ts
│   ├── auth.logout.test.ts
│   └── routers.ts
├── shared/
│   ├── _core/errors.ts
│   ├── const.ts
│   └── types.ts
├── docs/
│   └── README.md
├── package.json
├── drizzle.config.ts
├── tsconfig.json
├── vite.config.ts
└── README.md
```

### 2.1 `client/src`

`main.tsx` cria o `QueryClient`, configura o cliente tRPC, usa `superjson` e injeta o token de sessão quando o runtime de preview exige essa alternativa. `App.tsx` registra o shell da aplicação, o tema, o `TooltipProvider` e o fallback de erro.

`Home.tsx` contém a interface operacional do MVP. A navegação é representada pelo tipo `View`, que atualmente possui `dashboard`, `pdv`, `products`, `stock`, `customers`, `cash` e `reports`. Cada módulo usa hooks tRPC diretamente, sem Axios ou rotas REST adicionais.

A identidade visual está em `index.css`. O design usa fundo claro esverdeado, verde escuro para ações críticas, verde-lima para destaque operacional, cartões com bordas suaves e as fontes `DM Sans` e `Space Grotesk`. O frontend deve preservar essa linguagem visual, especialmente nas telas de caixa, onde legibilidade e velocidade são mais importantes que ornamentação.

### 2.2 `server/_core`

Esse diretório pertence à infraestrutura do template WebDev. Ele contém contexto de requisição, OAuth, cookies, ambiente, servidor Express, integração Vite, storage e outras capacidades de plataforma.

Não edite arquivos de `server/_core` para implementar funcionalidades do mercantil. Primeiro procure uma solução em `server/db.ts`, `server/routers.ts`, `server/domain.ts` ou em componentes do frontend. Só altere a infraestrutura quando a necessidade estiver claramente relacionada ao runtime.

### 2.3 `server/db.ts`

Este arquivo cria a instância Drizzle sob demanda e reúne as consultas do domínio. A conexão é criada somente quando `DATABASE_URL` existe, o que permite que ferramentas de análise e alguns testes carreguem o módulo sem conexão ativa.

As consultas devem retornar linhas do Drizzle sem transformar os tipos em objetos genéricos. Quando uma procedure precisa de uma combinação de dados, prefira criar uma função nomeada em `db.ts` e chamá-la de `routers.ts`.

O arquivo contém uma expressão compartilhada chamada `salesDayExpression`. Ela é reutilizada no `SELECT`, `GROUP BY` e `ORDER BY` dos relatórios diários. Isso evita que o MySQL/TiDB trate as expressões como diferentes em modo SQL estrito.

### 2.4 `server/routers.ts`

Este arquivo define o contrato público do backend. O tipo `AppRouter` é derivado no final do arquivo e usado automaticamente pelo frontend por meio de `client/src/lib/trpc.ts`.

Os routers atuais são:

| Router      | Responsabilidade                                                      |
| ----------- | --------------------------------------------------------------------- |
| `auth`      | Consulta do usuário atual e logout.                                   |
| `dashboard` | Indicadores do dia, mês, estoque baixo, fiado e série de vendas.      |
| `products`  | Listagem, criação, edição, ativação, desativação e ajuste de estoque. |
| `customers` | Listagem, cadastro e recebimento de dívidas.                          |
| `cash`      | Estado, abertura, fechamento e movimentações do caixa.                |
| `sales`     | Finalização transacional de vendas.                                   |
| `reports`   | Vendas agrupadas por dia em um intervalo.                             |

As entradas são validadas com Zod. Preços e valores monetários chegam ao backend em centavos inteiros, nunca como números de ponto flutuante.

## 3. Autenticação e autorização

O usuário vem de `ctx.user`, criado pelo contexto do template a partir da sessão Manus OAuth. A procedure pública `auth.me` permite que o frontend descubra o estado da sessão. O logout limpa a sessão pelo backend.

Procedures de negócio usam `protectedProcedure`. Isso garante que a chamada falhe com `UNAUTHORIZED` antes de acessar o banco quando não existe usuário.

O campo `users.role` aceita `user` e `admin`. O template também exporta `adminProcedure`, mas o MVP ainda não usa essa restrição em todos os procedimentos. Ao introduzir operações sensíveis, como exclusão lógica em massa, configuração da empresa ou gerenciamento de usuários, avalie se a procedure deve usar `adminProcedure`.

Não implemente autenticação manual no frontend, não armazene o JWT no estado do React e não crie uma segunda sessão paralela. Use `useAuth`, `startLogin` e os procedimentos existentes.

## 4. Multi-tenant e limite da primeira empresa

As tabelas de negócio possuem `companyId`. A primeira versão usa `companyId = 1` como empresa ativa. Esse valor é uma decisão explícita do MVP, não uma implementação completa de SaaS.

Ao adicionar uma nova consulta de negócio:

1. Inclua o filtro `eq(tabela.companyId, 1)` quando a tabela possuir `companyId`.
2. Não misture registros de empresas diferentes em agregações.
3. Não confie em um `companyId` enviado diretamente pelo navegador.
4. Quando o sistema evoluir para SaaS, derive a empresa do usuário autenticado ou de uma associação de membros.
5. Atualize todas as procedures, índices, testes e telas que assumem a empresa 1.

O próximo desenho de SaaS deve incluir uma tabela de associação entre usuários e empresas, seleção segura da empresa ativa, verificação de acesso em todas as procedures e testes de isolamento entre tenants.

## 5. Modelo de dados

### 5.1 Usuários e empresas

`users` é a tabela mantida pelo fluxo de autenticação. Ela possui `openId`, nome, email, método de login e papel. `companies` representa o tenant raiz. O MVP cria a estrutura da empresa, mas não fornece ainda uma tela de administração de empresas.

### 5.2 Produtos

`products` contém:

- `name`: nome exibido no PDV.
- `barcode`: código lido pelo scanner.
- `category`: categoria opcional.
- `costCents`: custo em centavos.
- `saleCents`: preço de venda em centavos.
- `stockQuantity`: quantidade atual.
- `minimumStock`: limite para alerta.
- `active`: desativação lógica.
- `companyId`: limite da empresa.

Produtos não devem ser apagados fisicamente após participarem de vendas. A desativação preserva histórico e impede novas vendas.

### 5.3 Clientes e fiado

`customers.debtCents` representa o saldo devedor atual. `customerPayments` registra cada pagamento recebido. Uma venda fiada referencia `sales.customerId` e aumenta `debtCents`. Um pagamento reduz o mesmo campo e cria o histórico correspondente.

O saldo é mantido como campo materializado para leitura rápida no PDV. Se futuramente houver necessidade de auditoria mais forte, o saldo poderá ser recalculado a partir de vendas fiadas e pagamentos, mas essa mudança deve ser planejada para não quebrar o fluxo atual.

### 5.4 Vendas e itens

`sales` é o cabeçalho da venda. `saleItems` guarda os produtos, quantidades, preços unitários e subtotais congelados no momento da venda. O preço do item deve permanecer histórico mesmo que o cadastro do produto seja alterado depois.

`paymentMethod` possui `cash`, `pix`, `debit`, `credit` e `credit_account`. O valor recebido e o troco ficam em centavos. O status inicial é `completed`; cancelamento ainda não foi exposto como fluxo de interface.

### 5.5 Estoque

`products.stockQuantity` é o saldo atual. `stockMovements` é o histórico de entradas, saídas, vendas e ajustes. A venda cria uma movimentação do tipo `sale`; o cadastro inicial cria `entry`; o ajuste manual usa `entry` ou `exit`; a edição direta do cadastro usa `adjustment`.

Nunca altere o estoque sem registrar o motivo da alteração. A baixa de uma venda deve ocorrer na mesma transação que grava os itens da venda.

### 5.6 Caixa

`cashRegisters` representa um ciclo de abertura e fechamento. `cashMovements` registra as entradas que compõem o valor físico esperado. O resumo do caixa soma:

```text
openingCents
+ sale_cash
+ entry
+ customer_payment
- exit
- withdrawal
```

Pix, débito, crédito e fiado aparecem como formas de pagamento da venda, mas não aumentam diretamente o dinheiro físico do caixa. Recebimentos de fiado aumentam o caixa quando o cliente paga.

### 5.7 Financeiro

`financialTransactions` é um livro simples de entradas e despesas. Ele não pretende substituir contabilidade. O registro de uma venda cria uma entrada financeira; o recebimento de fiado cria outra; entradas e saídas manuais criam transações conforme o tipo.

## 6. Fluxos transacionais importantes

### 6.1 Finalização de venda

A procedure `sales.complete` segue esta sequência:

1. Verifica se o banco está disponível.
2. Verifica se existe caixa aberto.
3. Exige cliente quando o pagamento é fiado.
4. Busca os produtos ativos da empresa.
5. Verifica se todos os itens existem.
6. Verifica estoque suficiente para cada quantidade.
7. Calcula o total com base no preço atual do produto.
8. Calcula o troco quando o pagamento é em dinheiro.
9. Abre uma transação Drizzle.
10. Insere o cabeçalho em `sales`.
11. Insere cada item em `saleItems`.
12. Diminui o estoque de cada produto.
13. Insere uma movimentação de estoque por item.
14. Insere movimentação de caixa apenas para dinheiro.
15. Aumenta a dívida do cliente quando for fiado.
16. Insere a transação financeira.
17. Confirma a transação e retorna o número da venda.

Se uma operação falhar dentro da transação, as operações anteriores devem ser revertidas pelo banco. Não mova a baixa do estoque ou a atualização do fiado para o frontend.

### 6.2 Fechamento de caixa

A procedure `cash.close` busca o caixa aberto, calcula o resumo atual e registra o valor contado, o valor esperado e a diferença. O fechamento altera o status para `closed`. O sistema não deve abrir outro caixa enquanto existir um registro `open` para a empresa.

### 6.3 Pagamento de dívida

A procedure `customers.payDebt` verifica o cliente, rejeita valor zero ou maior que a dívida, reduz `debtCents`, cria `customerPayments`, cria uma entrada financeira e, se houver caixa aberto, cria `cashMovements` do tipo `customer_payment`.

## 7. Contratos de entrada

Os principais contratos Zod são:

| Procedure              | Entradas importantes                                     |
| ---------------------- | -------------------------------------------------------- |
| `products.list`        | `search` opcional.                                       |
| `products.create`      | Nome, código, categoria, custo, venda, estoque e mínimo. |
| `products.update`      | Os mesmos campos de criação mais `id`.                   |
| `products.adjustStock` | `productId`, quantidade inteira, motivo.                 |
| `customers.create`     | Nome, telefone e observação opcional.                    |
| `customers.payDebt`    | `customerId`, `amountCents`.                             |
| `cash.open`            | `openingCents`.                                          |
| `cash.close`           | `closingCents`.                                          |
| `cash.movement`        | Tipo, valor e descrição.                                 |
| `sales.complete`       | Itens, forma de pagamento, recebido e cliente opcional.  |
| `reports.daily`        | Datas `from` e `to` no formato `YYYY-MM-DD`.             |

Ao alterar uma entrada, atualize a chamada tRPC correspondente no frontend. O TypeScript deve detectar a maioria dos desencontros, mas regras semânticas, como exigir cliente no fiado, continuam precisando de testes.

## 8. Regras de moeda, data e SQL

Todos os valores monetários são inteiros em centavos. A interface converte strings como `8,00` para `800`. O backend nunca deve somar valores de ponto flutuante.

Timestamps persistidos são `Date` e representam o instante da operação. O frontend formata datas para o locale do usuário. Filtros de relatório recebem datas sem horário e o backend cria início em `00:00:00` e fim em `23:59:59.999`.

Consultas agrupadas precisam ser compatíveis com SQL estrito. Para agrupar vendas por dia, use a expressão compartilhada em `server/db.ts`:

```ts
const salesDayExpression = sql<string>`DATE_FORMAT(sales.createdAt, '%Y-%m-%d')`;
```

A mesma referência deve ser usada em `select`, `groupBy` e `orderBy`. Não substitua um desses trechos por `DATE(createdAt)` ou por uma interpolação diferente sem testar a consulta no banco.

## 9. Frontend e estado tRPC

O frontend usa `trpc.*.useQuery` para consultas e `trpc.*.useMutation` para alterações. Depois de uma mutação crítica, como venda, abertura ou fechamento de caixa, o componente invalida ou refaz as consultas relevantes.

O PDV mantém o carrinho localmente porque ele é uma operação temporária até a finalização. O backend é a fonte de verdade para estoque, venda, caixa e saldo de cliente.

Ao adicionar uma nova tela:

1. Decida se ela é uma nova seção de `View` ou uma rota real.
2. Preserve o shell de navegação e a responsividade.
3. Mostre estado de carregamento, vazio e erro.
4. Use os componentes existentes em `client/src/components/ui`.
5. Não faça `fetch` manual para procedures tRPC.
6. Evite criar objetos instáveis como input de query a cada render.
7. Não coloque regras de negócio críticas apenas em `Home.tsx`.

## 10. Testes

Os testes ficam em `server/` e são executados com Vitest. Atualmente:

- `server/auth.logout.test.ts` verifica a limpeza do cookie de sessão.
- `server/domain.test.ts` verifica cálculo de troco, rejeição de valor insuficiente, cálculo do caixa esperado e exigência de cliente no fiado.

Para qualquer mudança financeira, adicione primeiro uma função pura em `server/domain.ts` quando isso for possível e teste essa função. Para mudanças de procedure, prefira também um teste de caller tRPC com contexto controlado.

Execute:

```bash
pnpm check
pnpm test
pnpm build
```

A captura de tela ou a abertura manual do preview não substitui testes automatizados. A validação visual deve complementar os testes, principalmente para o PDV e para o viewport móvel.

## 11. Procedimento seguro para alterar o projeto

Siga este ciclo:

1. Leia este documento e o `README.md` principal.
2. Localize o contrato, consulta e tela afetados.
3. Verifique se a mudança afeta estoque, dinheiro, dívida ou autenticação.
4. Altere o esquema Drizzle somente se a informação realmente precisar ser persistida.
5. Gere e revise a migração quando houver mudança de esquema.
6. Atualize `server/db.ts` e `server/routers.ts` mantendo os tipos.
7. Atualize a tela e estados de carregamento.
8. Adicione ou ajuste testes.
9. Rode `pnpm check`, `pnpm test` e `pnpm build`.
10. Revise `git diff --check`.
11. Verifique o preview com o usuário autenticado.
12. Faça commit com uma mensagem específica.

Não use SQL de produção para inserir dados de teste. Não remova dados existentes para “limpar” o ambiente. Não faça alterações destrutivas no banco sem backup e sem aprovação.

## 12. Como outra IA deve trabalhar neste repositório

Antes de editar, a IA deve identificar se a solicitação é de frontend, backend, banco, autenticação, relatório ou infraestrutura. Em seguida, deve ler somente os arquivos relevantes e preservar o restante do template.

A IA deve tratar o banco como fonte de dados reais. Não deve criar produtos, clientes, vendas ou movimentações fictícias apenas para deixar a tela preenchida. Se uma demonstração visual exigir dados, deve usar estados vazios ou um ambiente separado.

A IA deve preservar `companyId` em todas as consultas de negócio. Deve usar procedures protegidas, validação Zod, transações para operações compostas e centavos para dinheiro. Também deve explicar qualquer alteração de esquema e registrar limitações que não foram implementadas.

Quando houver erro de runtime, reproduza a consulta ou regra em um teste ou em uma verificação controlada. Não suprima erros retornando zero silenciosamente quando o banco falhar. O fallback vazio só é aceitável para ambientes sem banco durante carregamento de ferramentas, não como mascaramento de erro de produção.

## 13. Pontos de extensão planejados

### Impressora térmica

Adicionar uma camada de impressão no backend ou um conector local, dependendo do modelo da impressora. A finalização da venda não deve depender de a impressão ser concluída; o comprovante deve ser uma etapa posterior ou reimprimível.

### Múltiplas empresas

Substituir o `companyId = 1` por uma empresa derivada da sessão e criar associações entre usuários e empresas. O isolamento deve ser aplicado no backend, não apenas escondendo registros no frontend.

### Múltiplos caixas

Adicionar uma entidade de terminal ou caixa físico e impedir que um operador use o caixa de outro terminal sem permissão. Os relatórios precisam poder filtrar por empresa, caixa e operador.

### Cancelamento e estorno

Criar uma operação explícita de cancelamento que reverta estoque, registre movimentação de caixa quando aplicável, ajuste fiado quando necessário e preserve o histórico original. Não altere diretamente uma venda concluída para “apagar” o problema.

### Auditoria

Adicionar usuário, motivo e timestamp a alterações sensíveis. Produtos desativados, ajustes de estoque, cancelamentos, fechamentos e alterações de preço merecem trilha de auditoria.

### Impressão e modo offline

O modo offline exige uma estratégia de sincronização, identificadores idempotentes e resolução de conflitos. Não adicione armazenamento offline parcial sem definir como o estoque e o caixa serão reconciliados.

## 14. Checklist de revisão

Antes de considerar uma alteração pronta, confirme:

- A mudança mantém o fluxo de login.
- Nenhuma procedure de negócio ficou pública por engano.
- Os filtros de empresa continuam presentes.
- Valores monetários continuam em centavos.
- A operação composta usa transação quando necessário.
- O estoque não fica negativo.
- O fiado exige cliente e não aceita pagamento superior à dívida.
- O relatório diário usa expressão consistente de agrupamento.
- O frontend exibe estados de carregamento, erro e vazio.
- `pnpm check`, `pnpm test` e `pnpm build` passam.
- Não há segredos ou dados reais no diff.

## Referências

[1]: https://orm.drizzle.team/docs/overview "Drizzle ORM documentation"
[2]: https://trpc.io/docs "tRPC documentation"
[3]: https://zod.dev/ "Zod documentation"
[4]: https://react.dev/learn "React documentation"
[5]: https://tailwindcss.com/docs "Tailwind CSS documentation"
[6]: https://vitest.dev/guide/ "Vitest guide"
[7]: https://docs.github.com/en/get-started/start-your-journey "GitHub documentation"
