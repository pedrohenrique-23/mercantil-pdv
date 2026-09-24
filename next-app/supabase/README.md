# Banco de dados e RLS do Mercantil PDV

Esta pasta contém as migrations PostgreSQL do novo `next-app`. A migration `0001_auth_foundation.sql` cria a fundação de identidade e tenancy: `profiles`, `companies` e `company_members`. A migration `0002_business_foundation.sql` cria as entidades comerciais, índices, enums, triggers de `updated_at`, o vínculo automático do criador como proprietário da empresa e as políticas de Row Level Security.

## Ordem de aplicação

As migrations devem ser aplicadas nesta ordem, em uma instância Supabase nova ou no projeto Supabase destinado ao Mercantil PDV:

```text
0001_auth_foundation.sql
0002_business_foundation.sql
```

A segunda migration depende dos tipos, tabelas e funções criados pela primeira. Neste momento, as migrations foram revisadas localmente e ainda não foram aplicadas a um projeto Supabase remoto, porque os conectores Supabase disponíveis nesta sessão estão desabilitados e não há `supabase CLI` ou cliente PostgreSQL local configurado.

## Modelo comercial

O modelo usa `company_id` como limite de tenancy em todas as entidades comerciais. Valores monetários são inteiros em centavos, por exemplo `R$ 12,50` é armazenado como `1250`. Quantidades de estoque utilizam `numeric(12,3)` para suportar produtos vendidos por peso, volume ou unidade.

As entidades principais são `categories`, `products`, `customers`, `cash_registers`, `sales`, `sale_items`, `payments`, `credit_accounts`, `credit_payments`, `stock_movements` e `cash_movements`. A tabela `stock_movements` representa o histórico do estoque; a tabela `cash_movements` representa o histórico do caixa. Vendas, baixa de estoque e movimentação financeira deverão ser gravadas em uma transação por uma Server Action confiável ou por uma RPC PostgreSQL na próxima etapa.

## Regras RLS

As funções `is_company_member` e `has_company_role` são `security definer`, têm `search_path` fixo em `public` e são usadas pelas políticas para evitar duplicação e recursão ao consultar `company_members`. O acesso é concedido somente para o papel `authenticated`.

| Área                | Leitura                     | Criação                                    | Alteração                          |
| ------------------- | --------------------------- | ------------------------------------------ | ---------------------------------- |
| Perfil              | próprio perfil              | trigger de autenticação                    | próprio perfil, sem troca do papel |
| Empresa             | membros                     | usuário autenticado cria a própria empresa | proprietário ou administrador      |
| Membros             | próprio vínculo ou gestores | proprietário ou administrador              | proprietário ou administrador      |
| Categorias          | membros                     | proprietário ou administrador              | proprietário ou administrador      |
| Produtos            | membros                     | proprietário ou administrador              | proprietário ou administrador      |
| Clientes            | membros                     | membro da empresa                          | membro da empresa                  |
| Caixa               | membros                     | membro que abre o próprio caixa            | membro da empresa                  |
| Vendas              | membros                     | operador autenticado                       | proprietário ou administrador      |
| Itens e pagamentos  | membros da empresa da venda | membros autorizados                        | não há alteração genérica          |
| Fiado               | membros                     | membro que cria o lançamento               | membro da empresa                  |
| Estoque             | membros                     | proprietário ou administrador              | ledger sem atualização genérica    |
| Movimentos de caixa | membros                     | membro que registra o movimento            | ledger sem atualização genérica    |

O trigger `companies_add_owner` transforma automaticamente `created_by` no membro `owner` da nova empresa. Um índice parcial impede mais de um caixa aberto por empresa.

## Pontos a validar no Supabase remoto

Após aplicar as migrations, é necessário testar com pelo menos dois usuários autenticados:

1. O proprietário cria uma empresa e deve aparecer como `owner` em `company_members`.
2. Um membro da empresa consegue ler produtos, clientes, vendas e caixa da própria empresa.
3. Um usuário de outra empresa não consegue ler ou inserir registros usando o `company_id` alheio.
4. Um operador não consegue alterar produtos, categorias, estoque ou membros.
5. Um usuário não consegue alterar o próprio `profiles.role`.
6. Uma empresa não consegue manter dois registros de caixa com status `open`.
7. Uma venda de uma empresa não consegue receber item, pagamento ou movimento de outra empresa.
8. O acesso anônimo não consegue ler nenhuma tabela protegida.

## Aplicação recomendada

Antes de aplicar em produção, faça um backup e execute as migrations em um projeto de staging. Depois, gere os tipos oficiais a partir do banco remoto:

```bash
supabase gen types typescript --project-id SEU_PROJECT_ID --schema public > next-app/types/database.ts
```

O arquivo `next-app/types/database.ts` já foi atualizado manualmente para acompanhar a migration, mas deve ser substituído pela geração oficial assim que o projeto Supabase estiver disponível. Depois da geração, execute `pnpm typecheck` e `pnpm build` dentro de `next-app`.

## Pendências de segurança para a etapa seguinte

As políticas protegem o acesso às linhas, mas a operação de venda ainda precisa de uma transação server-side que valide simultaneamente empresa, caixa aberto, estoque, total dos itens, pagamentos e cliente de fiado. Também será necessário adicionar validações de consistência entre `company_id` de produtos, clientes, caixa e vendas em uma RPC ou trigger antes de liberar o PDV para uso financeiro real.

## Movimentação de estoque

A migration `0003_stock_adjustments.sql` adiciona a função `adjust_product_stock`. Ela exige usuário autenticado e papel `owner` ou `admin`, trava o produto com `FOR UPDATE`, valida o tipo e a quantidade, impede saldo negativo, atualiza `products.stock_quantity` e insere o lançamento em `stock_movements` na mesma transação. A Server Action `next-app/lib/stock/actions.ts` chama essa função e traduz erros de permissão e saldo insuficiente para mensagens da interface.

Movimentos manuais disponíveis: entrada de compra, ajuste positivo, ajuste negativo, devolução e perda/avaria. A tela de estoque exibe o saldo por produto, destaca itens abaixo do mínimo, permite busca, registra motivo e mostra os últimos 80 movimentos do ledger. A aplicação remota precisa aplicar `0003_stock_adjustments.sql` depois das migrations anteriores antes que a gravação de ajustes funcione.
