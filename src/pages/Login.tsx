import { useState, useEffect } from 'react';
import {
  Eye, EyeOff, LogIn, AlertCircle, Lock, User, CheckCircle2, Loader2,
  Shield, ArrowRight, Mail, UserPlus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Loader from '../components/Loader';

const SYMBOLS = ['$', '€', '£', '¥', '₹', '₿'];

export default function Login() {
  const { login, isLoading } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [remember, setRemember] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupNote, setSignupNote] = useState('');

  useEffect(() => { setError(''); }, [mode]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!username.trim()) { setError('Please enter your username or employee ID'); return; }
    if (!password.trim()) { setError('Please enter your password'); return; }
    setSubmitting(true);
    const result = await login(username.trim(), password);
    if (result.success && !result.requireMFA) { setSuccess(true); }
    else if (result.success && result.requireMFA) { setError('MFA verification required. Please enter your OTP code.'); setSubmitting(false); }
    else { setError(result.error || 'Invalid credentials. Please check your username and password.'); setSubmitting(false); }
  }

  function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!signupName.trim() || !signupEmail.trim()) {
      setError('Name and work email are required.');
      return;
    }
    setSignupNote('Access request recorded. An administrator will provision your IQA-iManage account.');
    setError('');
  }

  if (isLoading && !submitting) return <Loader message="Signing you in..." />;
  if (success) return <Loader message="Welcome back! Loading your dashboard..." />;

  return (
    <div className="portal-login min-h-screen flex flex-col lg:flex-row overflow-hidden">
      {/* ── 65% visual stage ── */}
      <section className="relative hidden lg:flex lg:w-[65%] portal-stage items-start justify-start overflow-hidden">
        <div className="absolute inset-0 portal-grid" />
        <div className="absolute inset-x-0 h-24 bg-gradient-to-b from-[#A855F7]/10 to-transparent pointer-events-none" style={{ animation: 'portal-scan 7s linear infinite' }} />
        <div className="portal-orb w-[380px] h-[380px] bg-[#7B2CFF]/12 left-[28%] top-[22%]" style={{ animation: 'login-glow-pulse 7s ease-in-out infinite' }} />

        {/* Rising currencies */}
        {[...SYMBOLS, ...SYMBOLS].map((s, i) => (
          <span
            key={`${s}-${i}`}
            className="absolute font-bold text-[#C4B5FD] select-none"
            style={{
              left: `${6 + (i * 7.4) % 88}%`,
              bottom: `${4 + (i % 5) * 7}%`,
              fontSize: `${1.4 + (i % 4) * 0.35}rem`,
              animation: `portal-rise ${11 + (i % 6)}s linear ${i * 0.7}s infinite`,
              textShadow: '0 0 12px rgba(168,85,247,0.28)',
            }}
          >
            {s}
          </span>
        ))}

        {/* Orbiting coins around center */}
        <div className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 w-0 h-0 opacity-40">
          {['$', '€', '£', '¥'].map((s, i) => (
            <span
              key={s}
              className="absolute flex h-10 w-10 items-center justify-center rounded-full border border-[#A855F7]/40 bg-[#11142B]/80 text-sm font-bold text-white/80 shadow-[0_0_10px_rgba(123,44,255,0.25)]"
              style={{ animation: `portal-orbit ${16 + i * 3}s linear ${i * -2}s infinite` }}
            >
              {s}
            </span>
          ))}
        </div>

        {/* Candlesticks */}
        <svg className="absolute left-8 bottom-28 opacity-35" width="200" height="110" viewBox="0 0 200 110" aria-hidden="true">
          {[
            { x: 16, h: 28, l: 92, o: 70, c: 42 },
            { x: 40, h: 22, l: 86, o: 40, c: 68 },
            { x: 64, h: 18, l: 80, o: 62, c: 34 },
            { x: 88, h: 14, l: 88, o: 36, c: 58 },
            { x: 112, h: 20, l: 78, o: 55, c: 30 },
            { x: 136, h: 12, l: 84, o: 28, c: 52 },
            { x: 160, h: 16, l: 74, o: 48, c: 24 },
            { x: 184, h: 10, l: 70, o: 22, c: 44 },
          ].map((c, i) => {
            const up = c.c < c.o;
            return (
              <g key={i} style={{ animation: `fade-in-up 0.5s ease ${i * 0.12}s both` }}>
                <line x1={c.x} y1={c.h} x2={c.x} y2={c.l} stroke={up ? '#34D399' : '#F43F5E'} strokeWidth="1.4" />
                <rect x={c.x - 5} y={Math.min(c.o, c.c)} width="10" height={Math.abs(c.o - c.c) || 3} rx="1.5" fill={up ? '#34D399' : '#F43F5E'} opacity="0.85" />
              </g>
            );
          })}
        </svg>

        {/* Volume bars */}
        <div className="absolute right-10 bottom-28 flex items-end gap-1.5 h-24 opacity-40">
          {[40, 62, 48, 78, 55, 88, 66, 94, 72, 50].map((h, i) => (
            <div
              key={i}
              className="w-2 origin-bottom rounded-t-sm bg-gradient-to-t from-[#7B2CFF] to-[#C4B5FD]"
              style={{ height: `${h}%`, animation: `portal-bar ${2.4 + (i % 3) * 0.4}s ease-in-out ${i * 0.14}s infinite` }}
            />
          ))}
        </div>

        {/* Flow paths */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 800 600" preserveAspectRatio="none" aria-hidden="true">
          <path d="M40 480 C 180 360, 260 420, 400 300" fill="none" stroke="#A855F7" strokeWidth="1.2" strokeDasharray="6 10" opacity="0.22" style={{ animation: 'portal-dash 7s linear infinite' }} />
          <path d="M760 140 C 620 220, 540 160, 400 280" fill="none" stroke="#7B2CFF" strokeWidth="1.2" strokeDasharray="6 10" opacity="0.18" style={{ animation: 'portal-dash 9s linear infinite reverse' }} />
        </svg>

        <div className="relative z-10 w-[min(640px,78%)] text-left pt-[12vh] pl-12 xl:pl-16">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7B2CFF] to-[#A855F7] text-white text-xl font-black shadow-[0_0_40px_rgba(123,44,255,0.55)]" style={{ animation: 'fx-pulse 4s ease-in-out infinite' }}>
            I
          </div>
          <h2 className="text-5xl font-extrabold tracking-tight text-white">
            IQA-<span className="bg-gradient-to-r from-[#C4B5FD] to-[#A855F7] bg-clip-text text-transparent">iManage</span>
          </h2>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#A7A9C0]">Finance Portal</p>
          <blockquote className="mt-8 text-lg leading-relaxed font-medium text-[#C9CBDC]">
            “<span className="text-white font-semibold">Revenue</span> is not real until it is{' '}
            <span className="text-[#F59E0B] font-semibold">invoiced</span>,{' '}
            <span className="text-[#34D399] font-semibold">collected</span>, and{' '}
            <span className="text-[#38BDF8] font-semibold">reconciled</span>. Command{' '}
            <span className="text-[#C4B5FD] font-semibold">projects</span>,{' '}
            <span className="text-[#A855F7] font-semibold">SOWs</span>,{' '}
            <span className="text-[#FBBF24] font-semibold">receivables</span>, and{' '}
            <span className="text-[#4ADE80] font-semibold">payments</span> as one{' '}
            <span className="text-[#E9D5FF] font-semibold">financial truth</span>.”
          </blockquote>
          <p className="mt-3 text-xs text-[#A7A9C0]">Built for finance overview · clients · delivery · collections</p>
        </div>

        <div className="absolute bottom-7 left-0 right-0 text-center text-[11px] text-[#6B6E88]">© 2026 IQA Technologies</div>
      </section>

      {/* ── 35% auth panel ── */}
      <section className="w-full lg:w-[35%] portal-panel min-h-screen flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-[400px]">
          <div className="lg:hidden mb-8">
            <p className="text-lg font-bold text-white">IQA-<span className="text-[#C4B5FD]">iManage</span></p>
            <p className="text-xs text-[#A7A9C0]">Finance Portal</p>
          </div>

          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#A7A9C0]">Authorized access</p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white">Welcome to IQA-iManage</h1>
          <p className="text-sm text-[#A7A9C0] mt-1.5">Sign in to the finance operations workspace.</p>

          <div className="mt-6 grid grid-cols-2 rounded-xl border border-white/10 p-1 bg-white/[0.03]">
            <button type="button" onClick={() => setMode('login')} className={`min-h-11 rounded-lg text-sm font-semibold ${mode === 'login' ? 'bg-gradient-to-r from-[#7B2CFF] to-[#A855F7] text-white' : 'text-[#A7A9C0]'}`}>Login</button>
            <button type="button" onClick={() => setMode('signup')} className={`min-h-11 rounded-lg text-sm font-semibold ${mode === 'signup' ? 'bg-gradient-to-r from-[#7B2CFF] to-[#A855F7] text-white' : 'text-[#A7A9C0]'}`}>Sign up</button>
          </div>

          {error && (
            <div className="mt-5 flex items-start gap-3 rounded-xl bg-[#F43F5E]/10 border border-[#F43F5E]/25 p-3 text-sm" style={{ animation: 'shake 0.4s ease' }}>
              <AlertCircle size={16} className="text-[#F43F5E] mt-0.5 shrink-0" />
              <p className="text-[#FECACA]">{error}</p>
            </div>
          )}
          {signupNote && mode === 'signup' && (
            <div className="mt-5 flex items-start gap-3 rounded-xl bg-[#34D399]/10 border border-[#34D399]/25 p-3 text-sm">
              <CheckCircle2 size={16} className="text-[#34D399] mt-0.5 shrink-0" />
              <p className="text-[#D1FAE5]">{signupNote}</p>
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="mt-6 space-y-4" noValidate>
              <div>
                <label htmlFor="login-user" className="flex items-center gap-1.5 text-xs font-semibold text-[#A7A9C0] mb-1.5"><User size={12} /> Email / Employee ID</label>
                <input id="login-user" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" autoFocus placeholder="Enter username or employee ID" className="portal-input w-full h-12 px-3 text-sm" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="login-pw" className="flex items-center gap-1.5 text-xs font-semibold text-[#A7A9C0]"><Lock size={12} /> Password</label>
                  <button type="button" className="text-xs font-semibold text-[#C4B5FD] hover:text-white">Forgot Password?</button>
                </div>
                <div className="relative">
                  <input id="login-pw" type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" placeholder="Enter your password" className="portal-input w-full h-12 px-3 pr-12 text-sm" />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-2 top-1/2 -translate-y-1/2 min-h-11 min-w-11 text-[#A7A9C0] hover:text-white" aria-label={showPw ? 'Hide password' : 'Show password'}>
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <label className="flex items-center gap-2.5 text-sm text-[#A7A9C0] cursor-pointer">
                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="h-4 w-4 accent-[#7B2CFF]" />
                Remember me on this device
              </label>
              <button type="submit" disabled={submitting} className="btn-primary w-full inline-flex items-center justify-center gap-2">
                {submitting ? <><Loader2 size={18} className="animate-spin" /> Authenticating...</> : <><LogIn size={16} /> Sign in <ArrowRight size={16} /></>}
              </button>
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-[10px] uppercase tracking-widest text-[#A7A9C0]">or</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
              <button type="button" className="btn-secondary w-full inline-flex items-center justify-center gap-2">
                <Shield size={16} /> Continue with Corporate SSO
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="mt-6 space-y-4">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-[#A7A9C0] mb-1.5"><UserPlus size={12} /> Full name</label>
                <input value={signupName} onChange={e => setSignupName(e.target.value)} className="portal-input w-full h-12 px-3 text-sm" placeholder="Your name" />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-[#A7A9C0] mb-1.5"><Mail size={12} /> Work email</label>
                <input type="email" value={signupEmail} onChange={e => setSignupEmail(e.target.value)} className="portal-input w-full h-12 px-3 text-sm" placeholder="name@company.com" />
              </div>
              <button type="submit" className="btn-primary w-full inline-flex items-center justify-center gap-2">
                Request access <ArrowRight size={16} />
              </button>
              <p className="text-[11px] text-[#A7A9C0] leading-relaxed">Accounts are issued by an administrator. This form does not create a live login.</p>
            </form>
          )}

          <div className="mt-8 flex flex-wrap gap-2">
            <span className="trust-chip"><Lock size={11} /> Encrypted session</span>
            <span className="trust-chip"><Shield size={11} /> Corporate SSO</span>
            <span className="trust-chip">Role-based access</span>
          </div>
        </div>
      </section>
    </div>
  );
}
