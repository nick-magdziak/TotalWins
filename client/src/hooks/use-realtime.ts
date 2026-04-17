import { useEffect } from "react";
import { queryClient } from "@/lib/queryClient";

type RealtimeMessage = { event: string; payload?: unknown };

export function useRealtimeInvitations(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let attempt = 0;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${protocol}//${window.location.host}/ws`;

      try {
        socket = new WebSocket(url);
      } catch {
        scheduleReconnect();
        return;
      }

      socket.addEventListener("open", () => {
        attempt = 0;
        // Refresh once on (re)connect in case events were missed while offline
        queryClient.invalidateQueries({ queryKey: ["/api/users/pending-invitations"] });
      });

      socket.addEventListener("message", (event) => {
        let msg: RealtimeMessage | null = null;
        try {
          msg = JSON.parse(typeof event.data === "string" ? event.data : "");
        } catch {
          return;
        }
        if (msg && msg.event === "pending-invitations:changed") {
          queryClient.invalidateQueries({ queryKey: ["/api/users/pending-invitations"] });
        }
      });

      socket.addEventListener("close", () => {
        socket = null;
        scheduleReconnect();
      });

      socket.addEventListener("error", () => {
        try { socket?.close(); } catch {}
      });
    };

    const scheduleReconnect = () => {
      if (cancelled) return;
      attempt += 1;
      const delay = Math.min(30000, 1000 * 2 ** Math.min(attempt, 5));
      reconnectTimer = window.setTimeout(connect, delay);
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      try { socket?.close(); } catch {}
      socket = null;
    };
  }, [enabled]);
}
