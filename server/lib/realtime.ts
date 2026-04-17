import type { Server as HttpServer } from "http";
import type { RequestHandler } from "express";
import { WebSocketServer, WebSocket } from "ws";

type AnyRequest = Parameters<RequestHandler>[0] & { session?: { userId?: string } };

const userSockets = new Map<string, Set<WebSocket>>();
let initialized = false;

function add(userId: string, ws: WebSocket) {
  let set = userSockets.get(userId);
  if (!set) {
    set = new Set();
    userSockets.set(userId, set);
  }
  set.add(ws);
}

function remove(userId: string, ws: WebSocket) {
  const set = userSockets.get(userId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) userSockets.delete(userId);
}

export function notifyUser(userId: string, event: string, payload?: unknown) {
  const set = userSockets.get(userId);
  if (!set || set.size === 0) return;
  const message = JSON.stringify({ event, payload: payload ?? null });
  set.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(message);
      } catch {
        // ignore send errors; the close handler will clean up
      }
    }
  });
}

export function setupRealtime(httpServer: HttpServer, sessionMiddleware: RequestHandler) {
  if (initialized) return;
  initialized = true;

  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    // Vite's HMR uses its own websocket on a different path — leave it alone.
    const url = req.url || "";
    if (!url.startsWith("/ws")) return;

    sessionMiddleware(req as AnyRequest, {} as any, () => {
      const userId = (req as AnyRequest).session?.userId;
      if (!userId) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        add(userId, ws);

        let alive = true;
        ws.on("pong", () => {
          alive = true;
        });

        const heartbeat = setInterval(() => {
          if (!alive) {
            try { ws.terminate(); } catch {}
            return;
          }
          alive = false;
          try { ws.ping(); } catch {}
        }, 30000);

        ws.on("close", () => {
          clearInterval(heartbeat);
          remove(userId, ws);
        });
        ws.on("error", () => {
          clearInterval(heartbeat);
          remove(userId, ws);
        });
      });
    });
  });
}
