import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <main className="wrap" style={{ paddingTop: 120, paddingBottom: 120, maxWidth: 480 }}>
      <h1 style={{ fontSize: 28, margin: 0 }}>Admin sign-in</h1>
      <p className="lede" style={{ marginTop: 16 }}>
        GitHub accounts on the allowlist can manage agents and import evaluation runs.
      </p>
      <form
        action={async () => {
          "use server";
          await signIn("github", { redirectTo: "/admin" });
        }}
        style={{ marginTop: 32 }}
      >
        <button className="primary-btn" type="submit">
          Sign in with GitHub
        </button>
      </form>
    </main>
  );
}
