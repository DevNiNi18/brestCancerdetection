import { useState, useMemo } from 'react'
import './style.css'

/* ═══════════════════════════════════════════════════════════════
   TYPES & DATA MODEL
   ═══════════════════════════════════════════════════════════════ */

export interface AssessmentRecord {
  id: string
  patientName: string
  patientMrn: string
  patientDob: string
  patientSex: string
  patientAge: number
  patientDepartment: string
  patientVisitType: string
  dateCreated: string
  timestamp: string // ISO string for accurate sorting & date filtering
  assessedBy: string
  aiClassification: 'Benign' | 'Malignant' | 'Unavailable'
  aiConfidence: string | null
  doctorDecision: 'AI accepted' | 'Overridden' | 'Pending'
  overrideReason?: string | null
  reviewStatus: 'Pending Review' | 'Reviewed' | 'Requires Follow-up'
  reviewedBy: string | null
  reviewedAt: string | null
  reviewNotes: string | null
  clinicalContext: string
  avatarColor: string
  auditHistory: Array<{ action: string; by: string; timestamp: string }>
}

/* Mock clinical dataset for hospital CDS prototype */
export const INITIAL_ASSESSMENTS: AssessmentRecord[] = [
  {
    id: 'ASM-2025-089',
    patientName: 'Fatima Garba',
    patientMrn: 'PT-2041',
    patientDob: '1973-04-18',
    patientSex: 'Female',
    patientAge: 52,
    patientDepartment: 'Breast Clinic',
    patientVisitType: 'Follow-up',
    dateCreated: 'Today, 10:34',
    timestamp: new Date().toISOString(),
    assessedBy: 'Dr. Amina Bello',
    aiClassification: 'Benign',
    aiConfidence: '94.6%',
    doctorDecision: 'AI accepted',
    reviewStatus: 'Reviewed',
    reviewedBy: 'Dr. Amina Bello',
    reviewedAt: 'Today, 10:48',
    reviewNotes: 'Concordant with core needle biopsy and clinical breast exam. Routine 12-month follow-up confirmed.',
    clinicalContext: 'Routine 6-month review following mammogram BIRADS-3 nodule in right upper quadrant. Ultrasound shows circumscribed oval mass with benign acoustic enhancement.',
    avatarColor: '#ff6b4a',
    auditHistory: [
      { action: 'Assessment Created & Digitized Features Staged', by: 'Dr. Amina Bello', timestamp: 'Today, 10:34' },
      { action: 'AI Inference Completed (WDBC Pretrained Model v1.8)', by: 'Clinical Decision Support Pipeline', timestamp: 'Today, 10:35' },
      { action: 'Doctor Review Completed & AI Output Accepted', by: 'Dr. Amina Bello', timestamp: 'Today, 10:48' }
    ]
  },
  {
    id: 'ASM-2025-088',
    patientName: 'Chinedu Emeka Eze',
    patientMrn: 'PT-1987',
    patientDob: '1979-09-12',
    patientSex: 'Female',
    patientAge: 46,
    patientDepartment: 'Oncology',
    patientVisitType: 'Referral',
    dateCreated: 'Today, 09:42',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    assessedBy: 'Dr. Amina Bello',
    aiClassification: 'Malignant',
    aiConfidence: '87.4%',
    doctorDecision: 'Pending',
    reviewStatus: 'Pending Review',
    reviewedBy: null,
    reviewedAt: null,
    reviewNotes: null,
    clinicalContext: 'Referred from outpatient clinic with firm, ill-defined mass (2.4 cm) in left breast lower outer quadrant. Axillary lymph nodes non-palpable.',
    avatarColor: '#4a90d9',
    auditHistory: [
      { action: 'Assessment Created & Measurements Entered', by: 'Dr. Amina Bello', timestamp: 'Today, 09:42' },
      { action: 'AI Inference Completed — Queued for Priority Review', by: 'Clinical Decision Support Pipeline', timestamp: 'Today, 09:43' }
    ]
  },
  {
    id: 'ASM-2025-087',
    patientName: 'Ngozi Okonjo',
    patientMrn: 'PT-2120',
    patientDob: '1986-11-23',
    patientSex: 'Female',
    patientAge: 39,
    patientDepartment: 'Radiology',
    patientVisitType: 'Initial Assessment',
    dateCreated: 'Yesterday, 14:18',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    assessedBy: 'Dr. Kenneth Okeke',
    aiClassification: 'Malignant',
    aiConfidence: '91.8%',
    doctorDecision: 'AI accepted',
    reviewStatus: 'Requires Follow-up',
    reviewedBy: 'Dr. Kenneth Okeke',
    reviewedAt: 'Yesterday, 15:30',
    reviewNotes: 'High suspicion of microcalcifications and architectural distortion. Urgent surgical multidisciplinary meeting and staging CT indicated.',
    clinicalContext: 'Palpable thickening in upper inner quadrant with skin dimpling. Family history of first-degree breast cancer at age 42.',
    avatarColor: '#e85d75',
    auditHistory: [
      { action: 'Assessment Created from Diagnostic Mammogram', by: 'Dr. Kenneth Okeke', timestamp: 'Yesterday, 14:18' },
      { action: 'AI Model Inference: Malignant Classification (91.8%)', by: 'Clinical Decision Support Pipeline', timestamp: 'Yesterday, 14:19' },
      { action: 'Doctor Review Completed: Multidisciplinary referral triggered', by: 'Dr. Kenneth Okeke', timestamp: 'Yesterday, 15:30' }
    ]
  },
  {
    id: 'ASM-2025-086',
    patientName: 'Aisha Ibrahim',
    patientMrn: 'PT-2076',
    patientDob: '1967-02-14',
    patientSex: 'Female',
    patientAge: 58,
    patientDepartment: 'Breast Clinic',
    patientVisitType: 'Screening Review',
    dateCreated: 'Oct 22, 2025 · 11:06',
    timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
    assessedBy: 'Dr. Sarah Alabi',
    aiClassification: 'Benign',
    aiConfidence: '98.1%',
    doctorDecision: 'AI accepted',
    reviewStatus: 'Reviewed',
    reviewedBy: 'Dr. Sarah Alabi',
    reviewedAt: 'Oct 22, 2025 · 11:45',
    reviewNotes: 'Normal fibrocystic changes observed. Routine screening interval recommended.',
    clinicalContext: 'Biennial screening review. Patient reports mild bilateral breast tenderness related to hormonal replacement. No discrete lumps identified on palpation.',
    avatarColor: '#7c5cbf',
    auditHistory: [
      { action: 'Assessment Created & Digitized Features Staged', by: 'Dr. Sarah Alabi', timestamp: 'Oct 22, 11:06' },
      { action: 'AI Inference Completed: Benign (98.1%)', by: 'Clinical Decision Support Pipeline', timestamp: 'Oct 22, 11:07' },
      { action: 'Doctor Review Completed & Signed', by: 'Dr. Sarah Alabi', timestamp: 'Oct 22, 11:45' }
    ]
  },
  {
    id: 'ASM-2025-085',
    patientName: 'Michael Uche',
    patientMrn: 'PT-1934',
    patientDob: '1964-07-30',
    patientSex: 'Male',
    patientAge: 61,
    patientDepartment: 'Oncology',
    patientVisitType: 'Initial Assessment',
    dateCreated: 'Oct 21, 2025 · 16:20',
    timestamp: new Date(Date.now() - 86400000 * 3).toISOString(),
    assessedBy: 'Dr. Amina Bello',
    aiClassification: 'Unavailable',
    aiConfidence: null,
    doctorDecision: 'Pending',
    reviewStatus: 'Pending Review',
    reviewedBy: null,
    reviewedAt: null,
    reviewNotes: null,
    clinicalContext: 'Male patient presenting with firm subareolar swelling of the right breast. Ultrasound suggests gynecomastia with adjacent atypical vascularity. Mammography feature extraction pending re-digitization.',
    avatarColor: '#2ecc71',
    auditHistory: [
      { action: 'Assessment Created — Partial Feature Extraction', by: 'Dr. Amina Bello', timestamp: 'Oct 21, 16:20' },
      { action: 'AI Inference Stalled: Missing contour perimeter values', by: 'Clinical Decision Support Pipeline', timestamp: 'Oct 21, 16:22' }
    ]
  },
  {
    id: 'ASM-2025-084',
    patientName: 'Grace Danjuma',
    patientMrn: 'PT-2201',
    patientDob: '1981-12-05',
    patientSex: 'Female',
    patientAge: 44,
    patientDepartment: 'Breast Clinic',
    patientVisitType: 'Referral',
    dateCreated: 'Oct 19, 2025 · 09:15',
    timestamp: new Date(Date.now() - 86400000 * 5).toISOString(),
    assessedBy: 'Dr. Kenneth Okeke',
    aiClassification: 'Benign',
    aiConfidence: '72.3%',
    doctorDecision: 'Overridden',
    overrideReason: 'Clinical breast exam and micro-focal ultrasound demonstrate suspicious micro-lobulated margins and progressive growth over 3 months, despite benign numerical contour extraction.',
    reviewStatus: 'Requires Follow-up',
    reviewedBy: 'Dr. Kenneth Okeke',
    reviewedAt: 'Oct 19, 2025 · 10:30',
    reviewNotes: 'Clinician override applied: Mass classified as suspicious for malignancy requiring immediate ultrasound-guided core biopsy. Multidisciplinary referral generated.',
    clinicalContext: 'Patient with known history of complex fibroadenoma demonstrating focal hypoechoic internal change and new marginal irregularity.',
    avatarColor: '#f59e0b',
    auditHistory: [
      { action: 'Assessment Created & Digitized Features Staged', by: 'Dr. Kenneth Okeke', timestamp: 'Oct 19, 09:15' },
      { action: 'AI Inference Completed: Benign (72.3% confidence)', by: 'Clinical Decision Support Pipeline', timestamp: 'Oct 19, 09:16' },
      { action: 'Doctor Review Completed: Overridden by Clinician', by: 'Dr. Kenneth Okeke', timestamp: 'Oct 19, 10:30' }
    ]
  },
  {
    id: 'ASM-2025-083',
    patientName: 'Zainab Abubakar',
    patientMrn: 'PT-1889',
    patientDob: '1970-05-19',
    patientSex: 'Female',
    patientAge: 55,
    patientDepartment: 'Pathology',
    patientVisitType: 'Follow-up',
    dateCreated: 'Oct 15, 2025 · 13:40',
    timestamp: new Date(Date.now() - 86400000 * 9).toISOString(),
    assessedBy: 'Dr. Sarah Alabi',
    aiClassification: 'Benign',
    aiConfidence: '95.7%',
    doctorDecision: 'AI accepted',
    reviewStatus: 'Reviewed',
    reviewedBy: 'Dr. Sarah Alabi',
    reviewedAt: 'Oct 15, 2025 · 14:10',
    reviewNotes: 'Pathology report confirms benign ductal hyperplasia with no cellular atypia. Patient reassured and discharged to annual recall.',
    clinicalContext: 'Post-lumpectomy routine 1-year surveillance. Scar tissue stable, no new mass or microcalcification clusters detected.',
    avatarColor: '#0ea5e9',
    auditHistory: [
      { action: 'Assessment Created', by: 'Dr. Sarah Alabi', timestamp: 'Oct 15, 13:40' },
      { action: 'AI Inference Completed: Benign (95.7%)', by: 'Clinical Decision Support Pipeline', timestamp: 'Oct 15, 13:41' },
      { action: 'Doctor Review Completed & AI Output Accepted', by: 'Dr. Sarah Alabi', timestamp: 'Oct 15, 14:10' }
    ]
  },
  {
    id: 'ASM-2025-082',
    patientName: 'Blessing Okafor',
    patientMrn: 'PT-2155',
    patientDob: '1990-08-11',
    patientSex: 'Female',
    patientAge: 35,
    patientDepartment: 'Outpatient Clinic',
    patientVisitType: 'Initial Assessment',
    dateCreated: 'Oct 12, 2025 · 10:05',
    timestamp: new Date(Date.now() - 86400000 * 12).toISOString(),
    assessedBy: 'Dr. Amina Bello',
    aiClassification: 'Malignant',
    aiConfidence: '89.2%',
    doctorDecision: 'AI accepted',
    reviewStatus: 'Reviewed',
    reviewedBy: 'Dr. Amina Bello',
    reviewedAt: 'Oct 12, 2025 · 11:20',
    reviewNotes: 'High-risk feature constellation confirmed. Core biopsy performed in clinic, urgent histopathology requested.',
    clinicalContext: '35-year-old presenting with unilateral nipple discharge and firm palpable retroareolar mass.',
    avatarColor: '#ec4899',
    auditHistory: [
      { action: 'Assessment Created', by: 'Dr. Amina Bello', timestamp: 'Oct 12, 10:05' },
      { action: 'AI Inference Completed: Malignant (89.2%)', by: 'Clinical Decision Support Pipeline', timestamp: 'Oct 12, 10:06' },
      { action: 'Doctor Review Completed & Urgent Biopsy Ordered', by: 'Dr. Amina Bello', timestamp: 'Oct 12, 11:20' }
    ]
  }
]

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function AssessmentHistory({ onNavigate, onNotify }: { onNavigate: (page: string) => void; onNotify: (msg: string) => void }) {
  // Assessment Records State
  const [records] = useState<AssessmentRecord[]>(INITIAL_ASSESSMENTS)

  // Filter States
  const [searchQuery, setSearchQuery] = useState('')
  const [classificationFilter, setClassificationFilter] = useState<'All' | 'Benign' | 'Malignant' | 'Unavailable'>('All')
  const [reviewStatusFilter, setReviewStatusFilter] = useState<'All' | 'Pending Review' | 'Reviewed' | 'Requires Follow-up'>('All')
  const [clinicianFilter, setClinicianFilter] = useState<string>('All')
  const [dateRangeFilter, setDateRangeFilter] = useState<'All' | 'Today' | 'Last 7 Days' | 'Last 30 Days'>('All')

  // Sorting State
  const [sortField, setSortField] = useState<'date' | 'patient'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)

  // Selected Record for Detail Drawer
  const [selectedRecord, setSelectedRecord] = useState<AssessmentRecord | null>(null)

  /* ─── Dynamically Computed Summary Statistics ──────────────── */
  const summaryStats = useMemo(() => {
    const total = records.length
    const pending = records.filter(r => r.reviewStatus === 'Pending Review').length
    const reviewed = records.filter(r => r.reviewStatus === 'Reviewed').length
    const followup = records.filter(r => r.reviewStatus === 'Requires Follow-up').length
    return { total, pending, reviewed, followup }
  }, [records])

  /* ─── Clinicians list derived from data ─────────────────────── */
  const cliniciansList = useMemo(() => {
    const set = new Set<string>()
    records.forEach(r => set.add(r.assessedBy))
    return Array.from(set)
  }, [records])

  /* ─── Filtering Logic ──────────────────────────────────────── */
  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      // 1. Text Search (Patient name, MRN, Assessment ID)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        const matchesName = record.patientName.toLowerCase().includes(query)
        const matchesMrn = record.patientMrn.toLowerCase().includes(query)
        const matchesId = record.id.toLowerCase().includes(query)
        if (!matchesName && !matchesMrn && !matchesId) return false
      }

      // 2. Classification Filter
      if (classificationFilter !== 'All' && record.aiClassification !== classificationFilter) {
        return false
      }

      // 3. Review Status Filter
      if (reviewStatusFilter !== 'All' && record.reviewStatus !== reviewStatusFilter) {
        return false
      }

      // 4. Clinician Filter
      if (clinicianFilter !== 'All' && record.assessedBy !== clinicianFilter) {
        return false
      }

      // 5. Date Range Filter
      if (dateRangeFilter !== 'All') {
        const recordTime = new Date(record.timestamp).getTime()
        const now = Date.now()
        if (dateRangeFilter === 'Today') {
          const oneDayAgo = now - 86400000
          if (recordTime < oneDayAgo) return false
        } else if (dateRangeFilter === 'Last 7 Days') {
          const sevenDaysAgo = now - 86400000 * 7
          if (recordTime < sevenDaysAgo) return false
        } else if (dateRangeFilter === 'Last 30 Days') {
          const thirtyDaysAgo = now - 86400000 * 30
          if (recordTime < thirtyDaysAgo) return false
        }
      }

      return true
    })
  }, [records, searchQuery, classificationFilter, reviewStatusFilter, clinicianFilter, dateRangeFilter])

  /* ─── Sorting Logic ────────────────────────────────────────── */
  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a, b) => {
      if (sortField === 'date') {
        const timeA = new Date(a.timestamp).getTime()
        const timeB = new Date(b.timestamp).getTime()
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA
      } else {
        const comp = a.patientName.localeCompare(b.patientName)
        return sortOrder === 'asc' ? comp : -comp
      }
    })
  }, [filteredRecords, sortField, sortOrder])

  /* ─── Pagination Calculations ──────────────────────────────── */
  const totalItems = sortedRecords.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedRecords.slice(start, start + pageSize)
  }, [sortedRecords, currentPage, pageSize])

  // Reset page when filter changes
  function resetFilters() {
    setSearchQuery('')
    setClassificationFilter('All')
    setReviewStatusFilter('All')
    setClinicianFilter('All')
    setDateRangeFilter('All')
    setCurrentPage(1)
    onNotify('Assessment filters have been reset.')
  }

  function handleSort(field: 'date' | 'patient') {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  return (
    <div className="history-container">
      {/* Page Header */}
      <div className="page-heading">
        <div>
          <div className="eyebrow">Clinical Workspace / Assessment History</div>
          <h1>Assessment History</h1>
          <p className="subtitle">Review and manage previous patient assessments.</p>
        </div>
        <div className="history-header-actions">
          <button className="primary" onClick={() => onNavigate('New Assessment')}>
            ＋ New Assessment
          </button>
        </div>
      </div>

      {/* 4 Summary Cards (Computed Dynamically from Records) */}
      <section className="history-summary-grid" aria-label="Assessment overview statistics">
        <article className="summary-card">
          <div className="summary-card-top">
            <span className="summary-card-label">Total Assessments</span>
            <span className="summary-card-icon blue">▤</span>
          </div>
          <div className="summary-card-value">{summaryStats.total}</div>
          <div className="summary-card-sub">Recorded across clinical repository</div>
        </article>

        <article className="summary-card">
          <div className="summary-card-top">
            <span className="summary-card-label">Pending Doctor Review</span>
            <span className="summary-card-icon amber">◷</span>
          </div>
          <div className="summary-card-value" style={{ color: '#d97706' }}>{summaryStats.pending}</div>
          <div className="summary-card-sub">
            <strong>Action required</strong> in review queue
          </div>
        </article>

        <article className="summary-card">
          <div className="summary-card-top">
            <span className="summary-card-label">Reviewed Assessments</span>
            <span className="summary-card-icon teal">✓</span>
          </div>
          <div className="summary-card-value" style={{ color: '#159B91' }}>{summaryStats.reviewed}</div>
          <div className="summary-card-sub">Signed by attending clinician</div>
        </article>

        <article className="summary-card">
          <div className="summary-card-top">
            <span className="summary-card-label">Requires Follow-up</span>
            <span className="summary-card-icon rose">!</span>
          </div>
          <div className="summary-card-value" style={{ color: '#e11d48' }}>{summaryStats.followup}</div>
          <div className="summary-card-sub">Multidisciplinary referral or biopsy</div>
        </article>
      </section>

      {/* Filter Toolbar */}
      <section className="filter-panel" aria-label="Assessment search and filtering toolbar">
        {/* Search Row */}
        <div className="filter-search-row">
          <div className="filter-search-wrap">
            <span className="filter-search-icon">⌕</span>
            <input
              type="text"
              className="filter-search-input"
              placeholder="Search by patient name, MRN (e.g. PT-2041), or Assessment ID (e.g. ASM-2025-089)..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              aria-label="Search assessments"
            />
          </div>
        </div>

        {/* Filter Selects Row */}
        <div className="filter-selects-row">
          {/* AI Classification */}
          <select
            className="filter-select"
            value={classificationFilter}
            onChange={e => {
              setClassificationFilter(e.target.value as any)
              setCurrentPage(1)
            }}
            aria-label="Filter by AI classification"
          >
            <option value="All">All Classifications</option>
            <option value="Benign">Benign</option>
            <option value="Malignant">Malignant</option>
            <option value="Unavailable">Unavailable</option>
          </select>

          {/* Review Status */}
          <select
            className="filter-select"
            value={reviewStatusFilter}
            onChange={e => {
              setReviewStatusFilter(e.target.value as any)
              setCurrentPage(1)
            }}
            aria-label="Filter by review status"
          >
            <option value="All">All Review Statuses</option>
            <option value="Pending Review">Pending Review</option>
            <option value="Reviewed">Reviewed</option>
            <option value="Requires Follow-up">Requires Follow-up</option>
          </select>

          {/* Clinician Filter */}
          <select
            className="filter-select"
            value={clinicianFilter}
            onChange={e => {
              setClinicianFilter(e.target.value)
              setCurrentPage(1)
            }}
            aria-label="Filter by assessing clinician"
          >
            <option value="All">All Clinicians</option>
            {cliniciansList.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Date Range */}
          <select
            className="filter-select"
            value={dateRangeFilter}
            onChange={e => {
              setDateRangeFilter(e.target.value as any)
              setCurrentPage(1)
            }}
            aria-label="Filter by date range"
          >
            <option value="All">All Date Ranges</option>
            <option value="Today">Today</option>
            <option value="Last 7 Days">Last 7 Days</option>
            <option value="Last 30 Days">Last 30 Days</option>
          </select>

          {/* Reset Filters */}
          {(searchQuery || classificationFilter !== 'All' || reviewStatusFilter !== 'All' || clinicianFilter !== 'All' || dateRangeFilter !== 'All') && (
            <button type="button" className="filter-reset-btn" onClick={resetFilters}>
              ✕ Reset Filters
            </button>
          )}
        </div>
      </section>

      {/* Assessment History Table Panel */}
      <section className="history-table-panel">
        <div className="table-meta-bar">
          <div className="table-meta-left">
            <span>
              Showing <span className="results-count">{totalItems}</span> assessment{totalItems === 1 ? '' : 's'}
            </span>
          </div>
          <div className="sort-controls">
            <span>Sort by:</span>
            <button
              type="button"
              className={`sort-btn ${sortField === 'date' ? 'active' : ''}`}
              onClick={() => handleSort('date')}
            >
              Date {sortField === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <button
              type="button"
              className={`sort-btn ${sortField === 'patient' ? 'active' : ''}`}
              onClick={() => handleSort('patient')}
            >
              Patient Name {sortField === 'patient' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
          </div>
        </div>

        {paginatedRecords.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">⌕</div>
            <div className="empty-title">No Assessments Found</div>
            <p className="empty-desc">
              No previous assessment records match your current search and filter criteria. Try clearing filters or creating a new assessment.
            </p>
            <button type="button" className="secondary" onClick={resetFilters}>
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="history-table">
              <thead>
                <tr>
                  <th>ASSESSMENT ID</th>
                  <th>PATIENT</th>
                  <th>DATE CREATED</th>
                  <th>ASSESSED BY</th>
                  <th>AI CLASSIFICATION</th>
                  <th>DOCTOR'S DECISION</th>
                  <th>REVIEW STATUS</th>
                  <th style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRecords.map(item => (
                  <tr key={item.id} onClick={() => setSelectedRecord(item)}>
                    <td className="asm-id-cell">{item.id}</td>
                    <td>
                      <div className="patient-info-cell">
                        <span className="patient-avatar-mini" style={{ background: item.avatarColor }}>
                          {item.patientName.split(' ').slice(0, 2).map(n => n[0]).join('')}
                        </span>
                        <div className="patient-name-block">
                          <span className="patient-name-text">{item.patientName}</span>
                          <span className="patient-mrn-text">{item.patientMrn} · {item.patientAge}y · {item.patientSex[0]}</span>
                        </div>
                      </div>
                    </td>
                    <td className="date-cell">{item.dateCreated}</td>
                    <td className="doctor-cell">{item.assessedBy}</td>
                    <td>
                      <span className={`badge-ai ${item.aiClassification.toLowerCase()}`}>
                        {item.aiClassification === 'Benign' && '● '}
                        {item.aiClassification === 'Malignant' && '▲ '}
                        {item.aiClassification}
                        {item.aiConfidence && <span style={{ opacity: .8, fontSize: 10 }}> ({item.aiConfidence})</span>}
                      </span>
                    </td>
                    <td>
                      <span className={`badge-decision ${item.doctorDecision === 'AI accepted' ? 'accepted' : item.doctorDecision === 'Overridden' ? 'overridden' : 'pending'}`}>
                        {item.doctorDecision === 'AI accepted' && '✓ AI Accepted'}
                        {item.doctorDecision === 'Overridden' && '⚠ Overridden'}
                        {item.doctorDecision === 'Pending' && '◷ Pending'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge-status ${item.reviewStatus === 'Reviewed' ? 'reviewed' : item.reviewStatus === 'Pending Review' ? 'pending' : 'followup'}`}>
                        <span className={`status-indicator-dot ${item.reviewStatus === 'Reviewed' ? 'green' : item.reviewStatus === 'Pending Review' ? 'amber' : 'red'}`} />
                        {item.reviewStatus}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn-view-details"
                        onClick={e => {
                          e.stopPropagation()
                          setSelectedRecord(item)
                        }}
                      >
                        View Details →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalItems > 0 && (
          <div className="pagination-bar">
            <div className="pagination-left">
              <span>Rows per page:</span>
              <select
                className="page-size-select"
                value={pageSize}
                onChange={e => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(1)
                }}
                aria-label="Rows per page"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
              </select>
              <span>
                Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, totalItems)} of {totalItems}
              </span>
            </div>
            <div className="pagination-right">
              <button
                type="button"
                className="page-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              >
                ← Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                <button
                  type="button"
                  key={pageNum}
                  className={`page-btn ${currentPage === pageNum ? 'active' : ''}`}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </button>
              ))}
              <button
                type="button"
                className="page-btn"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ─── Dedicated Clinical Slide-Over Drawer ─────────────── */}
      {selectedRecord && (
        <div className="drawer-backdrop" onClick={() => setSelectedRecord(null)} role="dialog" aria-modal="true">
          <div className="drawer-panel" onClick={e => e.stopPropagation()}>
            {/* Drawer Header */}
            <div className="drawer-head">
              <div>
                <div className="drawer-title-row">
                  <h2 className="drawer-title">{selectedRecord.id}</h2>
                  <span className={`badge-status ${selectedRecord.reviewStatus === 'Reviewed' ? 'reviewed' : selectedRecord.reviewStatus === 'Pending Review' ? 'pending' : 'followup'}`}>
                    <span className={`status-indicator-dot ${selectedRecord.reviewStatus === 'Reviewed' ? 'green' : selectedRecord.reviewStatus === 'Pending Review' ? 'amber' : 'red'}`} />
                    {selectedRecord.reviewStatus}
                  </span>
                </div>
                <div className="drawer-subtitle">
                  Assessment Record · {selectedRecord.patientName} ({selectedRecord.patientMrn})
                </div>
              </div>
              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => setSelectedRecord(null)}
                aria-label="Close drawer"
              >
                ✕
              </button>
            </div>

            {/* Drawer Body */}
            <div className="drawer-body">
              {/* Patient Profile Card */}
              <div className="drawer-section">
                <div className="drawer-section-title">Patient Profile & Metadata</div>
                <div className="drawer-grid-2">
                  <div className="drawer-stat-item">
                    <div className="drawer-stat-label">Full Name</div>
                    <div className="drawer-stat-value">{selectedRecord.patientName}</div>
                  </div>
                  <div className="drawer-stat-item">
                    <div className="drawer-stat-label">Medical Record Number</div>
                    <div className="drawer-stat-value">{selectedRecord.patientMrn}</div>
                  </div>
                  <div className="drawer-stat-item">
                    <div className="drawer-stat-label">Age / Sex</div>
                    <div className="drawer-stat-value">{selectedRecord.patientAge} years · {selectedRecord.patientSex}</div>
                  </div>
                  <div className="drawer-stat-item">
                    <div className="drawer-stat-label">Department / Unit</div>
                    <div className="drawer-stat-value">{selectedRecord.patientDepartment}</div>
                  </div>
                  <div className="drawer-stat-item">
                    <div className="drawer-stat-label">Visit Type</div>
                    <div className="drawer-stat-value">{selectedRecord.patientVisitType}</div>
                  </div>
                  <div className="drawer-stat-item">
                    <div className="drawer-stat-label">Date Submitted</div>
                    <div className="drawer-stat-value">{selectedRecord.dateCreated}</div>
                  </div>
                </div>
              </div>

              {/* AI vs Doctor Decision Comparison Callout */}
              <div className="drawer-section">
                <div className="drawer-section-title">
                  <span>Clinical Decision Comparison</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>AI Output vs Doctor Judgement</span>
                </div>

                <div className="decision-comparison-box">
                  {/* Left Column: AI Model Output */}
                  <div className="comparison-col">
                    <div className="comparison-heading">Original AI Prediction</div>
                    <div className={`comparison-result ${selectedRecord.aiClassification.toLowerCase()}`}>
                      {selectedRecord.aiClassification}
                    </div>
                    <div className="comparison-score">
                      {selectedRecord.aiConfidence ? (
                        <>Model Confidence: <strong>{selectedRecord.aiConfidence}</strong></>
                      ) : (
                        <span style={{ fontStyle: 'italic', color: '#94a3b8' }}>Confidence score unavailable</span>
                      )}
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
                      Wisconsin WDBC Model v1.8 (DenseNet)
                    </span>
                  </div>

                  {/* Right Column: Clinician's Final Decision */}
                  <div className="comparison-col border-left">
                    <div className="comparison-heading">Attending Doctor's Decision</div>
                    <div className={`comparison-result ${selectedRecord.doctorDecision === 'Overridden' ? 'overridden' : selectedRecord.doctorDecision === 'AI accepted' ? 'benign' : ''}`}>
                      {selectedRecord.doctorDecision === 'AI accepted' && '✓ AI Accepted'}
                      {selectedRecord.doctorDecision === 'Overridden' && '⚠ Overridden by Doctor'}
                      {selectedRecord.doctorDecision === 'Pending' && '◷ Awaiting Review'}
                    </div>
                    <div className="comparison-score">
                      Reviewer: <strong>{selectedRecord.reviewedBy || 'Pending assignment'}</strong>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
                      {selectedRecord.reviewedAt ? `Signed at ${selectedRecord.reviewedAt}` : 'Not finalized'}
                    </span>
                  </div>
                </div>

                {/* Explicit Override Explanation Warning Box if Overridden */}
                {selectedRecord.doctorDecision === 'Overridden' && selectedRecord.overrideReason && (
                  <div className="override-alert-box">
                    <div className="override-alert-title">⚠ Clinician Override Rationale:</div>
                    <p className="override-alert-text">{selectedRecord.overrideReason}</p>
                  </div>
                )}
              </div>

              {/* Recorded Clinical Context & Notes */}
              <div className="drawer-section">
                <div className="drawer-section-title">Clinical Context & Indication</div>
                <p style={{ margin: 0, fontSize: 13, color: '#334155', lineHeight: 1.6 }}>
                  {selectedRecord.clinicalContext}
                </p>
                {selectedRecord.reviewNotes && (
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #edf1f7' }}>
                    <div style={{ fontSize: 11, fontWeight: 750, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                      Doctor Review Notes
                    </div>
                    <p style={{ margin: 0, fontSize: 12.5, color: '#1e293b', fontStyle: 'italic', lineHeight: 1.5 }}>
                      "{selectedRecord.reviewNotes}"
                    </p>
                  </div>
                )}
              </div>

              {/* Audit History & Trail */}
              <div className="drawer-section">
                <div className="drawer-section-title">Audit Trail & System History</div>
                <div className="audit-list">
                  {selectedRecord.auditHistory.map((audit, i) => (
                    <div className="audit-item" key={i}>
                      <span className="audit-bullet" />
                      <div className="audit-content">
                        <div className="audit-action">{audit.action}</div>
                        <div className="audit-meta">{audit.by} · {audit.timestamp}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Drawer Footer with Role Authorization Notice */}
            <div className="drawer-footer">
              <span className="role-badge">🔒 Authorized Clinician View · Oncology Department</span>
              <button
                type="button"
                className="secondary"
                onClick={() => setSelectedRecord(null)}
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
