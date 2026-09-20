import { NavBar } from "@/components/NavBar";
import { NotFoundBody } from "@/components/NotFoundBody";
import { SiteFooter } from "@/components/SiteFooter";
import { getCurrentUser } from "@/lib/auth";

export default async function NotFound() {
  const user = await getCurrentUser();
  return (
    <>
      <NavBar user={user ? { id: user.id, name: user.name, hue: user.avatar_hue, avatar: user.avatar, isAdmin: user.role === "admin" } : null} />
      <NotFoundBody />
      <SiteFooter />
    </>
  );
}
