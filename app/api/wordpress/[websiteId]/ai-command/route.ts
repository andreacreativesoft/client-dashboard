import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAdmin } from "@/lib/auth";
import { WPClient } from "@/lib/wordpress/wp-client";
import { wpAITools } from "@/lib/wordpress/ai-tools";
import { createClient } from "@/lib/supabase/server";

const SYSTEM_PROMPT = `You are a WordPress management assistant for a client dashboard.
You have access to tools that interact with a WordPress site's REST API.

CRITICAL RULES:
1. NEVER make changes directly. Always use the "propose_changes" tool to show the user what you want to change.
2. First gather data using list/get tools, then analyze, then propose changes.
3. For ALT text generation, use the analyze_image tool to see each image before generating ALT text.
4. Be specific and actionable in your proposals.
5. If you need more context, explain what information would help rather than guessing.

WORKFLOW:
1. Understand the user's command
2. Fetch relevant data from WordPress
3. Analyze the data
4. Use propose_changes to present a table of changes for user review`;

const MAX_ITERATIONS = 20;

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
      { error: "AI not configured (ANTHROPIC_API_KEY missing)" },
      { status: 503 }
    );
  }

  const { websiteId } = await params;
  const { command } = await request.json();

  if (!command || typeof command !== "string") {
    return NextResponse.json({ error: "Command is required" }, { status: 400 });
  }

  try {
    const client = await WPClient.fromWebsiteId(websiteId);
    const anthropic = new Anthropic({ apiKey });

    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: command },
    ];

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let finalProposal: Record<string, unknown> | null = null;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: wpAITools,
        messages,
      });

      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;

      // End of conversation — Claude is done
      if (response.stop_reason === "end_turn") {
        const textContent = response.content.find((c) => c.type === "text");

        // Track usage
        await trackUsage(
          websiteId,
          client.integrationIdValue,
          auth.userId,
          totalInputTokens,
          totalOutputTokens,
          command
        );

        return NextResponse.json({
          type: "message",
          message: textContent?.type === "text" ? textContent.text : "",
          proposal: finalProposal,
          usage: {
            input_tokens: totalInputTokens,
            output_tokens: totalOutputTokens,
          },
        });
      }

      // Tool use — execute tools and continue
      if (response.stop_reason === "tool_use") {
        const assistantContent = response.content;
        messages.push({ role: "assistant", content: assistantContent });

        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of assistantContent) {
          if (block.type !== "tool_use") continue;

          const input = block.input as Record<string, unknown>;
          const toolResult = await executeWPTool(client, block.name, input, apiKey);

          if (block.name === "propose_changes") {
            finalProposal = input;
          }

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(toolResult),
          });
        }

        messages.push({ role: "user", content: toolResults });
      }
    }

    // Max iterations reached
    await trackUsage(
      websiteId,
      client.integrationIdValue,
      auth.userId,
      totalInputTokens,
      totalOutputTokens,
      command
    );

    return NextResponse.json({
      type: "error",
      message: "Maximum iterations reached. Please try a more specific command.",
    });
  } catch (error) {
    console.error("AI command error:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

// ─── Tool Executor ──────────────────────────────────────────────────────

async function executeWPTool(
  client: WPClient,
  toolName: string,
  input: Record<string, unknown>,
  apiKey: string
): Promise<unknown> {
  try {
    switch (toolName) {
      case "list_media":
        return await client.getMedia(input as { per_page?: number; page?: number; search?: string });
      case "get_media_item":
        return await client.getMediaItem(input.id as number);
      case "update_media_alt":
        // Don't execute — just acknowledge for proposal
        return { noted: true, id: input.id, alt_text: input.alt_text };
      case "list_pages":
        return await client.getPages(input as { per_page?: number; page?: number; search?: string; status?: string });
      case "get_page":
        return await client.getPage(input.id as number);
      case "update_page":
        return { noted: true, ...input };
      case "list_posts":
        return await client.getPosts(input as { per_page?: number; page?: number; search?: string; status?: string });
      case "get_post":
        return await client.getPost(input.id as number);
      case "update_post":
        return { noted: true, ...input };
      case "get_site_health":
        return await client.getSiteHealth();
      case "list_plugins":
        return await client.getPlugins();
      case "toggle_plugin":
        return { noted: true, ...input };
      case "list_menus":
        return await client.getMenus();
      case "get_menu_items":
        return await client.getMenuItems(input.menu_id as number);
      case "create_menu_item":
        return { noted: true, ...input };
      case "analyze_image": {
        const anthropic = new Anthropic({ apiKey });
        const visionResponse = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 300,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: { type: "url", url: input.image_url as string },
                },
                {
                  type: "text",
                  text: `Generate concise, descriptive ALT text for this image. ${
                    input.context ? `Context: ${input.context}` : ""
                  } Under 125 characters, descriptive, accessibility-focused. Return ONLY the ALT text.`,
                },
              ],
            },
          ],
        });
        const textBlock = visionResponse.content.find((b) => b.type === "text");
        return {
          image_url: input.image_url,
          suggested_alt_text: textBlock?.type === "text" ? textBlock.text : "",
        };
      }
      case "propose_changes":
        return {
          acknowledged: true,
          changes_count: Array.isArray(input.changes)
            ? input.changes.length
            : 0,
        };
      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    return { error: (error as Error).message };
  }
}

// ─── Usage Tracking ─────────────────────────────────────────────────────

async function trackUsage(
  websiteId: string,
  integrationId: string,
  userId: string,
  inputTokens: number,
  outputTokens: number,
  command: string
) {
  try {
    const supabase = await createClient();
    await supabase.from("wp_ai_usage").insert({
      website_id: websiteId,
      integration_id: integrationId,
      user_id: userId,
      action_type: "ai_command",
      model: "claude-sonnet-4-20250514",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      estimated_cost_usd:
        (inputTokens * 3 + outputTokens * 15) / 1_000_000,
      metadata: { command },
    });
  } catch {
    // Non-critical — don't fail the request
  }
}
