// services/api.js
import { API_CONFIG } from '../utils/constants';

class ApiService {
    constructor() {
        this.baseUrl = API_CONFIG.BASE_URL;
        this.headers = {
            'Content-Type': 'application/json',
            'X-API-Key': API_CONFIG.API_KEY,
            'X-Network-Node': API_CONFIG.NETWORK_NODE,
        };
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            ...options,
            headers: {
                ...this.headers,
                ...options.headers,
            },
        };

        try {
            // Simulate network latency
            await this.delay(API_CONFIG.SIMULATED_DELAY);

            const response = await fetch(url, config);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`[API_ERROR] ${error.message}`);
            throw error;
        }
    }

    async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export const apiService = new ApiService();
export default ApiService;