import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle, Circle, ExternalLink, Loader } from 'lucide-react';
import { useRelay } from '../hooks/useRelay.js';

const schema = z.object({
  cfAccountId: z.string().min(1, 'Account ID is required'),
  cfApiToken: z.string().min(1, 'API token is required'),
});
type FormValues = z.infer<typeof schema>;

const CF_TOKEN_PERMS =
  'Workers Scripts: Edit, Account Settings: Read';

const steps = [
  'Create API token',
  'Enter credentials',
  'Deploy relay',
  'Done!',
];

export default function Setup() {
  const [step, setStep] = useState(0);
  const [deployError, setDeployError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { deploy, relay } = useRelay();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  if (relay) {
    // Already deployed
    return (
      <div className="p-8 max-w-2xl">
        <h1 className="text-2xl font-bold text-slate-100 mb-2">Relay Deployed</h1>
        <p className="text-slate-400 mb-6">Your relay is already running at:</p>
        <div className="rounded-xl p-4 mb-6 font-mono text-sm" style={{ background: '#111827', border: '1px solid rgba(51,65,85,0.5)', color: '#06b6d4' }}>
          {relay.workerUrl}
        </div>
        <button
          onClick={() => navigate('/users')}
          className="px-6 py-2.5 rounded-xl font-semibold text-sm text-white"
          style={{ background: '#06b6d4' }}
        >
          Manage family members →
        </button>
      </div>
    );
  }

  const onSubmit = async (values: FormValues) => {
    setDeployError(null);
    setStep(2);
    try {
      await deploy.mutateAsync(values);
      setStep(3);
    } catch (err) {
      setDeployError(err instanceof Error ? err.message : 'Deployment failed');
      setStep(1);
    }
  };

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100">Deploy Your Relay</h1>
        <p className="text-slate-400 mt-1">
          Your relay runs on your own free Cloudflare account.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-10">
        {steps.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              {i < step ? (
                <CheckCircle size={20} style={{ color: '#0d9488' }} />
              ) : i === step ? (
                <Circle size={20} style={{ color: '#06b6d4' }} />
              ) : (
                <Circle size={20} style={{ color: '#334155' }} />
              )}
              <span className={`text-sm ${i <= step ? 'text-slate-100' : 'text-slate-500'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="w-8 h-px mx-1" style={{ background: i < step ? '#0d9488' : '#334155' }} />
            )}
          </div>
        ))}
      </div>

      {/* Step 0: Create API token guide */}
      {step === 0 && (
        <div className="space-y-6">
          <div className="rounded-2xl p-6" style={{ background: '#111827', border: '1px solid rgba(51,65,85,0.5)' }}>
            <h2 className="font-semibold text-slate-100 mb-4">Step 1 — Create a Cloudflare API token</h2>
            <ol className="space-y-3 text-sm text-slate-300">
              <li className="flex gap-3">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: 'rgba(6,182,212,0.15)', color: '#06b6d4' }}>1</span>
                <span>
                  Go to{' '}
                  <a
                    href="https://dash.cloudflare.com/profile/api-tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium"
                    style={{ color: '#06b6d4' }}
                  >
                    Cloudflare API Tokens
                    <ExternalLink size={12} />
                  </a>
                </span>
              </li>
              <li className="flex gap-3">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: 'rgba(6,182,212,0.15)', color: '#06b6d4' }}>2</span>
                <span>Click <strong>Create Token</strong> → <strong>Create Custom Token</strong></span>
              </li>
              <li className="flex gap-3">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: 'rgba(6,182,212,0.15)', color: '#06b6d4' }}>3</span>
                <span>
                  Add these permissions:{' '}
                  <code className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#1e293b', color: '#e2e8f0' }}>
                    {CF_TOKEN_PERMS}
                  </code>
                </span>
              </li>
              <li className="flex gap-3">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: 'rgba(6,182,212,0.15)', color: '#06b6d4' }}>4</span>
                <span>Copy the token (shown only once)</span>
              </li>
              <li className="flex gap-3">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: 'rgba(6,182,212,0.15)', color: '#06b6d4' }}>5</span>
                <span>
                  Your Account ID is in the URL:{' '}
                  <code className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#1e293b', color: '#e2e8f0' }}>
                    dash.cloudflare.com/<strong>ACCOUNT_ID</strong>/workers
                  </code>
                </span>
              </li>
            </ol>
          </div>

          <button
            onClick={() => setStep(1)}
            className="px-6 py-2.5 rounded-xl font-semibold text-sm text-white"
            style={{ background: '#06b6d4' }}
          >
            I have my token →
          </button>
        </div>
      )}

      {/* Step 1: Enter credentials */}
      {step === 1 && (
        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-5">
          <div className="rounded-2xl p-6" style={{ background: '#111827', border: '1px solid rgba(51,65,85,0.5)' }}>
            <h2 className="font-semibold text-slate-100 mb-5">Step 2 — Enter your Cloudflare credentials</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Account ID
                </label>
                <input
                  type="text"
                  placeholder="a1b2c3d4e5f6..."
                  className="w-full px-3 py-2.5 rounded-lg text-sm font-mono outline-none"
                  style={{ background: '#1e293b', border: '1px solid rgba(51,65,85,0.8)', color: '#f1f5f9' }}
                  {...register('cfAccountId')}
                />
                {errors.cfAccountId && (
                  <p className="mt-1 text-xs text-red-400">{errors.cfAccountId.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  API Token
                </label>
                <input
                  type="password"
                  placeholder="Paste your API token"
                  className="w-full px-3 py-2.5 rounded-lg text-sm font-mono outline-none"
                  style={{ background: '#1e293b', border: '1px solid rgba(51,65,85,0.8)', color: '#f1f5f9' }}
                  {...register('cfApiToken')}
                />
                {errors.cfApiToken && (
                  <p className="mt-1 text-xs text-red-400">{errors.cfApiToken.message}</p>
                )}
              </div>
            </div>
          </div>

          {deployError && (
            <div className="rounded-xl px-4 py-3 text-sm text-red-300" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              {deployError}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(0)}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors"
              style={{ border: '1px solid rgba(51,65,85,0.5)' }}
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white disabled:opacity-60"
              style={{ background: '#06b6d4' }}
            >
              {isSubmitting ? 'Validating…' : 'Deploy relay →'}
            </button>
          </div>
        </form>
      )}

      {/* Step 2: Deploying */}
      {step === 2 && (
        <div className="flex flex-col items-center gap-6 py-12">
          <Loader size={40} className="animate-spin" style={{ color: '#06b6d4' }} />
          <div className="text-center">
            <h2 className="font-semibold text-slate-100 mb-2">Deploying your relay…</h2>
            <p className="text-slate-400 text-sm">Validating credentials, uploading Worker, enabling subdomain</p>
          </div>
        </div>
      )}

      {/* Step 3: Done */}
      {step === 3 && (
        <div className="flex flex-col items-center gap-6 py-8 text-center">
          <CheckCircle size={48} style={{ color: '#0d9488' }} />
          <div>
            <h2 className="text-xl font-bold text-slate-100 mb-2">Relay deployed!</h2>
            <p className="text-slate-400 text-sm">
              Your relay is live. Now add your first family member.
            </p>
          </div>
          <button
            onClick={() => navigate('/users')}
            className="px-8 py-3 rounded-xl font-semibold text-sm text-white"
            style={{ background: '#06b6d4' }}
          >
            Add first family member →
          </button>
        </div>
      )}
    </div>
  );
}
