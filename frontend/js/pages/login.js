import { loginOwner } from '../api.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Check if already logged in. If yes, skip login and go to dashboard.
    const existingToken = localStorage.getItem('gym_token');
    if (existingToken) {
        window.location.href = '/';
        return;
    }

    // 2. Grab DOM elements
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('error-message');
    const submitBtn = document.getElementById('login-btn');

    // 3. Handle Form Submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Stop the page from reloading

        // Reset UI state
        errorMessage.style.display = 'none';
        submitBtn.textContent = 'Signing in...';
        submitBtn.disabled = true;

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        try {
            // Call the real backend API (from the api.js file we discussed earlier)
            const response = await loginOwner(email, password);
            
            // If successful, api.js already saved the token to localStorage.
            // Just redirect to the dashboard!
            window.location.href = '/';
            
        } catch (error) {
            // If login fails (wrong password, server down, etc.)
            errorMessage.textContent = error.message || 'Invalid email or password';
            errorMessage.style.display = 'block';
            submitBtn.textContent = 'Sign In';
            submitBtn.disabled = false;
        }
    });
});