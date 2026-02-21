"use client";

import { useActiveUsers, usePresenceHeartbeat } from "@/lib/wordpress/realtime-presence";

interface ActiveUsersProps {
  websiteId: string;
  currentUserId: string;
}

/**
 * Shows active users currently viewing/editing a WordPress site.
 * Also registers the current user's presence via heartbeat.
 */
export function ActiveUsers({ websiteId, currentUserId }: ActiveUsersProps) {
  const { activeUsers, loading } = useActiveUsers(websiteId);
  usePresenceHeartbeat(websiteId, currentUserId, "Viewing site");

  // Filter out current user from display
  const otherUsers = activeUsers.filter((u) => u.user_id !== currentUserId);

  if (loading || otherUsers.length === 0) return null;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs dark:border-blue-900 dark:bg-blue-950/30">
      <svg
        className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
        />
      </svg>
      <div className="flex items-center gap-1.5">
        {/* Avatar dots */}
        <div className="flex -space-x-1.5">
          {otherUsers.slice(0, 5).map((user) => (
            <div
              key={user.id}
              className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-blue-50 bg-blue-600 text-[9px] font-bold text-white dark:border-blue-950/30"
              title={user.user_email ?? user.user_id}
            >
              {(user.user_email ?? user.user_id).charAt(0).toUpperCase()}
            </div>
          ))}
        </div>
        <span className="text-blue-700 dark:text-blue-300">
          {otherUsers.length === 1
            ? "1 other user is viewing this site"
            : `${otherUsers.length} other users are viewing this site`}
        </span>
      </div>
    </div>
  );
}
