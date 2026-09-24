import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardApp from "./dashboard-app";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <DashboardApp
      user={{ email: user.email, user_metadata: user.user_metadata }}
    />
  );
}
