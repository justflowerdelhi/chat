'use client';

import { useEffect, useState } from 'react';
import {
  getMe,
  getSetupData,
  getWhatsAppPhone,
  generateDefaultFAQs,
  completeSetup,
  connectDesignGallery,
  setCatalogSource,
} from '@/app/setup/actions';

const STEPS = [
  { key: 'business', label: 'Business' },
  { key: 'services', label: 'Services' },
  { key: 'faqs', label: 'FAQs' },
  { key: 'catalog', label: 'Catalog' },
  { key: 'ai', label: 'AI' },
  { key: 'review', label: 'Review' },
];

const CATEGORIES = ['Ordering', 'Delivery', 'Payment', 'Flowers', 'Customisation', 'Cancellation', 'Refund', 'Corporate', 'Wedding', 'Pickup', 'General'];

const TONE_OPTIONS = [
  { value: 'conservative', label: 'Professional' },
  { value: 'balanced', label: 'Friendly' },
  { value: 'creative', label: 'Premium' },
];

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'hinglish', label: 'Hinglish' },
];

const EMOJI_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'low', label: 'Occasional' },
  { value: 'medium', label: 'More expressive' },
];

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  priority: number;
}

interface CatalogItem {
  id: string;
  name: string;
  price: number;
  description: string;
  occasion: string;
  flower_types: string;
  color: string;
  style: string;
  image_url: string;
  categories: string;
  availability: boolean;
  featured: boolean;
  same_day: boolean;
}

export default function SetupPage() {
  const [stepIndex, setStepIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState(false);

  const [business, setBusiness] = useState({
    business_name: '',
    contact_person: '',
    phone: '',
    email: '',
    website: '',
    address: '',
    city: '',
    delivery_areas: '',
    working_hours: '',
  });

  const [services, setServices] = useState({
    same_day_available: false,
    midnight_delivery: false,
    emergency_delivery: false,
    delivery_charges: '',
    customization_available: false,
    pickup_available: false,
    wedding_orders: false,
    corporate_orders: false,
    payment_methods: 'UPI, Cash, Bank transfer',
    upi_id: '',
    gst_number: '',
    cancellation_policy: '',
    refund_policy: '',
  });

  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [catalogSource, setSelectedCatalogSource] = useState<'design_gallery' | 'manual_catalog' | null>(null);
  const [designGallery, setDesignGallery] = useState<{ count: number; available: boolean }>({ count: 0, available: false });
  const [ai, setAi] = useState({
    tone: 'balanced',
    language: 'en',
    emoji_level: 'low',
    greeting: '',
  });

  useEffect(() => {
    const edit = window.location.search.includes('edit=1');
    async function init() {
      try {
        const me = await getMe();
        if (!me) {
          setError('Please sign in first.');
          setLoading(false);
          return;
        }

        const data = await getSetupData();
        const phone = data.phone || '';

        if (data.business && !edit) {
          setCompleted(true);
          setLoading(false);
          return;
        }

        if (data.business) {
          const b = data.business as Record<string, string | boolean>;
          setBusiness({
            business_name: (b.business_name as string) || '',
            contact_person: (b.contact_person as string) || '',
            phone: (b.phone_numbers as string) || phone,
            email: (b.email as string) || '',
            website: (b.website as string) || '',
            address: (b.address as string) || '',
            city: (b.city as string) || '',
            delivery_areas: (b.delivery_areas as string) || '',
            working_hours: (b.working_hours as string) || '',
          });
          setServices({
            same_day_available: !!b.same_day_available,
            midnight_delivery: !!b.midnight_delivery,
            emergency_delivery: !!b.emergency_delivery,
            delivery_charges: (b.delivery_charges as string) || '',
            customization_available: !!b.customization_available,
            pickup_available: !!b.pickup_available,
            wedding_orders: !!b.wedding_orders,
            corporate_orders: !!b.corporate_orders,
            payment_methods: (b.payment_methods as string) || 'UPI, Cash, Bank transfer',
            upi_id: (b.upi_id as string) || '',
            gst_number: (b.gst_number as string) || '',
            cancellation_policy: (b.cancellation_policy as string) || '',
            refund_policy: (b.refund_policy as string) || '',
          });
        } else {
          setBusiness((prev) => ({ ...prev, phone }));
        }

        if (data.ai) {
          const a = data.ai as Record<string, string>;
          setAi({
            tone: (a.creativity as 'conservative' | 'balanced' | 'creative') || 'balanced',
            language: (a.language as 'en' | 'hi' | 'hinglish') || 'en',
            emoji_level: (a.emoji_level as 'none' | 'low' | 'medium' | 'high') || 'low',
            greeting: (a.greeting as string) || '',
          });
        }

        if (data.faqs.length > 0) {
          setFaqs(
            data.faqs.map((f: any) => ({
              id: f.id as string,
              question: f.question as string,
              answer: f.answer as string,
              category: (f.category as string) || 'General',
              priority: Number(f.priority) || 0,
            }))
          );
        }

        if (data.catalog.length > 0) {
          setCatalog(
            data.catalog.map((p: any) => ({
              id: p.id as string,
              name: p.name as string,
              price: Number(p.price) || 0,
              description: (p.description as string) || '',
              occasion: (p.occasion as string) || '',
              flower_types: (p.flower_types as string) || '',
              color: (p.color as string) || '',
              style: (p.style as string) || '',
              image_url: (p.image_url as string) || '',
              categories: (p.categories as string) || '',
              availability: !!p.availability,
              featured: !!p.featured,
              same_day: !!p.same_day,
            }))
          );
        }

        if (data.designGallery) {
          setDesignGallery({
            count: Number((data.designGallery as any).count) || 0,
            available: !!((data.designGallery as any).available) || ((data.designGallery as any).count || 0) > 0,
          });
        }

        if (data.catalogSource) {
          setSelectedCatalogSource((data.catalogSource as any).source === 'design_gallery' ? 'design_gallery' : 'manual_catalog');
        }

        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load setup');
        setLoading(false);
      }
    }
    void init();
  }, []);

  async function generateFAQs() {
    const businessProfile = { ...business, phone_numbers: business.phone };
    const generated = await generateDefaultFAQs(businessProfile, services);
    setFaqs(generated.map((f, i) => ({ ...f, id: `new-${i}` })));
  }

  function updateFaq(id: string, field: keyof FAQItem, value: string) {
    setFaqs((prev) => prev.map((f) => (f.id === id ? { ...f, [field]: value } : f)));
  }

  function removeFaq(id: string) {
    setFaqs((prev) => prev.filter((f) => f.id !== id));
  }

  function addFaq() {
    setFaqs((prev) => [
      ...prev,
      { id: `new-${Date.now()}`, question: '', answer: '', category: 'General', priority: 0 },
    ]);
  }

  function updateCatalog(id: string, field: keyof CatalogItem, value: unknown) {
    setCatalog((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  }

  function removeCatalog(id: string) {
    setCatalog((prev) => prev.filter((p) => p.id !== id));
  }

  function addCatalog() {
    setCatalog((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        name: '',
        price: 0,
        description: '',
        occasion: '',
        flower_types: '',
        color: '',
        style: '',
        image_url: '',
        categories: '',
        availability: true,
        featured: false,
        same_day: false,
      },
    ]);
  }

  async function activate() {
    setLoading(true);
    try {
      const payload = {
        business,
        services,
        faqs: faqs.map((f) => ({ question: f.question, answer: f.answer, category: f.category, priority: f.priority })),
        catalog: catalog.map((p) => ({ ...p } as any)),
        ai: ai as any,
      };
      await completeSetup(payload as any);
      window.location.href = '/admin';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
      setLoading(false);
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-[#f7faf7] flex items-center justify-center">Loading setup...</main>;
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#f7faf7] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 shadow-sm ring-1 ring-black/5 text-center">
          <p className="text-red-600 font-semibold mb-4">{error}</p>
          <a href="/login" className="rounded-xl bg-green-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-green-800">
            Sign in
          </a>
        </div>
      </main>
    );
  }

  if (completed) {
    return (
      <main className="min-h-screen bg-[#f7faf7] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 shadow-sm ring-1 ring-black/5 text-center max-w-md">
          <h1 className="text-2xl font-bold mb-2">Setup complete</h1>
          <p className="text-gray-600 mb-6">Your AI receptionist is ready.</p>
          <div className="flex flex-col gap-3">
            <a href="/admin" className="rounded-xl bg-green-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-green-800">
              Go to Admin
            </a>
            <a href="/setup?edit=1" className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-green-700 ring-1 ring-green-200 hover:bg-green-50">
              Edit Setup
            </a>
          </div>
        </div>
      </main>
    );
  }

  const step = STEPS[stepIndex];

  return (
    <main className="min-h-screen bg-[#f7faf7] p-4 lg:p-8 text-gray-900">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Floraprise AI Setup</h1>
        <p className="text-gray-600 mb-6">Get your AI receptionist ready in minutes.</p>

        <div className="flex items-center gap-2 mb-8 overflow-x-auto">
          {STEPS.map((s, idx) => (
            <div
              key={s.key}
              className={`flex-1 min-w-[80px] rounded-xl px-3 py-2 text-center text-xs font-semibold transition ${
                idx <= stepIndex ? 'bg-green-700 text-white' : 'bg-white ring-1 ring-gray-200 text-gray-500'
              }`}
            >
              <div className="text-lg font-bold">{idx + 1}</div>
              {s.label}
            </div>
          ))}
        </div>

        {step.key === 'business' && (
          <section className="bg-white rounded-3xl p-6 shadow-sm ring-1 ring-black/5">
            <h2 className="text-xl font-bold mb-4">1. Business details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Business name" value={business.business_name} onChange={(v) => setBusiness({ ...business, business_name: v })} />
              <Input label="Contact person" value={business.contact_person} onChange={(v) => setBusiness({ ...business, contact_person: v })} />
              <Input label="Phone" value={business.phone} onChange={(v) => setBusiness({ ...business, phone: v })} />
              <Input label="Email" value={business.email} onChange={(v) => setBusiness({ ...business, email: v })} />
              <Input label="Website" value={business.website} onChange={(v) => setBusiness({ ...business, website: v })} />
              <Input label="City" value={business.city} onChange={(v) => setBusiness({ ...business, city: v })} />
              <Input label="Address" value={business.address} onChange={(v) => setBusiness({ ...business, address: v })} className="sm:col-span-2" />
              <Input label="Delivery / service areas" value={business.delivery_areas} onChange={(v) => setBusiness({ ...business, delivery_areas: v })} className="sm:col-span-2" />
              <Input label="Working hours" value={business.working_hours} onChange={(v) => setBusiness({ ...business, working_hours: v })} className="sm:col-span-2" />
            </div>
          </section>
        )}

        {step.key === 'services' && (
          <section className="bg-white rounded-3xl p-6 shadow-sm ring-1 ring-black/5">
            <h2 className="text-xl font-bold mb-4">2. Services &amp; delivery</h2>
            <div className="grid gap-4 sm:grid-cols-2 mb-4">
              <Toggle label="Same-day delivery" checked={services.same_day_available} onChange={(v) => setServices({ ...services, same_day_available: v })} />
              <Toggle label="Midnight delivery" checked={services.midnight_delivery} onChange={(v) => setServices({ ...services, midnight_delivery: v })} />
              <Toggle label="Emergency delivery" checked={services.emergency_delivery} onChange={(v) => setServices({ ...services, emergency_delivery: v })} />
              <Toggle label="Bouquet customisation" checked={services.customization_available} onChange={(v) => setServices({ ...services, customization_available: v })} />
              <Toggle label="In-store pickup" checked={services.pickup_available} onChange={(v) => setServices({ ...services, pickup_available: v })} />
              <Toggle label="Wedding / event orders" checked={services.wedding_orders} onChange={(v) => setServices({ ...services, wedding_orders: v })} />
              <Toggle label="Corporate orders" checked={services.corporate_orders} onChange={(v) => setServices({ ...services, corporate_orders: v })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Delivery charges" value={services.delivery_charges} onChange={(v) => setServices({ ...services, delivery_charges: v })} />
              <Input label="Payment methods" value={services.payment_methods} onChange={(v) => setServices({ ...services, payment_methods: v })} />
              <Input label="UPI ID" value={services.upi_id} onChange={(v) => setServices({ ...services, upi_id: v })} />
              <Input label="GST number" value={services.gst_number} onChange={(v) => setServices({ ...services, gst_number: v })} />
              <Input label="Cancellation policy" value={services.cancellation_policy} onChange={(v) => setServices({ ...services, cancellation_policy: v })} className="sm:col-span-2" />
              <Input label="Refund policy" value={services.refund_policy} onChange={(v) => setServices({ ...services, refund_policy: v })} className="sm:col-span-2" />
            </div>
          </section>
        )}

        {step.key === 'faqs' && (
          <section className="bg-white rounded-3xl p-6 shadow-sm ring-1 ring-black/5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">3. Frequently asked questions</h2>
              <button onClick={generateFAQs} className="rounded-xl bg-green-700 px-4 py-2 text-sm font-bold text-white hover:bg-green-800">
                Generate common FAQs
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">Edit, delete or add answers before activating.</p>
            <div className="space-y-4">
              {faqs.map((faq) => (
                <div key={faq.id} className="grid gap-3 p-4 rounded-2xl bg-[#f7faf7]">
                  <input
                    value={faq.question}
                    onChange={(e) => updateFaq(faq.id, 'question', e.target.value)}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    placeholder="Question"
                  />
                  <textarea
                    value={faq.answer}
                    onChange={(e) => updateFaq(faq.id, 'answer', e.target.value)}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    rows={2}
                    placeholder="Answer"
                  />
                  <div className="flex gap-2">
                    <select
                      value={faq.category}
                      onChange={(e) => updateFaq(faq.id, 'category', e.target.value)}
                      className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <button onClick={() => removeFaq(faq.id)} className="ml-auto rounded-xl bg-white px-4 py-2 text-sm font-bold text-red-700 ring-1 ring-red-200 hover:bg-red-50">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              <button onClick={addFaq} className="w-full rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-green-700 ring-1 ring-green-200 hover:bg-green-50">
                + Add FAQ
              </button>
            </div>
          </section>
        )}

        {step.key === 'catalog' && (
          <section className="bg-white rounded-3xl p-6 shadow-sm ring-1 ring-black/5">
            <h2 className="text-xl font-bold mb-4">4. Product catalog</h2>

            <div className="rounded-2xl bg-[#f7faf7] p-4 mb-4">
              <h3 className="font-semibold mb-2">Floraprise Design Gallery</h3>
              <p className="text-sm text-gray-600 mb-3">Use your existing Floraprise designs for AI recommendations and WhatsApp.</p>

              {designGallery.count > 0 ? (
                <div className="space-y-3">
                  <p className="text-sm"><strong>{designGallery.count}</strong> designs available</p>
                  <p className="text-sm">Connection status: <strong>{catalogSource === 'design_gallery' ? 'Connected' : 'Available'}</strong></p>
                  {catalogSource === 'design_gallery' ? (
                    <div className="flex items-center gap-2 text-green-700 text-sm font-semibold">
                      <span>✓</span> Design Gallery Connected
                    </div>
                  ) : (
                    <button
                      onClick={async () => { await connectDesignGallery(); setSelectedCatalogSource('design_gallery'); }}
                      className="rounded-xl bg-green-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-green-800"
                    >
                      Connect Design Gallery
                    </button>
                  )}
                  <p className="text-sm text-gray-500">Your Floraprise Design Gallery is now being used by AI.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500">No Floraprise Design Gallery found for your business yet.</p>
                  <p className="text-sm text-gray-600 mb-2">Don&apos;t use Floraprise Design Gallery?</p>
                  <button
                    onClick={async () => { await setCatalogSource('manual_catalog'); setSelectedCatalogSource('manual_catalog'); }}
                    className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-green-700 ring-1 ring-green-200 hover:bg-green-50"
                  >
                    Continue with Manual Catalog
                  </button>
                </div>
              )}
            </div>

            <p className="text-sm text-gray-600 mb-4">Add a few products now, or skip and add later from the admin.</p>

            {catalog.length === 0 && (
              <div className="rounded-2xl bg-[#f7faf7] p-6 text-center mb-4">
                <p className="text-gray-600 mb-4">No products yet.</p>
                <button onClick={addCatalog} className="rounded-xl bg-green-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-green-800">
                  Add first product
                </button>
              </div>
            )}

            {catalog.map((p) => (
              <div key={p.id} className="grid gap-3 p-4 rounded-2xl bg-[#f7faf7] mb-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <input
                    value={p.name}
                    onChange={(e) => updateCatalog(p.id, 'name', e.target.value)}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    placeholder="Product name"
                  />
                  <input
                    type="number"
                    value={p.price}
                    onChange={(e) => updateCatalog(p.id, 'price', Number(e.target.value))}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    placeholder="Price"
                  />
                  <input
                    value={p.image_url}
                    onChange={(e) => updateCatalog(p.id, 'image_url', e.target.value)}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    placeholder="Image URL"
                  />
                  <input
                    value={p.occasion}
                    onChange={(e) => updateCatalog(p.id, 'occasion', e.target.value)}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    placeholder="Occasion"
                  />
                  <input
                    value={p.color}
                    onChange={(e) => updateCatalog(p.id, 'color', e.target.value)}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    placeholder="Colour"
                  />
                  <input
                    value={p.categories}
                    onChange={(e) => updateCatalog(p.id, 'categories', e.target.value)}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    placeholder="Category"
                  />
                </div>
                <textarea
                  value={p.description}
                  onChange={(e) => updateCatalog(p.id, 'description', e.target.value)}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Description"
                />
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={p.availability} onChange={(e) => updateCatalog(p.id, 'availability', e.target.checked)} /> Available
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={p.featured} onChange={(e) => updateCatalog(p.id, 'featured', e.target.checked)} /> Featured
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={p.same_day} onChange={(e) => updateCatalog(p.id, 'same_day', e.target.checked)} /> Same-day
                  </label>
                </div>
                <button onClick={() => removeCatalog(p.id)} className="ml-auto rounded-xl bg-white px-4 py-2 text-sm font-bold text-red-700 ring-1 ring-red-200 hover:bg-red-50">
                  Remove
                </button>
              </div>
            ))}

            {catalog.length > 0 && (
              <button onClick={addCatalog} className="w-full rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-green-700 ring-1 ring-green-200 hover:bg-green-50">
                + Add another product
              </button>
            )}
          </section>
        )}

        {step.key === 'ai' && (
          <section className="bg-white rounded-3xl p-6 shadow-sm ring-1 ring-black/5">
            <h2 className="text-xl font-bold mb-4">5. AI receptionist style</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Tone</label>
                <select
                  value={ai.tone}
                  onChange={(e) => setAi({ ...ai, tone: e.target.value as any })}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                >
                  {TONE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Language</label>
                <select
                  value={ai.language}
                  onChange={(e) => setAi({ ...ai, language: e.target.value as any })}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                >
                  {LANGUAGE_OPTIONS.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Emoji use</label>
                <select
                  value={ai.emoji_level}
                  onChange={(e) => setAi({ ...ai, emoji_level: e.target.value as any })}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                >
                  {EMOJI_OPTIONS.map((e) => (
                    <option key={e.value} value={e.value}>
                      {e.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-1">AI greeting</label>
                <input
                  value={ai.greeting}
                  onChange={(e) => setAi({ ...ai, greeting: e.target.value })}
                  placeholder="Hello! Welcome to..."
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-6 p-4 rounded-2xl bg-[#f7faf7]">
              <p className="text-sm font-semibold mb-2">AI capabilities</p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>✅ Understand bouquet requirements</li>
                <li>✅ Recommend flowers</li>
                <li>✅ Answer general questions</li>
                <li>✅ Send product images</li>
                <li>✅ Create quotations</li>
                <li>✅ Remember customer preferences</li>
              </ul>
            </div>
          </section>
        )}

        {step.key === 'review' && (
          <section className="bg-white rounded-3xl p-6 shadow-sm ring-1 ring-black/5">
            <h2 className="text-xl font-bold mb-4">6. Review &amp; activate</h2>
            <div className="space-y-3 text-sm">
              <p><strong>Business:</strong> {business.business_name || '—'}</p>
              <p><strong>Contact:</strong> {business.contact_person || '—'} {business.phone && `| ${business.phone}`}</p>
              <p><strong>Working hours:</strong> {business.working_hours || '—'}</p>
              <p><strong>Delivery:</strong> {services.same_day_available ? 'Same-day' : ''} {services.midnight_delivery ? 'Midnight' : ''} {services.delivery_charges}</p>
              <p><strong>FAQs:</strong> {faqs.length}</p>
              <p><strong>Catalog:</strong> {catalog.length} products</p>
              <p><strong>AI tone:</strong> {TONE_OPTIONS.find((t) => t.value === ai.tone)?.label}</p>
              <p><strong>Language:</strong> {LANGUAGE_OPTIONS.find((l) => l.value === ai.language)?.label}</p>
            </div>
            <button
              onClick={activate}
              disabled={loading}
              className="mt-6 w-full rounded-xl bg-green-700 px-5 py-3 text-sm font-bold text-white hover:bg-green-800 disabled:opacity-60"
            >
              {loading ? 'Activating...' : 'ACTIVATE AI RECEPTIONIST'}
            </button>
          </section>
        )}

        <div className="flex justify-between mt-6">
          <button
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            disabled={stepIndex === 0}
            className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-50"
          >
            Back
          </button>
          <button
            onClick={() => setStepIndex((i) => Math.min(STEPS.length - 1, i + 1))}
            disabled={stepIndex === STEPS.length - 1}
            className="rounded-xl bg-green-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-green-800 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </main>
  );
}

function Input({
  label,
  value,
  onChange,
  className = '',
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
  type?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
      />
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-2 bg-[#f7faf7] cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
      <span className="text-sm font-medium">{label}</span>
    </label>
  );
}
