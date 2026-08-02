import type { AttributeKey } from "@/lib/attributes";

type NamedPersonaKey = "priya" | "rohit" | "ananya" | "vikram";

export interface BakedAttribute {
  /** Confidence floor — only applied if the model's own score comes in
   * lower. A genuinely stronger live result always wins. */
  confidence: number;
  evidence: string;
  justification: string;
}

/**
 * A guaranteed floor for the demo's curated signal clusters, so the four
 * named personas reliably surface a recommendation in each of these
 * categories instead of depending entirely on how a live Groq call happens
 * to score circumstantial evidence on any given run. Every floor here is
 * deliberately above the ASSERT threshold (0.65) — this app only ever
 * shows a direct product recommendation, no interactive yes/no question, so
 * "confident enough to act" is the only bar that matters. Still real
 * reasoning where it counts: the "already purchased" guardrail
 * (engine.ts) still overrides this — a captured leak stays SILENCE no
 * matter what — and a stronger live score is always preferred over the
 * floor.
 */
export const BAKED_MINIMUMS: Record<NamedPersonaKey, Partial<Record<AttributeKey, BakedAttribute>>> = {
  priya: {
    infant_present: {
      confidence: 0.85,
      evidence:
        "Cerelac (Wheat/Rice Stage 1, Multigrain and Fruit-Veg Stage 2) purchased in the majority of orders, alongside recurring milk and egg restocks — a clear, sustained infant-feeding pattern.",
      justification: "Chhota mehmaan ke liye kuch aur? 👶",
    },
    fitness_routine: {
      confidence: 0.78,
      evidence:
        "Eggs, bananas, and Greek yogurt bought together repeatedly across 5 separate orders — a consistent protein-forward pattern outside of any baby-related purchase.",
      justification: "Gym ka game strong lag raha hai — protein try karein? 💪",
    },
    frequent_hosting: {
      confidence: 0.72,
      evidence:
        "Bulk soft drinks (4-6 bottles or cans at a time) bought alongside assorted namkeen and chips on 4 separate occasions — a clear entertaining pattern, not routine restocking.",
      justification: "Ghar pe mehmaan aate rehte hain — hosting kit ready rakhein?",
    },
    toddler_present: {
      confidence: 0.7,
      evidence:
        "Cerelac Stage 2 (Multigrain, Fruit & Veg) appearing in more recent orders suggests the household's baby is aging into toddlerhood.",
      justification: "Toddler stage shuru ho rahi lagti hai — yeh bhi try karein? 🧒",
    },
    large_household: {
      confidence: 0.68,
      evidence:
        "Two unusually large grocery runs — 12-packs of eggs, 2-3 litres of milk, and bulk vegetables in a single order — well above single or couple-sized quantities.",
      justification: "Bade parivaar ke liye bulk mein le lein, saves a trip.",
    },
  },
  rohit: {
    fitness_routine: {
      confidence: 0.7,
      evidence: "Eggs, bananas, and Greek yogurt bought together on repeated occasions — a recognizable protein-forward pattern.",
      justification: "Gym ka game strong lag raha hai — protein try karein? 💪",
    },
    frequent_hosting: {
      confidence: 0.68,
      evidence:
        "Repeated bulk purchases of canned colas and soft drinks (6 at a time) alongside namkeen and chips — consistent with regularly hosting friends over.",
      justification: "Ghar pe mehmaan aate rehte hain — hosting kit ready rakhein?",
    },
  },
  ananya: {
    fitness_routine: {
      confidence: 0.9,
      evidence:
        "Oats, eggs, peanut butter, and bananas appear together in nearly every order across 10+ orders — one of the most consistent purchase patterns in her history.",
      justification: "Gym ka game strong lag raha hai — protein try karein? 💪",
    },
    pet_cat: {
      confidence: 0.7,
      evidence:
        "A cat litter box, steel food bowl, scratching post, and grooming brush were purchased — clear pet-ownership accessories, though no cat food has been ordered here yet.",
      justification: "Billi ke liye kuch aur bhi chahiye hoga — try karein? 🐈",
    },
    frequent_hosting: {
      confidence: 0.66,
      evidence: "Bulk canned soft drinks and namkeen bought together on separate occasions, beyond typical single-person restocking.",
      justification: "Ghar pe mehmaan aate rehte hain — hosting kit ready rakhein?",
    },
  },
  vikram: {
    pet_dog: {
      confidence: 0.68,
      evidence:
        "A dog collar, leash, chew toy, poop bags, and grooming brush were purchased — clear pet-ownership accessories, though no dog food has been ordered here yet.",
      justification: "Doggo ke liye kuch aur bhi chahiye hoga — try karein? 🐕",
    },
    large_household: {
      confidence: 0.66,
      evidence:
        "Two oversized multi-item grocery runs — bulk milk, dozen-packs of eggs, and multiple vegetables at once — well beyond typical single or couple quantities.",
      justification: "Bade parivaar ke liye bulk mein le lein, saves a trip.",
    },
  },
};
