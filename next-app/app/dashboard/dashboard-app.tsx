"use client";

import {
  BarChart3,
  Barcode,
  Boxes,
  Calculator,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Plus,
  Receipt,
  ShoppingCart,
  Store,
  UserRound,
  Users,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import CatalogPanel from "./catalog-panel";
import type { CatalogData } from "@/lib/catalog/types";
import StockPanel from "./stock-panel";
import type { StockData } from "@/lib/stock/types";

type View =
  | "dashboard"
  | "pdv"
  | "products"
  | "stock"
  | "customers"
  | "cash"
  | "reports";
type Product = {
  id: string;
  name: string;
  barcode: string | null;
  sale_cents: number;
  stock_quantity: number;
};
type CartLine = { product: Product; quantity: number };
type DashboardUser = {
  email?: string;
  user_metadata?: Record<string, unknown>;
};
type DashboardAppProps = {
  user: DashboardUser;
  catalog: CatalogData;
  stock: StockData;
};
type NavItem = { id: View; label: string; icon: LucideIcon; shortcut?: string };

type Stat = {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone: string;
};

const navItems: NavItem[] = [
  { id: "dashboard", label: "Visão geral", icon: LayoutDashboard },
  { id: "pdv", label: "Frente de caixa", icon: ShoppingCart, shortcut: "F2" },
  { id: "products", label: "Produtos", icon: Package },
  { id: "stock", label: "Estoque", icon: Boxes },
  { id: "customers", label: "Clientes & fiado", icon: Users },
  { id: "cash", label: "Caixa", icon: WalletCards },
  { id: "reports", label: "Relatórios", icon: BarChart3 },
];

const paymentOptions: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "cash", label: "Dinheiro", icon: CircleDollarSign },
  { key: "pix", label: "Pix", icon: Barcode },
  { key: "debit", label: "Débito", icon: CreditCard },
  { key: "credit", label: "Crédito", icon: CreditCard },
  { key: "credit_account", label: "Fiado", icon: UserRound },
];

const money = (cents = 0) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100
  );

function getFirstName(user: DashboardUser) {
  return String(
    user.user_metadata?.full_name ??
      user.user_metadata?.name ??
      user.email?.split("@")[0] ??
      "Operador"
  ).split(" ")[0];
}

export default function DashboardApp({
  user,
  catalog,
  stock,
}: DashboardAppProps) {
  const [view, setView] = useState<View>("dashboard");
  const [mobileNav, setMobileNav] = useState(false);
  const router = useRouter();
  const name = getFirstName(user);

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  function navigate(nextView: View) {
    setView(nextView);
    setMobileNav(false);
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand-lockup">
          <div className="brand-icon">
            <Store size={19} />
          </div>
          <div>
            <strong>Mercantil</strong>
            <span>Gestão simples</span>
          </div>
        </div>
        <p className="nav-caption">Operação</p>
        <nav className="side-nav" aria-label="Navegação principal">
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`nav-item ${view === item.id ? "active" : ""}`}
                onClick={() => navigate(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {item.shortcut && <kbd>{item.shortcut}</kbd>}
              </button>
            );
          })}
        </nav>
        <div className="quick-card">
          <div className="quick-icon">
            <Calculator size={16} />
          </div>
          <strong>Atalho rápido</strong>
          <p>
            Use o leitor como um teclado. O código lido entra direto no
            carrinho.
          </p>
          <button onClick={() => navigate("pdv")}>
            Abrir PDV <ChevronRight size={14} />
          </button>
        </div>
        <div className="user-strip">
          <div className="avatar">{name.slice(0, 1).toUpperCase()}</div>
          <div className="user-copy">
            <strong>{name}</strong>
            <span>Usuário Supabase</span>
          </div>
          <button className="icon-button" title="Sair" onClick={signOut}>
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      {mobileNav && (
        <button
          className="mobile-overlay"
          aria-label="Fechar menu"
          onClick={() => setMobileNav(false)}
        />
      )}
      <main className="content-shell">
        <header className="topbar">
          <div className="topbar-title">
            <button
              className="mobile-menu icon-button"
              onClick={() => setMobileNav(true)}
              aria-label="Abrir menu"
            >
              <Menu size={20} />
            </button>
            <div>
              <span className="date-label">Sexta-feira, 24 de Setembro</span>
              <h1>{navItems.find(item => item.id === view)?.label}</h1>
            </div>
          </div>
          <div className="topbar-actions">
            <span className="connection-pill">
              <i /> Supabase conectado
            </span>
            <div className="avatar">{name.slice(0, 1).toUpperCase()}</div>
          </div>
        </header>
        <div className="page-content">
          {view === "dashboard" && <Dashboard onNavigate={navigate} />}
          {view === "pdv" && <PointOfSale />}
          {view === "products" && (
            <CatalogPanel
              initialCategories={catalog.categories}
              initialProducts={catalog.products}
              initialError={catalog.error}
            />
          )}
          {view === "stock" && <StockPanel {...stock} />}
          {view !== "dashboard" &&
            view !== "pdv" &&
            view !== "products" &&
            view !== "stock" && (
              <ModulePlaceholder view={view} onNavigate={navigate} />
            )}
        </div>
      </main>
    </div>
  );
}

function Dashboard({ onNavigate }: { onNavigate: (view: View) => void }) {
  const stats: Stat[] = [
    {
      label: "Vendas hoje",
      value: "—",
      hint: "Aguardando integração",
      icon: Receipt,
      tone: "lime",
    },
    {
      label: "Vendas no mês",
      value: "—",
      hint: "Aguardando integração",
      icon: BarChart3,
      tone: "blue",
    },
    {
      label: "Saldo esperado",
      value: "—",
      hint: "Abra o caixa para começar",
      icon: CircleDollarSign,
      tone: "gold",
    },
    {
      label: "Em aberto no fiado",
      value: "—",
      hint: "Aguardando integração",
      icon: UserRound,
      tone: "rose",
    },
  ];

  return (
    <div className="view-stack fade-in">
      <div className="hero-row">
        <div>
          <span className="eyebrow">Resumo do dia</span>
          <h2>Tudo sob controle.</h2>
          <p>
            Acompanhe a operação do seu mercantil e acesse o caixa em poucos
            cliques.
          </p>
        </div>
        <button className="primary-button" onClick={() => onNavigate("pdv")}>
          <ShoppingCart size={17} /> Abrir frente de caixa
        </button>
      </div>
      <div className="stat-grid">
        {stats.map(stat => {
          const Icon = stat.icon;
          return (
            <section className="stat-card" key={stat.label}>
              <div className={`stat-icon ${stat.tone}`}>
                <Icon size={20} />
              </div>
              <span className="card-date">Hoje</span>
              <p>{stat.label}</p>
              <strong>{stat.value}</strong>
              <small>{stat.hint}</small>
            </section>
          );
        })}
      </div>
      <div className="dashboard-grid">
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h3>Vendas dos últimos dias</h3>
              <p>Acompanhe o ritmo de vendas</p>
            </div>
            <button
              className="text-button"
              onClick={() => onNavigate("reports")}
            >
              Ver relatório <ChevronRight size={14} />
            </button>
          </div>
          <EmptyChart />
        </section>
        <div className="side-panels">
          <section className="attention-card">
            <div className="stat-icon lime">
              <Boxes size={19} />
            </div>
            <div>
              <span>Atenção</span>
              <strong>—</strong>
              <p>produtos com estoque baixo</p>
            </div>
            <button
              className="round-button"
              onClick={() => onNavigate("stock")}
            >
              <ChevronRight size={16} />
            </button>
          </section>
          <section className="panel cash-card">
            <div className="cash-heading">
              <div className="stat-icon gold">
                <WalletCards size={17} />
              </div>
              <div>
                <h3>Status do caixa</h3>
                <p>Nenhum caixa aberto</p>
              </div>
            </div>
            <button
              className="secondary-button"
              onClick={() => onNavigate("cash")}
            >
              Abrir caixa
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

function EmptyChart() {
  const labels = ["18/09", "19/09", "20/09", "21/09", "22/09", "23/09", "Hoje"];
  const heights = [24, 42, 30, 55, 35, 48, 28];
  return (
    <div className="empty-chart">
      <div className="chart-bars">
        {heights.map((height, index) => (
          <div className="chart-column" key={labels[index]}>
            <span style={{ height: `${height}%` }} />
          </div>
        ))}
      </div>
      <div className="chart-labels">
        {labels.map(label => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <p className="empty-note">
        Os dados aparecerão quando as vendas do Supabase forem conectadas.
      </p>
    </div>
  );
}

function PointOfSale() {
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [payment, setPayment] = useState("cash");
  const [received, setReceived] = useState("");
  const total = useMemo(
    () =>
      cart.reduce(
        (sum, line) => sum + line.product.sale_cents * line.quantity,
        0
      ),
    [cart]
  );
  const products: Product[] = [];
  const filteredProducts = products.filter(product =>
    `${product.name} ${product.barcode ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );
  const change = Math.max(
    (Number(received.replace(",", ".")) * 100 || 0) - total,
    0
  );

  function addProduct(product: Product) {
    setCart(current => {
      const existing = current.find(line => line.product.id === product.id);
      return existing
        ? current.map(line =>
            line.product.id === product.id
              ? { ...line, quantity: line.quantity + 1 }
              : line
          )
        : [...current, { product, quantity: 1 }];
    });
  }

  return (
    <div className="pos-layout fade-in">
      <div className="pos-main">
        <div className="view-heading">
          <div>
            <span className="eyebrow">Operação rápida</span>
            <h2>Nova venda</h2>
          </div>
          <span className="cash-status closed">
            <i /> Abra o caixa antes de vender
          </span>
        </div>
        <div className="scanner-bar">
          <Barcode size={20} />
          <input
            autoFocus
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Leia o código de barras ou pesquise um produto…"
          />
          <kbd>F2</kbd>
        </div>
        {search && filteredProducts.length > 0 && (
          <ProductSuggestions
            products={filteredProducts}
            onSelect={product => {
              addProduct(product);
              setSearch("");
            }}
          />
        )}
        <CartPanel cart={cart} setCart={setCart} addProduct={addProduct} />
      </div>
      <PaymentPanel
        total={total}
        payment={payment}
        setPayment={setPayment}
        received={received}
        setReceived={setReceived}
        change={change}
      />
    </div>
  );
}

function ProductSuggestions({
  products,
  onSelect,
}: {
  products: Product[];
  onSelect: (product: Product) => void;
}) {
  return (
    <div className="product-suggestions">
      {products.map(product => (
        <button key={product.id} onClick={() => onSelect(product)}>
          <span>
            <strong>{product.name}</strong>
            <small>
              {product.barcode ?? "Sem código"} · {product.stock_quantity} em
              estoque
            </small>
          </span>
          <b>{money(product.sale_cents)}</b>
        </button>
      ))}
    </div>
  );
}

function CartPanel({
  cart,
  setCart,
  addProduct,
}: {
  cart: CartLine[];
  setCart: React.Dispatch<React.SetStateAction<CartLine[]>>;
  addProduct: (product: Product) => void;
}) {
  const cartBody =
    cart.length === 0 ? (
      <EmptyState
        icon={ShoppingCart}
        title="Carrinho vazio"
        description="Leia um código de barras ou pesquise pelo nome do produto para iniciar."
      />
    ) : (
      <div className="cart-lines">
        {cart.map(line => (
          <div className="cart-line" key={line.product.id}>
            <div className="product-tile">
              <Package size={16} />
            </div>
            <div className="line-copy">
              <strong>{line.product.name}</strong>
              <span>{money(line.product.sale_cents)} cada</span>
            </div>
            <div className="quantity-control">
              <button
                onClick={() =>
                  setCart(current =>
                    current.map(item =>
                      item.product.id === line.product.id
                        ? { ...item, quantity: Math.max(item.quantity - 1, 1) }
                        : item
                    )
                  )
                }
              >
                −
              </button>
              <b>{line.quantity}</b>
              <button onClick={() => addProduct(line.product)}>+</button>
            </div>
            <strong className="line-total">
              {money(line.product.sale_cents * line.quantity)}
            </strong>
            <button
              className="remove-line"
              onClick={() =>
                setCart(current =>
                  current.filter(item => item.product.id !== line.product.id)
                )
              }
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    );
  return (
    <section className="panel cart-panel">
      <div className="panel-heading">
        <div>
          <h3>
            Itens da venda <small>{cart.length} produtos</small>
          </h3>
        </div>
        {cart.length > 0 && (
          <button className="danger-button" onClick={() => setCart([])}>
            Limpar tudo
          </button>
        )}
      </div>
      {cartBody}
    </section>
  );
}

function PaymentPanel({
  total,
  payment,
  setPayment,
  received,
  setReceived,
  change,
}: {
  total: number;
  payment: string;
  setPayment: (value: string) => void;
  received: string;
  setReceived: (value: string) => void;
  change: number;
}) {
  const paymentButtons = paymentOptions.map(option => {
    const Icon = option.icon;
    return (
      <button
        key={option.key}
        className={payment === option.key ? "selected" : ""}
        onClick={() => setPayment(option.key)}
      >
        <Icon size={16} />
        {option.label}
      </button>
    );
  });
  return (
    <aside className="payment-panel">
      <div className="payment-heading">
        <div>
          <span>Resumo</span>
          <h3>Pagamento</h3>
        </div>
        <Receipt size={18} />
      </div>
      <div className="total-row">
        <span>Total da compra</span>
        <strong>{money(total)}</strong>
      </div>
      <p className="payment-label">Forma de pagamento</p>
      <div className="payment-grid">{paymentButtons}</div>
      {payment === "cash" && (
        <label className="payment-field">
          Valor recebido
          <input
            value={received}
            onChange={event => setReceived(event.target.value)}
            placeholder="0,00"
            inputMode="decimal"
          />
          {received && (
            <span>
              Troco <b>{money(change)}</b>
            </span>
          )}
        </label>
      )}
      <button className="finish-button" disabled={!total}>
        Finalizar venda <ChevronRight size={16} />
      </button>
      <p className="payment-help">
        Ações e Server Actions serão conectadas nesta etapa da migração.
      </p>
    </aside>
  );
}

function ModulePlaceholder({
  view,
  onNavigate,
}: {
  view: View;
  onNavigate: (view: View) => void;
}) {
  const item = navItems.find(nav => nav.id === view)!;
  const Icon = item.icon;
  return (
    <div className="view-stack fade-in">
      <div className="hero-row">
        <div>
          <span className="eyebrow">Módulo operacional</span>
          <h2>{item.label}</h2>
          <p>
            A estrutura visual está pronta para receber as queries Supabase e
            Server Actions do novo backend.
          </p>
        </div>
        <button className="primary-button" onClick={() => onNavigate("pdv")}>
          <ShoppingCart size={17} /> Voltar ao PDV
        </button>
      </div>
      <section className="module-empty panel">
        <div className="module-empty-icon">
          <Icon size={28} />
        </div>
        <h3>Interface preparada</h3>
        <p>
          Este módulo preserva a linguagem visual do sistema antigo. As
          operações de banco serão conectadas sem alterar a navegação ou os
          estados vazios.
        </p>
        <div className="empty-actions">
          <button
            className="secondary-button"
            onClick={() => onNavigate("dashboard")}
          >
            Voltar ao início
          </button>
          {view === "products" && (
            <button
              className="primary-button"
              onClick={() => onNavigate("pdv")}
            >
              <Plus size={16} /> Novo produto
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={25} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
