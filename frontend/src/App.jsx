import React, { useEffect, useMemo, useRef, useState } from "react";
import Chart from "chart.js/auto";

const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const dashboardData = {
    adminName: "Zwei",
    metrics: [
        {
            label: "Active Members",
            value: 1248,
            delta: "+3.2% vs last month",
            trend: "positive"
        },
        {
            label: "Trainers",
            value: 18,
            delta: "+2 new this month",
            trend: "positive"
        },
        {
            label: "Revenue This Month",
            value: 420000,
            delta: "+8.4% vs last month",
            trend: "positive",
            isCurrency: true
        },
        {
            label: "Today's Attendance",
            value: 186,
            delta: "-2.1% vs yesterday",
            trend: "negative"
        }
    ],
    revenueThisYear: [
        280000, 295000, 310000, 332000, 355000, 368000,
        390000, 410000, 398000, 420000, 438000, 452000
    ],
    revenueLastYear: [
        240000, 255000, 268000, 280000, 292000, 305000,
        318000, 330000, 320000, 340000, 350000, 362000
    ]
};

const weeklyAttendance = [122, 135, 148, 154, 167, 142, 128];

const statusMembers = [
    { name: "Alyssa Tan", status: "Active", phone: "0917-102-1111", joined: "2023-03-12" },
    { name: "Carlo Reyes", status: "Due", phone: "0917-204-2931", joined: "2024-01-09" },
    { name: "Dana Cruz", status: "Expired", phone: "0917-999-1910", joined: "2022-11-21" },
    { name: "Ethan Lim", status: "Active", phone: "0918-384-7742", joined: "2025-02-03" },
    { name: "Faith Ramos", status: "Due", phone: "0919-882-4490", joined: "2024-06-15" },
    { name: "Gino Dela Pena", status: "Active", phone: "0921-702-5510", joined: "2023-08-26" },
    { name: "Hazel Ong", status: "Expired", phone: "0922-818-3339", joined: "2022-04-30" },
    { name: "Ivan Santos", status: "Active", phone: "0917-334-1001", joined: "2024-12-11" }
];

const membersData = [
    { name: "Alyssa Tan", email: "alyssa.tan@email.com", phone: "0917-102-1111", joined: "2023-03-12", sex: "Female" },
    { name: "Carlo Reyes", email: "carlo.reyes@email.com", phone: "0917-204-2931", joined: "2024-01-09", sex: "Male" },
    { name: "Dana Cruz", email: "dana.cruz@email.com", phone: "0917-999-1910", joined: "2022-11-21", sex: "Female" },
    { name: "Ethan Lim", email: "ethan.lim@email.com", phone: "0918-384-7742", joined: "2025-02-03", sex: "Male" },
    { name: "Faith Ramos", email: "faith.ramos@email.com", phone: "0919-882-4490", joined: "2024-06-15", sex: "Female" },
    { name: "Gino Dela Pena", email: "gino.delapena@email.com", phone: "0921-702-5510", joined: "2023-08-26", sex: "Male" },
    { name: "Hazel Ong", email: "hazel.ong@email.com", phone: "0922-818-3339", joined: "2022-04-30", sex: "Female" },
    { name: "Ivan Santos", email: "ivan.santos@email.com", phone: "0917-334-1001", joined: "2024-12-11", sex: "Male" },
    { name: "Jessa Valdez", email: "jessa.valdez@email.com", phone: "0916-774-9981", joined: "2023-07-19", sex: "Female" },
    { name: "Kai Mendoza", email: "kai.mendoza@email.com", phone: "0920-221-8021", joined: "2024-03-08", sex: "Other" },
    { name: "Lara Bautista", email: "lara.bautista@email.com", phone: "0918-200-0442", joined: "2022-10-13", sex: "Female" },
    { name: "Miko Rivera", email: "miko.rivera@email.com", phone: "0917-100-2211", joined: "2025-01-27", sex: "Male" },
    { name: "Nina Flores", email: "nina.flores@email.com", phone: "0917-422-9989", joined: "2023-05-10", sex: "Female" },
    { name: "Owen Javier", email: "owen.javier@email.com", phone: "0919-124-5533", joined: "2024-04-19", sex: "Male" },
    { name: "Pia Navarro", email: "pia.navarro@email.com", phone: "0923-777-1234", joined: "2023-01-05", sex: "Female" },
    { name: "Quinn Lee", email: "quinn.lee@email.com", phone: "0918-555-2210", joined: "2022-12-29", sex: "Other" }
];

const formatNumber = (value) => Number(value).toLocaleString("en-PH");
const formatPeso = (value) => `PHP ${formatNumber(value)}`;
const formatDate = (value) => new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric"
});

const LineChart = ({ labels, datasets, yTitle, xTitle, yTickFormatter, tooltipFormatter }) => {
    const canvasRef = useRef(null);
    const chartRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return undefined;

        if (chartRef.current) {
            chartRef.current.destroy();
        }

        chartRef.current = new Chart(canvas, {
            type: "line",
            data: {
                labels,
                datasets: datasets.map((dataset) => ({
                    ...dataset,
                    pointBackgroundColor: "#fff",
                    borderWidth: 2.5,
                    pointRadius: 4,
                    tension: 0.35
                }))
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 500 },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => tooltipFormatter(context.dataset.label, context.parsed.y)
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: xTitle,
                            color: "#4b6a8a",
                            font: { family: "'IBM Plex Sans'", weight: 600 }
                        },
                        grid: { color: "rgba(11, 31, 59, 0.08)" },
                        ticks: {
                            color: "#4b6a8a",
                            font: { family: "'IBM Plex Sans'", size: 12 }
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: yTitle,
                            color: "#4b6a8a",
                            font: { family: "'IBM Plex Sans'", weight: 600 }
                        },
                        grid: {
                            color: "rgba(11, 31, 59, 0.12)",
                            borderDash: [4, 6]
                        },
                        ticks: {
                            color: "#4b6a8a",
                            font: { family: "'IBM Plex Sans'", size: 12 },
                            callback: (value) => yTickFormatter(value)
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
    }, [labels, datasets, xTitle, yTitle, yTickFormatter, tooltipFormatter]);

    return <canvas ref={canvasRef} className="chart-canvas" aria-label="Line chart" role="img" />;
};

const RevenueChart = ({ data }) => {
    const revenueDatasets = [
        {
            label: "This year",
            data: data.revenueThisYear,
            borderColor: "#2f6fde",
            pointBorderColor: "#2f6fde",
            backgroundColor: "rgba(47, 111, 222, 0.16)"
        },
        {
            label: "Last year",
            data: data.revenueLastYear,
            borderColor: "#7fb3ff",
            pointBorderColor: "#7fb3ff",
            backgroundColor: "rgba(127, 179, 255, 0.16)"
        }
    ];

    return (
        <LineChart
            labels={months}
            datasets={revenueDatasets}
            xTitle="Month"
            yTitle="Revenue (PHP)"
            yTickFormatter={(value) => formatPeso(value)}
            tooltipFormatter={(label, value) => `${label}: ${formatPeso(value)}`}
        />
    );
};

const StatusAttendanceChart = () => (
    <LineChart
        labels={weekDays}
        datasets={[
            {
                label: "Weekly attendance",
                data: weeklyAttendance,
                borderColor: "#2f6fde",
                pointBorderColor: "#2f6fde",
                backgroundColor: "rgba(47, 111, 222, 0.16)"
            }
        ]}
        xTitle="Days of the Week"
        yTitle="People"
        yTickFormatter={(value) => formatNumber(value)}
        tooltipFormatter={(label, value) => `${label}: ${formatNumber(value)} people`}
    />
);

const HomePage = () => (
    <>
        <section className="welcome">
            <div>
                <h1>Welcome back, {dashboardData.adminName}!</h1>
                <p className="welcome-subtitle">
                    Here is a snapshot of your gym performance this month. Your best performing days are Tuesdays and Fridays.
                </p>
            </div>
            <div className="quick-actions">
                <button>Add Member</button>
                <button className="secondary">Generate Report</button>
            </div>
        </section>

        <section className="metrics-grid">
            {dashboardData.metrics.map((metric) => (
                <div key={metric.label} className="metric-card">
                    <div className="label">{metric.label}</div>
                    <div className="value">
                        {metric.isCurrency ? formatPeso(metric.value) : formatNumber(metric.value)}
                    </div>
                    <div className={`delta ${metric.trend}`}>{metric.delta}</div>
                </div>
            ))}
        </section>

        <section className="chart-card">
            <div className="chart-header">
                <div>
                    <h2>Monthly Revenue Comparison</h2>
                    <p className="chart-subtitle">
                        Current year vs last year. X-axis is the month, Y-axis is revenue in PHP.
                    </p>
                </div>
                <div className="legend">
                    <span><i className="line-one"></i>This year</span>
                    <span><i className="line-two"></i>Last year</span>
                </div>
            </div>
            <div className="chart-wrap">
                <RevenueChart data={dashboardData} />
            </div>
        </section>
    </>
);

const StatusPage = () => {
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("All status");

    const filteredMembers = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        return statusMembers.filter((member) => {
            const matchesStatus = statusFilter === "All status" || member.status === statusFilter;
            const matchesSearch = member.name.toLowerCase().includes(normalizedSearch) || member.phone.toLowerCase().includes(normalizedSearch);
            return matchesStatus && matchesSearch;
        });
    }, [searchTerm, statusFilter]);

    const currentDate = new Date().toLocaleDateString("en-PH", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
    });

    return (
        <div className="view-stack">
            <section className="section-card">
                <p className="section-date">{currentDate}</p>
                <h2 className="section-title">Weekly Attendance</h2>
                <div className="chart-wrap chart-wrap-status">
                    <StatusAttendanceChart />
                </div>
            </section>

            <section className="section-card">
                <div className="section-heading-row">
                    <h2 className="section-title">Member Status</h2>
                    <span className="table-meta">{filteredMembers.length} member{filteredMembers.length === 1 ? "" : "s"}</span>
                </div>
                <div className="filters-row">
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Search by name or phone"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                    />
                    <select
                        className="filter-select"
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                    >
                        <option>All status</option>
                        <option>Active</option>
                        <option>Due</option>
                        <option>Expired</option>
                    </select>
                </div>

                <div className="table-wrap">
                    <table className="members-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Status</th>
                                <th>Phone</th>
                                <th>Joined</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredMembers.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="table-empty">No members matched your filters.</td>
                                </tr>
                            ) : (
                                filteredMembers.map((member) => (
                                    <tr key={`${member.name}-${member.phone}`}>
                                        <td>{member.name}</td>
                                        <td>
                                            <span className={`status-badge ${member.status.toLowerCase()}`}>{member.status}</span>
                                        </td>
                                        <td>{member.phone}</td>
                                        <td>{formatDate(member.joined)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
};

const MembersPage = () => {
    const PAGE_SIZE = 6;
    const [sexFilter, setSexFilter] = useState("All");
    const [searchTerm, setSearchTerm] = useState("");
    const [page, setPage] = useState(1);

    const filteredMembers = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        return membersData.filter((member) => {
            const matchesSex = sexFilter === "All" || member.sex === sexFilter;
            const matchesSearch = member.name.toLowerCase().includes(normalizedSearch) || member.email.toLowerCase().includes(normalizedSearch);
            return matchesSex && matchesSearch;
        });
    }, [sexFilter, searchTerm]);

    const totalPages = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE));

    useEffect(() => {
        setPage(1);
    }, [sexFilter, searchTerm]);

    useEffect(() => {
        if (page > totalPages) {
            setPage(totalPages);
        }
    }, [page, totalPages]);

    const paginatedMembers = filteredMembers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const startRow = filteredMembers.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const endRow = Math.min(page * PAGE_SIZE, filteredMembers.length);

    return (
        <section className="section-card">
            <div className="section-heading-row">
                <h2 className="section-title">Members</h2>
                <span className="table-meta">{filteredMembers.length} total</span>
            </div>

            <div className="filters-stack">
                <div className="filters-row">
                    <label className="inline-label" htmlFor="sex-filter">Filter by sex</label>
                    <select
                        id="sex-filter"
                        className="filter-select"
                        value={sexFilter}
                        onChange={(event) => setSexFilter(event.target.value)}
                    >
                        <option>All</option>
                        <option>Female</option>
                        <option>Male</option>
                        <option>Other</option>
                    </select>
                </div>

                <input
                    type="text"
                    className="search-input"
                    placeholder="Search specific members"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                />
            </div>

            <div className="table-wrap">
                <table className="members-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Joined</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedMembers.length === 0 ? (
                            <tr>
                                <td colSpan="4" className="table-empty">No members found for this view.</td>
                            </tr>
                        ) : (
                            paginatedMembers.map((member) => (
                                <tr key={`${member.name}-${member.email}`}>
                                    <td>{member.name}</td>
                                    <td>{member.email}</td>
                                    <td>{member.phone}</td>
                                    <td>{formatDate(member.joined)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="pagination-row">
                <button
                    type="button"
                    className="pager-btn"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page <= 1}
                >
                    Previous
                </button>
                <p className="pager-meta">
                    Showing {startRow}-{endRow} of {filteredMembers.length} members. Page {page} of {totalPages}.
                </p>
                <button
                    type="button"
                    className="pager-btn"
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={page >= totalPages}
                >
                    Next
                </button>
            </div>
        </section>
    );
};

const App = () => {
    const [activePage, setActivePage] = useState("Home");

    const pages = {
        Home: <HomePage />,
        Status: <StatusPage />,
        Members: <MembersPage />
    };

    const navItems = Object.keys(pages);

    return (
        <div className="page">
            <nav className="top-nav">
                <div className="nav-inner">
                    <div className="brand">Wyn<span>Fitness</span></div>
                    <div className="nav-links" role="tablist" aria-label="Main pages">
                        {navItems.map((item) => (
                            <button
                                key={item}
                                type="button"
                                className={activePage === item ? "active" : ""}
                                onClick={() => setActivePage(item)}
                                role="tab"
                                aria-selected={activePage === item}
                            >
                                {item}
                            </button>
                        ))}
                    </div>
                    <div className="nav-actions">
                        <span className="pill">April 2026</span>
                        <div className="avatar">AP</div>
                    </div>
                </div>
            </nav>

            <main>{pages[activePage]}</main>
        </div>
    );
};

export default App;
