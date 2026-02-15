"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  analyzeWebsite,
  cancelAnalysis,
  getAnalysisById,
  getWebsiteConfig,
  saveWebsiteConfig,
  getLatestAnalysis,
} from "@/lib/actions/wordpress";
import type {
  WPSiteConfig,
  WPAnalysis,
  AIRecommendation,
  AnalysisScores,
  RecommendationCategory,
  RecommendationPriority,
} from "@/types/wordpress";

// ─── Score Display ───────────────────────────────────────────────────

function ScoreCircle({ score, label }: { score: number; label: string }) {
  const color =
    score >= 80
      ? "text-green-600 dark:text-green-400"
      : score >= 60
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-red-600 dark:text-red-400";

  const bgColor =
    score >= 80
      ? "stroke-green-600 dark:stroke-green-400"
      : score >= 60
        ? "stroke-yellow-600 dark:stroke-yellow-400"
        : "stroke-red-600 dark:stroke-red-400";

  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-20 w-20">
        <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
          <circle
            cx="40"
            cy="40"
            r="36"
            fill="none"
            strokeWidth="6"
            className="stroke-muted"
          />
          <circle
            cx="40"
            cy="40"
            r="36"
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={bgColor}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-lg font-bold ${color}`}>{score}</span>
        </div>
      </div>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

function ScoresOverview({ scores }: { scores: AnalysisScores }) {
  return (
    <div className="flex items-center justify-center gap-6 py-4 md:gap-8">
      <ScoreCircle score={scores.overall} label="Overall" />
      <ScoreCircle score={scores.seo} label="SEO" />
      <ScoreCircle score={scores.performance} label="Performance" />
      <ScoreCircle score={scores.technical} label="Technical" />
    </div>
  );
}

// ─── Recommendation Card ─────────────────────────────────────────────

const priorityOrder: Record<RecommendationPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const priorityVariant: Record<RecommendationPriority, "destructive" | "warning" | "secondary" | "outline"> = {
  critical: "destructive",
  high: "warning",
  medium: "secondary",
  low: "outline",
};

const categoryLabels: Record<RecommendationCategory, string> = {
  seo: "SEO",
  performance: "Performance",
  technical: "Technical",
  content: "Content",
};

function RecommendationItem({ rec }: { rec: AIRecommendation }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-border p-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start justify-between gap-2 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={priorityVariant[rec.priority]} className="text-[10px]">
              {rec.priority}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {categoryLabels[rec.category]}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {rec.effort}
            </Badge>
          </div>
          <p className="mt-1 text-sm font-medium">{rec.title}</p>
        </div>
        <svg
          className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-border pt-3 text-sm">
          <p className="text-muted-foreground">{rec.description}</p>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded bg-muted p-2">
              <p className="text-[10px] font-medium uppercase text-muted-foreground">Current</p>
              <p className="text-xs">{rec.current}</p>
            </div>
            <div className="rounded bg-muted p-2">
              <p className="text-[10px] font-medium uppercase text-muted-foreground">Recommended</p>
              <p className="text-xs">{rec.ideal}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Impact:</span> {rec.impact}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Config Form ─────────────────────────────────────────────────────

function ConfigForm({
  websiteId,
  config,
  onSaved,
}: {
  websiteId: string;
  config: WPSiteConfig | null;
  onSaved: (config: WPSiteConfig) => void;
}) {
  const [localPath, setLocalPath] = useState(config?.local_path || "");
  const [deployMethod, setDeployMethod] = useState<"none" | "git" | "wp_migrate">(
    config?.deploy_method || "none"
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const result = await saveWebsiteConfig(websiteId, localPath, deployMethod);
    setSaving(false);

    if (result.success && result.config) {
      onSaved(result.config);
    } else {
      setError(result.error || "Failed to save configuration");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="local_path" className="text-xs">
          Local WordPress Path
        </Label>
        <Input
          id="local_path"
          value={localPath}
          onChange={(e) => setLocalPath(e.target.value)}
          placeholder="C:\Users\ID Bogdan\Local Sites\site-name\app\public"
          required
          className="h-9 text-xs"
        />
        <p className="text-[10px] text-muted-foreground">
          Path to the WordPress installation root (where wp-config.php lives)
        </p>
      </div>

      <div className="space-y-1">
        <Label htmlFor="deploy_method" className="text-xs">
          Deploy Method
        </Label>
        <select
          id="deploy_method"
          value={deployMethod}
          onChange={(e) => setDeployMethod(e.target.value as "none" | "git" | "wp_migrate")}
          className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="none">Analysis Only</option>
          <option value="git">Git Push</option>
          <option value="wp_migrate">WP Migrate</option>
        </select>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <Button type="submit" size="sm" disabled={saving}>
        {saving ? "Saving..." : config ? "Update Config" : "Save Config"}
      </Button>
    </form>
  );
}

// ─── Analysis Running State ──────────────────────────────────────────

function AnalysisRunning({
  startedAt,
  onCancel,
  cancelling,
}: {
  startedAt: string;
  onCancel: () => void;
  cancelling: boolean;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <div className="flex flex-col items-center gap-3 py-8">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
      <div className="text-center">
        <p className="text-sm font-medium">Analysis in progress...</p>
        <p className="text-xs text-muted-foreground">
          Crawling site, analyzing with AI — this may take 1-2 minutes
        </p>
        <p className="mt-1 text-xs tabular-nums text-muted-foreground">
          {minutes}:{seconds.toString().padStart(2, "0")}
        </p>
      </div>
      <Button
        variant="destructive"
        size="sm"
        onClick={onCancel}
        disabled={cancelling}
        className="mt-2"
      >
        {cancelling ? "Stopping..." : "Stop Analysis"}
      </Button>
    </div>
  );
}

// ─── Category Filter ─────────────────────────────────────────────────

const categories: Array<{ value: RecommendationCategory | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "seo", label: "SEO" },
  { value: "performance", label: "Performance" },
  { value: "technical", label: "Technical" },
  { value: "content", label: "Content" },
];

// ─── Main Component ──────────────────────────────────────────────────

export function AIAnalysis({ websiteId }: { websiteId: string }) {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<WPSiteConfig | null>(null);
  const [analysis, setAnalysis] = useState<WPAnalysis | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<RecommendationCategory | "all">("all");
  const [pollingId, setPollingId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Load initial data
  useEffect(() => {
    async function load() {
      setLoading(true);
      const [configResult, analysisResult] = await Promise.all([
        getWebsiteConfig(websiteId),
        getLatestAnalysis(websiteId),
      ]);

      if (configResult.success && configResult.config) {
        setConfig(configResult.config);
      }

      if (analysisResult.success && analysisResult.analysis) {
        const a = analysisResult.analysis;
        setAnalysis(a);

        // If an analysis is currently running, start polling
        if (a.status === "running") {
          setAnalyzing(true);
          setPollingId(a.id);
        }
      }

      setLoading(false);
    }
    load();
  }, [websiteId]);

  // Poll for analysis completion
  useEffect(() => {
    if (!pollingId || !analyzing) return;

    const interval = setInterval(async () => {
      const result = await getAnalysisById(pollingId);
      if (result.success && result.analysis) {
        const a = result.analysis;
        if (a.status !== "running") {
          setAnalysis(a);
          setAnalyzing(false);
          setPollingId(null);
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [pollingId, analyzing]);

  // Start analysis
  async function handleAnalyze() {
    if (!config) {
      setShowConfig(true);
      return;
    }

    setAnalyzing(true);
    setCancelling(false);
    setError(null);
    setAnalysis((prev) => prev ? { ...prev, status: "running", started_at: new Date().toISOString() } : {
      id: "",
      website_id: websiteId,
      client_id: "",
      status: "running" as const,
      site_data: {},
      recommendations: [],
      scores: {},
      pages_analyzed: 0,
      issues_found: 0,
      claude_tokens: 0,
      summary: null,
      error_message: null,
      started_at: new Date().toISOString(),
      completed_at: null,
      created_at: new Date().toISOString(),
    });

    const result = await analyzeWebsite(websiteId);

    if (result.success && result.analysisId) {
      // Server action awaited completion — fetch the final result
      const finalResult = await getAnalysisById(result.analysisId);
      if (finalResult.success && finalResult.analysis) {
        setAnalysis(finalResult.analysis);
      }
      setAnalyzing(false);
      setPollingId(null);
      setCancelling(false);
    } else {
      setError(result.error || "Failed to start analysis");
      setAnalyzing(false);
      setCancelling(false);
    }
  }

  // Cancel analysis
  async function handleCancel() {
    // Need the analysis ID to cancel
    const analysisId = analysis?.id || pollingId;
    if (!analysisId) {
      // If we don't have an ID yet (server action hasn't returned), just reset UI
      setAnalyzing(false);
      return;
    }

    setCancelling(true);
    const result = await cancelAnalysis(analysisId);

    if (result.success) {
      setAnalysis((prev) => prev ? {
        ...prev,
        status: "failed" as const,
        error_message: "Cancelled by user",
        completed_at: new Date().toISOString(),
      } : prev);
      setAnalyzing(false);
      setPollingId(null);
    }
    setCancelling(false);
  }

  function handleConfigSaved(newConfig: WPSiteConfig) {
    setConfig(newConfig);
    setShowConfig(false);
  }

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-8 w-32" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Prepare recommendations
  const recommendations = (analysis?.recommendations || []) as AIRecommendation[];
  const scores = analysis?.scores as AnalysisScores | undefined;

  const filteredRecs =
    categoryFilter === "all"
      ? recommendations
      : recommendations.filter((r) => r.category === categoryFilter);

  const sortedRecs = [...filteredRecs].sort(
    (a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3)
  );

  return (
    <div className="space-y-4">
      {/* Config section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>AI WordPress Analysis</CardTitle>
          <div className="flex items-center gap-2">
            {config && (
              <button
                onClick={() => setShowConfig(!showConfig)}
                className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                title="Settings"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
              </button>
            )}
            <Button
              size="sm"
              onClick={handleAnalyze}
              disabled={analyzing || !config}
            >
              {analyzing ? "Analyzing..." : analysis ? "Re-analyze" : "Start Analysis"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!config && !showConfig && (
            <div className="rounded-lg border border-dashed border-border bg-muted/50 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Configure the local WordPress path to enable AI analysis.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => setShowConfig(true)}
              >
                Configure Path
              </Button>
            </div>
          )}

          {(showConfig || !config) && (showConfig || !config) && (
            <div className={config ? "border-t border-border pt-3" : ""}>
              <ConfigForm
                websiteId={websiteId}
                config={config}
                onSaved={handleConfigSaved}
              />
            </div>
          )}

          {config && showConfig && (
            <p className="mt-2 text-[10px] text-muted-foreground">
              Path: {config.local_path}
            </p>
          )}

          {error && (
            <div className="mt-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {analyzing && analysis?.started_at && (
            <AnalysisRunning
              startedAt={analysis.started_at}
              onCancel={handleCancel}
              cancelling={cancelling}
            />
          )}

          {/* Analysis failed */}
          {analysis?.status === "failed" && !analyzing && (
            <div className="mt-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
              <p className="text-sm font-medium text-destructive">Analysis Failed</p>
              <p className="mt-1 text-xs text-destructive/80">
                {analysis.error_message || "Unknown error occurred"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {analysis?.status === "completed" && !analyzing && (
        <>
          {/* Scores */}
          {scores && scores.overall > 0 && (
            <Card>
              <CardContent className="pt-4">
                <ScoresOverview scores={scores} />
              </CardContent>
            </Card>
          )}

          {/* Summary */}
          {analysis.summary && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{analysis.summary}</p>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>Pages: {analysis.pages_analyzed}</span>
                  <span>Issues: {analysis.issues_found}</span>
                  <span>Tokens: {analysis.claude_tokens?.toLocaleString()}</span>
                  {analysis.completed_at && (
                    <span>
                      Completed:{" "}
                      {new Date(analysis.completed_at).toLocaleString()}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Recommendations ({sortedRecs.length})
                  </CardTitle>
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  {categories.map((cat) => {
                    const count =
                      cat.value === "all"
                        ? recommendations.length
                        : recommendations.filter((r) => r.category === cat.value).length;
                    if (count === 0 && cat.value !== "all") return null;
                    return (
                      <button
                        key={cat.value}
                        onClick={() => setCategoryFilter(cat.value)}
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                          categoryFilter === cat.value
                            ? "bg-foreground text-background"
                            : "bg-muted text-muted-foreground hover:bg-muted-foreground/20"
                        }`}
                      >
                        {cat.label} ({count})
                      </button>
                    );
                  })}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {sortedRecs.map((rec) => (
                    <RecommendationItem key={rec.id} rec={rec} />
                  ))}
                  {sortedRecs.length === 0 && (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      No recommendations in this category.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
