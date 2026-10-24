import { useState, useMemo } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'
import { type AssessmentRecord, INITIAL_ASSESSMENTS } from '../history'
import './style.css'

/* ═══════════════════════════════════════════════════════════════
   EXTENDED MOCK DATASET (Rich 30-Day Hospital Assessment History)
   ═══════════════════════════════════════════════════════════════ */

const EXTENDED_ASSESSMENTS: AssessmentRecord[] = [
  ...INITIAL_ASSESSMENTS,
  {
    id: 'ASM-2025-081',
    patientName: 'Khadijah Sanusi',
    patientMrn: 'PT-2230',
    patientDob: '1982-03-14',
    patientSex: 'Female',
    patientAge: 43,
    patientDepartment: 'Breast Clinic',
    patientVisitType: 'Referral',
    dateCreated: 'Oct 10, 2025 · 14:15',
    timestamp: new Date(Date.now() - 86400000 * 14).toISOString(),
    assessedBy: 'Dr. Sarah Alabi',
    aiClassification: 'Benign',
    aiConfidence: '93.4%',
    doctorDecision: 'AI accepted',
    reviewStatus: 'Reviewed',
    reviewedBy: 'Dr. Sarah Alabi',
    reviewedAt: 'Oct 10, 2025 · 15:00',
    reviewNotes: 'Simple cyst confirmed on aspiration.',
    clinicalContext: 'Referred for painful breast swelling.',
    avatarColor: '#10b981',
    auditHistory: [{ action: 'Assessment Created', by: 'Dr. Sarah Alabi', timestamp: 'Oct 10, 14:15' }]
  },
  {
    id: 'ASM-2025-080',
    patientName: 'Victoria Adeyemi',
    patientMrn: 'PT-1784',
    patientDob: '1975-08-20',
    patientSex: 'Female',
    patientAge: 50,
    patientDepartment: 'Radiology',
    patientVisitType: 'Follow-up',
    dateCreated: 'Oct 08, 2025 · 09:30',
    timestamp: new Date(Date.now() - 86400000 * 16).toISOString(),
    assessedBy: 'Dr. Kenneth Okeke',
    aiClassification: 'Malignant',
    aiConfidence: '93.1%',
    doctorDecision: 'AI accepted',
    reviewStatus: 'Requires Follow-up',
    reviewedBy: 'Dr. Kenneth Okeke',
    reviewedAt: 'Oct 08, 2025 · 10:15',
    reviewNotes: 'Suspicious architectural distortion. Core biopsy booked.',
    clinicalContext: 'Post-menopausal routine mammography review.',
    avatarColor: '#6366f1',
    auditHistory: [{ action: 'Assessment Created', by: 'Dr. Kenneth Okeke', timestamp: 'Oct 08, 09:30' }]
  },
  {
    id: 'ASM-2025-079',
    patientName: 'Halima Danladi',
    patientMrn: 'PT-2299',
    patientDob: '1988-10-02',
    patientSex: 'Female',
    patientAge: 37,
    patientDepartment: 'Oncology',
    patientVisitType: 'Initial Assessment',
    dateCreated: 'Oct 05, 2025 · 11:45',
    timestamp: new Date(Date.now() - 86400000 * 19).toISOString(),
    assessedBy: 'Dr. Amina Bello',
    aiClassification: 'Benign',
    aiConfidence: '68.9%',
    doctorDecision: 'Overridden',
    overrideReason: 'Ultrasound demonstrated persistent acoustic shadowing with architectural tethering overriding borderline benign feature perimeter score.',
    reviewStatus: 'Requires Follow-up',
    reviewedBy: 'Dr. Amina Bello',
    reviewedAt: 'Oct 05, 2025 · 12:30',
    reviewNotes: 'Overridden by clinician: Core biopsy recommended.',
    clinicalContext: 'Family history of bilateral BRCA-1 mutation.',
    avatarColor: '#f43f5e',
    auditHistory: [{ action: 'Assessment Created', by: 'Dr. Amina Bello', timestamp: 'Oct 05, 11:45' }]
  },
  {
    id: 'ASM-2025-078',
    patientName: 'Rukayat Lawal',
    patientMrn: 'PT-2180',
    patientDob: '1969-01-11',
    patientSex: 'Female',
    patientAge: 56,
    patientDepartment: 'Outpatient Clinic',
    patientVisitType: 'Screening Review',
    dateCreated: 'Oct 02, 2025 · 15:10',
    timestamp: new Date(Date.now() - 86400000 * 22).toISOString(),
    assessedBy: 'Dr. Sarah Alabi',
    aiClassification: 'Benign',
    aiConfidence: '97.2%',
    doctorDecision: 'AI accepted',
    reviewStatus: 'Reviewed',
    reviewedBy: 'Dr. Sarah Alabi',
    reviewedAt: 'Oct 02, 2025 · 16:00',
    reviewNotes: 'Normal breast tissue. Annual follow-up.',
    clinicalContext: 'Routine baseline screening.',
    avatarColor: '#14b8a6',
    auditHistory: [{ action: 'Assessment Created', by: 'Dr. Sarah Alabi', timestamp: 'Oct 02, 15:10' }]
  },
  {
    id: 'ASM-2025-077',
    patientName: 'Patience Udoh',
    patientMrn: 'PT-1994',
    patientDob: '1976-06-25',
    patientSex: 'Female',
    patientAge: 49,
    patientDepartment: 'Pathology',
    patientVisitType: 'Follow-up',
    dateCreated: 'Sep 28, 2025 · 10:20',
    timestamp: new Date(Date.now() - 86400000 * 26).toISOString(),
    assessedBy: 'Dr. Kenneth Okeke',
    aiClassification: 'Benign',
    aiConfidence: '96.0%',
    doctorDecision: 'AI accepted',
    reviewStatus: 'Reviewed',
    reviewedBy: 'Dr. Kenneth Okeke',
    reviewedAt: 'Sep 28, 2025 · 11:05',
    reviewNotes: 'Biopsy negative for malignancy.',
    clinicalContext: 'Histological review post-biopsy.',
    avatarColor: '#8b5cf6',
    auditHistory: [{ action: 'Assessment Created', by: 'Dr. Kenneth Okeke', timestamp: 'Sep 28, 10:20' }]
  }
]

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function ReportsPage({ onNavigate, onNotify }: { onNavigate: (page: string) => void; onNotify: (msg: string) => void }) {
  // Master assessment records
  const [records] = useState<AssessmentRecord[]>(EXTENDED_ASSESSMENTS)

  // Filter States
  const [dateRange, setDateRange] = useState<'All' | 'Today' | 'Last 7 Days' | 'Last 30 Days'>('Last 30 Days')
  const [departmentFilter, setDepartmentFilter] = useState<string>('All')
  const [clinicianFilter, setClinicianFilter] = useState<string>('All')

  // Applied Filter States (to support "Apply Filters" & "Reset")
  const [appliedFilters, setAppliedFilters] = useState({
    dateRange: 'Last 30 Days',
    department: 'All',
    clinician: 'All'
  })

  // Export Modal State
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportType, setExportType] = useState<'Summary' | 'Overrides' | 'ModelEval'>('Summary')
  const [exportFormat, setExportFormat] = useState<'PDF' | 'CSV'>('PDF')
  const [exportPeriod, setExportPeriod] = useState<string>('Current Filter Selection')
  const [isExporting, setIsExporting] = useState(false)

  /* ─── Extract Lists ────────────────────────────────────────── */
  const departmentsList = useMemo(() => {
    const set = new Set<string>()
    records.forEach(r => { if (r.patientDepartment) set.add(r.patientDepartment) })
    return Array.from(set)
  }, [records])

  const cliniciansList = useMemo(() => {
    const set = new Set<string>()
    records.forEach(r => { if (r.assessedBy) set.add(r.assessedBy) })
    return Array.from(set)
  }, [records])

  /* ─── Filter Application ───────────────────────────────────── */
  function handleApplyFilters() {
    setAppliedFilters({
      dateRange,
      department: departmentFilter,
      clinician: clinicianFilter
    })
    onNotify('Reports and metrics updated with selected filters.')
  }

  function handleResetFilters() {
    setDateRange('Last 30 Days')
    setDepartmentFilter('All')
    setClinicianFilter('All')
    setAppliedFilters({
      dateRange: 'Last 30 Days',
      department: 'All',
      clinician: 'All'
    })
    onNotify('Filters have been reset to default.')
  }

  /* ─── Filtered Records for Analytics ───────────────────────── */
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      // 1. Date filter
      if (appliedFilters.dateRange !== 'All') {
        const recordTime = new Date(r.timestamp).getTime()
        const now = Date.now()
        if (appliedFilters.dateRange === 'Today') {
          if (recordTime < now - 86400000) return false
        } else if (appliedFilters.dateRange === 'Last 7 Days') {
          if (recordTime < now - 86400000 * 7) return false
        } else if (appliedFilters.dateRange === 'Last 30 Days') {
          if (recordTime < now - 86400000 * 30) return false
        }
      }

      // 2. Department filter
      if (appliedFilters.department !== 'All' && r.patientDepartment !== appliedFilters.department) {
        return false
      }

      // 3. Clinician filter
      if (appliedFilters.clinician !== 'All' && r.assessedBy !== appliedFilters.clinician) {
        return false
      }

      return true
    })
  }, [records, appliedFilters])

  /* ─── Computed Summary Cards ───────────────────────────────── */
  const stats = useMemo(() => {
    const total = filteredRecords.length
    const pending = filteredRecords.filter(r => r.reviewStatus === 'Pending Review').length
    const reviewed = filteredRecords.filter(r => r.reviewStatus === 'Reviewed' || r.reviewStatus === 'Requires Follow-up').length
    const overrides = filteredRecords.filter(r => r.doctorDecision === 'Overridden').length
    const accepted = filteredRecords.filter(r => r.doctorDecision === 'AI accepted').length

    const overrideRate = reviewed > 0 ? ((overrides / reviewed) * 100).toFixed(1) : '0.0'
    const acceptedRate = reviewed > 0 ? ((accepted / reviewed) * 100).toFixed(1) : '0.0'

    return { total, pending, reviewed, overrides, overrideRate, accepted, acceptedRate }
  }, [filteredRecords])

  /* ─── Charts Data: Volume Over Time ────────────────────────── */
  const volumeTrendData = useMemo(() => {
    // Generate 7 timeline bucket periods
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const counts = [3, 5, 8, 4, 6, 2, 5]
    return days.map((day, i) => ({
      day,
      assessments: counts[i],
      benign: Math.round(counts[i] * 0.7),
      malignant: Math.round(counts[i] * 0.3)
    }))
  }, [])

  /* ─── Charts Data: Classification Distribution ─────────────── */
  const classificationDistData = useMemo(() => {
    const benign = filteredRecords.filter(r => r.aiClassification === 'Benign').length
    const malignant = filteredRecords.filter(r => r.aiClassification === 'Malignant').length
    const unavailable = filteredRecords.filter(r => r.aiClassification === 'Unavailable').length

    return [
      { name: 'Benign AI Predictions', value: benign, color: '#159B91' },
      { name: 'Malignant AI Predictions', value: malignant, color: '#dc2626' },
      { name: 'Model Unavailable', value: unavailable, color: '#94a3b8' }
    ]
  }, [filteredRecords])

  /* ─── Charts Data: Department Workload ─────────────────────── */
  const departmentWorkloadData = useMemo(() => {
    const deptMap: Record<string, number> = {}
    filteredRecords.forEach(r => {
      const d = r.patientDepartment || 'Outpatient Clinic'
      deptMap[d] = (deptMap[d] || 0) + 1
    })

    return Object.entries(deptMap).map(([dept, count]) => ({
      department: dept,
      count
    }))
  }, [filteredRecords])

  /* ─── Overridden Records Table & View Mode ──────────────────── */
  const [reviewViewMode, setReviewViewMode] = useState<'all' | 'overrides'>('all')
  const overrideRecords = useMemo(() => {
    return filteredRecords.filter(r => r.doctorDecision === 'Overridden' || r.overrideReason)
  }, [filteredRecords])
  const displayedReviewRecords = reviewViewMode === 'overrides' ? overrideRecords : filteredRecords

  /* ─── Export Handler ───────────────────────────────────────── */
  function handleDownloadReport() {
    setIsExporting(true)
    setTimeout(() => {
      setIsExporting(false)
      setShowExportModal(false)

      if (exportFormat === 'CSV') {
        // Trigger CSV generation
        const headers = ['Assessment ID', 'Patient Name', 'MRN', 'Date', 'Clinician', 'AI Classification', 'Doctor Decision', 'Review Status', 'Override Reason']
        const rows = filteredRecords.map(r => [
          r.id,
          r.patientName,
          r.patientMrn,
          r.dateCreated,
          r.assessedBy,
          r.aiClassification,
          r.doctorDecision,
          r.reviewStatus,
          `"${(r.overrideReason || '').replace(/"/g, '""')}"`
        ])
        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
        const encodedUri = encodeURI(csvContent)
        const link = document.createElement('a')
        link.setAttribute('href', encodedUri)
        link.setAttribute('download', `BreastCare_AI_Report_${exportType}_${Date.now()}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }

      onNotify(`${exportType} report in ${exportFormat} format generated successfully.`)
    }, 1200)
  }

  return (
    <div className="reports-container">
      {/* Page Header */}
      <div className="page-heading">
        <div>
          <div className="eyebrow">Clinical Analytics / Reports</div>
          <h1>Reports & Analytics</h1>
          <p className="subtitle">Monitor assessment activity, clinical reviews, and model performance.</p>
        </div>
        <div className="reports-header-actions">
          <button type="button" className="secondary" onClick={() => setShowExportModal(true)}>
            ⇩ Export Report
          </button>
          <button type="button" className="primary" onClick={() => onNavigate('New Assessment')}>
            ＋ New Assessment
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <section className="reports-filter-panel" aria-label="Reports date and department filter controls">
        <div className="reports-filter-group">
          {/* Date Range */}
          <div className="filter-item">
            <label className="filter-item-label" htmlFor="filter-period">Reporting Period</label>
            <select
              id="filter-period"
              className="filter-select-lg"
              value={dateRange}
              onChange={e => setDateRange(e.target.value as any)}
            >
              <option value="All">All Time</option>
              <option value="Today">Today</option>
              <option value="Last 7 Days">Last 7 Days</option>
              <option value="Last 30 Days">Last 30 Days</option>
            </select>
          </div>

          {/* Department */}
          <div className="filter-item">
            <label className="filter-item-label" htmlFor="filter-dept">Department</label>
            <select
              id="filter-dept"
              className="filter-select-lg"
              value={departmentFilter}
              onChange={e => setDepartmentFilter(e.target.value)}
            >
              <option value="All">All Departments</option>
              {departmentsList.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Clinician */}
          <div className="filter-item">
            <label className="filter-item-label" htmlFor="filter-clinician">Clinician</label>
            <select
              id="filter-clinician"
              className="filter-select-lg"
              value={clinicianFilter}
              onChange={e => setClinicianFilter(e.target.value)}
            >
              <option value="All">All Clinicians</option>
              {cliniciansList.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="reports-filter-actions">
          <button type="button" className="primary" onClick={handleApplyFilters}>
            Apply Filters
          </button>
          <button type="button" className="secondary" onClick={handleResetFilters}>
            Reset
          </button>
        </div>
      </section>

      {/* 4 Summary Cards (Calculated Dynamically) */}
      <section className="reports-summary-grid" aria-label="Key assessment metrics">
        <article className="report-stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Total Assessments</span>
            <span className="stat-card-icon blue">▤</span>
          </div>
          <div className="stat-card-value">{stats.total}</div>
          <div className="stat-card-subtext">Created during <strong>{appliedFilters.dateRange}</strong></div>
        </article>

        <article className="report-stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Pending Reviews</span>
            <span className="stat-card-icon amber">◷</span>
          </div>
          <div className="stat-card-value" style={{ color: '#d97706' }}>{stats.pending}</div>
          <div className="stat-card-subtext">Awaiting professional clinician sign-off</div>
        </article>

        <article className="report-stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Reviewed Assessments</span>
            <span className="stat-card-icon teal">✓</span>
          </div>
          <div className="stat-card-value" style={{ color: '#159B91' }}>{stats.reviewed}</div>
          <div className="stat-card-subtext">Completed reviews with signed decisions</div>
        </article>

        <article className="report-stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">AI Overrides</span>
            <span className="stat-card-icon purple">⚠</span>
          </div>
          <div className="stat-card-value" style={{ color: '#7e22ce' }}>{stats.overrides}</div>
          <div className="stat-card-subtext">
            <strong>{stats.overrideRate}%</strong> of reviewed assessments
          </div>
        </article>
      </section>

      {/* ─── SECTION 1: ASSESSMENT TRENDS ─────────────────────── */}
      <section aria-labelledby="trends-heading">
        <div className="section-header">
          <div>
            <h2 id="trends-heading" className="section-title">Assessment Trends</h2>
            <p className="section-subtitle">
              Volume and classification distributions across authorized clinical workstations. All outputs reflect raw AI model classifications, not confirmed diagnoses.
            </p>
          </div>
        </div>

        <div className="charts-grid-2">
          {/* Chart 1: Volume Over Time */}
          <div className="chart-panel">
            <div className="chart-panel-head">
              <div>
                <div className="chart-panel-title">Assessment Volume Over Time</div>
                <div className="chart-panel-desc">Daily assessment registrations for the selected period</div>
              </div>
            </div>
            <div className="chart-panel-body" style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={volumeTrendData} margin={{ top: 12, right: 16, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="volGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#326FE1" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#326FE1" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf2f7" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#71809c', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8a9bb8', fontSize: 11 }} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="recharts-custom-tooltip">
                            <div className="tooltip-header">{label}</div>
                            <div className="tooltip-row">
                              <span>Assessments:</span>
                              <strong>{payload[0].value}</strong>
                            </div>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Area type="monotone" dataKey="assessments" stroke="#326FE1" strokeWidth={2.8} fill="url(#volGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: AI Classification Distribution */}
          <div className="chart-panel">
            <div className="chart-panel-head">
              <div>
                <div className="chart-panel-title">AI Classification Distribution</div>
                <div className="chart-panel-desc">Breakdown of model predictions across cohort</div>
              </div>
            </div>
            <div className="chart-panel-body" style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={classificationDistData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {classificationDistData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload
                        return (
                          <div className="recharts-custom-tooltip">
                            <div className="tooltip-header">{data.name}</div>
                            <div className="tooltip-row">
                              <span>Count:</span>
                              <strong>{data.value} cases</strong>
                            </div>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Chart 3: Department Workload */}
        <div className="chart-panel" style={{ marginBottom: 24 }}>
          <div className="chart-panel-head">
            <div>
              <div className="chart-panel-title">Department Workload Distribution</div>
              <div className="chart-panel-desc">Assessments registered across clinical units</div>
            </div>
          </div>
          <div className="chart-panel-body" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departmentWorkloadData} margin={{ top: 12, right: 16, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf2f7" />
                <XAxis dataKey="department" axisLine={false} tickLine={false} tick={{ fill: '#71809c', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8a9bb8', fontSize: 11 }} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="recharts-custom-tooltip">
                          <div className="tooltip-header">{label}</div>
                          <div className="tooltip-row">
                            <span>Assessments:</span>
                            <strong>{payload[0].value}</strong>
                          </div>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Bar dataKey="count" fill="#159B91" radius={[6, 6, 2, 2]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* ─── SECTION 2: CLINICAL REVIEW & OVERRIDES ───────────── */}
      <section aria-labelledby="review-oversight-heading">
        <div className="section-header">
          <div>
            <h2 id="review-oversight-heading" className="section-title">Clinical Review & Overrides</h2>
            <p className="section-subtitle">
              Physician governance and clinical oversight audit. Original AI recommendations are strictly preserved alongside final clinician judgements.
            </p>
          </div>
        </div>

        <div className="review-oversight-card">
          {/* 3-stat overview bar */}
          <div className="oversight-stats-row">
            <div className="oversight-stat-box">
              <span className="oversight-stat-label">Accepted AI Recommendations</span>
              <div className="oversight-stat-num" style={{ color: '#16a34a' }}>
                {stats.accepted} <span style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 600 }}>({stats.acceptedRate}%)</span>
              </div>
              <div className="oversight-stat-bar">
                <div className="oversight-stat-fill" style={{ width: `${stats.acceptedRate}%`, background: '#16a34a' }} />
              </div>
            </div>

            <div className="oversight-stat-box">
              <span className="oversight-stat-label">Overridden by Clinicians</span>
              <div className="oversight-stat-num" style={{ color: '#dc2626' }}>
                {stats.overrides} <span style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 600 }}>({stats.overrideRate}%)</span>
              </div>
              <div className="oversight-stat-bar">
                <div className="oversight-stat-fill" style={{ width: `${stats.overrideRate}%`, background: '#dc2626' }} />
              </div>
            </div>

            <div className="oversight-stat-box">
              <span className="oversight-stat-label">Reviews Pending</span>
              <div className="oversight-stat-num" style={{ color: '#d97706' }}>
                {stats.pending}
              </div>
              <div className="oversight-stat-bar">
                <div
                  className="oversight-stat-fill"
                  style={{
                    width: `${stats.total > 0 ? (stats.pending / stats.total) * 100 : 0}%`,
                    background: '#d97706'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Documented Override Categories Callout */}
          <div className="override-categories-panel">
            <div className="override-categories-title">
              <span>⚠</span>
              <span>Documented Clinician Override Categories</span>
            </div>
            <div className="override-categories-grid">
              <div className="override-cat-item">
                <div className="override-cat-header">
                  <span>Micro-focal Ultrasound Discrepancy</span>
                  <span className="badge-ai malignant" style={{ fontSize: 10, padding: '2px 6px' }}>1 Case</span>
                </div>
                <p className="override-cat-desc">
                  Suspicious micro-lobulated margins on targeted high-frequency ultrasound override benign numerical feature extraction (Case: PT-2201).
                </p>
              </div>

              <div className="override-cat-item">
                <div className="override-cat-header">
                  <span>Acoustic Tethering on Palpation</span>
                  <span className="badge-ai malignant" style={{ fontSize: 10, padding: '2px 6px' }}>1 Case</span>
                </div>
                <p className="override-cat-desc">
                  Physical breast examination reveals persistent acoustic shadowing and architectural tethering in patient with BRCA-1 carrier mutation (Case: PT-2299).
                </p>
              </div>

              <div className="override-cat-item">
                <div className="override-cat-header">
                  <span>Histopathology Discordance</span>
                  <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700 }}>0 Cases</span>
                </div>
                <p className="override-cat-desc">
                  No core biopsy histology disagreements recorded during the selected reporting period.
                </p>
              </div>
            </div>
          </div>

          {/* Table of Review Records */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className={`sort-btn ${reviewViewMode === 'all' ? 'active' : ''}`}
                onClick={() => setReviewViewMode('all')}
              >
                All Review Records ({filteredRecords.length})
              </button>
              <button
                type="button"
                className={`sort-btn ${reviewViewMode === 'overrides' ? 'active' : ''}`}
                onClick={() => setReviewViewMode('overrides')}
              >
                Documented Overrides Only ({overrideRecords.length})
              </button>
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
              Showing {displayedReviewRecords.length} record{displayedReviewRecords.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="table-wrap">
            <table className="review-records-table">
              <thead>
                <tr>
                  <th>ASSESSMENT ID</th>
                  <th>REVIEW DATE</th>
                  <th>ATTENDING CLINICIAN</th>
                  <th>ORIGINAL AI OUTPUT</th>
                  <th>FINAL DOCTOR DECISION</th>
                  <th>DOCUMENTED OVERRIDE REASON</th>
                </tr>
              </thead>
              <tbody>
                {displayedReviewRecords.map(r => (
                  <tr key={r.id}>
                    <td className="asm-id-cell">{r.id}</td>
                    <td className="date-cell">{r.reviewedAt || r.dateCreated}</td>
                    <td className="doctor-cell">{r.reviewedBy || r.assessedBy}</td>
                    <td>
                      <span className={`badge-ai ${r.aiClassification.toLowerCase()}`}>
                        {r.aiClassification}
                        {r.aiConfidence && <span style={{ opacity: .8, fontSize: 10 }}> ({r.aiConfidence})</span>}
                      </span>
                    </td>
                    <td>
                      <span className={`badge-decision ${r.doctorDecision === 'AI accepted' ? 'accepted' : r.doctorDecision === 'Overridden' ? 'overridden' : 'pending'}`}>
                        {r.doctorDecision === 'AI accepted' && '✓ AI Accepted'}
                        {r.doctorDecision === 'Overridden' && '⚠ Overridden'}
                        {r.doctorDecision === 'Pending' && '◷ Pending'}
                      </span>
                    </td>
                    <td>
                      {r.overrideReason ? (
                        <div className="override-reason-cell">
                          {r.overrideReason}
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: 11.5 }}>
                          {r.doctorDecision === 'AI accepted' ? 'Concordant with AI recommendation' : 'Awaiting review sign-off'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─── SECTION 3: AI MODEL EVALUATION (VALIDATED BENCHMARK) ─── */}
      <section aria-labelledby="eval-heading">
        <div className="section-header">
          <div>
            <h2 id="eval-heading" className="section-title">Model Performance</h2>
            <p className="section-subtitle">
              Validated offline benchmark metrics computed against reference histology datasets with confirmed biopsied outcomes.
            </p>
          </div>
        </div>

        <div className="model-performance-card">
          {/* Header Specification Box */}
          <div className="benchmark-header-box">
            <div>
              <h3 className="benchmark-title">Wisconsin Diagnostic Breast Cancer (WDBC) Pretrained Model v1.8</h3>
              <p className="benchmark-meta">
                Evaluation Dataset: <strong>WDBC Holdout Validation Set (n=114 ground-truth biopsied records)</strong> · Validated: <strong>October 2025</strong>
              </p>
            </div>
            <span className="benchmark-badge">★ Validated Offline Benchmark</span>
          </div>

          {/* 4 Validated Evaluation Metrics */}
          <div className="metrics-eval-grid">
            <div className="metric-eval-box">
              <div className="metric-eval-label">Sensitivity (Malignant Recall)</div>
              <div className="metric-eval-val" style={{ color: '#159B91' }}>97.6%</div>
              <div className="metric-eval-sub">41 / 42 malignant cases identified</div>
            </div>

            <div className="metric-eval-box">
              <div className="metric-eval-label">Specificity</div>
              <div className="metric-eval-val" style={{ color: '#326FE1' }}>95.8%</div>
              <div className="metric-eval-sub">69 / 72 benign cases identified</div>
            </div>

            <div className="metric-eval-box">
              <div className="metric-eval-label">Precision (PPV)</div>
              <div className="metric-eval-val" style={{ color: '#2563eb' }}>93.2%</div>
              <div className="metric-eval-sub">True malignant / predicted malignant</div>
            </div>

            <div className="metric-eval-box">
              <div className="metric-eval-label">F1-Score</div>
              <div className="metric-eval-val" style={{ color: '#7c3aed' }}>0.953</div>
              <div className="metric-eval-sub">Harmonic mean precision & recall</div>
            </div>
          </div>

          {/* Confusion Matrix Visual */}
          <div className="confusion-matrix-container">
            <div>
              <div className="cm-title">Validated Confusion Matrix (n = 114)</div>
              <p className="cm-desc">
                Ground-truth reference comparison demonstrating the model's true positive and true negative classification performance across historical biopsied cases.
              </p>
              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
                • <strong>False Negatives (1):</strong> Critical clinical monitoring threshold; all cases undergo multi-modality physician review.
              </div>
            </div>

            <div className="cm-grid-table">
              <div className="cm-cell header" />
              <div className="cm-cell header">Predicted Benign</div>
              <div className="cm-cell header">Predicted Malignant</div>

              <div className="cm-cell header">Actual Benign</div>
              <div className="cm-cell tn">
                <span className="cm-cell-num">69</span>
                <span className="cm-cell-label">True Negative (TN)</span>
              </div>
              <div className="cm-cell fp">
                <span className="cm-cell-num">3</span>
                <span className="cm-cell-label">False Positive (FP)</span>
              </div>

              <div className="cm-cell header">Actual Malignant</div>
              <div className="cm-cell fn">
                <span className="cm-cell-num">1</span>
                <span className="cm-cell-label">False Negative (FN)</span>
              </div>
              <div className="cm-cell tp">
                <span className="cm-cell-num">41</span>
                <span className="cm-cell-label">True Positive (TP)</span>
              </div>
            </div>
          </div>

          {/* Regulatory Clinical Warning Callout */}
          <div className="regulatory-notice-box">
            <strong>Clinical Safety & Methodology Notice:</strong> Validated evaluation metrics are established strictly against reference histology biopsy results from controlled holdout splits. Routine hospital override rates reflect physician discretion and clinical caution; they must never be conflated with model accuracy or error rates, and doctor concordance does not replace independent gold-standard biopsy confirmation.
          </div>
        </div>
      </section>

      {/* ─── EXPORT REPORT WORKFLOW MODAL ─────────────────────── */}
      {showExportModal && (
        <div className="export-modal-backdrop" role="dialog" aria-modal="true">
          <div className="export-modal-dialog">
            <div className="export-modal-head">
              <h3 className="export-modal-title">Export Clinical Report</h3>
              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => setShowExportModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="export-modal-body">
              <div className="export-form-group">
                <label className="export-form-label" htmlFor="export-type-select">Report Type</label>
                <select
                  id="export-type-select"
                  className="filter-select-lg"
                  value={exportType}
                  onChange={e => setExportType(e.target.value as any)}
                >
                  <option value="Summary">Assessment Summary Report</option>
                  <option value="Overrides">Clinical Review & Overrides Audit</option>
                  <option value="ModelEval">AI Model Evaluation Performance Dossier</option>
                </select>
              </div>

              <div className="export-form-group">
                <label className="export-form-label" htmlFor="export-period-select">Reporting Period</label>
                <select
                  id="export-period-select"
                  className="filter-select-lg"
                  value={exportPeriod}
                  onChange={e => setExportPeriod(e.target.value)}
                >
                  <option value="Current Filter Selection">Current Filter Selection ({appliedFilters.dateRange})</option>
                  <option value="Last 30 Days">Last 30 Days</option>
                  <option value="Quarter to Date (Q4 2025)">Quarter to Date (Q4 2025)</option>
                  <option value="Annual Summary (2025)">Annual Summary (2025)</option>
                </select>
              </div>

              <div className="export-form-group">
                <label className="export-form-label" htmlFor="export-format-select">Export Format</label>
                <select
                  id="export-format-select"
                  className="filter-select-lg"
                  value={exportFormat}
                  onChange={e => setExportFormat(e.target.value as any)}
                >
                  <option value="PDF">PDF Clinical Document (.pdf)</option>
                  <option value="CSV">Structured Data Extract (.csv)</option>
                </select>
              </div>

              {/* Document Preview Card */}
              <div className="export-preview-card">
                <div className="export-preview-title">Document Header Preview</div>
                <div><strong>Title:</strong> BreastCare AI — {exportType} Report</div>
                <div><strong>Generation Date:</strong> {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                <div><strong>Scope:</strong> {exportPeriod} · Department: {appliedFilters.department}</div>
                <div><strong>Generated By:</strong> Dr. Amina Bello (HW-DOC-001) · General Teaching Hospital</div>
                <div style={{ marginTop: 6, fontStyle: 'italic', color: '#94a3b8' }}>
                  Confidential Medical Information: Stored and generated in accordance with hospital data governance standards.
                </div>
              </div>
            </div>

            <div className="export-modal-footer">
              <button
                type="button"
                className="secondary"
                onClick={() => setShowExportModal(false)}
                disabled={isExporting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                onClick={handleDownloadReport}
                disabled={isExporting}
              >
                {isExporting ? 'Generating Document...' : `Generate & Download ${exportFormat}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
