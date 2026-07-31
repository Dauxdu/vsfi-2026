// components/SurveillanceModule.jsx
import React, {useState, useEffect, useRef} from 'react';
import {useTelemetryStatus} from '../hooks/useTelemetryStatus';
import {telemetryService} from "../services/telemetryService.js";

const SurveillanceModule = () => {
    const {status, telemetry} = useTelemetryStatus();
    const [events, setEvents] = useState([]);
    const [eventsLoading, setEventsLoading] = useState(false);
    const [eventsError, setEventsError] = useState(null);

    // Audio state
    const [audioRecordings, setAudioRecordings] = useState([]);
    const [audioLoading, setAudioLoading] = useState(false);
    const [audioError, setAudioError] = useState(null);
    const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
    const [audioDuration, setAudioDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const audioRef = useRef(null);
    const audioContextRef = useRef(null);
    const sourceNodeRef = useRef(null);

    useEffect(() => {
        if (telemetry?.events_available && status === 'ONLINE') {
            fetchEvents();
        }
    }, [telemetry?.events_available, status]);

    useEffect(() => {
        if (telemetry?.audio_available && status === 'ONLINE') {
            fetchAudioRecordings();
        }
    }, [telemetry?.audio_available, status]);

    useEffect(() => {
        return () => {
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        };
    }, []);

    const fetchEvents = async () => {
        setEventsLoading(true);
        setEventsError(null);
        try {
            const events = await telemetryService.getTelemetryEvents();
            setEvents(events);
        } catch (error) {
            setEventsError(error.message);
            console.error('Error fetching events:', error);
        } finally {
            setEventsLoading(false);
        }
    };

    const fetchAudioRecordings = async () => {
        setAudioLoading(true);
        setAudioError(null);
        try {
            const audioRecords = await telemetryService.getTelemetryAudio();
            setAudioRecordings(audioRecords);
        } catch (error) {
            setAudioError(error.message);
            console.error('Error fetching audio recordings:', error);
        } finally {
            setAudioLoading(false);
        }
    };

    const playAudio = async (audioId) => {
        try {
            // Stop any currently playing audio
            if (sourceNodeRef.current) {
                sourceNodeRef.current.stop();
                sourceNodeRef.current = null;
            }
            if (audioContextRef.current) {
                await audioContextRef.current.close();
            }

            // Fetch the WAV audio data
            const response = await fetch(`/api/telemetry/audio/${audioId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch audio stream');
            }

            const arrayBuffer = await response.arrayBuffer();

            // Create audio context and decode the WAV data
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            audioContextRef.current = audioContext;

            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            // Create source and play
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            source.start(0);
            sourceNodeRef.current = source;

            setCurrentlyPlaying(audioId);
            setAudioDuration(audioBuffer.duration);
            setCurrentTime(0);

            // Update progress
            const startTime = audioContext.currentTime;
            const updateProgress = () => {
                if (sourceNodeRef.current && currentlyPlaying === audioId) {
                    const elapsed = audioContext.currentTime - startTime;
                    setCurrentTime(Math.min(elapsed, audioBuffer.duration));

                    if (elapsed < audioBuffer.duration) {
                        requestAnimationFrame(updateProgress);
                    } else {
                        stopAudio();
                    }
                }
            };
            requestAnimationFrame(updateProgress);

            source.onended = () => {
                stopAudio();
            };

        } catch (error) {
            console.error('Error playing audio:', error);
            setAudioError('Failed to play audio: ' + error.message);
            stopAudio();
        }
    };

    const stopAudio = () => {
        if (sourceNodeRef.current) {
            try {
                sourceNodeRef.current.stop();
            } catch (e) {
                // Ignore if already stopped
            }
            sourceNodeRef.current = null;
        }
        setCurrentlyPlaying(null);
        setAudioDuration(0);
        setCurrentTime(0);
    };

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString();
    };

    // Check if any feature is available
    const hasAnyFeature = telemetry && (
        telemetry.events_available ||
        telemetry.audio_available ||
        telemetry.cam_images_available ||
        telemetry.ai_analysis_available
    );

    // Feed is online and metadata is reachable with at least one feature
    if (status === 'ONLINE' && hasAnyFeature) {
        return (
            <div className="surveillance-module">
                <div className="surveillance-feed">
                    <div className="surveillance-header">
                        <h2 className="empty-title">CORPO SURVEILLANCE MODULE</h2>
                        <div className="empty-status">
                            <span className="status-dot online"></span>
                            <span>ONLINE</span>
                        </div>
                    </div>

                    <div className="dashboard-grid" style={{gridTemplateColumns: 'repeat(2, 1fr)'}}>
                        {/* Area 1: Events Table */}
                        <div className="dashboard-card" style={{
                            borderColor: telemetry.events_available ? 'var(--cyber-cyan)' : 'var(--cyber-pink)',
                            opacity: telemetry.events_available ? 1 : 0.7
                        }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '15px'
                            }}>
                                <div className="card-label">EVENTS MONITOR</div>
                                <span
                                    className={`status-badge ${telemetry.events_available ? 'status-active' : 'status-failed'}`}>
                                    {telemetry.events_available ? 'ACTIVE' : 'DISABLED'}
                                </span>
                            </div>

                            {telemetry.events_available ? (
                                <div style={{maxHeight: '400px', overflowY: 'auto'}}>
                                    {eventsLoading ? (
                                        <div className="loading-overlay"
                                             style={{position: 'relative', minHeight: '200px'}}>
                                            <div className="loading-spinner"></div>
                                            <span style={{color: 'var(--cyber-cyan)'}}>Loading events...</span>
                                        </div>
                                    ) : eventsError ? (
                                        <div style={{textAlign: 'center', padding: '20px'}}>
                                            <div style={{color: 'var(--cyber-pink)', marginBottom: '15px'}}>
                                                ERROR: {eventsError}
                                            </div>
                                            <button onClick={fetchEvents} className="cyberpunk-button primary">
                                                RETRY
                                            </button>
                                        </div>
                                    ) : events.length > 0 ? (

                                        <table className="jobs-table"
                                               style={{fontSize: '0.75rem', position: 'relative'}}>
                                            <thead style={{
                                                position: 'sticky',
                                                top: 0,
                                                zIndex: 10,
                                                background: 'var(--cyber-gray)' // Match the card background
                                            }}>
                                            <tr>
                                                <th style={{
                                                    borderBottom: '2px solid var(--cyber-cyan)',
                                                    position: 'sticky',
                                                    top: 0
                                                }}>DATE/TIME
                                                </th>
                                                <th style={{
                                                    borderBottom: '2px solid var(--cyber-cyan)',
                                                    position: 'sticky',
                                                    top: 0
                                                }}>EVENT TYPE
                                                </th>
                                                <th style={{
                                                    borderBottom: '2px solid var(--cyber-cyan)',
                                                    position: 'sticky',
                                                    top: 0
                                                }}>SUBTYPE
                                                </th>
                                                <th style={{
                                                    borderBottom: '2px solid var(--cyber-cyan)',
                                                    position: 'sticky',
                                                    top: 0
                                                }}>LOCATION
                                                </th>
                                                <th style={{
                                                    borderBottom: '2px solid var(--cyber-cyan)',
                                                    position: 'sticky',
                                                    top: 0
                                                }}>RISK LEVEL
                                                </th>
                                            </tr>
                                            </thead>
                                            <tbody>
                                            {events.map((event, index) => (
                                                <tr key={index} className="job-row">
                                                    <td className="timestamp">
                                                        {new Date(event.date_time).toLocaleString()}
                                                    </td>
                                                    <td style={{color: '#fff'}}>{event.event_type}</td>
                                                    <td style={{color: 'var(--cyber-text)'}}>{event.subtype}</td>
                                                    <td style={{color: 'var(--cyber-text)'}}>{event.location}</td>
                                                    <td>
                                                            <span className={`risk-badge status-${
                                                                event.risk_level?.toLowerCase() === 'critical' ? 'failed' :
                                                                    event.risk_level?.toLowerCase() === 'high' ? 'failed' :
                                                                        event.risk_level?.toLowerCase() === 'medium' ? 'pending' :
                                                                            'active'
                                                            }`}>
                                                                {event.risk_level}
                                                            </span>
                                                    </td>
                                                </tr>
                                            ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div style={{textAlign: 'center', padding: '40px', color: '#666'}}>
                                            NO EVENTS RECORDED
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div style={{textAlign: 'center', padding: '40px'}}>
                                    <div className="card-icon" style={{opacity: 0.5, marginBottom: '15px'}}>⚠</div>
                                    <div className="card-label" style={{marginBottom: '10px'}}>EVENTS FEED DISABLED
                                    </div>
                                    <div style={{color: '#666', fontSize: '0.8rem'}}>Contact system administrator</div>
                                </div>
                            )}
                        </div>

                        {/* Area 2: Audio Monitor */}
                        <div className="dashboard-card" style={{
                            borderColor: telemetry.audio_available ? 'var(--cyber-cyan)' : 'var(--cyber-pink)',
                            opacity: telemetry.audio_available ? 1 : 0.7
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                <div className="card-label">AUDIO MONITOR</div>
                                <span className={`status-badge ${telemetry.audio_available ? 'status-active' : 'status-failed'}`}>
                                    {telemetry.audio_available ? 'ACTIVE' : 'DISABLED'}
                                </span>
                            </div>

                            {telemetry.audio_available ? (
                                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                    {audioLoading ? (
                                        <div className="loading-overlay" style={{ position: 'relative', minHeight: '200px' }}>
                                            <div className="loading-spinner"></div>
                                            <span style={{ color: 'var(--cyber-cyan)' }}>Loading recordings...</span>
                                        </div>
                                    ) : audioError ? (
                                        <div style={{ textAlign: 'center', padding: '20px' }}>
                                            <div style={{ color: 'var(--cyber-pink)', marginBottom: '15px' }}>
                                                ERROR: {audioError}
                                            </div>
                                            <button onClick={fetchAudioRecordings} className="cyberpunk-button primary">
                                                RETRY
                                            </button>
                                        </div>
                                    ) : audioRecordings.length > 0 ? (
                                        <div>
                                            {/* Audio Player */}
                                            {currentlyPlaying && (
                                                <div style={{
                                                    padding: '15px',
                                                    background: 'rgba(0, 240, 255, 0.05)',
                                                    border: '1px solid var(--cyber-cyan)',
                                                    marginBottom: '15px',
                                                    borderRadius: '4px'
                                                }}>
                                                    <div style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        marginBottom: '10px'
                                                    }}>
                                                        <span style={{ color: 'var(--cyber-cyan)', fontSize: '0.8rem' }}>
                                                            NOW PLAYING: Recording #{currentlyPlaying}
                                                        </span>
                                                        <button
                                                            onClick={stopAudio}
                                                            className="cyberpunk-button danger"
                                                            style={{ padding: '4px 12px', fontSize: '0.7rem' }}
                                                        >
                                                            ■ STOP
                                                        </button>
                                                    </div>
                                                    <div style={{
                                                        width: '100%',
                                                        height: '4px',
                                                        background: 'var(--cyber-border)',
                                                        borderRadius: '2px',
                                                        overflow: 'hidden',
                                                        marginBottom: '8px'
                                                    }}>
                                                        <div style={{
                                                            width: `${(currentTime / audioDuration) * 100}%`,
                                                            height: '100%',
                                                            background: 'var(--cyber-cyan)',
                                                            transition: 'width 0.1s linear',
                                                            boxShadow: '0 0 10px var(--cyber-cyan)'
                                                        }}></div>
                                                    </div>
                                                    <div style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        fontSize: '0.7rem',
                                                        color: '#666'
                                                    }}>
                                                        <span>{formatDuration(currentTime)}</span>
                                                        <span>{formatDuration(audioDuration)}</span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Audio Recordings Table */}
                                            <table className="jobs-table" style={{ fontSize: '0.75rem' }}>
                                                <thead style={{
                                                    position: 'sticky',
                                                    top: 0,
                                                    zIndex: 10,
                                                    background: 'var(--cyber-gray)'
                                                }}>
                                                <tr>
                                                    <th style={{ borderBottom: '2px solid var(--cyber-cyan)' }}>ID</th>
                                                    <th style={{ borderBottom: '2px solid var(--cyber-cyan)' }}>DATE/TIME</th>
                                                    <th style={{ borderBottom: '2px solid var(--cyber-cyan)' }}>LOCATION</th>
                                                    <th style={{ borderBottom: '2px solid var(--cyber-cyan)' }}>DURATION</th>
                                                    <th style={{ borderBottom: '2px solid var(--cyber-cyan)' }}>ACTION</th>
                                                </tr>
                                                </thead>
                                                <tbody>
                                                {audioRecordings.map((recording) => (
                                                    <tr key={recording.id} className="job-row">
                                                        <td style={{ color: 'var(--cyber-yellow)' }}>#{recording.id}</td>
                                                        <td className="timestamp">{formatDate(recording.date)}</td>
                                                        <td style={{ color: 'var(--cyber-text)' }}>{recording.location}</td>
                                                        <td style={{ color: 'var(--cyber-text)' }}>
                                                            {formatDuration(recording.duration_seconds)}
                                                        </td>
                                                        <td>
                                                            <button
                                                                onClick={() => playAudio(recording.id)}
                                                                disabled={currentlyPlaying === recording.id}
                                                                className={`action-btn ${currentlyPlaying === recording.id ? 'view' : 'accept'}`}
                                                                style={{
                                                                    cursor: currentlyPlaying === recording.id ? 'default' : 'pointer'
                                                                }}
                                                            >
                                                                {currentlyPlaying === recording.id ? '▶ PLAYING...' : '▶ PLAY'}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                                            <div style={{ marginBottom: '10px' }}>🎤</div>
                                            NO AUDIO RECORDINGS
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '40px' }}>
                                    <div className="card-icon" style={{ opacity: 0.5, marginBottom: '15px' }}>🎤</div>
                                    <div className="card-label" style={{ marginBottom: '10px' }}>AUDIO FEED DISABLED</div>
                                    <div style={{ color: '#666', fontSize: '0.8rem' }}>Audio monitoring unavailable</div>
                                </div>
                            )}
                        </div>

                        {/* Area 3: Camera Images */}
                        <div className="dashboard-card" style={{
                            borderColor: telemetry.cam_images_available ? 'var(--cyber-cyan)' : 'var(--cyber-pink)',
                            opacity: telemetry.cam_images_available ? 1 : 0.7
                        }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '15px'
                            }}>
                                <div className="card-label">CAMERA FEED</div>
                                <span
                                    className={`status-badge ${telemetry.cam_images_available ? 'status-active' : 'status-failed'}`}>
                                    {telemetry.cam_images_available ? 'ACTIVE' : 'DISABLED'}
                                </span>
                            </div>
                            <div style={{textAlign: 'center', padding: '40px'}}>
                                <div className="card-icon" style={{opacity: 0.5, marginBottom: '15px'}}>📷</div>
                                <div className="card-label" style={{marginBottom: '10px'}}>CAMERA FEED DISABLED</div>
                                <div style={{color: '#666', fontSize: '0.8rem'}}>Image capture unavailable</div>
                            </div>
                        </div>

                        {/* Area 4: AI Analysis */}
                        <div className="dashboard-card" style={{
                            borderColor: telemetry.ai_analysis_available ? 'var(--cyber-cyan)' : 'var(--cyber-pink)',
                            opacity: telemetry.ai_analysis_available ? 1 : 0.7
                        }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '15px'
                            }}>
                                <div className="card-label">AI ANALYSIS</div>
                                <span
                                    className={`status-badge ${telemetry.ai_analysis_available ? 'status-active' : 'status-failed'}`}>
                                    {telemetry.ai_analysis_available ? 'ACTIVE' : 'DISABLED'}
                                </span>
                            </div>
                            <div style={{textAlign: 'center', padding: '40px'}}>
                                <div className="card-icon" style={{opacity: 0.5, marginBottom: '15px'}}>🤖</div>
                                <div className="card-label" style={{marginBottom: '10px'}}>AI ANALYSIS DISABLED</div>
                                <div style={{color: '#666', fontSize: '0.8rem'}}>Neural network offline</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Feed unreachable or all features disabled -> access denied / offline.
    return (
        <div className="surveillance-module">
            <div className="surveillance-empty">
                <div className="empty-icon"></div>
                <h2 className="empty-title">CORPO SURVEILLANCE MODULE</h2>
                <div className="empty-status">
                    <span className="status-dot offline"></span>
                    <span>OFFLINE</span>
                </div>
                <p className="empty-description">
                    // ACCESS_RESTRICTED //<br/>
                    // CLEARANCE_LEVEL_9_REQUIRED //<br/>
                    // CONTACT_NETWATCH_ADMIN //
                </p>
                <div className="empty-terminal">
                    <span className="terminal-prompt">{'>'}</span>
                    <span className="terminal-text">ACCESS DENIED</span>
                    <span className="terminal-cursor">_</span>
                </div>
                <div className="scramble-text">
                    {Array.from({length: 5}).map((_, i) => (
                        <div key={i} className="scramble-line">
                            {Array.from({length: 40}).map((_, j) => (
                                <span
                                    key={j}
                                    className="scramble-char"
                                    style={{animationDelay: `${Math.random() * 2}s`}}
                                >
                                    {String.fromCharCode(0x30A0 + Math.random() * 96)}
                                </span>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SurveillanceModule;