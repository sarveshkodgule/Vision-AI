import { usePatientLanguage } from '../lib/patientLanguage';
import { useState } from 'react';
import { hospitalPhotos } from '../lib/hospitalPhotos';

export default function HospitalGallery() {
  const { t } = usePatientLanguage();
  const [failed, setFailed] = useState([]);
  const photos = hospitalPhotos.filter(photo => !failed.includes(photo.src));
  if (!photos.length) return null;
  return <section className="hospital-section hospital-container" aria-labelledby="hospital-gallery-title">
    <p className="eyebrow">{t("A FAMILIAR PLACE BEFORE YOUR VISIT")}</p><h2 id="hospital-gallery-title">{t("Inside our hospital.")}</h2>
    <div className="hospital-gallery">{photos.map(photo => <figure key={photo.src}><a href={photo.src} target="_blank" rel="noreferrer" aria-label={`Open photo: ${photo.caption}`}><img src={photo.src} alt={photo.alt} loading="lazy" width="900" height="600" onError={() => setFailed(previous => [...previous, photo.src])}/></a><figcaption><strong>{photo.caption}</strong><a href={photo.source} target="_blank" rel="noreferrer">{photo.sourceLabel || 'Photo source'} ↗</a></figcaption></figure>)}</div>
  </section>;
}
