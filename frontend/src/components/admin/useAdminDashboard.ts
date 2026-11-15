"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AdminDashboard } from "./types";

export function useAdminDashboard() {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setError("");
    try {
      const data = await api<AdminDashboard>("/admin/dashboard");
      setDashboard(data);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not load admin data.";
      setError(message);
      throw cause;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const load = () => void reload().catch(() => {});
    load();
    const interval = window.setInterval(load, 30_000);
    return () => window.clearInterval(interval);
  }, [reload]);

  return { dashboard, loading, error, setError, reload };
}
