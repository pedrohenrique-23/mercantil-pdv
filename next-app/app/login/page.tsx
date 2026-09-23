"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    let signInError: { message: string } | null = null;
    try {
      const supabase = createClient();
      ({ error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      }));
    } catch {
      signInError = {
        message: "Configure as variáveis do Supabase antes de entrar.",
      };
    }
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="login-title">
        <div className="brand-mark" aria-hidden="true">
          M
        </div>
        <p className="eyebrow">MERCANTIL PDV</p>
        <h1 id="login-title">Entrar no sistema</h1>
        <p className="muted">Acesse o caixa e a gestão do seu mercantil.</p>

        <form onSubmit={handleSubmit} className="stack">
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={event => setEmail(event.target.value)}
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={event => setPassword(event.target.value)}
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={loading}>
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <p className="setup-note">
          A recuperação de senha, cadastro e provedores sociais serão
          adicionados na próxima etapa.
        </p>
      </section>
    </main>
  );
}
