import { auth } from "@/auth"; // Adjust this path to your auth config file
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const session = await auth();

  if (session) {
    // ✅ If logged in, send to dashboard
    redirect("/admin/dashboard");
  } else {
    // ❌ If not logged in, send to login
    redirect("/login");
  }

  // This part won't render because of the redirects above
  return null;
}