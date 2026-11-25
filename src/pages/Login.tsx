import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/store";
import { loginApi } from "@/api/accounts.api";
import { Button } from "@/components/ui/button";
import { extractApiErrorMessage } from "@/infrastructure/apiClient";
import { cn } from "@/lib/utils";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = { email?: string; password?: string };

function validate(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!email.trim()) errors.email = "Email address is required.";
  else if (!EMAIL_PATTERN.test(email.trim())) errors.email = "Enter a valid email address.";
  if (!password) errors.password = "Password is required.";
  return errors;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const { setAuth, isAuthenticated, isHydrating, sessionExpired } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const redirectTo =
    (location.state as { from?: string } | null)?.from && (location.state as { from: string }).from !== "/login"
      ? (location.state as { from: string }).from
      : "/";

  useEffect(() => {
    if (!isHydrating && isAuthenticated) {
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, isHydrating, navigate, redirectTo]);

  const loginMutation = useMutation({
    // POST /api/accounts/login/ -> { access, refresh, user }; tokens are persisted by the auth service.
    mutationFn: async () => {
      setAuthError(null);
      const loginRes = await loginApi(email, password);
      return loginRes.user;
    },
    onSuccess: (user) => {
      setAuth(user);
      toast.success("Welcome back to PromoCraft!");
      queryClient.clear();
      navigate(redirectTo, { replace: true });
    },
    onError: (error: unknown) => {
      // Backend (verified live): 400 { non_field_errors: ["Invalid email or password"] } or ["Account is Disabled"];
      // 400 { email: [...], password: [...] } for missing/malformed fields; network errors → ApiError kind "network".
      const { message, fieldErrors: backendFields } = extractApiErrorMessage(
        error,
        "Invalid email or password. Please try again.",
      );
      const mapped: FieldErrors = {
        email: backendFields?.email?.[0],
        password: backendFields?.password?.[0],
      };
      if (mapped.email || mapped.password) {
        setFieldErrors(mapped);
        setAuthError(null);
      } else {
        setAuthError(message);
      }
    },
  });

  const isSubmitting = loginMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // no duplicate submissions (e.g. repeated Enter)
    const errors = validate(email, password);
    setFieldErrors(errors);
    if (errors.email || errors.password) {
      setAuthError(null);
      return;
    }
    loginMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-[400px] bg-card rounded-[20px] shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-border/80 p-8 relative z-10">
        <div className="flex flex-col items-center mb-7">
          <div className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-primary text-primary-foreground font-bold shadow-sm mb-4">
            P
          </div>
          <h1 className="text-[24px] font-semibold tracking-tight text-foreground">
            Welcome back
          </h1>
          <p className="text-[14px] text-muted-foreground mt-1">
            Sign in to your PromoCraft account
          </p>
        </div>

        {sessionExpired && !authError && (
          <div
            role="status"
            className="mb-4 flex items-start gap-2.5 rounded-[12px] border border-amber-200 bg-amber-50/90 px-3.5 py-2.5 text-[12px] font-medium text-amber-800"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span>Your session has expired. Please sign in again.</span>
          </div>
        )}

        {authError && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-2.5 rounded-[12px] border border-red-200 bg-red-50/90 px-3.5 py-2.5 text-[12px] font-medium text-red-700"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <span>{authError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-[13px] font-medium text-foreground mb-1.5">
              Email address
            </label>
            <input
              id="login-email"
              type="email"
              name="email"
              autoComplete="username"
              required
              value={email}
              disabled={isSubmitting}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
              onChange={(e) => {
                setEmail(e.target.value);
                if (authError) setAuthError(null);
                if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: undefined }));
              }}
              placeholder="you@promocraft.co"
              className={cn(
                "h-10 w-full rounded-[12px] border bg-background px-3 text-[14px] focus:ring-2 outline-none transition-colors disabled:opacity-70",
                fieldErrors.email ? "border-red-400 focus:border-red-400 focus:ring-red-500/15" : "border-border focus:border-primary/40 focus:ring-primary/15",
              )}
            />
            {fieldErrors.email && (
              <p id="login-email-error" className="mt-1 text-[12px] text-red-600">{fieldErrors.email}</p>
            )}
          </div>
          <div>
            <label htmlFor="login-password" className="block text-[13px] font-medium text-foreground mb-1.5">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              disabled={isSubmitting}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
              onChange={(e) => {
                setPassword(e.target.value);
                if (authError) setAuthError(null);
                if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: undefined }));
              }}
              placeholder="••••••••"
              className={cn(
                "h-10 w-full rounded-[12px] border bg-background px-3 text-[14px] focus:ring-2 outline-none transition-colors disabled:opacity-70",
                fieldErrors.password ? "border-red-400 focus:border-red-400 focus:ring-red-500/15" : "border-border focus:border-primary/40 focus:ring-primary/15",
              )}
            />
            {fieldErrors.password && (
              <p id="login-password-error" className="mt-1 text-[12px] text-red-600">{fieldErrors.password}</p>
            )}
          </div>
          <div className="pt-2">
            <Button
              type="submit"
              className="w-full h-10 text-[14px] rounded-[12px]"
              disabled={isSubmitting || isHydrating}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
