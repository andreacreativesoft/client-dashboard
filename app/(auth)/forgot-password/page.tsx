import type { Metadata } from "next";

import { ForgotPasswordClient } from "./forgot-password-client";

export const metadata: Metadata = {
    title: "Mot de passe oublié",
};

export default function ForgotPasswordPage() {
    return <ForgotPasswordClient />;
}
