import { Router, type NextFunction, type Request, type Response } from "express";
import {
  createProduct,
  deleteProduct,
  getProduct,
  ImageTooLargeError,
  listProducts,
  updateProduct,
} from "./db.js";
import {
  createCategory,
  deleteCategory,
  findCategoryByName,
  listCategories,
  updateCategory,
} from "./categories-db.js";

export const apiRouter = Router();

type AsyncHandler = (req: Request, res: Response) => Promise<void>;

// Wraps async handlers so errors (e.g. missing Firebase config, lost connection) return a clean
// 500 instead of crashing the server process (Express 4 doesn't catch promise rejections on its own).
function asyncHandler(handler: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}

// Images are stored as base64 directly in the Firestore document (~1MB/document limit),
// so the original image size limit must stay well below Firestore's cap.
const MAX_IMAGE_BYTES = 500 * 1024;

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
    return { error: "Invalid payload." };
  }
  const b = body as Record<string, unknown>;

  if (!isNonEmptyString(b.name)) return { error: "Product name is required." };
  if (!isNonEmptyString(b.priceVnd)) return { error: "Sale price is required." };

  const image = typeof b.image === "string" ? b.image : "";
  if (image && image.length > MAX_IMAGE_BYTES * 1.4) {
    // base64 is ~4/3 the original size; this adds a margin of error
    return { error: "Image exceeds the 500KB limit." };
  }

  if (!isNonEmptyString(b.category)) return { error: "Category is required." };
  const category = b.category.trim();

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

apiRouter.get(
  "/products",
  asyncHandler(async (_req, res) => {
    const products = await listProducts();
    res.json(products);
  }),
);

apiRouter.get(
  "/products/:id",
  asyncHandler(async (req, res) => {
    const product = await getProduct(req.params.id);
    if (!product) {
      res.status(404).json({ error: "Product not found." });
      return;
    }
    res.json(product);
  }),
);

apiRouter.post(
  "/products",
  asyncHandler(async (req, res) => {
    const result = validateProductInput(req.body);
    if ("error" in result) {
      res.status(400).json({ error: result.error });
      return;
    }
    try {
      const product = await createProduct(result.data);
      res.status(201).json(product);
    } catch (err) {
      if (err instanceof ImageTooLargeError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }
  }),
);

apiRouter.put(
  "/products/:id",
  asyncHandler(async (req, res) => {
    const result = validateProductInput(req.body);
    if ("error" in result) {
      res.status(400).json({ error: result.error });
      return;
    }
    try {
      const product = await updateProduct(req.params.id, result.data);
      if (!product) {
        res.status(404).json({ error: "Product not found." });
        return;
      }
      res.json(product);
    } catch (err) {
      if (err instanceof ImageTooLargeError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }
  }),
);

apiRouter.delete(
  "/products/:id",
  asyncHandler(async (req, res) => {
    const ok = await deleteProduct(req.params.id);
    if (!ok) {
      res.status(404).json({ error: "Product not found." });
      return;
    }
    res.status(204).end();
  }),
);

apiRouter.get(
  "/categories",
  asyncHandler(async (_req, res) => {
    const categories = await listCategories();
    res.json(categories);
  }),
);

apiRouter.post(
  "/categories",
  asyncHandler(async (req, res) => {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) {
      res.status(400).json({ error: "Category name is required." });
      return;
    }
    const existing = await findCategoryByName(name);
    if (existing) {
      res.status(409).json({ error: "A category with this name already exists." });
      return;
    }
    const category = await createCategory(name);
    res.status(201).json(category);
  }),
);

apiRouter.put(
  "/categories/:id",
  asyncHandler(async (req, res) => {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) {
      res.status(400).json({ error: "Category name is required." });
      return;
    }
    const existing = await findCategoryByName(name);
    if (existing && existing.id !== req.params.id) {
      res.status(409).json({ error: "A category with this name already exists." });
      return;
    }
    const category = await updateCategory(req.params.id, name);
    if (!category) {
      res.status(404).json({ error: "Category not found." });
      return;
    }
    res.json(category);
  }),
);

apiRouter.delete(
  "/categories/:id",
  asyncHandler(async (req, res) => {
    const ok = await deleteCategory(req.params.id);
    if (!ok) {
      res.status(404).json({ error: "Category not found." });
      return;
    }
    res.status(204).end();
  }),
);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
apiRouter.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Server error. Please try again later." });
});
