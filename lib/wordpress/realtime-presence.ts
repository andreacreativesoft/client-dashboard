"use client";

/**
 * Real-time presence hooks for WordPress management.
 * Uses Supabase Realtime to track active users on a website
 * and maintain a heartbeat for the current user's session.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { WPActiveSessionRow, WPActionQueueRow } from "@/types/database";

// ─── Constants ──────────────────────────────────────────────────────────

const HEARTBEAT_INTERVAL = 30_000; // 30 seconds
const STALE_THRESHOLD = 120_000; // 2 minutes — sessions older than this are considered stale

// ─── Types ──────────────────────────────────────────────────────────────

export interface ActiveUser {
  id: string;
  user_id: string;
  user_email?: string;
  action_description: string | null;
  resource_type: string | null;
  resource_id: string | null;
  last_heartbeat: string;
  is_stale: boolean;
}

// ─── useActiveUsers ─────────────────────────────────────────────────────

/**
 * Subscribe to active users on a website via Supabase Realtime.
 * Filters out stale sessions (> 2 minutes since last heartbeat).
 */
export function useActiveUsers(websiteId: string) {
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    // Initial fetch
    async function fetchSessions() {
      const { data } = await supabase
        .from("wp_active_sessions")
        .select("*")
        .eq("website_id", websiteId);

      if (data) {
        const sessions = (data as WPActiveSessionRow[]).map(toActiveUser).filter((u) => !u.is_stale);
        setActiveUsers(sessions);
      }
      setLoading(false);
    }

    fetchSessions();

    // Subscribe to changes
    const channel = supabase
      .channel(`wp_active_sessions:${websiteId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wp_active_sessions",
          filter: `website_id=eq.${websiteId}`,
        },
        () => {
          // Re-fetch on any change — simpler than tracking individual events
          fetchSessions();
        }
      )
      .subscribe();

    // Periodic stale check (remove users whose heartbeat expired)
    const staleTimer = setInterval(() => {
      setActiveUsers((prev) => prev.filter((u) => !isStale(u.last_heartbeat)));
    }, HEARTBEAT_INTERVAL);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(staleTimer);
    };
  }, [websiteId]);

  return { activeUsers, loading };
}

// ─── usePresenceHeartbeat ───────────────────────────────────────────────

/**
 * Register the current user as active on a website and maintain a heartbeat.
 * Automatically cleans up on unmount.
 */
export function usePresenceHeartbeat(
  websiteId: string,
  userId: string | null,
  actionDescription?: string
) {
  const sessionIdRef = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (sessionIdRef.current) {
      const supabase = createClient();
      await supabase
        .from("wp_active_sessions")
        .delete()
        .eq("id", sessionIdRef.current);
      sessionIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();

    async function register() {
      // Upsert — delete any existing session for this user on this site first
      await supabase
        .from("wp_active_sessions")
        .delete()
        .eq("website_id", websiteId)
        .eq("user_id", userId!);

      const { data } = await supabase
        .from("wp_active_sessions")
        .insert({
          website_id: websiteId,
          user_id: userId!,
          action_description: actionDescription ?? null,
          last_heartbeat: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (data) {
        sessionIdRef.current = (data as { id: string }).id;
      }
    }

    async function heartbeat() {
      if (!sessionIdRef.current) return;
      const supabase = createClient();
      await supabase
        .from("wp_active_sessions")
        .update({
          last_heartbeat: new Date().toISOString(),
          action_description: actionDescription ?? null,
        })
        .eq("id", sessionIdRef.current);
    }

    register();

    intervalRef.current = setInterval(heartbeat, HEARTBEAT_INTERVAL);

    // Cleanup on unmount or tab close
    const handleBeforeUnload = () => {
      if (sessionIdRef.current) {
        const supabase = createClient();
        // Use sendBeacon-like approach — fire and forget
        supabase
          .from("wp_active_sessions")
          .delete()
          .eq("id", sessionIdRef.current)
          .then(() => {});
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      cleanup();
    };
  }, [websiteId, userId, actionDescription, cleanup]);

  return { cleanup };
}

// ─── useQueueUpdates ────────────────────────────────────────────────────

/**
 * Subscribe to action queue changes for a website via Supabase Realtime.
 * Useful for showing real-time status of pending/processing actions.
 */
export function useQueueUpdates(websiteId: string) {
  const [pendingActions, setPendingActions] = useState<WPActionQueueRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function fetchPending() {
      const { data } = await supabase
        .from("wp_action_queue")
        .select("*")
        .eq("website_id", websiteId)
        .in("status", ["pending", "processing"])
        .order("created_at", { ascending: true });

      if (data) {
        setPendingActions(data as WPActionQueueRow[]);
      }
      setLoading(false);
    }

    fetchPending();

    const channel = supabase
      .channel(`wp_action_queue:${websiteId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wp_action_queue",
          filter: `website_id=eq.${websiteId}`,
        },
        () => {
          fetchPending();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [websiteId]);

  return { pendingActions, loading };
}

// ─── Helpers ────────────────────────────────────────────────────────────

function isStale(lastHeartbeat: string): boolean {
  return Date.now() - new Date(lastHeartbeat).getTime() > STALE_THRESHOLD;
}

function toActiveUser(session: WPActiveSessionRow): ActiveUser {
  return {
    id: session.id,
    user_id: session.user_id,
    action_description: session.action_description,
    resource_type: session.resource_type,
    resource_id: session.resource_id,
    last_heartbeat: session.last_heartbeat,
    is_stale: isStale(session.last_heartbeat),
  };
}
