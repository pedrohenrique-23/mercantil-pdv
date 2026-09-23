# Mercantil PDV — base Next.js + Supabase

Esta pasta contém a **base paralela da refatoração completa** do Mercantil PDV. O MVP atual, baseado em React/Vite/Express/tRPC e Manus OAuth, continua na raiz do repositório. A migração está sendo feita em uma branch dedicada para que o sistema existente permaneça executável durante a transição.

## Objetivo desta etapa

A primeira etapa substitui a fundação de autenticação e runtime por:

- Next.js com App Router.
- React Server Components por padrão.
- Supabase Auth para email e senha.
- Cookies de sessão gerenciados por `@supabase/ssr`.
- Middleware para atualizar a sessão.
- PostgreSQL do Supabase como destino da nova persistência.
- RLS como limite de segurança para perfis, empresas e membros.
- Uma área protegida `/dashboard` para provar que a sessão é lida no servidor.

Nenhuma credencial do Supabase foi adicionada ao repositório. O login só funcionará depois que as variáveis locais forem configuradas.

## Como executar

Entre na pasta:

```bash
cd next-app
pnpm install
```

Crie um arquivo `.env.local` nessa pasta com:

```text
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sua-chave-publica
```

A chave pública pode ser usada no navegador. A `service_role` não deve ser colocada em `NEXT_PUBLIC_*`, no frontend ou em commits. A base atual não precisa dessa chave porque as operações serão feitas com a sessão do usuário e RLS.

Inicie o servidor:

```bash
pnpm dev
```

Acesse `http://localhost:3000`. Sem sessão, a página inicial envia para `/login`. Com uma sessão válida, envia para `/dashboard`.

## Configuração do Supabase

No painel do Supabase:

1. Crie um projeto PostgreSQL.
2. Abra **Authentication > Providers** e habilite Email.
3. Em **Authentication > URL Configuration**, adicione a URL local `http://localhost:3000`.
4. Adicione `http://localhost:3000/auth/callback` às URLs de redirecionamento permitidas quando habilitar OAuth.
5. Execute `supabase/migrations/0001_auth_foundation.sql` no SQL Editor ou usando a CLI do Supabase.
6. Crie um usuário de teste em **Authentication > Users**.
7. Confirme que o usuário criado também possui uma linha em `public.profiles`.

A migração cria `profiles`, `companies` e `company_members`, além dos enums, índices, trigger de perfil e políticas RLS. Ela ainda não cria as tabelas operacionais de produtos, vendas e caixa. Essas tabelas serão adicionadas depois que o modelo PostgreSQL for revisado.

## Fluxo de autenticação

`app/login/page.tsx` é um Client Component porque chama `supabase.auth.signInWithPassword`. Depois do login, o navegador navega para `/dashboard`.

`lib/supabase/client.ts` cria o cliente para o navegador. `lib/supabase/server.ts` cria o cliente para Server Components e Server Actions usando os cookies da requisição. `middleware.ts` chama `getUser()` em cada requisição aplicável para atualizar os tokens e persistir cookies renovados.

`app/auth/callback/route.ts` já está preparada para fluxos de OAuth. Ela troca o `code` por uma sessão e redireciona para o destino solicitado. O login por email e senha não depende dessa rota, mas provedores sociais futuros dependerão dela.

A página `/dashboard` valida o usuário no servidor. Esta verificação é importante: esconder uma tela no frontend não é controle de acesso. Toda leitura ou mutação sensível deverá ser protegida por sessão e por RLS.

## Variáveis de ambiente

Use somente variáveis locais ou secret managers:

| Variável                               | Exposição        | Uso                                                           |
| -------------------------------------- | ---------------- | ------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Pública          | URL do projeto Supabase.                                      |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Pública          | Chave publicável usada pelos clientes SSR e browser.          |
| `SUPABASE_SERVICE_ROLE_KEY`            | Somente servidor | Não está sendo usada nesta etapa. Nunca exponha ao navegador. |

O arquivo `.env.local` é ignorado pelo Git. Não crie valores fictícios no código para contornar a ausência das variáveis.

## Estrutura criada

```text
next-app/
├── app/
│   ├── auth/callback/route.ts  Troca code OAuth por sessão.
│   ├── dashboard/page.tsx      Página protegida de prova.
│   ├── login/page.tsx          Login por email e senha.
│   ├── globals.css             Estilos iniciais.
│   ├── layout.tsx              Metadata e layout raiz.
│   └── page.tsx                Redirecionamento por sessão.
├── lib/supabase/
│   ├── client.ts               Cliente Supabase para browser.
│   └── server.ts               Cliente Supabase para servidor.
├── supabase/migrations/
│   └── 0001_auth_foundation.sql
├── types/database.ts           Tipos manuais iniciais do schema.
├── middleware.ts               Refresh de sessão.
├── next.config.ts
├── package.json
└── tsconfig.json
```

## Plano das próximas etapas

A migração deve continuar nesta ordem:

1. Validar login, logout, sessão expirada e recuperação de senha com um projeto Supabase real.
2. Gerar tipos oficiais do banco com `supabase gen types typescript` e substituir `types/database.ts`.
3. Migrar produtos, categorias e estoque para PostgreSQL.
4. Migrar clientes, fiado, vendas, itens de venda e pagamentos.
5. Migrar caixa, movimentações financeiras e relatórios.
6. Criar funções de domínio e Server Actions para operações transacionais.
7. Aplicar RLS a cada tabela operacional e testar isolamento entre empresas.
8. Recriar o layout do dashboard e o PDV dentro de `app/` e `components/`.
9. Migrar dados do MySQL/TiDB em uma execução controlada, com backup e reconciliação.
10. Remover Manus OAuth e o runtime antigo somente depois de validar paridade funcional.

## Regras para futuras alterações

Não copie o `companyId = 1` do MVP para a nova aplicação. O novo tenant deve ser derivado de `company_members` e validado pelo banco.

Não use a `service_role` em componentes, Server Actions comuns ou rotas que possam ser chamadas sem autorização. Prefira clientes SSR com a sessão do usuário e políticas RLS.

Não misture o schema antigo Drizzle com o novo schema Supabase dentro da mesma operação. Durante a migração, mantenha os dois mundos separados e documente qualquer script de transferência.

Toda operação financeira deve usar inteiros em centavos. Toda operação que grava venda, baixa estoque e altera fiado deve ser atômica no PostgreSQL.

## Validação local

Depois de configurar as variáveis:

```bash
pnpm typecheck
pnpm build
```

Para confirmar o fluxo manual, crie um usuário de teste no Supabase, faça login, atualize a página `/dashboard` e confirme que o email e o UUID aparecem. A ausência de credenciais Supabase nesta branch é intencional; sem elas, o build pode ser validado, mas a execução autenticada não pode ser confirmada.
