'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, Store, Upload, Check, User, Building, Sprout,
  Camera, MapPin, FileText, Loader2 } from 'lucide-react';

const CATEGORIES = [
  'Electronics', 'Fashion', 'Home', 'Beauty', 'Farm', 'Sports',
  'Books', 'Food', 'Toys', 'General'
];

const SELLER_TYPES = [
  { value: 'individual', label: 'Individual', icon: User, desc: 'Selling personal items' },
  { value: 'business', label: 'Business', icon: Building, desc: 'Registered business' },
  { value: 'farmer', label: 'Farmer', icon: Sprout, desc: 'Farm-fresh produce' },
];

export default function BecomeSellerPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Form state
  const [businessName, setBusinessName] = useState('');
  const [sellerType, setSellerType] = useState('business');
  const [businessCategory, setBusinessCategory] = useState('Electronics');
  const [businessLocation, setBusinessLocation] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');
  const [farmName, setFarmName] = useState('');
  const [profileImage, setProfileImage] = useState('');

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Image too large', description: 'Max 2MB', variant: 'destructive' });
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setProfileImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const canProceedStep1 = businessName.trim().length >= 2;
  const canProceedStep2 = businessLocation.trim().length >= 3;
  const canSubmit = canProceedStep1 && canProceedStep2;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const resp = await fetch('/api/seller-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          op: 'update',
          business_name: businessName,
          business_description: businessDescription,
          business_category: businessCategory,
          business_location: businessLocation,
          seller_type: sellerType,
          farm_name: sellerType === 'farmer' ? farmName : '',
          profile_image: profileImage,
        }),
      });
      const data = await resp.json();
      if (data.success) {
        toast({ title: 'Welcome to Cellex Selling! 🎉', description: 'Your seller account is ready' });
        router.push('/seller/preparing');
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to create seller account', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Network error. Please try again.', variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/settings" className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold">Become a Seller</h1>
          <p className="text-xs text-slate-500">Step {step} of 3</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex gap-1.5 mb-6">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? 'bg-black' : 'bg-slate-200'}`}
          />
        ))}
      </div>

      {/* Step 1: Store identity */}
      {step === 1 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-bold mb-1">Set up your store</h2>
            <p className="text-sm text-slate-500">Tell us about your business</p>
          </div>

          {/* Profile image */}
          <div className="flex flex-col items-center gap-2">
            <label className="cursor-pointer">
              <div className="w-24 h-24 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden hover:border-black transition-colors">
                {profileImage ? (
                  <img src={profileImage} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-8 h-8 text-slate-400" />
                )}
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
            <span className="text-xs text-slate-500">Tap to upload store logo</span>
          </div>

          {/* Store name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Store Name *</Label>
            <Input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Ada's Fashion Store"
              className="h-11"
            />
          </div>

          {/* Seller type */}
          <div className="space-y-2">
            <Label className="text-xs font-bold">Seller Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {SELLER_TYPES.map((type) => {
                const Icon = type.icon;
                const isActive = sellerType === type.value;
                return (
                  <button
                    key={type.value}
                    onClick={() => setSellerType(type.value)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                      isActive ? 'border-black bg-slate-50' : 'border-slate-200'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? 'text-black' : 'text-slate-400'}`} />
                    <span className={`text-xs font-bold ${isActive ? 'text-black' : 'text-slate-500'}`}>{type.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-500">
              {SELLER_TYPES.find(t => t.value === sellerType)?.desc}
            </p>
          </div>

          {/* Farm name (conditional) */}
          {sellerType === 'farmer' && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Farm Name</Label>
              <Input
                value={farmName}
                onChange={(e) => setFarmName(e.target.value)}
                placeholder="e.g. Green Valley Farms"
                className="h-11"
              />
            </div>
          )}

          <Button
            onClick={() => setStep(2)}
            disabled={!canProceedStep1}
            className="w-full h-11 bg-black text-white"
          >
            Continue
          </Button>
        </div>
      )}

      {/* Step 2: Location & category */}
      {step === 2 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-bold mb-1">Location & Category</h2>
            <p className="text-sm text-slate-500">Help buyers find you</p>
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold flex items-center gap-1.5">
              <MapPin className="w-3 h-3" /> Business Location *
            </Label>
            <Input
              value={businessLocation}
              onChange={(e) => setBusinessLocation(e.target.value)}
              placeholder="e.g. Lagos, Nigeria"
              className="h-11"
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label className="text-xs font-bold">Primary Category</Label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => {
                const isActive = businessCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setBusinessCategory(cat)}
                    className={`px-3 py-2.5 rounded-lg border-2 text-xs font-bold transition-all ${
                      isActive ? 'border-black bg-slate-50 text-black' : 'border-slate-200 text-slate-500'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold flex items-center gap-1.5">
              <FileText className="w-3 h-3" /> Store Description
            </Label>
            <Textarea
              value={businessDescription}
              onChange={(e) => setBusinessDescription(e.target.value)}
              rows={3}
              placeholder="Tell buyers what makes your store special..."
              className="resize-none"
            />
            <p className="text-[10px] text-slate-400">{businessDescription.length}/300 characters</p>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => setStep(1)} variant="outline" className="h-11 flex-1">
              Back
            </Button>
            <Button
              onClick={() => setStep(3)}
              disabled={!canProceedStep2}
              className="h-11 flex-1 bg-black text-white"
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Review & submit */}
      {step === 3 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-bold mb-1">Review & Launch</h2>
            <p className="text-sm text-slate-500">Confirm your store details</p>
          </div>

          {/* Summary card */}
          <Card className="p-5 border-slate-200 space-y-3">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                {profileImage ? (
                  <img src={profileImage} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Store className="w-6 h-6 text-slate-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate">{businessName}</div>
                <div className="text-xs text-slate-500 capitalize">{sellerType} · {businessCategory}</div>
              </div>
            </div>

            <ReviewRow label="Location" value={businessLocation} />
            {sellerType === 'farmer' && farmName && <ReviewRow label="Farm" value={farmName} />}
            {businessDescription && <ReviewRow label="Description" value={businessDescription} />}
          </Card>

          {/* What happens next */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <div className="text-xs font-bold text-slate-700 mb-2">What happens next?</div>
            {[
              'Add your first product',
              'Set up payment methods',
              'Start receiving orders',
              'Go live to showcase products',
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                <div className="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center text-[9px] font-bold shrink-0">
                  {i + 1}
                </div>
                {item}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button onClick={() => setStep(2)} variant="outline" className="h-11 flex-1">
              Back
            </Button>
            <Button
              onClick={submit}
              disabled={!canSubmit || saving}
              className="h-11 flex-1 bg-black text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Launching...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Launch Store
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-xs text-slate-500 w-20 shrink-0 pt-0.5">{label}</span>
      <span className="text-slate-800 flex-1">{value}</span>
    </div>
  );
}
