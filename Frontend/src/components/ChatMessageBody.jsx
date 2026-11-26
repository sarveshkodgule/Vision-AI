import React from 'react';

function renderInlineBold(text) {
  const parts = String(text).split(/\*\*([^*]+)\*\*/g);
  return parts.map((part, idx) =>
    idx % 2 === 1 ? (
      <strong key={idx} className="font-semibold text-slate-900">
        {part}
      </strong>
    ) : (
      part.replace(/\*\*/g, '')
    )
  );
}

export default function ChatMessageBody({ text }) {
  if (!text) return null;

  // Normalize cramped inline bullets/numbered points onto separate lines
  const normalized = String(text)
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\s+•\s+/g, '\n• ')
    .replace(/\s+(\d+\.\s+\*\*)/g, '\n$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const lines = normalized.split('\n').filter((line) => line.trim() !== '');

  return (
    <div className="space-y-1.5 leading-relaxed text-[13.5px]">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        const isBullet = trimmed.startsWith('•') || trimmed.startsWith('- ');
        const cleanLine = isBullet ? trimmed.replace(/^[•-]\s*/, '') : trimmed;

        if (isBullet) {
          return (
            <div key={i} className="flex items-start gap-2 pl-1">
              <span className="text-blue-700 font-bold mt-0.5">•</span>
              <span>{renderInlineBold(cleanLine)}</span>
            </div>
          );
        }

        return (
          <p key={i} className="m-0">
            {renderInlineBold(cleanLine)}
          </p>
        );
      })}
    </div>
  );
}
