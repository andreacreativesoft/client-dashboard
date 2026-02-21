import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAdmin } from "@/lib/auth";
import { WPClient } from "@/lib/wordpress/wp-client";
import { createClient } from "@/lib/supabase/server";
import type { DebugLogEntry } from "@/types/wordpress";

const SYSTEM_PROMPT = `You are an expert WordPress developer and DevOps engineer analyzing a debug.log file. Provide a concise, actionable analysis.

Your analysis must be returned as JSON in this exact format:
{
  "summary": "1-2 sentence overview of the log health",
  "severity": "critical|warning|healthy",
  "issues": [
    {
      "title": "Short issue title",
      "description": "What's happening and why it matters",
      "fix": "Specific steps to fix this",
      "priority": "critical|high|medium|low",
      "count": <number of occurrences>
    }
  ],
  "patterns": [
    "Description of a recurring pattern noticed in the logs"
  ],
  "recommendations": [
    "Actionable recommendation based on the log data"
  ]
}

Guidelines:
- Group similar errors together (don't list the same error 50 times)
- Identify the root cause when possible (e.g., a plugin causing multiple errors)
- Prioritize by impact: fatal > errors > warnings > notices > deprecated
- Be specific: reference actual file paths, plugin names, function names
- Keep it concise but thorough`;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI analysis not configured (ANTHROPIC_API_KEY missing)" },
      { status: 503 }
    );
  }

  const { websiteId } = await params;

  try {
    // Fetch the debug log
    const client = await WPClient.fromWebsiteId(websiteId);
    const logData = await client.getDebugLog(500);

    if (!logData.entries || logData.entries.length === 0) {
      return NextResponse.json({
        summary: "Debug log is empty. No issues detected.",
        severity: "healthy",
        issues: [],
        patterns: [],
        recommendations: ["Debug log is clean — no action needed."],
      });
    }

    // Build the prompt with log data
    const userPrompt = buildLogPrompt(logData.entries, logData.file_size);

    // Call Claude
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const tokensUsed =
      (response.usage?.input_tokens || 0) +
      (response.usage?.output_tokens || 0);

    // Extract text
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from AI");
    }

    // Parse JSON
    let jsonStr = textBlock.text.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr
        .replace(/^```(?:json)?\s*\n?/, "")
        .replace(/\n?```\s*$/, "");
    }

    const analysis = JSON.parse(jsonStr);

    // Track AI usage
    try {
      const supabase = await createClient();
      const { data: website } = await supabase
        .from("websites")
        .select("client_id")
        .eq("id", websiteId)
        .single();

      if (website) {
        const { data: integration } = await supabase
          .from("integrations")
          .select("id")
          .eq("client_id", website.client_id)
          .eq("type", "wordpress")
          .eq("is_active", true)
          .limit(1)
          .single();

        if (integration) {
          await supabase.from("wp_ai_usage").insert({
            website_id: websiteId,
            integration_id: integration.id,
            user_id: auth.userId,
            action_type: "debug_log_analysis",
            model: "claude-sonnet-4-20250514",
            input_tokens: response.usage?.input_tokens || 0,
            output_tokens: response.usage?.output_tokens || 0,
            estimated_cost_usd: estimateCost(
              response.usage?.input_tokens || 0,
              response.usage?.output_tokens || 0
            ),
          });
        }
      }
    } catch {
      // Non-critical — don't fail the request if tracking fails
    }

    return NextResponse.json({ ...analysis, tokens_used: tokensUsed });
  } catch (error) {
    console.error("Debug log AI analysis failed:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

function buildLogPrompt(entries: DebugLogEntry[], fileSize: string): string {
  const lines: string[] = [];
  lines.push(`## WordPress Debug Log Analysis`);
  lines.push(`**Total entries:** ${entries.length}`);
  lines.push(`**File size:** ${fileSize}`);
  lines.push("");

  // Summary counts
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    counts[entry.severity] = (counts[entry.severity] || 0) + 1;
  }
  lines.push("**Entry counts by severity:**");
  for (const [level, count] of Object.entries(counts)) {
    lines.push(`- ${level}: ${count}`);
  }
  lines.push("");

  // Include the actual log entries (limit to keep tokens reasonable)
  lines.push("## Log Entries (most recent first)");
  const recentEntries = entries.slice(-300);
  for (const entry of recentEntries.reverse()) {
    const parts = [`[${entry.severity.toUpperCase()}]`];
    if (entry.timestamp) parts.push(entry.timestamp);
    parts.push(entry.message);
    if (entry.file) parts.push(`in ${entry.file}${entry.line ? `:${entry.line}` : ""}`);
    lines.push(parts.join(" "));
  }

  return lines.join("\n");
}

function estimateCost(inputTokens: number, outputTokens: number): number {
  // Claude Sonnet pricing: $3/$15 per million tokens (input/output)
  return (inputTokens * 3 + outputTokens * 15) / 1_000_000;
}
