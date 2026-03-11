import { useEffect, useRef } from "react";
import { useUserStore } from "../../stores/user";
import { useNotificationsStore } from "../../stores/notifications";
import { NoteCard } from "../feed/NoteCard";

export function NotificationsView() {
  const { pubkey, loggedIn } = useUserStore();
  const {
    notifications,
    unreadCount,
    lastSeenAt,
    loading,
    fetchNotifications,
    markAllRead,
  } = useNotificationsStore();

  // Capture lastSeenAt at mount time so unread highlights persist during this view session
  const prevLastSeenAtRef = useRef(lastSeenAt);

  useEffect(() => {
    if (!pubkey) return;
    fetchNotifications(pubkey).then(() => {
      setTimeout(() => markAllRead(), 500);
    });
  }, [pubkey]);

  if (!loggedIn || !pubkey) {
    return (
      <div className="h-full flex items-center justify-center text-text-dim text-[12px]">
        Log in to see notifications.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <header className="border-b border-border px-4 py-2.5 flex items-center justify-between shrink-0">
        <h1 className="text-text text-sm font-medium tracking-wide">Notifications</h1>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-[11px] text-text-dim hover:text-accent transition-colors"
          >
            mark all read
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        {loading && notifications.length === 0 && (
          <div className="px-4 py-8 text-text-dim text-[12px] text-center">
            Loading notifications…
          </div>
        )}

        {!loading && notifications.length === 0 && (
          <div className="px-4 py-8 text-text-dim text-[12px] text-center">
            No mentions yet.
          </div>
        )}

        {notifications.map((event) => {
          const isUnread = (event.created_at ?? 0) > prevLastSeenAtRef.current;
          return (
            <div
              key={event.id}
              className={isUnread ? "border-l-2 border-accent/40" : ""}
            >
              <NoteCard event={event} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
