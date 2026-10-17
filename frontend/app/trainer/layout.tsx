import { requireRole } from "@/auth/authorization";

export default async function TrainerLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireRole("TRAINER");
  return children;
}
