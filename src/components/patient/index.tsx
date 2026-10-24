import { useMemo, useState } from 'react'
import './style.css'

/* ─── Data ───────────────────────────────────────────────────── */

export type Patient = {
  name: string
  id: string
  age: number
  date: string
  status: 'Completed' | 'Reviewed' | 'Pending'
  result: string
  probability: string
  tone: string
}

export const patients: Patient[] = [
  { name: 'Fatima Garba', id: 'PT-2041', age: 52, date: 'Apr 28, 2025', status: 'Completed', result: 'Benign', probability: '8.2%', tone: 'coral' },
  { name: 'Chinedu Emeka Eze', id: 'PT-1987', age: 46, date: 'Apr 26, 2025', status: 'Completed', result: 'Benign', probability: '5.4%', tone: 'lilac' },
  { name: 'Ngozi Okonjo', id: 'PT-2120', age: 39, date: 'Apr 24, 2025', status: 'Reviewed', result: 'Malignant', probability: '76.1%', tone: 'coral' },
  { name: 'Aisha Ibrahim', id: 'PT-2076', age: 58, date: 'Apr 22, 2025', status: 'Completed', result: 'Benign', probability: '11.6%', tone: 'mint' },
  { name: 'Michael Uche', id: 'PT-1934', age: 61, date: 'Apr 20, 2025', status: 'Pending', result: 'Pending', probability: '—', tone: 'lilac' },
]

/* ─── Sub-components ────────────────────────────────────────── */

function PatientDirectory({ selected, onSelect }: { selected: Patient; onSelect: (patient: Patient) => void }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const filtered = useMemo(() => patients.filter(p =>
    `${p.name} ${p.id}`.toLowerCase().includes(query.toLowerCase()) && (status === 'all' || p.status === status)
  ), [query, status])

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="panel-title">Patient directory</div>
          <div className="panel-description">Select a patient to view their record and recent result.</div>
        </div>
        <button className="secondary">⇩ Export list</button>
      </div>
      <div className="panel-body">
        <div className="search-row">
          <div className="search-wrap">
            <span>⌕</span>
            <input className="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by patient name or ID..." aria-label="Search patients" />
          </div>
          <select className="search status-filter" value={status} onChange={e => setStatus(e.target.value)} aria-label="Filter by assessment status">
            <option value="all">All statuses</option>
            <option>Completed</option>
            <option>Reviewed</option>
            <option>Pending</option>
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Patient</th><th>Patient ID</th><th>Age</th><th>Last assessment</th><th>Status</th></tr>
            </thead>
            <tbody>
              {filtered.map(patient => (
                <tr key={patient.id} className={selected.id === patient.id ? 'selected' : ''} onClick={() => onSelect(patient)}>
                  <td>
                    <div className="patient-cell">
                      <span className={`patient-avatar ${patient.tone}`}>{patient.name.split(' ').slice(0, 2).map(n => n[0]).join('')}</span>
                      {patient.name}
                    </div>
                  </td>
                  <td>{patient.id}</td>
                  <td>{patient.age}</td>
                  <td>{patient.date}</td>
                  <td><span className={`status ${patient.status.toLowerCase()}`}>{patient.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span>Showing {filtered.length} patient{filtered.length === 1 ? '' : 's'}</span>
          <span>Demo data · Not connected to a live medical record system</span>
        </div>
      </div>
    </section>
  )
}

function PatientOverview({ patient, onNavigate }: { patient: Patient; onNavigate?: (page: string) => void }) {
  const initials = patient.name.split(' ').slice(0, 2).map(n => n[0]).join('')
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="panel-title">Patient overview</div>
          <div className="panel-description">Selected record summary</div>
        </div>
        <button className="secondary" onClick={() => onNavigate?.('Assessment History')}>View record ↗</button>
      </div>
      <div className="panel-body">
        <div className="detail-top">
          <span className={`patient-avatar ${patient.tone}`}>{initials}</span>
          <div>
            <div className="detail-name">{patient.name}</div>
            <div className="detail-id">Patient ID: {patient.id}</div>
          </div>
        </div>
        <div className="detail-stats">
          <div className="detail-stat"><span>Age</span><strong>{patient.age} years</strong></div>
          <div className="detail-stat"><span>Last visit</span><strong>{patient.date.split(',')[0]}</strong></div>
          <div className="detail-stat"><span>Record status</span><strong>{patient.status === 'Pending' ? 'Pending' : 'Active'}</strong></div>
        </div>
        <hr className="section-divider" />
        <div className="result-box">
          <div className="result-label">Most recent AI output</div>
          <div className="result-main">
            <span className={`result-pill ${patient.result.toLowerCase()}`}>{patient.result}</span>
            <div className="probability">
              <span>Model score shown</span>
              <strong>{patient.probability}</strong>
            </div>
          </div>
        </div>
        <p className="disclaimer">Clinical decision support only. This model output does not replace a qualified clinician's assessment or other appropriate diagnostic procedures.</p>
        <div className="quick-actions">
          <button className="primary" onClick={() => onNavigate?.('New Assessment')}>＋ Start new assessment</button>
          <button className="secondary" onClick={() => onNavigate?.('Assessment History')}>◷ View assessment history</button>
        </div>
      </div>
    </section>
  )
}

function RecentActivity() {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="panel-title">Recent activity</div>
          <div className="panel-description">Latest workspace events</div>
        </div>
        <button className="secondary">View all</button>
      </div>
      <div className="panel-body activity">
        <div className="activity-item"><span className="activity-icon">✓</span><div><div className="activity-title">Doctor review completed</div><div className="activity-meta">Ngozi Okonjo · Today, 09:42</div></div></div>
        <div className="activity-item"><span className="activity-icon">▤</span><div><div className="activity-title">New assessment recorded</div><div className="activity-meta">Fatima Garba · Yesterday, 14:18</div></div></div>
        <div className="activity-item"><span className="activity-icon">✧</span><div><div className="activity-title">Model feedback submitted</div><div className="activity-meta">Dr. Amina Bello · Oct 21, 11:06</div></div></div>
      </div>
    </section>
  )
}

/* ─── Main Export ────────────────────────────────────────────── */

export default function PatientPage({ onNotify, onNavigate }: { onNotify: (message: string) => void; onNavigate?: (page: string) => void }) {
  const [selected, setSelected] = useState(patients[0])

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">Clinical workspace / Patients</div>
          <h1>Patient management</h1>
          <p className="subtitle">Search patient records, review recent assessments and continue clinical workflows.</p>
        </div>
        <button
          className="primary"
          onClick={() => {
            if (onNavigate) onNavigate('New Assessment')
            else onNotify('New assessment flow would open here.')
          }}
        >
          ＋ New assessment
        </button>
      </div>
      <section className="metrics" aria-label="Patient and assessment summary">
        <article className="metric"><div className="metric-top"><span>Registered patients</span><span className="metric-icon">♧</span></div><div className="metric-value">248</div><div className="metric-note"><strong>+12</strong> added this month</div></article>
        <article className="metric"><div className="metric-top"><span>Assessments this month</span><span className="metric-icon">▤</span></div><div className="metric-value">86</div><div className="metric-note">Across all authorized staff</div></article>
        <article className="metric"><div className="metric-top"><span>Awaiting doctor review</span><span className="metric-icon amber-icon">◷</span></div><div className="metric-value">7</div><div className="metric-note"><strong className="amber-text">Needs attention</strong> in review queue</div></article>
        <article className="metric"><div className="metric-top"><span>Feedback items</span><span className="metric-icon teal-icon">✧</span></div><div className="metric-value">14</div><div className="metric-note">Submitted for model evaluation</div></article>
      </section>
      <div className="content-grid">
        <PatientDirectory selected={selected} onSelect={setSelected} />
        <div className="right-column">
          <PatientOverview patient={selected} onNavigate={onNavigate} />
          <RecentActivity />
        </div>
      </div>
    </>
  )
}
