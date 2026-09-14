import { getDb } from "./firebase.js";
import { PRODUCT_CATEGORIES } from "../shared/const.js";

const COLLECTION = "categories";

export type Category = {
  id: string;
  name: string;
  createdAt: string;
};

type CategoryDoc = Omit<Category, "id">;

function toCategory(id: string, data: FirebaseFirestore.DocumentData): Category {
  return {
    id,
    name: data.name ?? "",
    createdAt: data.createdAt ?? "",
  };
}

/** Seeds the collection from the legacy hardcoded list the first time it's empty. */
async function ensureSeeded(): Promise<void> {
  const db = getDb();
  const snapshot = await db.collection(COLLECTION).limit(1).get();
  if (!snapshot.empty) return;

  const batch = db.batch();
  const now = new Date().toISOString();
  for (const name of PRODUCT_CATEGORIES) {
    const ref = db.collection(COLLECTION).doc();
    batch.set(ref, { name, createdAt: now } satisfies CategoryDoc);
  }
  await batch.commit();
}

export async function listCategories(): Promise<Category[]> {
  await ensureSeeded();
  const snapshot = await getDb().collection(COLLECTION).orderBy("name", "asc").get();
  return snapshot.docs.map((doc) => toCategory(doc.id, doc.data()));
}

export async function getCategory(id: string): Promise<Category | undefined> {
  const doc = await getDb().collection(COLLECTION).doc(id).get();
  if (!doc.exists) return undefined;
  return toCategory(doc.id, doc.data()!);
}

export async function findCategoryByName(name: string): Promise<Category | undefined> {
  const snapshot = await getDb()
    .collection(COLLECTION)
    .where("name", "==", name)
    .limit(1)
    .get();
  if (snapshot.empty) return undefined;
  const doc = snapshot.docs[0];
  return toCategory(doc.id, doc.data());
}

export async function createCategory(name: string): Promise<Category> {
  const db = getDb();
  const ref = db.collection(COLLECTION).doc();
  const doc: CategoryDoc = { name, createdAt: new Date().toISOString() };
  await ref.set(doc);
  return { id: ref.id, ...doc };
}

export async function updateCategory(id: string, name: string): Promise<Category | undefined> {
  const ref = getDb().collection(COLLECTION).doc(id);
  const existing = await ref.get();
  if (!existing.exists) return undefined;
  await ref.update({ name });
  return toCategory(id, { ...existing.data(), name });
}

export async function deleteCategory(id: string): Promise<boolean> {
  const ref = getDb().collection(COLLECTION).doc(id);
  const existing = await ref.get();
  if (!existing.exists) return false;
  await ref.delete();
  return true;
}
