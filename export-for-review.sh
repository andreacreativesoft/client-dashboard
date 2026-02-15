#!/bin/bash
# Export codebase for AI code review
# Generates files you can paste into Claude, ChatGPT, or Gemini

OUTPUT_DIR="./code-review-export"
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

echo "=== Exporting codebase for AI review ==="

# ─────────────────────────────────────────────
# 1. FULL EXPORT (single file — best for Gemini with 1M context)
# ─────────────────────────────────────────────
FULL_FILE="$OUTPUT_DIR/full-codebase.txt"
echo "# CLIENT DASHBOARD — FULL CODEBASE EXPORT" > "$FULL_FILE"
echo "# Generated: $(date)" >> "$FULL_FILE"
echo "# Purpose: AI code review" >> "$FULL_FILE"
echo "" >> "$FULL_FILE"

# Include CLAUDE.md as project context
echo "========================================" >> "$FULL_FILE"
echo "FILE: CLAUDE.md (Project Documentation)" >> "$FULL_FILE"
echo "========================================" >> "$FULL_FILE"
cat CLAUDE.md >> "$FULL_FILE"
echo -e "\n\n" >> "$FULL_FILE"

# Include all source files
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.sql" -o -name "*.css" -o -name "*.html" \) \
  ! -path "./node_modules/*" ! -path "./.next/*" ! -path "./package-lock.json" \
  ! -path "./code-review-export/*" \
  | sort | while read -r file; do
    echo "========================================" >> "$FULL_FILE"
    echo "FILE: $file" >> "$FULL_FILE"
    echo "========================================" >> "$FULL_FILE"
    cat "$file" >> "$FULL_FILE"
    echo -e "\n\n" >> "$FULL_FILE"
done

FULL_SIZE=$(wc -c < "$FULL_FILE")
FULL_LINES=$(wc -l < "$FULL_FILE")
echo "  [1] full-codebase.txt — ${FULL_LINES} lines, $(( FULL_SIZE / 1024 ))KB"

# ─────────────────────────────────────────────
# 2. CHUNKED EXPORTS (for Claude/ChatGPT with smaller contexts)
# ─────────────────────────────────────────────

# --- Chunk 1: Project overview + types + database ---
CHUNK1="$OUTPUT_DIR/chunk-1-foundation.txt"
echo "# CHUNK 1: Foundation (Types, Database, Config)" > "$CHUNK1"
echo "# Paste this first for context" >> "$CHUNK1"
echo "" >> "$CHUNK1"

echo "========================================" >> "$CHUNK1"
echo "FILE: CLAUDE.md" >> "$CHUNK1"
echo "========================================" >> "$CHUNK1"
cat CLAUDE.md >> "$CHUNK1"
echo -e "\n\n" >> "$CHUNK1"

for f in \
  package.json \
  tsconfig.json \
  next.config.ts \
  tailwind.config.ts \
  middleware.ts \
  types/index.ts \
  types/database.ts \
  types/auth.ts \
  types/api.ts \
  lib/utils.ts \
  lib/auth.ts \
  lib/rate-limit.ts \
  lib/constants/constants.ts \
  lib/constants/activity.ts \
  lib/supabase/client.ts \
  lib/supabase/server.ts \
  lib/supabase/admin.ts \
  lib/supabase/middleware.ts \
; do
  if [ -f "./$f" ]; then
    echo "========================================" >> "$CHUNK1"
    echo "FILE: $f" >> "$CHUNK1"
    echo "========================================" >> "$CHUNK1"
    cat "./$f" >> "$CHUNK1"
    echo -e "\n\n" >> "$CHUNK1"
  fi
done

echo "  [2] chunk-1-foundation.txt — $(wc -l < "$CHUNK1") lines, $(( $(wc -c < "$CHUNK1") / 1024 ))KB"

# --- Chunk 2: Server Actions (business logic) ---
CHUNK2="$OUTPUT_DIR/chunk-2-server-actions.txt"
echo "# CHUNK 2: Server Actions (Business Logic)" > "$CHUNK2"
echo "" >> "$CHUNK2"

find ./lib/actions -name "*.ts" | sort | while read -r file; do
  echo "========================================" >> "$CHUNK2"
  echo "FILE: $file" >> "$CHUNK2"
  echo "========================================" >> "$CHUNK2"
  cat "$file" >> "$CHUNK2"
  echo -e "\n\n" >> "$CHUNK2"
done

echo "  [3] chunk-2-server-actions.txt — $(wc -l < "$CHUNK2") lines, $(( $(wc -c < "$CHUNK2") / 1024 ))KB"

# --- Chunk 3: API Routes ---
CHUNK3="$OUTPUT_DIR/chunk-3-api-routes.txt"
echo "# CHUNK 3: API Routes" > "$CHUNK3"
echo "" >> "$CHUNK3"

find ./app/api -name "*.ts" | sort | while read -r file; do
  echo "========================================" >> "$CHUNK3"
  echo "FILE: $file" >> "$CHUNK3"
  echo "========================================" >> "$CHUNK3"
  cat "$file" >> "$CHUNK3"
  echo -e "\n\n" >> "$CHUNK3"
done

echo "  [4] chunk-3-api-routes.txt — $(wc -l < "$CHUNK3") lines, $(( $(wc -c < "$CHUNK3") / 1024 ))KB"

# --- Chunk 4: Pages & Layouts ---
CHUNK4="$OUTPUT_DIR/chunk-4-pages.txt"
echo "# CHUNK 4: Pages & Layouts" > "$CHUNK4"
echo "" >> "$CHUNK4"

find ./app -name "*.tsx" -o -name "*.ts" | grep -v "/api/" | sort | while read -r file; do
  echo "========================================" >> "$CHUNK4"
  echo "FILE: $file" >> "$CHUNK4"
  echo "========================================" >> "$CHUNK4"
  cat "$file" >> "$CHUNK4"
  echo -e "\n\n" >> "$CHUNK4"
done

echo "  [5] chunk-4-pages.txt — $(wc -l < "$CHUNK4") lines, $(( $(wc -c < "$CHUNK4") / 1024 ))KB"

# --- Chunk 5: Components ---
CHUNK5="$OUTPUT_DIR/chunk-5-components.txt"
echo "# CHUNK 5: Reusable Components" > "$CHUNK5"
echo "" >> "$CHUNK5"

find ./components -name "*.tsx" -o -name "*.ts" | sort | while read -r file; do
  echo "========================================" >> "$CHUNK5"
  echo "FILE: $file" >> "$CHUNK5"
  echo "========================================" >> "$CHUNK5"
  cat "$file" >> "$CHUNK5"
  echo -e "\n\n" >> "$CHUNK5"
done

echo "  [6] chunk-5-components.txt — $(wc -l < "$CHUNK5") lines, $(( $(wc -c < "$CHUNK5") / 1024 ))KB"

# --- Chunk 6: Integrations & Services ---
CHUNK6="$OUTPUT_DIR/chunk-6-services.txt"
echo "# CHUNK 6: External Services & Integrations" > "$CHUNK6"
echo "" >> "$CHUNK6"

for f in \
  lib/google.ts \
  lib/facebook.ts \
  lib/email.ts \
  lib/push.ts \
  lib/impersonate.ts \
  lib/login-security.ts \
  lib/reports/gather-data.ts \
  lib/reports/generate.ts \
  lib/reports/pdf-template.ts \
  lib/reports/types.ts \
  lib/wordpress/crawler.ts \
  lib/wordpress/ai-analyzer.ts \
; do
  if [ -f "./$f" ]; then
    echo "========================================" >> "$CHUNK6"
    echo "FILE: $f" >> "$CHUNK6"
    echo "========================================" >> "$CHUNK6"
    cat "./$f" >> "$CHUNK6"
    echo -e "\n\n" >> "$CHUNK6"
  fi
done

echo "  [7] chunk-6-services.txt — $(wc -l < "$CHUNK6") lines, $(( $(wc -c < "$CHUNK6") / 1024 ))KB"

# --- Chunk 7: Database Migrations ---
CHUNK7="$OUTPUT_DIR/chunk-7-database.txt"
echo "# CHUNK 7: Database Migrations (SQL)" > "$CHUNK7"
echo "" >> "$CHUNK7"

find ./supabase -name "*.sql" | sort | while read -r file; do
  echo "========================================" >> "$CHUNK7"
  echo "FILE: $file" >> "$CHUNK7"
  echo "========================================" >> "$CHUNK7"
  cat "$file" >> "$CHUNK7"
  echo -e "\n\n" >> "$CHUNK7"
done

echo "  [8] chunk-7-database.txt — $(wc -l < "$CHUNK7") lines, $(( $(wc -c < "$CHUNK7") / 1024 ))KB"

# --- Chunk 8: PWA & Config ---
CHUNK8="$OUTPUT_DIR/chunk-8-pwa-config.txt"
echo "# CHUNK 8: PWA, Service Worker & Config" > "$CHUNK8"
echo "" >> "$CHUNK8"

for f in \
  public/sw.js \
  public/offline.html \
  app/manifest.ts \
  app/globals.css \
  app/layout.tsx \
  .env.example \
; do
  if [ -f "./$f" ]; then
    echo "========================================" >> "$CHUNK8"
    echo "FILE: $f" >> "$CHUNK8"
    echo "========================================" >> "$CHUNK8"
    cat "./$f" >> "$CHUNK8"
    echo -e "\n\n" >> "$CHUNK8"
  fi
done

echo "  [9] chunk-8-pwa-config.txt — $(wc -l < "$CHUNK8") lines, $(( $(wc -c < "$CHUNK8") / 1024 ))KB"

# ─────────────────────────────────────────────
# 3. REVIEW PROMPT TEMPLATE
# ─────────────────────────────────────────────
PROMPT_FILE="$OUTPUT_DIR/review-prompt.txt"
cat > "$PROMPT_FILE" << 'PROMPT'
You are reviewing a production SaaS application — a Client Dashboard Platform built for agencies to give their clients access to leads and business analytics.

Tech stack: Next.js 16 (App Router), React 19, TypeScript (strict), Supabase (PostgreSQL + Auth + RLS), Tailwind CSS v4, Vercel hosting, PWA.

Please review the code and provide a detailed assessment covering:

## 1. Security
- Authentication & authorization flaws
- SQL injection, XSS, CSRF vulnerabilities
- RLS (Row Level Security) gaps
- API key / token handling issues
- Input validation & sanitization gaps
- Rate limiting effectiveness

## 2. Architecture & Design
- Component structure and separation of concerns
- Server vs client component usage
- Data flow patterns (server actions, API routes)
- State management approach
- Error handling patterns

## 3. Performance
- Database query efficiency (N+1 queries, missing indexes)
- Unnecessary re-renders or data fetching
- Caching strategy effectiveness
- Bundle size concerns
- Loading state handling

## 4. Code Quality
- TypeScript usage (type safety, any types, assertions)
- Code duplication
- Naming conventions
- Error handling completeness
- Edge cases not handled

## 5. Best Practices
- Next.js App Router patterns
- Supabase SSR patterns
- React 19 patterns
- Accessibility (a11y)
- SEO considerations

## 6. Bugs & Issues
- Logic errors
- Race conditions
- Memory leaks
- Broken functionality

For each finding, provide:
- **Severity:** Critical / High / Medium / Low
- **File:** path to the file
- **Issue:** description
- **Recommendation:** how to fix it

Prioritize findings by severity. Be specific and actionable.
PROMPT

echo "  [10] review-prompt.txt — the prompt to use with each AI"

echo ""
echo "=== Export complete! ==="
echo ""
echo "Files are in: $OUTPUT_DIR/"
echo ""
echo "HOW TO USE:"
echo "─────────────────────────────────────────"
echo ""
echo "  GEMINI (1M context — can handle full codebase):"
echo "    1. Paste review-prompt.txt"
echo "    2. Upload or paste full-codebase.txt"
echo ""
echo "  CLAUDE (200K context):"
echo "    Session 1: Paste review-prompt.txt + chunk-1 + chunk-2 + chunk-3"
echo "    Session 2: Paste review-prompt.txt + chunk-4 + chunk-5"
echo "    Session 3: Paste review-prompt.txt + chunk-6 + chunk-7 + chunk-8"
echo "    Final:     Combine all findings and ask for a summary"
echo ""
echo "  CHATGPT (128K context):"
echo "    Same as Claude approach, possibly smaller chunks per session"
echo "    Or use file upload if available on your plan"
echo ""
