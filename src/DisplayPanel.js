import React, { useEffect, useState, useCallback } from "react";
import api from "./api";
import io from "socket.io-client";
import "./DisplayPanel.css";
import dineinIcon from "./icons/dine-in.png"
import takeawayIcon from "./icons/take-away.png"

const socket = io("http://localhost:4000");

const normalizeStatus = (status = "") => status.toLowerCase().trim();

const isToday = (date) => {
  if (!date) return false;
  const d = new Date(date);
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
};

/* ── Live clock ───────────────────────────── */
function useClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return time;
}

/* ── Ticker messages ──────────────────────── */
const TICKER_MSGS = [
  "Welcome! Thank you for dining with us 🍽️",
  "Fresh ingredients. Crafted with love.",
  "Your order is being prepared with care.",
  "Please check your order ID on the screen.",
  "Sit back, relax — great food is on its way!",
];

/* ══════════════════════════════════════════
   ORDER DETAIL MODAL
══════════════════════════════════════════ */
function OrderDetailModal({ order, onClose }) {
  const isReady = normalizeStatus(order.status) === "completed";
  const type = isReady ? "ready" : "preparing";

  const totalAmount =
    order.totalAmount ??
    order.items?.reduce((s, item) => s + (item.totalPrice || 0), 0) ?? 0;

  /* close on backdrop click */
  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  /* close on Escape */
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="dp-modal-backdrop" onClick={handleBackdrop}>
      <div className={`dp-modal dp-modal--${type}`}>

        {/* ── CLOSE ── */}
        <button className="dp-modal__close" onClick={onClose} aria-label="Close">✕</button>

        {/* ── MODAL HEADER ── */}
        <div className="dp-modal__header">
          <div className="dp-modal__token-wrap">
            <span className="dp-modal__token-label">ORDER ID</span>
            <span className={`dp-modal__token dp-modal__token--${type}`}>
              {order.id?.replace(/\D/g, "").slice(-4) || order.id}
            </span>
          </div>

          <div className="dp-modal__meta">
            <p className="dp-modal__customer">
              {order.userName || "Guest"}
            </p>
            <span className={`dp-modal__status-pill dp-modal__status-pill--${type}`}>
              {isReady ? "✓ READY FOR PICKUP" : "⏳ PREPARING"}
            </span>
            <p className="dp-modal__sub">
              {order.mode || "—"}
              {order.tableNo ? ` · Table ${order.tableNo}` : ""}
              {order.time ? ` · ${order.time}` : ""}
            </p>
          </div>
        </div>

        {/* ── DIVIDER ── */}
        <div className="dp-modal__divider" />

        {/* ── ITEMS LIST ── */}
        <div className="dp-modal__items-title">Ordered Items</div>
        <div className="dp-modal__items">
          {(order.items || []).map((item, i) => {
            const qty = item.quantity ?? item.qty ?? 1;
            const price = item.totalPrice ?? item.unitPrice ?? 0;
            const name = item.dishName || item.name || "—";
            const category = (item.categoryId || item.categoryName || "")
              .replace(/_/g, " ")
              .replace(/\b\w/g, c => c.toUpperCase());
            const status = normalizeStatus(item.status || "");
            const isItemReady = status === "completed";

            return (
              <div key={i} className="dp-modal__item">
                <div className="dp-modal__item-left">
                  {/* item status dot */}
                  <span className={`dp-modal__item-dot ${isItemReady ? "done" : "pending"}`} />
                  <div>
                    <p className="dp-modal__item-name">{name}</p>
                    {category && (
                      <p className="dp-modal__item-cat">{category}</p>
                    )}
                    {item.notes?.trim() && (
                      <p className="dp-modal__item-note">📝 {item.notes}</p>
                    )}
                    {item.selectedSize && (
                      <p className="dp-modal__item-cat">
                        Size: {item.selectedSize}
                      </p>
                    )}
                  </div>
                </div>
                <div className="dp-modal__item-right">
                  <span className="dp-modal__item-qty">×{qty}</span>
                  <span className="dp-modal__item-price">₹{price}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── DIVIDER ── */}
        <div className="dp-modal__divider" />

        {/* ── TOTAL ── */}
        <div className="dp-modal__total-row">
          <span className="dp-modal__total-label">Total Amount</span>
          <span className={`dp-modal__total-value dp-modal__total-value--${type}`}>
            ₹{totalAmount.toLocaleString()}
          </span>
        </div>

        {/* ── READY PROMPT ── */}
        {isReady && (
          <div className="dp-modal__pickup-banner">
            🎉 Your order is ready! Please collect it from the counter.
          </div>
        )}

      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   ORDER CARD
══════════════════════════════════════════ */
function OrderCard({ order, type, index, onClick }) {
  const itemCount = order.items?.reduce((s, i) => s + (i.quantity || 1), 0) || 0;
  const isReady = type === "ready";

  return (
    <div
      className={`dp-card dp-card--${type}`}
      style={{ animationDelay: `${index * 0.07}s` }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      aria-label={`View details for order ${order.id}`}
    >
      {/* pulse ring on ready */}
      {isReady && <span className="dp-card__ring" />}

      {/* tap hint */}
      <span className="dp-card__tap-hint">tap to view</span>

      {/* token */}
      <div className="dp-card__token">
        <span className="dp-card__token-label">ORDER ID</span>
        <span className="dp-card__token-id">
          {order.id?.replace(/\D/g, "").slice(-4) || order.id}
        </span>
      </div>

      {/* name */}
      <div className="dp-card__name">
        {order.userName || "Guest"}
      </div>

      {/* item count + mode */}
      <div className="dp-card__meta">
        {itemCount} item{itemCount !== 1 ? "s" : ""}

        {order.mode && (
          <img
            className="dp-card__mode"
            src={
              order.mode.toLowerCase() === "dine in"
                ? dineinIcon
                : takeawayIcon
            }
            alt="mode"
          />
        )}
      </div>

      {/* ready badge */}
      {isReady && (
        <div className="dp-card__ready-badge">READY ✓</div>
      )}
    </div>
  );
}

/* ── Empty Column State ───────────────────── */
function EmptyState({ type }) {
  return (
    <div className="dp-empty">
      <div className="dp-empty__icon">{type === "ready" ? "✓" : "⏳"}</div>
      <p>{type === "ready" ? "No orders ready yet" : "All caught up!"}</p>
    </div>
  );
}

/* ══════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════ */
export default function DisplayPanel() {
  const [orders, setOrders] = useState([]);
  const [tickerIdx, setTickerIdx] = useState(0);
  const [tickerVisible, setTickerVisible] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const time = useClock();

  /* ── fetch ── */
  const fetchOrders = async () => {
    try {
      const res = await api.get("/orders");
      setOrders(res.data || []);
    } catch (err) {
      console.error("Failed to fetch orders", err);
    }
  };

  useEffect(() => {
    fetchOrders();
    socket.on("data-change", (data) => {
      if (data.resource === "orders") fetchOrders();
    });
    return () => socket.disconnect();
  }, []);

  /* ── ticker rotation ── */
  useEffect(() => {
    const t = setInterval(() => {
      setTickerVisible(false);
      setTimeout(() => {
        setTickerIdx(i => (i + 1) % TICKER_MSGS.length);
        setTickerVisible(true);
      }, 500);
    }, 4500);
    return () => clearInterval(t);
  }, []);

  /* ── filtered lists ── */
  const preparingOrders = orders.filter(o =>
    ["placed", "preparing", "cooking"].includes(normalizeStatus(o.status))
  );

  const readyOrders = orders.filter(o =>
    normalizeStatus(o.status) === "completed" && isToday(o.date)
  );

  /* ── clock strings ── */
  const timeStr = time.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true
  });
  const dateStr = time.toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });

  const handleCardClick = useCallback((order) => setSelectedOrder(order), []);
  const handleCloseModal = useCallback(() => setSelectedOrder(null), []);

  return (
    <div className="dp-root">

      {/* grain */}
      <div className="dp-grain" />

      {/* ── TOP BAR ── */}
      <header className="dp-topbar">
        <div className="dp-topbar__brand">
          <span className="dp-topbar__dot" />
          <span className="dp-topbar__title">ORDER STATUS</span>
        </div>

        <div className="dp-topbar__center">
          <span className={`dp-ticker ${tickerVisible ? "dp-ticker--in" : "dp-ticker--out"}`}>
            {TICKER_MSGS[tickerIdx]}
          </span>
        </div>

        <div className="dp-topbar__clock">
          <span className="dp-clock__time">{timeStr}</span>
          <span className="dp-clock__date">{dateStr}</span>
        </div>
      </header>

      {/* ── COLUMN HEADERS ── */}
      <div className="dp-col-headers">
        <div className="dp-col-header dp-col-header--preparing">
          <span className="dp-col-header__icon">⏳</span>
          <span>PREPARING</span>
          <span className="dp-col-header__count">{preparingOrders.length}</span>
        </div>
        <div className="dp-col-header dp-col-header--ready">
          <span className="dp-col-header__icon">✓</span>
          <span>READY FOR PICKUP</span>
          <span className="dp-col-header__count">{readyOrders.length}</span>
        </div>
      </div>

      {/* ── MAIN COLUMNS ── */}
      <main className="dp-columns">

        <section className="dp-col dp-col--preparing">
          {preparingOrders.length === 0
            ? <EmptyState type="preparing" />
            : (
              <div className="dp-grid">
                {preparingOrders.map((order, i) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    type="preparing"
                    index={i}
                    onClick={() => handleCardClick(order)}
                  />
                ))}
              </div>
            )
          }
        </section>

        <div className="dp-separator" />

        <section className="dp-col dp-col--ready">
          {readyOrders.length === 0
            ? <EmptyState type="ready" />
            : (
              <div className="dp-grid">
                {readyOrders.map((order, i) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    type="ready"
                    index={i}
                    onClick={() => handleCardClick(order)}
                  />
                ))}
              </div>
            )
          }
        </section>

      </main>

      {/* ── FOOTER ── */}
      <footer className="dp-footer">
        <span>
          Tap any order card to view details · Collect from counter when order appears in{" "}
          <strong>READY</strong>
        </span>
      </footer>

      {/* ── ORDER DETAIL MODAL ── */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={handleCloseModal}
        />
      )}

    </div>
  );
}