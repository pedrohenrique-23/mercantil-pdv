# Mercantil PDV

Sistema web de caixa e gestão para um mercantil de pequeno porte. O projeto concentra a operação de vendas, produtos, estoque, clientes, vendas fiadas, abertura e fechamento de caixa e relatórios de vendas por dia.

A primeira versão foi construída como um **MVP funcional para uso real**. O foco é reduzir a quantidade de cliques no caixa, permitir operação com teclado e leitor de código de barras e manter as movimentações financeiras rastreáveis.

> **Documentação técnica para manutenção por desenvolvedores e IAs:** consulte [`docs/README.md`](docs/README.md). Esse documento descreve a arquitetura, o modelo de dados, os contratos tRPC, os fluxos transacionais, as regras de segurança e o procedimento recomendado para alterar o sistema.

## 1. Visão geral

O sistema possui autenticação baseada em Manus OAuth, frontend React com TypeScript e Tailwind CSS, backend Express com tRPC e persistência em MySQL/TiDB por meio de Drizzle ORM. A aplicação é executada como um único processo web no ambiente WebDev.

As funcionalidades disponíveis nesta versão são:

- Dashboard com vendas do dia, vendas do mês, saldo esperado do caixa, fiado em aberto e produtos com estoque baixo.
- Frente de caixa com pesquisa por nome, leitura de código de barras, carrinho, alteração de quantidade e finalização rápida.
- Pagamentos em dinheiro, Pix, cartão de débito, cartão de crédito e fiado.
- Cálculo de troco para pagamentos em dinheiro.
- Cadastro, edição, ativação e desativação de produtos.
- Controle de preço de custo, preço de venda, estoque atual e estoque mínimo.
- Entradas e saídas de estoque com motivo e registro em histórico.
- Cadastro de clientes e registro de pagamentos de dívidas.
- Abertura de caixa com valor inicial.
- Entradas, saídas e sangrias no caixa.
- Fechamento de caixa com valor esperado, valor contado e diferença.
- Relatório de vendas agrupadas por dia e período selecionado.

A impressão térmica, usuários com permissões mais granulares, múltiplas empresas, múltiplos caixas e integrações fiscais ainda não fazem parte do MVP.

## 2. Requisitos

Para desenvolvimento local, instale:

- Node.js 22 ou versão compatível com o ambiente do projeto.
- pnpm 10 ou versão compatível.
- Git.
- Uma instância MySQL ou TiDB acessível pela aplicação.
- Credenciais do Manus OAuth para autenticação.

O ambiente WebDev já fornece as variáveis necessárias para o banco, autenticação e integração com o runtime. Em outra máquina, essas variáveis devem ser configuradas antes de iniciar o servidor.

## 3. Instalação

Clone o repositório e entre na pasta do projeto:

```bash
git clone https://github.com/pedrohenrique-23/mercantil-pdv.git
cd mercantil-pdv
```

Instale as dependências:

```bash
pnpm install
```

Configure as variáveis de ambiente usadas pelo backend. Os nomes principais são:

| Variável                | Finalidade                                                            |
| ----------------------- | --------------------------------------------------------------------- |
| `DATABASE_URL`          | String de conexão MySQL/TiDB.                                         |
| `JWT_SECRET`            | Segredo usado para assinar a sessão.                                  |
| `VITE_APP_ID`           | Identificador da aplicação Manus OAuth.                               |
| `OAUTH_SERVER_URL`      | URL do servidor OAuth.                                                |
| `VITE_OAUTH_PORTAL_URL` | Portal de login usado pelo frontend.                                  |
| `OWNER_OPEN_ID`         | Identificador do proprietário que deve receber perfil administrativo. |
| `OWNER_NAME`            | Nome do proprietário.                                                 |

Não coloque segredos diretamente no código e não versione arquivos `.env`. O arquivo `server/_core/env.ts` centraliza a leitura das variáveis disponíveis para o servidor.

## 4. Banco de dados

O esquema está em [`drizzle/schema.ts`](drizzle/schema.ts). A aplicação usa tabelas para usuários, empresas, produtos, clientes, vendas, itens de venda, movimentações de estoque, caixas, movimentações de caixa, transações financeiras e pagamentos de clientes.

Para gerar uma nova migração depois de alterar o esquema:

```bash
pnpm drizzle-kit generate
```

Revise o SQL gerado em `drizzle/` antes de aplicar qualquer alteração. Para aplicar migrações no ambiente configurado, use o fluxo de banco do WebDev ou:

```bash
pnpm db:push
```

Alterações destrutivas, como `DROP TABLE`, remoção de colunas ou mudanças que possam apagar dados, exigem revisão explícita e backup antes da execução.

## 5. Comandos principais

| Comando        | O que faz                                                      |
| -------------- | -------------------------------------------------------------- |
| `pnpm dev`     | Inicia o servidor de desenvolvimento com hot reload.           |
| `pnpm check`   | Executa o TypeScript sem gerar arquivos.                       |
| `pnpm test`    | Executa os testes automatizados com Vitest.                    |
| `pnpm build`   | Compila o frontend e o servidor para produção.                 |
| `pnpm start`   | Inicia o bundle de produção gerado.                            |
| `pnpm format`  | Formata os arquivos usando Prettier.                           |
| `pnpm db:push` | Gera e aplica migrações Drizzle conforme a configuração local. |

Antes de abrir um pull request ou publicar alterações, execute pelo menos:

```bash
pnpm check && pnpm test && pnpm build
```

## 6. Como iniciar o sistema

Execute:

```bash
pnpm dev
```

Abra a URL exibida pelo servidor. No primeiro acesso, o sistema direciona para o login OAuth quando não há uma sessão válida. Depois da autenticação, a tela inicial exibe o dashboard.

O sistema depende de um usuário autenticado para acessar produtos, clientes, caixa, vendas e relatórios. As rotas de negócio usam `protectedProcedure` no backend.

## 7. Como operar o PDV

### 7.1 Abrir o caixa

Antes de registrar uma venda:

1. Abra o menu **Caixa**.
2. Informe o valor físico disponível no início do expediente.
3. Clique em **Abrir**.
4. Confirme que o status passou para **Caixa aberto**.

O sistema registra o operador, o valor inicial e o horário de abertura.

### 7.2 Cadastrar produtos

Abra **Produtos** e selecione **Novo produto**. Informe:

- Nome do produto.
- Código de barras, quando houver.
- Categoria opcional.
- Preço de custo.
- Preço de venda.
- Estoque inicial.
- Estoque mínimo.

O preço é informado em reais na interface e persistido em centavos no banco. Por exemplo, `8,00` é salvo como `800` em `saleCents`.

O estoque inicial gera uma movimentação de entrada. Produtos podem ser desativados sem apagar o registro histórico.

### 7.3 Registrar uma venda

Abra **Frente de caixa**. O campo de busca fica pronto para receber o leitor de código de barras, que normalmente funciona como um teclado USB.

O fluxo recomendado é:

1. Deixe o foco no campo de código de barras.
2. Leia o produto. O leitor envia o código e normalmente finaliza com Enter.
3. O produto entra no carrinho. Se já existir no carrinho, a quantidade aumenta.
4. Para buscar manualmente, digite parte do nome ou do código.
5. Ajuste a quantidade com os botões `−` e `+`.
6. Escolha a forma de pagamento.
7. Para dinheiro, informe o valor recebido e confira o troco.
8. Para fiado, selecione o cliente.
9. Clique em **Finalizar venda**.

Ao finalizar, o backend valida o caixa aberto, verifica o estoque, calcula o total, registra a venda e os itens, baixa o estoque, grava o histórico de estoque e atualiza o saldo do cliente quando a venda é fiada. Essas operações são executadas dentro de uma transação de banco.

### 7.4 Atalhos do PDV

- `F2`: volta o foco para o campo de busca e código de barras.
- `Esc`: limpa o carrinho e a busca atual.
- `Enter`: confirma a leitura de um código exato no campo de busca.

O leitor não precisa de integração especial. Ele deve estar configurado para digitar o código no campo ativo e enviar Enter ao final.

### 7.5 Registrar entrada ou saída de estoque

Abra **Estoque**, selecione um produto e informe a quantidade. Números positivos representam entrada; números negativos representam saída. Informe também o motivo.

O sistema impede que o estoque fique negativo. Toda alteração gera um registro em `stockMovements`.

### 7.6 Cadastrar cliente e receber fiado

Em **Clientes & fiado**:

- Use **Novo cliente** para cadastrar nome e telefone.
- O saldo devedor começa em zero.
- O pagamento **Fiado** no PDV exige um cliente.
- Para receber uma dívida, clique em **Registrar pagamento**.
- O valor recebido reduz `debtCents`, cria um registro em `customerPayments`, cria uma entrada financeira e, quando há caixa aberto, cria uma movimentação de caixa.

O sistema não permite registrar pagamento superior ao saldo devedor.

### 7.7 Registrar movimentação de caixa

No menu **Caixa**, use **Lançar movimentação** para registrar:

- Entrada.
- Saída.
- Sangria.

Informe valor e descrição. Entradas aumentam o valor esperado. Saídas e sangrias diminuem o valor esperado.

### 7.8 Fechar o caixa

No final do expediente:

1. Abra **Caixa**.
2. Confira o resumo das vendas em dinheiro, recebimentos de fiado, entradas e saídas.
3. Escolha **Fechar caixa**.
4. Informe o valor contado fisicamente.
5. Confirme a diferença apresentada.

O valor esperado é calculado assim:

```text
valor esperado = valor inicial
               + vendas em dinheiro
               + entradas
               + recebimentos de fiado
               - saídas e sangrias
```

A diferença é:

```text
valor contado - valor esperado
```

O fechamento salva os valores esperado, contado e a diferença para consulta futura.

## 8. Relatório de vendas por dia

Abra **Relatórios** e selecione as datas inicial e final. O relatório apresenta a data, a quantidade de vendas e o total vendido.

A agregação usa a data de `sales.createdAt` e considera apenas vendas com status `completed`. Os valores são retornados em centavos e formatados em reais no frontend.

## 9. Estrutura resumida

```text
client/
  src/
    pages/Home.tsx          Interface principal e módulos do MVP.
    components/ui/          Componentes de interface reutilizáveis.
    _core/hooks/useAuth.ts  Integração do frontend com autenticação.
    lib/trpc.ts             Cliente tRPC tipado.
    index.css               Tokens visuais e estilos globais.

drizzle/
  schema.ts                 Tabelas e tipos inferidos do banco.
  migrations/               Migrações geradas pelo Drizzle.

server/
  routers.ts                Procedures tRPC e regras de entrada.
  db.ts                     Consultas e operações de persistência.
  domain.ts                 Regras de domínio puras e testáveis.
  *.test.ts                 Testes Vitest.
  _core/                    Infraestrutura do template WebDev.

docs/
  README.md                 Arquitetura, contratos e guia para futuras IAs.
```

## 10. Solução de problemas

### O login não aparece ou retorna sessão inválida

Confirme as variáveis OAuth e a URL de callback configurada no ambiente. Em preview WebDev, o runtime pode fornecer uma sessão automática; em outro ambiente, o fluxo OAuth precisa estar configurado explicitamente.

### O dashboard mostra valores vazios

Verifique se o usuário está autenticado e se `DATABASE_URL` aponta para o banco correto. Sem vendas cadastradas, os indicadores monetários devem mostrar zero. Sem caixa aberto, o saldo esperado não representa uma operação em andamento.

### O leitor não adiciona o produto

Confirme se o código foi cadastrado exatamente no produto, se o leitor está configurado como teclado e se o campo do PDV está com foco. Também é possível buscar o produto pelo nome.

### O banco rejeita uma consulta agrupada

Não reescreva a consulta diária usando expressões diferentes no `SELECT`, `GROUP BY` e `ORDER BY`. O projeto usa uma expressão compartilhada em `server/db.ts` para manter os três trechos idênticos e compatíveis com SQL estrito.

### O estoque não baixa após a venda

A venda só é concluída quando o caixa está aberto e há estoque suficiente. Verifique a mensagem exibida no PDV e consulte `products.stockQuantity` e `stockMovements`.

## 11. Limites conhecidos do MVP

A aplicação ainda usa `companyId = 1` como limite explícito da primeira empresa. O campo já existe nas entidades de negócio, mas não há tela de seleção de empresa nem mecanismo completo de isolamento por usuário. Essa evolução deve ser feita antes de transformar a aplicação em SaaS.

A impressão térmica ainda não está implementada porque depende do modelo da impressora e de como ela está instalada no computador do cliente. Também não há NFC-e, controle de compras, múltiplos caixas, múltiplas lojas, permissões além de administrador e usuário, ou sincronização offline.

## 12. Como contribuir

Antes de alterar o sistema, leia [`docs/README.md`](docs/README.md). Faça mudanças pequenas, preserve os contratos tRPC e não altere `server/_core` sem necessidade.

Depois da alteração:

```bash
pnpm check
pnpm test
pnpm build
git diff --check
```

Não inclua credenciais, dados reais de clientes, exportações do banco ou arquivos `.env` no commit. Ao alterar o esquema, gere e revise a migração. Ao alterar uma regra financeira, adicione ou atualize um teste unitário em `server/`.

## Referências

[1]: https://orm.drizzle.team/docs/overview "Drizzle ORM documentation"
[2]: https://trpc.io/docs "tRPC documentation"
[3]: https://vite.dev/guide/ "Vite guide"
[4]: https://react.dev/learn "React documentation"
[5]: https://docs.github.com/en/get-started/start-your-journey "GitHub documentation"
