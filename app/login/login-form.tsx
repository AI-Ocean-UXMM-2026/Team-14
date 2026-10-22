"use client";
import { useActionState, useState } from "react";
import { login } from "./actions";
import ValidatedForm from "../components/validated-form";
export default function LoginForm({ initialError }: { initialError?: string }) {
  const [show, setShow] = useState(false),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [state, action, pending] = useActionState(login, { message: "" });
  return (
    <ValidatedForm
      id="login-form"
      action={action}
      serverError={state.message || initialError}
      submitting={pending}
    >
      <label htmlFor="email">
        <span>Email address</span>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="you@example.com"
          maxLength={254}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label htmlFor="password">
        <span>Password</span>
        <div className="input-wrap">
          <input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter your password"
            maxLength={1024}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            className="show"
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
            onClick={() => setShow(!show)}
          >
            {show ? "Hide" : "Show"}
          </button>
        </div>
      </label>
      <button className="primary" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"} <span aria-hidden="true">→</span>
      </button>
    </ValidatedForm>
  );
}
