import React, { useEffect, useState } from "react";
import api from "./api";
import io from "socket.io-client";
import "./DisplayPanel.css";

const socket = io("http://localhost:4000");

const normalizeStatus = (status = "") =>
  status.toLowerCase().trim();

export default function DisplayPanel() {
  const [orders, setOrders] = useState([]);

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
      if (data.resource === "orders") {
        fetchOrders();
      }
    });

    return () => socket.disconnect();
  }, []);

  const preparingOrders = orders.filter(
    (o) =>
      ["placed", "preparing", "cooking"].includes(
        normalizeStatus(o.status)
      )
  );

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

  const readyOrders = orders.filter(
    (o) =>
      normalizeStatus(o.status) === "completed" &&
      isToday(o.date)
  );

  return (
    <div className="display-container">

      {/* HEADER */}
      <div className="display-header">
        <h1>ORDER STATUS</h1>
      </div>

      <div className="display-columns">

        {/* PREPARING */}
        <div className="column preparing">
          <div className="column-title">PREPARING</div>

          <div className="order-grid">
            {preparingOrders.map((order) => (
              <div key={order.id} className="order-card preparing-card">
                <div className="order-id">{order.id}</div>

                <div className="customer-name">
                  {order.userName || "Guest"}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* READY */}
        <div className="column ready">
          <div className="column-title">READY</div>

          <div className="order-grid">
            {readyOrders.map((order) => (
              <div key={order.id} className="order-card ready-card">
                <div className="order-id">{order.id}</div>

                <div className="customer-name">
                  {order.userName || "Guest"}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}