import React, { useState } from 'react';
import { ShieldCheck, Mail, ArrowRight, Loader2, Lock, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AccessGateProps {
  onVerified: (email: string) => void;
}

export default function AccessGate({ onVerified }: AccessGateProps) {
  const [email, setEmail] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsVerifying(true);
    setError(null);

    try {
      const response = await fetch('/api/verify-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data.success) {
        // Save to session storage to persist refresh in current session
        sessionStorage.setItem('access_email', email);
        onVerified(email);
      } else {
        setError(data.message || 'Verification failed');
      }
    } catch (err) {
      setError('连接服务器失败，请检查网络连接。');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 selection:bg-purple-100 selection:text-purple-900 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <div className="bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden relative">
          {/* Decorative background elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-full blur-3xl -mr-16 -mt-16 opacity-50" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-50 rounded-full blur-3xl -ml-16 -mb-16 opacity-50" />
          
          <div className="p-8 sm:p-10 relative">
            <div className="flex flex-col items-center text-center mb-10">
              <div className="w-16 h-16 bg-purple-600 rounded-2xl flex items-center justify-center shadow-[0_10px_20px_rgba(147,51,234,0.3)] mb-6 transform -rotate-3 hover:rotate-0 transition-transform duration-300">
                <Lock className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-3">
                版权保护中心
              </h1>
              <p className="text-gray-500 text-sm leading-relaxed max-w-[280px]">
                该系统受版权保护，请输入授权邮箱以继续访问。
              </p>
            </div>

            <form onSubmit={handleVerify} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="email" className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">
                  授权邮箱
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="w-5 h-5 text-gray-400 group-focus-within:text-purple-600 transition-colors" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-transparent rounded-2xl text-gray-900 text-sm focus:bg-white focus:border-purple-600 focus:ring-0 outline-none transition-all duration-300 placeholder:text-gray-300"
                  />
                </div>
              </div>

              <AnimatePresence mode="wait">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-4 bg-red-50 rounded-xl border border-red-100 flex items-start gap-3"
                  >
                    <ShieldCheck className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700 font-medium leading-normal">
                      {error}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={isVerifying || !email}
                className="w-full py-4 bg-gray-900 hover:bg-black text-white rounded-2xl font-bold text-sm tracking-wide shadow-[0_10px_20px_rgba(0,0,0,0.1)] hover:shadow-[0_15px_30px_rgba(0,0,0,0.2)] disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 flex items-center justify-center gap-2 group"
              >
                {isVerifying ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    验证并进入系统
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-10 pt-8 border-t border-gray-50 flex items-center justify-center gap-6">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Secure Access
                </span>
              </div>
              <div className="w-1 h-1 bg-gray-200 rounded-full" />
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Copyright Protected
                </span>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center mt-8 text-gray-400 text-[10px] font-medium uppercase tracking-[0.2em]">
          Land Use Analysis System v2.0 • © 2026
        </p>
      </motion.div>
    </div>
  );
}
