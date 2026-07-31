// hooks/useTelemetryStatus.js
import { useState, useEffect } from 'react';
import { telemetryService } from '../services/telemetryService';
import { SYSTEM_STATUS_POLL_INTERVAL } from '../utils/constants';

// Tracks whether the surveillance backend (/api/telemetry) is reachable and
// exposes the latest telemetry payload. When the backend is missing the
// module is reported as OFFLINE. Re-probed on an interval so the UI recovers
// automatically once the feed comes back online.
export const useTelemetryStatus = () => {
    const [status, setStatus] = useState('CONNECTING');
    const [telemetry, setTelemetry] = useState(null);

    useEffect(() => {
        let active = true;

        const check = async () => {
            try {
                const data = await telemetryService.getTelemetryMetadata();
                if (!active) return;
                setTelemetry(data);
                setStatus('ONLINE');
            } catch (error) {
                if (!active) return;
                console.error('[TELEMETRY] Backend unreachable — going OFFLINE:', error.message);
                setTelemetry(null);
                setStatus('OFFLINE');
            }
        };

        check();
        const interval = setInterval(check, SYSTEM_STATUS_POLL_INTERVAL);

        return () => {
            active = false;
            clearInterval(interval);
        };
    }, []);

    return { status, telemetry };
};

export default useTelemetryStatus;
