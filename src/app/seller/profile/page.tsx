'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Store, Save } from 'lucide-react';
import { PageSkeleton } from '@/components/page-skeleton';
import { API_BASE } from '@/lib/api';
const CATEGORIES = ['Electronics', 'Fashion', 'Home', 'Beauty', 'Farm', 'Sports', 'Books', 'Food', 'Toys', 'General'];
const SELLER_TYPES = ['individual', 'business', 'farmer'];

export default function SellerProfilePage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');
  const [businessCategory, setBusinessCategory] = useState('Electronics');
  const [businessLocation, setBusinessLocation] = useState('');
  const [sellerType, setSellerType] = useState('business');
  const [farmName, setFarmName] = useState('');
  const [profileImage, setProfileImage] = useState('');

  useEffect(() => {
    (async () => {
      const result = await api.sellerProducts.list(); // triggers seller provisioning
      setLoading(false);
      // Fetch profile via seller-profile edge function
      const profResp = await fetch(`${API_BASE}/api/seller-profile`, {
      credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'get' }),
      });
      if (profResp.ok) {
        const data = await profResp.json();
        if (data.success && data.seller) {
          const s = data.seller;
          setBusinessName(s.business_name || '');
          setBusinessDescription(s.business_description || '');
          setBusinessCategory(s.business_category || 'Electronics');
          setBusinessLocation(s.business_location || '');
          setSellerType(s.seller_type || 'business');
          setFarmName(s.farm_name || '');
          setProfileImage(s.profile_image || '');
        }
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const profResp = await fetch(`${API_BASE}/api/seller-profile`, {
      credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        op: 'update',
        business_name: businessName,
        business_description: businessDescription,
        business_category: businessCategory,
        business_location: businessLocation,
        seller_type: sellerType,
        farm_name: farmName,
        profile_image: profileImage,
      }),
    });
    setSaving(false);
    const data = await profResp.json();
    if (data.success) {
      toast({ title: 'Profile saved' });
    } else {
      toast({ title: 'Error', description: data.error, variant: 'destructive' });
    }
  };

  if (loading) { return <PageSkeleton variant="seller-profile" />; }

  const inputClass = "w-full bg-neutral-50 border border-neutral-200 rounded-md px-3 py-2.5 text-sm focus:bg-white focus:border-neutral-400 outline-none";

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Seller Profile</h1>
        <p className="text-sm text-neutral-500">This is your public storefront</p>
      </div>

      <div className="border border-neutral-200 rounded-md p-4 space-y-3 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 rounded-md bg-black flex items-center justify-center overflow-hidden">
            {profileImage ? (
              <img src={profileImage} alt="" className="w-full h-full object-cover" />
            ) : (
              <Store className="w-8 h-8 text-white" />
            )}
          </div>
          <div className="flex-1">
            <div className="font-semibold">{businessName || 'Your store name'}</div>
            <div className="text-xs text-neutral-500">{businessCategory}</div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-neutral-700">Business / Store name</Label>
          <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. TechHub Nigeria" className={inputClass} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-neutral-700">Category</Label>
            <select
              value={businessCategory}
              onChange={(e) => setBusinessCategory(e.target.value)}
              className={inputClass}
            >
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-neutral-700">Seller type</Label>
            <select
              value={sellerType}
              onChange={(e) => setSellerType(e.target.value)}
              className={inputClass}
            >
              {SELLER_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-neutral-700">Location</Label>
          <Input value={businessLocation} onChange={(e) => setBusinessLocation(e.target.value)} placeholder="e.g. Lagos, Nigeria" className={inputClass} />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-neutral-700">Profile image URL</Label>
          <Input value={profileImage} onChange={(e) => setProfileImage(e.target.value)} placeholder="https://..." className={inputClass} />
        </div>

        {sellerType === 'farmer' && (
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-neutral-700">Farm name</Label>
            <Input value={farmName} onChange={(e) => setFarmName(e.target.value)} placeholder="e.g. Green Valley Farm" className={inputClass} />
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-neutral-700">Description</Label>
          <Textarea
            value={businessDescription}
            onChange={(e) => setBusinessDescription(e.target.value)}
            rows={4}
            placeholder="Tell buyers about your business..."
            className={inputClass}
          />
        </div>

        <button onClick={save} disabled={saving} className="w-full bg-black text-white font-semibold rounded-md py-3 hover:bg-neutral-800 disabled:opacity-50">
          <Save className="w-4 h-4 inline mr-1" />
          {saving ? 'Saving...' : 'Save profile'}
        </button>
      </div>
    </div>
  );
}
