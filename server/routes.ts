import { Router } from "express";
import { PRODUCT_CATEGORIES } from "../shared/const.js";
import {
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct,
} from "./db.js";

export const apiRouter = Router();

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const DEFAULT_CATEGORY = PRODUCT_CATEGORIES[0];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateProductInput(body: unknown): { error: string } | { data: {
  name: string;
  code: string;
  image: string;
  priceVnd: string;
  originalPrice: string;
  category: string;
  size: string;
} } {
  if (typeof body !== "object" || body === null) {
    return { error: "Payload không hợp lệ." };
  }
  const b = body as Record<string, unknown>;

  if (!isNonEmptyString(b.name)) return { error: "Tên sản phẩm là bắt buộc." };
  if (!isNonEmptyString(b.priceVnd)) return { error: "Giá bán là bắt buộc." };

  const image = typeof b.image === "string" ? b.image : "";
  if (image && image.length > MAX_IMAGE_BYTES * 1.4) {
    // base64 ~ 4/3 kích thước gốc, cho biên độ sai số
    return { error: "Ảnh vượt quá giới hạn 2MB." };
  }

  const category =
    typeof b.category === "string" && (PRODUCT_CATEGORIES as readonly string[]).includes(b.category)
      ? b.category
      : DEFAULT_CATEGORY;

  return {
    data: {
      name: String(b.name).trim(),
      code: typeof b.code === "string" ? b.code.trim() : "",
      image,
      priceVnd: String(b.priceVnd).trim(),
      originalPrice: typeof b.originalPrice === "string" ? b.originalPrice.trim() : "",
      category,
      size: typeof b.size === "string" ? b.size.trim() : "",
    },
  };
}

apiRouter.get("/products", async (_req, res) => {
  const products = await listProducts();
  res.json(products);
});

apiRouter.get("/products/:id", async (req, res) => {
  const product = await getProduct(req.params.id);
  if (!product) {
    res.status(404).json({ error: "Không tìm thấy sản phẩm." });
    return;
  }
  res.json(product);
});

apiRouter.post("/products", async (req, res) => {
  const result = validateProductInput(req.body);
  if ("error" in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  const product = await createProduct(result.data);
  res.status(201).json(product);
});

apiRouter.put("/products/:id", async (req, res) => {
  const result = validateProductInput(req.body);
  if ("error" in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  const product = await updateProduct(req.params.id, result.data);
  if (!product) {
    res.status(404).json({ error: "Không tìm thấy sản phẩm." });
    return;
  }
  res.json(product);
});

apiRouter.delete("/products/:id", async (req, res) => {
  const ok = await deleteProduct(req.params.id);
  if (!ok) {
    res.status(404).json({ error: "Không tìm thấy sản phẩm." });
    return;
  }
  res.status(204).end();
});
