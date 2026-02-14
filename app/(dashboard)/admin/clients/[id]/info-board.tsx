"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getWebsiteInfo,
  addWebsiteInfoAction,
  updateWebsiteInfoAction,
  deleteWebsiteInfoAction,
} from "@/lib/actions/website-info";
import type { WebsiteInfo } from "@/types/database";

interface InfoBoardProps {
  websiteId: string;
}

function InfoItem({
  item,
  websiteId,
  onUpdated,
}: {
  item: WebsiteInfo;
  websiteId: string;
  onUpdated: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [label, setLabel] = useState(item.label);
  const [value, setValue] = useState(item.value);
  const [isSensitive, setIsSensitive] = useState(item.is_sensitive);

  async function handleSave() {
    setSaving(true);
    const result = await updateWebsiteInfoAction(item.id, {
      label,
      value,
      is_sensitive: isSensitive,
    });
    setSaving(false);
    if (result.success) {
      setEditing(false);
      onUpdated();
    } else {
      alert(result.error || "Failed to save");
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${item.label}"?`)) return;
    const result = await deleteWebsiteInfoAction(item.id, websiteId);
    if (result.success) {
      onUpdated();
    } else {
      alert(result.error || "Failed to delete");
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(item.value);
  }

  if (editing) {
    return (
      <div className="space-y-2 rounded border border-border bg-background p-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px]">Label</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="h-7 text-xs"
              placeholder="e.g. Hosting Login"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Value</Label>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-7 text-xs"
              placeholder="username / password / URL"
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <input
              type="checkbox"
              checked={isSensitive}
              onChange={(e) => setIsSensitive(e.target.checked)}
              className="rounded border-input"
            />
            Sensitive (hidden by default)
          </label>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(false)}
              className="h-6 px-2 text-[10px]"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !label.trim() || !value.trim()}
              className="h-6 px-2 text-[10px]"
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded border border-border bg-background px-2 py-1.5">
      <div className="min-w-0 flex-1">
        <span className="text-[10px] font-medium uppercase text-muted-foreground">
          {item.label}
        </span>
        <p className="truncate text-xs">
          {item.is_sensitive && !revealed ? (
            <span className="text-muted-foreground">
              {"••••••••"}
              <button
                onClick={() => setRevealed(true)}
                className="ml-1 text-[10px] text-muted-foreground underline hover:text-foreground"
              >
                show
              </button>
            </span>
          ) : (
            <>
              {item.value}
              {item.is_sensitive && (
                <button
                  onClick={() => setRevealed(false)}
                  className="ml-1 text-[10px] text-muted-foreground underline hover:text-foreground"
                >
                  hide
                </button>
              )}
            </>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={handleCopy}
          className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
          title="Copy value"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
          </svg>
        </button>
        <button
          onClick={() => setEditing(true)}
          className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
          title="Edit"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
          </svg>
        </button>
        <button
          onClick={handleDelete}
          className="rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
          title="Delete"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function InfoBoard({ websiteId }: InfoBoardProps) {
  const [items, setItems] = useState<WebsiteInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newSensitive, setNewSensitive] = useState(false);

  async function loadItems() {
    const data = await getWebsiteInfo(websiteId);
    setItems(data);
    setLoading(false);
  }

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [websiteId]);

  async function handleAdd() {
    if (!newLabel.trim() || !newValue.trim()) return;
    setSaving(true);
    const result = await addWebsiteInfoAction(websiteId, {
      label: newLabel.trim(),
      value: newValue.trim(),
      is_sensitive: newSensitive,
    });
    setSaving(false);
    if (result.success) {
      setNewLabel("");
      setNewValue("");
      setNewSensitive(false);
      setShowAddForm(false);
      loadItems();
    } else {
      alert(result.error || "Failed to add");
    }
  }

  return (
    <div className="mt-4 border-t border-border pt-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium uppercase text-muted-foreground">
          Info Board
        </p>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[10px] font-medium transition-colors hover:bg-muted"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Info
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => (
            <InfoItem
              key={item.id}
              item={item}
              websiteId={websiteId}
              onUpdated={loadItems}
            />
          ))}

          {items.length === 0 && !showAddForm && (
            <p className="text-xs text-muted-foreground">
              No info yet. Add hosting credentials, WP logins, or other notes.
            </p>
          )}

          {showAddForm && (
            <div className="space-y-2 rounded border border-border bg-background p-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px]">Label</Label>
                  <Input
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    className="h-7 text-xs"
                    placeholder="e.g. Hosting Login"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Value</Label>
                  <Input
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    className="h-7 text-xs"
                    placeholder="username / password / URL"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={newSensitive}
                    onChange={(e) => setNewSensitive(e.target.checked)}
                    className="rounded border-input"
                  />
                  Sensitive (hidden by default)
                </label>
                <div className="flex gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowAddForm(false);
                      setNewLabel("");
                      setNewValue("");
                      setNewSensitive(false);
                    }}
                    className="h-6 px-2 text-[10px]"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleAdd}
                    disabled={saving || !newLabel.trim() || !newValue.trim()}
                    className="h-6 px-2 text-[10px]"
                  >
                    {saving ? "Saving..." : "Add"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
