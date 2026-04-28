import { Link } from 'react-router-dom';
import { Wifi, ExternalLink } from 'lucide-react';

const apps = [
  {
    platform: 'iPhone / iPad',
    name: 'Shadowrocket',
    storeUrl: 'https://apps.apple.com/app/shadowrocket/id932747118',
    storeLabel: 'App Store',
    steps: [
      'Download Shadowrocket from the App Store (paid — ~$3)',
      'In Sepehr, go to your family member\'s QR Code tab',
      'In Shadowrocket: tap + → Scan QR Code',
      'Point your camera at the QR code',
      'Tap the imported rule and toggle the connection ON',
    ],
  },
  {
    platform: 'Android',
    name: 'v2rayNG',
    storeUrl: 'https://github.com/2dust/v2rayNG/releases/latest',
    storeLabel: 'GitHub Releases',
    steps: [
      'Install v2rayNG (free, on Google Play or GitHub)',
      'In Sepehr, open your family member\'s QR Code tab',
      'In v2rayNG: tap + → Import config from QR code',
      'Scan the QR code',
      'Tap the entry and press the ▶ button',
    ],
  },
  {
    platform: 'Windows / macOS',
    name: 'Clash Verge',
    storeUrl: 'https://github.com/clash-verge-rev/clash-verge-rev/releases/latest',
    storeLabel: 'GitHub Releases',
    steps: [
      'Download and install Clash Verge Rev',
      'In Sepehr, go to the Config tab and copy the Full Clash Config YAML',
      'Save it as a .yaml file on your computer',
      'In Clash Verge: Profiles → Import → choose the file',
      'Click the profile to activate and set mode to Rule',
      'Enable the System Proxy toggle',
    ],
  },
  {
    platform: 'Android (advanced)',
    name: 'Clash Meta for Android',
    storeUrl: 'https://github.com/MetaCubeX/ClashMetaForAndroid/releases/latest',
    storeLabel: 'GitHub Releases',
    steps: [
      'Download Clash Meta for Android from GitHub',
      'In Sepehr, go to the Config tab and copy the Full Clash Config YAML',
      'In Clash Meta: Profiles → New Profile → File → paste the YAML',
      'Tap the profile to activate',
      'Tap the connect button',
    ],
  },
];

export default function Help() {
  return (
    <div className="min-h-screen" style={{ background: '#0a0f1e' }}>
      <header className="flex items-center gap-4 px-6 py-4 max-w-4xl mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#06b6d4' }}>
            <Wifi size={16} className="text-white" />
          </div>
          <span className="font-semibold text-slate-100">Sepehr</span>
        </Link>
        <span className="text-slate-600">/</span>
        <span className="text-slate-400 text-sm">App Setup Guide</span>
      </header>

      <div className="px-6 py-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-100 mb-2">App Setup Guide</h1>
        <p className="text-slate-400 mb-10">
          Step-by-step instructions for each supported app. All apps are free (except Shadowrocket).
        </p>

        <div className="space-y-6">
          {apps.map(({ platform, name, storeUrl, storeLabel, steps }) => (
            <div key={name} className="rounded-2xl p-6" style={{ background: '#111827', border: '1px solid rgba(51,65,85,0.5)' }}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: '#94a3b8' }}>
                    {platform}
                  </div>
                  <h2 className="text-lg font-semibold text-slate-100">{name}</h2>
                </div>
                <a
                  href={storeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: 'rgba(6,182,212,0.1)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.2)' }}
                >
                  <ExternalLink size={12} />
                  {storeLabel}
                </a>
              </div>

              <ol className="space-y-2.5">
                {steps.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm text-slate-300">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                      style={{ background: 'rgba(6,182,212,0.15)', color: '#06b6d4' }}
                    >
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl p-6" style={{ background: '#111827', border: '1px solid rgba(51,65,85,0.5)' }}>
          <h2 className="font-semibold text-slate-100 mb-3">Troubleshooting</h2>
          <ul className="space-y-2 text-sm text-slate-400">
            <li>• <strong className="text-slate-200">QR scan imports wrong values</strong> — make sure you scan from the QR Code tab, not a screenshot. Try increasing brightness.</li>
            <li>• <strong className="text-slate-200">Connected but nothing loads</strong> — ensure the app mode is set to "Rule" or "Global", not "Direct".</li>
            <li>• <strong className="text-slate-200">Connection refused</strong> — the user may be paused. Check the Users page in Sepehr.</li>
            <li>• <strong className="text-slate-200">Clash imports proxy but doesn't route</strong> — use the Full Clash Config YAML (not just the proxy block). The YAML includes proxy-groups and rules.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
