import React from 'react';

interface InvoiceParserIconProps {
  className?: string;
  size?: number;
}

export default function InvoiceParserIcon({ className = "w-5 h-5", size }: InvoiceParserIconProps) {
  const iconSize = size || 20;
  
  return (
    <svg
      width={iconSize}
      height={iconSize}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Document base */}
      <rect
        x="3"
        y="2"
        width="12"
        height="16"
        rx="2"
        ry="2"
        fill="currentColor"
        fillOpacity="0.1"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      
      {/* Document lines */}
      <line
        x1="6"
        y1="6"
        x2="12"
        y2="6"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <line
        x1="6"
        y1="8"
        x2="10"
        y2="8"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <line
        x1="6"
        y1="10"
        x2="11"
        y2="10"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
      
      {/* AI/Processing indicator */}
      <circle
        cx="17"
        cy="7"
        r="3"
        fill="currentColor"
        fillOpacity="0.1"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      
      {/* Neural network dots */}
      <circle cx="15.5" cy="6" r="0.8" fill="currentColor" />
      <circle cx="18.5" cy="6" r="0.8" fill="currentColor" />
      <circle cx="15.5" cy="8" r="0.8" fill="currentColor" />
      <circle cx="18.5" cy="8" r="0.8" fill="currentColor" />
      <circle cx="17" cy="7" r="0.8" fill="currentColor" />
      
      {/* Connection lines */}
      <line
        x1="15.5"
        y1="6"
        x2="17"
        y2="7"
        stroke="currentColor"
        strokeWidth="0.5"
        strokeLinecap="round"
      />
      <line
        x1="18.5"
        y1="6"
        x2="17"
        y2="7"
        stroke="currentColor"
        strokeWidth="0.5"
        strokeLinecap="round"
      />
      <line
        x1="15.5"
        y1="8"
        x2="17"
        y2="7"
        stroke="currentColor"
        strokeWidth="0.5"
        strokeLinecap="round"
      />
      <line
        x1="18.5"
        y1="8"
        x2="17"
        y2="7"
        stroke="currentColor"
        strokeWidth="0.5"
        strokeLinecap="round"
      />
      
      {/* Processing arrow */}
      <path
        d="M19 12 L21 10 L19 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      
      {/* Document corner fold */}
      <path
        d="M13 2 L15 4 L13 4 Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="0.5"
      />
    </svg>
  );
}
