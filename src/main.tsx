import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { useUserStore } from "./stores/user";

// Restore session from localStorage
const savedPubkey = localStorage.getItem("wrystr_pubkey");
const savedLoginType = localStorage.getItem("wrystr_login_type");
if (savedPubkey && savedLoginType === "pubkey") {
  useUserStore.getState().loginWithPubkey(savedPubkey);
}
// Note: nsec is never stored, so nsec sessions can't be auto-restored.
// Future: restore via OS keychain.

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
