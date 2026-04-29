import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Eye, EyeOff, Wifi } from 'lucide-react';
import { api } from '../lib/api-client.js';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Password must include at least one uppercase letter')
    .regex(/[a-z]/, 'Password must include at least one lowercase letter')
    .regex(/\d/, 'Password must include at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must include at least one special character')
    .max(128, 'Password too long'),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
});

type FormValues = z.infer<typeof schema>;

function passwordChecks(password: string) {
  return {
    length: password.length >= 12,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

function strengthMeta(password: string): { label: string; color: string; width: string } {
  const checks = passwordChecks(password);
  const passed = Object.values(checks).filter(Boolean).length;
  if (password.length === 0) return { label: 'Start typing', color: '#334155', width: '0%' };
  if (passed <= 2) return { label: 'Weak', color: '#ef4444', width: '25%' };
  if (passed === 3) return { label: 'Fair', color: '#f59e0b', width: '50%' };
  if (passed === 4) return { label: 'Good', color: '#22c55e', width: '75%' };
  return { label: 'Strong', color: '#06b6d4', width: '100%' };
}

export default function Signup() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const password = watch('password') ?? '';
  const checks = passwordChecks(password);
  const strength = strengthMeta(password);

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    const res = await api.auth.signup({ email: values.email, password: values.password });
    if (!res.ok) {
      setServerError(res.error);
      return;
    }
    navigate(`/verify-email?email=${encodeURIComponent(values.email)}`);
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
          <h1 className="text-xl font-bold text-slate-100 mb-2">Create your account</h1>
          <p className="text-sm text-slate-400 mb-6">Free — no credit card required</p>

          <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
              <input
                type="email"
                autoComplete="email"
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: '#1e293b', border: '1px solid rgba(51,65,85,0.8)', color: '#f1f5f9' }}
                {...register('email')}
              />
              {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="w-full px-3 py-2.5 pr-10 rounded-lg text-sm outline-none"
                  style={{ background: '#1e293b', border: '1px solid rgba(51,65,85,0.8)', color: '#f1f5f9' }}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-200"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <div className="mt-2 rounded-full h-1.5" style={{ background: '#1f2937' }}>
                <div
                  className="h-1.5 rounded-full transition-all"
                  style={{ width: strength.width, background: strength.color }}
                />
              </div>
              <div className="mt-1 text-xs" style={{ color: strength.color }}>{strength.label}</div>

              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-400">
                <span style={{ color: checks.length ? '#22c55e' : undefined }}>12+ characters</span>
                <span style={{ color: checks.upper ? '#22c55e' : undefined }}>Uppercase</span>
                <span style={{ color: checks.lower ? '#22c55e' : undefined }}>Lowercase</span>
                <span style={{ color: checks.number ? '#22c55e' : undefined }}>Number</span>
                <span style={{ color: checks.special ? '#22c55e' : undefined }}>Special character</span>
              </div>

              {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm password</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="w-full px-3 py-2.5 pr-10 rounded-lg text-sm outline-none"
                  style={{ background: '#1e293b', border: '1px solid rgba(51,65,85,0.8)', color: '#f1f5f9' }}
                  {...register('confirm')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((s) => !s)}
                  className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-200"
                  aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.confirm && <p className="mt-1 text-xs text-red-400">{errors.confirm.message}</p>}
            </div>

            {serverError && (
              <div className="rounded-lg px-3 py-2 text-sm text-red-300" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                {serverError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-lg font-semibold text-sm text-white transition-opacity disabled:opacity-60"
              style={{ background: '#06b6d4' }}
            >
              {isSubmitting ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="font-medium" style={{ color: '#06b6d4' }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
