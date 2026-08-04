'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, Store, Check, User, Building, Sprout,
  Camera, MapPin, FileText, Loader2 } from 'lucide-react';
import { API_BASE } from '@/lib/api';

import { useScrollPreservation } from '@/components/global-state-provider';
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
  useScrollPreservation('become-seller');

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
      const resp = await fetch(`${API_BASE}/api/seller-profile`, {
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
          farm_name: sellerType === 'farmer' ? farmName : '',
          profile_image: profileImage,
        }),
      });
      const data = await resp.json();
      if (data.success) {
        toast({ title: 'Welcome to Cellex Selling', description: 'Your seller account is ready' });
        router.push('/seller/preparing');
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to create seller account', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Network error. Please try again.', variant: 'destructive' });
    }
    setSaving(false);
  };

  const inputClass = "w-full bg-[#F5F5F5] border border-[#E5E5E5] rounded-md px-3 py-2.5 text-sm focus:bg-[#F5F5F5] focus:border-[#E5E5E5] outline-none";

  return (
    <div className="ig-container min-h-screen pb-24 ig-topbar-offset">
      {/* Top bar */}
      <div className="fx-topbar ig-topbar">
        <Link href="/settings" className="ig-icon-btn" aria-label="Back">
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <div className="flex-1 ml-1">
          <h1 className="text-base font-semibold">Become a Seller</h1>
          <p className="text-[10px] text-[#666666]">Step {step} of 3</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex gap-1.5 px-4 py-3">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? 'bg-[#171717]' : 'bg-[#F5F5F5]'}`}
          />
        ))}
      </div>

      {/* Step 1: Store identity */}
      {step === 1 && (
        <div className="px-4 py-4 space-y-5">
          <div>
            <h2 className="text-xl font-bold mb-1">Set up your store</h2>
            <p className="text-sm text-[#666666]">Tell us about your business</p>
          </div>

          {/* Profile image */}
          <div className="flex flex-col items-center gap-2">
            <label className="cursor-pointer">
              <div className="w-24 h-24 rounded-full bg-[#F5F5F5] border-2 border-dashed border-white/15 flex items-center justify-center overflow-hidden hover:border-[#E5E5E5] transition-colors">
                {profileImage ? (
                  <img src={profileImage} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-8 h-8 text-[#666666]" />
                )}
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
            <span className="text-xs text-[#666666]">Tap to upload store logo</span>
          </div>

          {/* Store name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#666666]">Store Name *</Label>
            <Input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Ada's Fashion Store"
              className={inputClass}
            />
          </div>

          {/* Seller type */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-[#666666]">Seller Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {SELLER_TYPES.map((type) => {
                const Icon = type.icon;
                const isActive = sellerType === type.value;
                return (
                  <button
                    key={type.value}
                    onClick={() => setSellerType(type.value)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-md border-2 transition-all ${
                      isActive ? 'border-[#E5E5E5] bg-[#F5F5F5]' : 'border-[#E5E5E5]'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? 'text-black' : 'text-[#666666]'}`} />
                    <span className={`text-xs font-semibold ${isActive ? 'text-black' : 'text-[#666666]'}`}>{type.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-[#666666]">
              {SELLER_TYPES.find(t => t.value === sellerType)?.desc}
            </p>
          </div>

          {/* Farm name (conditional) */}
          {sellerType === 'farmer' && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#666666]">Farm Name</Label>
              <Input
                value={farmName}
                onChange={(e) => setFarmName(e.target.value)}
                placeholder="e.g. Green Valley Farms"
                className={inputClass}
              />
            </div>
          )}

          <button
            onClick={() => setStep(2)}
            disabled={!canProceedStep1}
            className="w-full bg-[#171717] text-black font-semibold rounded-md py-3 hover:bg-[#F5F5F5] disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      )}

      {/* Step 2: Location & category */}
      {step === 2 && (
        <div className="px-4 py-4 space-y-5">
          <div>
            <h2 className="text-xl font-bold mb-1">Location & Category</h2>
            <p className="text-sm text-[#666666]">Help buyers find you</p>
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#666666] flex items-center gap-1.5">
              <MapPin className="w-3 h-3" /> Business Location *
            </Label>
            <Input
              value={businessLocation}
              onChange={(e) => setBusinessLocation(e.target.value)}
              placeholder="e.g. Lagos, Nigeria"
              className={inputClass}
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-[#666666]">Primary Category</Label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => {
                const isActive = businessCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setBusinessCategory(cat)}
                    className={`px-3 py-2.5 rounded-md border-2 text-xs font-semibold transition-all ${
                      isActive ? 'border-[#E5E5E5] bg-[#F5F5F5] text-black' : 'border-[#E5E5E5] text-[#666666]'
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
            <Label className="text-xs font-semibold text-[#666666] flex items-center gap-1.5">
              <FileText className="w-3 h-3" /> Store Description
            </Label>
            <Textarea
              value={businessDescription}
              onChange={(e) => setBusinessDescription(e.target.value)}
              rows={3}
              placeholder="Tell buyers what makes your store special..."
              className={`resize-none ${inputClass}`}
            />
            <p className="text-[10px] text-[#666666]">{businessDescription.length}/300 characters</p>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="flex-1 bg-[#F5F5F5] border border-white/15 text-black font-semibold rounded-md py-3 hover:bg-[#F5F5F5]">
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!canProceedStep2}
              className="flex-1 bg-[#171717] text-black font-semibold rounded-md py-3 hover:bg-[#F5F5F5] disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review & submit */}
      {step === 3 && (
        <div className="px-4 py-4 space-y-5">
          <div>
            <h2 className="text-xl font-bold mb-1">Review & Launch</h2>
            <p className="text-sm text-[#666666]">Confirm your store details</p>
          </div>

          {/* Summary card */}
          <div className="border border-[#E5E5E5] rounded-md p-4 space-y-3">
            <div className="flex items-center gap-3 pb-3 border-b border-[#E5E5E5]">
              <div className="w-14 h-14 rounded-full bg-[#F5F5F5] flex items-center justify-center overflow-hidden shrink-0">
                {profileImage ? (
                  <img src={profileImage} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Store className="w-6 h-6 text-[#666666]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{businessName}</div>
                <div className="text-xs text-[#666666] capitalize">{sellerType} · {businessCategory}</div>
              </div>
            </div>

            <ReviewRow label="Location" value={businessLocation} />
            {sellerType === 'farmer' && farmName && <ReviewRow label="Farm" value={farmName} />}
            {businessDescription && <ReviewRow label="Description" value={businessDescription} />}
          </div>

          {/* What happens next */}
          <div className="bg-[#F5F5F5] rounded-md p-4 space-y-2">
            <div className="text-xs font-semibold text-[#666666] mb-2">What happens next?</div>
            {[
              'Add your first product',
              'Set up payment methods',
              'Start receiving orders',
              'Go live to showcase products',
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-[#666666]">
                <div className="w-4 h-4 rounded-full bg-[#171717] text-black flex items-center justify-center text-[9px] font-bold shrink-0">
                  {i + 1}
                </div>
                {item}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button onClick={() => setStep(2)} className="flex-1 bg-[#F5F5F5] border border-white/15 text-black font-semibold rounded-md py-3 hover:bg-[#F5F5F5]">
              Back
            </button>
            <button
              onClick={submit}
              disabled={!canSubmit || saving}
              className="flex-1 bg-[#171717] text-black font-semibold rounded-md py-3 hover:bg-[#F5F5F5] disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                  Launching...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2 inline" />
                  Launch Store
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-xs text-[#666666] w-20 shrink-0 pt-0.5">{label}</span>
      <span className="text-neutral-800 flex-1">{value}</span>
    </div>
  );
}
