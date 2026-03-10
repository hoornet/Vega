import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { useUserStore } from "./stores/user";

// Restore session — pubkey (read-only) or nsec via OS keychain
useUserStore.getState().restoreSession();

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
