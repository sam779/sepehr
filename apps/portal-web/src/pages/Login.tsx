import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Eye, EyeOff, Wifi } from 'lucide-react';
import { api } from '../lib/api-client.js';
import { useQueryClient } from '@tanstack/react-query';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type FormValues = z.infer<typeof schema>;

export default function Login() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    const res = await api.auth.login(values);
    if (!res.ok) {
      setServerError(res.error);
      return;
    }
    qc.setQueryData(['me'], res.data);
    navigate('/dashboard');
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
          <h1 className="text-xl font-bold text-slate-100 mb-6">Sign in to your account</h1>

          <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
              <input
                type="email"
                autoComplete="email"
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-colors"
                style={{
                  background: '#1e293b',
                  border: '1px solid rgba(51,65,85,0.8)',
                  color: '#f1f5f9',
                }}
                {...register('email')}
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="w-full px-3 py-2.5 pr-10 rounded-lg text-sm outline-none"
                  style={{
                    background: '#1e293b',
                    border: '1px solid rgba(51,65,85,0.8)',
                    color: '#f1f5f9',
                  }}
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
              {errors.password && (
                <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
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
              className="w-full py-2.5 rounded-lg font-semibold text-sm text-white transition-opacity disabled:opacity-60"
              style={{ background: '#06b6d4' }}
            >
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            No account?{' '}
            <Link to="/signup" className="font-medium" style={{ color: '#06b6d4' }}>
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
