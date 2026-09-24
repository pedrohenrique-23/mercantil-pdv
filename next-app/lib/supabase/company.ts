import { createClient } from "./server";

interface CompanyMemberWithCompany {
  company_id: string;
  role: "owner" | "admin" | "operator";
  companies: {
    name: string;
  } | null;
}

export async function getCurrentCompany() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Busca a primeira empresa à qual o utilizador pertence
  const { data } = await supabase
    .from("company_members")
    .select("company_id, role, companies(name)")
    .eq("user_id", user.id)
    .single();

  if (!data) return null;

  const member = data as unknown as CompanyMemberWithCompany;

  return {
    id: member.company_id,
    role: member.role,
    name: member.companies?.name ?? "Empresa",
  };
}