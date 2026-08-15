const permissions = [
  { name: 'Read WhatsApp Business Account', description: 'Identify your connected business and phone number.' },
  { name: 'Manage WhatsApp Business Messages', description: 'Send and receive customer messages through Flora.' },
  { name: 'Business App Coexistence', description: 'Keep your personal WhatsApp Business app running alongside Flora.' },
];

export default function PermissionsCard() {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <h2 className="text-lg font-bold text-gray-900">Approved Permissions</h2>
      <p className="text-sm text-gray-600 mt-1">
        These permissions were approved when you connected with Facebook Login.
      </p>
      <ul className="mt-4 space-y-3">
        {permissions.map((permission) => (
          <li key={permission.name} className="flex items-start gap-3 text-sm">
            <span className="mt-0.5 text-green-600">✓</span>
            <div>
              <p className="font-semibold text-gray-900">{permission.name}</p>
              <p className="text-gray-600">{permission.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
