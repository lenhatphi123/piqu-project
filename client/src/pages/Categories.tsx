/**
 * Inventory Studio design reminder: editorial utility; ivory records, charcoal rail,
 * ceramic-orange actions, DM Sans + DM Serif Display. Reuses the shell/list/modal
 * styles defined for the product inventory screen.
 */
import "./inventory-enhancements.css";
import "./categories.css";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Box, Check, CircleHelp, Edit3, Loader2, Plus, Search, Settings, Tag, Trash2, X } from "lucide-react";
import {
  createCategory as apiCreateCategory,
  deleteCategory as apiDeleteCategory,
  fetchCategories,
  updateCategory as apiUpdateCategory,
  type Category,
} from "@/lib/api";
import { ConfirmDialog, type ConfirmDialogState } from "@/components/ConfirmDialog";

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

/** Settings menu placeholder (no categories-specific actions yet). */
function SettingsMenu({ triggerClassName, showLabel }: { triggerClassName: string; showLabel?: boolean }) {
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
          side="bottom"
          align="end"
          sideOffset={10}
          collisionPadding={12}
          avoidCollisions
        >
          <span className="filter-menu-item filter-menu-empty">More settings coming soon</span>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

const formatCreated = (iso: string) => {
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

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [dialog, setDialog] = useState<ConfirmDialogState | null>(null);

  const notify = (message: string) => setDialog({ title: "Something went wrong", message, confirmLabel: null });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    fetchCategories()
      .then((data) => {
        if (!cancelled) setCategories(data);
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

  const filteredCategories = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return categories;
    return categories.filter((category) => category.name.toLowerCase().includes(normalized));
  }, [categories, search]);

  const openNewCategory = () => {
    setEditingId(null);
    setNameDraft("");
    setFormError("");
    setEditorOpen(true);
  };

  const openEditCategory = (category: Category) => {
    setEditingId(category.id);
    setNameDraft(category.name);
    setFormError("");
    setEditorOpen(true);
  };

  const saveCategory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = nameDraft.trim();
    if (!name) return;

    setSaving(true);
    setFormError("");
    try {
      if (editingId) {
        const updated = await apiUpdateCategory(editingId, name);
        setCategories((current) => current.map((item) => (item.id === editingId ? updated : item)));
      } else {
        const created = await apiCreateCategory(name);
        setCategories((current) => [...current, created]);
      }
      setEditorOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save the category.");
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = (category: Category) => {
    setDialog({
      title: "Remove category",
      message: `Remove "${category.name}" from the category list?`,
      confirmLabel: "Remove",
      onConfirm: async () => {
        const previous = categories;
        setCategories((current) => current.filter((item) => item.id !== category.id));
        try {
          await apiDeleteCategory(category.id);
        } catch (err) {
          setCategories(previous);
          notify(err instanceof Error ? err.message : "Could not delete the category.");
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
          <Link href="/" className="rail-item">
            <Box size={19} strokeWidth={1.8} />
            <span>Inventory</span>
          </Link>
          <Link href="/categories" className="rail-item active">
            <Tag size={19} strokeWidth={1.8} />
            <span>Categories</span>
          </Link>
        </nav>
        <div className="rail-footer">
          <SettingsMenu triggerClassName="rail-help" />
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
            <Link href="/" className="mobile-tab">
              <Box size={18} strokeWidth={1.8} />
              <span>Inventory</span>
            </Link>
            <span className="mobile-tab active">
              <Tag size={18} strokeWidth={1.8} />
              <span>Categories</span>
            </span>
            <SettingsMenu triggerClassName="mobile-tab settings-tab" showLabel />
          </nav>
          <div className="topbar-context">
            <SettingsMenu triggerClassName="topbar-settings" />
          </div>
        </header>

        <section className="screen screen-manage">
          <div className="manage-header">
            <div>
              <span className="eyebrow compact">
                <span /> CATALOG SETUP
              </span>
              <h1>Categories</h1>
              <p>Internal catalog · {filteredCategories.length} categories shown</p>
            </div>
            <div className="manage-actions">
              <div className="ledger-seal">
                <BrandMark />
                <span>
                  <b>PiQu</b>
                  <small>Inventory catalog</small>
                </span>
              </div>
              <button className="add-product" onClick={openNewCategory}>
                <Plus size={18} /> Add Category
              </button>
            </div>
          </div>

          <div className="management-tools">
            <label className="search-field">
              <Search size={18} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search categories"
              />
            </label>
          </div>

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
            <div className="product-list category-list" role="list">
              <div className="list-heading category-heading">
                <span>CATEGORY</span>
                <span>CREATED</span>
                <span />
              </div>
              {filteredCategories.length ? (
                filteredCategories.map((category) => (
                  <article className="product-row category-row" key={category.id} role="listitem">
                    <button className="row-product" onClick={() => openEditCategory(category)}>
                      <span>
                        <b>{category.name}</b>
                      </span>
                    </button>
                    <span className="row-time">{formatCreated(category.createdAt)}</span>
                    <div className="row-actions">
                      <button aria-label={`Edit ${category.name}`} onClick={() => openEditCategory(category)}>
                        <Edit3 size={17} />
                      </button>
                      <button
                        className="delete"
                        aria-label={`Delete ${category.name}`}
                        onClick={() => deleteCategory(category)}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-state">
                  <Search size={24} />
                  <b>No matching categories found</b>
                  <span>Try a different search term or add a new category.</span>
                </div>
              )}
            </div>
          )}
        </section>
      </section>

      {editorOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setEditorOpen(false)}>
          <form
            className="editor-modal category-editor-modal"
            onSubmit={saveCategory}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-title">
              <div>
                <span className="eyebrow compact">
                  <span /> CATALOG SETUP
                </span>
                <h2>{editingId ? "Edit Category" : "Add New Category"}</h2>
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
            <div className="editor-body category-editor-body">
              <div className="form-grid">
                <label className="wide">
                  <span>Category Name *</span>
                  <input
                    required
                    autoFocus
                    value={nameDraft}
                    onChange={(event) => setNameDraft(event.target.value)}
                    placeholder="e.g.: Shirt"
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
                <Check size={17} /> {saving ? "Saving…" : editingId ? "Save Changes" : "Save Category"}
              </button>
            </div>
          </form>
        </div>
      )}

      {dialog && <ConfirmDialog state={dialog} onClose={() => setDialog(null)} />}
    </main>
  );
}
