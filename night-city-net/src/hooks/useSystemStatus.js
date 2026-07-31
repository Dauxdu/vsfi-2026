// hooks/useSystemStatus.js
import { useState, useEffect } from 'react';
import { systemService } from '../services/systemService';
import { OFFLINE_METADATA, SYSTEM_STATUS_POLL_INTERVAL } from '../utils/constants';

// Tracks whether the backend is reachable and exposes the latest system
// metadata. When the backend is missing (no response from
// /jobs/system-metadata), the system is reported as OFFLINE with safe
// fallback metadata. The backend is re-probed on an interval so the UI
// recovers automatically once the node comes back online.
export const useSystemStatus = () => {
    const [status, setStatus] = useState('CONNECTING');
    const [metadata, setMetadata] = useState(OFFLINE_METADATA);

    useEffect(() => {
        let active = true;

        const checkSystem = async () => {
            try {
                const data = await systemService.getSystemMetadata();
                if (!active) return;
                setMetadata({ ...OFFLINE_METADATA, ...data });
                setStatus('ONLINE');
            } catch (error) {
                if (!active) return;
                console.error('[SYSTEM] Backend unreachable — going OFFLINE:', error.message);
                setMetadata(OFFLINE_METADATA);
                setStatus('OFFLINE');
            }
        };

        checkSystem();
        const interval = setInterval(checkSystem, SYSTEM_STATUS_POLL_INTERVAL);

        return () => {
            active = false;
            clearInterval(interval);
        };
    }, []);

    return { status, metadata };
};

export default useSystemStatus;
