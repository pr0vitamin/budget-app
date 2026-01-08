import { AppShell } from '@/components/layout';
import { CardSkeleton } from '@/components/ui/Skeleton';

export default function Loading() {
    return (
        <AppShell>
            <div className="p-4">
                {/* Header skeleton */}
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-gray-200 rounded-full animate-pulse"></div>
                    <div>
                        <div className="h-6 bg-gray-200 rounded w-40 mb-2 animate-pulse"></div>
                        <div className="h-4 bg-gray-200 rounded w-48 animate-pulse"></div>
                    </div>
                </div>

                {/* Sections skeleton */}
                <div className="space-y-6">
                    {/* Accounts section */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm">
                        <div className="h-5 bg-gray-200 rounded w-32 mb-4 animate-pulse"></div>
                        <div className="space-y-3">
                            <CardSkeleton />
                            <CardSkeleton />
                        </div>
                    </div>

                    {/* Rules section */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm">
                        <div className="h-5 bg-gray-200 rounded w-40 mb-4 animate-pulse"></div>
                        <div className="space-y-3">
                            <CardSkeleton />
                            <CardSkeleton />
                        </div>
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
