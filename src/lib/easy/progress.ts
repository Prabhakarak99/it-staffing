/** Work done on a submission for its suggested consultants (safe to use in the browser) */
export interface EasyProgress {
  /** Suggested consultants (same technology, In-Market) */
  suggested: number;
  /** Of those, how many have an AI-updated resume for this submission */
  generated: number;
  /** Of those, how many were emailed to at least one vendor */
  emailed: number;
  /** Vendor emails sent in total */
  emails: number;
}

/** Progress from a consultant list (the server's, or the panel's loaded list in the browser) */
export function progressOf(consultants: { tailored: unknown; sentCount: number }[]): EasyProgress {
  return {
    suggested: consultants.length,
    generated: consultants.filter((c) => c.tailored).length,
    emailed: consultants.filter((c) => c.sentCount > 0).length,
    emails: consultants.reduce((n, c) => n + c.sentCount, 0),
  };
}
