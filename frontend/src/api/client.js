const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
export const TOKEN_KEY = "gym_token";

const request = async (endpoint, { method = "GET", body, token } = {}) => {
    const headers = {
        "Content-Type": "application/json"
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const error = new Error(data.error || "Request failed");
        error.status = response.status;
        throw error;
    }

    return data;
};

export const getStoredToken = () => localStorage.getItem(TOKEN_KEY);

export const storeToken = (token) => {
    localStorage.setItem(TOKEN_KEY, token);
};

export const clearStoredToken = () => {
    localStorage.removeItem(TOKEN_KEY);
};

export const loginOwner = async ({ email, password }) =>
    request("/auth/login", {
        method: "POST",
        body: { email, password }
    });

export const fetchDashboardMetrics = async (token) => request("/analytics/dashboard", { token });

export const fetchRevenue = async (token) => request("/analytics/revenue", { token });

export const fetchPeakHours = async (token) => request("/analytics/peak-hours", { token });

export const fetchWeeklyAttendance = async (token) =>
    request("/analytics/weekly-attendance", { token });

export const fetchMembers = async (token) => request("/members", { token });

export const fetchCheckIns = async (token) => request("/check-ins", { token });

export const createMember = async (token, payload) =>
    request("/members", {
        method: "POST",
        token,
        body: payload
    });

export const logCheckIn = async (token, payload) =>
    request("/check-ins", {
        method: "POST",
        token,
        body: payload
    });
