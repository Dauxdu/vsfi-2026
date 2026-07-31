// utils/constants.js
export const API_CONFIG = {
    // Backend is served from the same origin as the frontend.
    BASE_URL: '/api',

    // API authentication
    API_KEY: 'nc-net-7749-key',

    // Network node identifier
    NETWORK_NODE: 'NIGHT_CITY_PRIMARY',

    // Simulated network delay in ms (remove for production)
    SIMULATED_DELAY: 200,
};

export const SSE_CONFIG = {
    // Interval for mock SSE updates (ms)
    INTERVAL: 4000,

    // Maximum reconnection attempts
    MAX_RECONNECT_ATTEMPTS: 5,

    // Delay between reconnection attempts (ms)
    RECONNECT_DELAY: 3000,
};

// Backend endpoints (relative to API_CONFIG.BASE_URL -> /api)
// Job API:          /api/jobs/*
// Surveillance API: /api/telemetry
export const SYSTEM_METADATA_ENDPOINT = '/jobs/system-metadata';
export const JOB_STREAM_ENDPOINT = '/jobs/stream';
export const JOBS_ACTIVE_ENDPOINT = '/jobs/active';
export const TELEMETRY_METADATA_ENDPOINT = '/telemetry/metadata';
export const TELEMETRY_EVENTS_ENDPOINT = '/telemetry/events';
export const TELEMETRY_AUDIO_ENDPOINT = '/telemetry/audio';

// Fallback system metadata used when the backend is unreachable / offline.
export const OFFLINE_METADATA = {
    latency: 0,
    uplink: false,
    encryptLevel: 'NONE',
    sysId: 'NC-NET-7749',
    securityLevel: 0,
};

// How often (ms) to re-probe the backend for its status / metadata.
export const SYSTEM_STATUS_POLL_INTERVAL = 10000;
