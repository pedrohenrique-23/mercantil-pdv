import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main className="dashboard-shell">
      <section className="dashboard-card">
        <p className="eyebrow">BASE NEXT.JS + SUPABASE</p>
        <h1>Autenticação funcionando</h1>
        <p className="muted">
          A sessão foi validada no servidor. Esta área será substituída pelo
          dashboard do Mercantil PDV durante a migração dos módulos.
        </p>
        <dl className="identity-list">
          <div>
            <dt>Email</dt>
            <dd>{user.email ?? "Não informado"}</dd>
          </div>
          <div>
            <dt>User ID</dt>
            <dd>{user.id}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
