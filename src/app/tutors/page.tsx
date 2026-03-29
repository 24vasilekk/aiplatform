import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { TutorsMarket } from "@/components/tutors-market";

export default async function TutorsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return <TutorsMarket />;
}
