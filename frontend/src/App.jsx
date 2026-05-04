import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Chart from "chart.js/auto";
import { jsPDF } from "jspdf";
import {
    BrowserRouter,
    NavLink,
    Navigate,
    Route,
    Routes,
    useLocation
} from "react-router-dom";
import {
    clearStoredToken,
    createMember,
    fetchCheckIns,
    fetchMembers,
    getStoredToken,
    logCheckIn,
    loginOwner,
    storeToken
} from "./api/client";

const PRICE_MONTHLY = 500;
const PRICE_SESSION = 45;
const GYM_OPEN_HOUR = 6;
const GYM_CLOSE_HOUR = 22;

const tabsLeft = [
    { label: "Home", path: "/home", icon: "home" },
    { label: "Members", path: "/members", icon: "members" }
];

const tabsRight = [
    { label: "Insights", path: "/insights", icon: "insights" },
    { label: "Finance", path: "/finance", icon: "finance" }
];

const NAV_ICONS = {
    home: (
        <>
            <path d="M3.5 9.5 12 3l8.5 6.5" />
            <path d="M6.5 8.8V20h11V8.8" />
        </>
    ),
    members: (
        <>
            <circle cx="9" cy="8.5" r="2.5" />
            <path d="M4.5 19c0-3 2.2-5 4.5-5s4.5 2 4.5 5" />
            <circle cx="16.8" cy="9.2" r="2" />
            <path d="M14.2 18.8c.2-2 1.6-3.7 3.8-4" />
        </>
    ),
    insights: (
        <>
            <rect x="3.5" y="4" width="17" height="16" rx="2" />
            <path d="M7 15.5 10 12l2.5 2 4-4" />
        </>
    ),
    finance: (
        <>
            <path d="M4 18h16" />
            <path d="M7 15V9M12 15V6M17 15v-3" />
        </>
    ),
    add: (
        <>
            <path d="M12 5v14M5 12h14" />
        </>
    )
};

const NavIcon = ({ name }) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="tab-icon">
        {NAV_ICONS[name]}
    </svg>
);

const pesoFormatter = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0
});

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric"
});

const fullDateFormatter = new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric"
});

const monthYearFormatter = new Intl.DateTimeFormat("en-PH", {
    month: "long",
    year: "numeric"
});

const formatCurrencyForPdf = (amount) => {
    const numeric = Number(amount);
    const safe = Number.isFinite(numeric) ? numeric : 0;
    return `PHP ${safe.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
};

const normalizeMembershipType = (value) => {
    const text = String(value || "").trim().toLowerCase();
    if (text.includes("session")) return "session";
    return "monthly";
};

const getDateKey = (checkIn) => {
    if (checkIn?.check_in_date) return String(checkIn.check_in_date).slice(0, 10);
    if (checkIn?.created_at) return String(checkIn.created_at).slice(0, 10);
    return "";
};

const getHourFromCheckIn = (checkIn) => {
    const source = String(checkIn?.check_in_time || "").split(":")[0];
    const hour = Number(source);
    if (Number.isFinite(hour) && hour >= 0 && hour <= 23) return hour;

    const fallback = new Date(checkIn?.created_at || "").getHours();
    return Number.isFinite(fallback) ? fallback : 0;
};

const isWithinGymHours = (hour) => Number(hour) >= GYM_OPEN_HOUR && Number(hour) <= GYM_CLOSE_HOUR;

const formatHourAmPm = (hour) => {
    if (!Number.isFinite(hour)) return "-";
    const period = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:00 ${period}`;
};

const formatTimeAmPm = (timeValue) => {
    const parts = String(timeValue || "").split(":");
    const hh = Number(parts[0] || 0);
    const mm = Number(parts[1] || 0);
    const period = hh >= 12 ? "PM" : "AM";
    const hour12 = hh % 12 || 12;
    return `${hour12}:${String(mm).padStart(2, "0")} ${period}`;
};

const getMonthLabel = (input) => {
    const date = new Date(input);
    if (!Number.isFinite(date.getTime())) return "-";
    return monthYearFormatter.format(date);
};

const monthsBack = (offset = 0) => {
    const date = new Date();
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    date.setMonth(date.getMonth() - offset);
    return date;
};

const monthKeyOf = (input) => {
    const date = new Date(input);
    if (!Number.isFinite(date.getTime())) return "";
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    return `${yyyy}-${mm}`;
};

const isoDate = (dateInput) => {
    const date = new Date(dateInput);
    if (!Number.isFinite(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
};

const startOfWeek = (dateInput) => {
    const date = new Date(dateInput);
    if (!Number.isFinite(date.getTime())) return new Date();
    const day = date.getDay();
    const diff = (day + 6) % 7;
    date.setDate(date.getDate() - diff);
    date.setHours(0, 0, 0, 0);
    return date;
};

const hoursInRange = Array.from(
    { length: GYM_CLOSE_HOUR - GYM_OPEN_HOUR + 1 },
    (_, index) => GYM_OPEN_HOUR + index
);

const getRevenueValue = (checkIn) => {
    const raw = Number(checkIn?.payment_amount);
    if (Number.isFinite(raw) && raw >= 0) return raw;

    const type = normalizeMembershipType(checkIn?.members?.membership_type);
    if (type === "session") return PRICE_SESSION;
    return PRICE_MONTHLY;
};

const addDays = (dateInput, days) => {
    const date = new Date(dateInput);
    date.setDate(date.getDate() + days);
    return date;
};

const addOneCalendarMonth = (dateInput) => {
    const date = new Date(dateInput);
    date.setMonth(date.getMonth() + 1);
    return date;
};

const CountUpValue = ({
    value,
    formatter = (number) => String(Math.round(number)),
    duration = 900,
    loading = false
}) => {
    const [displayValue, setDisplayValue] = useState(0);
    const frameRef = useRef(0);

    useEffect(() => {
        if (loading) {
            setDisplayValue(0);
            return undefined;
        }

        const target = Number.isFinite(Number(value)) ? Number(value) : 0;
        if (target <= 0) {
            setDisplayValue(0);
            return undefined;
        }

        const start = target >= 1 ? 1 : 0;
        const startTime = performance.now();
        const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

        const step = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = easeOutCubic(progress);
            const current = start + (target - start) * eased;
            setDisplayValue(current);

            if (progress < 1) {
                frameRef.current = requestAnimationFrame(step);
            }
        };

        frameRef.current = requestAnimationFrame(step);
        return () => cancelAnimationFrame(frameRef.current);
    }, [duration, loading, value]);

    return formatter(displayValue);
};

const TrendChart = ({ labels, values, mode = "line", theme = "dark" }) => {
    const canvasRef = useRef(null);
    const chartRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return undefined;

        const ctx = canvas.getContext("2d");
        if (!ctx) return undefined;

        if (chartRef.current) {
            chartRef.current.destroy();
        }

        const isLight = theme === "light";
        const tickColor = isLight ? "#3f4655" : "#ccd2dc";
        const gridColor = isLight ? "rgba(31,36,46,0.12)" : "rgba(255,255,255,0.08)";

        const gradient = ctx.createLinearGradient(0, 0, 0, 260);
        gradient.addColorStop(0, "rgba(233, 72, 88, 0.52)");
        gradient.addColorStop(1, "rgba(233, 72, 88, 0.04)");

        chartRef.current = new Chart(ctx, {
            type: mode,
            data: {
                labels,
                datasets: [
                    {
                        data: values,
                        borderColor: "#f05064",
                        backgroundColor: gradient,
                        fill: true,
                        borderWidth: 2,
                        tension: 0.35,
                        pointRadius: 2,
                        pointHoverRadius: 4,
                        pointBackgroundColor: "#ffd2d8"
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => pesoFormatter.format(context.parsed.y || 0)
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: tickColor, maxRotation: 0 },
                        grid: { color: gridColor }
                    },
                    y: {
                        ticks: {
                            color: tickColor,
                            callback: (value) => pesoFormatter.format(value)
                        },
                        grid: { color: gridColor }
                    }
                }
            }
        });

        return () => {
            if (chartRef.current) {
                chartRef.current.destroy();
                chartRef.current = null;
            }
        };
    }, [labels, values, mode, theme]);

    return <canvas className="chart-canvas" ref={canvasRef} role="img" aria-label="Revenue chart" />;
};

const BarChart = ({
    labels,
    values,
    ariaLabel = "Bar chart",
    valueFormatter = (value) => pesoFormatter.format(value),
    theme = "dark"
}) => {
    const canvasRef = useRef(null);
    const chartRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return undefined;

        const ctx = canvas.getContext("2d");
        if (!ctx) return undefined;

        if (chartRef.current) {
            chartRef.current.destroy();
        }

        const isLight = theme === "light";
        const tickColor = isLight ? "#3f4655" : "#c4c4ce";
        const gridColor = isLight ? "rgba(31,36,46,0.12)" : "rgba(255,255,255,0.06)";

        chartRef.current = new Chart(ctx, {
            type: "bar",
            data: {
                labels,
                datasets: [
                    {
                        data: values,
                        backgroundColor: "rgba(223, 11, 24, 0.82)",
                        borderColor: "#df0b18",
                        borderWidth: 1.5,
                        borderRadius: 6,
                        maxBarThickness: 32
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => valueFormatter(context.parsed.y || 0)
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: gridColor },
                        ticks: { color: tickColor }
                    },
                    y: {
                        grid: { color: gridColor },
                        ticks: {
                            color: tickColor,
                            callback: (value) => valueFormatter(value)
                        }
                    }
                }
            }
        });

        return () => {
            if (chartRef.current) {
                chartRef.current.destroy();
                chartRef.current = null;
            }
        };
    }, [labels, values, valueFormatter, theme]);

    return <canvas className="chart-canvas" ref={canvasRef} role="img" aria-label={ariaLabel} />;
};

const DoughnutChart = ({ labels, values, ariaLabel = "Doughnut chart", theme = "dark" }) => {
    const canvasRef = useRef(null);
    const chartRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return undefined;

        const ctx = canvas.getContext("2d");
        if (!ctx) return undefined;

        if (chartRef.current) {
            chartRef.current.destroy();
        }

        const isLight = theme === "light";

        chartRef.current = new Chart(ctx, {
            type: "doughnut",
            data: {
                labels,
                datasets: [
                    {
                        data: values,
                        backgroundColor: ["#df0b18", "#f5f5f7"],
                        borderColor: "#0b0b0f",
                        borderWidth: 2,
                        hoverOffset: 8
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: {
                            color: isLight ? "#2f3644" : "#d9d9e2",
                            boxWidth: 12,
                            padding: 12
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.label}: ${context.parsed}`
                        }
                    }
                }
            }
        });

        return () => {
            if (chartRef.current) {
                chartRef.current.destroy();
                chartRef.current = null;
            }
        };
    }, [labels, values, theme]);

    return <canvas className="chart-canvas" ref={canvasRef} role="img" aria-label={ariaLabel} />;
};

const LoginScreen = ({ onLogin, error, loading }) => {
    const [email, setEmail] = useState("admin@wynfitness.com");
    const [password, setPassword] = useState("admin12345");

    const submit = async (event) => {
        event.preventDefault();
        await onLogin({ email, password });
    };

    return (
        <div className="login-page">
            <form className="login-card" onSubmit={submit}>
                <p className="login-kicker">WYN FITNESS</p>
                <h1>Gym Tracker</h1>
                <p className="login-subtitle">Mobile-first admin portal for members, revenue, and peak hours.</p>

                <label htmlFor="email">Email</label>
                <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                />

                <label htmlFor="password">Password</label>
                <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                />

                {error ? <p className="form-error">{error}</p> : null}

                <button type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button>
            </form>
        </div>
    );
};

const HomePage = ({ members, checkIns, loading, theme }) => {
    const [range, setRange] = useState("30d");
    const [activeMetric, setActiveMetric] = useState("");
    const [detailsModal, setDetailsModal] = useState("");

    const coachGreeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good Morning, Coach";
        if (hour < 18) return "Good Afternoon, Coach";
        return "Good Evening, Coach";
    }, []);

    const dataRange = useMemo(() => {
        const keys = checkIns
            .map((item) => getDateKey(item))
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));

        const latest = keys.length ? new Date(`${keys[keys.length - 1]}T00:00:00`) : new Date();
        const earliest = keys.length ? new Date(`${keys[0]}T00:00:00`) : new Date();

        return { latest, earliest };
    }, [checkIns]);

    const rangeMeta = useMemo(() => {
        const rangeDays = range === "7d" ? 7 : range === "30d" ? 30 : 30;
        const windowLabel = range === "7d" ? "vs previous 7 days" : range === "30d" ? "vs previous 30 days" : "last 30d vs prev 30d";

        return {
            rangeDays,
            startDate: range === "all" ? dataRange.earliest : addDays(dataRange.latest, -(rangeDays - 1)),
            endDate: dataRange.latest,
            windowLabel
        };
    }, [range, dataRange]);

    const filteredCheckIns = useMemo(() => {
        return checkIns.filter((item) => {
            const dateKey = getDateKey(item);
            if (!dateKey) return false;
            if (!isWithinGymHours(getHourFromCheckIn(item))) return false;

            const date = new Date(`${dateKey}T00:00:00`);
            if (rangeMeta.startDate && date < rangeMeta.startDate) return false;
            if (date > rangeMeta.endDate) return false;
            return true;
        });
    }, [checkIns, rangeMeta]);

    const allTimeCheckIns = useMemo(() => {
        return checkIns.filter((item) => {
            const dateKey = getDateKey(item);
            if (!dateKey) return false;
            return isWithinGymHours(getHourFromCheckIn(item));
        });
    }, [checkIns]);

    const dashboard = useMemo(() => {
        const totalRevenue = filteredCheckIns.reduce((sum, item) => sum + getRevenueValue(item), 0);
        const transactions = filteredCheckIns.length;

        const trendDailyRevenue = new Map();

        filteredCheckIns.forEach((item) => {
            const dateKey = getDateKey(item);
            const revenue = getRevenueValue(item);

            trendDailyRevenue.set(dateKey, (trendDailyRevenue.get(dateKey) || 0) + revenue);
        });

        const dailySeries = Array.from(trendDailyRevenue.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([day, amount]) => ({ day, amount }));

        const monthlyRows = members
            .filter((member) => normalizeMembershipType(member.membership_type) === "monthly")
            .map((member) => {
                const startedAt = new Date(member.created_at || Date.now());
                const expiresAt = member.updated_at
                    ? new Date(member.updated_at)
                    : addOneCalendarMonth(startedAt);

                return {
                    ...member,
                    startedAt,
                    expiresAt,
                    active: expiresAt >= new Date()
                };
            });

        const monthlyMembers = monthlyRows.length;

        const deltaDays = rangeMeta.rangeDays;
        const currentEnd = rangeMeta.endDate;
        const currentStart = addDays(currentEnd, -(deltaDays - 1));
        const previousEnd = addDays(currentStart, -1);
        const previousStart = addDays(previousEnd, -(deltaDays - 1));

        const inWindow = (item, start, end) => {
            const dateKey = getDateKey(item);
            if (!dateKey) return false;
            const date = new Date(`${dateKey}T00:00:00`);
            return date >= start && date <= end;
        };

        const currentWindowRows = allTimeCheckIns.filter((item) => inWindow(item, currentStart, currentEnd));
        const previousWindowRows = allTimeCheckIns.filter((item) => inWindow(item, previousStart, previousEnd));

        const safeDelta = (currentValue, previousValue) => {
            if (previousValue <= 0) return currentValue > 0 ? 100 : 0;
            return ((currentValue - previousValue) / previousValue) * 100;
        };

        const trendDelta = safeDelta(
            currentWindowRows.reduce((sum, item) => sum + getRevenueValue(item), 0),
            previousWindowRows.reduce((sum, item) => sum + getRevenueValue(item), 0)
        );

        const transactionDelta = safeDelta(currentWindowRows.length, previousWindowRows.length);

        const activeAt = (referenceDate) => monthlyRows.filter((member) => member.startedAt <= referenceDate && member.expiresAt >= referenceDate).length;
        const activeMonthly = activeAt(currentEnd);
        const activeMonthlyPrevious = activeAt(previousEnd);
        const activeDelta = safeDelta(activeMonthly, activeMonthlyPrevious);

        const allTimeSessionRows = allTimeCheckIns.filter(
            (item) => normalizeMembershipType(item?.members?.membership_type) === "session"
        );

        const sessionDays = new Set(allTimeSessionRows.map((item) => getDateKey(item))).size || 1;
        const averageSessionWalkinsAllTime = allTimeSessionRows.length / sessionDays;

        const sessionCurrentWindow = currentWindowRows.filter((item) => normalizeMembershipType(item?.members?.membership_type) === "session");
        const sessionPreviousWindow = previousWindowRows.filter((item) => normalizeMembershipType(item?.members?.membership_type) === "session");
        const sessionAvgDelta = safeDelta(sessionCurrentWindow.length / deltaDays, sessionPreviousWindow.length / deltaDays);

        const allTimeDailyRevenue = new Map();
        const allTimeHourCounts = new Map();
        const peakHourPerDay = new Map();

        allTimeCheckIns.forEach((item) => {
            const dateKey = getDateKey(item);
            const revenue = getRevenueValue(item);
            const hour = getHourFromCheckIn(item);

            allTimeDailyRevenue.set(dateKey, (allTimeDailyRevenue.get(dateKey) || 0) + revenue);
            allTimeHourCounts.set(hour, (allTimeHourCounts.get(hour) || 0) + 1);

            if (!peakHourPerDay.has(dateKey)) {
                peakHourPerDay.set(dateKey, new Map());
            }

            const perDayHours = peakHourPerDay.get(dateKey);
            perDayHours.set(hour, (perDayHours.get(hour) || 0) + 1);
        });

        const allTimeDailySeries = Array.from(allTimeDailyRevenue.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([day, amount]) => ({ day, amount }));

        const topDays = [...allTimeDailySeries]
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 5);

        const peakHour = Array.from(allTimeHourCounts.entries())
            .sort((a, b) => b[1] - a[1])[0];

        const hourlyTop = Array.from(allTimeHourCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .sort((a, b) => a[0] - b[0])
            .map(([hour, count]) => ({
                hour: formatHourAmPm(hour),
                count
            }));

        const dayPeakRows = Array.from(peakHourPerDay.entries())
            .map(([dateKey, hourMap]) => {
                const topHour = Array.from(hourMap.entries()).sort((a, b) => b[1] - a[1])[0] || [0, 0];
                return {
                    dateKey,
                    hour: formatHourAmPm(topHour[0]),
                    visits: topHour[1]
                };
            })
            .sort((a, b) => b.dateKey.localeCompare(a.dateKey));

        const weeklyPeakDayMap = new Map();
        const dayCounts = new Map();

        allTimeCheckIns.forEach((item) => {
            const dateKey = getDateKey(item);
            if (!dateKey) return;

            const weekStart = isoDate(startOfWeek(dateKey));
            const weekKey = `${weekStart}::${dateKey}`;

            dayCounts.set(weekKey, {
                weekStart,
                dateKey,
                revenue: (dayCounts.get(weekKey)?.revenue || 0) + getRevenueValue(item),
                visits: (dayCounts.get(weekKey)?.visits || 0) + 1
            });
        });

        Array.from(dayCounts.values()).forEach((dayRow) => {
            const current = weeklyPeakDayMap.get(dayRow.weekStart);
            if (!current) {
                weeklyPeakDayMap.set(dayRow.weekStart, dayRow);
                return;
            }

            if (dayRow.revenue > current.revenue) {
                weeklyPeakDayMap.set(dayRow.weekStart, dayRow);
                return;
            }

            if (dayRow.revenue === current.revenue && dayRow.visits > current.visits) {
                weeklyPeakDayMap.set(dayRow.weekStart, dayRow);
            }
        });

        const weeklyPeakDays = Array.from(weeklyPeakDayMap.values())
            .sort((a, b) => b.weekStart.localeCompare(a.weekStart));

        const weekMap = new Map();
        allTimeDailySeries.forEach((entry) => {
            const weekStart = isoDate(startOfWeek(entry.day));
            weekMap.set(weekStart, (weekMap.get(weekStart) || 0) + entry.amount);
        });

        const topWeek = Array.from(weekMap.entries()).sort((a, b) => b[1] - a[1])[0] || null;

        return {
            totalRevenue,
            transactions,
            monthlyMembers,
            activeMonthly,
            averageSessionWalkinsAllTime,
            trendDelta,
            transactionDelta,
            activeDelta,
            sessionAvgDelta,
            windowLabel: rangeMeta.windowLabel,
            dailySeries,
            topDays,
            hourlyTop,
            dayPeakRows,
            weeklyPeakDays,
            topWeek,
            peakHourLabel: peakHour ? formatHourAmPm(peakHour[0]) : "-"
        };
    }, [filteredCheckIns, members, allTimeCheckIns, rangeMeta]);

    const metricCards = [
        {
            key: "totalRevenue",
            label: "Total Revenue",
            amount: dashboard.totalRevenue,
            formatter: (number) => pesoFormatter.format(Math.round(number)),
            explanation: "Sum of all payment amounts from the selected range.",
            delta: dashboard.trendDelta,
            deltaText: dashboard.windowLabel
        },
        {
            key: "transactions",
            label: "Transactions",
            amount: dashboard.transactions,
            formatter: (number) => String(Math.round(number)),
            explanation: "Number of check-in records included in the selected range.",
            delta: dashboard.transactionDelta,
            deltaText: dashboard.windowLabel
        },
        {
            key: "activeMonthly",
            label: "Active Monthly",
            amount: dashboard.activeMonthly,
            formatter: (number) => String(Math.round(number)),
            explanation: "Monthly members whose membership end date has not passed yet.",
            delta: dashboard.activeDelta,
            deltaText: dashboard.windowLabel
        },
        {
            key: "sessionAverage",
            label: "Avg Session Walk-ins",
            amount: dashboard.averageSessionWalkinsAllTime,
            formatter: (number) => Number(number).toFixed(1),
            explanation: "Average number of walk-in session logs per day (all time).",
            delta: dashboard.sessionAvgDelta,
            deltaText: dashboard.windowLabel
        }
    ];

    const renderTrendDelta = (delta, text) => {
        const safeDelta = Number.isFinite(delta) ? delta : 0;
        const up = safeDelta >= 0;

        return (
            <span className={`home-trend-chip ${up ? "up" : "down"}`}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    {up ? <path d="M12 5 5 13h4v6h6v-6h4z" /> : <path d="M12 19l7-8h-4V5H9v6H5z" />}
                </svg>
                {Math.abs(safeDelta).toFixed(1)}% {text}
            </span>
        );
    };

    const chartData = useMemo(() => {
        return {
            trendLabels: dashboard.dailySeries.map((item) => dateFormatter.format(new Date(item.day))),
            trendValues: dashboard.dailySeries.map((item) => item.amount),
            hourlyLabels: dashboard.hourlyTop.map((item) => item.hour),
            hourlyValues: dashboard.hourlyTop.map((item) => item.count)
        };
    }, [dashboard]);

    const modalCards = useMemo(() => {
        const topLeaderboard = dashboard.topDays[0] || null;
        const topDailyPeak = dashboard.dayPeakRows[0] || null;
        const topWeekAmount = dashboard.topWeek ? dashboard.topWeek[1] : 0;
        const topWeeklyPeak = dashboard.weeklyPeakDays[0] || null;

        return [
            {
                key: "leaderboard",
                title: "Revenue Leaderboard",
                value: topLeaderboard ? pesoFormatter.format(topLeaderboard.amount) : "-",
                hint: topLeaderboard ? fullDateFormatter.format(new Date(topLeaderboard.day)) : "No data yet"
            },
            {
                key: "dailyPeak",
                title: "Daily Peak Hours",
                value: topDailyPeak ? topDailyPeak.hour : "-",
                hint: topDailyPeak ? `${topDailyPeak.visits} visits` : "No data yet"
            },
            {
                key: "topWeek",
                title: "Top Week",
                value: dashboard.topWeek ? pesoFormatter.format(topWeekAmount) : "-",
                hint: dashboard.topWeek
                    ? `Week of ${fullDateFormatter.format(new Date(dashboard.topWeek[0]))}`
                    : "No data yet"
            },
            {
                key: "weeklyPeak",
                title: "Weekly Peak Days",
                value: topWeeklyPeak ? pesoFormatter.format(topWeeklyPeak.revenue) : "-",
                hint: topWeeklyPeak
                    ? `${fullDateFormatter.format(new Date(topWeeklyPeak.dateKey))} (${topWeeklyPeak.visits} visits)`
                    : "No data yet"
            }
        ];
    }, [dashboard]);

    return (
        <div className="page-stack home-page">
            <section className="card controls-card home-filter-strip">
                <div className="home-greeting">
                    <h2>{coachGreeting}</h2>
                    <p>Let&apos;s build momentum today.</p>
                </div>
                <div className="controls-row">
                    <label>
                        Range
                        <select value={range} onChange={(event) => setRange(event.target.value)}>
                            <option value="7d">Last 7 days</option>
                            <option value="30d">Last 30 days</option>
                            <option value="all">All time</option>
                        </select>
                    </label>
                </div>
            </section>

            <section className="home-stat-grid">
                {loading ? (
                    Array.from({ length: 4 }, (_, index) => (
                        <div key={`home-skeleton-${index}`} className="home-stat-card skeleton-card" aria-hidden="true">
                            <span className="skeleton-line skeleton-label" />
                            <span className="skeleton-line skeleton-value" />
                        </div>
                    ))
                ) : (
                    metricCards.map((metric) => (
                        <button
                            key={metric.key}
                            type="button"
                            className={`home-stat-card ${activeMetric === metric.key ? "active" : ""}`}
                            onClick={() => setActiveMetric((current) => (current === metric.key ? "" : metric.key))}
                            aria-pressed={activeMetric === metric.key}
                        >
                            <p>{metric.label}</p>
                            <h3>
                                <CountUpValue value={metric.amount} formatter={metric.formatter} loading={loading} />
                            </h3>
                            {activeMetric === metric.key ? (
                                <span className="home-stat-explainer">{metric.explanation}</span>
                            ) : null}
                            {renderTrendDelta(metric.delta, metric.deltaText)}
                        </button>
                    ))
                )}
            </section>

            <section className="home-dashboard-grid">
                <article className="card chart-card home-main-chart">
                    <div className="section-head">
                        <h2>Revenue Trend</h2>
                        <span></span>
                    </div>
                    <div className="chart-wrap home-trend-wrap">
                        {loading ? (
                            <span className="skeleton-line skeleton-chart" aria-hidden="true" />
                        ) : dashboard.dailySeries.length ? (
                            <TrendChart labels={chartData.trendLabels} values={chartData.trendValues} theme={theme} />
                        ) : (
                            <p className="empty-state">No data in selected filters.</p>
                        )}
                    </div>

                    <div className="home-inline-cards">
                        {loading ? (
                            Array.from({ length: 4 }, (_, index) => (
                                <div key={`detail-card-skeleton-inline-${index}`} className="home-detail-card skeleton-card" aria-hidden="true">
                                    <span className="skeleton-line skeleton-label" />
                                    <span className="skeleton-line skeleton-value" />
                                </div>
                            ))
                        ) : (
                            modalCards.map((card) => (
                                <button
                                    key={card.key}
                                    type="button"
                                    className="home-detail-card"
                                    onClick={() => setDetailsModal(card.key)}
                                >
                                    <p>{card.title}</p>
                                    <h3>{card.value}</h3>
                                    <span>{card.hint}</span>
                                </button>
                            ))
                        )}
                    </div>
                </article>

                <article className="card chart-card home-side-chart">
                    <div className="section-head">
                        <h2>Peak Hours</h2>
                        <span>Top 5 all-time log-ins</span>
                    </div>
                    <div className="chart-wrap chart-wrap-compact">
                        {loading ? (
                            <span className="skeleton-line skeleton-chart" aria-hidden="true" />
                        ) : dashboard.hourlyTop.length ? (
                            <BarChart
                                labels={chartData.hourlyLabels}
                                values={chartData.hourlyValues}
                                ariaLabel="Peak hours"
                                valueFormatter={(value) => `${Math.round(value)} visits`}
                                theme={theme}
                            />
                        ) : (
                            <p className="empty-state">No hourly data yet.</p>
                        )}
                    </div>
                </article>

                <article className="card chart-card home-side-chart">
                    <div className="section-head">
                        <h2>Member Split</h2>
                    </div>
                    <div className="chart-wrap chart-wrap-compact">
                        <DoughnutChart
                            labels={["Active Monthly", "Avg Session Walk-ins"]}
                            values={[
                                dashboard.activeMonthly,
                                Number(dashboard.averageSessionWalkinsAllTime.toFixed(1))
                            ]}
                            ariaLabel="Member split"
                            theme={theme}
                        />
                    </div>
                    <div className="home-split-caption">
                        <div className="simple-list home-split-list">
                            <div className="simple-row">
                                <span>Active Monthly Members</span>
                                <strong>{dashboard.activeMonthly}</strong>
                            </div>
                            <div className="simple-row">
                                <span>Avg Session Walk-ins (All time)</span>
                                <strong>{dashboard.averageSessionWalkinsAllTime.toFixed(1)}</strong>
                            </div>
                        </div>
                    </div>
                </article>
            </section>

            {detailsModal ? (
                <div className="home-modal-backdrop" role="presentation" onClick={() => setDetailsModal("")}>
                    <section
                        className="home-modal-card"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Home details"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="home-modal-head">
                            <h3>
                                {detailsModal === "leaderboard" && "Revenue Leaderboard"}
                                {detailsModal === "dailyPeak" && "Daily Peak Hours"}
                                {detailsModal === "topWeek" && "Top Week"}
                                {detailsModal === "weeklyPeak" && "Weekly Peak Days"}
                            </h3>
                            <button type="button" className="home-modal-close" onClick={() => setDetailsModal("")}>Close</button>
                        </div>

                        <div className="home-modal-body">
                            {detailsModal === "leaderboard" ? (
                                dashboard.topDays.length ? (
                                    <div className="simple-list">
                                        {dashboard.topDays.map((item) => (
                                            <div key={item.day} className="simple-row">
                                                <span>{fullDateFormatter.format(new Date(item.day))}</span>
                                                <strong>{pesoFormatter.format(item.amount)}</strong>
                                            </div>
                                        ))}
                                    </div>
                                ) : <p className="empty-state">No daily revenue yet.</p>
                            ) : null}

                            {detailsModal === "dailyPeak" ? (
                                dashboard.dayPeakRows.length ? (
                                    <div className="simple-list">
                                        {dashboard.dayPeakRows.slice(0, 8).map((row) => (
                                            <div key={row.dateKey} className="simple-row">
                                                <span>{fullDateFormatter.format(new Date(row.dateKey))}</span>
                                                <strong>{row.hour} ({row.visits} visits)</strong>
                                            </div>
                                        ))}
                                    </div>
                                ) : <p className="empty-state">No daily peaks available yet.</p>
                            ) : null}

                            {detailsModal === "topWeek" ? (
                                dashboard.topWeek ? (
                                    <div className="simple-row">
                                        <span>Week of {fullDateFormatter.format(new Date(dashboard.topWeek[0]))}</span>
                                        <strong>{pesoFormatter.format(dashboard.topWeek[1])}</strong>
                                    </div>
                                ) : <p className="empty-state">No weekly peak data yet.</p>
                            ) : null}

                            {detailsModal === "weeklyPeak" ? (
                                dashboard.weeklyPeakDays.length ? (
                                    <div className="simple-list">
                                        {dashboard.weeklyPeakDays.slice(0, 5).map((row) => (
                                            <div key={`${row.weekStart}-${row.dateKey}`} className="simple-row">
                                                <span>
                                                    Week of {fullDateFormatter.format(new Date(row.weekStart))}: {fullDateFormatter.format(new Date(row.dateKey))}
                                                </span>
                                                <strong>{pesoFormatter.format(row.revenue)} ({row.visits} visits)</strong>
                                            </div>
                                        ))}
                                    </div>
                                ) : <p className="empty-state">No weekly peak-day data yet.</p>
                            ) : null}
                        </div>
                    </section>
                </div>
            ) : null}
        </div>
    );
};

const MembersPage = ({ members, latestTimeInByMember, loading }) => {
    const [query, setQuery] = useState("");
    const deferredQuery = useDeferredValue(query);
    const [statusFilter, setStatusFilter] = useState("all");
    const [page, setPage] = useState(1);
    const pageSize = 10;

    const memberRows = useMemo(() => {
        return members
            .filter((member) => normalizeMembershipType(member.membership_type) === "monthly")
            .map((member) => {
                const startedAt = new Date(member.created_at || Date.now());
                const expiresAt = member.updated_at
                    ? new Date(member.updated_at)
                    : addOneCalendarMonth(startedAt);
                const active = expiresAt >= new Date();
                const lastTimeIn = latestTimeInByMember.get(member.id)?.label || "No check-in yet";

                return {
                    id: member.id,
                    name: member.name,
                    startedAt,
                    expiresAt,
                    type: normalizeMembershipType(member.membership_type),
                    status: active ? "Active" : "Expired",
                    lastTimeIn
                };
            })
            .sort((a, b) => a.expiresAt - b.expiresAt);
            }, [members, latestTimeInByMember]);

    const visibleRows = useMemo(() => {
        const q = deferredQuery.trim().toLowerCase();
        return memberRows.filter((row) => {
            const matchesQuery = !q || String(row.name || "").toLowerCase().includes(q);
            const matchesStatus = statusFilter === "all" || row.status.toLowerCase() === statusFilter;
            return matchesQuery && matchesStatus;
        });
    }, [memberRows, deferredQuery, statusFilter]);

    useEffect(() => {
        setPage(1);
    }, [query, statusFilter]);

    const paginatedRows = useMemo(() => {
        const start = (page - 1) * pageSize;
        return visibleRows.slice(start, start + pageSize);
    }, [visibleRows, page]);

    const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));

    const activeCount = memberRows.filter((item) => item.status === "Active").length;
    const expiredCount = memberRows.length - activeCount;

    return (
        <div className="page-stack">
            <section className="kpi-grid">
                {loading ? (
                    Array.from({ length: 3 }, (_, index) => (
                        <article key={`members-kpi-skeleton-${index}`} className="kpi-card skeleton-card" aria-hidden="true">
                            <span className="skeleton-line skeleton-label" />
                            <span className="skeleton-line skeleton-value" />
                        </article>
                    ))
                ) : (
                    <>
                        <article className="kpi-card">
                            <p>Visible Members</p>
                            <h3>
                                <CountUpValue value={memberRows.length} loading={loading} />
                            </h3>
                        </article>
                        <article className="kpi-card">
                            <p>Active</p>
                            <h3>
                                <CountUpValue value={activeCount} loading={loading} />
                            </h3>
                        </article>
                        <article className="kpi-card">
                            <p>Expired</p>
                            <h3>
                                <CountUpValue value={expiredCount} loading={loading} />
                            </h3>
                        </article>
                    </>
                )}
            </section>

            <section className="card controls-card">
                <h2>Members</h2>
                <div className="controls-row">
                    <label>
                        Search
                        <input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search name"
                        />
                    </label>
                    <label>
                        Status
                        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                            <option value="all">All</option>
                            <option value="active">Active</option>
                            <option value="expired">Expired</option>
                        </select>
                    </label>
                </div>
            </section>

            <section className="card">
                <div className="member-table">
                    <div className="member-row member-head">
                        <span>Name</span>
                                <span>Type</span>
                        <span>Status</span>
                        <span>Expires</span>
                        <span>Last Time In</span>
                    </div>
                    {loading ? (
                        Array.from({ length: 5 }, (_, index) => (
                            <div className="member-row" key={`member-row-skeleton-${index}`} aria-hidden="true">
                                <span className="skeleton-line skeleton-label" />
                                <span className="skeleton-line skeleton-label" />
                                <span className="skeleton-line skeleton-label" />
                                <span className="skeleton-line skeleton-label" />
                                <span className="skeleton-line skeleton-label" />
                            </div>
                        ))
                    ) : visibleRows.length === 0 ? (
                        <p className="empty-state">No members found.</p>
                    ) : (
                        paginatedRows.map((row) => (
                            <div className="member-row" key={row.id}>
                                <strong>{row.name || "Unknown"}</strong>
                                <span>{row.type}</span>
                                <span className={row.status === "Active" ? "status active" : "status expired"}>{row.status}</span>
                                <span>{fullDateFormatter.format(row.expiresAt)}</span>
                                <span>{row.lastTimeIn}</span>
                            </div>
                        ))
                    )}
                </div>

                {!loading && visibleRows.length > 0 ? (
                    <div className="pagination-row">
                        <button type="button" className="pager-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Previous</button>
                        <p className="pager-meta">Page {page} of {totalPages} ({visibleRows.length} results)</p>
                        <button type="button" className="pager-btn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next</button>
                    </div>
                ) : null}
            </section>
        </div>
    );
};

const FinancePage = ({ checkIns, loading, theme }) => {
    const [view, setView] = useState("monthly");
    const [selectedMonth, setSelectedMonth] = useState("");
    const [selectedWeekStart, setSelectedWeekStart] = useState("");
    const [selectedDate, setSelectedDate] = useState("");

    const checkInsWithinHours = useMemo(
        () => checkIns.filter((item) => isWithinGymHours(getHourFromCheckIn(item))),
        [checkIns]
    );

    const monthOptions = useMemo(() => {
        return [...new Set(checkInsWithinHours.map((item) => monthKeyOf(getDateKey(item))).filter(Boolean))]
            .sort((a, b) => b.localeCompare(a));
    }, [checkInsWithinHours]);

    const dayOptions = useMemo(() => {
        return [...new Set(checkInsWithinHours.map((item) => getDateKey(item)).filter(Boolean))]
            .sort((a, b) => b.localeCompare(a));
    }, [checkInsWithinHours]);

    const weekOptions = useMemo(() => {
        return [...new Set(
            checkInsWithinHours.map((item) => {
                const dateKey = getDateKey(item);
                if (!dateKey) return "";
                return isoDate(startOfWeek(dateKey));
            }).filter(Boolean)
        )].sort((a, b) => b.localeCompare(a));
    }, [checkInsWithinHours]);

    useEffect(() => {
        if (!selectedMonth && monthOptions.length) setSelectedMonth(monthOptions[0]);
        if (!selectedWeekStart && weekOptions.length) setSelectedWeekStart(weekOptions[0]);
        if (!selectedDate && dayOptions.length) setSelectedDate(dayOptions[0]);
    }, [monthOptions, weekOptions, dayOptions, selectedMonth, selectedWeekStart, selectedDate]);

    const result = useMemo(() => {
        if (!checkInsWithinHours.length) {
            return {
                labels: [],
                values: [],
                insight: "No records yet.",
                totalRevenue: 0,
                transactions: 0
            };
        }

        if (view === "monthly") {
            const rows = checkInsWithinHours.filter((item) => monthKeyOf(getDateKey(item)) === selectedMonth);
            const byDay = new Map();

            rows.forEach((item) => {
                const day = getDateKey(item);
                byDay.set(day, (byDay.get(day) || 0) + getRevenueValue(item));
            });

            const ordered = Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b));
            const top = [...ordered].sort((a, b) => b[1] - a[1])[0];
            const totalRevenue = ordered.reduce((sum, [, value]) => sum + value, 0);
            const transactions = rows.length;

            return {
                labels: ordered.map(([day]) => dateFormatter.format(new Date(day))),
                values: ordered.map(([, value]) => value),
                insight: top ? `Highest revenue day: ${fullDateFormatter.format(new Date(top[0]))} (${pesoFormatter.format(top[1])})` : "No data for selected month.",
                totalRevenue,
                transactions
            };
        }

        if (view === "weekly") {
            const start = new Date(selectedWeekStart);
            const end = addDays(start, 6);

            const rows = checkInsWithinHours.filter((item) => {
                const dateKey = getDateKey(item);
                if (!dateKey) return false;
                const date = new Date(dateKey);
                return date >= start && date <= end;
            });

            const weekDays = Array.from({ length: 7 }, (_, index) => {
                const date = addDays(start, index);
                const key = isoDate(date);
                return { key, label: date.toLocaleDateString("en-PH", { weekday: "short" }) };
            });

            const byDay = new Map(weekDays.map((d) => [d.key, 0]));
            rows.forEach((item) => {
                const day = getDateKey(item);
                byDay.set(day, (byDay.get(day) || 0) + getRevenueValue(item));
            });

            const top = weekDays
                .map((d) => ({ day: d.key, amount: byDay.get(d.key) || 0 }))
                .sort((a, b) => b.amount - a.amount)[0];

            const totalRevenue = weekDays.reduce((sum, d) => sum + (byDay.get(d.key) || 0), 0);
            const transactions = rows.length;

            return {
                labels: weekDays.map((d) => d.label),
                values: weekDays.map((d) => byDay.get(d.key) || 0),
                insight: top ? `Highest revenue day this week: ${fullDateFormatter.format(new Date(top.day))} (${pesoFormatter.format(top.amount)})` : "No data for selected week.",
                totalRevenue,
                transactions
            };
        }

        const rows = checkInsWithinHours.filter((item) => getDateKey(item) === selectedDate);
        const byHour = hoursInRange.map((hour) => ({
            hour,
            label: formatHourAmPm(hour),
            amount: 0
        }));

        const byHourIndex = new Map(byHour.map((item, index) => [item.hour, index]));

        rows.forEach((item) => {
            const hour = getHourFromCheckIn(item);
            if (!isWithinGymHours(hour)) return;
            const index = byHourIndex.get(hour);
            if (index === undefined) return;
            byHour[index].amount += getRevenueValue(item);
        });

        const topHour = [...byHour].sort((a, b) => b.amount - a.amount)[0];
        const totalRevenue = byHour.reduce((sum, item) => sum + item.amount, 0);
        const transactions = rows.length;

        return {
            labels: byHour.map((item) => item.label),
            values: byHour.map((item) => item.amount),
            insight: topHour
                ? `Peak revenue hour: ${topHour.label} (${pesoFormatter.format(topHour.amount)})`
                : "No data for selected day.",
            totalRevenue,
            transactions
        };
    }, [checkInsWithinHours, view, selectedMonth, selectedWeekStart, selectedDate]);

    const forecast = useMemo(() => {
        if (!checkInsWithinHours.length) {
            return {
                next7: 0,
                next30: 0,
                trendPercent: 0,
                labels: [],
                values: []
            };
        }

        const byDate = new Map();
        checkInsWithinHours.forEach((item) => {
            const dateKey = getDateKey(item);
            if (!dateKey) return;
            byDate.set(dateKey, (byDate.get(dateKey) || 0) + getRevenueValue(item));
        });

        const allDates = Array.from(byDate.keys()).sort((a, b) => a.localeCompare(b));
        const latest = new Date(allDates[allDates.length - 1]);

        const trainingWindow = Array.from({ length: 56 }, (_, i) => {
            return isoDate(addDays(latest, -(55 - i)));
        });

        const values = trainingWindow.map((day) => byDate.get(day) || 0);

        const n = values.length;
        const meanX = (n - 1) / 2;
        const meanY = values.reduce((sum, v) => sum + v, 0) / n;

        let numerator = 0;
        let denominator = 0;
        for (let i = 0; i < n; i += 1) {
            numerator += (i - meanX) * (values[i] - meanY);
            denominator += (i - meanX) * (i - meanX);
        }

        const slope = denominator > 0 ? numerator / denominator : 0;
        const intercept = meanY - slope * meanX;

        const residualByWeekday = Array.from({ length: 7 }, () => []);
        trainingWindow.forEach((dayKey, index) => {
            const predictedTrend = intercept + slope * index;
            const actual = values[index];
            const weekday = new Date(dayKey).getDay();
            residualByWeekday[weekday].push(actual - predictedTrend);
        });

        const weekdayBias = residualByWeekday.map((arr) => {
            if (!arr.length) return 0;
            return arr.reduce((sum, val) => sum + val, 0) / arr.length;
        });

        const last7 = values.slice(-7);
        const prev7 = values.slice(-14, -7);
        const prev7Sum = prev7.reduce((sum, value) => sum + value, 0);
        const last7Sum = last7.reduce((sum, value) => sum + value, 0);

        const trendPercent = prev7Sum > 0
            ? ((last7Sum - prev7Sum) / prev7Sum) * 100
            : 0;

        const forecast7Values = Array.from({ length: 7 }, (_, i) => {
            const futureDate = addDays(latest, i + 1);
            const x = n + i;
            const trendPrediction = intercept + slope * x;
            const weekday = futureDate.getDay();
            const seasonal = weekdayBias[weekday] || 0;

            // Keep forecasts from collapsing to zero on short-term downtrends.
            const weekdayHistory = trainingWindow
                .map((dayKey, index) => ({
                    weekday: new Date(dayKey).getDay(),
                    value: values[index]
                }))
                .filter((row) => row.weekday === weekday)
                .map((row) => row.value);

            const weekdayAvg = weekdayHistory.length
                ? weekdayHistory.reduce((sum, value) => sum + value, 0) / weekdayHistory.length
                : 0;

            const recentNonZero = values.slice(-14).filter((value) => value > 0);
            const recentFloor = recentNonZero.length
                ? recentNonZero.reduce((sum, value) => sum + value, 0) / recentNonZero.length * 0.2
                : 0;

            const blended = trendPrediction + seasonal;
            const stabilized = Math.max(blended, weekdayAvg * 0.45, recentFloor);
            return Math.max(0, stabilized);
        });

        const actualLabels = trainingWindow.slice(-7).map((d) => dateFormatter.format(new Date(d)));
        const forecastLabels = Array.from({ length: 7 }, (_, i) => {
            const day = addDays(latest, i + 1);
            return dateFormatter.format(day);
        });

        const next7 = forecast7Values.reduce((sum, value) => sum + value, 0);
        const next30 = next7 * (30 / 7);

        return {
            next7,
            next30,
            trendPercent,
            labels: [...actualLabels, ...forecastLabels],
            values: [...last7, ...forecast7Values]
        };
    }, [checkInsWithinHours]);

    return (
        <div className="page-stack">
            <section className="card controls-card">
                <h2>Finance Deep Dive</h2>
                <div className="controls-row">
                    <label>
                        View
                        <select value={view} onChange={(event) => setView(event.target.value)}>
                            <option value="monthly">Monthly</option>
                            <option value="weekly">Weekly</option>
                            <option value="daily">Daily</option>
                        </select>
                    </label>

                    {view === "monthly" ? (
                        <label>
                            Month
                            <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
                                {monthOptions.map((month) => (
                                    <option key={month} value={month}>
                                        {monthYearFormatter.format(new Date(`${month}-01T00:00:00`))}
                                    </option>
                                ))}
                            </select>
                        </label>
                    ) : null}

                    {view === "weekly" ? (
                        <label>
                            Week Start
                            <select value={selectedWeekStart} onChange={(event) => setSelectedWeekStart(event.target.value)}>
                                {weekOptions.map((week) => <option key={week}>{week}</option>)}
                            </select>
                        </label>
                    ) : null}

                    {view === "daily" ? (
                        <label>
                            Date
                            <select value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)}>
                                {dayOptions.map((day) => <option key={day}>{day}</option>)}
                            </select>
                        </label>
                    ) : null}
                </div>
            </section>

            <section className="kpi-grid finance-kpi-grid">
                {loading ? (
                    Array.from({ length: 4 }, (_, index) => (
                        <article key={`finance-kpi-skeleton-${index}`} className="kpi-card skeleton-card" aria-hidden="true">
                            <span className="skeleton-line skeleton-label" />
                            <span className="skeleton-line skeleton-value" />
                        </article>
                    ))
                ) : (
                    <>
                        <article className="kpi-card">
                            <p>Revenue</p>
                            <h3>
                                <CountUpValue
                                    value={result.totalRevenue}
                                    formatter={(number) => pesoFormatter.format(Math.round(number))}
                                    loading={loading}
                                />
                            </h3>
                        </article>
                        <article className="kpi-card">
                            <p>Transactions</p>
                            <h3>
                                <CountUpValue value={result.transactions} loading={loading} />
                            </h3>
                        </article>
                        <article className="kpi-card mini-kpi">
                            <p>Forecast Next 7 Days</p>
                            <h3>
                                <CountUpValue
                                    value={forecast.next7}
                                    formatter={(number) => pesoFormatter.format(Math.round(number))}
                                    loading={loading}
                                />
                            </h3>
                        </article>
                        <article className="kpi-card mini-kpi">
                            <p>Forecast Next 30 Days</p>
                            <h3>
                                <CountUpValue
                                    value={forecast.next30}
                                    formatter={(number) => pesoFormatter.format(Math.round(number))}
                                    loading={loading}
                                />
                            </h3>
                        </article>
                    </>
                )}
            </section>

            <section className="card chart-card">
                <div className="section-head">
                    <h2>Revenue Curve</h2>
                </div>
                <div className="chart-wrap">
                    {loading ? (
                        <span className="skeleton-line skeleton-chart" aria-hidden="true" />
                    ) : result.labels.length ? (
                        <TrendChart labels={result.labels} values={result.values} theme={theme} />
                    ) : (
                        <p className="empty-state">No data for this filter.</p>
                    )}
                </div>
                <p className="insight">{result.insight}</p>
            </section>

            <section className="card">
                <div className="section-head">
                    <h2>Revenue Forecasting</h2>
                    <span>{forecast.trendPercent >= 0 ? "+" : ""}{forecast.trendPercent.toFixed(1)}% vs previous week</span>
                </div>
                <div className="chart-wrap forecast-chart-wrap">
                    {loading ? (
                        <span className="skeleton-line skeleton-chart" aria-hidden="true" />
                    ) : forecast.labels.length ? (
                        <TrendChart labels={forecast.labels} values={forecast.values} theme={theme} />
                    ) : (
                        <p className="empty-state">Not enough data for forecast.</p>
                    )}
                </div>
                <p className="tiny-note">First 7 points are actual, next 7 points are forecast.</p>
            </section>
        </div>
    );
};

const InsightsPage = ({ members, checkIns }) => {
    const [heatmapMonth, setHeatmapMonth] = useState("");
    const [selectedHeatDate, setSelectedHeatDate] = useState("");
    const [reportDate, setReportDate] = useState("");
    const [reportWindow, setReportWindow] = useState("daily");
    const [reportText, setReportText] = useState("");
    const [renewalSearch, setRenewalSearch] = useState("");
    const [renewalSort, setRenewalSort] = useState("score-desc");
    const [renewalPage, setRenewalPage] = useState(1);
    const renewalPageSize = 8;
    const [candidatePage, setCandidatePage] = useState(1);
    const candidatePageSize = 5;
    const [insightModal, setInsightModal] = useState("");

    const checkInsWithinHours = useMemo(
        () => checkIns.filter((item) => isWithinGymHours(getHourFromCheckIn(item))),
        [checkIns]
    );

    const monthOptions = useMemo(() => {
        return [...new Set(checkInsWithinHours.map((item) => monthKeyOf(getDateKey(item))).filter(Boolean))]
            .sort((a, b) => b.localeCompare(a));
    }, [checkInsWithinHours]);

    const dayOptions = useMemo(() => {
        return [...new Set(checkInsWithinHours.map((item) => getDateKey(item)).filter(Boolean))]
            .sort((a, b) => b.localeCompare(a));
    }, [checkInsWithinHours]);

    useEffect(() => {
        if (!heatmapMonth && monthOptions.length) setHeatmapMonth(monthOptions[0]);
        if (!reportDate && dayOptions.length) setReportDate(dayOptions[0]);
    }, [heatmapMonth, monthOptions, reportDate, dayOptions]);

    const checkInCountByMember = useMemo(() => {
        const map = new Map();
        checkInsWithinHours.forEach((item) => {
            map.set(item.member_id, (map.get(item.member_id) || 0) + 1);
        });
        return map;
    }, [checkInsWithinHours]);

    const renewalRadar = useMemo(() => {
        const now = new Date();
        const monthlyBase = members
            .filter((member) => normalizeMembershipType(member.membership_type) === "monthly")
            .map((member) => {
                const startedAt = new Date(member.created_at || Date.now());
                const expiresAt = member.updated_at ? new Date(member.updated_at) : addOneCalendarMonth(startedAt);
                const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
                const visitCount = checkInCountByMember.get(member.id) || 0;
                const renewalScore = Math.max(0, Math.min(100, Math.round((visitCount / 20) * 100)));
                return {
                    id: member.id,
                    name: member.name,
                    daysLeft,
                    expiresAt,
                    visitCount,
                    renewalScore
                };
            })
            .filter((item) => item.daysLeft <= 30)
            .sort((a, b) => a.daysLeft - b.daysLeft);

        const q = renewalSearch.trim().toLowerCase();
        const filtered = monthlyBase.filter((item) => {
            const matchesSearch = !q || String(item.name || "").toLowerCase().includes(q);
            return matchesSearch;
        });

        const sorted = [...filtered].sort((a, b) => {
            if (renewalSort === "score-asc") return a.renewalScore - b.renewalScore;
            return b.renewalScore - a.renewalScore;
        });

        return {
            urgent: monthlyBase.filter((item) => item.daysLeft <= 3 && item.daysLeft >= 0),
            soon: sorted
        };
    }, [members, checkInCountByMember, renewalSearch, renewalSort]);

    useEffect(() => {
        setRenewalPage(1);
    }, [renewalSearch, renewalSort]);

    const renewalTotalPages = useMemo(
        () => Math.max(1, Math.ceil(renewalRadar.soon.length / renewalPageSize)),
        [renewalRadar.soon.length]
    );

    const renewalRows = useMemo(() => {
        const start = (renewalPage - 1) * renewalPageSize;
        return renewalRadar.soon.slice(start, start + renewalPageSize);
    }, [renewalRadar.soon, renewalPage]);

    const heatmap = useMemo(() => {
        if (!heatmapMonth) {
            return {
                cells: [],
                maxRevenue: 1
            };
        }

        const revenueByDate = new Map();
        checkInsWithinHours
            .filter((item) => monthKeyOf(getDateKey(item)) === heatmapMonth)
            .forEach((item) => {
                const dateKey = getDateKey(item);
                if (!dateKey) return;
                revenueByDate.set(dateKey, (revenueByDate.get(dateKey) || 0) + getRevenueValue(item));
            });

        const monthStart = new Date(`${heatmapMonth}-01T00:00:00`);
        if (!Number.isFinite(monthStart.getTime())) {
            return {
                cells: [],
                maxRevenue: 1
            };
        }

        const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
        const leadingBlanks = (monthStart.getDay() + 6) % 7;

        const values = [];
        for (let day = 1; day <= daysInMonth; day += 1) {
            const dateKey = `${heatmapMonth}-${String(day).padStart(2, "0")}`;
            values.push(revenueByDate.get(dateKey) || 0);
        }

        const maxRevenue = Math.max(1, ...values);
        const cells = [
            ...Array.from({ length: leadingBlanks }, (_, index) => ({ type: "empty", key: `empty-${index}` })),
            ...Array.from({ length: daysInMonth }, (_, index) => {
                const day = index + 1;
                const dateKey = `${heatmapMonth}-${String(day).padStart(2, "0")}`;
                const revenue = revenueByDate.get(dateKey) || 0;
                return {
                    type: "day",
                    key: dateKey,
                    day,
                    dateKey,
                    revenue,
                    level: revenue / maxRevenue
                };
            })
        ];

        return {
            cells,
            maxRevenue
        };
    }, [checkInsWithinHours, heatmapMonth]);

    useEffect(() => {
        if (!heatmap.cells.length) {
            setSelectedHeatDate("");
            return;
        }

        const hasSelectedDate = heatmap.cells.some((cell) => cell.type === "day" && cell.dateKey === selectedHeatDate);
        if (hasSelectedDate) return;

        const firstDayCell = heatmap.cells.find((cell) => cell.type === "day");
        setSelectedHeatDate(firstDayCell?.dateKey || "");
    }, [heatmap, selectedHeatDate]);

    const selectedHeatCell = useMemo(
        () => heatmap.cells.find((cell) => cell.type === "day" && cell.dateKey === selectedHeatDate) || null,
        [heatmap, selectedHeatDate]
    );

    const conversionCandidates = useMemo(() => {
        const countsByNameMonth = new Map();

        checkInsWithinHours.forEach((item) => {
            const type = normalizeMembershipType(item?.members?.membership_type);
            if (type !== "session") return;

            const rawName = String(item?.members?.name || "").trim();
            if (!rawName || rawName.toLowerCase() === "session visitor") return;

            const monthKey = monthKeyOf(getDateKey(item));
            if (!monthKey) return;

            const key = `${rawName.toLowerCase()}::${monthKey}`;
            const existing = countsByNameMonth.get(key) || {
                name: rawName,
                monthKey,
                count: 0
            };

            existing.count += 1;
            countsByNameMonth.set(key, existing);
        });

        const bestByName = new Map();
        countsByNameMonth.forEach((row) => {
            const key = row.name.toLowerCase();
            const existing = bestByName.get(key);
            if (!existing || row.count > existing.maxMonthlyVisits) {
                bestByName.set(key, {
                    name: row.name,
                    maxMonthlyVisits: row.count,
                    monthKey: row.monthKey
                });
            }
        });

        return Array.from(bestByName.values())
            .filter((row) => row.maxMonthlyVisits >= 12)
            .sort((a, b) => {
                if (b.maxMonthlyVisits !== a.maxMonthlyVisits) return b.maxMonthlyVisits - a.maxMonthlyVisits;
                return a.name.localeCompare(b.name);
            });
    }, [checkInsWithinHours]);

    useEffect(() => {
        setCandidatePage(1);
    }, [conversionCandidates.length]);

    const candidateTotalPages = useMemo(
        () => Math.max(1, Math.ceil(conversionCandidates.length / candidatePageSize)),
        [conversionCandidates.length]
    );

    const candidateRows = useMemo(() => {
        const start = (candidatePage - 1) * candidatePageSize;
        return conversionCandidates.slice(start, start + candidatePageSize);
    }, [conversionCandidates, candidatePage]);

    const peakRecommendation = useMemo(() => {
        const hourly = hoursInRange.map((hour) => ({
            hour,
            visits: 0,
            revenue: 0,
            avgVisits: 0
        }));

        const hourlyIndex = new Map(hourly.map((row, index) => [row.hour, index]));
        const allTimeDays = new Set(checkInsWithinHours.map((item) => getDateKey(item))).size || 1;

        checkInsWithinHours.forEach((item) => {
            const hour = getHourFromCheckIn(item);
            if (!isWithinGymHours(hour)) return;
            const index = hourlyIndex.get(hour);
            if (index === undefined) return;
            hourly[index].visits += 1;
            hourly[index].revenue += getRevenueValue(item);
        });

        hourly.forEach((row) => {
            row.avgVisits = row.visits / allTimeDays;
        });

        const peak = [...hourly].sort((a, b) => b.avgVisits - a.avgVisits)[0] || { hour: 0, visits: 0, revenue: 0, avgVisits: 0 };
        const quiet = hourly
            .filter((h) => h.hour < GYM_CLOSE_HOUR && h.visits > 0)
            .sort((a, b) => a.avgVisits - b.avgVisits)[0] || { hour: 6, visits: 0, revenue: 0, avgVisits: 0 };

        const busiest = [...hourly]
            .filter((h) => h.visits > 0)
            .sort((a, b) => b.avgVisits - a.avgVisits)
            .slice(0, 2);

        const cleaningSlots = busiest.map((row, index) => {
            let cleanHour = Math.min(GYM_CLOSE_HOUR, row.hour + 1);
            if (index === 1 && busiest[0] && cleanHour === Math.min(GYM_CLOSE_HOUR, busiest[0].hour + 1)) {
                cleanHour = Math.max(GYM_OPEN_HOUR, row.hour - 1);
            }

            return {
                triggerHour: row.hour,
                cleanHour,
                label: `Clean after ${formatHourAmPm(row.hour)} peak`
            };
        });

        return {
            peak,
            quiet,
            cleaningSlots,
            recommendation: `All-time peak averages ${peak.avgVisits.toFixed(1)} visits/day at ${formatHourAmPm(peak.hour)}. Quietest open-hour period averages ${quiet.avgVisits.toFixed(1)} visits/day at ${formatHourAmPm(quiet.hour)}.`
        };
    }, [checkInsWithinHours]);

    const reportData = useMemo(() => {
        const days = reportWindow === "daily" ? 1 : Number(reportWindow);
        const end = reportDate ? new Date(`${reportDate}T00:00:00`) : (dayOptions.length ? new Date(`${dayOptions[0]}T00:00:00`) : new Date());
        const start = addDays(end, -(days - 1));

        const rows = checkInsWithinHours.filter((item) => {
            const dateKey = getDateKey(item);
            if (!dateKey) return false;
            const date = new Date(`${dateKey}T00:00:00`);
            return date >= start && date <= end;
        });

        const revenue = rows.reduce((sum, item) => sum + getRevenueValue(item), 0);

        const byHourCount = new Map();
        const byDayRevenue = new Map();
        rows.forEach((item) => {
            const hour = getHourFromCheckIn(item);
            const dateKey = getDateKey(item);
            byHourCount.set(hour, (byHourCount.get(hour) || 0) + 1);
            byDayRevenue.set(dateKey, (byDayRevenue.get(dateKey) || 0) + getRevenueValue(item));
        });

        const peakHourEntry = Array.from(byHourCount.entries()).sort((a, b) => b[1] - a[1])[0];
        const quietHourEntry = Array.from(byHourCount.entries()).sort((a, b) => a[1] - b[1])[0];
        const topRevenueDay = Array.from(byDayRevenue.entries()).sort((a, b) => b[1] - a[1])[0];

        const newMembers = members.filter((member) => {
            if (normalizeMembershipType(member.membership_type) !== "monthly") return false;
            const createdKey = isoDate(member.created_at);
            if (!createdKey) return false;
            const created = new Date(`${createdKey}T00:00:00`);
            return created >= start && created <= end;
        }).length;

        const monthlyRevenue = rows
            .filter((item) => normalizeMembershipType(item?.members?.membership_type) === "monthly")
            .reduce((sum, item) => sum + getRevenueValue(item), 0);
        const sessionRevenue = rows
            .filter((item) => normalizeMembershipType(item?.members?.membership_type) === "session")
            .reduce((sum, item) => sum + getRevenueValue(item), 0);

        return {
            days,
            start,
            end,
            revenue,
            visits: rows.length,
            avgDailyRevenue: revenue / days,
            avgDailyVisits: rows.length / days,
            peakHour: peakHourEntry ? formatHourAmPm(peakHourEntry[0]) : "-",
            quietHour: quietHourEntry ? formatHourAmPm(quietHourEntry[0]) : "-",
            topRevenueDay: topRevenueDay
                ? `${fullDateFormatter.format(new Date(`${topRevenueDay[0]}T00:00:00`))} (${pesoFormatter.format(topRevenueDay[1])})`
                : "-",
            newMembers,
            monthlyRevenue,
            sessionRevenue
        };
    }, [checkInsWithinHours, reportDate, reportWindow, members, dayOptions]);

    const generateCloseReport = () => {
        const reportTitle = reportData.days === 1 ? "Daily" : `Last ${reportData.days} Days`;
        setReportText(
            [
                `${reportTitle} Report`,
                `Period: ${fullDateFormatter.format(reportData.start)} to ${fullDateFormatter.format(reportData.end)}`,
                `Revenue: ${pesoFormatter.format(reportData.revenue)}`,
                `Check-ins: ${reportData.visits}`,
                `Avg Daily Revenue: ${pesoFormatter.format(reportData.avgDailyRevenue)}`,
                `Avg Daily Check-ins: ${reportData.avgDailyVisits.toFixed(1)}`,
                `Peak Hour: ${reportData.peakHour}`,
                `Quiet Hour: ${reportData.quietHour}`,
                `Top Revenue Day: ${reportData.topRevenueDay}`,
                `New Monthly Members: ${reportData.newMembers}`,
                `Monthly Revenue Share: ${pesoFormatter.format(reportData.monthlyRevenue)}`,
                `Session Revenue Share: ${pesoFormatter.format(reportData.sessionRevenue)}`
            ].join("\n")
        );
    };

    const downloadCloseReportPdf = () => {
        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: [90, 240] });
        const centerX = 40;
        let y = 12;
        const sanitizePdfText = (value) => String(value || "").replaceAll("₱", "PHP ");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("WYN FITNESS", centerX, y, { align: "center" });
        y += 5;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text("Daily Close Receipt", centerX, y, { align: "center" });
        y += 6;

        doc.setDrawColor(120);
        doc.line(8, y, 72, y);
        y += 5;

        const lines = [
            ["Period", `${fullDateFormatter.format(reportData.start)} - ${fullDateFormatter.format(reportData.end)}`],
            ["Revenue", formatCurrencyForPdf(reportData.revenue)],
            ["Check-ins", String(reportData.visits)],
            ["Avg Daily Rev", formatCurrencyForPdf(reportData.avgDailyRevenue)],
            ["Avg Daily Visits", reportData.avgDailyVisits.toFixed(1)],
            ["Peak Hour", reportData.peakHour],
            ["Quiet Hour", reportData.quietHour],
            ["Top Revenue Day", sanitizePdfText(reportData.topRevenueDay)],
            ["New Monthly", String(reportData.newMembers)],
            ["Monthly Rev", formatCurrencyForPdf(reportData.monthlyRevenue)],
            ["Session Rev", formatCurrencyForPdf(reportData.sessionRevenue)]
        ];

        doc.setFontSize(9);
        lines.forEach(([label, value]) => {
            doc.setFont("helvetica", "bold");
            doc.text(`${label}:`, 8, y);
            doc.setFont("helvetica", "normal");
            doc.text(sanitizePdfText(value), 82, y, { align: "right" });
            y += 5;
        });

        y += 2;
        doc.line(8, y, 72, y);
        y += 6;

        doc.setFontSize(8);
        doc.text(`Generated ${new Date().toLocaleString("en-PH")}`, centerX, y, { align: "center" });

        doc.save(`close-report-${reportData.days}d-${isoDate(reportData.end)}.pdf`);
    };

    return (
        <div className="page-stack">
            <section className="card">
                <div className="section-head">
                    <h2>Revenue Heatmap</h2>
                    <select value={heatmapMonth} onChange={(event) => setHeatmapMonth(event.target.value)}>
                        {monthOptions.map((month) => (
                            <option key={month} value={month}>
                                {monthYearFormatter.format(new Date(`${month}-01T00:00:00`))}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="heatmap-calendar">
                    {heatmap.cells.map((cell) => {
                        if (cell.type === "empty") {
                            return <div key={cell.key} className="heat-empty" aria-hidden="true" />;
                        }

                        const selected = selectedHeatDate === cell.dateKey;
                        return (
                            <button
                                type="button"
                                key={cell.key}
                                className={`heat-date-cell${selected ? " active" : ""}`}
                                style={{ "--level": cell.level }}
                                onClick={() => setSelectedHeatDate(cell.dateKey)}
                                title={`${fullDateFormatter.format(new Date(`${cell.dateKey}T00:00:00`))} - ${pesoFormatter.format(cell.revenue)}`}
                            >
                                {cell.revenue ? pesoFormatter.format(cell.revenue) : "0"}
                            </button>
                        );
                    })}
                </div>
                <p className="heat-date-note">
                    {selectedHeatCell
                        ? `${fullDateFormatter.format(new Date(`${selectedHeatCell.dateKey}T00:00:00`))} • ${pesoFormatter.format(selectedHeatCell.revenue)}`
                        : "Select a date cell to see the exact date and revenue."}
                </p>
            </section>

            <section className="insight-action-cards">
                <button type="button" className="card insight-action-card" onClick={() => setInsightModal("candidates")}>
                    <h3>Session to Monthly Candidates</h3>
                    <p>{conversionCandidates.length} likely converters</p>
                </button>

                <button type="button" className="card insight-action-card" onClick={() => setInsightModal("peak")}> 
                    <h3>Peak-Hour Recommendation</h3>
                    <p>Peak: {formatHourAmPm(peakRecommendation.peak.hour)}</p>
                </button>

                <button type="button" className="card insight-action-card" onClick={() => setInsightModal("report")}>
                    <h3>One-Tap Daily Close Report</h3>
                    <p>{reportData.days === 1 ? (reportDate || "Select date") : `Last ${reportData.days} days`}</p>
                </button>
            </section>

            <section className="card">
                <div className="section-head">
                    <h2>Renewal Prediction</h2>
                    <span>{renewalRadar.urgent.length} urgent</span>
                </div>
                <div className="controls-row">
                    <label>
                        Search
                        <input
                            value={renewalSearch}
                            onChange={(event) => setRenewalSearch(event.target.value)}
                            placeholder="Search member"
                        />
                    </label>
                    <label>
                        Sort
                        <select value={renewalSort} onChange={(event) => setRenewalSort(event.target.value)}>
                            <option value="score-desc">Renewal Likelihood % (High to Low)</option>
                            <option value="score-asc">Renewal Likelihood % (Low to High)</option>
                        </select>
                    </label>
                </div>
                {renewalRadar.soon.length === 0 ? (
                    <p className="empty-state">No matching monthly members for renewal prediction.</p>
                ) : (
                    <div className="simple-list">
                        {renewalRows.map((item) => (
                            <div className="simple-row" key={item.id}>
                                <span>{item.name} ({item.visitCount} visits)</span>
                                <strong>{item.daysLeft < 0 ? "Expired" : `${item.daysLeft} day(s)`} • {item.renewalScore}%</strong>
                            </div>
                        ))}
                    </div>
                )}
                {renewalRadar.soon.length > 0 ? (
                    <div className="pagination-row">
                        <button type="button" className="pager-btn" onClick={() => setRenewalPage((p) => Math.max(1, p - 1))} disabled={renewalPage <= 1}>Previous</button>
                        <p className="pager-meta">Page {renewalPage} of {renewalTotalPages} ({renewalRadar.soon.length} results)</p>
                        <button type="button" className="pager-btn" onClick={() => setRenewalPage((p) => Math.min(renewalTotalPages, p + 1))} disabled={renewalPage >= renewalTotalPages}>Next</button>
                    </div>
                ) : null}
            </section>

            {insightModal ? (
                <div className="home-modal-backdrop" role="presentation" onClick={() => setInsightModal("")}
                >
                    <section
                        className="home-modal-card"
                        role="dialog"
                        aria-modal="true"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="home-modal-head">
                            <h3>
                                {insightModal === "candidates" && "Session to Monthly Candidates"}
                                {insightModal === "peak" && "Peak-Hour Recommendation"}
                                {insightModal === "report" && "One-Tap Daily Close Report"}
                            </h3>
                            <button type="button" className="home-modal-close" onClick={() => setInsightModal("")}>Close</button>
                        </div>

                        <div className="home-modal-body">
                            {insightModal === "candidates" ? (
                                conversionCandidates.length === 0 ? (
                                    <p className="empty-state">No session names reached 12+ visits in a month yet.</p>
                                ) : (
                                    <>
                                        <div className="insight-candidate-head">
                                            <span>Name</span>
                                            <span>Max Visits/Month</span>
                                            <span>Peak Month</span>
                                        </div>
                                        {candidateRows.map((row) => (
                                            <div key={`${row.name}-${row.monthKey}`} className="insight-candidate-row">
                                                <span>{row.name}</span>
                                                <strong>{row.maxMonthlyVisits}</strong>
                                                <span>{monthYearFormatter.format(new Date(`${row.monthKey}-01T00:00:00`))}</span>
                                            </div>
                                        ))}
                                        <div className="pagination-row">
                                            <button type="button" className="pager-btn" onClick={() => setCandidatePage((p) => Math.max(1, p - 1))} disabled={candidatePage <= 1}>Previous</button>
                                            <p className="pager-meta">Page {candidatePage} of {candidateTotalPages}</p>
                                            <button type="button" className="pager-btn" onClick={() => setCandidatePage((p) => Math.min(candidateTotalPages, p + 1))} disabled={candidatePage >= candidateTotalPages}>Next</button>
                                        </div>
                                    </>
                                )
                            ) : null}

                            {insightModal === "peak" ? (
                                <>
                                    <p className="tiny-note">All-time average peak: {formatHourAmPm(peakRecommendation.peak.hour)} ({peakRecommendation.peak.avgVisits.toFixed(1)} visits/day)</p>
                                    <p className="tiny-note">Least visitors in open hours: {formatHourAmPm(peakRecommendation.quiet.hour)} ({peakRecommendation.quiet.avgVisits.toFixed(1)} visits/day)</p>
                                    <div className="simple-list">
                                        {peakRecommendation.cleaningSlots.map((slot) => (
                                            <div key={`${slot.triggerHour}-${slot.cleanHour}`} className="simple-row">
                                                <span>{slot.label}</span>
                                                <strong>{formatHourAmPm(slot.cleanHour)}</strong>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="insight">{peakRecommendation.recommendation}</p>
                                </>
                            ) : null}

                            {insightModal === "report" ? (
                                <>
                                    <div className="controls-row">
                                        <label>
                                            Date
                                            <select value={reportDate} onChange={(event) => setReportDate(event.target.value)}>
                                                {dayOptions.map((day) => <option key={day}>{day}</option>)}
                                            </select>
                                        </label>
                                        <label>
                                            Period
                                            <select value={reportWindow} onChange={(event) => setReportWindow(event.target.value)}>
                                                <option value="daily">Daily</option>
                                                <option value="7">Last 7 days</option>
                                                <option value="15">Last 15 days</option>
                                                <option value="30">Last 30 days</option>
                                            </select>
                                        </label>
                                    </div>
                                    <div className="report-summary-card">
                                        <p>{reportData.days === 1 ? "Daily Summary" : `${reportData.days}-Day Summary`}</p>
                                        <h3>{pesoFormatter.format(reportData.revenue)}</h3>
                                        <span>{reportData.visits} check-ins • Peak {reportData.peakHour}</span>
                                    </div>
                                    <div className="report-actions">
                                        <button type="button" className="secondary-btn" onClick={generateCloseReport}>Generate Report</button>
                                        <button type="button" className="secondary-btn report-download-btn" onClick={downloadCloseReportPdf}>Download PDF</button>
                                    </div>
                                    {reportText ? <pre className="report-output">{reportText}</pre> : null}
                                </>
                            ) : null}
                        </div>
                    </section>
                </div>
            ) : null}
        </div>
    );
};

const AddMemberPage = ({ onAddMember }) => {
    const [name, setName] = useState("");
    const [gender, setGender] = useState("Male");
    const [startDate, setStartDate] = useState(isoDate(new Date()));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [qrPayload, setQrPayload] = useState("");
    const [qrMeta, setQrMeta] = useState(null);

    const endDate = useMemo(() => {
        if (!startDate) return "";
        return isoDate(addOneCalendarMonth(startDate));
    }, [startDate]);

    useEffect(() => {
        if (!startDate) {
            setStartDate(isoDate(new Date()));
        }
    }, [startDate]);

    const submit = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError("");
        setSuccess("");
        setQrPayload("");
        setQrMeta(null);

        try {
            const member = await onAddMember({
                name,
                gender,
                membership_type: "Monthly",
                start_date: startDate,
                end_date: endDate
            });

            const payload = JSON.stringify({
                member_id: member.id,
                member_name: member.name,
                membership: "monthly",
                issued_at: new Date().toISOString()
            });

            setSuccess(
                `Added ${member.name}. Membership ends on ${fullDateFormatter.format(new Date(endDate))}.`
            );
            setQrPayload(payload);
            setQrMeta({
                id: member.id,
                name: member.name,
                startDate,
                endDate
            });
            setName("");
            setGender("Male");
            setStartDate(isoDate(new Date()));
        } catch (submitError) {
            setError(submitError.message || "Failed to add member.");
        } finally {
            setLoading(false);
        }
    };

    const downloadQr = async () => {
        if (!qrPayload) return;

        const qrUrl = `https://quickchart.io/qr?size=512&text=${encodeURIComponent(qrPayload)}`;
        const fileStem = qrMeta?.name
            ? String(qrMeta.name).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
            : "member";

        try {
            const response = await fetch(qrUrl);
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = objectUrl;
            anchor.download = `${fileStem || "member"}-qr.png`;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(objectUrl);
        } catch {
            window.open(qrUrl, "_blank", "noopener,noreferrer");
        }
    };

    return (
        <section className="card form-card">
            <h2>Add New Monthly Member</h2>
            <p className="tiny-note">This action creates a Monthly member with the selected start and end dates.</p>

            <div className="date-summary-chip" aria-live="polite">
                <span>{fullDateFormatter.format(new Date(startDate))}</span>
                <strong>to</strong>
                <span>{fullDateFormatter.format(new Date(endDate))}</span>
            </div>

            <form className="member-form" onSubmit={submit}>
                <label>
                    Full Name
                    <input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Enter member name"
                        required
                    />
                </label>

                <label>
                    Gender
                    <select value={gender} onChange={(event) => setGender(event.target.value)}>
                        <option>Male</option>
                        <option>Female</option>
                    </select>
                </label>

                <label className="date-label">
                    Start Date
                    <input
                        className="date-input"
                        type="date"
                        value={startDate}
                        onChange={(event) => {
                            const nextDate = event.target.value || isoDate(new Date());
                            setStartDate(nextDate);
                        }}
                        required
                    />
                </label>

                <button type="submit" disabled={loading}>{loading ? "Saving..." : "Add Member"}</button>
            </form>

            {error ? <p className="form-error">{error}</p> : null}
            {success ? <p className="form-success">{success}</p> : null}

            {qrPayload ? (
                <div className="qr-box">
                    <div className="qr-box-head">
                        <p className="tiny-note">Member QR (scan for check-in identity)</p>
                        <button type="button" className="secondary-btn qr-download-btn" onClick={downloadQr}>Download QR</button>
                    </div>

                    <div className="qr-box-content">
                        <img
                            className="qr-image"
                            alt="Member QR code"
                            src={`https://quickchart.io/qr?size=260&text=${encodeURIComponent(qrPayload)}`}
                        />

                        <div className="qr-meta">
                            <div className="simple-row">
                                <span>Name</span>
                                <strong>{qrMeta?.name || "-"}</strong>
                            </div>
                            <div className="simple-row">
                                <span>Member ID</span>
                                <strong>{qrMeta?.id || "-"}</strong>
                            </div>
                            <div className="simple-row">
                                <span>Membership</span>
                                <strong>Monthly</strong>
                            </div>
                            <div className="simple-row">
                                <span>Coverage</span>
                                <strong>
                                    {qrMeta
                                        ? `${fullDateFormatter.format(new Date(qrMeta.startDate))} - ${fullDateFormatter.format(new Date(qrMeta.endDate))}`
                                        : "-"}
                                </strong>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </section>
    );
};

const AppShell = ({ onLogout, members, checkIns, loading, error, onAddMember, theme, onToggleTheme }) => {
    const navRef = useRef(null);
    const location = useLocation();
    const [activeOutline, setActiveOutline] = useState(null);

    const latestTimeInByMember = useMemo(() => {
        const map = new Map();

        checkIns.forEach((entry) => {
            const id = entry.member_id;
            if (!id) return;

            const dateKey = getDateKey(entry);
            if (!dateKey) return;

            const time = String(entry.check_in_time || "00:00:00");
            const stamp = `${dateKey}T${time}`;

            if (!map.has(id) || stamp > map.get(id).stamp) {
                const parsedDate = new Date(`${dateKey}T00:00:00`);
                const dateLabel = `${parsedDate.toLocaleString("en-PH", { month: "long" })} - ${parsedDate.getDate()} - ${parsedDate.getFullYear()}`;
                map.set(id, {
                    stamp,
                    label: `${dateLabel} (${formatTimeAmPm(time)})`
                });
            }
        });

        return map;
    }, [checkIns]);

    useEffect(() => {
        const updateOutline = () => {
            const navElement = navRef.current;
            if (!navElement) return;

            const activeTab = navElement.querySelector(".tab-link.active");
            if (!activeTab) {
                setActiveOutline(null);
                return;
            }

            const navRect = navElement.getBoundingClientRect();
            const activeRect = activeTab.getBoundingClientRect();

            setActiveOutline({
                width: `${activeRect.width}px`,
                height: `${activeRect.height}px`,
                transform: `translate(${activeRect.left - navRect.left}px, ${activeRect.top - navRect.top}px)`
            });
        };

        const frame = requestAnimationFrame(updateOutline);
        window.addEventListener("resize", updateOutline);

        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener("resize", updateOutline);
        };
    }, [location.pathname]);

    const renderTab = (tab) => (
        <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) => isActive ? "tab-link active" : "tab-link"}
        >
            <span className="tab-link-inner">
                <NavIcon name={tab.icon} />
                <span>{tab.label}</span>
            </span>
        </NavLink>
    );

    return (
        <div className="app-shell">
            <header className="top-header">
                <div className="brand-wrap">
                    <img className="brand-logo" src="/logo.png" alt="WYN Fitness" />
                    <div>
                        <p className="brand-sub">WYN FITNESS</p>
                        <h1>Gym Dashboard</h1>
                    </div>
                </div>
                <div className="top-header-actions">
                    <div className="toggle-container">
                        <label htmlFor="switch" className="toggle" aria-label="Toggle theme">
                            <input
                                type="checkbox"
                                className="input"
                                id="switch"
                                checked={theme === "light"}
                                onChange={onToggleTheme}
                            />
                            <div className="icon icon--moon">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                                    <path
                                        fillRule="evenodd"
                                        d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            </div>

                            <div className="icon icon--sun">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                                    <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
                                </svg>
                            </div>
                        </label>
                    </div>
                    <button type="button" className="logout-btn" onClick={onLogout}>Logout</button>
                </div>
            </header>

            <nav className="primary-tabs" aria-label="Primary tabs" ref={navRef}>
                <span
                    className={`tab-active-outline ${activeOutline ? "visible" : ""}`}
                    style={activeOutline || undefined}
                    aria-hidden="true"
                />
                <div className="tabs-group">
                    {tabsLeft.map(renderTab)}
                </div>

                <NavLink
                    to="/add-member"
                    className={({ isActive }) => isActive ? "tab-add active" : "tab-add"}
                    aria-label="Add member"
                >
                    <NavIcon name="add" />
                </NavLink>

                <div className="tabs-group">
                    {tabsRight.map(renderTab)}
                </div>
            </nav>

            <main className="content">
                {error ? <p className="banner-error">{error}</p> : null}
                {loading ? <p className="loading-line">Loading latest gym data...</p> : null}

                <Routes>
                    <Route path="/home" element={<HomePage members={members} checkIns={checkIns} loading={loading} theme={theme} />} />
                    <Route path="/members" element={<MembersPage members={members} latestTimeInByMember={latestTimeInByMember} loading={loading} />} />
                    <Route path="/insights" element={<InsightsPage members={members} checkIns={checkIns} />} />
                    <Route path="/finance" element={<FinancePage checkIns={checkIns} loading={loading} theme={theme} />} />
                    <Route path="/add-member" element={<AddMemberPage onAddMember={onAddMember} />} />
                    <Route path="*" element={<Navigate to="/home" replace />} />
                </Routes>
            </main>
        </div>
    );
};

const App = () => {
    const [token, setToken] = useState(() => getStoredToken());
    const [theme, setTheme] = useState(() => localStorage.getItem("wyn-theme") || "dark");
    const [members, setMembers] = useState([]);
    const [checkIns, setCheckIns] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [loginLoading, setLoginLoading] = useState(false);
    const [loginError, setLoginError] = useState("");

    useEffect(() => {
        document.body.setAttribute("data-theme", theme);
        localStorage.setItem("wyn-theme", theme);
    }, [theme]);

    const loadData = async (activeToken) => {
        setLoading(true);
        setError("");

        try {
            const [memberList, checkInList] = await Promise.all([
                fetchMembers(activeToken),
                fetchCheckIns(activeToken)
            ]);

            setMembers(Array.isArray(memberList) ? memberList : []);
            setCheckIns(Array.isArray(checkInList) ? checkInList : []);
        } catch (loadError) {
            if (loadError.status === 401) {
                clearStoredToken();
                setToken(null);
            }
            setError(loadError.message || "Failed to load data.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!token) return;
        loadData(token);
    }, [token]);

    const handleLogin = async ({ email, password }) => {
        setLoginLoading(true);
        setLoginError("");

        try {
            const result = await loginOwner({ email, password });
            storeToken(result.token);
            setToken(result.token);
        } catch (authError) {
            setLoginError(authError.message || "Invalid credentials");
        } finally {
            setLoginLoading(false);
        }
    };

    const handleLogout = () => {
        clearStoredToken();
        setToken(null);
        setMembers([]);
        setCheckIns([]);
    };

    const toggleTheme = () => {
        setTheme((current) => current === "dark" ? "light" : "dark");
    };

    const handleAddMember = async (payload) => {
        if (!token) throw new Error("Not authenticated");

        try {
            const member = await createMember(token, payload);

            // Refresh members immediately so UI reflects the new member
            try {
                await loadData(token);
            } catch (refreshErr) {
                console.error("Failed to refresh data after creating member:", refreshErr);
            }

            return member;
        } catch (err) {
            console.error("Add member failed:", err);
            // Surface helpful message
            throw new Error(err?.message || "Failed to add member. See console for details.");
        }
    };

    if (!token) {
        return <LoginScreen onLogin={handleLogin} error={loginError} loading={loginLoading} />;
    }

    return (
        <BrowserRouter>
            <AppShell
                onLogout={handleLogout}
                members={members}
                checkIns={checkIns}
                loading={loading}
                error={error}
                onAddMember={handleAddMember}
                        theme={theme}
                        onToggleTheme={toggleTheme}
            />
        </BrowserRouter>
    );
};

export default App;
