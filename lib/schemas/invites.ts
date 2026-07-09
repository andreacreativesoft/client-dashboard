import { z } from "zod";

// Messages are i18n keys (validation.*) resolved with t() at display time.
const passwordSchema = z
    .string()
    .min(8, "validation.password_min")
    .max(128, "validation.password_too_long");

export const acceptInviteWithProfileSchema = z
    .object({
        full_name: z
            .string()
            .trim()
            .min(2, "validation.name_min")
            .max(100, "validation.name_too_long"),
        phone: z.string().trim().max(30, "validation.phone_too_long").optional().or(z.literal("")),
        password: passwordSchema,
        confirm_password: z.string(),
    })
    .refine((data) => data.password === data.confirm_password, {
        message: "validation.passwords_no_match",
        path: ["confirm_password"],
    });

export const acceptInviteOnlyPasswordSchema = z
    .object({
        password: passwordSchema,
        confirm_password: z.string(),
    })
    .refine((data) => data.password === data.confirm_password, {
        message: "validation.passwords_no_match",
        path: ["confirm_password"],
    });

export type AcceptInviteWithProfileInput = z.infer<typeof acceptInviteWithProfileSchema>;
export type AcceptInviteOnlyPasswordInput = z.infer<typeof acceptInviteOnlyPasswordSchema>;
