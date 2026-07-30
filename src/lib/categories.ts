export interface CategoryDef {
  slug: string;
  name: string;
  emoji: string;
  color: string;
  subcategories: string[];
}

export const CATEGORIES: CategoryDef[] = [
  {
    slug: "fruits-vegetables",
    name: "Fruits & Vegetables",
    emoji: "🥦",
    color: "#E8F5E9",
    subcategories: ["Fresh Vegetables", "Fresh Fruits", "Herbs & Seasonings"],
  },
  {
    slug: "dairy-bread-eggs",
    name: "Dairy, Bread & Eggs",
    emoji: "🥚",
    color: "#FFF6E0",
    subcategories: ["Milk", "Bread & Pav", "Eggs", "Paneer & Cream", "Butter & Cheese", "Curd & Yogurt"],
  },
  {
    slug: "snacks-munchies",
    name: "Snacks & Munchies",
    emoji: "🍿",
    color: "#FFEFE0",
    subcategories: ["Chips & Namkeen", "Chocolates", "Biscuits & Cookies", "Noodles & Pasta"],
  },
  {
    slug: "cold-drinks-juices",
    name: "Cold Drinks & Juices",
    emoji: "🥤",
    color: "#E5F1FF",
    subcategories: ["Soft Drinks", "Juices", "Energy Drinks", "Water"],
  },
  {
    slug: "household-essentials",
    name: "Household Essentials",
    emoji: "🧺",
    color: "#EFEAFB",
    subcategories: ["Detergents", "Cleaners", "Dishwash", "Fresheners"],
  },
  {
    slug: "personal-care",
    name: "Personal Care",
    emoji: "🧴",
    color: "#FDE9F0",
    subcategories: ["Bath & Body", "Hair Care", "Oral Care", "Skin Care", "Elderly & Adult Care"],
  },
  {
    slug: "baby-care",
    name: "Baby Care",
    emoji: "🍼",
    color: "#E0F7FA",
    subcategories: ["Baby Food", "Diapers & Wipes", "Toddler Snacks", "Baby Bath & Skin"],
  },
  {
    slug: "pet-care",
    name: "Pet Care",
    emoji: "🐾",
    color: "#F1E9DC",
    subcategories: ["Dog Food", "Cat Food", "Pet Accessories"],
  },
  {
    slug: "sports-nutrition",
    name: "Sports Nutrition",
    emoji: "🥤",
    color: "#E7F6EC",
    subcategories: ["Protein Supplements", "Health Drinks", "Bars & Snacks"],
  },
  {
    slug: "home-party",
    name: "Home & Party",
    emoji: "🎉",
    color: "#FFF0F0",
    subcategories: ["Disposables & Party Supplies", "Candles & Decor", "Stationery"],
  },
];

export function categoryBySlug(slug: string) {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function slugForCategoryName(name: string) {
  return CATEGORIES.find((c) => c.name === name)?.slug ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
