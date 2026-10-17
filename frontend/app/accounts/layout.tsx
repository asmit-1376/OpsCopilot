import { requireRole } from "@/auth/authorization";

export default async function AccountsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireRole("ACCOUNTS");
  return children;
}
