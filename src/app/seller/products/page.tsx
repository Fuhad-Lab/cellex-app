'use client';

import { useEffect, useState } from 'react';
import { api, formatPrice, type Product } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Search, Store, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { EmptyState } from '@/components/product-card';
import { PageSkeleton } from '@/components/page-skeleton';
const CATEGORIES = ['Electronics', 'Fashion', 'Home', 'Beauty', 'Farm', 'Sports', 'Books', 'Food', 'Toys'];

export default function SellerProductsPage() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [imageUrl, setImageUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const result = await api.sellerProducts.list();
    if (result.success) setProducts(result.products || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setName(''); setPrice(''); setDescription(''); setCategory('Electronics'); setImageUrl('');
    setOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setName(p.name); setPrice(String(p.price)); setDescription(p.description || '');
    setCategory(p.category || 'Electronics'); setImageUrl(p.image_url || '');
    setOpen(true);
  };

  const save = async () => {
    if (!name || !price) {
      toast({ title: 'Missing fields', description: 'Name and price are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const data = { name, price: Number(price), description, category, image_url: imageUrl };
    const result = editing
      ? await api.sellerProducts.update(editing.id, data)
      : await api.sellerProducts.create(data);
    setSaving(false);
    if (result.success) {
      toast({ title: editing ? 'Product updated' : 'Product created' });
      setOpen(false);
      load();
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this product?')) return;
    const result = await api.sellerProducts.delete(id);
    if (result.success) {
      toast({ title: 'Deleted' });
      load();
    }
  };

  const filtered = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold">Products</h1>
        <Button onClick={openCreate} className="brand-gradient text-primary-foreground font-bold">
          <Plus className="w-4 h-4 mr-1" /> Add product
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products..."
          className="pl-9"
        />
      </div>

      {loading ? (<PageSkeleton variant="seller-products" />) : filtered.length === 0 ? (
        <EmptyState
          icon={<Package className="w-8 h-8" />}
          title="No products yet"
          message="Add your first product to start selling on Cellex."
          action={<Button onClick={openCreate} className="brand-gradient text-primary-foreground">Add product</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((p) => (
            <Card key={p.id} className="overflow-hidden border-slate-100">
              <div className="aspect-video bg-slate-50 relative">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <Store className="w-10 h-10" />
                  </div>
                )}
                <div className="absolute top-2 right-2 flex gap-1">
                  <button
                    onClick={() => openEdit(p)}
                    className="bg-white/90 backdrop-blur p-1.5 rounded-lg shadow hover:bg-white"
                  >
                    <Edit className="w-3.5 h-3.5 text-slate-600" />
                  </button>
                  <button
                    onClick={() => remove(p.id)}
                    className="bg-white/90 backdrop-blur p-1.5 rounded-lg shadow hover:bg-white"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </button>
                </div>
              </div>
              <div className="p-3">
                <h3 className="font-bold text-sm line-clamp-1">{p.name}</h3>
                <div className="flex items-center justify-between mt-1">
                  <span className="font-extrabold text-primary">{formatPrice(p.price)}</span>
                  <span className="text-xs text-slate-500">{p.units_sold || 0} sold</span>
                </div>
                {p.category && (
                  <span className="inline-block mt-2 text-[10px] bg-slate-100 px-2 py-0.5 rounded">{p.category}</span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit product' : 'Add new product'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Product name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. iPhone 15 Pro Max" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Price (₦) *</Label>
                <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="50000" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Image URL</Label>
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
              {imageUrl && (
                <div className="mt-2 w-20 h-20 rounded-lg overflow-hidden bg-slate-50">
                  <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Describe your product..." />
            </div>
            <Button onClick={save} disabled={saving} className="w-full brand-gradient text-primary-foreground font-bold">
              {saving ? 'Saving...' : editing ? 'Update product' : 'Create product'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
