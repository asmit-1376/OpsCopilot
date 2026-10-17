import { requireAnyRole } from "@/auth/authorization";

export default async function TimetableSolverLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireAnyRole(["OWNER", "COUNSELOR"]);
  return children;
}

