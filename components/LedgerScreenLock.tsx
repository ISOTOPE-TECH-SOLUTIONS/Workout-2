"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Eye, EyeOff, ShieldCheck, KeyRound, AlertCircle } from "lucide-react";

interface LedgerScreenLockProps {
  onUnlock: () => void;
}

export function LedgerScreenLock({ onUnlock }: LedgerScreenLockProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    setTimeout(() => {
      if (password === "Wahaj1984") {
        sessionStorage.setItem("financial_ledger_unlocked_v1", "true");
        onUnlock();
      } else {
        setError("Access Denied: Incorrect Ledger Password.");
        setIsSubmitting(false);
      }
    }, 300);
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 relative overflow-hidden animate-in fade-in zoom-in-95 duration-500">
      {/* Background ambient glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-yellow-500/10 via-background to-background pointer-events-none"></div>

      <Card className="w-full max-w-md relative z-10 bg-card/60 backdrop-blur-xl border border-yellow-500/20 shadow-[0_0_50px_rgba(234,179,8,0.1)] pt-6">
        <CardHeader className="text-center space-y-3">
          <div className="w-20 h-20 bg-yellow-500/10 text-yellow-500 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-yellow-500/30 shadow-[0_0_30px_rgba(234,179,8,0.25)] relative group">
            <Lock className="w-10 h-10 transition-transform duration-300 group-hover:scale-110" />
            <div className="absolute -bottom-1 -right-1 bg-background border border-yellow-500/40 p-1 rounded-full text-yellow-400">
              <KeyRound className="w-3.5 h-3.5" />
            </div>
          </div>
          
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.35em] text-yellow-500/80 bg-yellow-500/10 px-3 py-1 rounded-full border border-yellow-500/20">
              Security Protocol
            </span>
            <CardTitle className="text-3xl font-[1000] tracking-tighter italic mt-3 bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-600 bg-clip-text text-transparent">
              FINANCIAL LEDGER
            </CardTitle>
            <CardDescription className="text-xs font-medium text-muted-foreground mt-1">
              Enter password to unlock financial records
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="pt-2">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="ledger-password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>Ledger Password</span>
                <ShieldCheck className="w-3.5 h-3.5 text-yellow-500/70" />
              </Label>
              
              <div className="relative">
                <Input
                  id="ledger-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter Wahaj1984"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  required
                  className="bg-background/80 border-border/60 focus:border-yellow-500 focus:ring-yellow-500/20 pr-10 text-base font-semibold tracking-wide h-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-yellow-500" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-lg flex items-center gap-2 text-red-400 text-xs font-semibold animate-in fade-in slide-in-from-top-1">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={isSubmitting || !password}
              className="w-full h-12 font-black uppercase tracking-widest text-sm bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-black shadow-[0_0_20px_rgba(234,179,8,0.3)] transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              {isSubmitting ? "Authenticating..." : "Unlock Financial Ledger"}
            </Button>
          </form>

          <p className="text-[10px] text-center text-muted-foreground uppercase font-bold tracking-[0.25em] opacity-50 mt-6 italic">
            Iron Ledger Encrypted Access
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
