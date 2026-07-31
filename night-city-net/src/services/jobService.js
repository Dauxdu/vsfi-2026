// services/jobService.js
import { apiService } from './api';
import { sseService } from './sseService';
import { calculateStats } from '../utils/helpers';
import { JOBS_ACTIVE_ENDPOINT, JOB_STREAM_ENDPOINT } from '../utils/constants';

class JobService {
    constructor() {
        this.isStreaming = false;
    }

    // Fetch the current active jobs from the backend.
    async getInitialJobs() {
        return apiService.get(JOBS_ACTIVE_ENDPOINT);
    }

    // Derive dashboard statistics from the live job set.
    async getDashboardStats(jobs) {
        return calculateStats(jobs);
    }

    // Open the live job stream (SSE). onJob receives each new job,
    // onStatusChange receives 'connecting' | 'connected' | 'error'.
    startJobStream(onJob, onStatusChange) {
        if (this.isStreaming) {
            console.warn('[SSE] Stream already active');
            return () => this.stopJobStream();
        }

        this.isStreaming = true;
        onStatusChange?.('connecting');

        sseService.connect(JOB_STREAM_ENDPOINT, {
            onOpen: () => onStatusChange?.('connected'),
            onMessage: (job) => onJob?.(job),
            onError: () => onStatusChange?.('error'),
        });

        return () => this.stopJobStream();
    }

    stopJobStream() {
        if (this.isStreaming) {
            sseService.disconnect(JOB_STREAM_ENDPOINT);
            this.isStreaming = false;
        }
    }

    // Accept a job.
    async acceptJob(jobId) {
        return apiService.post(`/jobs/${jobId}/accept`);
    }

    // Load full details for a single job.
    async getJobDetails(jobId) {
        return apiService.get(`/jobs/${jobId}`);
    }
}

export const jobService = new JobService();
export default JobService;
