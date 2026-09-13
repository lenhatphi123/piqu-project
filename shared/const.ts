export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;

/** Danh mục loại sản phẩm cố định (dùng chung client + server). */
export const PRODUCT_CATEGORIES = ["Áo", "Quần", "Váy", "Bikini", "Nón", "Trang sức"] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];
