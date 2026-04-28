import { Link } from 'react-router-dom';
import { Wifi, Zap, Shield, QrCode } from 'lucide-react';

const features = [
  {
    icon: QrCode,
    title: 'Scan & Connect',
    desc: 'Your family member scans one QR code. No apps to configure, no technical knowledge needed.',
  },
  {
    icon: Zap,
    title: 'Under 60 Seconds',
    desc: "From zero to working internet in under a minute. Setup takes longer than the daily use.",
  },
  {
    icon: Shield,
    title: 'Your Relay, Your Control',
    desc: 'Each relay runs on your own Cloudflare account. Nobody else has access to your traffic.',
  },
];

const steps = [
  { n: 1, title: 'Create a free Cloudflare account', desc: 'Sign up at cloudflare.com — takes 2 minutes.' },
  { n: 2, title: 'Deploy your relay', desc: 'Paste your API token. We deploy a Worker to your account automatically.' },
  { n: 3, title: 'Share a QR code', desc: 'Add a family member and send them the QR code. They scan it — done.' },
];

export default function Landing() {
  return (
    <div className="min-h-screen" style={{ background: '#0a0f1e', color: '#f1f5f9', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#06b6d4' }}>
            <Wifi size={16} className="text-white" />
          </div>
          <span className="font-semibold text-slate-100 text-lg">Sepehr</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm text-slate-400 hover:text-slate-100 transition-colors px-3 py-1.5">
            Sign in
          </Link>
          <Link
            to="/signup"
            className="text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            style={{ background: '#06b6d4', color: '#fff' }}
          >
            Get started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="text-center px-6 pt-20 pb-24 max-w-4xl mx-auto">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-6"
          style={{ background: 'rgba(6,182,212,0.1)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.2)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          Free tier — no credit card required
        </div>
        <h1 className="text-5xl font-bold mb-6 leading-tight text-slate-100">
          Free internet for your<br />
          <span style={{ color: '#06b6d4' }}>family in Iran</span>
        </h1>
        <p className="text-xl mb-10 max-w-2xl mx-auto" style={{ color: '#94a3b8' }}>
          Deploy a personal relay in minutes. Your family member scans one QR code
          and gets unrestricted internet access — no configuration required.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            to="/signup"
            className="px-8 py-3 rounded-xl font-semibold text-white transition-colors"
            style={{ background: '#06b6d4' }}
          >
            Deploy your relay →
          </Link>
          <Link
            to="/help"
            className="px-8 py-3 rounded-xl font-semibold transition-colors"
            style={{ color: '#94a3b8', border: '1px solid rgba(51,65,85,0.5)' }}
          >
            How it works
          </Link>
        </div>
      </section>

      {/* Steps */}
      <section className="px-6 pb-24 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-12 text-slate-100">Three steps to free internet</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map(({ n, title, desc }) => (
            <div key={n} className="rounded-2xl p-6" style={{ background: '#111827', border: '1px solid rgba(51,65,85,0.5)' }}>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold mb-4"
                style={{ background: 'rgba(6,182,212,0.15)', color: '#06b6d4' }}
              >
                {n}
              </div>
              <h3 className="font-semibold text-slate-100 mb-2">{title}</h3>
              <p className="text-sm" style={{ color: '#94a3b8' }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-6 pb-24 max-w-4xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl p-6" style={{ background: '#111827', border: '1px solid rgba(51,65,85,0.5)' }}>
              <div className="mb-4" style={{ color: '#06b6d4' }}>
                <Icon size={24} />
              </div>
              <h3 className="font-semibold text-slate-100 mb-2">{title}</h3>
              <p className="text-sm" style={{ color: '#94a3b8' }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center pb-12 text-sm" style={{ color: '#475569' }}>
        <p>Sepehr is open source — built with Cloudflare Workers, free forever.</p>
      </footer>
    </div>
  );
}
