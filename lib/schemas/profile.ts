import { z } from "zod";

// Messages are i18n keys (validation.*) resolved with t() at display time.
export const profileUpdateSchema = z.object({
    full_name: z.string().trim().min(2, "validation.name_min").max(100, "validation.name_too_long"),
    phone: z.string().trim().max(30, "validation.phone_too_long").optional().or(z.literal("")),
    language: z.enum(["en", "fr-BE", "ro"]),
});

export const changePasswordSchema = z
    .object({
        current_password: z.string().min(1, "validation.current_password_required"),
        new_password: z
            .string()
            .min(8, "validation.new_password_min")
            .max(128, "validation.password_too_long"),
        confirm_password: z.string(),
    })
    .refine((data) => data.new_password === data.confirm_password, {
        message: "validation.passwords_no_match",
        path: ["confirm_password"],
    });

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
