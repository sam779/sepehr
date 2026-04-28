import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Wifi } from 'lucide-react';
import { api } from '../lib/api-client.js';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long'),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
});

type FormValues = z.infer<typeof schema>;

export default function Signup() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

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
            {(['email', 'password', 'confirm'] as const).map((field) => (
              <div key={field}>
                <label className="block text-sm font-medium text-slate-300 mb-1.5 capitalize">
                  {field === 'confirm' ? 'Confirm password' : field.charAt(0).toUpperCase() + field.slice(1)}
                </label>
                <input
                  type={field === 'email' ? 'email' : 'password'}
                  autoComplete={field === 'email' ? 'email' : field === 'password' ? 'new-password' : 'new-password'}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: '#1e293b', border: '1px solid rgba(51,65,85,0.8)', color: '#f1f5f9' }}
                  {...register(field)}
                />
                {errors[field] && (
                  <p className="mt-1 text-xs text-red-400">{errors[field]?.message}</p>
                )}
              </div>
            ))}

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
