import { API_BASE_URL } from './api';

export async function fetchReportPdf(endpoint, signal) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }, signal,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.detail === 'string' ? body.detail : 'The report could not be opened. Please try again.');
  }
  if (!response.headers.get('content-type')?.includes('application/pdf')) throw new Error('The report is not ready as a PDF. Please try again.');
  return response.blob();
}

export function savePdf(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
