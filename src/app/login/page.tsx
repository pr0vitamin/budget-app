'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { sendOtpCode, verifyOtpCode } from './actions';

type Step = 'email' | 'otp';

export default function LoginPage() {
    const router = useRouter();
    const [step, setStep] = useState<Step>('email');
    const [email, setEmail] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [resendCooldown, setResendCooldown] = useState(0);
    const otpInputRef = useRef<HTMLInputElement>(null);

    // Handle resend cooldown timer
    useEffect(() => {
        if (resendCooldown > 0) {
            const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendCooldown]);

    // Focus OTP input when switching to OTP step
    useEffect(() => {
        if (step === 'otp' && otpInputRef.current) {
            otpInputRef.current.focus();
        }
    }, [step]);

    async function handleSendCode(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);

        const formData = new FormData();
        formData.append('email', email);

        const result = await sendOtpCode(formData);

        if (result.error) {
            setMessage({ type: 'error', text: result.error });
        } else {
            setStep('otp');
            setResendCooldown(60);
            setMessage({ type: 'success', text: 'Check your email for the 8-digit code!' });
        }

        setIsLoading(false);
    }

    async function handleVerifyCode(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);

        const result = await verifyOtpCode(email, otpCode);

        if (result.error) {
            setMessage({ type: 'error', text: result.error });
            setIsLoading(false);
        } else {
            // Success! Redirect to home
            router.push('/');
            router.refresh();
        }
    }

    async function handleResendCode() {
        if (resendCooldown > 0) return;

        setIsLoading(true);
        setMessage(null);

        const formData = new FormData();
        formData.append('email', email);

        const result = await sendOtpCode(formData);

        if (result.error) {
            setMessage({ type: 'error', text: result.error });
        } else {
            setResendCooldown(60);
            setOtpCode('');
            setMessage({ type: 'success', text: 'New code sent!' });
        }

        setIsLoading(false);
    }

    function handleBackToEmail() {
        setStep('email');
        setOtpCode('');
        setMessage(null);
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-4">
            <div className="w-full max-w-md">
                {/* Logo/Brand */}
                <div className="text-center mb-8">
                    <div className="inline-block p-4 bg-white/10 backdrop-blur-lg rounded-3xl mb-4">
                        <span className="text-6xl">🐱</span>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">Cat Budget</h1>
                    <p className="text-white/80">The fluffiest money manager around</p>
                </div>

                {/* Login Card */}
                <div className="bg-white/95 backdrop-blur-lg rounded-3xl shadow-2xl p-8">
                    {step === 'email' ? (
                        <>
                            <h2 className="text-2xl font-semibold text-gray-800 mb-2">Welcome back</h2>
                            <p className="text-gray-600 mb-6">
                                Enter your email and we&apos;ll send you a code to sign in.
                            </p>

                            <form onSubmit={handleSendCode} className="space-y-4">
                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                                        Email address
                                    </label>
                                    <input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="you@example.com"
                                        required
                                        disabled={isLoading}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading || !email}
                                    className="w-full py-3 px-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold rounded-xl hover:from-indigo-600 hover:to-purple-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            Sending...
                                        </span>
                                    ) : (
                                        'Send Code'
                                    )}
                                </button>
                            </form>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center gap-2 mb-2">
                                <button
                                    onClick={handleBackToEmail}
                                    className="text-gray-500 hover:text-gray-700 transition-colors"
                                    title="Change email"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                                <h2 className="text-2xl font-semibold text-gray-800">Enter code</h2>
                            </div>
                            <p className="text-gray-600 mb-6">
                                We sent an 8-digit code to <span className="font-medium">{email}</span>
                            </p>

                            <form onSubmit={handleVerifyCode} className="space-y-4">
                                <div>
                                    <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1">
                                        8-digit code
                                    </label>
                                    <input
                                        ref={otpInputRef}
                                        id="otp"
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        maxLength={8}
                                        value={otpCode}
                                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                                        placeholder="00000000"
                                        required
                                        disabled={isLoading}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed text-center text-2xl tracking-[0.5em] font-mono"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading || otpCode.length !== 8}
                                    className="w-full py-3 px-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold rounded-xl hover:from-indigo-600 hover:to-purple-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            Verifying...
                                        </span>
                                    ) : (
                                        'Sign In'
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={handleResendCode}
                                    disabled={resendCooldown > 0 || isLoading}
                                    className="w-full py-2 text-sm text-indigo-600 hover:text-indigo-700 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                                >
                                    {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
                                </button>
                            </form>
                        </>
                    )}

                    {/* Messages */}
                    {message && (
                        <div
                            className={`mt-4 p-4 rounded-xl ${message.type === 'success'
                                ? 'bg-green-50 text-green-700 border border-green-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                                }`}
                        >
                            {message.text}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <p className="text-center text-white/60 text-sm mt-6">
                    No account? Don&apos;t worry, we&apos;ll create one for you.
                </p>
            </div>
        </div>
    );
}
