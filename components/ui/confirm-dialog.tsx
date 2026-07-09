"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ConfirmOptions = {
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
    const ctx = useContext(ConfirmContext);
    if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
    return ctx;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    const [options, setOptions] = useState<ConfirmOptions | null>(null);
    const resolveRef = useRef<((value: boolean) => void) | null>(null);

    const confirm = useCallback<ConfirmFn>((opts) => {
        setOptions(opts);
        setOpen(true);
        return new Promise<boolean>((resolve) => {
            resolveRef.current = resolve;
        });
    }, []);

    const handleConfirm = () => {
        resolveRef.current?.(true);
        setOpen(false);
    };

    const handleCancel = () => {
        resolveRef.current?.(false);
        setOpen(false);
    };

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            <AlertDialog
                open={open}
                onOpenChange={(o) => {
                    if (!o) handleCancel();
                }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{options?.title}</AlertDialogTitle>
                        {options?.description && (
                            <AlertDialogDescription>{options.description}</AlertDialogDescription>
                        )}
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={handleCancel}>
                            {options?.cancelLabel ?? "Cancel"}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirm}
                            variant={options?.destructive ? "destructive" : "default"}>
                            {options?.confirmLabel ?? "Confirm"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </ConfirmContext.Provider>
    );
}
