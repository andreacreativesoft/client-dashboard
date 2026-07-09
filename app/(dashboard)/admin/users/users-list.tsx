"use client";

import { formatDistanceToNow } from "date-fns";
import { LockOpen, MoreVertical, Pencil, Trash2, UserCog } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { FilterSelect, ListToolbar } from "@/components/admin/list-toolbar";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageTitle } from "@/components/ui/page";
import { Pagination } from "@/components/ui/pagination";
import { resendInviteAction, deleteInviteAction } from "@/lib/actions/invites";
import {
    deleteUserAction,
    updateUserRoleAction,
    unblockUserAction,
    type UserWithClients,
} from "@/lib/actions/users";
import { formatDate } from "@/lib/utils";
import type { Client, Invite } from "@/types/database";

import { EditUserModal } from "./edit-user-modal";
import { UserForm } from "./user-form";

const PER_PAGE = 10;

/** Human-friendly role label — never expose the raw enum value in the UI. */
const roleLabel = (role: string) => (role === "admin" ? "Administrateur" : "Client");

type RoleFilter = "all" | "admin" | "client";
type StatusFilter = "all" | "active" | "blocked";

interface UsersListProps {
    users: UserWithClients[];
    clients: Client[];
    pendingInvites: Invite[];
    currentUserId: string;
}

export function UsersList({ users, clients, pendingInvites, currentUserId }: UsersListProps) {
    const router = useRouter();
    const confirm = useConfirm();
    const [formOpen, setFormOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<UserWithClients | null>(null);
    const [loading, setLoading] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [page, setPage] = useState(1);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return users.filter((u) => {
            if (roleFilter !== "all" && u.role !== roleFilter) return false;
            if (statusFilter === "active" && u.is_blocked) return false;
            if (statusFilter === "blocked" && !u.is_blocked) return false;
            if (!q) return true;
            return [u.full_name, u.email, u.phone, ...u.clients.map((c) => c.business_name)]
                .filter(Boolean)
                .some((field) => field!.toLowerCase().includes(q));
        });
    }, [users, search, roleFilter, statusFilter]);

    const total = filtered.length;
    const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    function handleSearchChange(v: string) {
        setSearch(v);
        setPage(1);
    }

    async function handleToggleRole(user: UserWithClients) {
        const newRole = user.role === "admin" ? "client" : "admin";
        const ok = await confirm({
            title: `Passer le rôle à ${newRole} ?`,
            description: `${user.full_name || user.email} sera défini comme ${newRole}.`,
            confirmLabel: "Changer le rôle",
        });
        if (!ok) return;

        setLoading(user.id);
        const result = await updateUserRoleAction(user.id, newRole);
        setLoading(null);

        if (!result.success) {
            toast.error(result.error || "Échec de la mise à jour du rôle");
        } else {
            toast.success(`${user.full_name || user.email} est maintenant ${newRole}`);
        }
    }

    async function handleUnblock(user: UserWithClients) {
        const ok = await confirm({
            title: "Débloquer cet utilisateur ?",
            description: `${user.full_name || user.email} pourra de nouveau se connecter.`,
            confirmLabel: "Débloquer",
        });
        if (!ok) return;

        setLoading(user.id);
        const result = await unblockUserAction(user.id);
        setLoading(null);
        router.refresh();

        if (!result.success) {
            toast.error(result.error || "Échec du déblocage");
        } else {
            toast.success("Utilisateur débloqué");
        }
    }

    async function handleDelete(user: UserWithClients) {
        if (user.id === currentUserId) {
            toast.error("Vous ne pouvez pas supprimer votre propre compte");
            return;
        }

        const ok = await confirm({
            title: "Supprimer cet utilisateur ?",
            description: `${user.full_name || user.email} sera retiré. Cette action est irréversible.`,
            confirmLabel: "Supprimer",
            destructive: true,
        });
        if (!ok) return;

        setLoading(user.id);
        const result = await deleteUserAction(user.id);
        setLoading(null);

        if (!result.success) {
            toast.error(result.error || "Échec de la suppression");
        } else {
            toast.success("Utilisateur supprimé");
        }
    }

    async function handleResendInvite(inviteId: string) {
        setLoading(inviteId);
        const result = await resendInviteAction(inviteId);
        setLoading(null);
        router.refresh();

        if (!result.success) {
            toast.error(result.error || "Échec du renvoi de l'invitation");
        } else {
            toast.success("Invitation renvoyée");
        }
    }

    async function handleDeleteInvite(inviteId: string) {
        const ok = await confirm({
            title: "Annuler cette invitation ?",
            confirmLabel: "Annuler l'invitation",
            cancelLabel: "Conserver",
            destructive: true,
        });
        if (!ok) return;

        setLoading(inviteId);
        const result = await deleteInviteAction(inviteId);
        setLoading(null);
        router.refresh();

        if (!result.success) {
            toast.error(result.error || "Échec de l'annulation");
        } else {
            toast.success("Invitation annulée");
        }
    }

    const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

    return (
        <>
            <div className="mb-6">
                <PageTitle>Utilisateurs</PageTitle>
            </div>

            <ListToolbar
                count={total}
                countLabel={total === 1 ? "utilisateur" : "utilisateurs"}
                search={search}
                onSearchChange={handleSearchChange}
                searchPlaceholder="Rechercher par nom, email, téléphone, client…"
                actionLabel="Ajouter un utilisateur"
                onAction={() => setFormOpen(true)}
                filters={
                    <>
                        <FilterSelect
                            value={roleFilter}
                            onChange={(v) => {
                                setRoleFilter(v as RoleFilter);
                                setPage(1);
                            }}
                            options={[
                                { value: "all", label: "Tous les rôles" },
                                { value: "admin", label: "Administrateur" },
                                { value: "client", label: "Client" },
                            ]}
                        />
                        <FilterSelect
                            value={statusFilter}
                            onChange={(v) => {
                                setStatusFilter(v as StatusFilter);
                                setPage(1);
                            }}
                            options={[
                                { value: "all", label: "Tous les statuts" },
                                { value: "active", label: "Actifs" },
                                { value: "blocked", label: "Bloqués" },
                            ]}
                        />
                    </>
                }
            />

            {/* Pending Invites */}
            {pendingInvites.length > 0 && (
                <div className="mb-6">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle>Invitations en attente</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {pendingInvites.map((invite) => (
                                <div
                                    key={invite.id}
                                    className="flex items-center justify-between rounded-lg border p-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">{invite.full_name}</span>
                                            <Badge variant="secondary">
                                                {roleLabel(invite.role)}
                                            </Badge>
                                            {isExpired(invite.expires_at) && (
                                                <Badge variant="destructive">Expirée</Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            {invite.email}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Envoyée{" "}
                                            {formatDistanceToNow(new Date(invite.created_at), {
                                                addSuffix: true,
                                            })}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleResendInvite(invite.id)}
                                            disabled={loading === invite.id}>
                                            Renvoyer
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDeleteInvite(invite.id)}
                                            disabled={loading === invite.id}>
                                            Annuler
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Users list */}
            {total === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="text-muted-foreground">
                            {search || roleFilter !== "all" || statusFilter !== "all"
                                ? "Aucun utilisateur ne correspond aux filtres."
                                : "Aucun utilisateur pour le moment."}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <>
                    <div className="grid gap-4">
                        {paged.map((user) => {
                            const isSelf = user.id === currentUserId;
                            return (
                                <Card key={user.id}>
                                    <CardContent className="flex items-start justify-between gap-3 p-4 md:p-5">
                                        <div className="flex min-w-0 flex-1 items-start gap-3">
                                            <Avatar
                                                name={user.full_name || user.email}
                                                src={user.avatar_url}
                                                size="lg"
                                            />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingUser(user)}
                                                        className="text-base font-semibold text-foreground hover:underline">
                                                        {user.full_name || "Sans nom"}
                                                    </button>
                                                    <Badge
                                                        variant={
                                                            user.role === "admin"
                                                                ? "default"
                                                                : "secondary"
                                                        }>
                                                        {roleLabel(user.role)}
                                                    </Badge>
                                                    {isSelf && (
                                                        <Badge variant="outline">Vous</Badge>
                                                    )}
                                                    {user.is_blocked && (
                                                        <Badge variant="destructive">Bloqué</Badge>
                                                    )}
                                                </div>
                                                {(user.email || user.phone) && (
                                                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                                        {user.email && <span>{user.email}</span>}
                                                        {user.phone && <span>{user.phone}</span>}
                                                    </div>
                                                )}
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    Dernière connexion :{" "}
                                                    {user.last_login_at
                                                        ? formatDate(user.last_login_at)
                                                        : "jamais"}
                                                </p>
                                                {user.clients.length > 0 && (
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        {user.clients.map((client) => (
                                                            <Link
                                                                key={client.id}
                                                                href={`/admin/clients/${client.id}`}
                                                                className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-brand transition-colors hover:bg-brand-soft">
                                                                {client.business_name}
                                                            </Link>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    aria-label="Actions utilisateur"
                                                    disabled={loading === user.id}>
                                                    <MoreVertical className="size-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    onClick={() => setEditingUser(user)}>
                                                    <Pencil className="size-4" />
                                                    Détails
                                                </DropdownMenuItem>
                                                {!isSelf && (
                                                    <>
                                                        <DropdownMenuItem
                                                            onClick={() => handleToggleRole(user)}>
                                                            <UserCog className="size-4" />
                                                            {user.role === "admin"
                                                                ? "Passer client"
                                                                : "Passer admin"}
                                                        </DropdownMenuItem>
                                                        {user.is_blocked && (
                                                            <DropdownMenuItem
                                                                onClick={() => handleUnblock(user)}>
                                                                <LockOpen className="size-4" />
                                                                Débloquer
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            variant="destructive"
                                                            onClick={() => handleDelete(user)}>
                                                            <Trash2 className="size-4" />
                                                            Supprimer
                                                        </DropdownMenuItem>
                                                    </>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>

                    <Pagination
                        page={page}
                        perPage={PER_PAGE}
                        total={total}
                        onPageChange={setPage}
                    />
                </>
            )}

            <UserForm open={formOpen} onClose={() => setFormOpen(false)} clients={clients} />

            <EditUserModal
                user={editingUser}
                clients={clients}
                onClose={() => setEditingUser(null)}
            />
        </>
    );
}
