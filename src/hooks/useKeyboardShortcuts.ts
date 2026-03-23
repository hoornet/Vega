import { useEffect } from "react";
import { useUIStore } from "../stores/ui";
import { useFeedStore } from "../stores/feed";

export function useKeyboardShortcuts() {
  const { currentView, setView, goBack, toggleHelp, showDebugPanel, toggleDebugPanel } = useUIStore();
  const { focusedNoteIndex, setFocusedNoteIndex, notes } = useFeedStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+Shift+D works everywhere, even in text fields
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault();
        toggleDebugPanel();
        return;
      }

      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;
      switch (e.key) {
        case "n":
          setView("feed");
          setTimeout(() => (document.querySelector("[data-compose]") as HTMLTextAreaElement)?.focus(), 50);
          break;
        case "/":
          e.preventDefault();
          setView("search");
          setTimeout(() => (document.querySelector("[data-search-input]") as HTMLInputElement)?.focus(), 50);
          break;
        case "Escape":
          if (showDebugPanel) { toggleDebugPanel(); break; }
          goBack();
          break;
        case "?":
          toggleHelp();
          break;
        case "j":
          if (currentView === "feed")
            setFocusedNoteIndex(Math.min(focusedNoteIndex + 1, notes.length - 1));
          break;
        case "k":
          if (currentView === "feed")
            setFocusedNoteIndex(Math.max(focusedNoteIndex - 1, 0));
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentView, focusedNoteIndex, notes.length, showDebugPanel]);
}
