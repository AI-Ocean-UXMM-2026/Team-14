import Link from "next/link";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const initialError = status
    ? status === "access-denied"
      ? "An active school membership is required. Contact your administrator."
      : "Email or password is incorrect, or your account is unavailable."
    : undefined;

  return (
    <div className="login-page">
      <a className="skip-link" href="#email">Skip to sign in</a>
      <div className="layout">
        <aside className="story" aria-label="Saya-Sync">
          <Link className="brand" href="/login" aria-label="Saya-Sync home">
            <img className="primary-logo" src="/prototype/saya-sync.svg" alt="Saya-Sync" />
          </Link>
          <h2 className="story-heading">
            <span lang="en">Teaching records.<br />Clearer decisions.</span>
            <span className="myanmar-heading" lang="my">
              သင်ကြားမှုမှတ်တမ်းမှ<br />ရှင်းလင်းသော ဆုံးဖြတ်ချက်များဆီသို့
            </span>
          </h2>
        </aside>
        <main className="signin">
          <div className="form-wrap">
            <h1>Sign in</h1>
            <LoginForm initialError={initialError} />
            <div className="demo" aria-label="Demo accounts">
              <p className="demo-title">Demo accounts</p>
              <div className="demo-buttons">
                <Link className="demo-button" href="/demo?role=admin">Admin</Link>
                <Link className="demo-button" href="/demo?role=teacher">Teacher</Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
