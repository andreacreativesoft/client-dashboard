import { Slot } from "radix-ui";
import { type ButtonHTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/utils";

type Variant = "default" | "outline" | "ghost" | "destructive" | "secondary" | "link";
type Size = "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";

const variantStyles: Record<Variant, string> = {
    default: "bg-primary text-primary-foreground hover:bg-primary/80 active:bg-primary/70",
    outline:
        "border border-border bg-background hover:bg-muted hover:border-foreground/20 text-foreground",
    ghost: "hover:bg-muted text-foreground",
    destructive:
        "bg-destructive text-destructive-foreground hover:bg-destructive/80 active:bg-destructive/70",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    link: "text-primary underline-offset-4 hover:underline",
};

const sizeStyles: Record<Size, string> = {
    default: "h-11 px-4 py-2 text-sm",
    xs: "h-7 px-2 text-xs",
    sm: "h-9 px-3 text-sm",
    lg: "h-12 px-6 text-base",
    icon: "h-11 w-11",
    "icon-xs": "h-7 w-7",
    "icon-sm": "h-9 w-9",
    "icon-lg": "h-12 w-12",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
    asChild?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot.Root : "button";
        return (
            <Comp
                className={cn(
                    "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                    variantStyles[variant],
                    sizeStyles[size],
                    className,
                )}
                ref={ref}
                {...props}
            />
        );
    },
);
Button.displayName = "Button";

export { Button, type ButtonProps };
