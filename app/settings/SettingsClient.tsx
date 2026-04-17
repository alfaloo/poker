'use client';

import { useState } from 'react';
import { updateUserSettings, changeUsername, changePassword } from '@/lib/actions/settings';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { THEMES, CARD_BACK_THEMES } from '@/lib/theme/themes';
import type { UserSettings } from '@/lib/settings';

interface SettingsClientProps {
  initialSettings: UserSettings;
  currentUsername: string;
}

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="border-b border-amber-500/30 pb-2 mb-6">
      <h2 className="text-lg font-semibold text-amber-400">{title}</h2>
    </div>
  );
}

export default function SettingsClient({ initialSettings, currentUsername }: SettingsClientProps) {
  const { tableTheme, cardBackTheme, setTableTheme, setCardBackTheme } = useTheme();

  // ── Game Play ──────────────────────────────────────────────────────────────
  const [botDelayMs, setBotDelayMs] = useState(initialSettings.botDelayMs);
  const [botDelayEnabled, setBotDelayEnabled] = useState(initialSettings.botDelayEnabled);
  const [savingDelay, setSavingDelay] = useState(false);

  const handleDelayToggle = async (enabled: boolean) => {
    setBotDelayEnabled(enabled);
    setSavingDelay(true);
    try {
      await updateUserSettings({ botDelayEnabled: enabled });
    } finally {
      setSavingDelay(false);
    }
  };

  const handleDelayCommit = async (value: number) => {
    setSavingDelay(true);
    try {
      await updateUserSettings({ botDelayMs: value });
    } finally {
      setSavingDelay(false);
    }
  };

  // ── Table Theme ────────────────────────────────────────────────────────────
  const handleTableTheme = async (key: string) => {
    setTableTheme(key);
    await updateUserSettings({ tableTheme: key });
  };

  // ── Card Back Theme ────────────────────────────────────────────────────────
  const handleCardBackTheme = async (key: string) => {
    setCardBackTheme(key);
    await updateUserSettings({ cardBackTheme: key });
  };

  // ── Change Username ────────────────────────────────────────────────────────
  const [newUsername, setNewUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [savingUsername, setSavingUsername] = useState(false);

  const handleChangeUsername = async () => {
    if (!newUsername.trim() || newUsername.trim() === currentUsername) return;
    setSavingUsername(true);
    setUsernameStatus(null);
    const result = await changeUsername(newUsername.trim());
    if ('error' in result) {
      setUsernameStatus({ type: 'error', message: result.error });
    } else {
      setUsernameStatus({ type: 'success', message: 'Username updated.' });
      setNewUsername('');
    }
    setSavingUsername(false);
  };

  // ── Change Password ────────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const passwordSaveDisabled =
    !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword;

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', message: 'Passwords do not match.' });
      return;
    }
    setSavingPassword(true);
    setPasswordStatus(null);
    const result = await changePassword(currentPassword, newPassword);
    if ('error' in result) {
      setPasswordStatus({ type: 'error', message: result.error });
    } else {
      setPasswordStatus({ type: 'success', message: 'Password updated.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
    setSavingPassword(false);
  };

  return (
    <div className="space-y-12">
      {/* ── Game Play ─────────────────────────────────────────────────── */}
      <section>
        <SectionHeading title="Game Play" />

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-300">Bot Action Delay</label>
            <div className="flex items-center gap-3">
              {savingDelay && <span className="text-gray-500 text-xs">Saving…</span>}
              <span className="text-amber-400 font-semibold text-sm tabular-nums">
                {botDelayEnabled ? `${(botDelayMs / 1000).toFixed(1)} s` : 'Off'}
              </span>
              <button
                role="switch"
                aria-checked={botDelayEnabled}
                onClick={() => handleDelayToggle(!botDelayEnabled)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${botDelayEnabled ? 'bg-amber-500' : 'bg-gray-600'}`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${botDelayEnabled ? 'translate-x-4' : 'translate-x-1'}`}
                />
              </button>
            </div>
          </div>
          <div className={`flex items-center gap-3 text-xs ${botDelayEnabled ? 'text-gray-500' : 'text-gray-700'}`}>
            <span>Fast</span>
            <input
              type="range"
              min={200}
              max={4000}
              step={200}
              value={botDelayMs}
              disabled={!botDelayEnabled}
              onChange={(e) => setBotDelayMs(Number(e.target.value))}
              onMouseUp={(e) => handleDelayCommit(Number((e.target as HTMLInputElement).value))}
              onTouchEnd={(e) => handleDelayCommit(Number((e.target as HTMLInputElement).value))}
              className={`flex-1 ${botDelayEnabled ? 'accent-amber-400' : 'opacity-40 cursor-not-allowed'}`}
            />
            <span>Slow</span>
          </div>
        </div>
      </section>

      {/* ── Customisation ─────────────────────────────────────────────── */}
      <section>
        <SectionHeading title="Customisation" />

        <div className="space-y-8">
          {/* Table & Background */}
          <div>
            <p className="text-sm font-medium text-gray-300 mb-3">Table &amp; Background</p>
            <div className="grid gap-x-3 gap-y-4" style={{ gridTemplateColumns: 'repeat(auto-fill, 72px)' }}>
              {Object.entries(THEMES).map(([key, theme]) => (
                <button
                  key={key}
                  title={theme.name}
                  onClick={() => handleTableTheme(key)}
                  className="flex flex-col items-center gap-1.5 group w-[72px]"
                >
                  <span
                    className="block rounded-full transition-all"
                    style={{
                      width: 40,
                      height: 40,
                      backgroundColor: theme.swatchColor,
                      outline: tableTheme === key ? '3px solid #f59e0b' : '2px solid transparent',
                      outlineOffset: 2,
                    }}
                  />
                  <span className="text-xs text-gray-400 group-hover:text-gray-200 transition-colors text-center leading-tight w-full">
                    {theme.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Card Back */}
          <div>
            <p className="text-sm font-medium text-gray-300 mb-3">Card Back Colour</p>
            <div className="grid gap-x-3 gap-y-4" style={{ gridTemplateColumns: 'repeat(auto-fill, 72px)' }}>
              {Object.entries(CARD_BACK_THEMES).map(([key, theme]) => (
                <button
                  key={key}
                  title={theme.name}
                  onClick={() => handleCardBackTheme(key)}
                  className="flex flex-col items-center gap-1.5 group w-[72px]"
                >
                  <span
                    className="block rounded-full transition-all"
                    style={{
                      width: 40,
                      height: 40,
                      backgroundColor: theme.bg,
                      outline: cardBackTheme === key ? '3px solid #f59e0b' : '2px solid transparent',
                      outlineOffset: 2,
                    }}
                  />
                  <span className="text-xs text-gray-400 group-hover:text-gray-200 transition-colors text-center leading-tight w-full">
                    {theme.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Account ───────────────────────────────────────────────────── */}
      <section>
        <SectionHeading title="Account" />

        <div className="space-y-8">
          {/* Change Username */}
          <div>
            <p className="text-sm font-medium text-gray-300 mb-3">Change Username</p>
            <div className="flex gap-3">
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="New username"
                className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors text-sm"
              />
              <button
                onClick={handleChangeUsername}
                disabled={savingUsername || !newUsername.trim() || newUsername.trim() === currentUsername}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-gray-900 font-semibold rounded-lg text-sm transition-colors"
              >
                {savingUsername ? 'Saving…' : 'Save'}
              </button>
            </div>
            {usernameStatus && (
              <p className={`mt-2 text-sm ${usernameStatus.type === 'error' ? 'text-red-400' : 'text-green-400'}`}>
                {usernameStatus.message}
              </p>
            )}
          </div>

          {/* Change Password */}
          <div>
            <p className="text-sm font-medium text-gray-300 mb-3">Change Password</p>
            <div className="space-y-3">
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors text-sm"
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 8 characters)"
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors text-sm"
              />
              <div className="flex gap-3">
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors text-sm"
                />
                <button
                  onClick={handleChangePassword}
                  disabled={savingPassword || passwordSaveDisabled}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-gray-900 font-semibold rounded-lg text-sm transition-colors"
                >
                  {savingPassword ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
            {passwordStatus && (
              <p className={`mt-2 text-sm ${passwordStatus.type === 'error' ? 'text-red-400' : 'text-green-400'}`}>
                {passwordStatus.message}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
