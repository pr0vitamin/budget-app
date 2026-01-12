import { AppShell } from '@/components/layout';
import { BucketSkeleton } from '@/components/ui/Skeleton';

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
                    <div className="text-right">
                        <div className="h-3 bg-gray-200 rounded w-24 mb-1 animate-pulse"></div>
                        <div className="h-6 bg-gray-200 rounded w-20 animate-pulse"></div>
                    </div>
                </div>

                {/* Group skeletons */}
                <div className="space-y-4">
                    {[1, 2].map((group) => (
                        <div key={group} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                            {/* Group header */}
                            <div className="px-4 py-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="h-5 bg-gray-200 rounded w-32 animate-pulse"></div>
                                    <div className="h-4 bg-gray-200 rounded w-8 animate-pulse"></div>
                                </div>
                                <div className="h-5 bg-gray-200 rounded w-20 animate-pulse"></div>
                            </div>
                            {/* Cats grid */}
                            <div className="px-4 pb-4">
                                <div className="grid grid-cols-3 gap-4">
                                    <BucketSkeleton />
                                    <BucketSkeleton />
                                    <BucketSkeleton />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </AppShell>
    );
}
