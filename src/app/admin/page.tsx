'use client';

import { useEffect, useState } from 'react';
import {
  getMe,
  getDashboardData,
  getBusinessProfile,
  saveBusinessProfile,
  getFAQs,
  createFAQ,
  updateFAQ,
  deleteFAQ,
  getCatalogProducts,
  createCatalogProduct,
  updateCatalogProduct,
  deleteCatalogProduct,
  getCatalogSource,
  setCatalogSource,
  getDesignGallerySummary,
  syncDesignGallery,
  getAISettings,
  saveAISettings,
  getHumanTakeover,
  setHumanTakeover,
  getConversations,
  getMessages,
} from '@/app/admin/actions';

interface AdminData {
  dashboard: Record<string, unknown> | null;
  profile: Record<string, unknown> | null;
  faqs: Record<string, unknown>[];
  catalog: Record<string, unknown>[];
  catalogSource: Record<string, unknown> | null;
  designGallery: Record<string, unknown> | null;
  ai: Record<string, unknown> | null;
  takeover: Record<string, unknown> | null;
  conversations: Record<string, unknown>[];
}

type Tab = 'overview' | 'business' | 'faq' | 'catalog' | 'ai' | 'takeover' | 'conversations';

function toInput(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'on' : '';
  return String(value);
}

function fromInput(value: string): string | undefined {
  return value.trim() || undefined;
}

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [data, setData] = useState<AdminData>({ dashboard: null, profile: null, faqs: [], catalog: [], catalogSource: null, designGallery: null, ai: null, takeover: null, conversations: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<Record<string, unknown>[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [faqSearch, setFaqSearch] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [faqCategory, setFaqCategory] = useState('');

  async function refresh() {
    try {
      const me = await getMe();
      if (!me) {
        setError('Unauthorized');
        return;
      }

      const [dashboard, profile, faqs, catalog, catalogSource, designGallery, ai, takeover, conversations] = await Promise.all([
        getDashboardData(),
        getBusinessProfile(),
        getFAQs(),
        getCatalogProducts(),
        getCatalogSource(),
        getDesignGallerySummary(),
        getAISettings(),
        getHumanTakeover(),
        getConversations(),
      ]);
      setData({ dashboard, profile, faqs, catalog, catalogSource, designGallery, ai, takeover, conversations });
      setError('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load admin';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    await saveBusinessProfile({
      business_name: fromInput(String(formData.get('business_name'))),
      tagline: fromInput(String(formData.get('tagline'))),
      description: fromInput(String(formData.get('description'))),
      address: fromInput(String(formData.get('address'))),
      google_maps_url: fromInput(String(formData.get('google_maps_url'))),
      working_hours: fromInput(String(formData.get('working_hours'))),
      delivery_areas: fromInput(String(formData.get('delivery_areas'))),
      delivery_charges: fromInput(String(formData.get('delivery_charges'))),
      emergency_delivery: formData.has('emergency_delivery'),
      midnight_delivery: formData.has('midnight_delivery'),
      website: fromInput(String(formData.get('website'))),
      instagram: fromInput(String(formData.get('instagram'))),
      facebook: fromInput(String(formData.get('facebook'))),
      upi_id: fromInput(String(formData.get('upi_id'))),
      gst_number: fromInput(String(formData.get('gst_number'))),
      phone_numbers: fromInput(String(formData.get('phone_numbers'))),
      email: fromInput(String(formData.get('email'))),
      cancellation_policy: fromInput(String(formData.get('cancellation_policy'))),
      refund_policy: fromInput(String(formData.get('refund_policy'))),
      customization_policy: fromInput(String(formData.get('customization_policy'))),
      greeting_message: fromInput(String(formData.get('greeting_message'))),
      closing_message: fromInput(String(formData.get('closing_message'))),
    });
    await refresh();
  }

  async function handleFAQSubmit(e: React.FormEvent<HTMLFormElement>, id?: string) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload = {
      question: String(formData.get('question')),
      answer: String(formData.get('answer')),
      category: fromInput(String(formData.get('category'))) || 'general',
      priority: Number(formData.get('priority')) || 0,
    };
    if (id) await updateFAQ(id, payload);
    else await createFAQ(payload);
    e.currentTarget.reset();
    await refresh();
  }

  async function handleCatalogSubmit(e: React.FormEvent<HTMLFormElement>, id?: string) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload = {
      name: String(formData.get('name')),
      price: Number(formData.get('price')) || 0,
      description: fromInput(String(formData.get('description'))),
      occasion: fromInput(String(formData.get('occasion'))),
      flower_types: fromInput(String(formData.get('flower_types'))),
      color: fromInput(String(formData.get('color'))),
      style: fromInput(String(formData.get('style'))),
      image_url: fromInput(String(formData.get('image_url'))),
      availability: formData.has('availability'),
      featured: formData.has('featured'),
      premium: formData.has('premium'),
      luxury: formData.has('luxury'),
      budget: formData.has('budget'),
      same_day: formData.has('same_day'),
      categories: fromInput(String(formData.get('categories'))),
    };
    if (id) await updateCatalogProduct(id, payload);
    else await createCatalogProduct(payload);
    e.currentTarget.reset();
    await refresh();
  }

  async function handleAISettingsSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    await saveAISettings({
      creativity: String(formData.get('creativity')) as 'conservative' | 'balanced' | 'creative',
      greeting: fromInput(String(formData.get('greeting'))),
      language: String(formData.get('language')) as 'en' | 'hi' | 'hinglish',
      emoji_level: String(formData.get('emoji_level')) as 'none' | 'low' | 'medium' | 'high',
      max_reply_length: Number(formData.get('max_reply_length')) || 250,
      quote_style: fromInput(String(formData.get('quote_style'))) || 'friendly',
    });
    await refresh();
  }

  async function toggleTakeover() {
    const active = !data.takeover?.active;
    await setHumanTakeover(active);
    await refresh();
  }

  async function viewMessages(sessionId: string) {
    setActiveSession(sessionId);
    const rows = await getMessages(sessionId);
    setMessages(rows);
  }

  if (loading) {
    return <main className="min-h-screen bg-[#f7faf7] p-8 text-center">Loading admin...</main>;
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#f7faf7] p-8 text-center">
        <div className="inline-block rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
          <p className="text-red-600 font-semibold mb-4">{error}</p>
          <a href="/login" className="rounded-xl bg-green-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-green-800">
            Sign in
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7faf7] p-4 lg:p-8 text-gray-900">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Floraprise Admin</h1>
          <p className="text-gray-600 mt-1">Manage your business, catalog, AI, and conversations.</p>
        </header>

        <nav className="flex flex-wrap gap-2 mb-6">
          {(['overview', 'business', 'faq', 'catalog', 'ai', 'takeover', 'conversations'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                tab === t ? 'bg-green-700 text-white' : 'bg-white ring-1 ring-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </nav>

        {tab === 'overview' && (
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <h2 className="text-xl font-bold mb-4">Dashboard</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
              <div className="rounded-2xl bg-[#f7faf7] p-4">
                <p className="text-sm text-gray-600">Business</p>
                <p className="text-lg font-bold">{(data.dashboard as any)?.business_name || 'Not set'}</p>
              </div>
              <div className="rounded-2xl bg-[#f7faf7] p-4">
                <p className="text-sm text-gray-600">AI status</p>
                <p className={`text-lg font-bold ${(data.dashboard as any)?.ai_active ? 'text-green-700' : 'text-red-600'}`}>
                  {(data.dashboard as any)?.ai_active ? 'AI Active' : 'AI Paused'}
                </p>
              </div>
              <div className="rounded-2xl bg-[#f7faf7] p-4">
                <p className="text-sm text-gray-600">WhatsApp</p>
                <p className="text-lg font-bold">{(data.dashboard as any)?.whatsapp_phone || 'Not connected'}</p>
                <p className="text-xs text-gray-500">{(data.dashboard as any)?.whatsapp_status || ''}</p>
              </div>
              <div className="rounded-2xl bg-[#f7faf7] p-4">
                <p className="text-sm text-gray-600">Conversations (24h)</p>
                <p className="text-lg font-bold">{(data.dashboard as any)?.conversations_24h || 0}</p>
              </div>
              <div className="rounded-2xl bg-[#f7faf7] p-4">
                <p className="text-sm text-gray-600">FAQs</p>
                <p className="text-lg font-bold">{(data.dashboard as any)?.faq_count || 0}</p>
              </div>
              <div className="rounded-2xl bg-[#f7faf7] p-4">
                <p className="text-sm text-gray-600">Catalog</p>
                <p className="text-lg font-bold">{(data.dashboard as any)?.catalog_count || 0}</p>
              </div>
              <div className="rounded-2xl bg-[#f7faf7] p-4">
                <p className="text-sm text-gray-600">Language</p>
                <p className="text-lg font-bold uppercase">{(data.dashboard as any)?.ai?.language || 'en'}</p>
              </div>
              <div className="rounded-2xl bg-[#f7faf7] p-4">
                <p className="text-sm text-gray-600">Tone</p>
                <p className="text-lg font-bold">{(data.dashboard as any)?.ai?.creativity || 'balanced'}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setTab('business')} className="rounded-xl bg-green-700 px-4 py-2 text-sm font-bold text-white hover:bg-green-800">Edit business</button>
              <button onClick={() => setTab('faq')} className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-green-700 ring-1 ring-green-200 hover:bg-green-50">Manage FAQs</button>
              <button onClick={() => setTab('catalog')} className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-green-700 ring-1 ring-green-200 hover:bg-green-50">Manage catalog</button>
              <button onClick={() => setTab('ai')} className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-green-700 ring-1 ring-green-200 hover:bg-green-50">AI settings</button>
              <a href="/setup?edit=1" className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-green-700 ring-1 ring-green-200 hover:bg-green-50">Run setup wizard</a>
            </div>
          </section>
        )}

        {tab === 'business' && (
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <h2 className="text-xl font-bold mb-4">Business Profile</h2>
            <form onSubmit={handleProfileSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                'business_name', 'tagline', 'email', 'phone_numbers', 'website', 'instagram',
                'facebook', 'upi_id', 'gst_number', 'google_maps_url', 'working_hours', 'delivery_areas',
                'delivery_charges', 'address', 'cancellation_policy', 'refund_policy', 'customization_policy',
              ].map((field) => (
                <div key={field}>
                  <label className="block text-sm font-semibold text-gray-700">{field.replace(/_/g, ' ')}</label>
                  <input
                    name={field}
                    defaultValue={toInput(data.profile?.[field])}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-semibold text-gray-700">Greeting message</label>
                <textarea name="greeting_message" defaultValue={toInput(data.profile?.greeting_message)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" rows={3} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700">Closing message</label>
                <textarea name="closing_message" defaultValue={toInput(data.profile?.closing_message)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" rows={3} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700">Description</label>
                <textarea name="description" defaultValue={toInput(data.profile?.description)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" rows={3} />
              </div>
              <div className="col-span-full flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="emergency_delivery" defaultChecked={!!data.profile?.emergency_delivery} className="h-4 w-4" /> Emergency Delivery
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="midnight_delivery" defaultChecked={!!data.profile?.midnight_delivery} className="h-4 w-4" /> Midnight Delivery
                </label>
              </div>
              <div className="col-span-full">
                <button type="submit" className="rounded-xl bg-green-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-green-800">Save Business Profile</button>
              </div>
            </form>
          </section>
        )}

        {tab === 'faq' && (
          <section className="space-y-4">
            <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5 flex flex-wrap gap-3">
              <input
                value={faqSearch}
                onChange={(e) => setFaqSearch(e.target.value)}
                placeholder="Search FAQs"
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
              <select value={faqCategory} onChange={(e) => setFaqCategory(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
                <option value="">All categories</option>
                <option value="Ordering">Ordering</option>
                <option value="Delivery">Delivery</option>
                <option value="Payment">Payment</option>
                <option value="Flowers">Flowers</option>
                <option value="Customisation">Customisation</option>
                <option value="Cancellation">Cancellation</option>
                <option value="Refund">Refund</option>
                <option value="Corporate">Corporate</option>
                <option value="Wedding">Wedding</option>
                <option value="Pickup">Pickup</option>
                <option value="General">General</option>
              </select>
              <span className="ml-auto text-sm text-gray-600 self-center">{data.faqs.length} FAQ{data.faqs.length !== 1 && 's'}</span>
            </div>
            <form onSubmit={(e) => handleFAQSubmit(e)} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 grid gap-4 sm:grid-cols-2">
              <input name="question" placeholder="Question" required className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              <input name="category" placeholder="Category" className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              <textarea name="answer" placeholder="Answer" required className="sm:col-span-2 rounded-xl border border-gray-200 px-3 py-2 text-sm" rows={3} />
              <input name="priority" type="number" placeholder="Priority" defaultValue="0" className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              <button type="submit" className="rounded-xl bg-green-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-green-800">Add FAQ</button>
            </form>

            {data.faqs
              .filter((faq: any) => {
                const q = faqSearch.toLowerCase();
                const matchesSearch = !q || faq.question?.toLowerCase().includes(q) || faq.answer?.toLowerCase().includes(q);
                const matchesCategory = !faqCategory || faq.category === faqCategory;
                return matchesSearch && matchesCategory;
              })
              .map((faq: any) => (
              <form
                key={faq.id}
                onSubmit={(e) => handleFAQSubmit(e, faq.id)}
                className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 grid gap-3 sm:grid-cols-2"
              >
                <input name="question" defaultValue={faq.question} required className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                <input name="category" defaultValue={faq.category} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                <textarea name="answer" defaultValue={faq.answer} required className="sm:col-span-2 rounded-xl border border-gray-200 px-3 py-2 text-sm" rows={2} />
                <input name="priority" type="number" defaultValue={faq.priority} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                <div className="flex gap-2">
                  <button type="submit" className="rounded-xl bg-green-700 px-4 py-2 text-sm font-bold text-white hover:bg-green-800">Save</button>
                  <button type="button" onClick={() => deleteFAQ(faq.id).then(refresh)} className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-red-700 ring-1 ring-red-200 hover:bg-red-50">Delete</button>
                </div>
              </form>
            ))}
          </section>
        )}

        {tab === 'catalog' && (
          <section className="space-y-4">
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
              <h3 className="text-lg font-bold mb-3">Catalog Source</h3>
              <div className="flex flex-wrap gap-4 mb-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="catalog_source"
                    checked={(data.catalogSource as any)?.source !== 'design_gallery'}
                    onChange={() => setCatalogSource('manual_catalog').then(refresh)}
                  />
                  Manual Catalog
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="catalog_source"
                    checked={(data.catalogSource as any)?.source === 'design_gallery'}
                    onChange={() => setCatalogSource('design_gallery').then(refresh)}
                  />
                  Floraprise Design Gallery
                </label>
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <p>Design Gallery: <strong>{(data.designGallery as any)?.count || 0}</strong> available designs</p>
                <p>Source: <strong>{(data.catalogSource as any)?.source === 'design_gallery' ? 'Floraprise Design Gallery' : 'Manual Catalog'}</strong></p>
                <p>Status: <strong>{(data.catalogSource as any)?.status || 'not_connected'}</strong></p>
                <p>Last synced: {(data.catalogSource as any)?.last_synced_at ? new Date((data.catalogSource as any).last_synced_at as string).toLocaleString() : '—'}</p>
                {(data.catalogSource as any)?.source === 'design_gallery' && (
                  <button
                    onClick={() => syncDesignGallery().then(refresh)}
                    className="mt-3 rounded-xl bg-green-700 px-4 py-2 text-sm font-bold text-white hover:bg-green-800"
                  >
                    Sync Design Gallery
                  </button>
                )}
              </div>
              <p className="mt-3 text-xs text-gray-500">Floraprise Design Gallery is the source of truth for AI product recommendations.</p>
            </div>

            <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5 flex flex-wrap gap-3">
              <input
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Search products"
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
              <span className="ml-auto text-sm text-gray-600 self-center">{data.catalog.length} product{data.catalog.length !== 1 && 's'}</span>
            </div>
            <form onSubmit={(e) => handleCatalogSubmit(e)} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <input name="name" placeholder="Product name" required className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              <input name="price" type="number" step="0.01" placeholder="Price" className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              <input name="occasion" placeholder="Occasion" className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              <input name="flower_types" placeholder="Flower types" className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              <input name="color" placeholder="Colour" className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              <input name="style" placeholder="Style" className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              <input name="categories" placeholder="Categories" className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              <input name="image_url" placeholder="Image URL" className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              <textarea name="description" placeholder="Description" className="sm:col-span-2 rounded-xl border border-gray-200 px-3 py-2 text-sm" rows={2} />
              <div className="flex flex-wrap gap-4 sm:col-span-2 text-sm">
                {['availability', 'featured', 'premium', 'luxury', 'budget', 'same_day'].map((field) => (
                  <label key={field} className="flex items-center gap-2">
                    <input type="checkbox" name={field} defaultChecked={field === 'availability'} className="h-4 w-4" /> {field.replace(/_/g, ' ')}
                  </label>
                ))}
              </div>
              <button type="submit" className="col-span-full sm:col-span-1 rounded-xl bg-green-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-green-800">Add Product</button>
            </form>

            {data.catalog
              .filter((product: any) => {
                const q = catalogSearch.toLowerCase();
                if (!q) return true;
                return (product.name || '').toLowerCase().includes(q) || (product.description || '').toLowerCase().includes(q) || (product.occasion || '').toLowerCase().includes(q) || (product.categories || '').toLowerCase().includes(q);
              })
              .map((product: any) => (
              <form
                key={product.id}
                onSubmit={(e) => handleCatalogSubmit(e, product.id)}
                className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
              >
                <input name="name" defaultValue={product.name} required className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                <input name="price" type="number" step="0.01" defaultValue={product.price} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                <input name="occasion" defaultValue={product.occasion || ''} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                <input name="flower_types" defaultValue={product.flower_types || ''} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                <input name="color" defaultValue={product.color || ''} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                <input name="style" defaultValue={product.style || ''} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                <input name="categories" defaultValue={product.categories || ''} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                <input name="image_url" defaultValue={product.image_url || ''} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                <textarea name="description" defaultValue={product.description || ''} className="sm:col-span-2 rounded-xl border border-gray-200 px-3 py-2 text-sm" rows={2} />
                <div className="flex flex-wrap gap-4 sm:col-span-2 text-sm">
                  {['availability', 'featured', 'premium', 'luxury', 'budget', 'same_day'].map((field) => (
                    <label key={field} className="flex items-center gap-2">
                      <input type="checkbox" name={field} defaultChecked={!!product[field]} className="h-4 w-4" /> {field.replace(/_/g, ' ')}
                    </label>
                  ))}
                </div>
                <div className="col-span-full flex gap-2">
                  <button type="submit" className="rounded-xl bg-green-700 px-4 py-2 text-sm font-bold text-white hover:bg-green-800">Save</button>
                  <button type="button" onClick={() => deleteCatalogProduct(product.id).then(refresh)} className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-red-700 ring-1 ring-red-200 hover:bg-red-50">Delete</button>
                </div>
              </form>
            ))}
          </section>
        )}

        {tab === 'ai' && (
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <h2 className="text-xl font-bold mb-4">AI Settings</h2>
            <form onSubmit={handleAISettingsSubmit} className="grid gap-4 sm:grid-cols-2">
              <p className="text-sm text-gray-600 sm:col-span-2">AI is powered by Floraprise. Only friendly controls are exposed below; model and temperature are managed automatically.</p>
              <div>
                <label className="block text-sm font-semibold">Creativity</label>
                <select name="creativity" defaultValue={toInput(data.ai?.creativity) || 'balanced'} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
                  <option value="conservative">Conservative</option>
                  <option value="balanced">Balanced</option>
                  <option value="creative">Creative</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold">Default Language</label>
                <select name="language" defaultValue={toInput(data.ai?.language) || 'en'} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="hinglish">Hinglish</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold">Emoji Level</label>
                <select name="emoji_level" defaultValue={toInput(data.ai?.emoji_level) || 'low'} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
                  <option value="none">None</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold">Max Reply Length</label>
                <input name="max_reply_length" type="number" defaultValue={toInput(data.ai?.max_reply_length) || '250'} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold">Quote Style</label>
                <input name="quote_style" defaultValue={toInput(data.ai?.quote_style)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold">Greeting</label>
                <input name="greeting" defaultValue={toInput(data.ai?.greeting)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <button type="submit" className="rounded-xl bg-green-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-green-800">Save AI Settings</button>
              </div>
            </form>
          </section>
        )}

        {tab === 'takeover' && (
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <h2 className="text-xl font-bold mb-4">Human Takeover</h2>
            <p className="text-gray-600 mb-4">
              When AI is disabled, all incoming WhatsApp messages are paused and will not receive automatic replies.
            </p>
            <button
              type="button"
              onClick={toggleTakeover}
              className={`rounded-xl px-5 py-3 text-sm font-bold text-white transition ${
                data.takeover?.active ? 'bg-red-600 hover:bg-red-700' : 'bg-green-700 hover:bg-green-800'
              }`}
            >
              {data.takeover?.active ? 'AI Disabled — Resume AI' : 'AI Enabled — Take Over'}
            </button>
          </section>
        )}

        {tab === 'conversations' && (
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 h-fit">
              <h2 className="text-xl font-bold mb-4">Conversations</h2>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {data.conversations.map((conv: any) => (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => viewMessages(conv.id)}
                    className={`w-full text-left rounded-xl p-3 text-sm transition ${
                      activeSession === conv.id ? 'bg-green-50 ring-1 ring-green-200' : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <p className="font-semibold">{conv.title}</p>
                    <p className="text-gray-500 text-xs mt-1">{new Date(conv.updated_at).toLocaleString()}</p>
                    {conv.last_message && <p className="text-gray-600 text-xs mt-1 truncate">{conv.last_message}</p>}
                  </button>
                ))}
              </div>
            </div>

            {activeSession && (
              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                <h2 className="text-xl font-bold mb-4">Messages</h2>
                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                  {messages.map((msg: any, idx) => (
                    <div key={idx} className={`rounded-xl p-3 text-sm ${msg.role === 'user' ? 'bg-gray-50' : 'bg-green-50'}`}>
                      <p className="text-xs font-semibold text-gray-500 mb-1">{msg.role}</p>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
