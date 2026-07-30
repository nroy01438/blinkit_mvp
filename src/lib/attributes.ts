// The 10 household attributes the graph can infer, and how each maps to a
// "leak" product category plus the copy used on the ASK surface.

export type AttributeKey =
  | "infant_present"
  | "toddler_present"
  | "pet_dog"
  | "pet_cat"
  | "elderly_member"
  | "fitness_routine"
  | "frequent_hosting"
  | "new_home"
  | "vegetarian_household"
  | "large_household";

export type LeakCategoryKey =
  | "baby_diapers_wipes"
  | "toddler_snacks"
  | "pet_food_dog"
  | "pet_food_cat"
  | "elderly_care"
  | "sports_nutrition"
  | "party_hosting_supplies"
  | "new_home_essentials"
  | "bulk_staples"
  | "plant_protein";

export interface AttributeDef {
  key: AttributeKey;
  label: string;
  leakCategory: LeakCategoryKey;
  /** Short yes/no question shown in ASK mode. Deterministic UI copy — the
   * inference itself (which attribute, what confidence) is entirely the
   * model's output; this is just the fixed phrasing for a fixed set of
   * possible household facts. */
  askQuestion: string;
}

export const ATTRIBUTES: Record<AttributeKey, AttributeDef> = {
  infant_present: {
    key: "infant_present",
    label: "Infant in household",
    leakCategory: "baby_diapers_wipes",
    askQuestion: "Quick one — chhota baby ghar mein hai kya? 👶",
  },
  toddler_present: {
    key: "toddler_present",
    label: "Toddler in household",
    leakCategory: "toddler_snacks",
    askQuestion: "Ghar mein toddler hai kya (1-4 saal)? 🧒",
  },
  pet_dog: {
    key: "pet_dog",
    label: "Dog owner",
    leakCategory: "pet_food_dog",
    askQuestion: "Quick one — dog hai ghar mein? 🐕",
  },
  pet_cat: {
    key: "pet_cat",
    label: "Cat owner",
    leakCategory: "pet_food_cat",
    askQuestion: "Ghar mein billi paali hai kya? 🐈",
  },
  elderly_member: {
    key: "elderly_member",
    label: "Elderly member in household",
    leakCategory: "elderly_care",
    askQuestion: "Ghar mein koi senior citizen bhi rehte hain?",
  },
  fitness_routine: {
    key: "fitness_routine",
    label: "Active fitness routine",
    leakCategory: "sports_nutrition",
    askQuestion: "Gym ya fitness routine chal raha hai? 💪",
  },
  frequent_hosting: {
    key: "frequent_hosting",
    label: "Frequently hosts guests",
    leakCategory: "party_hosting_supplies",
    askQuestion: "Ghar pe often mehmaan aate rehte hain?",
  },
  new_home: {
    key: "new_home",
    label: "Recently moved homes",
    leakCategory: "new_home_essentials",
    askQuestion: "Naye ghar mein shift hue ho kya recently? 🏠",
  },
  vegetarian_household: {
    key: "vegetarian_household",
    label: "Vegetarian household",
    leakCategory: "plant_protein",
    askQuestion: "Poori tarah vegetarian household hai?",
  },
  large_household: {
    key: "large_household",
    label: "Large household (5+ members)",
    leakCategory: "bulk_staples",
    askQuestion: "Ghar mein 5 ya usse zyada log rehte hain?",
  },
};

export const ATTRIBUTE_KEYS = Object.keys(ATTRIBUTES) as AttributeKey[];

/** Where a leak category lives in the catalog taxonomy, used to check in
 * code (never trusting the model) whether the household has already
 * purchased from it — if so, it is never a leak. */
export const LEAK_CATEGORY_TAXONOMY: Record<LeakCategoryKey, { category: string; subcategory?: string }> = {
  baby_diapers_wipes: { category: "Baby Care", subcategory: "Diapers & Wipes" },
  toddler_snacks: { category: "Baby Care", subcategory: "Toddler Snacks" },
  pet_food_dog: { category: "Pet Care", subcategory: "Dog Food" },
  pet_food_cat: { category: "Pet Care", subcategory: "Cat Food" },
  elderly_care: { category: "Personal Care", subcategory: "Elderly & Adult Care" },
  sports_nutrition: { category: "Sports Nutrition" },
  party_hosting_supplies: { category: "Home & Party", subcategory: "Disposables & Party Supplies" },
  new_home_essentials: { category: "Household Essentials", subcategory: "Cleaners" },
  bulk_staples: { category: "Snacks & Munchies", subcategory: "Noodles & Pasta" },
  plant_protein: { category: "Snacks & Munchies", subcategory: "Noodles & Pasta" },
};
