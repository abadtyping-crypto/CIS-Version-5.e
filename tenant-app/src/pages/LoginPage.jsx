import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { requestPasswordReset, getTenantLoginSettings, submitSupportTicket } from '../lib/backendStore';
import { generateOTP } from '../lib/whatsappAuth';
import { findTenantById } from '../config/tenants';
import { Eye, EyeOff, Lock, User, Mail, ArrowLeft, CheckCircle2, ShieldAlert, X, AlertTriangle, FileText, LifeBuoy, BellRing, Phone, Send, ShieldCheck, RefreshCw } from 'lucide-react';
import { getRuntimePlatform, PLATFORM_ELECTRON } from '../lib/runtimePlatform';

const WhatsAppIcon = ({ className }) => (
  <svg viewBox="0 0 16 16" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M13.601 2.326A7.854 7.854 0 0 0 8.034 0C3.641 0 .067 3.574.065 7.965A7.902 7.902 0 0 0 1.141 12L0 16l4.111-1.074a7.9 7.9 0 0 0 3.923 1.007h.003c4.393 0 7.967-3.573 7.968-7.965a7.9 7.9 0 0 0-2.404-5.642zM8.037 14.54h-.003a6.49 6.49 0 0 1-3.312-.908l-.237-.14-2.438.637.651-2.373-.154-.243a6.51 6.51 0 0 1-1.007-3.496C1.539 4.43 4.459 1.51 8.038 1.51c1.73 0 3.356.674 4.578 1.896a6.44 6.44 0 0 1 1.895 4.576c-.002 3.58-2.922 6.498-6.474 6.498z" />
    <path d="M11.615 9.401c-.196-.098-1.16-.572-1.34-.638-.18-.066-.312-.098-.443.098-.131.196-.508.638-.623.77-.115.131-.23.147-.426.049-.195-.098-.824-.304-1.57-.97-.58-.517-.972-1.156-1.087-1.352-.115-.196-.012-.302.086-.4.088-.087.196-.23.295-.345.098-.114.131-.196.196-.327.066-.131.033-.245-.016-.344-.05-.098-.443-1.068-.607-1.463-.16-.386-.322-.333-.442-.339l-.377-.007a.727.727 0 0 0-.525.245c-.18.196-.689.672-.689 1.639s.705 1.902.803 2.033c.098.131 1.388 2.12 3.363 2.971.47.203.837.324 1.123.414.472.151.902.13 1.242.079.379-.057 1.16-.474 1.324-.932.163-.458.163-.85.114-.932-.05-.082-.18-.131-.377-.229z" />
  </svg>
);

const LoginPage = () => {
  const { tenantId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, tenantId: sessionTenantId, loginWithUid, loginWithGoogle, initiateWhatsAppLogin, completeWhatsAppLogin } = useAuth();

  const tenant = findTenantById(tenantId);
  const displayTenantName = tenant ? tenant.name : tenantId;
  const isElectronRuntime = getRuntimePlatform() === PLATFORM_ELECTRON;
  const hasNativeTitleBar = typeof window !== 'undefined' && Boolean(window.electron?.windowControls);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');

  // New features state
  const [loginSettings, setLoginSettings] = useState(null);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(true);
  
  // WhatsApp Auth State
  const [whatsappMode, setWhatsappMode] = useState('none'); // 'none' | 'phone' | 'otp'
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [whatsappOtp, setWhatsappOtp] = useState('');
  const [pendingOtp, setPendingOtp] = useState('');
  const [whatsappMatchedUser, setWhatsappMatchedUser] = useState(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [supportForm, setSupportForm] = useState({ name: '', email: '', phone: '', priority: 'Normal', message: '' });
  const [supportStatus, setSupportStatus] = useState({ loading: false, error: '', success: '' });

  useEffect(() => {
    if (!isElectronRuntime) return undefined;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [isElectronRuntime]);

  useEffect(() => {
    const loadSettings = async () => {
      const res = await getTenantLoginSettings(tenantId);
      if (res.ok && res.data) {
        setLoginSettings(res.data);
      }
    };
    loadSettings();
  }, [tenantId]);

  useEffect(() => {
    if (isAuthenticated && sessionTenantId === tenantId) {
      navigate(`/t/${tenantId}/dashboard`, { replace: true });
    }
  }, [isAuthenticated, sessionTenantId, tenantId, navigate]);

  const onLogin = async (e) => {
    e?.preventDefault();
    const normalizedUid = String(username || '').trim().toLowerCase();
    if (!normalizedUid) {
      setErrorMessage('Please enter your username.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    // Using username as uid for the current development auth flow
    const result = await loginWithUid(tenantId, normalizedUid, password);
    setLoading(false);

    if (!result.ok) {
      setErrorMessage(result.error || 'Login failed.');
      return;
    }

    navigate(`/t/${tenantId}/dashboard`, { replace: true });
  };

  const onGoogleLogin = async () => {
    setLoading(true);
    setErrorMessage('');
    const result = await loginWithGoogle(tenantId);
    setLoading(false);

    if (!result.ok) {
      if (result.error) {
        setErrorMessage(result.error);
      }
      return;
    }

    navigate(`/t/${tenantId}/dashboard`, { replace: true });
  };

  const onForgotPassword = async (e) => {
    e?.preventDefault();
    const email = String(resetEmail || '').trim();
    if (!email) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    setLoading(true);
    setErrorMessage('');
    setResetMessage('');

    const result = await requestPasswordReset(tenantId, email);
    setLoading(false);

    if (!result.ok) {
      setErrorMessage(result.error);
    } else {
      setResetMessage('Reset link dispatched! Please check your email inbox.');
      setResetEmail('');
    }
  };

  const onSupportSubmit = async (e) => {
    e.preventDefault();
    if (!supportForm.name || !supportForm.email || !supportForm.message) {
      setSupportStatus({ loading: false, error: 'Please fill out all required fields.', success: '' });
      return;
    }

    setSupportStatus({ loading: true, error: '', success: '' });
    const res = await submitSupportTicket(tenantId, supportForm);
    if (res.ok) {
      setSupportStatus({ loading: false, error: '', success: 'Support ticket submitted successfully! We will get back to you.' });
      setSupportForm({ name: '', email: '', phone: '', priority: 'Normal', message: '' });
      setTimeout(() => setShowSupport(false), 3000);
    }
  };

  const onStartWhatsAppAuth = async (e) => {
    e?.preventDefault();
    if (!whatsappPhone) {
      setErrorMessage('Please enter your phone number.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    
    const newOtp = generateOTP();
    const result = await initiateWhatsAppLogin(tenantId, whatsappPhone, newOtp);
    setLoading(false);

    if (!result.ok) {
      setErrorMessage(result.error || 'Failed to send OTP.');
      return;
    }

    setPendingOtp(newOtp);
    setWhatsappMatchedUser(result.matchedUser);
    setWhatsappMode('otp');
    setResendCooldown(60);
  };

  const onVerifyWhatsAppOtp = async (e) => {
    e?.preventDefault();
    if (whatsappOtp !== pendingOtp) {
      setErrorMessage('Invalid OTP code. Please try again.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    const result = await completeWhatsAppLogin(tenantId, whatsappMatchedUser);
    setLoading(false);

    if (!result.ok) {
      setErrorMessage(result.error || 'Authentication failed.');
      return;
    }

    navigate(`/t/${tenantId}/dashboard`, { replace: true });
  };

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);


  const authBody = forgotPasswordMode ? (
    <div className="animate-in slide-in-from-right fade-in duration-500">
      <button
        onClick={() => {
          setForgotPasswordMode(false);
          setErrorMessage('');
          setResetMessage('');
        }}
        className="mb-4 flex items-center gap-2 text-sm font-bold text-[var(--c-muted)] hover:text-[var(--c-text)] transition"
      >
        <ArrowLeft strokeWidth={1.5} size={16} /> Back to Sign In
      </button>
      <form onSubmit={onForgotPassword} className="space-y-5">
        <div className="space-y-1">
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">Recovery Email</label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[var(--c-muted)]">
              <Mail strokeWidth={1.5} size={18} />
            </div>
            <input
              type="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)]/50 py-3.5 pl-11 pr-4 text-sm font-semibold text-[var(--c-text)] shadow-sm outline-none transition focus:border-[var(--c-accent)] focus:bg-[var(--c-surface)] focus:ring-4 focus:ring-[var(--c-accent)]/10"
              placeholder="name@company.com"
            />
          </div>
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-center text-sm font-bold text-rose-500">
            {errorMessage}
          </div>
        )}
        {resetMessage && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-500">
            <CheckCircle2 strokeWidth={1.5} className="shrink-0" size={18} />
            {resetMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className={`relative w-full overflow-hidden rounded-xl py-3.5 text-sm font-bold text-white shadow-lg transition-all ${loading ? 'bg-slate-500 opacity-80 cursor-not-allowed' : 'bg-[var(--c-accent)] hover:opacity-90 shadow-[var(--c-accent)]/25 hover:shadow-[var(--c-accent)]/40 hover:-translate-y-0.5'
            }`}
        >
          <div className="relative z-10 flex items-center justify-center gap-2">
            {loading ? (
              <>
                <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Dispatching...
              </>
            ) : (
              'Send Reset Link'
            )}
          </div>
        </button>
      </form>
    </div>
  ) : whatsappMode === 'phone' ? (
    <div className="animate-in slide-in-from-right fade-in duration-500">
      <button
        type="button"
        onClick={() => {
          setWhatsappMode('none');
          setErrorMessage('');
        }}
        className="mb-4 flex items-center gap-2 text-sm font-bold text-[var(--c-muted)] hover:text-[var(--c-text)] transition"
      >
        <ArrowLeft strokeWidth={1.5} size={16} /> Back to Sign In
      </button>
      <div className="mb-6 space-y-2 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/10 text-emerald-500 shadow-inner">
          <WhatsAppIcon className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-black text-[var(--c-text)]">WhatsApp Sign In</h3>
        <p className="text-xs font-semibold text-[var(--c-muted)]">We'll send a secure one-time code to your registered number.</p>
      </div>
      <form onSubmit={onStartWhatsAppAuth} className="space-y-5">
        <div className="space-y-1">
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">Phone Number</label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[var(--c-muted)]">
              <Phone strokeWidth={1.5} size={18} />
            </div>
            <input
              type="tel"
              value={whatsappPhone}
              onChange={(e) => setWhatsappPhone(e.target.value)}
              className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)]/50 py-3.5 pl-11 pr-4 text-sm font-semibold text-[var(--c-text)] shadow-sm outline-none transition focus:border-[var(--c-accent)] focus:bg-[var(--c-surface)] focus:ring-4 focus:ring-[var(--c-accent)]/10"
              placeholder="e.g. 971500000000"
            />
          </div>
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-center text-sm font-bold text-rose-500 animate-in shake">
            {errorMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !whatsappPhone}
          className={`relative w-full overflow-hidden rounded-xl py-3.5 text-sm font-bold text-white shadow-lg transition-all ${loading ? 'bg-slate-500 opacity-80 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5'
            }`}
        >
          <div className="relative z-10 flex items-center justify-center gap-2">
            {loading ? <RefreshCw strokeWidth={1.5} className="h-4 w-4 animate-spin" /> : <Send strokeWidth={1.5} size={18} />}
            {loading ? 'Sending OTP...' : 'Send OTP via WhatsApp'}
          </div>
        </button>
      </form>
    </div>
  ) : whatsappMode === 'otp' ? (
    <div className="animate-in slide-in-from-right fade-in duration-500">
      <button
        type="button"
        onClick={() => {
          setWhatsappMode('phone');
          setErrorMessage('');
        }}
        className="mb-4 flex items-center gap-2 text-sm font-bold text-[var(--c-muted)] hover:text-[var(--c-text)] transition"
      >
        <ArrowLeft strokeWidth={1.5} size={16} /> Back
      </button>
      <div className="mb-6 space-y-2 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[var(--c-accent)]/10 text-[var(--c-accent)] shadow-inner">
          <ShieldCheck strokeWidth={1.5} size={32} />
        </div>
        <h3 className="text-lg font-black text-[var(--c-text)]">Verify OTP</h3>
        <p className="text-xs font-semibold text-[var(--c-muted)]">
          Enter the 6-digit code sent to <span className="font-bold text-[var(--c-text)]">+{whatsappPhone}</span>
        </p>
      </div>
      <form onSubmit={onVerifyWhatsAppOtp} className="space-y-6">
        <div className="flex justify-center">
          <input
            type="text"
            maxLength={6}
            value={whatsappOtp}
            onChange={(e) => setWhatsappOtp(e.target.value.replace(/\D/g, ''))}
            className="w-full max-w-[200px] text-center text-3xl font-black tracking-[0.5em] rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)]/50 py-4 text-[var(--c-accent)] shadow-sm outline-none transition focus:border-[var(--c-accent)] focus:bg-[var(--c-surface)] focus:ring-4 focus:ring-[var(--c-accent)]/10"
            placeholder="000000"
          />
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-center text-sm font-bold text-rose-500 animate-in shake">
            {errorMessage}
          </div>
        )}

        <div className="space-y-3">
          <button
            type="submit"
            disabled={loading || whatsappOtp.length !== 6}
            className={`relative w-full overflow-hidden rounded-xl py-3.5 text-sm font-bold text-white shadow-lg transition-all ${loading ? 'bg-slate-500 opacity-80 cursor-not-allowed' : 'bg-[var(--c-accent)] hover:opacity-90 shadow-[var(--c-accent)]/25 hover:shadow-[var(--c-accent)]/40 hover:-translate-y-0.5'
              }`}
          >
            {loading ? 'Verifying...' : 'Verify & Sign In'}
          </button>
          
          <div className="text-center">
            {resendCooldown > 0 ? (
              <p className="text-xs font-bold text-[var(--c-muted)]">Resend code in {resendCooldown}s</p>
            ) : (
              <button
                type="button"
                onClick={onStartWhatsAppAuth}
                className="text-xs font-bold text-[var(--c-accent)] hover:underline"
              >
                Resend Code
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  ) : (
    <form onSubmit={onLogin} className="space-y-5 animate-in slide-in-from-left fade-in duration-500">
      <div className="space-y-1">
        <label className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">Username</label>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[var(--c-muted)]">
            <User strokeWidth={1.5} size={18} />
          </div>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)]/50 py-3.5 pl-11 pr-4 text-sm font-semibold text-[var(--c-text)] shadow-sm outline-none transition focus:border-[var(--c-accent)] focus:bg-[var(--c-surface)] focus:ring-4 focus:ring-[var(--c-accent)]/10"
            placeholder="Enter your username"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">Password</label>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[var(--c-muted)]">
            <Lock strokeWidth={1.5} size={18} />
          </div>
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)]/50 py-3.5 pl-11 pr-12 text-sm font-semibold text-[var(--c-text)] shadow-sm outline-none transition focus:border-[var(--c-accent)] focus:bg-[var(--c-surface)] focus:ring-4 focus:ring-[var(--c-accent)]/10"
            placeholder="Enter your password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 flex items-center pr-4 text-[var(--c-muted)] hover:text-[var(--c-text)] transition"
          >
            {showPassword ? <EyeOff strokeWidth={1.5} size={18} /> : <Eye strokeWidth={1.5} size={18} />}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <label className="flex cursor-pointer items-center gap-2">
          <div className="relative flex items-center justify-center">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="peer sr-only"
            />
            <div className="h-4 w-4 rounded border border-[var(--c-border)] bg-[var(--c-panel)] transition peer-checked:border-[var(--c-accent)] peer-checked:bg-[var(--c-accent)]" />
            <svg className="absolute h-3 w-3 scale-0 text-white transition peer-checked:scale-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-[var(--c-muted)] hover:text-[var(--c-text)] transition">Remember me</span>
        </label>

        <button
          type="button"
          onClick={() => {
            setForgotPasswordMode(true);
            setErrorMessage('');
            setResetMessage('');
          }}
          className="text-sm font-bold text-[var(--c-accent)] hover:underline"
        >
          Forgot Password?
        </button>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-center text-sm font-bold text-rose-500 animate-in slide-in-from-top-2">
          {errorMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className={`relative w-full overflow-hidden rounded-xl py-3.5 text-sm font-bold text-white shadow-lg transition-all ${loading ? 'bg-slate-500 opacity-80 cursor-not-allowed' : 'bg-[var(--c-accent)] hover:opacity-90 shadow-[var(--c-accent)]/25 hover:shadow-[var(--c-accent)]/40 hover:-translate-y-0.5'
          }`}
      >
        <div className="relative z-10 flex items-center justify-center gap-2">
          {loading ? (
            <>
              <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Signing In...
            </>
          ) : (
            'Sign In'
          )}
        </div>
      </button>

      <div className="relative flex items-center py-2">
        <div className="flex-grow border-t border-[var(--c-border)]"></div>
        <span className="shrink-0 px-4 text-xs font-bold uppercase text-[var(--c-muted)]">OR</span>
        <div className="flex-grow border-t border-[var(--c-border)]"></div>
      </div>

      <button
        type="button"
        onClick={onGoogleLogin}
        disabled={loading}
        className={`flex w-full items-center justify-center gap-3 rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] py-3.5 text-sm font-bold text-[var(--c-text)] shadow-sm transition-all hover:bg-[var(--c-surface)] hover:shadow-md ${loading ? 'cursor-not-allowed opacity-50' : ''}`}
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        Continue with Google
      </button>

      <button
        type="button"
        onClick={() => setWhatsappMode('phone')}
        disabled={loading}
        className={`flex w-full items-center justify-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 py-3.5 text-sm font-bold text-emerald-500 shadow-sm transition-all hover:bg-emerald-500/10 hover:shadow-md ${loading ? 'cursor-not-allowed opacity-50' : ''}`}
      >
        <WhatsAppIcon className="h-5 w-5" />
        Sign in with WhatsApp
      </button>
    </form>
  );

  const legalFooter = (
    <div className="mt-8 flex flex-col items-center">
      <div className="flex items-center gap-4 text-xs font-bold text-[var(--c-muted)]">
        <button onClick={() => setShowPrivacy(true)} className="flex items-center gap-1.5 hover:text-[var(--c-text)] transition">
          <FileText strokeWidth={1.5} size={14} /> Privacy Policy
        </button>
        <span>&bull;</span>
        <button onClick={() => setShowSupport(true)} className="flex items-center gap-1.5 hover:text-[var(--c-text)] transition">
          <LifeBuoy strokeWidth={1.5} size={14} /> Support
        </button>
      </div>
      <p className="mt-3 text-center text-xs font-semibold text-[var(--c-muted)]/60">
        &copy; {new Date().getFullYear()} {displayTenantName}. All rights reserved.
      </p>
    </div>
  );

  const legalFooterCompact = (
    <div className="mt-4 flex flex-col items-center">
      <div className="flex items-center gap-4 text-[11px] font-bold text-[var(--c-muted)]">
        <button onClick={() => setShowPrivacy(true)} className="flex items-center gap-1.5 hover:text-[var(--c-text)] transition">
          <FileText strokeWidth={1.5} size={13} /> Privacy Policy
        </button>
        <span>&bull;</span>
        <button onClick={() => setShowSupport(true)} className="flex items-center gap-1.5 hover:text-[var(--c-text)] transition">
          <LifeBuoy strokeWidth={1.5} size={13} /> Support
        </button>
      </div>
    </div>
  );

  return (
    <div
      className={`relative flex items-center justify-center bg-[var(--c-background)] px-4 py-3 ${
        isElectronRuntime ? 'overflow-hidden' : 'overflow-y-auto'
      }`}
      style={isElectronRuntime
        ? { height: hasNativeTitleBar ? 'calc(100dvh - 2.25rem)' : '100dvh' }
        : { minHeight: '100dvh' }}
    >
      {/* Background Decorative Elements */}
      <div className="absolute left-1/2 top-1/2 -z-10 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--c-accent)]/20 blur-[120px]" />
      <div className="absolute right-0 top-0 -z-10 h-[400px] w-[400px] rounded-full bg-blue-500/10 blur-[100px]" />
      <div className="absolute bottom-0 left-0 -z-10 h-[400px] w-[400px] rounded-full bg-purple-500/10 blur-[100px]" />

      {/* Announcements Modal / Toast */}
      {loginSettings?.announcement?.isVisible && showAnnouncement && (
        <div className={`fixed right-4 z-50 w-full max-w-sm animate-in slide-in-from-top-4 fade-in duration-500 ${isElectronRuntime && hasNativeTitleBar ? 'top-12' : 'top-4'}`}>
          <div className="flex items-start gap-3 rounded-2xl border border-[var(--c-accent)]/20 bg-[var(--c-surface)] p-4 shadow-2xl backdrop-blur-xl">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--c-accent)]/20 to-blue-500/20 text-[var(--c-accent)]">
              <BellRing strokeWidth={1.5} size={20} />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-[var(--c-text)]">{loginSettings.announcement.title || 'Announcement'}</h4>
              <p className="mt-1 text-xs font-semibold text-[var(--c-muted)]">{loginSettings.announcement.message}</p>
              {loginSettings.announcement.imageUrl && (
                <img src={loginSettings.announcement.imageUrl} alt="Announcement" className="mt-2 max-h-32 w-full rounded-xl bg-white object-cover" />
              )}
            </div>
            <button onClick={() => setShowAnnouncement(false)} className="text-[var(--c-muted)] hover:text-[var(--c-text)]">
              <X strokeWidth={1.5} size={16} />
            </button>
          </div>
        </div>
      )}

      <div className={`w-full animate-in fade-in slide-in-from-bottom-8 duration-700 ${isElectronRuntime ? 'h-[min(860px,calc(100dvh-1.5rem))] max-w-6xl' : 'max-w-[420px]'}`}>
        {isElectronRuntime ? (
          <div className="h-full overflow-hidden rounded-3xl border border-white/10 bg-[var(--c-surface)]/76 shadow-2xl backdrop-blur-xl">
            <div className="grid h-full lg:grid-cols-[1.12fr_0.88fr]">
              <aside className="hidden border-r border-white/10 bg-[var(--c-panel)]/55 p-10 lg:flex lg:flex-col lg:justify-between">
                <div>
              <div className="mb-6 flex h-28 items-center justify-center rounded-2xl bg-white/90 px-3 py-2">
                    <img
                      src="/logo.png"
                      alt="ACIS Logo"
                      className="h-full w-auto max-w-[260px] rounded-2xl object-contain"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>
                  <h2 className="text-4xl font-black tracking-tight text-[var(--c-text)]">ACIS Workspace</h2>
                  <p className="mt-3 max-w-md text-base font-medium text-[var(--c-muted)]">
                    Dedicated desktop sign-in for <span className="font-bold text-[var(--c-accent)]">{displayTenantName}</span>.
                    Optimized for secure, fast daily operations.
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)]/65 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--c-muted)]">Desktop Mode</p>
                  <p className="mt-2 text-2xl font-black text-[var(--c-text)]">Electron</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--c-muted)]">Window-optimized authentication and tenant-isolated access.</p>
                </div>
              </aside>

              <div className="overflow-hidden p-5 md:p-6">
                <div className="rounded-3xl border border-white/10 bg-[var(--c-surface)]/80 p-6 shadow-xl backdrop-blur-xl">
                  <div className="mb-8 flex flex-col items-center text-center">
                    <div className="mb-6 flex h-20 items-center justify-center rounded-2xl bg-white/90 px-3 py-2">
                      <img
                        src="/logo.png"
                        alt="ACIS Logo"
                        className="h-full w-auto object-contain"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>
                    <h1 className="text-2xl font-black tracking-tight text-[var(--c-text)]">Sign In</h1>
                    <p className="mt-2 text-sm font-medium text-[var(--c-muted)]">
                      Continue to <span className="font-bold text-[var(--c-accent)]">{displayTenantName}</span>
                    </p>
                  </div>
                  {authBody}
                </div>
                {legalFooterCompact}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-3xl border border-white/10 bg-[var(--c-surface)]/80 p-8 shadow-2xl backdrop-blur-xl">
              <div className="mb-8 flex flex-col items-center text-center">
                <div className="mb-6 flex h-20 items-center justify-center rounded-2xl bg-white/90 px-3 py-2">
                  <img
                    src="/logo.png"
                    alt="ACIS Logo"
                    className="h-full w-auto object-contain"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
                <h1 className="text-2xl font-black tracking-tight text-[var(--c-text)]">Welcome Back</h1>
                <p className="mt-2 text-sm font-medium text-[var(--c-muted)]">
                  Sign in to tenant workspace <span className="font-bold text-[var(--c-accent)]">{displayTenantName}</span>
                </p>
              </div>
              {authBody}
            </div>
            {legalFooter}
          </>
        )}
      </div>

      {/* Privacy Policy Modal */}
      {
        showPrivacy && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-[var(--c-border)] bg-[var(--c-surface)] shadow-2xl">
              <div className="flex items-center justify-between border-b border-[var(--c-border)] p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--c-accent)]/10 text-[var(--c-accent)]">
                    <ShieldAlert strokeWidth={1.5} size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-[var(--c-text)]">Privacy & Policy</h3>
                </div>
                <button onClick={() => setShowPrivacy(false)} className="rounded-xl p-2 text-[var(--c-muted)] hover:bg-[var(--c-panel)] hover:text-[var(--c-text)]">
                  <X strokeWidth={1.5} size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                {loginSettings?.privacyPolicy ? (
                  <div className="prose prose-sm prose-invert max-w-none text-[var(--c-muted)] whitespace-pre-wrap">
                    {loginSettings.privacyPolicy}
                  </div>
                ) : (
                  <p className="text-center text-sm font-semibold text-[var(--c-muted)]">Privacy policy has not been configured yet. Please contact the administrator.</p>
                )}
              </div>
              <div className="border-t border-[var(--c-border)] p-5">
                <button onClick={() => setShowPrivacy(false)} className="w-full rounded-xl bg-[var(--c-panel)] py-3 text-sm font-bold text-[var(--c-text)] hover:bg-[var(--c-panel)]/80 transition">
                  Understood
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Support Self-Service Modal */}
      {
        showSupport && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="flex max-h-[95vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-[var(--c-border)] bg-[var(--c-surface)] shadow-2xl">
              <div className="flex items-center justify-between border-b border-[var(--c-border)] p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500">
                    <LifeBuoy strokeWidth={1.5} size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-[var(--c-text)]">Support Desk</h3>
                </div>
                <button onClick={() => setShowSupport(false)} className="rounded-xl p-2 text-[var(--c-muted)] hover:bg-[var(--c-panel)] hover:text-[var(--c-text)]">
                  <X strokeWidth={1.5} size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {supportForm.priority === 'Urgent' && loginSettings?.supportInfo && (loginSettings.supportInfo.whatsapp || loginSettings.supportInfo.email) && (
                  <div className="mb-6 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 animate-in slide-in-from-top-2">
                    <div className="flex gap-3">
                      <AlertTriangle strokeWidth={1.5} className="shrink-0 text-rose-500" size={20} />
                      <div>
                        <h4 className="text-sm font-bold text-rose-500">Urgent Support Contact</h4>
                        <p className="mt-1 text-xs font-semibold text-[var(--c-text)]">For immediate emergency assistance, please contact us directly:</p>
                        <div className="mt-3 space-y-2">
                          {loginSettings.supportInfo.whatsapp && (
                            <a href={`https://wa.me/${loginSettings.supportInfo.whatsapp}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs font-bold text-emerald-500 hover:underline">
                              WhatsApp: {loginSettings.supportInfo.whatsapp}
                            </a>
                          )}
                          {loginSettings.supportInfo.email && (
                            <a href={`mailto:${loginSettings.supportInfo.email}`} className="flex items-center gap-2 text-xs font-bold text-blue-500 hover:underline">
                              Email: {loginSettings.supportInfo.email}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <form id="support-form" onSubmit={onSupportSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={supportForm.name}
                      onChange={e => setSupportForm({ ...supportForm, name: e.target.value })}
                      className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] py-3 px-4 text-sm font-semibold text-[var(--c-text)] outline-none focus:border-[var(--c-accent)]"
                      placeholder="Your name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">Email *</label>
                      <input
                        type="email"
                        required
                        value={supportForm.email}
                        onChange={e => setSupportForm({ ...supportForm, email: e.target.value })}
                        className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] py-3 px-4 text-sm font-semibold text-[var(--c-text)] outline-none focus:border-[var(--c-accent)]"
                        placeholder="Email"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">Phone</label>
                      <input
                        type="text"
                        value={supportForm.phone}
                        onChange={e => setSupportForm({ ...supportForm, phone: e.target.value })}
                        className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] py-3 px-4 text-sm font-semibold text-[var(--c-text)] outline-none focus:border-[var(--c-accent)]"
                        placeholder="Phone"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">Priority Level</label>
                    <select
                      value={supportForm.priority}
                      onChange={e => setSupportForm({ ...supportForm, priority: e.target.value })}
                      className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] py-3 px-4 text-sm font-semibold text-[var(--c-text)] outline-none focus:border-[var(--c-accent)]"
                    >
                      <option value="Low">Low - General Inquiry</option>
                      <option value="Normal">Normal - Login Issue</option>
                      <option value="Urgent">Urgent - System Critical</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">Details *</label>
                    <textarea
                      required
                      value={supportForm.message}
                      onChange={e => setSupportForm({ ...supportForm, message: e.target.value })}
                      className="w-full min-h-[100px] rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] py-3 px-4 text-sm font-semibold text-[var(--c-text)] outline-none focus:border-[var(--c-accent)] resize-none"
                      placeholder="Describe your issue..."
                    />
                  </div>

                  {supportStatus.error && (
                    <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm font-bold text-rose-500">
                      {supportStatus.error}
                    </div>
                  )}
                  {supportStatus.success && (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-500">
                      {supportStatus.success}
                    </div>
                  )}
                </form>
              </div>

              <div className="border-t border-[var(--c-border)] p-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowSupport(false)}
                  className="rounded-xl bg-transparent py-3 px-6 text-sm font-bold text-[var(--c-muted)] hover:text-[var(--c-text)] transition"
                >
                  Cancel
                </button>
                <button
                  form="support-form"
                  type="submit"
                  disabled={supportStatus.loading}
                  className="flex items-center gap-2 rounded-xl bg-[var(--c-accent)] py-3 px-6 text-sm font-bold text-white shadow-lg hover:opacity-90 disabled:opacity-50 transition"
                >
                  {supportStatus.loading ? 'Submitting...' : 'Submit Ticket'}
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default LoginPage;

