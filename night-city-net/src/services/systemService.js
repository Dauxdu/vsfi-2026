// services/systemService.js
import { apiService } from './api';
import { SYSTEM_METADATA_ENDPOINT } from '../utils/constants';

class SystemService {
    // Fetch live system metadata from the backend.
    // Throws if the backend is unreachable, so callers can flip to OFFLINE.
    async getSystemMetadata() {
        // GET /jobs/system-metadata ->
        // { latency, uplink, encryptLevel, sysId, securityLevel }
        return apiService.get(SYSTEM_METADATA_ENDPOINT);
    }
}

export const systemService = new SystemService();
export default SystemService;
