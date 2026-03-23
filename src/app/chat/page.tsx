import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { GlobalChat } from "@/components/global-chat";

export default async function GlobalChatPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return <GlobalChat />;
}
