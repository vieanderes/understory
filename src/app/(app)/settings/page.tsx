import type { Metadata } from 'next';
import { SettingsView } from '@/features/settings/SettingsView';
import { Title } from '@/features/motion/Title';

export const metadata: Metadata = { title: 'Settings' };

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <p className="t-label">Settings</p>
        <Title>Settings</Title>
      </header>
      <SettingsView />
    </div>
  );
}
