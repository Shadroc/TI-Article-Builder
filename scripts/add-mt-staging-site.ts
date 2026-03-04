/**
 * One-off script to insert MT Staging into Supabase sites table.
 * Run: npx tsx scripts/add-mt-staging-site.ts
 * Requires: .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  process.exit(1);
}

const categoryMap = {
  Finance: { id: 7, color: "#00AB76" },
  Technology: { id: 6, color: "#067BC2" },
  Energy: { id: 5, color: "#dc6a3f" },
  Business: { id: 2, color: "#4a90d9" },
  Health: { id: 4, color: "#663300" },
  Culture: { id: 1, color: "#C2C6A2" },
  "Food & Health": { id: 4, color: "#663300" },
};

async function main() {
  const supabase = createClient(url!, key!);
  const { data, error } = await supabase
    .from("sites")
    .insert({
      name: "MT - Staging",
      slug: "mtstage",
      wp_base_url: "https://wordpress-682919-6237731.cloudwaysapps.com",
      active: true,
      category_map: categoryMap,
    })
    .select("id, name, slug")
    .single();

  if (error) {
    if (error.code === "23505") {
      console.log("Site mtstage already exists, skipping.");
      process.exit(0);
    }
    console.error("Insert failed:", error.message);
    process.exit(1);
  }
  console.log("Inserted site:", data);
}

main();
