export function PageSkeleton() {
    return (
        <div className="animate-pulse p-4">
            {/* Header skeleton */}
            <div className="h-8 bg-gray-200 rounded-lg w-1/3 mb-6"></div>

            {/* Content skeletons */}
            <div className="space-y-4">
                <div className="h-24 bg-gray-200 rounded-2xl"></div>
                <div className="h-24 bg-gray-200 rounded-2xl"></div>
                <div className="h-24 bg-gray-200 rounded-2xl"></div>
            </div>
        </div>
    );
}

export function CardSkeleton() {
    return (
        <div className="animate-pulse bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                </div>
            </div>
        </div>
    );
}

export function BucketSkeleton() {
    return (
        <div className="animate-pulse">
            <div className="flex flex-col items-center">
                {/* Cat piggy bank skeleton */}
                <div className="w-20 h-20 bg-gray-200 rounded-full mb-2"></div>
                {/* Label skeleton */}
                <div className="h-3 bg-gray-200 rounded w-16 mb-1"></div>
                {/* Amount skeleton */}
                <div className="h-4 bg-gray-200 rounded w-12"></div>
            </div>
        </div>
    );
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
    return (
        <div className="space-y-3">
            {Array.from({ length: count }).map((_, i) => (
                <CardSkeleton key={i} />
            ))}
        </div>
    );
}
