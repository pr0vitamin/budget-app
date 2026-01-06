import { ReactNode } from 'react';
import { BottomNav } from './BottomNav';

interface AppShellProps {
    children: ReactNode;
    showNav?: boolean;
    inboxBadgeCount?: number;
}

export function AppShell({ children, showNav = true, inboxBadgeCount = 0 }: AppShellProps) {
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Main content area with bottom padding for nav */}
            <main className={showNav ? 'pb-20' : ''}>{children}</main>

            {/* Bottom navigation */}
            {showNav && <BottomNav inboxBadgeCount={inboxBadgeCount} />}
        </div>
    );
}
