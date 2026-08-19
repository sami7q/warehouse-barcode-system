import { auth } from "@/auth";
import HomeClient from "@/components/HomeClient";

export default async function Home() {
  const session = await auth();
  const role = session?.user?.role === "employee" ? "employee" : "admin";
  return <HomeClient role={role} />;
}
