import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ThemeInfo } from "@/types/wordpress";

interface ThemeInfoCardProps {
  theme: ThemeInfo;
}

export function ThemeInfoCard({ theme }: ThemeInfoCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008Z" />
          </svg>
          Theme
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Name</span>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium">{theme.name}</span>
              <Badge variant="secondary" className="text-[10px]">
                v{theme.version}
              </Badge>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Type</span>
            <span className="text-sm font-medium">
              {theme.is_child_theme ? (
                <span className="flex items-center gap-1.5">
                  Child Theme
                  <Badge className="bg-blue-600 text-[10px] text-white hover:bg-blue-700">
                    Child
                  </Badge>
                </span>
              ) : (
                "Parent Theme"
              )}
            </span>
          </div>

          {theme.is_child_theme && theme.parent_theme && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Parent</span>
              <span className="text-sm font-medium">{theme.parent_theme}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Template</span>
            <span className="font-mono text-xs text-muted-foreground">{theme.template}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Stylesheet</span>
            <span className="font-mono text-xs text-muted-foreground">{theme.stylesheet}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
