import { AppShell } from '@/components/layout';
import { CardSkeleton } from '@/components/ui/Skeleton';

export default function Loading() {
    return (
        <AppShell>
            <div className="p-4">
                {/* Header skeleton */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <div className="h-8 bg-gray-200 rounded-lg w-32 mb-2 animate-pulse"></div>
                        <div className="h-4 bg-gray-200 rounded w-48 animate-pulse"></div>
                    </div>
                    <div className="h-10 bg-gray-200 rounded-lg w-10 animate-pulse"></div>
                </div>

                {/* Scheduled transactions skeleton */}
                <div className="space-y-3">
                    <CardSkeleton />
                    <CardSkeleton />
                    <CardSkeleton />
                    <CardSkeleton />
                </div>
            </div>
        </AppShell>
    );
}
