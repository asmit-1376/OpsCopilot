import { requireRole } from "@/auth/authorization";

export default async function OwnerLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireRole("OWNER");
  return children;
}
