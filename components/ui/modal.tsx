"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ModalProps {
    open: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    className?: string;
}

/**
 * Thin wrapper over the shadcn Dialog (Radix) keeping a simple open/onClose/title API.
 * Radix provides the focus trap, Escape/overlay close and accessibility.
 */
export function Modal({ open, onClose, title, children, className }: ModalProps) {
    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) onClose();
            }}>
            <DialogContent
                className={cn("flex max-h-[90vh] flex-col gap-4 sm:max-w-lg", className)}>
                <DialogHeader>
                    <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
                </DialogHeader>
                <div className="-mx-1.5 min-h-0 flex-1 overflow-y-auto px-1.5">{children}</div>
            </DialogContent>
        </Dialog>
    );
}
