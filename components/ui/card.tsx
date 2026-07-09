import { type HTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/utils";

const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={cn(
                "rounded-lg border border-border bg-card text-card-foreground shadow-sm",
                className,
            )}
            {...props}
        />
    ),
);
Card.displayName = "Card";

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            data-slot="card-header"
            className={cn("flex flex-col gap-1.5 p-4 md:p-6", className)}
            {...props}
        />
    ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
    ({ className, ...props }, ref) => (
        <h3
            ref={ref}
            className={cn("text-xl font-semibold leading-snug tracking-tight", className)}
            {...props}
        />
    ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
    ({ className, ...props }, ref) => (
        <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
    ),
);
CardDescription.displayName = "CardDescription";

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        // Full padding by default. Only drop the top padding when this content
        // directly follows a CardHeader, so header + content stay flush — without
        // affecting cards where an image (or anything else) precedes the content.
        <div
            ref={ref}
            data-slot="card-content"
            className={cn("p-4 md:p-6 [[data-slot=card-header]+&]:pt-0", className)}
            {...props}
        />
    ),
);
CardContent.displayName = "CardContent";

export { Card, CardHeader, CardTitle, CardDescription, CardContent };
