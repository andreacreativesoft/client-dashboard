"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";

interface QuickActionsProps {
  websiteId: string;
}

interface ActionState {
  loading: string | null;
  result: { action: string; success: boolean; message: string } | null;
  maintenance: boolean | null;
  debug: boolean | null;
}

export function QuickActions({ websiteId }: QuickActionsProps) {
  const [state, setState] = useState<ActionState>({
    loading: null,
    result: null,
    maintenance: null,
    debug: null,
  });
  const [confirmAction, setConfirmAction] = useState<{
    action: string;
    title: string;
    message: string;
    payload?: Record<string, unknown>;
  } | null>(null);

  async function executeAction(
    action: string,
    payload?: Record<string, unknown>
  ) {
    setConfirmAction(null);
    setState((s) => ({ ...s, loading: action, result: null }));

    try {
      const res = await fetch(
        `/api/wordpress/${websiteId}/quick-action`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, payload }),
        }
      );

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || `Action failed`);
      }

      // Update local state based on result
      let message = "Action completed successfully.";

      if (action === "clear_cache") {
        const cleared = (data.result as { cleared?: string[] })?.cleared;
        message = cleared && cleared.length > 0
          ? `Cleared: ${cleared.join(", ")}`
          : "Cache cleared successfully.";
      } else if (action === "toggle_maintenance") {
        const enabled = (data.result as { maintenance?: boolean })?.maintenance;
        setState((s) => ({ ...s, maintenance: !!enabled }));
        message = enabled
          ? "Maintenance mode enabled. Visitors see a maintenance page."
          : "Maintenance mode disabled. Site is publicly accessible.";
      } else if (action === "toggle_debug") {
        const enabled = (data.result as { debug?: boolean })?.debug;
        setState((s) => ({ ...s, debug: !!enabled }));
        message = enabled
          ? "WP_DEBUG enabled. Error logging is on."
          : "WP_DEBUG disabled. Error logging stopped.";
      }

      setState((s) => ({
        ...s,
        loading: null,
        result: { action, success: true, message },
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: null,
        result: {
          action,
          success: false,
          message: (err as Error).message,
        },
      }));
    }
  }

  function requestClearCache() {
    setConfirmAction({
      action: "clear_cache",
      title: "Clear Cache",
      message:
        "Clear all caches on this site? This clears object cache, plugin caches, and transients.",
    });
  }

  function requestToggleMaintenance(enable: boolean) {
    setConfirmAction({
      action: "toggle_maintenance",
      title: enable ? "Enable Maintenance Mode" : "Disable Maintenance Mode",
      message: enable
        ? "Enable maintenance mode? Visitors will see a maintenance page."
        : "Disable maintenance mode? The site will be publicly accessible.",
      payload: { enable },
    });
  }

  function requestToggleDebug(enable: boolean) {
    setConfirmAction({
      action: "toggle_debug",
      title: enable ? "Enable Debug Mode" : "Disable Debug Mode",
      message: enable
        ? "Enable WP_DEBUG? Error logging will be turned on. Display remains off."
        : "Disable WP_DEBUG? Error logging will stop.",
      payload: { enable },
    });
  }

  const isLoading = state.loading !== null;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <svg
              className="h-5 w-5 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"
              />
            </svg>
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-3">
            {/* Clear Cache */}
            <ActionButton
              label="Clear Cache"
              icon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              }
              loading={state.loading === "clear_cache"}
              disabled={isLoading}
              onClick={requestClearCache}
            />

            {/* Toggle Maintenance */}
            <ToggleActionButton
              labelOn="Maintenance: ON"
              labelOff="Maintenance: OFF"
              active={state.maintenance}
              icon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.1 3.04a1.125 1.125 0 01-1.569-1.17l.815-5.69-4.162-4.038a1.125 1.125 0 01.624-1.92l5.732-.832L10.31 0a1.125 1.125 0 012.38 0l2.555 5.175 5.732.832a1.125 1.125 0 01.624 1.92l-4.162 4.038.815 5.69a1.125 1.125 0 01-1.569 1.17l-5.1-3.04z" />
                </svg>
              }
              loading={state.loading === "toggle_maintenance"}
              disabled={isLoading}
              onToggle={(enable) => requestToggleMaintenance(enable)}
            />

            {/* Toggle Debug */}
            <ToggleActionButton
              labelOn="Debug: ON"
              labelOff="Debug: OFF"
              active={state.debug}
              icon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 12.75c1.148 0 2.278.08 3.383.237 1.037.146 1.866.966 1.866 2.013 0 3.728-2.35 6.75-5.25 6.75S6.75 18.728 6.75 15c0-1.046.83-1.867 1.866-2.013A24.204 24.204 0 0112 12.75zm0 0c2.883 0 5.647.508 8.207 1.44a23.91 23.91 0 01-1.152-6.135c-.027-.702-.334-1.362-.838-1.848a3.2 3.2 0 00-.467-.375L17 5.25a3.003 3.003 0 00-4.412-2.645A3.003 3.003 0 007 5.25l-.75.563a3.2 3.2 0 00-.467.375c-.504.486-.811 1.146-.838 1.848a23.91 23.91 0 01-1.152 6.135A24.075 24.075 0 0112 12.75z" />
                </svg>
              }
              loading={state.loading === "toggle_debug"}
              disabled={isLoading}
              onToggle={(enable) => requestToggleDebug(enable)}
            />
          </div>

          {/* Result feedback */}
          {state.result && (
            <div
              className={`mt-3 rounded-lg border p-2.5 text-xs ${
                state.result.success
                  ? "border-green-500/50 bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400"
                  : "border-destructive/50 bg-destructive/5 text-destructive"
              }`}
            >
              <div className="flex items-start gap-2">
                {state.result.success ? (
                  <svg className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                ) : (
                  <svg className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                )}
                <span>{state.result.message}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Modal */}
      <Modal
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={confirmAction?.title || "Confirm Action"}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {confirmAction?.message}
          </p>
          <p className="text-xs text-muted-foreground">
            This action will be logged and can be viewed in action history.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmAction(null)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (confirmAction) {
                  executeAction(confirmAction.action, confirmAction.payload);
                }
              }}
            >
              Confirm
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ─── Action Button ──────────────────────────────────────────────────────

function ActionButton({
  label,
  icon,
  loading,
  disabled,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className="h-9 gap-2 text-xs"
    >
      {loading ? (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        icon
      )}
      {label}
    </Button>
  );
}

// ─── Toggle Action Button ───────────────────────────────────────────────

function ToggleActionButton({
  labelOn,
  labelOff,
  active,
  icon,
  loading,
  disabled,
  onToggle,
}: {
  labelOn: string;
  labelOff: string;
  active: boolean | null;
  icon: React.ReactNode;
  loading: boolean;
  disabled: boolean;
  onToggle: (enable: boolean) => void;
}) {
  // If we don't know the state yet, show a neutral toggle
  const isActive = active === true;
  const label = active === null ? labelOff : isActive ? labelOn : labelOff;

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onToggle(!isActive)}
        disabled={disabled}
        className="h-9 gap-2 text-xs"
      >
        {loading ? (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          icon
        )}
        {label}
      </Button>
      {active !== null && (
        <Badge
          variant={isActive ? "default" : "secondary"}
          className="text-[10px]"
        >
          {isActive ? "Active" : "Inactive"}
        </Badge>
      )}
    </div>
  );
}
