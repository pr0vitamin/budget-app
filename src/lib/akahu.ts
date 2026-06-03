/**
 * Akahu API Client for Personal App
 * 
 * Uses direct token authentication (no OAuth needed for personal apps)
 * Docs: https://developers.akahu.nz/docs/personal-apps
 */

const AKAHU_API_BASE = 'https://api.akahu.io/v1';

interface AkahuConfig {
    appToken: string;
    userToken: string;
}

function getConfig(): AkahuConfig {
    const appToken = process.env.AKAHU_APP_TOKEN;
    const userToken = process.env.AKAHU_USER_TOKEN;

    if (!appToken || !userToken) {
        throw new Error('Missing AKAHU_APP_TOKEN or AKAHU_USER_TOKEN environment variables');
    }

    return { appToken, userToken };
}

async function akahuFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const config = getConfig();

    const response = await fetch(`${AKAHU_API_BASE}${endpoint}`, {
        ...options,
        headers: {
            'Authorization': `Bearer ${config.userToken}`,
            'X-Akahu-Id': config.appToken,
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Akahu API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    return data;
}

// Response types based on Akahu API docs
interface AkahuResponse<T> {
    success: boolean;
    item?: T;
    items?: T[];
}

export interface AkahuUser {
    _id: string;
    email: string;
    preferred_name?: string;
    first_name?: string;
    last_name?: string;
}

export interface AkahuAccount {
    _id: string;
    name: string;
    status: 'ACTIVE' | 'INACTIVE';
    type: 'CHECKING' | 'SAVINGS' | 'CREDITCARD' | 'LOAN' | 'INVESTMENT' | 'KIWISAVER' | 'WALLET' | 'OTHER';
    formatted_account?: string;
    balance?: {
        current: number;
        available: number;
        currency: string;
    };
    connection: {
        _id: string;
        name: string;
        logo?: string;
    };
    attributes?: string[];
    refreshed?: {
        balance?: string;
        transactions?: string;
    };
}

export interface AkahuTransaction {
    _id: string;
    _account: string;
    date: string;
    description: string;
    amount: number;
    balance?: number;
    type: 'CREDIT' | 'DEBIT' | 'PAYMENT' | 'TRANSFER' | 'STANDING ORDER' | 'EFTPOS' | 'INTEREST' | 'FEE' | 'TAX' | 'DIRECT DEBIT' | 'DIRECT CREDIT' | 'ATM' | 'LOAN';
    merchant?: {
        _id: string;
        name: string;
    };
    category?: {
        _id: string;
        name: string;
        groups: {
            personal_finance?: {
                _id: string;
                name: string;
            };
        };
    };
    meta?: {
        particulars?: string;
        code?: string;
        reference?: string;
        other_account?: string;
        logo?: string;
    };
    hash?: string;
}

/**
 * Get the authenticated user's profile
 */
export async function getMe(): Promise<AkahuUser> {
    const response = await akahuFetch<AkahuResponse<AkahuUser>>('/me');
    if (!response.item) {
        throw new Error('No user data returned from Akahu');
    }
    return response.item;
}

/**
 * Get all connected accounts
 */
export async function getAccounts(): Promise<AkahuAccount[]> {
    const response = await akahuFetch<AkahuResponse<AkahuAccount>>('/accounts');
    return response.items || [];
}

/**
 * Get a specific account
 */
export async function getAccount(accountId: string): Promise<AkahuAccount> {
    const response = await akahuFetch<AkahuResponse<AkahuAccount>>(`/accounts/${accountId}`);
    if (!response.item) {
        throw new Error(`Account ${accountId} not found`);
    }
    return response.item;
}

/**
 * Get transactions for an account
 * @param accountId - The Akahu account ID
 * @param start - ISO date string for start of range (optional)
 * @param end - ISO date string for end of range (optional)
 */
export async function getTransactions(
    accountId: string,
    start?: string,
    end?: string
): Promise<AkahuTransaction[]> {
    const params = new URLSearchParams();
    if (start) params.set('start', start);
    if (end) params.set('end', end);

    const query = params.toString();
    const endpoint = `/accounts/${accountId}/transactions${query ? `?${query}` : ''}`;

    const response = await akahuFetch<AkahuResponse<AkahuTransaction>>(endpoint);
    return response.items || [];
}

/**
 * Get all transactions across all accounts
 */
export async function getAllTransactions(start?: string, end?: string): Promise<AkahuTransaction[]> {
    const params = new URLSearchParams();
    if (start) params.set('start', start);
    if (end) params.set('end', end);

    const query = params.toString();
    const endpoint = `/transactions${query ? `?${query}` : ''}`;

    const response = await akahuFetch<AkahuResponse<AkahuTransaction>>(endpoint);
    return response.items || [];
}

/**
 * Refresh account data (triggers Akahu to fetch latest from bank)
 * Note: Subject to rate limits. This is asynchronous on Akahu's side.
 */
export async function refreshAccount(accountId: string): Promise<void> {
    await akahuFetch(`/refresh/${accountId}`, { method: 'POST' });
}

/**
 * Trigger a refresh and wait for it to complete by polling the account.
 * Polls until the refreshed.transactions timestamp updates or timeout.
 * 
 * @param accountId - The Akahu account ID
 * @param maxWaitMs - Maximum time to wait for refresh (default 30 seconds)
 * @param pollIntervalMs - Interval between polls (default 2 seconds)
 * @returns Object indicating if refresh completed and any error
 */
export async function refreshAccountAndWait(
    accountId: string,
    maxWaitMs: number = 30000,
    pollIntervalMs: number = 2000
): Promise<{ refreshed: boolean; newTimestamp?: string; error?: string }> {
    // Get current refresh timestamp before triggering
    let initialTimestamp: string | undefined;
    try {
        const account = await getAccount(accountId);
        initialTimestamp = account.refreshed?.transactions;
    } catch (error) {
        // If we can't get the account, proceed anyway
        console.warn('Could not get initial refresh timestamp:', error);
    }

    // Trigger the refresh
    try {
        await refreshAccount(accountId);
    } catch (error) {
        return {
            refreshed: false,
            error: error instanceof Error ? error.message : 'Failed to trigger refresh',
        };
    }

    // Poll for completion
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
        // Wait before polling
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));

        try {
            const account = await getAccount(accountId);
            const currentTimestamp = account.refreshed?.transactions;

            // If timestamp changed (or we didn't have an initial one), refresh is complete
            if (currentTimestamp && currentTimestamp !== initialTimestamp) {
                return { refreshed: true, newTimestamp: currentTimestamp };
            }

            // If no initial timestamp and now we have one, also counts as refreshed
            if (!initialTimestamp && currentTimestamp) {
                return { refreshed: true, newTimestamp: currentTimestamp };
            }
        } catch (error) {
            // Log but continue polling
            console.warn('Error polling for refresh completion:', error);
        }
    }

    // Timeout - but we still triggered the refresh, so transactions might be available
    // Return partial success since the refresh was triggered even if we couldn't confirm
    return {
        refreshed: true, // Proceed with fetching anyway
        error: 'Refresh triggered but confirmation timed out - proceeding with fetch',
    };
}

/**
 * Pending transaction from Akahu
 * Note: These don't have stable IDs and are not enriched
 */
export interface AkahuPendingTransaction {
    _account: string;
    date: string;
    description: string;
    amount: number;
    type: string;
    updated_at: string;
}

/**
 * Get all pending transactions across all accounts
 */
export async function getPendingTransactions(): Promise<AkahuPendingTransaction[]> {
    const response = await akahuFetch<AkahuResponse<AkahuPendingTransaction>>('/transactions/pending');
    return response.items || [];
}
