"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, Eye, EyeOff } from "lucide-react";

interface Props {
  token: string;
  email: string;
}

export function ActivateForm({ token, email }: Props) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const validate = () => {
    const errs: typeof errors = {};
    if (password.length < 8) errs.password = "Password must be at least 8 characters";
    if (!/[A-Z]/.test(password)) errs.password = "Must contain at least one uppercase letter";
    if (!/[0-9]/.test(password)) errs.password = "Must contain at least one number";
    if (password !== confirm) errs.confirm = "Passwords do not match";
    return errs;
  };

  const submit = () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});

    startTransition(async () => {
      const res = await fetch("/api/auth/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (res.ok) {
        router.push("/login?activated=1");
      } else {
        const data = await res.json();
        setErrors({ password: data.error ?? "Activation failed. Please try again." });
      }
    });
  };

  const strength = (() => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  })();

  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][strength];
  const strengthColor = ["", "bg-red-400", "bg-yellow-400", "bg-blue-400", "bg-green-500"][strength];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-5">
      {/* Email (read-only) */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700">Email Address</label>
        <div className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 select-none">
          {email}
        </div>
      </div>

      {/* New Password */}
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium text-slate-700">
          New Password *
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="Min 8 chars, 1 uppercase, 1 number"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {password.length > 0 && (
          <div className="mt-1 space-y-1">
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-all ${
                    i <= strength ? strengthColor : "bg-slate-200"
                  }`}
                />
              ))}
            </div>
            <p className={`text-xs font-medium ${["", "text-red-500", "text-yellow-500", "text-blue-500", "text-green-600"][strength]}`}>
              {strengthLabel}
            </p>
          </div>
        )}
        {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
      </div>

      {/* Confirm Password */}
      <div className="flex flex-col gap-1">
        <label htmlFor="confirm" className="text-sm font-medium text-slate-700">
          Confirm Password *
        </label>
        <div className="relative">
          <input
            id="confirm"
            type={showConfirm ? "text" : "password"}
            placeholder="Re-enter your password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            tabIndex={-1}
          >
            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {confirm.length > 0 && (
          <p className={`text-xs font-medium ${password === confirm ? "text-green-600" : "text-red-500"}`}>
            {password === confirm ? "✓ Passwords match" : "✗ Passwords do not match"}
          </p>
        )}
        {errors.confirm && <p className="text-xs text-red-500">{errors.confirm}</p>}
      </div>

      <Button onClick={submit} disabled={isPending} className="w-full">
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle className="h-4 w-4" />
        )}
        {isPending ? "Activating…" : "Activate Account"}
      </Button>
    </div>
  );
}
