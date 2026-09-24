import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
// import { db } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }

  // Fallback: Se não houver usuário autenticado no cookie, busca o primeiro usuário admin/user no banco
  if (!user) {
    try {
      const [dbUser] = await db.select().from(users).limit(1);
      if (dbUser) {
        user = dbUser;
        console.log("[Context] Utilizador fallback injetado com sucesso:", dbUser.email);
      } else {
        console.log("[Context] Nenhum utilizador encontrado na tabela users do Aiven!");
      }
    } catch (dbError) {
      console.error("[Context] Erro ao buscar utilizador no Aiven:", dbError);
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}