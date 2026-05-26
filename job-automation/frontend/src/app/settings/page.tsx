import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Configure your profile, API keys, email credentials, and job preferences.',
};

const sections = [
  {
    id: 'profile',
    title: '👤 Profile',
    fields: [
      { label: 'Full Name',     id: 'settings-name',      type: 'text',  placeholder: 'Aditya Kumar' },
      { label: 'Email',         id: 'settings-email',     type: 'email', placeholder: 'you@gmail.com' },
      { label: 'LinkedIn URL',  id: 'settings-linkedin',  type: 'url',   placeholder: 'https://linkedin.com/in/...' },
      { label: 'GitHub URL',    id: 'settings-github',    type: 'url',   placeholder: 'https://github.com/...' },
      { label: 'Portfolio URL', id: 'settings-portfolio', type: 'url',   placeholder: 'https://yoursite.com' },
    ],
  },
  {
    id: 'preferences',
    title: '🎯 Job Preferences',
    fields: [
      { label: 'Target Roles (comma-separated)',     id: 'settings-roles',     type: 'text', placeholder: 'Software Engineer, Full Stack Engineer' },
      { label: 'Target Locations (comma-separated)', id: 'settings-locations', type: 'text', placeholder: 'Remote, San Francisco, New York' },
      { label: 'Min Salary (USD)',                   id: 'settings-salary',    type: 'number', placeholder: '100000' },
    ],
  },
  {
    id: 'ai',
    title: '🤖 AI Config',
    fields: [
      { label: 'Gemini API Key', id: 'settings-gemini-key', type: 'password', placeholder: 'AIza...' },
    ],
  },
  {
    id: 'email',
    title: '✉️ Email (Gmail SMTP)',
    fields: [
      { label: 'Gmail Address',   id: 'settings-gmail-user', type: 'email', placeholder: 'you@gmail.com' },
      { label: 'App Password',    id: 'settings-gmail-pass', type: 'password', placeholder: 'xxxx xxxx xxxx xxxx' },
    ],
  },
];

export default function SettingsPage() {
  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Configure your profile, preferences, and API credentials</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '640px' }}>
        {sections.map((section) => (
          <div key={section.id} className="card" id={`settings-section-${section.id}`}>
            <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '16px' }}>
              {section.title}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {section.fields.map((field) => (
                <div key={field.id}>
                  <label
                    htmlFor={field.id}
                    style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}
                  >
                    {field.label}
                  </label>
                  <input
                    id={field.id}
                    type={field.type}
                    placeholder={field.placeholder}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--surface-5)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      outline: 'none',
                      transition: 'border-color 0.15s',
                    }}
                    onFocus={(e) => { e.target.style.borderColor = 'var(--brand-500)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--surface-5)'; }}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: '24px' }}>
          <button id="settings-save-btn" className="btn btn-primary">
            Save Settings
          </button>
        </div>
      </div>
    </>
  );
}
