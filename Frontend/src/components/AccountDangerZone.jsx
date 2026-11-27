import { useState } from 'react';
import { api } from '../lib/api';
import { clearAuthSession } from '../lib/authSession';

export default function AccountDangerZone({ onDeleted }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const deactivate = async () => {
    setBusy(true); setError('');
    try {
      await api.delete('/auth/account');
      clearAuthSession();
      onDeleted();
    } catch (requestError) {
      setError(requestError.message || 'Account deactivation failed. Please try again.');
    } finally { setBusy(false); }
  };
  return <section className="account-danger-zone" aria-labelledby="account-danger-title">
    <h3 id="account-danger-title">Deactivate account</h3>
    <p>Your sign-in will be disabled. Clinical records are retained for hospital and legal retention requirements.</p>
    {error && <p className="patient-feedback" role="alert">{error}</p>}
    {!confirming ? <button className="danger-button" onClick={() => setConfirming(true)}>Deactivate my account</button> : <div className="button-row"><button className="button-outline" onClick={() => setConfirming(false)}>Cancel</button><button className="danger-button" disabled={busy} onClick={deactivate}>{busy ? 'Deactivating…' : 'Confirm deactivation'}</button></div>}
  </section>;
}
