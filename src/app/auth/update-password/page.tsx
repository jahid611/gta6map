import type { Metadata } from "next";
import { UpdatePasswordForm } from "@/components/auth/UpdatePasswordForm";

export const metadata: Metadata = { title: "Nouveau mot de passe", robots: { index: false } };

export default function UpdatePasswordPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <UpdatePasswordForm />
      </div>
    </main>
  );
}
