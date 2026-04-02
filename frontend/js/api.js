// frontend/js/api.js

// This is the URL where your Node.js backend is running
const API_BASE_URL = 'http://localhost:3000/api'; 

/**
 * 1. Authentication (Login)
 * Sends email/password to the backend and saves the token if successful.
 */
export const loginOwner = async (email, password) => {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) throw new Error(data.error || 'Login failed');
        
        // Save the JWT token to localStorage so we can use it for protected routes
        localStorage.setItem('gym_token', data.token);
        return data;
    } catch (error) {
        console.error("Login Error:", error);
        throw error;
    }
};

/**
 * 2. Fetching Dashboard Metrics
 * We will use this in the next step when we build the dashboard!
 */
export const fetchDashboardMetrics = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/analytics/dashboard`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                // Attach the saved token to prove we are logged in
                'Authorization': `Bearer ${localStorage.getItem('gym_token')}` 
            }
        });

        if (!response.ok) {
            // If token is expired or invalid, send them back to login
            if (response.status === 401) window.location.href = '/index.html'; 
            throw new Error('Failed to fetch dashboard metrics');
        }

        return await response.json();
    } catch (error) {
        console.error("Dashboard Error:", error);
        return null;
    }
};