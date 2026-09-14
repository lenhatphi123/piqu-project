import { getDb } from "./firebase.js";

const COLLECTION = "products";

// Firestore giới hạn ~1MB/document. Ảnh lưu base64 ngay trong document nên
// phải giới hạn chặt hơn giới hạn phía client (2MB) để có chỗ cho base64
// (~4/3 kích thước gốc) cộng các trường khác.
const MAX_IMAGE_BASE64_BYTES = 700 * 1024;

export type Product = {
  id: string;
  name: string;
  /** Mã sản phẩm (NO). */
  code: string;
  /** Data URL (base64) của ảnh sản phẩm, lưu trực tiếp trong Firestore; rỗng nghĩa là chưa có ảnh. */
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

type ProductDoc = Omit<Product, "id">;

export class ImageTooLargeError extends Error {
  constructor() {
    super("Ảnh quá lớn để lưu (tối đa ~500KB). Hãy chọn ảnh nhỏ hơn hoặc nén lại.");
    this.name = "ImageTooLargeError";
  }
}

function assertImageSize(image: string): void {
  if (image && image.startsWith("data:") && image.length > MAX_IMAGE_BASE64_BYTES) {
    throw new ImageTooLargeError();
  }
}

function toProduct(id: string, data: FirebaseFirestore.DocumentData): Product {
  return {
    id,
    name: data.name ?? "",
    code: data.code ?? "",
    image: data.image ?? "",
    priceVnd: data.priceVnd ?? "",
    originalPrice: data.originalPrice ?? "",
    category: data.category ?? "",
    size: data.size ?? "",
    updated: data.updated ?? "",
    createdAt: data.createdAt ?? "",
  };
}

export async function listProducts(): Promise<Product[]> {
  const snapshot = await getDb().collection(COLLECTION).orderBy("createdAt", "desc").get();
  return snapshot.docs.map((doc) => toProduct(doc.id, doc.data()));
}

export async function getProduct(id: string): Promise<Product | undefined> {
  const doc = await getDb().collection(COLLECTION).doc(id).get();
  if (!doc.exists) return undefined;
  return toProduct(doc.id, doc.data()!);
}

export async function createProduct(
  input: Omit<Product, "id" | "updated" | "createdAt">,
): Promise<Product> {
  assertImageSize(input.image);

  const db = getDb();
  const ref = db.collection(COLLECTION).doc();
  const now = new Date().toISOString();

  const doc: ProductDoc = {
    ...input,
    updated: now,
    createdAt: now,
  };
  await ref.set(doc);
  return { id: ref.id, ...doc };
}

export async function updateProduct(
  id: string,
  input: Partial<Omit<Product, "id" | "createdAt">>,
): Promise<Product | undefined> {
  if (input.image !== undefined) assertImageSize(input.image);

  const ref = getDb().collection(COLLECTION).doc(id);
  const existing = await ref.get();
  if (!existing.exists) return undefined;

  const current = toProduct(existing.id, existing.data()!);

  const updated: ProductDoc = {
    name: input.name ?? current.name,
    code: input.code ?? current.code,
    image: input.image ?? current.image,
    priceVnd: input.priceVnd ?? current.priceVnd,
    originalPrice: input.originalPrice ?? current.originalPrice,
    category: input.category ?? current.category,
    size: input.size ?? current.size,
    createdAt: current.createdAt,
    updated: new Date().toISOString(),
  };

  await ref.set(updated);
  return { id, ...updated };
}

export async function deleteProduct(id: string): Promise<boolean> {
  const ref = getDb().collection(COLLECTION).doc(id);
  const existing = await ref.get();
  if (!existing.exists) return false;
  await ref.delete();
  return true;
}
