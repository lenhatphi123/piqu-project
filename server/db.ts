import { getDb } from "./firebase.js";

const COLLECTION = "products";

// Firestore limits documents to ~1MB. Images are stored as base64 directly in the
// document, so this must be tighter than the client-side limit (2MB) to leave
// room for the base64 overhead (~4/3 of the original size) plus the other fields.
const MAX_IMAGE_BASE64_BYTES = 700 * 1024;

export type Product = {
  id: string;
  name: string;
  /** Product code (NO). */
  code: string;
  /** Data URL (base64) of the product image, stored directly in Firestore; empty means no image yet. */
  image: string;
  /** MobileNet embedding vector of `image`, used for "search by photo"; empty when there's no image. */
  imageEmbedding: number[];
  /** Sale price. */
  priceVnd: string;
  /** Cost price (original purchase price). */
  originalPrice: string;
  category: string;
  size: string;
  updated: string;
  createdAt: string;
};

type ProductDoc = Omit<Product, "id">;

export class ImageTooLargeError extends Error {
  constructor() {
    super("Image is too large to save (max ~500KB). Please choose a smaller image or compress it.");
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
    imageEmbedding: Array.isArray(data.imageEmbedding) ? data.imageEmbedding : [],
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
  const updated: Partial<ProductDoc> = {
    ...input,
    updated: new Date().toISOString(),
  };

  // A single update() call instead of get()-then-set(): the caller always sends
  // the full form (see validateProductInput), so there's nothing to merge from
  // the existing document, and skipping the read halves the Firestore round trips.
  try {
    await ref.update(updated);
  } catch (err) {
    // Firestore throws (code 5, NOT_FOUND) when the document doesn't exist.
    if ((err as { code?: number }).code === 5) return undefined;
    throw err;
  }

  const fresh = await ref.get();
  return toProduct(fresh.id, fresh.data()!);
}

export async function deleteProduct(id: string): Promise<boolean> {
  const ref = getDb().collection(COLLECTION).doc(id);
  const existing = await ref.get();
  if (!existing.exists) return false;
  await ref.delete();
  return true;
}
