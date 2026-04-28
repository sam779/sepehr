import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Wifi } from 'lucide-react';
import { api } from '../lib/api-client.js';
import { useQueryClient } from '@tanstack/react-query';

const schema = z.object({
  code: z.string().length(6, 'Code must be 6 digits').regex(/^\d+$/, 'Digits only'),
});

type FormValues = z.infer<typeof schema>;

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const email = params.get('email') ?? '';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    const res = await api.auth.verifyEmail({ email, code: values.code });
    if (!res.ok) {
      setServerError(res.error);
      return;
    }
    qc.setQueryData(['me'], res.data);
    navigate('/dashboard');
  };

  const resend = async () => {
    setResent(false);
    await api.auth.resendVerification({ email });
    setResent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0a0f1e' }}>
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#06b6d4' }}>
            <Wifi size={16} className="text-white" />
          </div>
          <span className="font-semibold text-slate-100 text-lg">Sepehr</span>
        </div>

        <div className="rounded-2xl p-8" style={{ background: '#111827', border: '1px solid rgba(51,65,85,0.5)' }}>
          <h1 className="text-xl font-bold text-slate-100 mb-2">Verify your email</h1>
          <p className="text-sm text-slate-400 mb-6">
            We sent a 6-digit code to <strong className="text-slate-200">{email}</strong>
          </p>

          <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Verification code</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                className="w-full px-3 py-3 rounded-lg text-2xl text-center font-mono tracking-widest outline-none"
                style={{ background: '#1e293b', border: '1px solid rgba(51,65,85,0.8)', color: '#f1f5f9' }}
                {...register('code')}
              />
              {errors.code && (
                <p className="mt-1 text-xs text-red-400">{errors.code.message}</p>
              )}
            </div>

            {serverError && (
              <div className="rounded-lg px-3 py-2 text-sm text-red-300" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                {serverError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-lg font-semibold text-sm text-white disabled:opacity-60"
              style={{ background: '#06b6d4' }}
            >
              {isSubmitting ? 'Verifying…' : 'Verify email'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => void resend()}
              className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
            >
              Resend code
            </button>
            {resent && <p className="text-xs mt-1" style={{ color: '#0d9488' }}>Code resent!</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
