// utils/helpers.js

export const calculateStats = (jobs) => {
    const totalPay = jobs.reduce((sum, job) => sum + job.pay, 0);
    jobs.filter(job => job.status === 'ACTIVE').length;
    const completedJobs = jobs.filter(job => job.status === 'COMPLETED').length;

    return {
        totalJobs: jobs.length,
        averagePay: jobs.length ? Math.floor(totalPay / jobs.length) : 0,
        successRate: jobs.length
            ? Math.floor((completedJobs / jobs.length) * 100) + Math.floor(Math.random() * 20)
            : 0,
        riskIndex: Math.floor(Math.random() * 100),
    };
};

export const getRiskColor = (risk) => {
    const colors = {
        EXTREME: 'var(--cyber-pink)',
        HIGH: '#ff6b35',
        MEDIUM: 'var(--cyber-yellow)',
        LOW: '#00ff41',
    };
    return colors[risk] || 'var(--cyber-text)';
};

export const getStatusClass = (status) => {
    return `status-${status.toLowerCase()}`;
};

export const formatCurrency = (amount) => {
    return `₡${amount.toLocaleString()}`;
};

export const formatTimestamp = (date) => {
    return date.toLocaleTimeString('en-US', { hour12: false });
};