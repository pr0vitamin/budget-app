import { AppShell } from '@/components/layout';

export default function CalendarPage() {
    // Get current week dates
    const today = new Date();
    const dayOfWeek = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek);

    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        return date;
    });

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        <AppShell>
            <div className="p-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
                    <span className="text-sm text-gray-500">
                        {today.toLocaleDateString('en-NZ', { month: 'long', year: 'numeric' })}
                    </span>
                </div>

                {/* Week view */}
                <div className="bg-white rounded-3xl shadow-sm p-4 mb-4">
                    <div className="grid grid-cols-7 gap-2">
                        {weekDays.map((date, i) => {
                            const isToday = date.toDateString() === today.toDateString();
                            return (
                                <div
                                    key={i}
                                    className={`text-center p-2 rounded-xl ${isToday ? 'bg-indigo-500 text-white' : 'text-gray-600'
                                        }`}
                                >
                                    <div className="text-xs font-medium">{dayNames[i]}</div>
                                    <div className="text-lg font-bold">{date.getDate()}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Empty state for scheduled transactions */}
                <div className="bg-white rounded-3xl shadow-sm p-8 text-center">
                    <div className="text-6xl mb-4">📅</div>
                    <h2 className="text-lg font-semibold text-gray-800 mb-2">No scheduled transactions</h2>
                    <p className="text-gray-500">
                        Add recurring bills and income to see them on your calendar.
                    </p>
                </div>
            </div>
        </AppShell>
    );
}
