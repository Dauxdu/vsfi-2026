// components/JobsDatabase.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { jobService } from '../services/jobService';
import { calculateStats } from '../utils/helpers';
import DashboardCard from './DashboardCard';
import ControlPanel from './ControlPanel';
import JobsTable from './JobsTable';

const JobsDatabase = () => {
    const [jobs, setJobs] = useState([]);
    const [stats, setStats] = useState({
        totalJobs: 0,
        averagePay: 0,
        successRate: 0,
        riskIndex: 0,
    });
    const [loading, setLoading] = useState(true);
    const [connectionStatus, setConnectionStatus] = useState('connecting');
    const [error, setError] = useState(null);

    // Fetch initial jobs
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                setLoading(true);
                setError(null);

                const initialJobs = await jobService.getInitialJobs();
                setJobs(initialJobs);

                const dashboardStats = await jobService.getDashboardStats(initialJobs);
                setStats(dashboardStats);
            } catch (err) {
                console.error('Failed to fetch initial data:', err);
                setError('CONNECTION_LOST');
                setConnectionStatus('error');
            } finally {
                setLoading(false);
            }
        };

        fetchInitialData();
    }, []);

    // Start SSE stream for live updates
    useEffect(() => {
        const handleNewJob = (newJob) => {
            setJobs(prevJobs => {
                const updatedJobs = [...prevJobs, newJob];
                if (updatedJobs.length > 10) {
                    updatedJobs.shift();
                }

                // Recompute stats from the live job set
                setStats(calculateStats(updatedJobs));
                return updatedJobs;
            });
        };

        const cleanup = jobService.startJobStream(handleNewJob, setConnectionStatus);
        return cleanup;
    }, []);

    // Handle job actions
    const handleAcceptJob = useCallback(async (jobId) => {
        try {
            await jobService.acceptJob(jobId);

            setJobs(prevJobs =>
                prevJobs.map(job =>
                    job.id === jobId ? { ...job, status: 'ACTIVE' } : job
                )
            );
        } catch (error) {
            console.error('Failed to accept job:', error);
        }
    }, []);

    const handleViewJob = useCallback(async (jobId) => {
        try {
            const details = await jobService.getJobDetails(jobId);
            console.log('Job details:', details);
            // You can implement a modal or navigation here
            alert(`Viewing job details for: ${jobId}`);
        } catch (error) {
            console.error('Failed to view job:', error);
        }
    }, []);

    const statsData = [
        { icon: '📊', label: 'TOTAL JOBS', value: stats.totalJobs, trend: '▲ 12%', trendType: 'positive' },
        { icon: '₡', label: 'AVERAGE PAY', value: `₡${stats.averagePay.toLocaleString()}`, trend: '▼ 3%', trendType: 'negative' },
        { icon: '✅', label: 'SUCCESS RATE', value: `${stats.successRate}%`, trend: '▲ 5%', trendType: 'positive' },
        { icon: '⚠️', label: 'RISK INDEX', value: `${stats.riskIndex}%`, trend: 'HIGH', trendType: 'negative' },
        { icon: '🔗', label: 'SSE STREAM', value: connectionStatus.toUpperCase(), isStatus: true, statusType: connectionStatus },
    ];

    if (error) {
        return (
            <div className="jobs-database">
                <div className="error-container">
                    <div className="error-icon">⚠️</div>
                    <h2 className="error-title">CONNECTION_ERROR</h2>
                    <p className="error-message">{error}</p>
                    <button
                        className="cyberpunk-button primary"
                        onClick={() => window.location.reload()}
                    >
                        RECONNECT
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="jobs-database">
            <div className="dashboard-grid">
                {statsData.map((stat, index) => (
                    <DashboardCard key={index} {...stat} />
                ))}
            </div>

            <ControlPanel connectionStatus={connectionStatus} />

            <JobsTable
                jobs={jobs}
                onAcceptJob={handleAcceptJob}
                onViewJob={handleViewJob}
            />

            {loading && (
                <div className="loading-overlay">
                    <div className="loading-spinner"></div>
                    <p>ACCESSING_NIGHT_CITY_DATABASE...</p>
                </div>
            )}
        </div>
    );
};

export default JobsDatabase;