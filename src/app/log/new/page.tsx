import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MatchForm from "@/components/MatchForm";

export default async function NewMatchPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto">
      <a href="/" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">
        &larr; Back to dashboard
      </a>
      <h1 className="text-2xl font-bold mb-6">Log match (no Strava)</h1>
      <MatchForm />
    </div>
  );
}
