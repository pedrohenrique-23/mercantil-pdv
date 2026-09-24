"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Archive,
  Check,
  Edit3,
  FolderPlus,
  Package,
  Plus,
  Search,
  X,
} from "lucide-react";
import {
  archiveCategory,
  archiveProduct,
  createCategory,
  createProduct,
  updateCategory,
  updateProduct,
} from "@/lib/catalog/actions";
import { productUnits, type Category, type Product } from "@/lib/catalog/types";

type Props = {
  initialCategories: Category[];
  initialProducts: Product[];
  initialError?: string;
};
type Notice = { kind: "success" | "error"; text: string } | null;

const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100
  );
const unitLabel = (unit: Product["unit"]) =>
  productUnits.find(item => item.value === unit)?.label ?? unit;

export default function CatalogPanel({
  initialCategories,
  initialProducts,
  initialError,
}: Props) {
  const [categories, setCategories] = useState(initialCategories);
  const [products, setProducts] = useState(initialProducts);
  const [search, setSearch] = useState("");
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [notice, setNotice] = useState<Notice>(
    initialError ? { kind: "error", text: initialError } : null
  );
  const [isPending, startTransition] = useTransition();

  const activeCategories = categories.filter(category => category.is_active);
  const activeProducts = products.filter(product => product.is_active);
  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return activeProducts;
    return activeProducts.filter(product =>
      `${product.name} ${product.barcode ?? ""} ${product.sku ?? ""}`
        .toLowerCase()
        .includes(query)
    );
  }, [activeProducts, search]);

  function showResult(result: {
    ok: boolean;
    message?: string;
    error?: string;
  }) {
    setNotice(
      result.ok
        ? { kind: "success", text: result.message ?? "Operação concluída." }
        : { kind: "error", text: result.error ?? "Não foi possível concluir." }
    );
  }

  function submitCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    startTransition(async () => {
      const result = editingCategory
        ? await updateCategory(new FormData(form))
        : await createCategory(new FormData(form));
      if (result.ok) {
        setCategories(current =>
          editingCategory
            ? current.map(item =>
                item.id === result.data.id ? result.data : item
              )
            : [...current, result.data].sort((a, b) =>
                a.name.localeCompare(b.name)
              )
        );
        setShowCategoryForm(false);
        setEditingCategory(null);
        form.reset();
      }
      showResult(result);
    });
  }

  function submitProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    startTransition(async () => {
      const result = editingProduct
        ? await updateProduct(new FormData(form))
        : await createProduct(new FormData(form));
      if (result.ok) {
        setProducts(current =>
          editingProduct
            ? current.map(item =>
                item.id === result.data.id ? result.data : item
              )
            : [...current, result.data].sort((a, b) =>
                a.name.localeCompare(b.name)
              )
        );
        setShowProductForm(false);
        setEditingProduct(null);
        form.reset();
      }
      showResult(result);
    });
  }

  function archiveProductFromList(product: Product) {
    const form = new FormData();
    form.set("id", product.id);
    startTransition(async () => {
      const result = await archiveProduct(form);
      if (result.ok)
        setProducts(current => current.filter(item => item.id !== product.id));
      showResult(result);
    });
  }

  function archiveCategoryFromList(category: Category) {
    const form = new FormData();
    form.set("id", category.id);
    startTransition(async () => {
      const result = await archiveCategory(form);
      if (result.ok)
        setCategories(current =>
          current.map(item =>
            item.id === category.id ? { ...item, is_active: false } : item
          )
        );
      showResult(result);
    });
  }

  return (
    <div className="view-stack fade-in catalog-view">
      <div className="hero-row">
        <div>
          <span className="eyebrow">Cadastros</span>
          <h2>Produtos e categorias.</h2>
          <p>
            Organize o catálogo que alimentará o frente de caixa e o estoque.
          </p>
        </div>
        <button
          className="primary-button"
          onClick={() => {
            setEditingProduct(null);
            setShowProductForm(true);
          }}
        >
          <Plus size={17} /> Novo produto
        </button>
      </div>

      {notice && (
        <div className={`catalog-notice ${notice.kind}`} role="status">
          {notice.kind === "success" ? <Check size={16} /> : <X size={16} />}
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} aria-label="Fechar aviso">
            <X size={15} />
          </button>
        </div>
      )}

      <div className="catalog-grid">
        <section className="panel catalog-categories">
          <div className="panel-heading">
            <div>
              <h3>
                Categorias <small>{activeCategories.length}</small>
              </h3>
              <p>Use categorias para filtrar seu catálogo.</p>
            </div>
            <button
              className="icon-button bordered"
              onClick={() => {
                setEditingCategory(null);
                setShowCategoryForm(true);
              }}
              title="Nova categoria"
            >
              <FolderPlus size={17} />
            </button>
          </div>
          {(showCategoryForm || editingCategory) && (
            <CategoryForm
              category={editingCategory}
              isPending={isPending}
              onSubmit={submitCategory}
              onCancel={() => {
                setShowCategoryForm(false);
                setEditingCategory(null);
              }}
            />
          )}
          <div className="category-list">
            {activeCategories.length === 0 ? (
              <p className="catalog-empty">Nenhuma categoria cadastrada.</p>
            ) : (
              activeCategories.map(category => (
                <div className="category-row" key={category.id}>
                  <span className="category-dot" />
                  <strong>{category.name}</strong>
                  <button
                    className="icon-button"
                    onClick={() => {
                      setEditingCategory(category);
                      setShowCategoryForm(false);
                    }}
                    title="Editar categoria"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    className="icon-button danger-icon"
                    onClick={() => archiveCategoryFromList(category)}
                    disabled={isPending}
                    title="Arquivar categoria"
                  >
                    <Archive size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel catalog-products">
          <div className="panel-heading catalog-products-heading">
            <div>
              <h3>
                Produtos <small>{activeProducts.length}</small>
              </h3>
              <p>Cadastre preço, unidade e estoque inicial.</p>
            </div>
            <label className="catalog-search">
              <Search size={15} />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Buscar produto…"
              />
            </label>
          </div>
          {showProductForm || editingProduct ? (
            <ProductForm
              product={editingProduct}
              categories={activeCategories}
              isPending={isPending}
              onSubmit={submitProduct}
              onCancel={() => {
                setShowProductForm(false);
                setEditingProduct(null);
              }}
            />
          ) : (
            <div className="product-table-wrap">
              <table className="product-table">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Categoria</th>
                    <th>Venda</th>
                    <th>Estoque</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <p className="catalog-empty">
                          {search
                            ? "Nenhum produto encontrado."
                            : "Nenhum produto cadastrado."}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map(product => (
                      <tr key={product.id}>
                        <td>
                          <div className="product-name-cell">
                            <span className="product-table-icon">
                              <Package size={15} />
                            </span>
                            <span>
                              <strong>{product.name}</strong>
                              <small>
                                {product.barcode ?? product.sku ?? "Sem código"}
                              </small>
                            </span>
                          </div>
                        </td>
                        <td>
                          {activeCategories.find(
                            category => category.id === product.category_id
                          )?.name ?? "Sem categoria"}
                        </td>
                        <td>
                          <strong>{money(product.sale_cents)}</strong>
                          <small>{unitLabel(product.unit)}</small>
                        </td>
                        <td>
                          <span
                            className={
                              product.stock_quantity <=
                              product.min_stock_quantity
                                ? "stock-low"
                                : "stock-ok"
                            }
                          >
                            {product.stock_quantity}
                          </span>
                        </td>
                        <td>
                          <div className="table-actions">
                            <button
                              className="icon-button"
                              onClick={() => {
                                setEditingProduct(product);
                                setShowProductForm(false);
                              }}
                              title="Editar produto"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              className="icon-button danger-icon"
                              onClick={() => archiveProductFromList(product)}
                              disabled={isPending}
                              title="Arquivar produto"
                            >
                              <Archive size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      {isPending && (
        <div className="catalog-loading">
          <span className="loading-spinner" /> Salvando alterações…
        </div>
      )}
    </div>
  );
}

function CategoryForm({
  category,
  isPending,
  onSubmit,
  onCancel,
}: {
  category: Category | null;
  isPending: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  return (
    <form className="inline-form" onSubmit={onSubmit}>
      <input type="hidden" name="id" value={category?.id ?? ""} />
      <input
        name="name"
        defaultValue={category?.name ?? ""}
        placeholder="Nome da categoria"
        autoFocus
        required
      />
      <button className="primary-button small-button" disabled={isPending}>
        {isPending ? "Salvando…" : category ? "Salvar" : "Adicionar"}
      </button>
      <button
        type="button"
        className="secondary-button small-button"
        onClick={onCancel}
      >
        Cancelar
      </button>
    </form>
  );
}

function ProductForm({
  product,
  categories,
  isPending,
  onSubmit,
  onCancel,
}: {
  product: Product | null;
  categories: Category[];
  isPending: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  const decimal = (value: number) => value.toString().replace(".", ",");
  return (
    <form className="product-form" onSubmit={onSubmit}>
      <div className="form-heading">
        <div>
          <span className="eyebrow">
            {product ? "Editar cadastro" : "Novo cadastro"}
          </span>
          <h3>{product ? product.name : "Adicionar produto"}</h3>
        </div>
        <button type="button" className="icon-button" onClick={onCancel}>
          <X size={17} />
        </button>
      </div>
      <input type="hidden" name="id" value={product?.id ?? ""} />
      <div className="form-grid">
        <label>
          Nome
          <input name="name" defaultValue={product?.name ?? ""} required />
        </label>
        <label>
          Categoria
          <select name="categoryId" defaultValue={product?.category_id ?? ""}>
            <option value="">Sem categoria</option>
            {categories.map(category => (
              <option value={category.id} key={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Código de barras
          <input name="barcode" defaultValue={product?.barcode ?? ""} />
        </label>
        <label>
          SKU interno
          <input name="sku" defaultValue={product?.sku ?? ""} />
        </label>
        <label>
          Unidade
          <select name="unit" defaultValue={product?.unit ?? "unit"}>
            {productUnits.map(unit => (
              <option key={unit.value} value={unit.value}>
                {unit.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Preço de custo
          <input
            name="cost"
            defaultValue={product ? decimal(product.cost_cents / 100) : ""}
            inputMode="decimal"
            placeholder="0,00"
          />
        </label>
        <label>
          Preço de venda
          <input
            name="sale"
            defaultValue={product ? decimal(product.sale_cents / 100) : ""}
            inputMode="decimal"
            placeholder="0,00"
            required
          />
        </label>
        <label>
          Estoque inicial
          <input
            name="stock"
            defaultValue={product ? decimal(product.stock_quantity) : "0"}
            inputMode="decimal"
          />
        </label>
        <label>
          Estoque mínimo
          <input
            name="minStock"
            defaultValue={product ? decimal(product.min_stock_quantity) : "0"}
            inputMode="decimal"
          />
        </label>
      </div>
      <div className="form-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>
          Cancelar
        </button>
        <button className="primary-button" disabled={isPending}>
          {isPending ? (
            <>
              <span className="loading-spinner small" /> Salvando…
            </>
          ) : product ? (
            "Salvar produto"
          ) : (
            "Criar produto"
          )}
        </button>
      </div>
    </form>
  );
}
