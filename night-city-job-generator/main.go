package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	_ "github.com/lib/pq"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

const (
	defaultAPIKey      = "nc-net-7749-key"
	defaultNetworkNode = "NIGHT_CITY_PRIMARY"
	defaultPort        = "8080"
	defaultDatabaseURL = "postgres://competitions:competitions@localhost:5432/competitions?sslmode=disable"
	defaultMLRiskURL   = "http://ml-risk:8090"
)

type Job struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Client   string `json:"client"`
	Pay      int    `json:"pay"`
	Risk     string `json:"risk"`
	Location string `json:"location"`
	Status   string `json:"status"`
	Time     string `json:"time"`
}

type SystemMetadata struct {
	Latency       int    `json:"latency"`
	Uplink        bool   `json:"uplink"`
	EncryptLevel  string `json:"encryptLevel"`
	SysID         string `json:"sysId"`
	SecurityLevel int    `json:"securityLevel"`
}

type Store struct {
	db *sql.DB
}

type AppMetrics struct {
	sseClients    atomic.Int64
	jobsGenerated atomic.Int64
	jobsAccepted  atomic.Int64
}

type JobsMetrics struct {
	Total      int
	AveragePay float64
	ByStatus   map[string]int
	ByRisk     map[string]int
}

type AppLogger struct {
	json bool
}

type LogEntry struct {
	Time    string `json:"time"`
	Level   string `json:"level"`
	Message string `json:"msg"`
}

type JobsCollector struct {
	store   *Store
	metrics *AppMetrics
	appLog  *AppLogger

	dbUp          *prometheus.Desc
	jobsTotal     *prometheus.Desc
	jobsAvgPay    *prometheus.Desc
	jobsByStatus  *prometheus.Desc
	jobsByRisk    *prometheus.Desc
	sseClients    *prometheus.Desc
	jobsGenerated *prometheus.Desc
	jobsAccepted  *prometheus.Desc
}

func main() {
	appLog := newAppLogger(env("LOG_FORMAT", "text"))
	ctx := context.Background()

	port := env("PORT", defaultPort)
	mlURL := env("ML_RISK_URL", defaultMLRiskURL)
	appLog.Infof("starting jobs backend port=%s log_format=%s ml_risk_url=%s", port, env("LOG_FORMAT", "text"), mlURL)

	store, err := newStore(ctx, env("DATABASE_URL", defaultDatabaseURL), appLog)
	if err != nil {
		appLog.Fatalf("initialize store: %v", err)
	}
	defer store.Close()

	server := &http.Server{
		Addr:              ":" + port,
		Handler:           routes(store, &AppMetrics{}, appLog),
		ReadHeaderTimeout: 5 * time.Second,
	}

	appLog.Infof("jobs backend listening on %s", server.Addr)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		appLog.Fatalf("server stopped: %v", err)
	}
}

func routes(store *Store, metrics *AppMetrics, appLog *AppLogger) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/jobs/active", requireHeaders(handleActiveJobs(store, appLog), appLog))
	mux.HandleFunc("/api/jobs/system-metadata", requireHeaders(handleSystemMetadata(), appLog))
	mux.HandleFunc("/api/jobs/stream", handleJobStream(store, metrics, appLog))
	mux.HandleFunc("/api/jobs/", requireHeaders(handleJobByID(store, metrics, appLog), appLog))
	mux.Handle("/metrics", newMetricsHandler(store, metrics, appLog))
	return mux
}

func newStore(ctx context.Context, databaseURL string, appLog *AppLogger) (*Store, error) {
	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		return nil, err
	}

	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(time.Hour)

	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, err
	}
	appLog.Infof("connected to postgres")

	store := &Store{db: db}
	if err := store.init(ctx, appLog); err != nil {
		_ = db.Close()
		return nil, err
	}

	return store, nil
}

func (s *Store) Close() error {
	return s.db.Close()
}

func (s *Store) init(ctx context.Context, appLog *AppLogger) error {
	schema := `
CREATE SEQUENCE IF NOT EXISTS jobs_number_seq START 2000;

CREATE TABLE IF NOT EXISTS jobs (
	id TEXT PRIMARY KEY,
	title TEXT NOT NULL,
	client TEXT NOT NULL,
	pay INTEGER NOT NULL,
	risk TEXT NOT NULL,
	location TEXT NOT NULL,
	status TEXT NOT NULL,
	time TEXT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`
	if _, err := s.db.ExecContext(ctx, schema); err != nil {
		return err
	}

	var count int
	if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM jobs`).Scan(&count); err != nil {
		return err
	}

	if count > 0 {
		appLog.Infof("jobs table already seeded count=%d", count)
		return nil
	}

	seedJobs := []Job{
		{ID: "NC-1042", Title: "Extract corpo whistleblower from Arasaka tower", Client: "Militech", Pay: 85000, Location: "Corpo Plaza", Status: "AVAILABLE", Time: "14:32:07"},
		{ID: "NC-1041", Title: "Intercept encrypted shard in Watson market", Client: "NetWatch", Pay: 42000, Location: "Watson", Status: "AVAILABLE", Time: "14:28:44"},
		{ID: "NC-1040", Title: "Recover stolen courier package", Client: "Afterlife", Pay: 18000, Location: "Santo Domingo", Status: "ACTIVE", Time: "14:21:19"},
		{ID: "NC-1039", Title: "Escort ripperdoc through Maelstrom turf", Client: "Viktor Vektor", Pay: 26000, Location: "Northside", Status: "AVAILABLE", Time: "14:16:53"},
		{ID: "NC-1038", Title: "Trace rogue daemon in city subnet", Client: "NCPD", Pay: 31000, Location: "City Center", Status: "COMPLETED", Time: "14:09:30"},
		{ID: "NC-1037", Title: "Sweep abandoned clinic for biochip evidence", Client: "Biotechnica", Pay: 39000, Location: "Westbrook", Status: "AVAILABLE", Time: "14:01:12"},
		{ID: "NC-1036", Title: "Deliver black-box module to Pacifica contact", Client: "Voodoo Boys", Pay: 22000, Location: "Pacifica", Status: "FAILED", Time: "13:55:41"},
		{ID: "NC-1035", Title: "Neutralize drone surveillance grid", Client: "Aldecaldos", Pay: 47000, Location: "Badlands", Status: "AVAILABLE", Time: "13:48:05"},
		{ID: "NC-1034", Title: "Audit ghost account in escrow vault", Client: "Kang Tao", Pay: 15000, Location: "Japantown", Status: "AVAILABLE", Time: "13:41:28"},
		{ID: "NC-1033", Title: "Plant tracer on executive AV", Client: "Anonymous", Pay: 56000, Location: "Charter Hill", Status: "AVAILABLE", Time: "13:36:22"},
	}

	appLog.Infof("seeding jobs count=%d", len(seedJobs))
	for i := range seedJobs {
		seedJobs[i].Risk = predictRisk(ctx, seedJobs[i].Title, seedJobs[i].Location, seedJobs[i].Client, appLog)
		if err := s.insertJob(ctx, seedJobs[i]); err != nil {
			return err
		}
		appLog.Infof("seeded job id=%s risk=%s", seedJobs[i].ID, seedJobs[i].Risk)
	}

	return nil
}

func (s *Store) activeJobs(ctx context.Context) ([]Job, error) {
	rows, err := s.db.QueryContext(ctx, `
SELECT id, title, client, pay, risk, location, status, time
FROM jobs
ORDER BY created_at DESC, id DESC
LIMIT 10`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var jobs []Job
	for rows.Next() {
		var job Job
		if err := rows.Scan(&job.ID, &job.Title, &job.Client, &job.Pay, &job.Risk, &job.Location, &job.Status, &job.Time); err != nil {
			return nil, err
		}
		jobs = append(jobs, job)
	}
	return jobs, rows.Err()
}

func (s *Store) jobByID(ctx context.Context, id string) (Job, error) {
	var job Job
	err := s.db.QueryRowContext(ctx, `
SELECT id, title, client, pay, risk, location, status, time
FROM jobs
WHERE id = $1`, id).Scan(&job.ID, &job.Title, &job.Client, &job.Pay, &job.Risk, &job.Location, &job.Status, &job.Time)
	return job, err
}

func (s *Store) acceptJob(ctx context.Context, id string) (Job, error) {
	job, err := s.jobByID(ctx, id)
	if err != nil {
		return Job{}, err
	}

	if job.Status == "COMPLETED" || job.Status == "FAILED" {
		return Job{}, errJobNotAcceptable
	}

	err = s.db.QueryRowContext(ctx, `
UPDATE jobs
SET status = 'ACTIVE', updated_at = NOW()
WHERE id = $1
RETURNING id, title, client, pay, risk, location, status, time`, id).Scan(
		&job.ID,
		&job.Title,
		&job.Client,
		&job.Pay,
		&job.Risk,
		&job.Location,
		&job.Status,
		&job.Time,
	)
	return job, err
}

func (s *Store) insertJob(ctx context.Context, job Job) error {
	_, err := s.db.ExecContext(ctx, `
INSERT INTO jobs (id, title, client, pay, risk, location, status, time)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (id) DO NOTHING`,
		job.ID,
		job.Title,
		job.Client,
		job.Pay,
		job.Risk,
		job.Location,
		job.Status,
		job.Time,
	)
	return err
}

func (s *Store) nextJobID(ctx context.Context) (string, error) {
	var n int64
	if err := s.db.QueryRowContext(ctx, `SELECT nextval('jobs_number_seq')`).Scan(&n); err != nil {
		return "", err
	}
	return fmt.Sprintf("NC-%04d", n), nil
}

func (s *Store) jobsMetrics(ctx context.Context) (JobsMetrics, error) {
	metrics := JobsMetrics{
		ByStatus: map[string]int{},
		ByRisk:   map[string]int{},
	}

	if err := s.db.QueryRowContext(ctx, `
SELECT COUNT(*), COALESCE(AVG(pay), 0)
FROM jobs`).Scan(&metrics.Total, &metrics.AveragePay); err != nil {
		return JobsMetrics{}, err
	}

	statusRows, err := s.db.QueryContext(ctx, `
SELECT status, COUNT(*)
FROM jobs
GROUP BY status`)
	if err != nil {
		return JobsMetrics{}, err
	}
	defer statusRows.Close()

	for statusRows.Next() {
		var status string
		var count int
		if err := statusRows.Scan(&status, &count); err != nil {
			return JobsMetrics{}, err
		}
		metrics.ByStatus[status] = count
	}
	if err := statusRows.Err(); err != nil {
		return JobsMetrics{}, err
	}

	riskRows, err := s.db.QueryContext(ctx, `
SELECT risk, COUNT(*)
FROM jobs
GROUP BY risk`)
	if err != nil {
		return JobsMetrics{}, err
	}
	defer riskRows.Close()

	for riskRows.Next() {
		var risk string
		var count int
		if err := riskRows.Scan(&risk, &count); err != nil {
			return JobsMetrics{}, err
		}
		metrics.ByRisk[risk] = count
	}
	if err := riskRows.Err(); err != nil {
		return JobsMetrics{}, err
	}

	return metrics, nil
}

func handleActiveJobs(store *Store, appLog *AppLogger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeMethodNotAllowed(w)
			return
		}

		jobs, err := store.activeJobs(r.Context())
		if err != nil {
			appLog.Errorf("load active jobs: %v", err)
			writeError(w, http.StatusInternalServerError, "failed to load jobs")
			return
		}

		appLog.Infof("active jobs requested count=%d", len(jobs))
		writeJSON(w, http.StatusOK, jobs)
	}
}

func handleSystemMetadata() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeMethodNotAllowed(w)
			return
		}

		writeJSON(w, http.StatusOK, SystemMetadata{
			Latency:       42,
			Uplink:        true,
			EncryptLevel:  "AES-256",
			SysID:         "NC-NET-7749",
			SecurityLevel: 9,
		})
	}
}

func handleJobByID(store *Store, metrics *AppMetrics, appLog *AppLogger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/jobs/")
		parts := strings.Split(strings.Trim(path, "/"), "/")
		if len(parts) == 0 || parts[0] == "" {
			writeError(w, http.StatusNotFound, "job not found")
			return
		}

		id := parts[0]
		switch {
		case r.Method == http.MethodGet && len(parts) == 1:
			job, err := store.jobByID(r.Context(), id)
			if err != nil {
				appLog.Errorf("get job id=%s: %v", id, err)
				writeStoreError(w, err)
				return
			}
			appLog.Infof("get job id=%s status=%s risk=%s", job.ID, job.Status, job.Risk)
			writeJSON(w, http.StatusOK, job)
		case r.Method == http.MethodPost && len(parts) == 2 && parts[1] == "accept":
			job, err := store.acceptJob(r.Context(), id)
			if err != nil {
				appLog.Errorf("accept job id=%s: %v", id, err)
				writeStoreError(w, err)
				return
			}
			metrics.jobsAccepted.Add(1)
			appLog.Infof("accepted job id=%s risk=%s pay=%d", job.ID, job.Risk, job.Pay)
			writeJSON(w, http.StatusOK, job)
		default:
			writeMethodNotAllowed(w)
		}
	}
}

func handleJobStream(store *Store, metrics *AppMetrics, appLog *AppLogger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeMethodNotAllowed(w)
			return
		}

		flusher, ok := w.(http.Flusher)
		if !ok {
			writeError(w, http.StatusInternalServerError, "streaming is not supported")
			return
		}

		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")

		metrics.sseClients.Add(1)
		defer metrics.sseClients.Add(-1)
		appLog.Infof("sse client connected clients=%d", metrics.sseClients.Load())
		defer appLog.Infof("sse client disconnected clients=%d", metrics.sseClients.Load())

		ticker := time.NewTicker(time.Duration(10+randomIntn(21)) * time.Second)

		defer ticker.Stop()

		for {
			job, err := store.generateJob(r.Context(), appLog)
			if err != nil {
				appLog.Errorf("generate stream job: %v", err)
				return
			}
			metrics.jobsGenerated.Add(1)
			appLog.Infof("stream job id=%s title=%q client=%q location=%q risk=%s pay=%d", job.ID, job.Title, job.Client, job.Location, job.Risk, job.Pay)

			payload, err := json.Marshal(job)
			if err != nil {
				appLog.Errorf("marshal stream job: %v", err)
				return
			}

			if _, err := fmt.Fprintf(w, "data: %s\n\n", payload); err != nil {
				appLog.Errorf("write stream job id=%s: %v", job.ID, err)
				return
			}
			flusher.Flush()

			select {
			case <-r.Context().Done():
				return
			case <-ticker.C:
			}
		}
	}
}

func newMetricsHandler(store *Store, metrics *AppMetrics, appLog *AppLogger) http.Handler {
	registry := prometheus.NewRegistry()
	registry.MustRegister(
		collectors.NewGoCollector(),
		collectors.NewProcessCollector(collectors.ProcessCollectorOpts{}),
		newJobsCollector(store, metrics, appLog),
	)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeMethodNotAllowed(w)
			return
		}

		promhttp.HandlerFor(registry, promhttp.HandlerOpts{}).ServeHTTP(w, r)
	})
}

func newJobsCollector(store *Store, metrics *AppMetrics, appLog *AppLogger) *JobsCollector {
	return &JobsCollector{
		store:   store,
		metrics: metrics,
		appLog:  appLog,

		dbUp: prometheus.NewDesc(
			"jobs_backend_db_up",
			"PostgreSQL availability for jobs backend.",
			nil,
			nil,
		),
		jobsTotal: prometheus.NewDesc(
			"jobs_total",
			"Total number of jobs stored in PostgreSQL.",
			nil,
			nil,
		),
		jobsAvgPay: prometheus.NewDesc(
			"jobs_average_pay",
			"Average pay across all jobs.",
			nil,
			nil,
		),
		jobsByStatus: prometheus.NewDesc(
			"jobs_by_status",
			"Number of jobs grouped by status.",
			[]string{"status"},
			nil,
		),
		jobsByRisk: prometheus.NewDesc(
			"jobs_by_risk",
			"Number of jobs grouped by risk.",
			[]string{"risk"},
			nil,
		),
		sseClients: prometheus.NewDesc(
			"jobs_sse_clients",
			"Currently connected SSE clients.",
			nil,
			nil,
		),
		jobsGenerated: prometheus.NewDesc(
			"jobs_generated_total",
			"Total jobs generated by the SSE stream in this process.",
			nil,
			nil,
		),
		jobsAccepted: prometheus.NewDesc(
			"jobs_accepted_total",
			"Total jobs accepted through this process.",
			nil,
			nil,
		),
	}
}

func (c *JobsCollector) Describe(ch chan<- *prometheus.Desc) {
	ch <- c.dbUp
	ch <- c.jobsTotal
	ch <- c.jobsAvgPay
	ch <- c.jobsByStatus
	ch <- c.jobsByRisk
	ch <- c.sseClients
	ch <- c.jobsGenerated
	ch <- c.jobsAccepted
}

func (c *JobsCollector) Collect(ch chan<- prometheus.Metric) {
	jobsMetrics, err := c.store.jobsMetrics(context.Background())
	if err != nil {
		c.appLog.Errorf("collect jobs metrics: %v", err)
		ch <- prometheus.MustNewConstMetric(c.dbUp, prometheus.GaugeValue, 0)
		c.collectRuntimeMetrics(ch)
		return
	}

	ch <- prometheus.MustNewConstMetric(c.dbUp, prometheus.GaugeValue, 1)
	ch <- prometheus.MustNewConstMetric(c.jobsTotal, prometheus.GaugeValue, float64(jobsMetrics.Total))
	ch <- prometheus.MustNewConstMetric(c.jobsAvgPay, prometheus.GaugeValue, jobsMetrics.AveragePay)

	for status, count := range jobsMetrics.ByStatus {
		ch <- prometheus.MustNewConstMetric(c.jobsByStatus, prometheus.GaugeValue, float64(count), status)
	}

	for risk, count := range jobsMetrics.ByRisk {
		ch <- prometheus.MustNewConstMetric(c.jobsByRisk, prometheus.GaugeValue, float64(count), risk)
	}

	c.collectRuntimeMetrics(ch)
}

func (c *JobsCollector) collectRuntimeMetrics(ch chan<- prometheus.Metric) {
	ch <- prometheus.MustNewConstMetric(c.sseClients, prometheus.GaugeValue, float64(c.metrics.sseClients.Load()))
	ch <- prometheus.MustNewConstMetric(c.jobsGenerated, prometheus.CounterValue, float64(c.metrics.jobsGenerated.Load()))
	ch <- prometheus.MustNewConstMetric(c.jobsAccepted, prometheus.CounterValue, float64(c.metrics.jobsAccepted.Load()))
}

func (s *Store) generateJob(ctx context.Context, appLog *AppLogger) (Job, error) {
	id, err := s.nextJobID(ctx)
	if err != nil {
		return Job{}, err
	}

	title := randomChoice(jobTitles)
	client := randomChoice(jobClients)
	location := randomChoice(jobLocations)

	job := Job{
		ID:       id,
		Title:    title,
		Client:   client,
		Pay:      randomPay(),
		Risk:     predictRisk(ctx, title, location, client, appLog),
		Location: location,
		Status:   "AVAILABLE",
		Time:     time.Now().Format("15:04:05"),
	}
	if err := s.insertJob(ctx, job); err != nil {
		return Job{}, err
	}
	return job, nil
}

type riskPredictRequest struct {
	Title    string `json:"title"`
	Location string `json:"location"`
	Client   string `json:"client"`
}

type riskPredictResponse struct {
	Risk string `json:"risk"`
}

func predictRisk(ctx context.Context, title, location, client string, appLog *AppLogger) string {
	baseURL := strings.TrimRight(env("ML_RISK_URL", defaultMLRiskURL), "/")
	payload, err := json.Marshal(riskPredictRequest{
		Title:    title,
		Location: location,
		Client:   client,
	})
	if err != nil {
		appLog.Errorf("ml risk marshal request: %v", err)
		return "Unknown"
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/predict", bytes.NewReader(payload))
	if err != nil {
		appLog.Errorf("ml risk build request: %v", err)
		return "Unknown"
	}
	req.Header.Set("Content-Type", "application/json")

	httpClient := &http.Client{Timeout: 2 * time.Second}
	resp, err := httpClient.Do(req)
	if err != nil {
		appLog.Errorf("ml risk request failed title=%q location=%q client=%q: %v", title, location, client, err)
		return "Unknown"
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		appLog.Errorf("ml risk bad status=%d title=%q location=%q client=%q", resp.StatusCode, title, location, client)
		return "Unknown"
	}

	var body riskPredictResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		appLog.Errorf("ml risk decode response: %v", err)
		return "Unknown"
	}

	switch body.Risk {
	case "LOW", "MEDIUM", "HIGH", "EXTREME":
		appLog.Infof("ml risk predicted title=%q location=%q client=%q risk=%s", title, location, client, body.Risk)
		return body.Risk
	default:
		appLog.Errorf("ml risk unexpected value=%q title=%q location=%q client=%q", body.Risk, title, location, client)
		return "Unknown"
	}
}

func requireHeaders(next http.HandlerFunc, appLog *AppLogger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-API-Key") != env("API_KEY", defaultAPIKey) {
			appLog.Errorf("unauthorized request path=%s reason=invalid api key", r.URL.Path)
			writeError(w, http.StatusUnauthorized, "invalid api key")
			return
		}

		if r.Header.Get("X-Network-Node") != env("NETWORK_NODE", defaultNetworkNode) {
			appLog.Errorf("unauthorized request path=%s reason=invalid network node", r.URL.Path)
			writeError(w, http.StatusUnauthorized, "invalid network node")
			return
		}

		next(w, r)
	}
}

func writeStoreError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeError(w, http.StatusNotFound, "job not found")
	case errors.Is(err, errJobNotAcceptable):
		writeError(w, http.StatusConflict, "job cannot be accepted")
	default:
		writeError(w, http.StatusInternalServerError, "request failed")
	}
}

func writeMethodNotAllowed(w http.ResponseWriter) {
	writeError(w, http.StatusMethodNotAllowed, "method not allowed")
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if value == nil {
		value = map[string]any{}
	}
	if err := json.NewEncoder(w).Encode(value); err != nil {
		newAppLogger(env("LOG_FORMAT", "text")).Errorf("write json response: %v", err)
	}
}

func newAppLogger(format string) *AppLogger {
	jsonFormat := strings.EqualFold(strings.TrimSpace(format), "json")
	if jsonFormat {
		log.SetFlags(0)
	}
	return &AppLogger{json: jsonFormat}
}

func (l *AppLogger) Infof(format string, args ...any) {
	l.logf("info", format, args...)
}

func (l *AppLogger) Errorf(format string, args ...any) {
	l.logf("error", format, args...)
}

func (l *AppLogger) Fatalf(format string, args ...any) {
	l.logf("fatal", format, args...)
	os.Exit(1)
}

func (l *AppLogger) logf(level, format string, args ...any) {
	message := fmt.Sprintf(format, args...)
	if !l.json {
		if level == "info" {
			log.Print(message)
			return
		}
		log.Printf("%s: %s", strings.ToUpper(level), message)
		return
	}

	payload, err := json.Marshal(LogEntry{
		Time:    time.Now().UTC().Format(time.RFC3339Nano),
		Level:   level,
		Message: message,
	})
	if err != nil {
		log.Printf("%s: %s", strings.ToUpper(level), message)
		return
	}

	log.Print(string(payload))
}

func env(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func randomChoice(values []string) string {
	return values[randomIntn(len(values))]
}

func randomPay() int {
	return (randomIntn(75) + 15) * 1000
}

var errJobNotAcceptable = errors.New("job cannot be accepted")

var (
	randomMu     sync.Mutex
	randomSource = rand.New(rand.NewSource(time.Now().UnixNano()))
)

func randomIntn(n int) int {
	randomMu.Lock()
	defer randomMu.Unlock()
	return randomSource.Intn(n)
}

var jobTitles = []string{
	"Extract corpo asset before lockdown",
	"Recover encrypted shard from courier",
	"Disable hostile subnet relay",
	"Escort medtech through gang border",
	"Plant tracer on executive convoy",
	"Audit black-market escrow vault",
	"Trace rogue AI handshake",
	"Retrieve prototype cyberdeck",
	"Scrub surveillance record from archive",
	"Secure data mule at safehouse",
}

var jobClients = []string{
	"Militech",
	"NetWatch",
	"Afterlife",
	"Biotechnica",
	"Arasaka",
	"Kang Tao",
	"NCPD",
	"Aldecaldos",
	"Anonymous",
	"Voodoo Boys",
}

var jobLocations = []string{
	"Corpo Plaza",
	"Watson",
	"Santo Domingo",
	"Northside",
	"City Center",
	"Westbrook",
	"Pacifica",
	"Badlands",
	"Japantown",
	"Charter Hill",
}

func init() {
	if seed := env("JOBS_RANDOM_SEED", ""); seed != "" {
		n, err := strconv.ParseInt(seed, 10, 64)
		if err == nil {
			randomSource = rand.New(rand.NewSource(n))
		}
	}
}
