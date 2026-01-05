import { AppShell } from '@/components/layout';

export default function InboxPage() {
    return (
        <AppShell>
            <div className="p-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
                    <span className="text-sm text-gray-500">0 transactions</span>
                </div>

                {/* Empty state */}
                <div className="bg-white rounded-3xl shadow-sm p-8 text-center">
                    <div className="text-6xl mb-4">📬</div>
                    <h2 className="text-lg font-semibold text-gray-800 mb-2">All caught up!</h2>
                    <p className="text-gray-500">
                        Connect your bank to automatically import transactions, or add them manually.
                    </p>
                </div>
            </div>
        </AppShell>
    );
}
