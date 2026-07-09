import { z } from "zod";

export const ticketPriorityEnum = z.enum(["low", "medium", "high", "urgent"]);

// Le type de demande (slug du registry) pilote des champs adaptatifs stockés
// dans `details`. La validation des champs requis se fait par type (form +
// action) ; ici on valide la forme générale.
export const ticketCreateSchema = z.object({
    client_id: z.string().uuid({ message: "Client is required" }),
    type: z.string().min(1, "Type de demande requis"),
    details: z.record(z.string(), z.string()).default({}),
    priority: ticketPriorityEnum.optional(),
    assigned_to: z.string().uuid().nullable().optional(),
    due_date: z.string().nullable().optional(),
});

export type TicketCreateInput = z.infer<typeof ticketCreateSchema>;
