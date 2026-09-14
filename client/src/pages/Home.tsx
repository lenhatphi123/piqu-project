/**
 * Inventory Studio design reminder: editorial utility; ivory records, charcoal rail,
 * ceramic-orange actions, DM Sans + DM Serif Display.
 */
import "./inventory-enhancements.css";
import { useEffect, useMemo, useRef, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import ExcelJS from "exceljs";
import { Link } from "wouter";
import { ConfirmDialog, type ConfirmDialogState } from "@/components/ConfirmDialog";
import {
  Box,
  Camera,
  Check,
  ChevronDown,
  CircleHelp,
  Download,
  Edit3,
  ImageOff,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  createProduct as apiCreateProduct,
  deleteProduct as apiDeleteProduct,
  fetchCategories,
  fetchProducts,
  updateProduct as apiUpdateProduct,
  type Category,
  type Product,
  type ProductInput,
} from "@/lib/api";
import { computeImageEmbedding, cosineSimilarity } from "@/lib/imageSearch";

/**
 * Below this cosine similarity, a photo match is considered "not found".
 * MobileNet's raw embeddings don't separate similarly-posed/lit product photos
 * well — pairwise similarity between genuinely different products in this
 * catalog ranged ~0.28-0.51, while identical photos scored ~1.0. The threshold
 * sits high, above that noisy band, to favor fewer false positives.
 */
const PHOTO_MATCH_THRESHOLD = 0.75;

/** Inline SVG logo, no dependency on an external storage service. */
function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" role="img" aria-label="Inventory" focusable="false">
      <rect width="34" height="34" rx="4" fill="#202422" />
      <path d="M8 13.2 17 8.5l9 4.7v8.1L17 26l-9-4.7v-8.1Z" fill="none" stroke="#e85d35" strokeWidth="1.9" strokeLinejoin="round" />
      <path d="m8 13.2 9 4.7 9-4.7M17 17.9V26" fill="none" stroke="#e85d35" strokeWidth="1.9" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Upload size limit (the image is embedded straight into state as a data URL).
 * Images are stored as base64 directly in the Firestore document (~1MB/document limit),
 * so this must stay well below that limit.
 */
const MAX_IMAGE_BYTES = 500 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the file"));
    reader.readAsDataURL(file);
  });

const loadImage = (dataUrl: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode the image file"));
    img.src = dataUrl;
  });

const dataUrlByteLength = (dataUrl: string) => {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
};

/**
 * Downscales and re-encodes an image until it fits under maxBytes, by
 * progressively shrinking dimensions and JPEG quality. Runs entirely
 * client-side via canvas; returns the original file untouched if it
 * already fits.
 */
const compressImageToFit = async (file: File, maxBytes: number): Promise<string> => {
  const original = await readFileAsDataUrl(file);
  if (file.size <= maxBytes) return original;

  const img = await loadImage(original);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return original;

  let { width, height } = img;
  let quality = 0.9;
  let result = original;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    result = canvas.toDataURL("image/jpeg", quality);

    if (dataUrlByteLength(result) <= maxBytes) return result;

    // Alternate between reducing quality and shrinking dimensions.
    if (quality > 0.5) {
      quality -= 0.15;
    } else {
      width *= 0.75;
      height *= 0.75;
    }
  }

  return result;
};

/** Product image tile: shows the image if present, otherwise a placeholder. */
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

/** Settings menu (Excel export, ...), shared between the desktop rail and the mobile topbar. */
function SettingsMenu({
  products,
  triggerClassName,
  side,
  showLabel,
  onError,
  pendingEmbeddingCount,
  onBackfillEmbeddings,
  backfillRunning,
}: {
  products: Product[];
  triggerClassName: string;
  side: "right" | "bottom";
  showLabel?: boolean;
  onError: (message: string) => void;
  pendingEmbeddingCount: number;
  onBackfillEmbeddings: () => void;
  backfillRunning: boolean;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className={triggerClassName} aria-label="Settings">
          <Settings size={19} strokeWidth={1.8} />
          {showLabel && <span>Settings</span>}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="filter-menu"
          side={side}
          align="end"
          sideOffset={10}
          collisionPadding={12}
          avoidCollisions
        >
          <DropdownMenu.Item
            className="filter-menu-item"
            onSelect={() => {
              void exportProductsToExcel(products).catch(() =>
                onError("Could not create the Excel file. Please try again."),
              );
            }}
          >
            <Download size={15} style={{ marginRight: 8 }} />
            Download Excel file (.xlsx)
          </DropdownMenu.Item>
          {pendingEmbeddingCount > 0 && (
            <DropdownMenu.Item
              className="filter-menu-item"
              disabled={backfillRunning}
              onSelect={(event) => {
                event.preventDefault();
                onBackfillEmbeddings();
              }}
            >
              <Camera size={15} style={{ marginRight: 8 }} />
              {backfillRunning
                ? "Enabling photo search…"
                : `Enable photo search for ${pendingEmbeddingCount} existing product${pendingEmbeddingCount === 1 ? "" : "s"}`}
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

const emptyDraft = (defaultCategory = ""): Product => ({
  id: "",
  name: "",
  code: "",
  image: "",
  imageEmbedding: [],
  priceVnd: "",
  originalPrice: "",
  category: defaultCategory,
  size: "",
  updated: "",
  createdAt: "",
});

const formatUpdated = (iso: string) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/** Extracts the image format (jpeg/png/gif) from a data URL so ExcelJS knows how to embed it. */
function imageExtensionFromDataUrl(dataUrl: string): "jpeg" | "png" | "gif" | null {
  const match = /^data:image\/(jpeg|jpg|png|gif)/i.exec(dataUrl);
  if (!match) return null;
  const type = match[1].toLowerCase();
  return type === "jpg" ? "jpeg" : (type as "jpeg" | "png" | "gif");
}

const ROW_HEIGHT = 56;
const IMAGE_COLUMN_WIDTH = 12;

/** Exports all currently visible inventory data to an Excel (.xlsx) file, including each product's image. */
async function exportProductsToExcel(products: Product[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Inventory");

  sheet.columns = [
    { header: "Image", key: "image", width: IMAGE_COLUMN_WIDTH },
    { header: "Product Code", key: "code", width: 16 },
    { header: "Product Name", key: "name", width: 28 },
    { header: "Sale Price", key: "priceVnd", width: 14 },
    { header: "Cost Price", key: "originalPrice", width: 14 },
    { header: "Size", key: "size", width: 10 },
    { header: "Category", key: "category", width: 16 },
    { header: "Updated At", key: "updated", width: 18 },
  ];
  sheet.getRow(1).font = { bold: true };

  products.forEach((product, index) => {
    const rowNumber = index + 2;
    sheet.addRow({
      code: product.code,
      name: product.name,
      priceVnd: product.priceVnd,
      originalPrice: product.originalPrice,
      size: product.size,
      category: product.category,
      updated: formatUpdated(product.updated),
    });
    sheet.getRow(rowNumber).height = ROW_HEIGHT;

    const extension = product.image ? imageExtensionFromDataUrl(product.image) : null;
    if (extension) {
      const imageId = workbook.addImage({ base64: product.image, extension });
      sheet.addImage(imageId, {
        tl: { col: 0.1, row: rowNumber - 1 + 0.1 },
        ext: { width: 52, height: 52 },
        editAs: "oneCell",
      });
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().slice(0, 10);
  const link = document.createElement("a");
  link.href = url;
  link.download = `inventory-${timestamp}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Product>(emptyDraft());
  const [imageError, setImageError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dialog, setDialog] = useState<ConfirmDialogState | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoQuery, setPhotoQuery] = useState<{ image: string; scores: Map<string, number> } | null>(null);
  const [photoSearching, setPhotoSearching] = useState(false);
  const [photoSearchError, setPhotoSearchError] = useState("");
  const [backfillRunning, setBackfillRunning] = useState(false);

  const pendingEmbeddingCount = useMemo(
    () => products.filter((product) => product.image && product.imageEmbedding.length === 0).length,
    [products],
  );

  const backfillEmbeddings = async () => {
    setBackfillRunning(true);
    try {
      const targets = products.filter((product) => product.image && product.imageEmbedding.length === 0);
      for (const product of targets) {
        try {
          const embedding = await computeImageEmbedding(product.image);
          const updated = await apiUpdateProduct(product.id, {
            name: product.name,
            code: product.code,
            image: product.image,
            imageEmbedding: embedding,
            priceVnd: product.priceVnd,
            originalPrice: product.originalPrice,
            category: product.category,
            size: product.size,
          });
          setProducts((current) => current.map((item) => (item.id === product.id ? updated : item)));
        } catch {
          // Skip products whose image fails to decode/embed; leave them for a future retry.
        }
      }
    } finally {
      setBackfillRunning(false);
    }
  };

  const notify = (message: string) => setDialog({ title: "Something went wrong", message, confirmLabel: null });

  const categoryNames = useMemo(() => categories.map((category) => category.name), [categories]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    Promise.all([fetchProducts(), fetchCategories()])
      .then(([productData, categoryData]) => {
        if (cancelled) return;
        setProducts(productData);
        setCategories(categoryData);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Could not load data.");
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
    const byFilters = products.filter((product) => {
      const matchesCategory = categoryFilter === "All" || product.category === categoryFilter;
      const matchesSearch =
        !normalized ||
        [product.name, product.code, product.category].some((item) =>
          item.toLowerCase().includes(normalized),
        );
      return matchesCategory && matchesSearch;
    });

    if (!photoQuery) return byFilters;

    const { scores } = photoQuery;
    return byFilters
      .filter((product) => (scores.get(product.id) ?? 0) >= PHOTO_MATCH_THRESHOLD)
      .sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0));
  }, [products, search, categoryFilter, photoQuery]);

  const openNewProduct = () => {
    setEditingId(null);
    setDraft(emptyDraft(categoryNames[0] ?? ""));
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
      setImageError("Only JPG, PNG, WEBP, GIF, or AVIF image files are accepted.");
      return;
    }

    try {
      const dataUrl = await compressImageToFit(file, MAX_IMAGE_BYTES);
      if (dataUrlByteLength(dataUrl) > MAX_IMAGE_BYTES) {
        setImageError("This image is too large to compress under 500KB. Please choose a smaller image.");
        return;
      }
      setDraft((current) => ({ ...current, image: dataUrl, imageEmbedding: [] }));
      setImageError("");
      // Computed in the background so it doesn't block the upload UI; saving
      // before it resolves just means "search by photo" won't find this item yet.
      computeImageEmbedding(dataUrl)
        .then((embedding) => setDraft((current) => (current.image === dataUrl ? { ...current, imageEmbedding: embedding } : current)))
        .catch(() => {
          /* Non-critical: product still saves fine, just won't match photo search. */
        });
    } catch {
      setImageError("Could not process the image file. Please try another one.");
    }
  };

  const onFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    void acceptImageFile(event.target.files?.[0]);
    // Allow re-selecting the same file that was just removed.
    event.target.value = "";
  };

  const searchByPhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setPhotoSearchError("Only JPG, PNG, WEBP, GIF, or AVIF image files are accepted.");
      return;
    }

    setPhotoSearching(true);
    setPhotoSearchError("");
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const queryEmbedding = await computeImageEmbedding(dataUrl);
      const scores = new Map<string, number>();
      for (const product of products) {
        if (product.imageEmbedding.length) {
          scores.set(product.id, cosineSimilarity(queryEmbedding, product.imageEmbedding));
        }
      }
      setPhotoQuery({ image: dataUrl, scores });
      setSearch("");
    } catch {
      setPhotoSearchError("Could not analyze this photo. Please try another one.");
    } finally {
      setPhotoSearching(false);
    }
  };

  const onPhotoInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    void searchByPhoto(event.target.files?.[0]);
    event.target.value = "";
  };

  const clearPhotoQuery = () => {
    setPhotoQuery(null);
    setPhotoSearchError("");
  };

  const onImageDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    void acceptImageFile(event.dataTransfer.files?.[0]);
  };

  const removeDraftImage = () => {
    setDraft((current) => ({ ...current, image: "", imageEmbedding: [] }));
    setImageError("");
  };

  const saveProduct = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.name.trim() || !draft.priceVnd.trim()) return;

    const input: ProductInput = {
      name: draft.name,
      code: draft.code,
      image: draft.image,
      imageEmbedding: draft.imageEmbedding,
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
      setFormError(err instanceof Error ? err.message : "Could not save the product.");
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = (product: Product) => {
    setDialog({
      title: "Remove product",
      message: `Remove "${product.name}" from the catalog?`,
      confirmLabel: "Remove",
      onConfirm: async () => {
        const previous = products;
        setProducts((current) => current.filter((item) => item.id !== product.id));
        try {
          await apiDeleteProduct(product.id);
        } catch (err) {
          setProducts(previous);
          notify(err instanceof Error ? err.message : "Could not delete the product.");
        }
      },
    });
  };

  return (
    <main className="inventory-app">
      <aside className="brand-rail">
        <span className="mark-button" aria-hidden="true">
          <BrandMark />
        </span>
        <nav className="rail-nav" aria-label="Main navigation">
          <span className="rail-item active">
            <Box size={19} strokeWidth={1.8} />
            <span>Inventory</span>
          </span>
          <Link href="/categories" className="rail-item">
            <Tag size={19} strokeWidth={1.8} />
            <span>Categories</span>
          </Link>
        </nav>
        <div className="rail-footer">
          <SettingsMenu
            products={products}
            triggerClassName="rail-help"
            side="right"
            onError={notify}
            pendingEmbeddingCount={pendingEmbeddingCount}
            onBackfillEmbeddings={() => void backfillEmbeddings()}
            backfillRunning={backfillRunning}
          />
          <button className="rail-help" aria-label="Help">
            <CircleHelp size={19} strokeWidth={1.8} />
          </button>
        </div>
      </aside>

      <section className="app-shell">
        <header className="topbar">
          <span className="desk-mark">
            <BrandMark />
            <span>
              <b>PiQu</b><small>PRODUCT RECORDS</small>
            </span>
          </span>
          <span className="mobile-mark">
            <BrandMark />
            <span>PiQu</span>
          </span>
          <nav className="mobile-tabs" aria-label="Main navigation">
            <span className="mobile-tab active">
              <Box size={18} strokeWidth={1.8} />
              <span>Inventory</span>
            </span>
            <Link href="/categories" className="mobile-tab">
              <Tag size={18} strokeWidth={1.8} />
              <span>Categories</span>
            </Link>
            <SettingsMenu
              products={products}
              triggerClassName="mobile-tab settings-tab"
              side="bottom"
              showLabel
              onError={notify}
              pendingEmbeddingCount={pendingEmbeddingCount}
              onBackfillEmbeddings={() => void backfillEmbeddings()}
              backfillRunning={backfillRunning}
            />
          </nav>
          <div className="topbar-context">
            <SettingsMenu
              products={products}
              triggerClassName="topbar-settings"
              side="bottom"
              onError={notify}
              pendingEmbeddingCount={pendingEmbeddingCount}
              onBackfillEmbeddings={() => void backfillEmbeddings()}
              backfillRunning={backfillRunning}
            />
          </div>
        </header>

        <section className="screen screen-manage">
          <div className="manage-header">
            <div>
              <span className="eyebrow compact">
                <span /> INVENTORY RECORDS
              </span>
              <h1>Product Inventory</h1>
              <p>Internal catalog · {filteredProducts.length} records shown</p>
            </div>
            <div className="manage-actions">
              <div className="ledger-seal">
                <BrandMark />
                <span>
                  <b>PiQu</b>
                  <small>Inventory catalog</small>
                </span>
              </div>
              <button className="add-product" onClick={openNewProduct}>
                <Plus size={18} /> Add Product
              </button>
            </div>
          </div>

          <div className="management-tools">
            <label className="search-field">
              <Search size={18} />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  if (photoQuery) clearPhotoQuery();
                }}
                placeholder="Search by name, code, or category"
              />
            </label>
            <button
              type="button"
              className="filter-chip"
              aria-label="Search by photo"
              onClick={() => photoInputRef.current?.click()}
              disabled={photoSearching}
            >
              {photoSearching ? <Loader2 size={16} className="spin" /> : <Camera size={16} />}
              <span>{photoSearching ? "Analyzing…" : "Search by photo"}</span>
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              capture="environment"
              onChange={onPhotoInputChange}
              hidden
            />
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button type="button" className="filter-chip" aria-label="Filter by product category">
                  <span>{categoryFilter === "All" ? "All categories" : categoryFilter}</span>
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
                  {["All", ...categoryNames].map((category) => (
                    <DropdownMenu.Item
                      key={category}
                      className={category === categoryFilter ? "filter-menu-item active" : "filter-menu-item"}
                      onSelect={() => setCategoryFilter(category)}
                    >
                      {category === "All" ? "All categories" : category}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>

          {photoSearchError && (
            <div className="empty-state" role="alert">
              <b>Photo search failed</b>
              <span>{photoSearchError}</span>
            </div>
          )}

          {photoQuery && !photoSearchError && (
            <div className="photo-query-banner">
              <img src={photoQuery.image} alt="Search photo" />
              <span>
                Showing products that match this photo
                {filteredProducts.length ? ` · ${filteredProducts.length} match${filteredProducts.length === 1 ? "" : "es"}` : " · no close matches found"}
              </span>
              <button type="button" onClick={clearPhotoQuery} aria-label="Clear photo search">
                <X size={15} /> Clear
              </button>
            </div>
          )}

          <div className="ledger-band">
            <span>
              <i /> LIVE TRACKING
            </span>
          </div>

          {loadError && (
            <div className="empty-state" role="alert">
              <b>Could not load data</b>
              <span>{loadError}</span>
            </div>
          )}

          {loading ? (
            <div className="empty-state">
              <Loader2 size={24} className="spin" />
              <b>Loading data…</b>
            </div>
          ) : (
          <div className="product-list" role="list">
            <div className="list-heading">
              <span>PRODUCT</span>
              <span>SALE PRICE</span>
              <span>COST PRICE</span>
              <span>SIZE</span>
              <span>CATEGORY</span>
              <span>UPDATED</span>
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
                      {photoQuery && (
                        <small className="match-score">
                          {Math.round((photoQuery.scores.get(product.id) ?? 0) * 100)}% photo match
                        </small>
                      )}
                    </span>
                  </button>
                  <strong className="row-price">{product.priceVnd}</strong>
                  <strong className="row-price">{product.originalPrice}</strong>
                  <span className="row-size">{product.size}</span>
                  <span className="row-category">{product.category}</span>
                  <span className="row-time">{formatUpdated(product.updated)}</span>
                  <div className="row-actions">
                    <button aria-label={`Edit ${product.name}`} onClick={() => openEditProduct(product)}>
                      <Edit3 size={17} />
                    </button>
                    <button
                      className="delete"
                      aria-label={`Delete ${product.name}`}
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
                <b>No matching records found</b>
                <span>Try a different search term or add a new product.</span>
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
                  <span /> INVENTORY RECORDS
                </span>
                <h2>{editingId ? "Edit Product" : "Add New Product"}</h2>
              </div>
              <button
                type="button"
                className="icon-close"
                onClick={() => setEditorOpen(false)}
                aria-label="Close"
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
                <ProductImage className="upload-preview" src={draft.image} alt="Selected product image" />
                <div className="upload-body">
                  <b>Cover Image</b>
                  <span>
                    {draft.image
                      ? "Image selected. You can change or remove it."
                      : "Drag and drop an image here, or choose a file from your device (JPG, PNG, WEBP · larger images are auto-compressed to fit 500KB)."}
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
                      <Upload size={15} /> {draft.image ? "Change Image" : "Choose Image"}
                    </button>
                    {draft.image && (
                      <button type="button" className="upload-remove" onClick={removeDraftImage}>
                        <Trash2 size={15} /> Remove Image
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
                  <span>Product Name *</span>
                  <input
                    required
                    value={draft.name}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    placeholder="e.g.: Bi-Xanh 03"
                  />
                </label>
                <label>
                  <span>Product Code (NO)</span>
                  <input
                    value={draft.code}
                    onChange={(event) => setDraft({ ...draft, code: event.target.value })}
                    placeholder="BKN-001"
                  />
                </label>
                <label>
                  <span>Category *</span>
                  <select
                    required
                    value={draft.category}
                    onChange={(event) => setDraft({ ...draft, category: event.target.value })}
                  >
                    {categoryNames.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Sale Price *</span>
                  <input
                    required
                    value={draft.priceVnd}
                    onChange={(event) => setDraft({ ...draft, priceVnd: event.target.value })}
                    placeholder="490.000 ₫"
                  />
                </label>
                <label>
                  <span>Cost Price</span>
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
                Cancel
              </button>
              <button className="save" type="submit" disabled={saving}>
                <Check size={17} /> {saving ? "Saving…" : editingId ? "Save Changes" : "Save Product"}
              </button>
            </div>
          </form>
        </div>
      )}

      {dialog && <ConfirmDialog state={dialog} onClose={() => setDialog(null)} />}
    </main>
  );
}
