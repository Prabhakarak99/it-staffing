"use client";

import { useState, useTransition, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GFTLogo, GFTMark } from "@/components/ui/logo";
import { Loader2, CheckCircle2, AlertCircle, Users, FileText, Calendar } from "lucide-react";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const params = useSearchParams();
  const activated = params.get("activated") === "1";

  const login = () => {
    if (!email || !password) { setError("Please enter email and password."); return; }
    setError("");
    startTransition(async () => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        router.push("/admin");
      } else {
        const data = await res.json();
        setError(data.error ?? "Login failed");
      }
    });
  };

  return (
    <div className="min-h-screen flex bg-slate-900">

      {/* ── Left panel ──────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[55%] flex-col justify-between p-12 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 relative overflow-hidden">

        {/* Background decorative circles */}
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-indigo-700/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />

        {/* Top logo */}
        <GFTLogo theme="dark" />

        {/* Hero copy */}
        <div className="space-y-8 relative z-10">
          <div>
            <h2 className="text-4xl font-extrabold text-white leading-tight">
              Power your<br />
              <span className="text-indigo-400">IT staffing</span><br />
              with clarity.
            </h2>
            <p className="mt-4 text-slate-400 text-base leading-relaxed max-w-md">
              GFT Vision brings your recruiters, consultants, submissions,
              and interviews into one intelligent platform.
            </p>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: Users,    label: "Consultants", desc: "Onboard & track" },
              { icon: FileText, label: "Submissions",  desc: "Vendor pipeline" },
              { icon: Calendar, label: "Interviews",   desc: "Schedule & log"  },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="rounded-2xl bg-white/5 border border-white/10 p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600/30 mb-3">
                  <Icon className="h-4 w-4 text-indigo-400" />
                </div>
                <p className="text-sm font-semibold text-white">{label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-600 relative z-10">
          © {new Date().getFullYear()} GFT Vision. All rights reserved. · gftvision.com
        </p>
      </div>

      {/* ── Right panel — login form ─────────────────────────────────── */}
      <div className="flex flex-1 items-center justify-center px-6 bg-slate-50">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex items-center justify-center gap-3 mb-8 lg:hidden">
            <GFTMark size={40} />
            <div>
              <p className="text-base font-extrabold text-slate-900">
                GFT <span className="text-indigo-600">Vision</span>
              </p>
              <p className="text-[10px] uppercase tracking-widest text-slate-400">Staffing Platform</p>
            </div>
          </div>

          <div className="mb-7">
            <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
            <p className="text-sm text-slate-500 mt-1">Sign in to your GFT Vision account</p>
          </div>

          {activated && (
            <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 mb-5">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Account activated! You can now sign in.
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-7 space-y-5">
            <Input
              id="email"
              label="Email Address"
              type="email"
              placeholder="you@gftvision.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && login()}
            />
            <Input
              id="password"
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && login()}
            />

            {error && (
              <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <Button onClick={login} disabled={isPending} className="w-full h-11 text-base">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isPending ? "Signing in…" : "Sign In"}
            </Button>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            GFT Vision · gftvision.com
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
