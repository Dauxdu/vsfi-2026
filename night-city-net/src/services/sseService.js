// services/sseService.js
import { API_CONFIG, SSE_CONFIG } from '../utils/constants';

class SSEService {
    constructor() {
        this.eventSources = new Map();
        this.reconnectAttempts = new Map();
    }

    connect(endpoint, { onMessage, onOpen, onError } = {}) {
        const url = `${API_CONFIG.BASE_URL}${endpoint}`;
        const eventSource = new EventSource(url);

        eventSource.onopen = () => {
            console.log(`[SSE] Connected to ${endpoint}`);
            this.reconnectAttempts.set(endpoint, 0);
            onOpen?.();
        };

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                onMessage?.(data);
            } catch (error) {
                console.error('[SSE_PARSE_ERROR]', error);
            }
        };

        eventSource.onerror = (error) => {
            console.error(`[SSE_ERROR] ${endpoint}:`, error);
            onError?.(error);

            const attempts = this.reconnectAttempts.get(endpoint) || 0;

            // Tear down the failed source so we control the retry cadence
            // (and don't stack it on top of the browser's own retry).
            eventSource.close();
            this.eventSources.delete(endpoint);

            if (attempts < SSE_CONFIG.MAX_RECONNECT_ATTEMPTS) {
                this.reconnectAttempts.set(endpoint, attempts + 1);

                setTimeout(() => {
                    console.log(`[SSE] Reconnecting to ${endpoint} (attempt ${attempts + 1})`);
                    this.connect(endpoint, { onMessage, onOpen, onError });
                }, SSE_CONFIG.RECONNECT_DELAY);
            } else {
                console.error(`[SSE] Max reconnection attempts reached for ${endpoint}`);
            }
        };

        this.eventSources.set(endpoint, eventSource);
        return eventSource;
    }

    disconnect(endpoint) {
        const eventSource = this.eventSources.get(endpoint);
        if (eventSource) {
            eventSource.close();
            this.eventSources.delete(endpoint);
            this.reconnectAttempts.delete(endpoint);
            console.log(`[SSE] Disconnected from ${endpoint}`);
        }
    }

    disconnectAll() {
        this.eventSources.forEach((_, endpoint) => {
            this.disconnect(endpoint);
        });
    }
}

export const sseService = new SSEService();
export default SSEService;