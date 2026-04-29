interface Step {
  number: number;
  title: string;
  body: React.ReactNode;
}

const steps: Step[] = [
  {
    number: 1,
    title: 'V2Box (iPhone / iPad) - recommended',
    body: (
      <ol className="list-decimal list-inside space-y-1.5 text-slate-300 text-sm">
        <li>Open the App Store and install <strong>V2Box</strong></li>
        <li>Tap the <strong>+</strong> button → <strong>Scan QR Code</strong></li>
        <li>Point your camera at the QR code above</li>
        <li>Enable the imported proxy and turn on the VPN toggle</li>
        <li>If V2Box is unavailable in your region, use <strong>Shadowrocket</strong> as fallback</li>
      </ol>
    ),
  },
  {
    number: 2,
    title: 'v2rayNG (Android)',
    body: (
      <ol className="list-decimal list-inside space-y-1.5 text-slate-300 text-sm">
        <li>Install <strong>v2rayNG</strong> from Google Play or GitHub</li>
        <li>Tap <strong>+</strong> → <strong>Import config from QR code</strong></li>
        <li>Scan the QR code above</li>
        <li>Tap the imported config and press the <strong>▶</strong> button to connect</li>
      </ol>
    ),
  },
  {
    number: 3,
    title: 'Clash Verge / Clash Meta (Windows, macOS, Linux)',
    body: (
      <ol className="list-decimal list-inside space-y-1.5 text-slate-300 text-sm">
        <li>Install <strong>Clash Verge</strong> (Windows/macOS) or <strong>Clash Meta</strong></li>
        <li>Go to the <strong>Config</strong> tab → <strong>Import</strong></li>
        <li>Copy the full Clash YAML from the Config tab and save as a <code>.yaml</code> file, then import</li>
        <li>Enable the profile and switch mode to <strong>Rule</strong></li>
      </ol>
    ),
  },
  {
    number: 4,
    title: 'Clash Meta for Android',
    body: (
      <ol className="list-decimal list-inside space-y-1.5 text-slate-300 text-sm">
        <li>Install <strong>Clash Meta for Android</strong> from GitHub releases</li>
        <li>Tap <strong>Profiles</strong> → <strong>New Profile</strong> → <strong>File</strong></li>
        <li>Copy the full Clash YAML from the Config tab, paste it, and save</li>
        <li>Tap the profile to activate, then press the connect button</li>
      </ol>
    ),
  },
];

export default function AppGuide() {
  return (
    <div className="space-y-4">
      {steps.map((step) => (
        <div
          key={step.number}
          className="rounded-xl p-5"
          style={{ background: '#111827', border: '1px solid rgba(51,65,85,0.5)' }}
        >
          <div className="flex items-center gap-3 mb-3">
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: 'rgba(6,182,212,0.15)', color: '#06b6d4' }}
            >
              {step.number}
            </span>
            <h3 className="font-semibold text-slate-100">{step.title}</h3>
          </div>
          {step.body}
        </div>
      ))}
    </div>
  );
}
