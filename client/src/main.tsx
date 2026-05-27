import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Register the service worker at app startup so Chrome's PWA install
// criteria are met regardless of whether the user ever subscribes to push
// notifications. The same /sw.js file also handles push events.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err) => console.warn("Service worker registration failed:", err));
  });
}
