import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DATA_DIR = path.resolve(__dirname, "..", "data");
export const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");

export type Product = {
  id: string;
  name: string;
  /** Mã sản phẩm (NO). */
  code: string;
  /** Data URL (base64) của ảnh sản phẩm; rỗng nghĩa là chưa có ảnh. */
  image: string;
  /** Giá bán. */
  priceVnd: string;
  /** Giá mua (giá gốc nhập vào). */
  originalPrice: string;
  category: string;
  size: string;
  updated: string;
  createdAt: string;
};

async function ensureDataFile(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(PRODUCTS_FILE);
  } catch {
    await fs.writeFile(PRODUCTS_FILE, "[]", "utf-8");
  }
}

// Ghi tuần tự để tránh hai request ghi đè lẫn nhau khi đọc-sửa-ghi file JSON.
let writeQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(task);
  writeQueue = result.catch(() => undefined);
  return result;
}

export async function readProducts(): Promise<Product[]> {
  await ensureDataFile();
  const raw = await fs.readFile(PRODUCTS_FILE, "utf-8");
  try {
    return JSON.parse(raw) as Product[];
  } catch {
    return [];
  }
}

async function writeProducts(products: Product[]): Promise<void> {
  await ensureDataFile();
  const tmpFile = `${PRODUCTS_FILE}.tmp`;
  await fs.writeFile(tmpFile, JSON.stringify(products, null, 2), "utf-8");
  await fs.rename(tmpFile, PRODUCTS_FILE);
}

export function listProducts(): Promise<Product[]> {
  return enqueue(() => readProducts());
}

export function getProduct(id: string): Promise<Product | undefined> {
  return enqueue(async () => {
    const products = await readProducts();
    return products.find((p) => p.id === id);
  });
}

export function createProduct(
  input: Omit<Product, "id" | "updated" | "createdAt">,
): Promise<Product> {
  return enqueue(async () => {
    const products = await readProducts();
    const now = new Date().toISOString();
    const product: Product = {
      ...input,
      id: `p-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      updated: now,
      createdAt: now,
    };
    products.unshift(product);
    await writeProducts(products);
    return product;
  });
}

export function updateProduct(
  id: string,
  input: Partial<Omit<Product, "id" | "createdAt">>,
): Promise<Product | undefined> {
  return enqueue(async () => {
    const products = await readProducts();
    const index = products.findIndex((p) => p.id === id);
    if (index === -1) return undefined;

    const updated: Product = {
      ...products[index],
      ...input,
      id: products[index].id,
      createdAt: products[index].createdAt,
      updated: new Date().toISOString(),
    };
    products[index] = updated;
    await writeProducts(products);
    return updated;
  });
}

export function deleteProduct(id: string): Promise<boolean> {
  return enqueue(async () => {
    const products = await readProducts();
    const next = products.filter((p) => p.id !== id);
    if (next.length === products.length) return false;
    await writeProducts(next);
    return true;
  });
}
