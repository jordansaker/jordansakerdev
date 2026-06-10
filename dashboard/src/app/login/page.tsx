import { LoginForm } from "./login-form";

type SP = Promise<{ next?: string }>;

export const metadata = { title: "Sign in · Studio" };

export default async function LoginPage({ searchParams }: { searchParams: SP }) {
  const { next } = await searchParams;
  return (
    <div className="min-h-screen grid place-items-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-10">
          <span className="w-10 h-10 rounded-lg bg-accent text-bg grid place-items-center font-serif font-semibold shadow-[0_4px_14px_rgba(232,116,59,0.3)]">
            JS
          </span>
          <span className="font-medium">Studio</span>
        </div>
        <h1 className="font-serif text-3xl font-light mb-2 tracking-tight">Sign in</h1>
        <p className="text-muted mb-8 text-sm">Studio dashboard — Jordan Saker.</p>
        <LoginForm next={next ?? "/"} />
      </div>
    </div>
  );
}
