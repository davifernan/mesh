import React, { useState } from 'react';
import FocusTrap from 'focus-trap-react';
import {
  Box,
  Icon,
  IconButton,
  Icons,
  IconSrc,
  Text,
  config,
  color,
  toRem,
} from 'folds';
import { MatrixClient } from 'matrix-js-sdk';
import { mxcUrlToHttp } from '../../utils/matrix';
import { stopPropagation } from '../../utils/keyboard';

// Render an icon spec to a React element.
// iconSpec can be:
//   undefined           → show name initial
//   'icons:CategoryName'→ folds icon
//   'emoji:🧩'          → emoji character
//   'mxc://...'         → media URL (rendered as img)
//   bare char           → treated as emoji
export function renderItemIcon(
  iconSpec: string | undefined,
  nameInitial: string,
  mx: MatrixClient,
  useAuth: boolean
): React.ReactNode {
  if (!iconSpec) {
    return (
      <Text size="T200" style={{ fontWeight: 700 }}>
        {nameInitial[0]?.toUpperCase() ?? '?'}
      </Text>
    );
  }
  if (iconSpec.startsWith('icons:')) {
    const name = iconSpec.slice(6) as keyof typeof Icons;
    const src = Icons[name] as IconSrc | undefined;
    return src ? (
      <Icon src={src} size="200" />
    ) : (
      <Text size="T200">{nameInitial[0]?.toUpperCase() ?? '?'}</Text>
    );
  }
  if (iconSpec.startsWith('mxc://')) {
    const url = mxcUrlToHttp(mx, iconSpec, useAuth, 20, 20, 'crop');
    return url ? (
      <img src={url} alt="" style={{ width: 16, height: 16, objectFit: 'cover', borderRadius: 2 }} />
    ) : (
      <Text size="T200">{nameInitial[0]?.toUpperCase() ?? '?'}</Text>
    );
  }
  // emoji: prefix or bare character
  const char = iconSpec.startsWith('emoji:') ? iconSpec.slice(6) : iconSpec;
  return <span style={{ fontSize: 14, lineHeight: 1 }}>{char}</span>;
}

type PanelIconPickerProps = {
  onSelect: (iconSpec: string | undefined) => void;
  onClose: () => void;
};

export function PanelIconPicker({ onSelect, onClose }: PanelIconPickerProps) {
  const [search, setSearch] = useState('');
  const [customInput, setCustomInput] = useState('');

  const allIconNames = Object.keys(Icons) as Array<keyof typeof Icons>;
  const filtered = search
    ? allIconNames.filter((n) => n.toLowerCase().includes(search.toLowerCase()))
    : allIconNames;

  const handleCustomSubmit = () => {
    const val = customInput.trim();
    if (!val) return;
    // If it looks like an emoji (not a URL or icon: spec), prefix with emoji:
    if (!val.startsWith('mxc://') && !val.startsWith('icons:') && !val.startsWith('emoji:')) {
      onSelect(`emoji:${val}`);
    } else {
      onSelect(val);
    }
    onClose();
  };

  return (
    <FocusTrap
      focusTrapOptions={{
        clickOutsideDeactivates: true,
        returnFocusOnDeactivate: false,
        onDeactivate: onClose,
        escapeDeactivates: stopPropagation,
      }}
    >
      <Box
        direction="Column"
        style={{
          background: `var(--bg-surface)`,
          border: `1px solid ${color.Surface.ContainerLine}`,
          borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          width: toRem(260),
          maxHeight: toRem(360),
          overflow: 'hidden',
        }}
      >
        {/* Custom emoji / mxc:// input */}
        <Box
          direction="Column"
          gap="100"
          style={{ padding: config.space.S200, borderBottom: `1px solid ${color.Surface.ContainerLine}` }}
        >
          <Text size="L400">Custom icon (emoji or mxc://)</Text>
          <Box gap="100">
            <input
              type="text"
              placeholder="🧩 or mxc://..."
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCustomSubmit(); }}
              style={{
                flex: 1,
                padding: `${config.space.S100} ${config.space.S200}`,
                border: `1px solid ${color.Surface.ContainerLine}`,
                borderRadius: 4,
                background: 'var(--bg-surface)',
                color: 'var(--tc-surface-high)',
                fontSize: 13,
              }}
              autoFocus
            />
            <IconButton
              size="300"
              radii="300"
              onClick={handleCustomSubmit}
              aria-label="Use this icon"
            >
              <Icon src={Icons.Check} size="100" />
            </IconButton>
          </Box>
        </Box>

        {/* Icon grid search */}
        <Box style={{ padding: `${config.space.S100} ${config.space.S200}`, borderBottom: `1px solid ${color.Surface.ContainerLine}` }}>
          <input
            type="search"
            placeholder="Search icons…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: `${config.space.S100} ${config.space.S200}`,
              border: `1px solid ${color.Surface.ContainerLine}`,
              borderRadius: 4,
              background: 'var(--bg-surface)',
              color: 'var(--tc-surface-high)',
              fontSize: 13,
              boxSizing: 'border-box',
            }}
          />
        </Box>

        {/* Scrollable icon grid */}
        <Box
          style={{
            overflowY: 'auto',
            padding: config.space.S100,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(32px, 1fr))',
            gap: 4,
            flex: 1,
          }}
        >
          {filtered.map((name) => (
            <IconButton
              key={name}
              size="300"
              radii="300"
              onClick={() => { onSelect(`icons:${name}`); onClose(); }}
              aria-label={name}
              title={name}
            >
              <Icon src={Icons[name]} size="200" />
            </IconButton>
          ))}
        </Box>

        {/* Footer: clear button */}
        <Box
          style={{
            padding: `${config.space.S100} ${config.space.S200}`,
            borderTop: `1px solid ${color.Surface.ContainerLine}`,
          }}
        >
          <IconButton
            size="300"
            radii="300"
            onClick={() => { onSelect(undefined); onClose(); }}
            aria-label="Clear icon (revert to name initial)"
          >
            <Icon src={Icons.Cross} size="100" />
          </IconButton>
          <Text size="T200" style={{ marginLeft: 8 }}>Clear (use name initial)</Text>
        </Box>
      </Box>
    </FocusTrap>
  );
}
