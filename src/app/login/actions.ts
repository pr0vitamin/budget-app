'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function sendOtpCode(formData: FormData) {
    const email = formData.get('email') as string;

    if (!email) {
        return { error: 'Email is required' };
    }

    const supabase = await createClient();

    // Remove emailRedirectTo to trigger OTP instead of magic link
    const { error } = await supabase.auth.signInWithOtp({
        email,
    });

    if (error) {
        return { error: error.message };
    }

    return { success: true };
}

export async function verifyOtpCode(email: string, token: string) {
    if (!email || !token) {
        return { error: 'Email and code are required' };
    }

    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
    });

    if (error) {
        // Provide user-friendly error messages
        if (error.message.includes('expired')) {
            return { error: 'Code expired. Please request a new one.' };
        }
        if (error.message.includes('invalid')) {
            return { error: 'Invalid code. Please check and try again.' };
        }
        return { error: error.message };
    }

    return { success: true };
}

export async function signOut() {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect('/login');
}

