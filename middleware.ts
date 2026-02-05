import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public assets (icons, sw.js)
     */
    "/((?!_next/static|_next/image|favicon.ico|icon-.*\\.png|sw\\.js).*)",
  ],
};
