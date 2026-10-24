import { useState } from 'react'
import './style.css'

/* ═══════════════════════════════════════════════════════════════
   TYPES & WDBC FEATURE DEFINITIONS
   ═══════════════════════════════════════════════════════════════ */

export interface PatientInfo {
  mrn: string
  fullName: string
  dob: string
  sex: 'Female' | 'Male' | 'Other' | ''
  department: string
  visitType: string
  reason: string
}

export type MeasurementKey =
  | 'mean_radius' | 'mean_texture' | 'mean_perimeter' | 'mean_area' | 'mean_smoothness'
  | 'mean_compactness' | 'mean_concavity' | 'mean_concave_points' | 'mean_symmetry' | 'mean_fractal_dimension'
  | 'se_radius' | 'se_texture' | 'se_perimeter' | 'se_area' | 'se_smoothness'
  | 'se_compactness' | 'se_concavity' | 'se_concave_points' | 'se_symmetry' | 'se_fractal_dimension'
  | 'worst_radius' | 'worst_texture' | 'worst_perimeter' | 'worst_area' | 'worst_smoothness'
  | 'worst_compactness' | 'worst_concavity' | 'worst_concave_points' | 'worst_symmetry' | 'worst_fractal_dimension'

export interface ClinicalNotes {
  medicalHistory: string
  examinationNotes: string
  previousFindings: string
  referralContext: string
  additionalNotes: string
}

interface FeatureMeta {
  key: string
  label: string
  unit: string
  hint: string
}

const CORE_FEATURES: FeatureMeta[] = [
  { key: 'radius', label: 'Radius', unit: 'mm', hint: 'Mean distance from center to perimeter points' },
  { key: 'texture', label: 'Texture', unit: 'gray-scale', hint: 'Standard deviation of gray-scale values' },
  { key: 'perimeter', label: 'Perimeter', unit: 'mm', hint: 'Core tumor boundary length' },
  { key: 'area', label: 'Area', unit: 'mm²', hint: 'Mass surface area on digitized imaging' },
  { key: 'smoothness', label: 'Smoothness', unit: 'variation', hint: 'Local variation in radius lengths' },
  { key: 'compactness', label: 'Compactness', unit: 'ratio', hint: 'Calculated as perimeter² / area - 1.0' },
  { key: 'concavity', label: 'Concavity', unit: 'contour', hint: 'Severity of concave portions of the contour' },
  { key: 'concave_points', label: 'Concave Points', unit: 'count/ratio', hint: 'Number of concave portions of contour' },
  { key: 'symmetry', label: 'Symmetry', unit: 'ratio', hint: 'Contour bilateral symmetry index' },
  { key: 'fractal_dimension', label: 'Fractal Dimension', unit: 'coastline', hint: 'Coastline approximation - 1.0' },
]

// Benchmark WDBC case (Wisconsin Breast Cancer #842302) for clinical test evaluation
const BENCHMARK_MEASUREMENTS: Record<MeasurementKey, string> = {
  mean_radius: '17.99', mean_texture: '10.38', mean_perimeter: '122.8', mean_area: '1001.0', mean_smoothness: '0.1184',
  mean_compactness: '0.2776', mean_concavity: '0.3001', mean_concave_points: '0.1471', mean_symmetry: '0.2419', mean_fractal_dimension: '0.07871',
  se_radius: '1.095', se_texture: '0.9053', se_perimeter: '8.589', se_area: '153.4', se_smoothness: '0.006399',
  se_compactness: '0.04904', se_concavity: '0.05373', se_concave_points: '0.01587', se_symmetry: '0.03003', se_fractal_dimension: '0.006193',
  worst_radius: '25.38', worst_texture: '17.33', worst_perimeter: '184.6', worst_area: '2019.0', worst_smoothness: '0.1622',
  worst_compactness: '0.6656', worst_concavity: '0.7119', worst_concave_points: '0.2654', worst_symmetry: '0.4601', worst_fractal_dimension: '0.1189'
}

const SAMPLE_PATIENTS = [
  { mrn: 'PT-2041', fullName: 'Fatima Garba', dob: '1972-04-18', sex: 'Female' as const, department: 'Breast Clinic', visitType: 'Follow-up', reason: 'Routine 6-month post-fine-needle aspiration review of right breast nodule.' },
  { mrn: 'PT-1987', fullName: 'Chinedu Emeka Eze', dob: '1978-09-12', sex: 'Female' as const, department: 'Oncology', visitType: 'Referral', reason: 'Referred from outpatient clinic following irregular ultrasound density in upper quadrant.' },
  { mrn: 'PT-2120', fullName: 'Ngozi Okonjo', dob: '1985-11-23', sex: 'Female' as const, department: 'Radiology', visitType: 'Initial Assessment', reason: 'Palpable mass detected during screening mammography.' },
]

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function NewAssessment({ onNavigate, onNotify }: { onNavigate: (page: string) => void; onNotify: (msg: string) => void }) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1)
  const [measurementGroup, setMeasurementGroup] = useState<'mean' | 'se' | 'worst'>('mean')

  // Step 1 State: Patient Info
  const [searchQuery, setSearchQuery] = useState('')
  const [patient, setPatient] = useState<PatientInfo>({
    mrn: '',
    fullName: '',
    dob: '',
    sex: '',
    department: '',
    visitType: '',
    reason: '',
  })
  const [patientErrors, setPatientErrors] = useState<Partial<Record<keyof PatientInfo, string>>>({})

  // Step 2 State: 30 Numerical Measurements (Wisconsin WDBC)
  const [measurements, setMeasurements] = useState<Record<MeasurementKey, string>>({
    mean_radius: '', mean_texture: '', mean_perimeter: '', mean_area: '', mean_smoothness: '',
    mean_compactness: '', mean_concavity: '', mean_concave_points: '', mean_symmetry: '', mean_fractal_dimension: '',
    se_radius: '', se_texture: '', se_perimeter: '', se_area: '', se_smoothness: '',
    se_compactness: '', se_concavity: '', se_concave_points: '', se_symmetry: '', se_fractal_dimension: '',
    worst_radius: '', worst_texture: '', worst_perimeter: '', worst_area: '', worst_smoothness: '',
    worst_compactness: '', worst_concavity: '', worst_concave_points: '', worst_symmetry: '', worst_fractal_dimension: ''
  })
  const [measurementErrors, setMeasurementErrors] = useState<Partial<Record<MeasurementKey, string>>>({})

  // Step 3 State: Clinical Notes
  const [notes, setNotes] = useState<ClinicalNotes>({
    medicalHistory: '',
    examinationNotes: '',
    previousFindings: '',
    referralContext: '',
    additionalNotes: '',
  })

  // Step 4 State: Review & Confirmation
  const [confirmedSafeguard, setConfirmedSafeguard] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submittedSuccess, setSubmittedSuccess] = useState(false)
  const [showClearModal, setShowClearModal] = useState(false)

  // Live Stats
  const filledMeasurementCount = Object.values(measurements).filter(v => v.trim() !== '').length

  /* ─── Field Validation ─────────────────────────────────────── */

  function validatePatientStep(): boolean {
    const errors: Partial<Record<keyof PatientInfo, string>> = {}
    if (!patient.mrn.trim()) errors.mrn = 'Medical Record Number is required'
    if (!patient.fullName.trim()) errors.fullName = 'Patient full name is required'
    if (!patient.dob.trim()) errors.dob = 'Date of birth is required'
    if (!patient.sex) errors.sex = 'Sex recorded in medical record is required'
    if (!patient.department) errors.department = 'Department selection is required'
    if (!patient.visitType) errors.visitType = 'Visit type is required'
    if (!patient.reason.trim()) errors.reason = 'Clinical reason for assessment is required'

    setPatientErrors(errors)
    return Object.keys(errors).length === 0
  }

  function handleMeasurementChange(key: MeasurementKey, val: string) {
    setMeasurements(prev => ({ ...prev, [key]: val }))
    if (val.trim() === '') {
      setMeasurementErrors(prev => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      return
    }
    const num = Number(val)
    if (isNaN(num)) {
      setMeasurementErrors(prev => ({ ...prev, [key]: 'Must be a valid decimal number' }))
    } else if (num < 0) {
      setMeasurementErrors(prev => ({ ...prev, [key]: 'Values must be non-negative' }))
    } else {
      setMeasurementErrors(prev => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  function handlePatientField(field: keyof PatientInfo, val: string) {
    setPatient(prev => ({ ...prev, [field]: val }))
    if (patientErrors[field]) {
      setPatientErrors(prev => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  function loadSamplePatient(sample: typeof SAMPLE_PATIENTS[0]) {
    setPatient(sample)
    setPatientErrors({})
    onNotify(`Loaded registered patient record for ${sample.fullName}`)
  }

  function loadBenchmarkData() {
    setMeasurements(BENCHMARK_MEASUREMENTS)
    setMeasurementErrors({})
    onNotify('Loaded 30 WDBC benchmark mass measurements (#842302)')
  }

  function handleClearAll() {
    setPatient({ mrn: '', fullName: '', dob: '', sex: '', department: '', visitType: '', reason: '' })
    setMeasurements({
      mean_radius: '', mean_texture: '', mean_perimeter: '', mean_area: '', mean_smoothness: '',
      mean_compactness: '', mean_concavity: '', mean_concave_points: '', mean_symmetry: '', mean_fractal_dimension: '',
      se_radius: '', se_texture: '', se_perimeter: '', se_area: '', se_smoothness: '',
      se_compactness: '', se_concavity: '', se_concave_points: '', se_symmetry: '', se_fractal_dimension: '',
      worst_radius: '', worst_texture: '', worst_perimeter: '', worst_area: '', worst_smoothness: '',
      worst_compactness: '', worst_concavity: '', worst_concave_points: '', worst_symmetry: '', worst_fractal_dimension: ''
    })
    setNotes({ medicalHistory: '', examinationNotes: '', previousFindings: '', referralContext: '', additionalNotes: '' })
    setPatientErrors({})
    setMeasurementErrors({})
    setConfirmedSafeguard(false)
    setCurrentStep(1)
    setShowClearModal(false)
    onNotify('Assessment draft has been reset.')
  }

  function handleNext() {
    if (currentStep === 1) {
      if (!validatePatientStep()) {
        onNotify('Please complete all required patient fields before proceeding.')
        return
      }
      setCurrentStep(2)
    } else if (currentStep === 2) {
      // Check if any errors exist
      const hasErrors = Object.keys(measurementErrors).length > 0
      if (hasErrors) {
        onNotify('Please resolve numerical validation errors before continuing.')
        return
      }
      setCurrentStep(3)
    } else if (currentStep === 3) {
      setCurrentStep(4)
    }
  }

  function handleSubmitAssessment() {
    if (!confirmedSafeguard) {
      onNotify('Please review and confirm the clinical safeguards acknowledgement.')
      return
    }
    setIsSubmitting(true)
    setTimeout(() => {
      setIsSubmitting(false)
      setSubmittedSuccess(true)
      onNotify('Assessment draft submitted to clinical review pipeline.')
    }, 1200)
  }

  /* ─── SUCCESS VIEW ─────────────────────────────────────────── */
  if (submittedSuccess) {
    return (
      <div className="assessment-container">
        <div className="breadcrumb-row">
          <div className="eyebrow">Clinical Workspace / New Assessment</div>
          <span className="status-badge completed">Staged for Review</span>
        </div>
        <div className="submission-card">
          <div className="success-icon-wrap">✓</div>
          <h2 className="success-title">Assessment Draft Submitted</h2>
          <p className="success-desc">
            The clinical assessment for <strong>{patient.fullName}</strong> ({patient.mrn}) has been recorded and queued for oncologist evaluation.
          </p>
          <div className="submission-meta-box">
            <div className="submission-meta-item">
              <span>Assessment ID</span>
              <strong>ASM-2025-089</strong>
            </div>
            <div className="submission-meta-item">
              <span>Submitting Clinician</span>
              <strong>Dr. Amina Bello</strong>
            </div>
            <div className="submission-meta-item">
              <span>Measurements</span>
              <strong>{filledMeasurementCount} of 30 Staged</strong>
            </div>
            <div className="submission-meta-item">
              <span>Department</span>
              <strong>{patient.department || 'Oncology'}</strong>
            </div>
            <div className="submission-meta-item">
              <span>Visit Type</span>
              <strong>{patient.visitType || 'Initial Assessment'}</strong>
            </div>
            <div className="submission-meta-item">
              <span>Timestamp</span>
              <strong>Today, {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
            </div>
          </div>
          <div className="prototype-notice-box">
            <strong>Frontend Prototype Demonstration Notice:</strong> In this prototype, client-side input validation and data staging are simulated. In the integrated system, this payload is forwarded to the backend inference microservice running the pretrained Wisconsin Diagnostic Breast Cancer (WDBC) model, which routes predictions and probability scores to the attending clinician's review queue.
          </div>
          <div className="submission-actions">
            <button className="primary" onClick={() => { setSubmittedSuccess(false); handleClearAll() }}>
              ＋ Start another assessment
            </button>
            <button className="secondary" onClick={() => onNavigate('Dashboard')}>
              Return to Dashboard
            </button>
            <button className="secondary" onClick={() => onNavigate('Patients')}>
              View Patient Directory
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="assessment-container">
      {/* Header */}
      <div>
        <div className="breadcrumb-row">
          <div className="eyebrow">Clinical Workspace / New Assessment</div>
          <span className="draft-pill"><span className="draft-dot" /> Draft Assessment</span>
        </div>
        <div className="page-heading" style={{ marginBottom: 12 }}>
          <div>
            <h1>New Assessment</h1>
            <p className="subtitle">Enter patient details and diagnostic measurements to prepare an AI-assisted assessment.</p>
          </div>
        </div>
      </div>

      {/* Stepper Bar */}
      <section className="stepper-panel" aria-label="Assessment progress steps">
        <nav className="stepper-nav">
          <button
            type="button"
            className={`step-item ${currentStep === 1 ? 'active' : currentStep > 1 ? 'completed' : ''}`}
            onClick={() => setCurrentStep(1)}
          >
            <span className="step-number">{currentStep > 1 ? '✓' : '1'}</span>
            <div className="step-text">
              <div className="step-label">Step 1</div>
              <div className="step-title">Patient</div>
            </div>
          </button>
          <div className={`step-divider ${currentStep > 1 ? 'completed' : ''}`} />

          <button
            type="button"
            className={`step-item ${currentStep === 2 ? 'active' : currentStep > 2 ? 'completed' : ''}`}
            onClick={() => { if (validatePatientStep()) setCurrentStep(2) }}
          >
            <span className="step-number">{currentStep > 2 ? '✓' : '2'}</span>
            <div className="step-text">
              <div className="step-label">Step 2</div>
              <div className="step-title">Measurements</div>
            </div>
          </button>
          <div className={`step-divider ${currentStep > 2 ? 'completed' : ''}`} />

          <button
            type="button"
            className={`step-item ${currentStep === 3 ? 'active' : currentStep > 3 ? 'completed' : ''}`}
            onClick={() => { if (validatePatientStep()) setCurrentStep(3) }}
          >
            <span className="step-number">{currentStep > 3 ? '✓' : '3'}</span>
            <div className="step-text">
              <div className="step-label">Step 3</div>
              <div className="step-title">Clinical Notes</div>
            </div>
          </button>
          <div className={`step-divider ${currentStep > 3 ? 'completed' : ''}`} />

          <button
            type="button"
            className={`step-item ${currentStep === 4 ? 'active' : ''}`}
            onClick={() => { if (validatePatientStep()) setCurrentStep(4) }}
          >
            <span className="step-number">4</span>
            <div className="step-text">
              <div className="step-label">Step 4</div>
              <div className="step-title">Review</div>
            </div>
          </button>
        </nav>
      </section>

      {/* Main Two-Column Layout */}
      <div className="assessment-layout">
        {/* Left Column: Active Step Form */}
        <main className="form-card">
          {/* STEP 1: PATIENT */}
          {currentStep === 1 && (
            <div>
              <div className="form-card-head">
                <div>
                  <div className="form-card-title">Patient Information</div>
                  <div className="form-card-desc">Identify the patient and define clinical context for this assessment.</div>
                </div>
              </div>
              <div className="form-card-body">
                {/* Search / Pre-load demo helper */}
                <div className="patient-search-box">
                  <div className="search-box-header">
                    <span className="search-box-title">⌕ Search Registered Patients (EHR Registry Lookup)</span>
                    <span className="search-helper-pill">Frontend Prototype Search</span>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      className="input-text"
                      placeholder="Search patient registry by name or MRN (e.g. Fatima, PT-2041)..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      style={{ paddingLeft: 36 }}
                    />
                    <span style={{ position: 'absolute', left: 13, top: 11, color: '#8998b1', fontSize: 15 }}>⌕</span>
                  </div>
                  <div className="patient-chips">
                    {SAMPLE_PATIENTS.filter(p => `${p.fullName} ${p.mrn}`.toLowerCase().includes(searchQuery.toLowerCase())).map(p => (
                      <button
                        type="button"
                        key={p.mrn}
                        className="patient-chip"
                        onClick={() => {
                          loadSamplePatient(p)
                          setSearchQuery('')
                        }}
                      >
                        <strong>{p.fullName}</strong> <span>({p.mrn})</span>
                      </button>
                    ))}
                    {SAMPLE_PATIENTS.filter(p => `${p.fullName} ${p.mrn}`.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                      <span style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', padding: '4px 0' }}>
                        No matching patient found in registry. Fill in patient information manually below.
                      </span>
                    )}
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="mrn-field">
                      Medical Record Number (MRN) <span className="required-star">*</span>
                    </label>
                    <input
                      id="mrn-field"
                      className={`input-text ${patientErrors.mrn ? 'input-error' : ''}`}
                      placeholder="e.g. PT-2041"
                      value={patient.mrn}
                      onChange={e => handlePatientField('mrn', e.target.value)}
                    />
                    {patientErrors.mrn && <span className="error-msg">{patientErrors.mrn}</span>}
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="name-field">
                      Patient Full Name <span className="required-star">*</span>
                    </label>
                    <input
                      id="name-field"
                      className={`input-text ${patientErrors.fullName ? 'input-error' : ''}`}
                      placeholder="e.g. Fatima Garba"
                      value={patient.fullName}
                      onChange={e => handlePatientField('fullName', e.target.value)}
                    />
                    {patientErrors.fullName && <span className="error-msg">{patientErrors.fullName}</span>}
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="dob-field">
                      Date of Birth <span className="required-star">*</span>
                    </label>
                    <input
                      id="dob-field"
                      type="date"
                      className={`input-text ${patientErrors.dob ? 'input-error' : ''}`}
                      value={patient.dob}
                      onChange={e => handlePatientField('dob', e.target.value)}
                    />
                    {patientErrors.dob && <span className="error-msg">{patientErrors.dob}</span>}
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="sex-field">
                      Sex in Medical Record <span className="required-star">*</span>
                    </label>
                    <select
                      id="sex-field"
                      className={`input-select ${patientErrors.sex ? 'input-error' : ''}`}
                      value={patient.sex}
                      onChange={e => handlePatientField('sex', e.target.value)}
                    >
                      <option value="">Select sex</option>
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                      <option value="Other">Other / Unspecified</option>
                    </select>
                    {patientErrors.sex && <span className="error-msg">{patientErrors.sex}</span>}
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="dept-field">
                      Department / Unit <span className="required-star">*</span>
                    </label>
                    <select
                      id="dept-field"
                      className={`input-select ${patientErrors.department ? 'input-error' : ''}`}
                      value={patient.department}
                      onChange={e => handlePatientField('department', e.target.value)}
                    >
                      <option value="">Select clinical department</option>
                      <option value="Oncology">Oncology</option>
                      <option value="Breast Clinic">Breast Clinic</option>
                      <option value="Radiology">Radiology</option>
                      <option value="Pathology">Pathology</option>
                      <option value="Outpatient Clinic">Outpatient Clinic</option>
                    </select>
                    {patientErrors.department && <span className="error-msg">{patientErrors.department}</span>}
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="visit-field">
                      Visit Type <span className="required-star">*</span>
                    </label>
                    <select
                      id="visit-field"
                      className={`input-select ${patientErrors.visitType ? 'input-error' : ''}`}
                      value={patient.visitType}
                      onChange={e => handlePatientField('visitType', e.target.value)}
                    >
                      <option value="">Select visit type</option>
                      <option value="Initial Assessment">Initial Assessment</option>
                      <option value="Follow-up">Follow-up</option>
                      <option value="Referral">Referral</option>
                      <option value="Screening Review">Screening Review</option>
                    </select>
                    {patientErrors.visitType && <span className="error-msg">{patientErrors.visitType}</span>}
                  </div>

                  <div className="form-group form-full">
                    <label className="form-label" htmlFor="reason-field">
                      Reason for Assessment <span className="required-star">*</span>
                      <span className="field-hint">Clinical indication for model evaluation</span>
                    </label>
                    <textarea
                      id="reason-field"
                      className={`input-textarea ${patientErrors.reason ? 'input-error' : ''}`}
                      placeholder="e.g. Palpable mass detected during screening mammography, referred for AI feature analysis."
                      value={patient.reason}
                      onChange={e => handlePatientField('reason', e.target.value)}
                      rows={3}
                    />
                    {patientErrors.reason && <span className="error-msg">{patientErrors.reason}</span>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: MEASUREMENTS */}
          {currentStep === 2 && (
            <div>
              <div className="form-card-head">
                <div>
                  <div className="form-card-title">Diagnostic Measurements</div>
                  <div className="form-card-desc">
                    Wisconsin Diagnostic Breast Cancer (WDBC) 30-feature vector inputs for the pretrained model.
                  </div>
                </div>
                <button
                  type="button"
                  className="secondary"
                  style={{ fontSize: 12, padding: '7px 12px' }}
                  onClick={loadBenchmarkData}
                >
                  ⚡ Load WDBC Benchmark Sample
                </button>
              </div>
              <div className="form-card-body">
                {/* Note about model feature units */}
                <div className="clinical-note-box">
                  <span className="clinical-note-icon">ℹ</span>
                  <p className="clinical-note-text">
                    <strong>Pretrained Model Schema Note:</strong> The Wisconsin Diagnostic Breast Cancer (WDBC) dataset requires 30 numerical measurements across 10 digitized mass characteristics (Mean, Standard Error, and Worst). Values must adhere to the expected units and decimal formats.
                  </p>
                </div>

                {/* Sub-tabs for Mean / SE / Worst */}
                <div className="measurement-tabs">
                  <button
                    type="button"
                    className={`m-tab-btn ${measurementGroup === 'mean' ? 'active' : ''}`}
                    onClick={() => setMeasurementGroup('mean')}
                  >
                    <span>1. Mean Characteristics</span>
                    <span className="m-count-badge">
                      {CORE_FEATURES.filter(f => measurements[`mean_${f.key}` as MeasurementKey]?.trim() !== '').length} / 10
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`m-tab-btn ${measurementGroup === 'se' ? 'active' : ''}`}
                    onClick={() => setMeasurementGroup('se')}
                  >
                    <span>2. Standard Error (SE)</span>
                    <span className="m-count-badge">
                      {CORE_FEATURES.filter(f => measurements[`se_${f.key}` as MeasurementKey]?.trim() !== '').length} / 10
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`m-tab-btn ${measurementGroup === 'worst' ? 'active' : ''}`}
                    onClick={() => setMeasurementGroup('worst')}
                  >
                    <span>3. Worst / Largest</span>
                    <span className="m-count-badge">
                      {CORE_FEATURES.filter(f => measurements[`worst_${f.key}` as MeasurementKey]?.trim() !== '').length} / 10
                    </span>
                  </button>
                </div>

                {/* 10 Inputs for Active Group */}
                <div className="form-grid-2">
                  {CORE_FEATURES.map(feat => {
                    const fullKey = `${measurementGroup}_${feat.key}` as MeasurementKey
                    const error = measurementErrors[fullKey]
                    return (
                      <div className="measurement-card" key={fullKey}>
                        <div className="m-label-row">
                          <label className="m-title" htmlFor={fullKey}>
                            {feat.label} ({measurementGroup.toUpperCase()})
                          </label>
                          <span className="m-unit">{feat.unit}</span>
                        </div>
                        <input
                          id={fullKey}
                          type="text"
                          inputMode="decimal"
                          className={`m-input ${error ? 'input-error' : ''}`}
                          placeholder="e.g. 0.00"
                          value={measurements[fullKey]}
                          onChange={e => handleMeasurementChange(fullKey, e.target.value)}
                        />
                        {error ? (
                          <span className="error-msg">{error}</span>
                        ) : (
                          <span className="field-hint" style={{ marginTop: 4, display: 'block' }}>{feat.hint}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: CLINICAL NOTES */}
          {currentStep === 3 && (
            <div>
              <div className="form-card-head">
                <div>
                  <div className="form-card-title">Clinical Notes & Findings</div>
                  <div className="form-card-desc">Optional clinical history and observations to accompany this assessment.</div>
                </div>
              </div>
              <div className="form-card-body">
                <div className="clinical-note-box">
                  <span className="clinical-note-icon">ℹ</span>
                  <p className="clinical-note-text">
                    <strong>Qualitative Context:</strong> Clinical notes provide qualitative documentation for reviewing physicians and multidisciplinary team meetings. They do not automatically alter the numerical feature predictions produced by the machine learning model.
                  </p>
                </div>

                <div className="form-grid-2">
                  <div className="form-group form-full">
                    <label className="form-label" htmlFor="med-history">Relevant Medical & Family History</label>
                    <textarea
                      id="med-history"
                      className="input-textarea"
                      placeholder="e.g. Family history of maternal breast carcinoma, previous biopsies, hormone replacement therapy status..."
                      value={notes.medicalHistory}
                      onChange={e => setNotes(prev => ({ ...prev, medicalHistory: e.target.value }))}
                      rows={2}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="exam-notes">Physical Examination Notes</label>
                    <textarea
                      id="exam-notes"
                      className="input-textarea"
                      placeholder="e.g. Discrete non-tender nodule palpable in upper outer quadrant, no skin retraction."
                      value={notes.examinationNotes}
                      onChange={e => setNotes(prev => ({ ...prev, examinationNotes: e.target.value }))}
                      rows={3}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="prev-findings">Previous Investigation Findings</label>
                    <textarea
                      id="prev-findings"
                      className="input-textarea"
                      placeholder="e.g. Prior mammogram classified BI-RADS 3. Targeted ultrasound shows hypoechoic mass."
                      value={notes.previousFindings}
                      onChange={e => setNotes(prev => ({ ...prev, previousFindings: e.target.value }))}
                      rows={3}
                    />
                  </div>

                  <div className="form-group form-full">
                    <label className="form-label" htmlFor="referral-ctx">Referral / Investigation Context</label>
                    <textarea
                      id="referral-ctx"
                      className="input-textarea"
                      placeholder="e.g. Fast-track two-week oncology referral from primary health clinic."
                      value={notes.referralContext}
                      onChange={e => setNotes(prev => ({ ...prev, referralContext: e.target.value }))}
                      rows={2}
                    />
                  </div>

                  <div className="form-group form-full">
                    <label className="form-label" htmlFor="add-notes">Additional Notes</label>
                    <textarea
                      id="add-notes"
                      className="input-textarea"
                      placeholder="e.g. Patient scheduled for follow-up ultrasound in 2 weeks pending AI review queue result."
                      value={notes.additionalNotes}
                      onChange={e => setNotes(prev => ({ ...prev, additionalNotes: e.target.value }))}
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: REVIEW */}
          {currentStep === 4 && (
            <div>
              <div className="form-card-head">
                <div>
                  <div className="form-card-title">Review & Submit Assessment</div>
                  <div className="form-card-desc">Confirm all entered details before queueing for clinical AI decision support.</div>
                </div>
              </div>
              <div className="form-card-body review-section">
                {/* Patient Summary */}
                <div className="review-card">
                  <div className="review-card-title">
                    <span>Patient Details</span>
                    <button type="button" className="review-edit-btn" onClick={() => setCurrentStep(1)}>Edit ✎</button>
                  </div>
                  <div className="review-grid">
                    <div className="review-stat">
                      <div className="review-stat-label">Full Name</div>
                      <div className="review-stat-value">{patient.fullName || '—'}</div>
                    </div>
                    <div className="review-stat">
                      <div className="review-stat-label">MRN</div>
                      <div className="review-stat-value">{patient.mrn || '—'}</div>
                    </div>
                    <div className="review-stat">
                      <div className="review-stat-label">Date of Birth</div>
                      <div className="review-stat-value">{patient.dob || '—'}</div>
                    </div>
                    <div className="review-stat">
                      <div className="review-stat-label">Sex</div>
                      <div className="review-stat-value">{patient.sex || '—'}</div>
                    </div>
                    <div className="review-stat">
                      <div className="review-stat-label">Department</div>
                      <div className="review-stat-value">{patient.department || '—'}</div>
                    </div>
                    <div className="review-stat">
                      <div className="review-stat-label">Visit Type</div>
                      <div className="review-stat-value">{patient.visitType || '—'}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <div className="review-stat-label">Reason for Assessment</div>
                    <div style={{ fontSize: 13, color: '#334155', marginTop: 2 }}>{patient.reason || 'None provided'}</div>
                  </div>
                </div>

                {/* Measurements Summary */}
                <div className="review-card">
                  <div className="review-card-title">
                    <span>Diagnostic Measurements ({filledMeasurementCount} of 30 populated)</span>
                    <button type="button" className="review-edit-btn" onClick={() => setCurrentStep(2)}>Edit ✎</button>
                  </div>
                  <div className="table-wrap">
                    <table className="measurement-review-table">
                      <thead>
                        <tr>
                          <th>FEATURE</th>
                          <th>MEAN</th>
                          <th>STANDARD ERROR</th>
                          <th>WORST</th>
                        </tr>
                      </thead>
                      <tbody>
                        {CORE_FEATURES.map(f => (
                          <tr key={f.key}>
                            <td><strong>{f.label}</strong> ({f.unit})</td>
                            <td>{measurements[`mean_${f.key}` as MeasurementKey] || <span style={{ color: '#94a3b8' }}>—</span>}</td>
                            <td>{measurements[`se_${f.key}` as MeasurementKey] || <span style={{ color: '#94a3b8' }}>—</span>}</td>
                            <td>{measurements[`worst_${f.key}` as MeasurementKey] || <span style={{ color: '#94a3b8' }}>—</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Clinical Notes Summary */}
                <div className="review-card">
                  <div className="review-card-title">
                    <span>Clinical Context & Notes</span>
                    <button type="button" className="review-edit-btn" onClick={() => setCurrentStep(3)}>Edit ✎</button>
                  </div>
                  <div style={{ display: 'grid', gap: 10, fontSize: 12.5 }}>
                    <div>
                      <div className="review-stat-label">Medical History</div>
                      <div>{notes.medicalHistory || <span style={{ color: '#94a3b8' }}>None recorded</span>}</div>
                    </div>
                    <div>
                      <div className="review-stat-label">Examination Notes</div>
                      <div>{notes.examinationNotes || <span style={{ color: '#94a3b8' }}>None recorded</span>}</div>
                    </div>
                    <div>
                      <div className="review-stat-label">Previous Findings</div>
                      <div>{notes.previousFindings || <span style={{ color: '#94a3b8' }}>None recorded</span>}</div>
                    </div>
                  </div>
                </div>

                {/* Submitting Clinician Card */}
                <div className="review-card" style={{ background: '#f8fafc' }}>
                  <div className="review-card-title">Submitting Clinician</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div className="avatar" style={{ width: 40, height: 40, fontSize: 14 }}>AB</div>
                    <div>
                      <div style={{ fontWeight: 800, color: 'var(--navy)', fontSize: 13.5 }}>Dr. Amina Bello</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>Oncology Specialist · Staff ID: HW-DOC-001 · Hospital Network Verified</div>
                    </div>
                  </div>
                </div>

                {/* Confirmation Checkbox */}
                <div className={`confirmation-box ${confirmedSafeguard ? 'checked' : ''}`}>
                  <input
                    type="checkbox"
                    id="safeguard-confirm"
                    checked={confirmedSafeguard}
                    onChange={e => setConfirmedSafeguard(e.target.checked)}
                  />
                  <label htmlFor="safeguard-confirm" className="confirmation-text">
                    I confirm that the information has been entered accurately and understand that AI output supports, but does not replace, clinical judgement.
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Form Bottom Action Controls */}
          <div className="form-actions">
            <div className="actions-left">
              <button
                type="button"
                className="secondary"
                style={{ color: '#dc2626' }}
                onClick={() => setShowClearModal(true)}
              >
                ✕ Clear Draft
              </button>
            </div>
            <div className="actions-right">
              {currentStep > 1 && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setCurrentStep((currentStep - 1) as 1 | 2 | 3)}
                >
                  ← Back
                </button>
              )}
              {currentStep < 4 ? (
                <button
                  type="button"
                  className="primary"
                  onClick={handleNext}
                >
                  Continue →
                </button>
              ) : (
                <button
                  type="button"
                  className="primary"
                  disabled={!confirmedSafeguard || isSubmitting}
                  style={{ opacity: !confirmedSafeguard || isSubmitting ? 0.6 : 1 }}
                  onClick={handleSubmitAssessment}
                >
                  {isSubmitting ? 'Submitting Assessment...' : '✓ Submit Assessment'}
                </button>
              )}
            </div>
          </div>
        </main>

        {/* Right Column: Live Summary Sidebar */}
        <aside className="assessment-sidebar">
          {/* Summary Card */}
          <div className="side-card">
            <div className="side-card-title">
              <span>Assessment Summary</span>
              <span className="status-badge pending">Step {currentStep} of 4</span>
            </div>
            <div className="side-stat-list">
              <div className="side-stat-row">
                <span className="side-stat-label">Patient Name</span>
                <span className="side-stat-val">{patient.fullName || 'Not specified'}</span>
              </div>
              <div className="side-stat-row">
                <span className="side-stat-label">Medical Record #</span>
                <span className="side-stat-val">{patient.mrn || '—'}</span>
              </div>
              <div className="side-stat-row">
                <span className="side-stat-label">Visit Type</span>
                <span className="side-stat-val">{patient.visitType || '—'}</span>
              </div>
              <div className="side-stat-row">
                <span className="side-stat-label">Department</span>
                <span className="side-stat-val">{patient.department || '—'}</span>
              </div>
              <div>
                <div className="side-stat-row" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                  <span className="side-stat-label">Measurements</span>
                  <span className="side-stat-val"><strong>{filledMeasurementCount}</strong> / 30</span>
                </div>
                <div className="measurement-progress-bar">
                  <div
                    className="measurement-progress-fill"
                    style={{ width: `${(filledMeasurementCount / 30) * 100}%` }}
                  />
                </div>
              </div>
              <div className="side-stat-row">
                <span className="side-stat-label">Status</span>
                <span className="side-stat-val" style={{ color: '#d97706' }}>
                  {currentStep === 4 ? 'Ready for review' : 'Drafting'}
                </span>
              </div>
            </div>
          </div>

          {/* Before You Continue Card */}
          <div className="checklist-card">
            <div className="checklist-header">Before You Continue</div>
            <ul className="checklist-list">
              <li>Confirm patient MRN against hospital wristband or referral note.</li>
              <li>Ensure all 30 WDBC measurements match standardized digital imaging extracts.</li>
              <li>Review clinical history for prior irradiation or surgical excision.</li>
            </ul>
          </div>

          {/* Clinical Safeguard Card */}
          <div className="safeguard-card">
            <div className="safeguard-header">
              <span>🛡</span>
              <span>Clinical Safeguard</span>
            </div>
            <p className="safeguard-text">
              AI-generated results support clinical decision-making and do not replace professional judgement. A qualified clinician must review the output.
            </p>
          </div>
        </aside>
      </div>

      {/* Confirmation Modal to Clear Form */}
      {showClearModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-dialog">
            <h3 className="modal-title">Clear Assessment Draft?</h3>
            <p className="modal-text">
              Are you sure you want to discard all entered patient data, measurements, and clinical notes? This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setShowClearModal(false)}
              >
                Keep Editing
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleClearAll}
              >
                Discard All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
