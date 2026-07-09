import { z } from "zod";

// Messages are i18n keys (validation.*) resolved with t() at display time, so
// the same schema surfaces localized errors in every form that consumes it.
const passwordSchema = z
    .string()
    .min(8, "validation.password_min")
    .max(128, "validation.password_too_long");

export const loginSchema = z.object({
    email: z.string().email("validation.email_invalid"),
    password: z.string().min(1, "validation.password_required"),
});

export const forgotPasswordSchema = z.object({
    email: z.string().email("validation.email_invalid"),
});

export const resetPasswordSchema = z
    .object({
        password: passwordSchema,
        confirm: z.string(),
    })
    .refine((data) => data.password === data.confirm, {
        message: "validation.passwords_no_match",
        path: ["confirm"],
    });

export const acceptInviteSchema = z
    .object({
        password: passwordSchema,
        confirm: z.string(),
    })
    .refine((data) => data.password === data.confirm, {
        message: "validation.passwords_no_match",
        path: ["confirm"],
    });

export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
