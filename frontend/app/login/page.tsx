import AuthPage from "../auth/page";
import { getAuthenticatedUser, roleHome } from "@/auth/authorization";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Sign In | TechSummitTrainers OpsPilot",
  description: "Sign in to TechSummitTrainers Institute Operations Copilot",
};

export default async function LoginPage() {
  const user = await getAuthenticatedUser();
  if (user) redirect(roleHome[user.role]);
  return <AuthPage />;
}
