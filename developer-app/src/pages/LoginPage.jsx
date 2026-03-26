import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { requestPasswordReset, getTenantLoginSettings, submitSupportTicket } from '../lib/backendStore';
import { findTenantById } from '../config/tenants';
import { Eye, EyeOff, Lock, User, Mail, ArrowLeft, CheckCircle2, ShieldAlert, X, AlertTriangle, FileText, LifeBuoy, BellRing } from 'lucide-react';

const LoginPage = () => {
  const { tenantId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, tenantId: sessionTenantId, loginWithUid, loginWithGoogle } = useAuth();

  const tenant = findTenantById(tenantId);
  const displayTenantName = tenant ? tenant.name : tenantId;

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

  const [supportForm, setSupportForm] = useState({ name: '', email: '', phone: '', priority: 'Normal', message: '' });
  const [supportStatus, setSupportStatus] = useState({ loading: false, error: '', success: '' });

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
    } else {
      setSupportStatus({ loading: false, error: res.error || 'Failed to submit.', success: '' });
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--c-background)] px-4">
      {/* Background Decorative Elements */}
      <div className="absolute left-1/2 top-1/2 -z-10 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--c-accent)]/20 blur-[120px]" />
      <div className="absolute right-0 top-0 -z-10 h-[400px] w-[400px] rounded-full bg-blue-500/10 blur-[100px]" />
      <div className="absolute bottom-0 left-0 -z-10 h-[400px] w-[400px] rounded-full bg-purple-500/10 blur-[100px]" />

      {/* Announcements Modal / Toast */}
      {loginSettings?.announcement?.isVisible && showAnnouncement && (
        <div className="fixed top-4 right-4 z-50 w-full max-w-sm animate-in slide-in-from-top-4 fade-in duration-500">
          <div className="flex items-start gap-3 rounded-2xl border border-[var(--c-accent)]/20 bg-[var(--c-surface)] p-4 shadow-2xl backdrop-blur-xl">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--c-accent)]/20 to-blue-500/20 text-[var(--c-accent)]">
              <BellRing size={20} />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-[var(--c-text)]">{loginSettings.announcement.title || 'Announcement'}</h4>
              <p className="mt-1 text-xs font-semibold text-[var(--c-muted)]">{loginSettings.announcement.message}</p>
              {loginSettings.announcement.imageUrl && (
                <img src={loginSettings.announcement.imageUrl} alt="Announcement" className="mt-2 max-h-32 w-full rounded-xl object-cover" />
              )}
            </div>
            <button onClick={() => setShowAnnouncement(false)} className="text-[var(--c-muted)] hover:text-[var(--c-text)]">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="w-full max-w-[420px] animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="rounded-3xl border border-white/10 bg-[var(--c-surface)]/80 p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-6 flex h-20 items-center justify-center">
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

          {forgotPasswordMode ? (
            <div className="animate-in slide-in-from-right fade-in duration-500">
              <button
                onClick={() => {
                  setForgotPasswordMode(false);
                  setErrorMessage('');
                  setResetMessage('');
                }}
                className="mb-4 flex items-center gap-2 text-sm font-bold text-[var(--c-muted)] hover:text-[var(--c-text)] transition"
              >
                <ArrowLeft size={16} /> Back to Sign In
              </button>
              <form onSubmit={onForgotPassword} className="space-y-5">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">Recovery Email</label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[var(--c-muted)]">
                      <Mail size={18} />
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
                    <CheckCircle2 className="shrink-0" size={18} />
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
          ) : (
            <form onSubmit={onLogin} className="space-y-5 animate-in slide-in-from-left fade-in duration-500">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">Username</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[var(--c-muted)]">
                    <User size={18} />
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
                    <Lock size={18} />
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
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
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
            </form>
          )}        </div>

        <div className="mt-8 flex flex-col items-center">
          <div className="flex items-center gap-4 text-xs font-bold text-[var(--c-muted)]">
            <button onClick={() => setShowPrivacy(true)} className="flex items-center gap-1.5 hover:text-[var(--c-text)] transition">
              <FileText size={14} /> Privacy Policy
            </button>
            <span>&bull;</span>
            <button onClick={() => setShowSupport(true)} className="flex items-center gap-1.5 hover:text-[var(--c-text)] transition">
              <LifeBuoy size={14} /> Support
            </button>
          </div>
          <p className="mt-3 text-center text-xs font-semibold text-[var(--c-muted)]/60">
            &copy; {new Date().getFullYear()} {displayTenantName}. All rights reserved.
          </p>
        </div>
      </div>

      {/* Privacy Policy Modal */}
      {
        showPrivacy && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-[var(--c-border)] bg-[var(--c-surface)] shadow-2xl">
              <div className="flex items-center justify-between border-b border-[var(--c-border)] p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--c-accent)]/10 text-[var(--c-accent)]">
                    <ShieldAlert size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-[var(--c-text)]">Privacy & Policy</h3>
                </div>
                <button onClick={() => setShowPrivacy(false)} className="rounded-xl p-2 text-[var(--c-muted)] hover:bg-[var(--c-panel)] hover:text-[var(--c-text)]">
                  <X size={20} />
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
                    <LifeBuoy size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-[var(--c-text)]">Support Desk</h3>
                </div>
                <button onClick={() => setShowSupport(false)} className="rounded-xl p-2 text-[var(--c-muted)] hover:bg-[var(--c-panel)] hover:text-[var(--c-text)]">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {supportForm.priority === 'Urgent' && loginSettings?.supportInfo && (loginSettings.supportInfo.whatsapp || loginSettings.supportInfo.email) && (
                  <div className="mb-6 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 animate-in slide-in-from-top-2">
                    <div className="flex gap-3">
                      <AlertTriangle className="shrink-0 text-rose-500" size={20} />
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
