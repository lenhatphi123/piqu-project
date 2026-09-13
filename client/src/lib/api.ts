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

export type ProductInput = Omit<Product, "id" | "updated" | "createdAt">;

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.error === "string") return body.error;
  } catch {
    /* fallthrough */
  }
  return `Yêu cầu thất bại (HTTP ${res.status}).`;
}

export async function fetchProducts(): Promise<Product[]> {
  const res = await fetch("/api/products");
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const res = await fetch("/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export async function updateProduct(id: string, input: ProductInput): Promise<Product> {
  const res = await fetch(`/api/products/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export async function deleteProduct(id: string): Promise<void> {
  const res = await fetch(`/api/products/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) throw new Error(await parseErrorMessage(res));
}
