'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export async function sendMagicLink(formData: FormData) {
    const email = formData.get('email') as string;

    if (!email) {
        return { error: 'Email is required' };
    }

    // Get the origin from the request headers
    const headersList = await headers();
    const host = headersList.get('host');
    const protocol = headersList.get('x-forwarded-proto') || 'https';
    const origin = `${protocol}://${host}`;

    const supabase = await createClient();

    const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
            emailRedirectTo: `${origin}/auth/callback`,
        },
    });

    if (error) {
        return { error: error.message };
    }

    return { success: true };
}

export async function signOut() {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect('/login');
}
