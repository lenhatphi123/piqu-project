/**
 * Inventory Studio design reminder: editorial utility; ivory records, charcoal rail,
 * ceramic-orange actions, DM Sans + DM Serif Display.
 */
import "./inventory-enhancements.css";
import { useEffect, useMemo, useRef, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Box,
  Check,
  ChevronDown,
  CircleHelp,
  Edit3,
  ImageOff,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  createProduct as apiCreateProduct,
  deleteProduct as apiDeleteProduct,
  fetchProducts,
  updateProduct as apiUpdateProduct,
  type Product,
  type ProductInput,
} from "@/lib/api";
import { PRODUCT_CATEGORIES } from "@shared/const";

/** Logo dạng SVG nội tuyến, không phụ thuộc dịch vụ lưu trữ bên ngoài. */
function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" role="img" aria-label="Kho hàng" focusable="false">
      <rect width="34" height="34" rx="4" fill="#202422" />
      <path d="M8 13.2 17 8.5l9 4.7v8.1L17 26l-9-4.7v-8.1Z" fill="none" stroke="#e85d35" strokeWidth="1.9" strokeLinejoin="round" />
      <path d="m8 13.2 9 4.7 9-4.7M17 17.9V26" fill="none" stroke="#e85d35" strokeWidth="1.9" strokeLinejoin="round" />
    </svg>
  );
}

/** Giới hạn dung lượng ảnh tải lên (ảnh được nhúng thẳng vào state dưới dạng data URL). */
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Không đọc được tệp"));
    reader.readAsDataURL(file);
  });

/** Ô ảnh sản phẩm: hiện ảnh nếu có, nếu không thì hiện ô giữ chỗ. */
function ProductImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <span className={className ? `${className} is-empty` : "is-empty"} aria-hidden="true">
        <ImageOff size={16} strokeWidth={1.7} />
      </span>
    );
  }

  return (
    <span className={className}>
      <img src={src} alt={alt} onError={() => setFailed(true)} />
    </span>
  );
}

const emptyDraft = (): Product => ({
  id: "",
  name: "",
  code: "",
  image: "",
  priceVnd: "",
  originalPrice: "",
  category: PRODUCT_CATEGORIES[0],
  size: "",
  updated: "",
  createdAt: "",
});

const formatUpdated = (iso: string) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("Tất cả");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Product>(emptyDraft());
  const [imageError, setImageError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    fetchProducts()
      .then((data) => {
        if (!cancelled) setProducts(data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Không tải được dữ liệu.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredProducts = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory = categoryFilter === "Tất cả" || product.category === categoryFilter;
      const matchesSearch =
        !normalized ||
        [product.name, product.code, product.category].some((item) =>
          item.toLowerCase().includes(normalized),
        );
      return matchesCategory && matchesSearch;
    });
  }, [products, search, categoryFilter]);

  const openNewProduct = () => {
    setEditingId(null);
    setDraft(emptyDraft());
    setImageError("");
    setDragActive(false);
    setEditorOpen(true);
  };

  const openEditProduct = (product: Product) => {
    setEditingId(product.id);
    setDraft(product);
    setImageError("");
    setDragActive(false);
    setEditorOpen(true);
  };

  const acceptImageFile = async (file: File | undefined) => {
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setImageError("Chỉ nhận tệp ảnh JPG, PNG, WEBP, GIF hoặc AVIF.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      setImageError(`Ảnh ${mb}MB vượt giới hạn 2MB. Hãy chọn ảnh nhỏ hơn.`);
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setDraft((current) => ({ ...current, image: dataUrl }));
      setImageError("");
    } catch {
      setImageError("Không đọc được tệp ảnh. Hãy thử tệp khác.");
    }
  };

  const onFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    void acceptImageFile(event.target.files?.[0]);
    // Cho phép chọn lại đúng tệp vừa xóa.
    event.target.value = "";
  };

  const onImageDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    void acceptImageFile(event.dataTransfer.files?.[0]);
  };

  const removeDraftImage = () => {
    setDraft((current) => ({ ...current, image: "" }));
    setImageError("");
  };

  const saveProduct = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.name.trim() || !draft.priceVnd.trim()) return;

    const input: ProductInput = {
      name: draft.name,
      code: draft.code,
      image: draft.image,
      priceVnd: draft.priceVnd,
      originalPrice: draft.originalPrice,
      category: draft.category,
      size: draft.size,
    };

    setSaving(true);
    setFormError("");
    try {
      if (editingId) {
        const updated = await apiUpdateProduct(editingId, input);
        setProducts((current) => current.map((item) => (item.id === editingId ? updated : item)));
      } else {
        const created = await apiCreateProduct(input);
        setProducts((current) => [created, ...current]);
      }
      setEditorOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Không lưu được sản phẩm.");
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (product: Product) => {
    if (!window.confirm(`Xóa "${product.name}" khỏi danh mục?`)) return;
    const previous = products;
    setProducts((current) => current.filter((item) => item.id !== product.id));
    try {
      await apiDeleteProduct(product.id);
    } catch (err) {
      setProducts(previous);
      window.alert(err instanceof Error ? err.message : "Không xóa được sản phẩm.");
    }
  };

  return (
    <main className="inventory-app">
      <aside className="brand-rail">
        <span className="mark-button" aria-hidden="true">
          <BrandMark />
        </span>
        <nav className="rail-nav" aria-label="Điều hướng chính">
          <span className="rail-item active">
            <Box size={19} strokeWidth={1.8} />
            <span>Kho hàng</span>
          </span>
        </nav>
        <button className="rail-help" aria-label="Trợ giúp">
          <CircleHelp size={19} strokeWidth={1.8} />
        </button>
      </aside>

      <section className="app-shell">
        <header className="topbar">
          <span className="desk-mark">
            <BrandMark />
            <span>
              <b>KHO</b> HÀNG<small>HỒ SƠ SẢN PHẨM</small>
            </span>
          </span>
          <span className="mobile-mark">
            <BrandMark />
            <span>KHO HÀNG</span>
          </span>
          <div className="topbar-context">
            <span className="presence">
              <i /> Trực tuyến
            </span>
            <span className="account-initials">LN</span>
          </div>
        </header>

        <section className="screen screen-manage">
          <div className="manage-header">
            <div>
              <span className="eyebrow compact">
                <span /> HỒ SƠ KHO HÀNG
              </span>
              <h1>Kho sản phẩm</h1>
              <p>Danh mục nội bộ · {filteredProducts.length} hồ sơ đang hiển thị</p>
            </div>
            <div className="manage-actions">
              <div className="ledger-seal">
                <BrandMark />
                <span>
                  <b>HỒ SƠ NỘI BỘ</b>
                  <small>Danh mục kho hàng</small>
                </span>
              </div>
              <button className="add-product" onClick={openNewProduct}>
                <Plus size={18} /> Thêm sản phẩm
              </button>
            </div>
          </div>

          <div className="management-tools">
            <label className="search-field">
              <Search size={18} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm theo tên, mã hoặc nhóm hàng"
              />
            </label>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button type="button" className="filter-chip" aria-label="Lọc theo loại sản phẩm">
                  <span>{categoryFilter === "Tất cả" ? "Tất cả nhóm hàng" : categoryFilter}</span>
                  <ChevronDown size={15} />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="filter-menu"
                  align="end"
                  sideOffset={6}
                  collisionPadding={12}
                  avoidCollisions
                >
                  {["Tất cả", ...PRODUCT_CATEGORIES].map((category) => (
                    <DropdownMenu.Item
                      key={category}
                      className={category === categoryFilter ? "filter-menu-item active" : "filter-menu-item"}
                      onSelect={() => setCategoryFilter(category)}
                    >
                      {category === "Tất cả" ? "Tất cả nhóm hàng" : category}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>

          <div className="ledger-band">
            <span>
              <i /> ĐANG THEO DÕI
            </span>
          </div>

          {loadError && (
            <div className="empty-state" role="alert">
              <b>Không tải được dữ liệu</b>
              <span>{loadError}</span>
            </div>
          )}

          {loading ? (
            <div className="empty-state">
              <Loader2 size={24} className="spin" />
              <b>Đang tải dữ liệu…</b>
            </div>
          ) : (
          <div className="product-list" role="list">
            <div className="list-heading">
              <span>SẢN PHẨM</span>
              <span>GIÁ BÁN</span>
              <span>GIÁ MUA</span>
              <span>SIZE</span>
              <span>LOẠI</span>
              <span>CẬP NHẬT</span>
              <span />
            </div>
            {filteredProducts.length ? (
              filteredProducts.map((product) => (
                <article className="product-row" key={product.id} role="listitem">
                  <button className="row-product" onClick={() => openEditProduct(product)}>
                    <ProductImage className="product-thumb" src={product.image} alt="" />
                    <span>
                      <b>{product.name}</b>
                      <small>{product.code}</small>
                    </span>
                  </button>
                  <strong className="row-price">{product.priceVnd}</strong>
                  <strong className="row-price">{product.originalPrice}</strong>
                  <span className="row-size">{product.size}</span>
                  <span className="row-category">{product.category}</span>
                  <span className="row-time">{formatUpdated(product.updated)}</span>
                  <div className="row-actions">
                    <button aria-label={`Sửa ${product.name}`} onClick={() => openEditProduct(product)}>
                      <Edit3 size={17} />
                    </button>
                    <button
                      className="delete"
                      aria-label={`Xóa ${product.name}`}
                      onClick={() => deleteProduct(product)}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">
                <Search size={24} />
                <b>Không tìm thấy hồ sơ phù hợp</b>
                <span>Hãy thử một từ khóa khác hoặc thêm sản phẩm mới.</span>
              </div>
            )}
          </div>
          )}
        </section>
      </section>

      {editorOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setEditorOpen(false)}>
          <form
            className="editor-modal"
            onSubmit={saveProduct}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-title">
              <div>
                <span className="eyebrow compact">
                  <span /> HỒ SƠ KHO HÀNG
                </span>
                <h2>{editingId ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm mới"}</h2>
              </div>
              <button
                type="button"
                className="icon-close"
                onClick={() => setEditorOpen(false)}
                aria-label="Đóng"
              >
                <X size={20} />
              </button>
            </div>
            <div className="editor-body">
              <div
                className={
                  dragActive ? "form-image image-upload drag-over" : "form-image image-upload"
                }
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={onImageDrop}
              >
                <ProductImage className="upload-preview" src={draft.image} alt="Ảnh sản phẩm đã chọn" />
                <div className="upload-body">
                  <b>Ảnh đại diện</b>
                  <span>
                    {draft.image
                      ? "Đã chọn ảnh. Bạn có thể đổi ảnh khác hoặc xóa."
                      : "Kéo thả ảnh vào đây, hoặc chọn tệp từ máy (JPG, PNG, WEBP · tối đa 2MB)."}
                  </span>
                  {imageError && (
                    <span className="upload-error" role="alert">
                      {imageError}
                    </span>
                  )}
                  <div className="upload-actions">
                    <button
                      type="button"
                      className="upload-button"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload size={15} /> {draft.image ? "Đổi ảnh" : "Chọn ảnh"}
                    </button>
                    {draft.image && (
                      <button type="button" className="upload-remove" onClick={removeDraftImage}>
                        <Trash2 size={15} /> Xóa ảnh
                      </button>
                    )}
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES.join(",")}
                  onChange={onFileInputChange}
                  hidden
                />
              </div>
              <div className="form-grid">
                <label className="wide">
                  <span>Tên sản phẩm *</span>
                  <input
                    required
                    value={draft.name}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    placeholder="Ví dụ: Bi-Xanh 03"
                  />
                </label>
                <label>
                  <span>Mã sản phẩm (NO)</span>
                  <input
                    value={draft.code}
                    onChange={(event) => setDraft({ ...draft, code: event.target.value })}
                    placeholder="BKN-001"
                  />
                </label>
                <label>
                  <span>Loại *</span>
                  <select
                    required
                    value={draft.category}
                    onChange={(event) => setDraft({ ...draft, category: event.target.value })}
                  >
                    {PRODUCT_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Giá bán *</span>
                  <input
                    required
                    value={draft.priceVnd}
                    onChange={(event) => setDraft({ ...draft, priceVnd: event.target.value })}
                    placeholder="490.000 ₫"
                  />
                </label>
                <label>
                  <span>Giá mua</span>
                  <input
                    value={draft.originalPrice}
                    onChange={(event) => setDraft({ ...draft, originalPrice: event.target.value })}
                    placeholder="143.000 ₫"
                  />
                </label>
                <label>
                  <span>Size</span>
                  <input
                    value={draft.size}
                    onChange={(event) => setDraft({ ...draft, size: event.target.value })}
                    placeholder="1S, 1M, 1L"
                  />
                </label>
              </div>
            </div>
            {formError && (
              <p className="upload-error" role="alert">
                {formError}
              </p>
            )}
            <div className="modal-actions">
              <button type="button" className="cancel" onClick={() => setEditorOpen(false)}>
                Hủy
              </button>
              <button className="save" type="submit" disabled={saving}>
                <Check size={17} /> {saving ? "Đang lưu…" : editingId ? "Lưu thay đổi" : "Lưu sản phẩm"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
