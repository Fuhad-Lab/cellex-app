'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Store, Save } from 'lucide-react';

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
      const profResp = await fetch('/api/seller-profile', {
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
    const profResp = await fetch('/api/seller-profile', {
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

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-extrabold">Seller Profile</h1>
        <p className="text-sm text-slate-500">This is your public storefront</p>
      </div>

      <Card className="p-4 border-slate-100 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 rounded-2xl brand-gradient flex items-center justify-center">
            {profileImage ? (
              <img src={profileImage} alt="" className="w-full h-full object-cover rounded-2xl" />
            ) : (
              <Store className="w-8 h-8 text-white" />
            )}
          </div>
          <div className="flex-1">
            <div className="font-bold">{businessName || 'Your store name'}</div>
            <div className="text-xs text-slate-500">{businessCategory}</div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Business / Store name</Label>
          <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. TechHub Nigeria" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Category</Label>
            <select
              value={businessCategory}
              onChange={(e) => setBusinessCategory(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            >
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Seller type</Label>
            <select
              value={sellerType}
              onChange={(e) => setSellerType(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            >
              {SELLER_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Location</Label>
          <Input value={businessLocation} onChange={(e) => setBusinessLocation(e.target.value)} placeholder="e.g. Lagos, Nigeria" />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Profile image URL</Label>
          <Input value={profileImage} onChange={(e) => setProfileImage(e.target.value)} placeholder="https://..." />
        </div>

        {sellerType === 'farmer' && (
          <div className="space-y-1.5">
            <Label className="text-xs">Farm name</Label>
            <Input value={farmName} onChange={(e) => setFarmName(e.target.value)} placeholder="e.g. Green Valley Farm" />
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs">Description</Label>
          <Textarea
            value={businessDescription}
            onChange={(e) => setBusinessDescription(e.target.value)}
            rows={4}
            placeholder="Tell buyers about your business..."
          />
        </div>

        <Button onClick={save} disabled={saving} className="w-full brand-gradient text-primary-foreground font-bold">
          <Save className="w-4 h-4 mr-1" />
          {saving ? 'Saving...' : 'Save profile'}
        </Button>
      </Card>
    </div>
  );
}
