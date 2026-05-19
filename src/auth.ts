import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

const adminLogins = (process.env.ADMIN_GITHUB_LOGINS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub],
  callbacks: {
    async signIn({ profile }) {
      const login = (profile as { login?: string } | undefined)?.login?.toLowerCase();
      if (!login) return false;
      return adminLogins.includes(login);
    },
    async jwt({ token, profile }) {
      if (profile && "login" in profile) {
        token.login = (profile as { login: string }).login;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.login && typeof token.login === "string") {
        (session.user as { login?: string }).login = token.login;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});

export function isAdmin(login: string | undefined | null): boolean {
  if (!login) return false;
  return adminLogins.includes(login.toLowerCase());
}
