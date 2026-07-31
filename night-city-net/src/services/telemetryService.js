// services/telemetryService.js
import {apiService} from './api';
import {TELEMETRY_AUDIO_ENDPOINT, TELEMETRY_EVENTS_ENDPOINT, TELEMETRY_METADATA_ENDPOINT} from '../utils/constants';

class TelemetryService {
    // Fetch surveillance telemetry from the backend (GET /api/telemetry).
    // Throws if the backend is unreachable, so callers can flip to OFFLINE.
    async getTelemetryMetadata() {
        return apiService.get(TELEMETRY_METADATA_ENDPOINT);
    }

    async getTelemetryEvents() {
        return apiService.get(TELEMETRY_EVENTS_ENDPOINT);
    }

    async getTelemetryAudio() {
        return apiService.get(TELEMETRY_AUDIO_ENDPOINT)
    }
}

export const telemetryService = new TelemetryService();
export default TelemetryService;
