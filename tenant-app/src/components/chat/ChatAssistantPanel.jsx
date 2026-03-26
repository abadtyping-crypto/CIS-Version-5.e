import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { submitSupportTicket } from '../../lib/ticketStore';

// ─── helpers ─────────────────────────────────────────────────────────────────
const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
};
const firstName = (name) => String(name || 'there').split(' ')[0];

const BOT = 'bot';
const USER = 'user';
const mkBot = (text, chips = []) => ({ id: `${Date.now()}-${Math.random()}`, role: BOT, text, chips });
const mkUser = (text) => ({ id: `${Date.now()}-${Math.random()}`, role: USER, text });

const ISSUE_CATEGORIES = [
  { label: 'Login / Access Issue', value: 'login_issue' },
  { label: 'ID / Document Numbering', value: 'id_issue' },
  { label: 'Payment / Portal Issue', value: 'payment_issue' },
  { label: 'PDF / Printing Issue', value: 'pdf_issue' },
  { label: 'App Slow / Not Loading', value: 'performance_issue' },
  { label: 'Other', value: 'other' },
];
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Critical'];

// ─── simple markdown renderer ─────────────────────────────────────────────────
const renderMd = (text) =>
  text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code style="font-family:monospace;font-size:0.75em;background:rgba(0,0,0,0.08);padding:1px 4px;border-radius:3px">$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="text-decoration:underline;opacity:0.85">$1</a>');

// ─── component ────────────────────────────────────────────────────────────────
const ChatAssistantPanel = () => {
  const { tenantId } = useParams();
  const { user } = useAuth();

  const name = user?.displayName || user?.email || 'there';
  const uid = user?.uid || '';

  const greeting = mkBot(
    `Hi ${firstName(name)}, ${getGreeting()}! 👋\nI'm **Ayman Bot** 🤖 — your ACIS Workspace assistant.\n\nHow can I help you today?`,
    ['🗺️ Guide me through the app', '🛠️ I have an issue', '💬 Other query'],
  );

  const [messages, setMessages] = useState([greeting]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [step, setStep] = useState('idle');
  const [issueCategory, setIssueCategory] = useState('');
  const [issueDescription, setIssueDescription] = useState('');

  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const pushBot = (text, chips = []) => setMessages((p) => [...p, mkBot(text, chips)]);
  const pushUser = (text) => setMessages((p) => [...p, mkUser(text)]);

  const handleSend = async (override) => {
    const raw = String(override || inputText).trim();
    if (!raw || isSending) return;
    setInputText('');
    pushUser(raw);
    setIsSending(true);
    await new Promise((r) => setTimeout(r, 380));

    const r = raw.toLowerCase();

    if (step === 'idle') {
      if (r.includes('guide') || r.includes('app') || r.includes('🗺')) {
        setStep('guide');
        pushBot(
          `Sure! Here's a quick overview of ACIS Workspace:\n\n` +
          `📋 **Daily Transactions** — Record client services\n` +
          `📄 **Quotations** — Create and send quotes\n` +
          `🧾 **Proforma Invoices** — Generate invoices\n` +
          `🏦 **Portal Management** — Manage payment portals\n` +
          `👥 **Clients** — View and manage client database\n` +
          `📊 **Dashboard** — Activity overview\n` +
          `⚙️ **Settings** — Branding, PDF, ID Rules\n\nWhich area would you like help with?`,
          ['Daily Transactions', 'Quotations', 'Settings', '← Back'],
        );
      } else if (r.includes('issue') || r.includes('problem') || r.includes('🛠')) {
        setStep('issue_category');
        pushBot(`Sorry to hear that! Let me help you log this. 📝\n\nWhat type of issue are you facing?`, ISSUE_CATEGORIES.map((c) => c.label));
      } else {
        pushBot(`Got it! Would you also like to raise a support ticket so the team can track this?`, ['Yes, raise a ticket', 'No thanks', '← Back']);
      }
    }

    else if (step === 'guide') {
      if (r.includes('transaction')) {
        pushBot(`📋 **Daily Transactions**\n\nRecord services for clients, set quantities and prices, and generate payment receipts as PDFs.`, ['Back to guide', '🛠️ Report issue', '← Back']);
      } else if (r.includes('quotation')) {
        pushBot(`📄 **Quotations**\n\nAdd line items, set an expiry date, add Terms & Conditions, and send by email or PDF.`, ['Back to guide', '🛠️ Report issue', '← Back']);
      } else if (r.includes('setting')) {
        pushBot(`⚙️ **Settings**\n\n• **Branding** — Logo, company name, colors\n• **PDF Studio** — Layout, visibility, filename rules\n• **ID Rules** — Auto-numbering for documents\n• **Users** — Team access and roles`, ['Back to guide', '🛠️ Report issue', '← Back']);
      } else if (r.includes('back') || r.includes('←')) {
        setStep('idle');
        pushBot(`What else can I help you with?`, ['🗺️ Guide me through the app', '🛠️ I have an issue', '💬 Other query']);
      } else if (r.includes('issue')) {
        setStep('issue_category');
        pushBot(`What type of issue are you facing?`, ISSUE_CATEGORIES.map((c) => c.label));
      } else {
        pushBot(`Which area would you like help with?`, ['Daily Transactions', 'Quotations', 'Settings', '← Back']);
      }
    }

    else if (step === 'issue_category') {
      const matched = ISSUE_CATEGORIES.find((c) => r.includes(c.label.toLowerCase()) || r.includes(c.value));
      const cat = matched?.value || 'other';
      setIssueCategory(cat);
      setStep('issue_description');
      pushBot(`Got it — **"${matched?.label || raw}"**\n\nPlease describe the issue briefly:`);
    }

    else if (step === 'issue_description') {
      setIssueDescription(raw);
      setStep('issue_priority');
      pushBot(`Thank you. How urgent is this?`, PRIORITY_OPTIONS);
    }

    else if (step === 'issue_priority') {
      const priority = PRIORITY_OPTIONS.find((p) => r.includes(p.toLowerCase())) || 'Medium';
      const res = await submitSupportTicket({
        tenantId,
        uid,
        displayName: name,
        category: issueCategory,
        description: issueDescription,
        priorityLevel: priority.toLowerCase(),
      });
      setStep('idle');
      setIssueCategory('');
      setIssueDescription('');
      if (res.ok) {
        const isUrgent = ['high', 'critical'].includes(priority.toLowerCase());
        pushBot(
          `✅ **Ticket raised!**\nTicket ID: \`${res.ticketId?.slice(0, 8).toUpperCase()}\`\n\n` +
          (isUrgent
            ? `Since this is **${priority}** priority, you can also contact us directly:\n📞 [Call +971551012119](tel:+971551012119)\n💬 [WhatsApp](https://wa.me/971551012119?text=Hi%2C+I%27m+${encodeURIComponent(name)}+Tenant:+${encodeURIComponent(tenantId || '')}+UID:+${encodeURIComponent(uid)}+–+)\n✉️ [Email](mailto:info@abadtyping.com?subject=Urgent:${encodeURIComponent(tenantId || '')})\n\n`
            : '') +
          `Is there anything else I can help you with?`,
          ['🗺️ Guide me through the app', '🛠️ Report another issue'],
        );
      } else {
        pushBot(
          `⚠️ Couldn't save the ticket right now. Please contact us directly:\n📞 [+971551012119](tel:+971551012119)\n✉️ [info@abadtyping.com](mailto:info@abadtyping.com)`,
          ['Try again', '← Back'],
        );
      }
    }

    else {
      setStep('idle');
      pushBot(`What can I help you with?`, ['🗺️ Guide me through the app', '🛠️ I have an issue', '💬 Other query']);
    }

    setIsSending(false);
  };

  const lastBotChips = [...messages].reverse().find((m) => m.role === BOT && m.chips?.length)?.chips || [];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: 'var(--c-surface)',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', borderBottom: '1px solid var(--c-border)',
        background: 'var(--c-panel)', flexShrink: 0,
      }}>
        <div style={{ position: 'relative' }}>
          <img src="/boticon.png" alt="Ayman Bot" style={{ height: 38, width: 38, borderRadius: '12px', objectFit: 'cover' }} />
          <span style={{
            position: 'absolute', bottom: 1, right: 1,
            height: 9, width: 9, borderRadius: '50%',
            background: '#34d399', border: '2px solid var(--c-panel)',
          }} />
        </div>
        <div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: 'var(--c-text)' }}>Ayman Bot</p>
          <p style={{ margin: 0, fontSize: 11, color: '#34d399', fontWeight: 600 }}>Online · ACIS Support</p>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 80px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.map((msg) => (
          <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === USER ? 'flex-end' : 'flex-start', gap: 6, alignItems: 'flex-end' }}>
            {msg.role === BOT && (
               <img src="/boticon.png" alt="" style={{ height: 26, width: 26, borderRadius: '8px', objectFit: 'cover', flexShrink: 0, marginBottom: 2 }} />
            )}
            <div
              style={{
                maxWidth: '78%',
                borderRadius: msg.role === USER ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                padding: '9px 13px',
                fontSize: 13,
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                background: msg.role === USER ? 'var(--c-accent)' : 'var(--c-panel)',
                color: msg.role === USER ? '#fff' : 'var(--c-text)',
                border: msg.role === USER ? 'none' : '1px solid var(--c-border)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}
              dangerouslySetInnerHTML={{ __html: renderMd(msg.text) }}
            />
          </div>
        ))}

        {/* Quick-reply chips */}
        {!isSending && lastBotChips.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 32 }}>
            {lastBotChips.map((chip) => (
              <button
                key={chip}
                onClick={() => handleSend(chip)}
                style={{
                  padding: '6px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600,
                  border: '1.5px solid var(--c-accent)', cursor: 'pointer',
                  color: 'var(--c-accent)', background: 'transparent',
                  transition: 'all 0.15s',
                }}
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {/* Typing dots */}
        {isSending && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
            <img src="/boticon.png" alt="" style={{ height: 26, width: 26, borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
            <div style={{
              background: 'var(--c-panel)', border: '1px solid var(--c-border)',
              borderRadius: '18px 18px 18px 4px', padding: '10px 14px',
              display: 'flex', gap: 4, alignItems: 'center',
            }}>
              {[0, 1, 2].map((i) => (
                <span key={i} style={{
                  height: 7, width: 7, borderRadius: '50%',
                  background: 'var(--c-muted)', display: 'inline-block',
                  animation: `bounce 1s ease-in-out ${i * 0.15}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 10px', borderTop: '1px solid var(--c-border)',
        background: 'var(--c-panel)', flexShrink: 0,
        position: 'sticky', bottom: 0,
      }}>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
          placeholder="Type a message…"
          disabled={isSending}
          style={{
            flex: 1, borderRadius: 20, border: '1px solid var(--c-border)',
            padding: '9px 14px', fontSize: 13, outline: 'none',
            background: 'var(--c-surface)', color: 'var(--c-text)',
          }}
        />
        <button
          onClick={() => handleSend()}
          disabled={isSending || !inputText.trim()}
          style={{
            height: 38, width: 38, borderRadius: '50%', border: 'none',
            background: 'var(--c-accent)', color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, opacity: isSending || !inputText.trim() ? 0.4 : 1,
          }}
          aria-label="Send"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3.478 2.405a.75.75 0 0 0-.926.94l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.405Z" />
          </svg>
        </button>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  );
};

export default ChatAssistantPanel;
