/**
 * One-off migration: rewrites existing Firestore product documents whose `category`
 * field still holds the old Vietnamese category names to the new English ones
 * (see shared/const.ts LEGACY_CATEGORY_MIGRATION). Safe to re-run — it only
 * touches documents whose category is a known legacy value.
 *
 * Usage: pnpm tsx scripts/migrate-categories.ts [--dry-run]
 */
import { getDb } from "../server/firebase.js";
import { LEGACY_CATEGORY_MIGRATION } from "../shared/const.js";

try {
  process.loadEnvFile();
} catch {
  /* no .env file present, fall back to system environment variables */
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const db = getDb();
  const snapshot = await db.collection("products").get();

  let toMigrate = 0;
  const batch = db.batch();

  for (const doc of snapshot.docs) {
    const category = doc.data().category as string | undefined;
    if (category && category in LEGACY_CATEGORY_MIGRATION) {
      const newCategory = LEGACY_CATEGORY_MIGRATION[category];
      console.log(`${doc.id}: "${category}" -> "${newCategory}"`);
      toMigrate += 1;
      if (!dryRun) batch.update(doc.ref, { category: newCategory });
    }
  }

  if (toMigrate === 0) {
    console.log("No documents need migration.");
    return;
  }

  if (dryRun) {
    console.log(`\nDry run: ${toMigrate} document(s) would be updated. Re-run without --dry-run to apply.`);
    return;
  }

  await batch.commit();
  console.log(`\nMigrated ${toMigrate} document(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
