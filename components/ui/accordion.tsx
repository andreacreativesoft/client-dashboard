"use client";

import { ChevronDown } from "lucide-react";
import { Accordion as AccordionPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

function Accordion({ ...props }: React.ComponentProps<typeof AccordionPrimitive.Root>) {
    return <AccordionPrimitive.Root data-slot="accordion" {...props} />;
}

function AccordionItem({
    className,
    ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
    return <AccordionPrimitive.Item data-slot="accordion-item" className={className} {...props} />;
}

function AccordionTrigger({
    className,
    children,
    ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
    return (
        <AccordionPrimitive.Header className="flex">
            <AccordionPrimitive.Trigger
                data-slot="accordion-trigger"
                className={cn(
                    "flex flex-1 cursor-pointer items-center justify-between gap-4 text-left font-bold text-ink outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand disabled:pointer-events-none [&[data-state=open]>svg]:rotate-180",
                    className,
                )}
                {...props}>
                {children}
                <ChevronDown className="size-5 shrink-0 text-ink-muted transition-transform duration-200" />
            </AccordionPrimitive.Trigger>
        </AccordionPrimitive.Header>
    );
}

function AccordionContent({
    className,
    children,
    ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
    return (
        <AccordionPrimitive.Content
            data-slot="accordion-content"
            className="overflow-hidden data-[state=closed]:hidden"
            {...props}>
            <div className={cn("pt-6", className)}>{children}</div>
        </AccordionPrimitive.Content>
    );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
