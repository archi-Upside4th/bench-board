import { auth, signOut, isAdmin } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const login = (session?.user as { login?: string } | undefined)?.login;

  // login page is its own sub-route, but middleware handles guarding;
  // here we just render the chrome around authed admin pages.
  if (!session || !isAdmin(login)) {
    redirect("/login");
  }

  return (
    <>
      <header className="site">
        <div className="site-inner">
          <Link className="logo" href="/admin">
            <span className="wordmark">
              <span className="w-bench">Bench</span>
              <span className="w-dash">/</span>
              <span className="w-clear">Board</span>
              <span className="w-tag">admin</span>
            </span>
          </Link>
          <span className="header-spacer" />
          <nav style={{ display: "flex", gap: 18, fontSize: 13 }}>
            <Link href="/admin">Dashboard</Link>
            <Link href="/admin/runs/import-trials">Import</Link>
            <Link href="/admin/site">Site text</Link>
          </nav>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button className="ghost-btn" type="submit">
              Sign out · {login}
            </button>
          </form>
        </div>
      </header>
      <main>{children}</main>
    </>
  );
}
