import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, Mail, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ExperienceLevel } from '../types';

interface AuthPageProps {
  initialMode?: 'login' | 'signup' | 'forgot';
  onBack: () => void;
}

export function AuthPage({ initialMode = 'login', onBack }: AuthPageProps) {
  const {
    user,
    authError,
    clearAuthError,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    resendVerification,
    reloadUser,
    signOutUser,
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('beginner');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const switchMode = (next: 'login' | 'signup' | 'forgot') => {
    clearAuthError();
    setNotice(null);
    setMode(next);
  };

  // Show verification prompt if user signed in via Email/Password and hasn't verified yet
  if (user && !user.emailVerified) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8">
          <div className="w-11 h-11 rounded-xl bg-violet-50 text-[#6D28D9] flex items-center justify-center mb-5">
            <Mail className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-[#0F172A] mb-2">Verify your email address</h1>
          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            We sent a verification link to <span className="font-semibold text-[#0F172A]">{user.email}</span>.
            Please open your inbox and verify your email to unlock your private HuntPilot AI workspace.
          </p>

          {notice && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
              {notice}
            </div>
          )}
          {authError && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {authError}
            </div>
          )}

          <div className="space-y-3">
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setNotice(null);
                try {
                  const verified = await reloadUser();
                  if (!verified) {
                    setNotice(
                      'Your email is not marked verified yet. Please click the link in your inbox (check spam) and try again.'
                    );
                  }
                } finally {
                  setBusy(false);
                }
              }}
              className="w-full py-2.5 px-4 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
              I’ve Verified My Email — Continue
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await resendVerification();
                  setNotice('Verification email sent. Please check your inbox and spam folder.');
                } finally {
                  setBusy(false);
                }
              }}
              className="w-full py-2.5 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors cursor-pointer"
            >
              Resend Verification Email
            </button>

            <button
              type="button"
              onClick={signOutUser}
              className="w-full py-2 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Sign out and use another account
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        await signInWithEmail(email, password);
      } else if (mode === 'signup') {
        await signUpWithEmail(name, email, password, experienceLevel);
        setNotice('Account created! Check your inbox for the verification email.');
      } else {
        await resetPassword(email);
        setNotice('Password reset link sent if an account exists for that email.');
      }
    } catch {
      // handled in AuthContext authError
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setNotice(null);
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch {
      // handled in AuthContext authError
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6">
      <div className="max-w-md w-full">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-[#0F172A] mb-6 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to HuntPilot AI
        </button>

        <div className="bg-white border border-slate-200 rounded-2xl p-8">
          <div className="mb-6">
            <p className="text-xs font-semibold text-[#6D28D9] mb-1">HuntPilot AI</p>
            <h1 className="text-2xl font-bold text-[#0F172A]">
              {mode === 'login' && 'Welcome back, founder'}
              {mode === 'signup' && 'Create your launch workspace'}
              {mode === 'forgot' && 'Reset your password'}
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              {mode === 'login' && 'Sign in to access your projects, launch drafts, and readiness reports.'}
              {mode === 'signup' && 'Free workspace for Launch Academy, AI drafting, and launch scoring.'}
              {mode === 'forgot' && 'Enter your email and we will send you a password reset link.'}
            </p>
          </div>

          {mode !== 'forgot' && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={handleGoogle}
                className="w-full py-2.5 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold text-[#0F172A] flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-60"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                  />
                </svg>
                Continue with Google
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-slate-400">or continue with email</span>
                </div>
              </div>
            </>
          )}

          {authError && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 leading-relaxed">
              {authError}
            </div>
          )}

          {notice && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{notice}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Rivera"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 focus:border-[#6D28D9]"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                maxLength={200}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="founder@company.com"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 focus:border-[#6D28D9]"
              />
            </div>

            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-slate-700">Password</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-xs font-medium text-[#6D28D9] hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 focus:border-[#6D28D9]"
                />
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Product Hunt Experience
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExperienceLevel('beginner')}
                    className={`p-2.5 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                      experienceLevel === 'beginner'
                        ? 'border-[#6D28D9] bg-violet-50 text-[#0F172A]'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    <p className="font-semibold">First-time maker</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Step-by-step guidance</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExperienceLevel('experienced')}
                    className={`p-2.5 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                      experienceLevel === 'experienced'
                        ? 'border-[#6D28D9] bg-violet-50 text-[#0F172A]'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    <p className="font-semibold">Experienced</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Optimize &amp; score drafts</p>
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 px-4 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60"
            >
              {busy
                ? 'Please wait...'
                : mode === 'login'
                ? 'Sign In'
                : mode === 'signup'
                ? 'Create Account'
                : 'Send Reset Link'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center text-xs text-slate-600">
            {mode === 'login' && (
              <>
                New to HuntPilot AI?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className="font-semibold text-[#6D28D9] hover:underline cursor-pointer"
                >
                  Create a free account
                </button>
              </>
            )}
            {mode === 'signup' && (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="font-semibold text-[#6D28D9] hover:underline cursor-pointer"
                >
                  Sign in
                </button>
              </>
            )}
            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="font-semibold text-[#6D28D9] hover:underline cursor-pointer"
              >
                Return to Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
