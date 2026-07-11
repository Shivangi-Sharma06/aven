import React from 'react';

export default function AvenMorphLogo() {
  return (
    <svg
      className="aven-morph-logo"
      viewBox="0 0 405 150"
      role="img"
      aria-labelledby="aven-morph-logo-title"
      style={{ display: 'block', width: '100%', height: 'auto', overflow: 'visible' }}
    >
      <title id="aven-morph-logo-title">AVEN</title>
      <defs>
        <path
          id="aven-letter-a"
          d="M18 124 L50 26 H70 L102 124 H80 L74 103 H46 L40 124 Z M52 84 H68 L60 55 Z"
          fill="#fff"
          fillRule="evenodd"
        />
        <path
          id="aven-letter-v"
          d="M112 26 H134 L154 94 L174 26 H196 L164 124 H144 Z"
          fill="#fff"
        />
        <path
          id="aven-letter-e"
          d="M210 26 H286 V45 H232 V65 H278 V84 H232 V105 H288 V124 H210 Z"
          fill="#fff"
        />
        <path
          id="aven-letter-n"
          d="M302 124 V26 H322 L368 84 V26 H390 V124 H370 L324 66 V124 Z"
          fill="#fff"
        />
      </defs>

      <g className="aven-morph-logo__shapes" aria-hidden="true">
        <path
          id="aven-shape-a"
          d="M22,124 L60,30 L98,124 Z"
          fill="#fff"
        />
        <path
          id="aven-shape-v"
          d="M154,30 L194,75 L154,124 L114,75 Z"
          fill="#fff"
        />
        <path
          id="aven-shape-e"
          d="M216,38 H284 V112 H216 Z"
          fill="#fff"
        />
        <path
          id="aven-shape-n"
          d="M344,38 a 38,38 0 1,0 0,76 a 38,38 0 1,0 0,-76 Z"
          fill="#fff"
        />
      </g>
    </svg>
  );
}
