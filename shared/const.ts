export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;

/** Fixed set of product categories (shared by client + server). */
export const PRODUCT_CATEGORIES = ["Shirt", "Pants", "Dress", "Bikini", "Hat", "Jewelry"] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

/** Maps legacy Vietnamese category values (stored in existing Firestore documents) to the new English ones. */
export const LEGACY_CATEGORY_MIGRATION: Record<string, ProductCategory> = {
  "Áo": "Shirt",
  "Quần": "Pants",
  "Váy": "Dress",
  "Bikini": "Bikini",
  "Nón": "Hat",
  "Trang sức": "Jewelry",
};
