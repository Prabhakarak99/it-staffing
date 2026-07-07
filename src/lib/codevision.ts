export interface CodeVisionProvisionInput {
  externalStudentId: string
  email: string
  phoneNumber?: string | null
  technology?: string | null
  name: string
}

export interface CodeVisionProvisionResult {
  studentId: string
  inviteToken: string
  activationUrl: string
  emailSent: boolean
  message: string
}

export function isCodeVisionConfigured() {
  return Boolean(process.env.CODEVISION_API_URL?.trim() && process.env.CODEVISION_API_KEY?.trim())
}

export async function provisionCodeVisionStudent(
  input: CodeVisionProvisionInput,
): Promise<CodeVisionProvisionResult> {
  const baseUrl = process.env.CODEVISION_API_URL!.trim().replace(/\/$/, '')
  const apiKey = process.env.CODEVISION_API_KEY!.trim()

  const response = await fetch(`${baseUrl}/api/integrations/gftvision/students`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-GFTVision-Api-Key': apiKey,
    },
    body: JSON.stringify({
      externalStudentId: input.externalStudentId,
      email: input.email,
      phoneNumber: input.phoneNumber ?? null,
      technology: input.technology ?? null,
      name: input.name,
      adminName: 'GFT Vision Admin',
      programName: input.technology ? `${input.technology} Interview Prep` : 'Consultant Interview Prep',
      sendActivationEmail: process.env.CODEVISION_SEND_ACTIVATION_EMAIL !== 'false',
    }),
  })

  const payload = (await response.json().catch(() => null)) as
    | (CodeVisionProvisionResult & { message?: string })
    | { message?: string }
    | null

  if (!response.ok) {
    throw new Error(payload?.message ?? `CodeVision provisioning failed (${response.status}).`)
  }

  return payload as CodeVisionProvisionResult
}

export async function resendCodeVisionActivation(externalStudentId: string) {
  const baseUrl = process.env.CODEVISION_API_URL!.trim().replace(/\/$/, '')
  const apiKey = process.env.CODEVISION_API_KEY!.trim()

  const response = await fetch(
    `${baseUrl}/api/integrations/gftvision/students/${encodeURIComponent(externalStudentId)}/resend-activation`,
    {
      method: 'POST',
      headers: {
        'X-GFTVision-Api-Key': apiKey,
      },
    },
  )

  const payload = (await response.json().catch(() => null)) as { message?: string } | null
  if (!response.ok) {
    throw new Error(payload?.message ?? `CodeVision resend failed (${response.status}).`)
  }

  return payload
}

export interface CodeVisionPracticeSession {
  id: string
  sessionNumber: number
  technologyName: string
  assignedTranscriptTitle: string | null
  status: 'not_started' | 'in_progress' | 'completed'
  score: number | null
  startedAt: string | null
  completedAt: string | null
  recordingUrl: string | null
  recordingDriveUrl: string | null
  recordingLocalUrl: string | null
  hasOtterAudio: boolean
}

export interface CodeVisionConsultantProgress {
  externalStudentId: string
  studentId: string
  name: string
  email: string
  phoneNumber: string | null
  technology: string | null
  totalSessions: number
  completedCount: number
  inProgressCount: number
  notStartedCount: number
  overallStatus: 'not_started' | 'in_progress' | 'completed'
  averageScore: number | null
  sessions: CodeVisionPracticeSession[]
}

export interface CodeVisionPracticeStatusResponse {
  generatedAt: string
  consultantCount: number
  consultants: CodeVisionConsultantProgress[]
}

function codeVisionHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-GFTVision-Api-Key': process.env.CODEVISION_API_KEY!.trim(),
  }
}

function codeVisionBaseUrl() {
  return process.env.CODEVISION_API_URL!.trim().replace(/\/$/, '')
}

export async function fetchCodeVisionPracticeStatus() {
  const response = await fetch(`${codeVisionBaseUrl()}/api/integrations/gftvision/practice-status`, {
    headers: codeVisionHeaders(),
    cache: 'no-store',
  })

  const payload = (await response.json().catch(() => null)) as
    | CodeVisionPracticeStatusResponse
    | { message?: string }
    | null

  if (!response.ok) {
    throw new Error(payload && 'message' in payload ? payload.message : `CodeVision practice status failed (${response.status}).`)
  }

  return payload as CodeVisionPracticeStatusResponse
}
