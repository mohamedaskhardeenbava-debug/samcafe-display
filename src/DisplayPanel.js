import React, { useEffect, useState, useCallback, useMemo, useRef, memo } from "react";
import api from "./api";
import io from "socket.io-client";
import "./DisplayPanel.css";
import dineinIcon from "./icons/dine-in.png";
import takeawayIcon from "./icons/take-away.png";

const socket = io("http://localhost:4000");

/* ═══════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════ */
const SEVEN_MIN_MS = 7 * 60 * 1000;

const TICKER_MSGS = [
  "Welcome! Thank you for dining with us 🍽️",
  "Fresh ingredients. Crafted with love.",
  "Your order is being prepared with care.",
  "Please check your order ID on the screen.",
  "Sit back, relax — great food is on its way!",
];

/* ═══════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════ */
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

const getOrderCreatedMs = (order) => {
  const src = order.createdAt || order.date;
  const t = new Date(src).getTime();
  return isNaN(t) ? Date.now() : t;
};

const fmtCountdown = (ms) => {
  const abs = Math.abs(ms);
  const m = Math.floor(abs / 60000);
  const s = Math.floor((abs % 60000) / 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

/* ═══════════════════════════════════════════════
   HOOKS
═══════════════════════════════════════════════ */
function useClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return time;
}

function useTicker() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx(i => (i + 1) % TICKER_MSGS.length);
        setVisible(true);
      }, 500);
    }, 4500);
    return () => clearInterval(t);
  }, []);
  return { msg: TICKER_MSGS[idx], visible };
}

/* ═══════════════════════════════════════════════
   COUNTDOWN CELL
   Writes directly to DOM ref — zero parent re-renders
═══════════════════════════════════════════════ */
const CountdownCell = memo(({ createdMs }) => {
  const ref = useRef(null);

  useEffect(() => {
    const tick = () => {
      if (!ref.current) return;
      const remaining = createdMs + SEVEN_MIN_MS - Date.now();
      const over = remaining < 0;
      ref.current.textContent = over
        ? `+${fmtCountdown(remaining)} LATE`
        : `${fmtCountdown(remaining)}`;
      ref.current.className =
        `dp-card__timer ${over ? "dp-card__timer--over" : "dp-card__timer--ok"}`;
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [createdMs]);

  return <span ref={ref} className="dp-card__timer dp-card__timer--ok" />;
});

/* ═══════════════════════════════════════════════
   ORDER DETAIL MODAL  (unchanged from original)
═══════════════════════════════════════════════ */
function OrderDetailModal({ order, onClose }) {
  const isReady = normalizeStatus(order.status) === "completed" ||
    normalizeStatus(order.status) === "service pickup";
  const type = isReady ? "ready" : "preparing";

  const totalAmount =
    order.totalAmount ??
    order.items?.reduce((s, item) => s + (item.totalPrice || 0), 0) ?? 0;

  const handleBackdrop = (e) => { if (e.target === e.currentTarget) onClose(); };

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="dp-modal-backdrop" onClick={handleBackdrop}>
      <div className={`dp-modal dp-modal--${type}`}>

        <button className="dp-modal__close" onClick={onClose} aria-label="Close">✕</button>

        {/* HEADER */}
        <div className="dp-modal__header">
          <div className="dp-modal__token-wrap">
            <span className="dp-modal__token-label">ORDER ID</span>
            <span className={`dp-modal__token dp-modal__token--${type}`}>
              {order.id?.replace(/\D/g, "").slice(-4) || order.id}
            </span>
          </div>
          <div className="dp-modal__meta">
            <p className="dp-modal__customer">{order.userName || "Guest"}</p>
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

        <div className="dp-modal__divider" />

        {/* ITEMS */}
        <div className="dp-modal__items-title">Ordered Items</div>
        <div className="dp-modal__items">
          {(order.items || []).map((item, i) => {
            const qty = item.quantity ?? item.qty ?? 1;
            const price = item.totalPrice ?? item.unitPrice ?? 0;
            const name = item.dishName || item.name || "—";
            const category = (item.categoryId || item.categoryName || "")
              .replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
            const done = normalizeStatus(item.status || "") === "completed";

            return (
              <div key={i} className="dp-modal__item">
                <div className="dp-modal__item-left">
                  <span className={`dp-modal__item-dot ${done ? "done" : "pending"}`} />
                  <div>
                    <p className="dp-modal__item-name">{name}</p>
                    {category && <p className="dp-modal__item-cat">{category}</p>}
                    {item.notes?.trim() && (
                      <p className="dp-modal__item-note">📝 {item.notes}</p>
                    )}
                    {item.selectedSize && (
                      <p className="dp-modal__item-cat">Size: {item.selectedSize}</p>
                    )}
                    {item.spiciness && (
                      <p className="dp-modal__item-cat">🌶 {item.spiciness}</p>
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

        <div className="dp-modal__divider" />

        {/* TOTAL */}
        <div className="dp-modal__total-row">
          <span className="dp-modal__total-label">Total Amount</span>
          <span className={`dp-modal__total-value dp-modal__total-value--${type}`}>
            ₹{totalAmount.toLocaleString()}
          </span>
        </div>

        {isReady && (
          <div className="dp-modal__pickup-banner">
            🎉 Your order is ready! Please collect it from the counter.
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   ORDER CARD  (one card = one whole order)
═══════════════════════════════════════════════ */
const OrderCard = memo(function OrderCard({ order, type, index, onClick }) {
  const isReady = type === "ready";
  const isDineIn = order.mode?.toLowerCase() === "dine in";
  const itemCount = order.items?.reduce((s, i) => s + (i.quantity || 1), 0) || 0;
  const createdMs = getOrderCreatedMs(order);

  /* up to 3 dish names shown on the card */
  const dishPreview = (order.items || [])
    .slice(0, 3)
    .map(i => i.dishName || i.name || "—");
  const extraCount = (order.items?.length || 0) - dishPreview.length;

  const formatIndianTime = (time) => {
    if (!time) return "—";

    try {

      // If only time (HH:mm)
      const [h, m] = time.split(":");
      const dt = new Date();
      dt.setHours(h, m);

      return dt.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

    } catch {
      return time;
    }
  };

  return (
    <div
      id={`order-${order.id}`}
      className={`dp-card dp-card--${type} ${order.priority ? "dp-card--priority" : ""}`}
      style={{ animationDelay: `${index * 0.06}s` }}
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

      {/* ── TOP ROW: order id + mode icon ── */}
      <div className="dp-card__top-row">
        <div className="dp-card__token">
          <span className="dp-card__token-label">ORDER</span>
          <span className="dp-card__token-id">
            #{order.id?.replace(/\D/g, "").slice(-4) || order.id}
          </span>
        </div>
        <img
          className="dp-card__mode-icon"
          src={isDineIn ? dineinIcon : takeawayIcon}
          alt={isDineIn ? "Dine In" : "Take Away"}
        />
      </div>

      {/* ── CUSTOMER NAME ── */}
      <div className="dp-card__name">{order.userName || "Guest"}</div>

      {/* ── TABLE + TIME ── */}
      {(order.tableNo || order.time) && (
        <div className="dp-card__sub">
          {order.tableNo ? `Table ${order.tableNo}` : ""}
          {order.tableNo && order.time ? " · " : ""}
          {formatIndianTime(order.time) || ""}
        </div>
      )}

      {/* ── DISH PREVIEW ── */}
      <div className="dp-card__dishes">
        {dishPreview.map((name, i) => (
          <span key={i} className="dp-card__dish-tag">{name}</span>
        ))}
        {extraCount > 0 && (
          <span className="dp-card__dish-tag dp-card__dish-tag--more">
            +{extraCount} more
          </span>
        )}
      </div>

      {/* ── ITEM COUNT ── */}
      <div className="dp-card__meta">
        <span className="dp-card__item-count">
          {itemCount} item{itemCount !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── COUNTDOWN (left/preparing panel only) ── */}
      {!isReady && <CountdownCell createdMs={createdMs} />}

      {/* ── READY BADGE ── */}
      {isReady && (
        <div className="dp-card__ready-badge">READY ✓</div>
      )}
    </div>
  );
});

/* ═══════════════════════════════════════════════
   EMPTY STATE
═══════════════════════════════════════════════ */
function EmptyState({ type }) {
  return (
    <div className="dp-empty">
      <div className="dp-empty__icon">{type === "ready" ? "✓" : "⏳"}</div>
      <p>{type === "ready" ? "No orders ready yet" : "All caught up!"}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════ */
export default function DisplayPanel() {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [removedIds, setRemovedIds] = useState(() => {
    return JSON.parse(localStorage.getItem("removedCompletedOrders") || "[]");
  });
  const { msg: tickerMsg, visible: tickerVisible } = useTicker();
  const time = useClock();
  const completedTimersRef = useRef({});

  /* ── fetch ── */
  const fetchOrders = useCallback(async () => {
    try {
      const res = await api.get("/orders");
      setOrders(res.data || []);
    } catch (err) {
      console.error("Failed to fetch orders", err);
    }
  }, []);

  useEffect(() => {
    fetchOrders();

    const handleDataChange = (data) => {
      if (!data || data.resource === "orders") {
        fetchOrders();
      }
    };

    const handleOrdersUpdated = () => {
      fetchOrders();
    };

    socket.on("data-change", handleDataChange);
    socket.on("ordersUpdated", handleOrdersUpdated);

    return () => {
      socket.off("data-change", handleDataChange);
      socket.off("ordersUpdated", handleOrdersUpdated);
    };
  }, [fetchOrders]);

  const readyOrders = useMemo(() =>
    orders
      .filter(o =>
        isToday(o.date || o.createdAt) &&
        normalizeStatus(o.status) === "completed" &&
        !removedIds.includes(o.id)
      )
      .sort((a, b) => {
        // 🔥 priority first
        if (a.priority && !b.priority) return -1;
        if (!a.priority && b.priority) return 1;

        return new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date);
      }),
    [orders, removedIds]
  );

  useEffect(() => {
    readyOrders.forEach(order => {
      if (removedIds.includes(order.id)) return;

      if (!completedTimersRef.current[order.id]) {
        completedTimersRef.current[order.id] = setTimeout(() => {

          const el = document.getElementById(`order-${order.id}`);
          if (el) el.classList.add("dp-card--removing");

          setTimeout(() => {
            setRemovedIds(prev => {
              if (prev.includes(order.id)) return prev;

              const updated = [...prev, order.id];
              localStorage.setItem("removedCompletedOrders", JSON.stringify(updated));
              return updated;
            });
          }, 800);

        }, 30000);
      }
    });
  }, [readyOrders, removedIds]);

  /* ── LEFT: placed / preparing / cooking — today only ── */
  const preparingOrders = useMemo(() =>
    orders
      .filter(o =>
        isToday(o.date || o.createdAt) &&
        ["placed", "preparing"].includes(normalizeStatus(o.status))
      )
      .sort((a, b) => {
        // 🔥 priority first
        if (a.priority && !b.priority) return -1;
        if (!a.priority && b.priority) return 1;

        // optional: latest first
        return new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date);
      }),
    [orders]
  );

  /* ── clock strings ── */
  const timeStr = time.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  });
  const dateStr = time.toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
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
            {tickerMsg}
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

        {/* LEFT — placed / preparing / cooking */}
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

        {/* RIGHT — service pickup */}
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
          <strong>READY FOR PICKUP</strong>
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