import { AppShell } from '@/components/layout';
import { CardSkeleton } from '@/components/ui/Skeleton';

export default function Loading() {
    return (
        <AppShell>
            <div className="p-4">
                {/* Header skeleton */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <div className="h-8 bg-gray-200 rounded-lg w-24 mb-2 animate-pulse"></div>
                        <div className="h-4 bg-gray-200 rounded w-40 animate-pulse"></div>
                    </div>
                    <div className="h-10 bg-gray-200 rounded-lg w-20 animate-pulse"></div>
                </div>

                {/* Filter tabs skeleton */}
                <div className="flex gap-2 mb-4">
                    <div className="h-10 bg-gray-200 rounded-full w-24 animate-pulse"></div>
                    <div className="h-10 bg-gray-200 rounded-full w-32 animate-pulse"></div>
                </div>

                {/* Transaction list skeleton */}
                <div className="space-y-3">
                    <CardSkeleton />
                    <CardSkeleton />
                    <CardSkeleton />
                    <CardSkeleton />
                    <CardSkeleton />
                </div>
            </div>
        </AppShell>
    );
}
