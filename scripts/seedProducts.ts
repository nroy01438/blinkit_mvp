import "dotenv/config";
import { db } from "../src/lib/db";
import { PRODUCTS } from "../src/data/seed";

async function main() {
  console.log(`Seeding ${PRODUCTS.length} products...`);
  let created = 0;
  for (const p of PRODUCTS) {
    await db.product.upsert({
      where: { sku: p.sku },
      update: { ...p },
      create: { ...p },
    });
    created++;
  }
  console.log(`Done. Upserted ${created} products.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
