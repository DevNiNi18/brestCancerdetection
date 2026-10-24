import { useState } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import './style.css'

/* ─── Data ───────────────────────────────────────────────────── */

type Assessment = {
  name: string
  initials: string
  color: string
  date: string
  aiResult: 'Benign' | 'Malignant'
  status: 'Completed' | 'Needs review' | 'Pending'
}

const recentAssessments: Assessment[] = [
  { name: 'Fatima Garba', initials: 'FG', color: '#ff6b4a', date: 'Today, 10:34', aiResult: 'Benign', status: 'Completed' },
  { name: 'Chinedu Eze', initials: 'CE', color: '#4a90d9', date: 'Today, 09:42', aiResult: 'Malignant', status: 'Needs review' },
  { name: 'Ngozi Okonjo', initials: 'NO', color: '#e85d75', date: 'Yesterday, 14:18', aiResult: 'Malignant', status: 'Needs review' },
  { name: 'Aisha Ibrahim', initials: 'AI', color: '#7c5cbf', date: 'Oct 21, 11:06', aiResult: 'Benign', status: 'Completed' },
]

type ReviewItem = {
  name: string
  initials: string
  color: string
  detail: string
  priority: string
  priorityColor: string
}

const reviewQueue: ReviewItem[] = [
  { name: 'Chinedu Emeka Eze', initials: 'CE', color: '#4a90d9', detail: 'AI result: Malignant · Submitted 09:42', priority: 'Priority review', priorityColor: '#e74c3c' },
  { name: 'Ngozi Okonjo', initials: 'NO', color: '#e85d75', detail: 'AI result: Malignant · Yesterday', priority: 'Awaiting review', priorityColor: '#e6a817' },
  { name: 'Michael Uche', initials: 'MU', color: '#2ecc71', detail: 'Assessment submitted · Oct 22', priority: 'Pending', priorityColor: '#e6a817' },
]

const activityData = [
  { day: 'Mon', assessments: 9 },
  { day: 'Tue', assessments: 12 },
  { day: 'Wed', assessments: 18 },
  { day: 'Thu', assessments: 14 },
  { day: 'Fri', assessments: 3 },
  { day: 'Sat', assessments: 7 },
  { day: 'Sun', assessments: 15 },
]

/* ─── SVG Icons ─────────────────────────────────────────────── */

function IconPatients() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  )
}

function IconClipboard() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" /><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
      <path d="M12 11h4" /><path d="M12 16h4" /><path d="M8 11h.01" /><path d="M8 16h.01" />
    </svg>
  )
}

function IconClock() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function IconFeedback() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /><path d="M12 7v2" /><path d="M12 13h.01" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function IconFile() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

function IconUser() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function IconArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  )
}

function IconWarning() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

/* ─── Sub-components ────────────────────────────────────────── */

function StatCard({ label, value, note, noteHighlight, icon, iconBg, iconColor }: {
  label: string; value: string | number; note: string; noteHighlight?: boolean
  icon: React.ReactNode; iconBg: string; iconColor: string
}) {
  return (
    <article className="metric">
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-icon" style={{ background: iconBg, color: iconColor }}>{icon}</span>
      </div>
      <div className="metric-value">{value}</div>
      <div className={`metric-note ${noteHighlight ? 'metric-note-highlight' : ''}`}>{note}</div>
    </article>
  )
}

function DashboardAssessments({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [activeTab, setActiveTab] = useState<'all' | 'needs-review' | 'completed'>('all')
  const filtered = recentAssessments.filter(a => {
    if (activeTab === 'needs-review') return a.status === 'Needs review'
    if (activeTab === 'completed') return a.status === 'Completed'
    return true
  })

  return (
    <section className="panel dash-assessments">
      <div className="panel-head">
        <div>
          <div className="panel-title">Recent patient assessments</div>
          <div className="panel-description">Latest activity across your assigned patients</div>
        </div>
        <button type="button" className="view-link" onClick={() => onNavigate?.('Patients')}>
          View patients <IconArrowRight />
        </button>
      </div>
      <div className="dash-tabs">
        <button className={`dash-tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>All assessments</button>
        <button className={`dash-tab ${activeTab === 'needs-review' ? 'active' : ''}`} onClick={() => setActiveTab('needs-review')}>Needs review</button>
        <button className={`dash-tab ${activeTab === 'completed' ? 'active' : ''}`} onClick={() => setActiveTab('completed')}>Completed</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>PATIENT</th><th>ASSESSMENT DATE</th><th>AI RESULT</th><th>STATUS</th></tr>
          </thead>
          <tbody>
            {filtered.map((a, i) => (
              <tr key={i}>
                <td>
                  <div className="patient-cell">
                    <span className="dash-avatar" style={{ background: a.color }}>{a.initials}</span>
                    <span className="patient-cell-name">{a.name}</span>
                  </div>
                </td>
                <td className="muted-cell">{a.date}</td>
                <td><span className={`result-badge ${a.aiResult.toLowerCase()}`}>{a.aiResult}</span></td>
                <td><span className={`status-badge ${a.status === 'Completed' ? 'completed' : a.status === 'Needs review' ? 'needs-review' : 'pending'}`}>{a.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

interface TooltipPayloadItem {
  value: number
  name?: string
  color?: string
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadItem[]; label?: string }) {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip">
        <div className="tooltip-day">{label}</div>
        <div className="tooltip-value">
          <span className="tooltip-dot" />
          <span>Assessments: </span>
          <strong>{payload[0].value}</strong>
        </div>
      </div>
    )
  }
  return null
}

function AssessmentActivity() {
  return (
    <section className="panel dash-chart">
      <div className="panel-head">
        <div>
          <div className="panel-title">Assessment activity</div>
          <div className="panel-description">Number of assessments recorded this week</div>
        </div>
        <div className="chart-legend"><span className="legend-dot" /> Assessments</div>
      </div>
      <div className="chart-body" style={{ width: '100%', height: 235, padding: '16px 20px 8px 10px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={activityData} margin={{ top: 14, right: 16, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="activityLineGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2e6de5" stopOpacity={0.24} />
                <stop offset="95%" stopColor="#2e6de5" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf2f7" />
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#71809c', fontSize: 12, fontWeight: 500 }}
              dy={6}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#8a9bb8', fontSize: 11 }}
              domain={[0, 20]}
              ticks={[0, 5, 10, 15, 20]}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#2e6de5', strokeWidth: 1, strokeDasharray: '3 3' }} />
            <Area
              type="monotone"
              dataKey="assessments"
              stroke="#2e6de5"
              strokeWidth={2.8}
              fillOpacity={1}
              fill="url(#activityLineGradient)"
              dot={{ r: 4, fill: '#fff', stroke: '#2e6de5', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: '#2e6de5', stroke: '#fff', strokeWidth: 2.5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

function DoctorReviewQueue() {
  return (
    <section className="panel dash-review-queue">
      <div className="panel-head">
        <div>
          <div className="panel-title">Doctor review queue</div>
          <div className="panel-description">Assessments awaiting professional review</div>
        </div>
        <span className="queue-count">3</span>
      </div>
      <div className="queue-list">
        {reviewQueue.map((item, i) => (
          <div className="queue-item" key={i}>
            <span className="dash-avatar" style={{ background: item.color }}>{item.initials}</span>
            <div className="queue-item-info">
              <div className="queue-item-name">{item.name}</div>
              <div className="queue-item-detail">{item.detail}</div>
              <span className="queue-item-priority" style={{ color: item.priorityColor }}>{item.priority}</span>
            </div>
            <a href="#" className="review-link">Review <IconArrowRight /></a>
          </div>
        ))}
      </div>
      <a href="#" className="queue-footer-link">Open review queue <IconArrowRight /></a>
    </section>
  )
}

function RecentSystemActivity() {
  return (
    <section className="panel dash-sys-activity">
      <div className="panel-head">
        <div>
          <div className="panel-title">Recent system activity</div>
          <div className="panel-description">Your latest actions and updates</div>
        </div>
      </div>
      <div className="sys-activity-list">
        <div className="sys-activity-item">
          <span className="sys-icon check"><IconCheck /></span>
          <div><div className="sys-title">Doctor review completed</div><div className="sys-meta">Fatima Garba · Today, 10:34</div></div>
        </div>
        <div className="sys-activity-item">
          <span className="sys-icon file"><IconFile /></span>
          <div><div className="sys-title">AI feedback submitted</div><div className="sys-meta">Dr. Amina Bello · Yesterday</div></div>
        </div>
        <div className="sys-activity-item">
          <span className="sys-icon user"><IconUser /></span>
          <div><div className="sys-title">Patient record created</div><div className="sys-meta">Aisha Ibrahim · Oct 21</div></div>
        </div>
      </div>
    </section>
  )
}

/* ─── Main Export ────────────────────────────────────────────── */

export default function DashboardHome({ onNavigate }: { onNavigate: (page: string) => void }) {
  return (
    <>
      {/* Header */}
      <div className="page-heading">
        <div>
          <div className="eyebrow">Overview / Clinical Workspace</div>
          <h1>Good morning, Dr. Bello</h1>
          <p className="subtitle">Here's what's happening across your clinical workspace today.</p>
        </div>
        <button className="btn-start" onClick={() => onNavigate('New Assessment')}>+ Start new assessment</button>
      </div>

      {/* Stat Cards */}
      <section className="metrics" aria-label="Key metrics">
        <StatCard label="Total patients" value={248} note="+ 12 registered this month"
          icon={<IconPatients />} iconBg="#e8f2ff" iconColor="#3b82f6" />
        <StatCard label="Assessments this month" value={86} note="▲ 8.6% compared with last month"
          icon={<IconClipboard />} iconBg="#e8f2ff" iconColor="#3b82f6" />
        <StatCard label="Awaiting doctor review" value={7} note="Needs attention in review queue" noteHighlight
          icon={<IconClock />} iconBg="#fff3e0" iconColor="#e6851e" />
        <StatCard label="AI feedback items" value={14} note="Saved for model evaluation"
          icon={<IconFeedback />} iconBg="#e6f9f0" iconColor="#16a34a" />
      </section>

      {/* Main Content Grid */}
      <div className="dash-grid">
        <div className="dash-left">
          <DashboardAssessments onNavigate={onNavigate} />
          <AssessmentActivity />
        </div>
        <div className="dash-right">
          <DoctorReviewQueue />
          <RecentSystemActivity />
        </div>
      </div>

      {/* Footer Disclaimer */}
      <footer className="dash-footer">
        <span className="dash-footer-icon"><IconWarning /></span>
        <p>
          <strong>Clinical decision support only.</strong> All predictions are informational outputs and must be interpreted by qualified healthcare professionals alongside appropriate clinical evidence. This dashboard contains illustrative demo data and is not connected to a live medical system.
        </p>
      </footer>
    </>
  )
}
