import EmbeddedSignupButton from './EmbeddedSignupButton';

export default function ConnectWhatsAppCard() {
  return (
    <div className="rounded-3xl bg-white p-6 lg:p-8 shadow-sm ring-1 ring-black/5">
      <div className="flex items-start gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-green-50 text-3xl shrink-0">
          💬
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Connect WhatsApp</h2>
          <p className="text-gray-600 mt-2">
            Let customers message your flower shop on WhatsApp. Flora will answer automatically using your AI receptionist.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-gray-600">
            <li className="flex items-center gap-2">✓ No Meta developer knowledge needed</li>
            <li className="flex items-center gap-2">✓ Secure Facebook Login</li>
            <li className="flex items-center gap-2">✓ Your token is encrypted and never shown</li>
          </ul>
          <div className="mt-6">
            <EmbeddedSignupButton mode="connect" />
          </div>
        </div>
      </div>
    </div>
  );
}
