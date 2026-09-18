"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, register } from "@/app/actions/auth";
import { opt } from "@/lib/i18n";
import { LEVELS } from "@/lib/options";
import { useI18n } from "./I18nProvider";
import { FormMessage, SubmitButton } from "./ui";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(login, null);
  const { t } = useI18n();
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="email" className="label">
          {t.auth.email}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state?.values?.email}
          className="input"
          placeholder="kamu@email.com"
        />
      </div>
      <div>
        <label htmlFor="password" className="label">
          {t.auth.password}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input"
        />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn btn-primary w-full">{t.auth.loginBtn}</SubmitButton>
      <p className="text-center text-sm text-muted">
        {t.auth.noAccount}{" "}
        <Link
          href={`/daftar${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-semibold text-court-700 hover:underline"
        >
          {t.auth.registerFree}
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm({ next }: { next: string }) {
  const [state, action] = useActionState(register, null);
  const { t } = useI18n();
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="name" className="label">
          {t.auth.name}
        </label>
        <input
          id="name"
          name="name"
          autoComplete="name"
          required
          minLength={2}
          maxLength={60}
          defaultValue={state?.values?.name}
          className="input"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="email" className="label">
            {t.auth.email}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={state?.values?.email}
            className="input"
          />
        </div>
        <div>
          <label htmlFor="phone" className="label">
            {t.auth.phone}
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            required
            defaultValue={state?.values?.phone}
            className="input"
            placeholder="0812…"
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="password" className="label">
            {t.auth.password}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="input"
          />
          <p className="mt-1 text-xs text-muted">{t.auth.pwHint}</p>
        </div>
        <div>
          <label htmlFor="level" className="label">
            {t.auth.level}
          </label>
          <select
            key={state?.values?.level}
            id="level"
            name="level"
            className="input"
            defaultValue={state?.values?.level ?? "Pemula"}
          >
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {opt(t, l)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn btn-primary w-full">{t.auth.createBtn}</SubmitButton>
      <p className="text-center text-sm text-muted">
        {t.auth.haveAccount}{" "}
        <Link
          href={`/masuk${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-semibold text-court-700 hover:underline"
        >
          {t.auth.loginBtn}
        </Link>
      </p>
    </form>
  );
}
