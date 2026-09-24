"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Archive,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  Check,
  History,
  Search,
  X,
} from "lucide-react";
import { adjustProductStock } from "@/lib/stock/actions";
import {
  movementOptions,
  type StockData,
  type StockProduct,
} from "@/lib/stock/types";

type Props = StockData;
type Notice = { kind: "success" | "error"; text: string } | null;
const unitLabel: Record<StockProduct["unit"], string> = {
  unit: "un",
  kg: "kg",
  g: "g",
  l: "L",
  ml: "ml",
  box: "cx",
  pack: "pct",
};
const dateTime = (value: string) =>
  new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function StockPanel({
  products: initialProducts,
  movements: initialMovements,
  error: initialError,
}: Props) {
  const [products, setProducts] = useState(initialProducts);
  const [movements, setMovements] = useState(initialMovements);
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<StockProduct | null>(
    null
  );
  const [notice, setNotice] = useState<Notice>(
    initialError ? { kind: "error", text: initialError } : null
  );
  const [isPending, startTransition] = useTransition();
  const activeProducts = products.filter(product => product.is_active);
  const lowStock = activeProducts.filter(
    product => product.stock_quantity <= product.min_stock_quantity
  );
  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return activeProducts;
    return activeProducts.filter(product =>
      `${product.name} ${product.barcode ?? ""} ${product.sku ?? ""}`
        .toLowerCase()
        .includes(query)
    );
  }, [activeProducts, search]);

  function submitMovement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    startTransition(async () => {
      const result = await adjustProductStock(new FormData(form));
      if (result.ok) {
        const movement = result.data;
        setProducts(current =>
          current.map(product =>
            product.id === movement.product_id
              ? { ...product, stock_quantity: movement.quantity_after }
              : product
          )
        );
        setMovements(current => [movement, ...current].slice(0, 80));
        setSelectedProduct(null);
        form.reset();
      }
      setNotice(
        result.ok
          ? { kind: "success", text: result.message }
          : { kind: "error", text: result.error }
      );
    });
  }

  return (
    <div className="view-stack fade-in stock-view">
      <div className="hero-row">
        <div>
          <span className="eyebrow">Controle operacional</span>
          <h2>Estoque em movimento.</h2>
          <p>Atualize saldos com histórico e rastreabilidade por produto.</p>
        </div>
        <div className="stock-summary">
          <strong>{activeProducts.length}</strong>
          <span>produtos ativos</span>
          <b>{lowStock.length}</b>
          <span>abaixo do mínimo</span>
        </div>
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
      <div className="stock-grid">
        <section className="panel stock-products-panel">
          <div className="panel-heading stock-heading">
            <div>
              <h3>
                Saldo por produto <small>{filteredProducts.length}</small>
              </h3>
              <p>Selecione um produto para registrar entrada ou saída.</p>
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
          <div className="stock-product-list">
            {filteredProducts.length === 0 ? (
              <p className="catalog-empty">
                Nenhum produto encontrado. Cadastre produtos antes de ajustar o
                estoque.
              </p>
            ) : (
              filteredProducts.map(product => (
                <button
                  className={`stock-product-row ${selectedProduct?.id === product.id ? "selected" : ""}`}
                  key={product.id}
                  onClick={() => setSelectedProduct(product)}
                >
                  <span className="product-table-icon">
                    <Boxes size={15} />
                  </span>
                  <span className="stock-product-copy">
                    <strong>{product.name}</strong>
                    <small>
                      {product.barcode ?? product.sku ?? "Sem código"}
                    </small>
                  </span>
                  <span
                    className={
                      product.stock_quantity <= product.min_stock_quantity
                        ? "stock-low"
                        : "stock-ok"
                    }
                  >
                    {product.stock_quantity} {unitLabel[product.unit]}
                  </span>
                </button>
              ))
            )}
          </div>
        </section>
        <section className="panel stock-form-panel">
          <div className="panel-heading">
            <div>
              <h3>
                {selectedProduct ? "Nova movimentação" : "Ajustar estoque"}
              </h3>
              <p>
                {selectedProduct
                  ? selectedProduct.name
                  : "Escolha um produto na lista ao lado."}
              </p>
            </div>
            <History size={18} />
          </div>
          {selectedProduct ? (
            <form className="stock-form" onSubmit={submitMovement}>
              <input
                type="hidden"
                name="productId"
                value={selectedProduct.id}
              />
              <label>
                Tipo de movimentação
                <select name="movementType" defaultValue="purchase">
                  {movementOptions.map(option => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Quantidade
                <input
                  name="quantity"
                  inputMode="decimal"
                  placeholder={`Ex.: 10 ${unitLabel[selectedProduct.unit]}`}
                  required
                />
              </label>
              <label>
                Motivo ou observação
                <textarea
                  name="reason"
                  rows={3}
                  placeholder="Ex.: reposição do fornecedor, inventário…"
                />
              </label>
              <div className="stock-current">
                <span>Saldo atual</span>
                <strong>
                  {selectedProduct.stock_quantity}{" "}
                  {unitLabel[selectedProduct.unit]}
                </strong>
              </div>
              <button className="primary-button" disabled={isPending}>
                {isPending ? (
                  <>
                    <span className="loading-spinner small" /> Registrando…
                  </>
                ) : (
                  <>
                    Registrar movimentação <ArrowUpFromLine size={16} />
                  </>
                )}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setSelectedProduct(null)}
              >
                Cancelar
              </button>
            </form>
          ) : (
            <div className="stock-form-empty">
              <div className="module-empty-icon">
                <ArrowDownToLine size={25} />
              </div>
              <strong>Nenhum produto selecionado</strong>
              <p>
                Escolha um item para informar a quantidade e o motivo da
                alteração.
              </p>
            </div>
          )}
        </section>
      </div>
      <section className="panel stock-history">
        <div className="panel-heading">
          <div>
            <h3>
              Histórico de movimentações <small>{movements.length}</small>
            </h3>
            <p>Últimos lançamentos registrados no ledger.</p>
          </div>
          <History size={18} />
        </div>
        <div className="stock-history-table">
          {movements.length === 0 ? (
            <p className="catalog-empty">
              Ainda não existem movimentações registradas.
            </p>
          ) : (
            <table className="product-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Produto</th>
                  <th>Tipo</th>
                  <th>Variação</th>
                  <th>Saldo após</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {movements.map(movement => {
                  const product = products.find(
                    item => item.id === movement.product_id
                  );
                  const option = movementOptions.find(
                    item => item.value === movement.movement_type
                  );
                  return (
                    <tr key={movement.id}>
                      <td>{dateTime(movement.created_at)}</td>
                      <td>
                        <strong>{product?.name ?? "Produto removido"}</strong>
                      </td>
                      <td>{option?.label ?? movement.movement_type}</td>
                      <td>
                        <span
                          className={
                            movement.quantity_delta >= 0
                              ? "movement-in"
                              : "movement-out"
                          }
                        >
                          {movement.quantity_delta >= 0 ? "+" : ""}
                          {movement.quantity_delta}
                        </span>
                      </td>
                      <td>
                        <strong>{movement.quantity_after}</strong>
                      </td>
                      <td>{movement.reason ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
