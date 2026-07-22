#!/usr/bin/env python3
"""
Cellex Bulk Seed Script
=======================
Adds 50 sellers + 1000+ products (20+ per seller) + 500+ videos (10+ per seller)
to the live Supabase database via the management SQL API.

Existing data is preserved — new sellers get UUIDs auto-generated, new products
use IDs starting after the current MAX(id), new videos use sequential IDs.
"""
import json, urllib.request, time, random, uuid
from datetime import datetime, timedelta

random.seed(42)  # deterministic

TOKEN = "sbp_a04450c740a3b13382cf1b042b226126baa5d2d7"
PROJECT = "tcwdbokruvlizkxcpkzj"
SUPABASE_URL = "https://tcwdbokruvlizkxcpkzj.supabase.co"

# ───────────────────────────────────────────────────────────────────────────
# SQL helper
# ───────────────────────────────────────────────────────────────────────────
def sql(query: str, timeout: int = 60):
    url = f"https://api.supabase.com/v1/projects/{PROJECT}/database/query"
    data = json.dumps({"query": query}).encode("utf-8")
    req = urllib.request.Request(url, data=data, method='POST',
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 Chrome/126.0",
        })
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.load(r)
    except Exception as e:
        return {"error": str(e)[:500]}

def sql_escape(s) -> str:
    if s is None: return "NULL"
    return "'" + str(s).replace("'", "''") + "'"

# ───────────────────────────────────────────────────────────────────────────
# Data: 50 Nigerian sellers across 10 categories
# ───────────────────────────────────────────────────────────────────────────
NG_CITIES = ['Lagos', 'Abuja', 'Kano', 'Ibadan', 'Port Harcourt', 'Benin City',
             'Kaduna', 'Enugu', 'Aba', 'Jos', 'Warri', 'Onitsha']

SELLER_TEMPLATES = [
    # (business_name, category, seller_type, description)
    ('TechHub Nigeria', 'Electronics', 'business', 'Premium electronics retailer — phones, laptops, accessories.'),
    ('Lagos Mobile Store', 'Electronics', 'business', 'Latest smartphones and mobile accessories at the best prices.'),
    ('Gadget Galaxy NG', 'Electronics', 'business', 'Smart home devices, wearables, and audio gear.'),
    ('Naija Audio House', 'Electronics', 'business', 'Speakers, headphones, and sound systems for every budget.'),
    ('Smart Living Tech', 'Electronics', 'business', 'Smart watches, fitness trackers, and home automation.'),
    ('Ankara Palace', 'Fashion', 'business', 'Authentic Ankara prints and ready-to-wear African fashion.'),
    ('Lagos Fashion House', 'Fashion', 'business', 'Trendy clothing for men and women — office and casual wear.'),
    ('Naija Kicks', 'Fashion', 'business', 'Sneakers, sandals, and footwear for the whole family.'),
    ('Royal Stitches', 'Fashion', 'business', 'Custom tailoring and traditional Nigerian attire.'),
    ('Accessories by Zainab', 'Fashion', 'business', 'Handbags, jewelry, and fashion accessories.'),
    ('Home Essentials NG', 'Home', 'business', 'Everything for your home — kitchen, bedding, decor.'),
    ('Lagos Kitchen Store', 'Home', 'business', 'Cookware, appliances, and kitchen gadgets.'),
    ('Naija Decor', 'Home', 'business', 'Furniture, lighting, and home decoration.'),
    ('Bedding World', 'Home', 'business', 'Quality bedsheets, pillows, and comforters.'),
    ('Smart Home NG', 'Home', 'business', 'Home appliances and smart cleaning devices.'),
    ('Glow Beauty Bar', 'Beauty', 'business', 'Skincare, makeup, and beauty tools.'),
    ('Naija Naturals', 'Beauty', 'business', 'Organic and natural beauty products.'),
    ('Hair Empire', 'Beauty', 'business', 'Wigs, hair extensions, and hair care products.'),
    ('Perfume Palace', 'Beauty', 'business', 'Designer fragrances and body care.'),
    ('Cosmetics Corner', 'Beauty', 'business', 'Makeup, nails, and beauty accessories.'),
    ('Green Valley Farm', 'Farm', 'farmer', 'Fresh organic produce delivered from farm to table.'),
    ('Naija Agro Mart', 'Farm', 'farmer', 'Farm-fresh fruits, vegetables, and grains.'),
    ('Northern Grains', 'Farm', 'farmer', 'Premium grains, rice, and beans from northern Nigeria.'),
    ('Palm Oil Direct', 'Farm', 'farmer', 'Pure palm oil and farm products from the east.'),
    ('Abeokuta Yam Farm', 'Farm', 'farmer', 'Fresh yams, plantains, and tubers direct from farm.'),
    ('Sports Gear NG', 'Sports', 'business', 'Football kits, gym equipment, and sportswear.'),
    ('Fit Life Store', 'Sports', 'business', 'Yoga mats, weights, and fitness accessories.'),
    ('Naija Football Hub', 'Sports', 'business', 'Football boots, jerseys, and equipment.'),
    ('Outdoor Adventures', 'Sports', 'business', 'Camping, hiking, and outdoor gear.'),
    ('Cycling Nigeria', 'Sports', 'business', 'Bicycles, parts, and cycling accessories.'),
    ('Book World Lagos', 'Books', 'business', 'Educational books, novels, and stationery.'),
    ('Naija Reads', 'Books', 'business', 'African literature, textbooks, and children books.'),
    ('Stationery Hub', 'Books', 'business', 'Office supplies, notebooks, and pens.'),
    ('Christian Bookstore', 'Books', 'business', 'Religious books, Bibles, and devotionals.'),
    ('Academic Books NG', 'Books', 'business', 'University textbooks and study materials.'),
    ('Naija Food Mart', 'Food', 'business', 'Packaged foods, snacks, and beverages.'),
    ('Lagos Snacks', 'Food', 'business', 'Local snacks, chin-chin, and cookies.'),
    ('Tea & Coffee NG', 'Food', 'business', 'Premium teas, coffee, and hot beverages.'),
    ('Spice Bazaar', 'Food', 'business', 'Cooking spices, seasonings, and condiments.'),
    ('Naija Drinks', 'Food', 'business', 'Juices, smoothies, and beverages.'),
    ('Toy Zone NG', 'Toys', 'business', 'Educational toys, games, and kids entertainment.'),
    ('Kids World', 'Toys', 'business', 'Toys, dolls, and action figures for all ages.'),
    ('Baby Essentials', 'Toys', 'business', 'Baby toys, learning tools, and nursery items.'),
    ('Game Hub Lagos', 'Toys', 'business', 'Board games, puzzles, and family games.'),
    ('STEM Toys NG', 'Toys', 'business', 'Educational STEM kits and science toys.'),
    ('Phone Fix Pro', 'Electronics', 'business', 'Phone repair parts and accessories.'),
    ('Computer World', 'Electronics', 'business', 'Laptops, desktops, and computer accessories.'),
    ('Camera Store NG', 'Electronics', 'business', 'Cameras, lenses, and photography gear.'),
    ('Gaming Hub Nigeria', 'Electronics', 'business', 'Gaming consoles, controllers, and video games.'),
    ('Power Solutions NG', 'Electronics', 'business', 'Generators, inverters, and solar power.'),
]

# Profile image pool (Unsplash portraits)
PROFILE_IMAGES = [
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200',
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200',
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200',
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200',
]

# ───────────────────────────────────────────────────────────────────────────
# Product templates per category (name + Unsplash image + price range in NGN)
# ───────────────────────────────────────────────────────────────────────────
PRODUCT_TEMPLATES = {
    'Electronics': [
        ('Smart Watch Pro Max', 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500', 25000, 45000),
        ('Wireless Earbuds X1', 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500', 12000, 22000),
        ('Bluetooth Speaker Mini', 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500', 8500, 18000),
        ('Power Bank 20000mAh', 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=500', 9500, 16500),
        ('Phone Case Premium', 'https://images.unsplash.com/photo-1601593346740-925612772716?w=500', 2500, 5500),
        ('USB-C Fast Charger', 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=500', 4500, 8500),
        ('Gaming Mouse RGB', 'https://images.unsplash.com/photo-1527814050087-3793815479db?w=500', 7500, 15500),
        ('Mechanical Keyboard', 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500', 18000, 35000),
        ('HD Webcam Pro', 'https://images.unsplash.com/photo-1587232933045-ee7b94a1c44a?w=500', 12000, 24000),
        ('Wireless Mouse', 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500', 3500, 7500),
        ('Laptop Stand Aluminum', 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=500', 6500, 12000),
        ('USB Hub 7-Port', 'https://images.unsplash.com/photo-1625948515291-69613efd103f?w=500', 5500, 9500),
        ('Headphones Studio', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500', 22000, 65000),
        ('Smart Bulb WiFi', 'https://images.unsplash.com/photo-1565814329452-e1efa11c5b89?w=500', 4500, 8500),
        ('Drone Camera 4K', 'https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=500', 85000, 250000),
        ('Tripod Stand Pro', 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=500', 8500, 18500),
        ('Smart Doorbell', 'https://images.unsplash.com/photo-1558002038-1055907df827?w=500', 22000, 45000),
        ('Wireless Charger Pad', 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=500', 6500, 12500),
        ('Fitness Tracker Band', 'https://images.unsplash.com/photo-1576243345690-4e4b79b63288?w=500', 8500, 18500),
        ('Portable Projector', 'https://images.unsplash.com/photo-1626379953822-baec19c3accd?w=500', 65000, 185000),
        ('VR Headset 3D', 'https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?w=500', 45000, 95000),
        ('Action Camera 4K', 'https://images.unsplash.com/photo-1500634245200-e5245c7574ef?w=500', 35000, 75000),
    ],
    'Fashion': [
        ('Ankara Print Dress', 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=500', 8500, 18500),
        ('Men\'s Office Shirt', 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=500', 6500, 12500),
        ('Ladies Handbag Premium', 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=500', 12500, 35000),
        ('Sneakers Urban Style', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500', 15500, 45000),
        ('Smart Watch Strap', 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500', 2500, 5500),
        ('Winter Jacket', 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=500', 18500, 45000),
        ('Denim Jeans Classic', 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=500', 8500, 18500),
        ('Silk Scarf Luxury', 'https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=500', 3500, 7500),
        ('Leather Wallet Men', 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=500', 4500, 9500),
        ('Sunglasses Designer', 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=500', 6500, 18500),
        ('Watch Luxury Edition', 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=500', 35000, 85000),
        ('Beaded Necklace Set', 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=500', 3500, 8500),
        ('African Print Shirt', 'https://images.unsplash.com/photo-1620012253295-c15cc3e65df4?w=500', 7500, 15500),
        ('Ladies Heels Elegant', 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=500', 12500, 28500),
        ('Sports Cap', 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=500', 2500, 5500),
        ('Hoodie Casual', 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=500', 8500, 18500),
        ('T-Shirt Cotton Premium', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500', 3500, 7500),
        ('Belt Leather Genuine', 'https://images.unsplash.com/photo-1624222247344-550fb60583dc?w=500', 4500, 9500),
        ('Sliders Comfort', 'https://images.unsplash.com/photo-1603487742131-4160ec999306?w=500', 3500, 7500),
        ('Fashion Ring Set', 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=500', 3500, 8500),
        ('Ankara Head Wrap', 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=500', 2500, 5500),
        ('Casual Trousers Men', 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=500', 7500, 15500),
    ],
    'Home': [
        ('Blender 1.5L', 'https://images.unsplash.com/photo-1570222094114-d054a817e56b?w=500', 12500, 28500),
        ('Cookware Set 10pc', 'https://images.unsplash.com/photo-1584990347449-a8d3a9c66857?w=500', 25000, 65000),
        ('Bed Sheets King Size', 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=500', 9500, 22500),
        ('Table Lamp LED', 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500', 5500, 12500),
        ('Microwave Oven 20L', 'https://images.unsplash.com/photo-1574269909862-7e1d70bb8078?w=500', 25000, 55000),
        ('Electric Kettle 1.7L', 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=500', 6500, 12500),
        ('Knife Set Premium', 'https://images.unsplash.com/photo-1567521464027-f127ff144326?w=500', 8500, 18500),
        ('Curtains Living Room', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=500', 9500, 22500),
        ('Air Fryer Digital', 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=500', 35000, 65000),
        ('Iron Steam Pro', 'https://images.unsplash.com/photo-1565374395542-0ce18882c857?w=500', 8500, 18500),
        ('Rug Carpet 2x3', 'https://images.unsplash.com/photo-1600166898405-da9535204843?w=500', 15000, 35000),
        ('Wall Clock Modern', 'https://images.unsplash.com/photo-1495364141860-b0d03eccd065?w=500', 4500, 9500),
        ('Dinner Set 16pc', 'https://images.unsplash.com/photo-1603199506016-b9a594b593c0?w=500', 12500, 28500),
        ('Throw Pillow Set', 'https://images.unsplash.com/photo-1592078615290-033ee584e267?w=500', 3500, 8500),
        ('Storage Box Set', 'https://images.unsplash.com/photo-1558997519-83ea9252edf8?w=500', 4500, 9500),
        ('Vacuum Cleaner', 'https://images.unsplash.com/photo-1558317374-067fb5f30001?w=500', 28000, 65000),
        ('Towel Set 6pc', 'https://images.unsplash.com/photo-1600369671236-e74521d4b6ad?w=500', 6500, 12500),
        ('Plant Pot Decor', 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=500', 2500, 5500),
        ('Mug Set Ceramic', 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=500', 3500, 7500),
        ('Photo Frame Set', 'https://images.unsplash.com/photo-1577083552431-6e5fd01988ec?w=500', 3500, 7500),
        ('Bathroom Mirror LED', 'https://images.unsplash.com/photo-1615529182904-14819c35db37?w=500', 9500, 18500),
        ('Food Container Set', 'https://images.unsplash.com/photo-1607349913338-fca6f7fc42d7?w=500', 4500, 9500),
    ],
    'Beauty': [
        ('Vitamin C Serum', 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=500', 6500, 12500),
        ('Makeup Palette Pro', 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=500', 8500, 18500),
        ('Lipstick Set Matte', 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=500', 4500, 9500),
        ('Face Cream Moisturizer', 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=500', 5500, 12500),
        ('Hair Growth Oil', 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=500', 3500, 8500),
        ('Perfume Eau de Parfum', 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=500', 12500, 45000),
        ('Nail Polish Set', 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=500', 3500, 7500),
        ('Foundation Full Cover', 'https://images.unsplash.com/photo-1631214540242-3cd8c4b0b3b6?w=500', 5500, 12500),
        ('Eyeshadow Kit 12-color', 'https://images.unsplash.com/photo-1583241800698-9c2e0d5d2117?w=500', 4500, 9500),
        ('Wig Front Lace', 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=500', 18000, 55000),
        ('Beard Grooming Kit', 'https://images.unsplash.com/photo-1606490194859-07c18c9f0968?w=500', 5500, 12500),
        ('Body Lotion Cocoa', 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=500', 3500, 7500),
        ('Mascara Waterproof', 'https://images.unsplash.com/photo-1631214540242-3cd8c4b0b3b6?w=500', 3500, 7500),
        ('Makeup Brush Set', 'https://images.unsplash.com/photo-1583241800698-9c2e0d5d2117?w=500', 4500, 9500),
        ('Hair Dryer Pro', 'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=500', 9500, 22500),
        ('Skin Care Gift Set', 'https://images.unsplash.com/photo-1556228841-a3c527ebefe5?w=500', 15000, 35000),
        ('Sunscreen SPF 50', 'https://images.unsplash.com/photo-1556228841-a3c527ebefe5?w=500', 4500, 9500),
        ('Toner Rose Water', 'https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a?w=500', 3500, 7500),
        ('Eyeliner Waterproof', 'https://images.unsplash.com/photo-1583241800698-9c2e0d5d2117?w=500', 2500, 5500),
        ('Hair Extension Clip-in', 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=500', 12000, 28000),
        ('Face Mask Sheet Pack', 'https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a?w=500', 4500, 9500),
        ('Cologne Men 100ml', 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=500', 15000, 55000),
    ],
    'Farm': [
        ('Fresh Tomatoes 5kg', 'https://images.unsplash.com/photo-1546470427-227df1e3b9b3?w=500', 4500, 9500),
        ('Sweet Pepper Pack', 'https://images.unsplash.com/photo-1563565375-f3b9167c1b58?w=500', 3500, 7500),
        ('Organic Rice 10kg', 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500', 9500, 18500),
        ('Brown Beans 5kg', 'https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?w=500', 7500, 15500),
        ('Palm Oil Pure 5L', 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500', 8500, 18500),
        ('Yam Tubers 5pc', 'https://images.unsplash.com/photo-1599909533730-f9ba0f4c1c1d?w=500', 6500, 12500),
        ('Plantain Bunch', 'https://images.unsplash.com/photo-1601493700631-2b16ec4b4716?w=500', 2500, 5500),
        ('Fresh Pepper Red 2kg', 'https://images.unsplash.com/photo-1563565375-f3b9167c1b58?w=500', 2500, 5500),
        ('Honey Pure 1L', 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=500', 4500, 9500),
        ('Garlic Bulbs 1kg', 'https://images.unsplash.com/photo-1540148426945-6f7e1d3a3b7d?w=500', 2500, 5500),
        ('Onions Bag 10kg', 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=500', 8500, 18500),
        ('Cashew Nuts 1kg', 'https://images.unsplash.com/photo-1536591375667-3b95d9e0f3c6?w=500', 5500, 12500),
        ('Dried Fish 1kg', 'https://images.unsplash.com/photo-1535140728325-a4d3707eee70?w=500', 6500, 15500),
        ('Maize Dry 5kg', 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=500', 3500, 7500),
        ('Garri Ijebu 5kg', 'https://images.unsplash.com/photo-1612203985729-70726954388c?w=500', 4500, 9500),
        ('Fresh Eggs Crate', 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=500', 2500, 5500),
        ('Watermelon Whole', 'https://images.unsplash.com/photo-1563114773-84221bd62da8?w=500', 1500, 3500),
        ('Pineapple Fresh', 'https://images.unsplash.com/photo-1550256016-2b7f1b9b1b1b?w=500', 1500, 3500),
        ('Cucumber Pack', 'https://images.unsplash.com/photo-1604977042946-1eecc30f269e?w=500', 1500, 3500),
        ('Spinach Bunch Fresh', 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=500', 1000, 2500),
        ('Carrots 2kg', 'https://images.unsplash.com/photo-1598357065964-0b3f2f4c0333?w=500', 1500, 3500),
        ('Sweet Potatoes 5kg', 'https://images.unsplash.com/photo-1597360340694-5d86c3e3b3d4?w=500', 3500, 7500),
    ],
    'Sports': [
        ('Football Match Size 5', 'https://images.unsplash.com/photo-1614632537190-23e4146777db?w=500', 5500, 12500),
        ('Yoga Mat Premium', 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=500', 5500, 12500),
        ('Dumbbell Set 20kg', 'https://images.unsplash.com/photo-1638536532686-d610adfc8e5c?w=500', 12000, 28000),
        ('Football Jersey Home', 'https://images.unsplash.com/photo-1577471488278-16eec37ffcc2?w=500', 7500, 18500),
        ('Running Shoes Pro', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500', 18000, 45000),
        ('Cycling Helmet', 'https://images.unsplash.com/photo-1612442058061-2c39d2a9c41a?w=500', 6500, 15500),
        ('Jump Rope Pro', 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=500', 1500, 3500),
        ('Basketball Official', 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=500', 6500, 12500),
        ('Treadmill Folding', 'https://images.unsplash.com/photo-1538805060514-97d9cc17730c?w=500', 95000, 250000),
        ('Knee Support Brace', 'https://images.unsplash.com/photo-1581275288578-bfb98aa25ce4?w=500', 3500, 7500),
        ('Sports Bottle 1L', 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500', 1500, 3500),
        ('Resistance Band Set', 'https://images.unsplash.com/photo-1599058917212-d750089bc07e?w=500', 3500, 7500),
        ('Cricket Bat Pro', 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=500', 8500, 18500),
        ('Tennis Racket Pro', 'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=500', 15000, 35000),
        ('Boxing Gloves Set', 'https://images.unsplash.com/photo-1566121408882-55c7f3c1b2c9?w=500', 8500, 18500),
        ('Camping Tent 4P', 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=500', 18000, 45000),
        ('Fishing Rod Combo', 'https://images.unsplash.com/photo-1546058256-47154de4046c?w=500', 9500, 22500),
        ('Hiking Backpack 50L', 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500', 12000, 28000),
        ('Sports Bag Duffel', 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500', 5500, 12500),
        ('Exercise Bike Indoor', 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=500', 65000, 185000),
        ('Soccer Cleats Pro', 'https://images.unsplash.com/photo-1556906781-9a412961c28c?w=500', 12000, 35000),
        ('Gym Gloves Pro', 'https://images.unsplash.com/photo-1581275288578-bfb98aa25ce4?w=500', 2500, 5500),
    ],
    'Books': [
        ('Half of a Yellow Sun', 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=500', 3500, 7500),
        ('Things Fall Apart', 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=500', 2500, 5500),
        ('Purple Hibiscus', 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=500', 2500, 5500),
        ('Mathematics Textbook JSS3', 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=500', 3500, 7500),
        ('English Grammar Pro', 'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=500', 2500, 5500),
        ('Children Story Book', 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=500', 1500, 3500),
        ('Bible King James', 'https://images.unsplash.com/photo-1532153975177-5921d21df693?w=500', 3500, 8500),
        ('Quran with Translation', 'https://images.unsplash.com/photo-1609599006353-e629aaabfeae?w=500', 3500, 8500),
        ('Notebook Set A5 5pc', 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=500', 2500, 5500),
        ('Pen Set Premium 10pc', 'https://images.unsplash.com/photo-1583485088034-697b5bc36b92?w=500', 1500, 3500),
        ('JAMB Past Questions', 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=500', 2500, 5500),
        ('WAEC Prep Book', 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=500', 2500, 5500),
        ('Cookbook Nigerian', 'https://images.unsplash.com/photo-1589998059171-988d887df646?w=500', 3500, 7500),
        ('Self-Help Bestseller', 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=500', 2500, 5500),
        ('Dictionary Pocket', 'https://images.unsplash.com/photo-1532153975177-5921d21df693?w=500', 2500, 5500),
        ('Atlas World New', 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=500', 3500, 7500),
        ('Pencil Set HB 12pc', 'https://images.unsplash.com/photo-1583485088034-697b5bc36b92?w=500', 1500, 2500),
        ('Calculator Scientific', 'https://images.unsplash.com/photo-1574607383476-f517f2603aa2?w=500', 4500, 9500),
        ('Coloring Book Kids', 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=500', 1500, 2500),
        ('Stapler Office Pro', 'https://images.unsplash.com/photo-1583485088034-697b5bc36b92?w=500', 1500, 3500),
        ('Highlighter Set 6pc', 'https://images.unsplash.com/photo-1583485088034-697b5bc36b92?w=500', 1000, 2500),
        ('Engineering Drawing Set', 'https://images.unsplash.com/photo-1574607383476-f517f2603aa2?w=500', 3500, 7500),
    ],
    'Food': [
        ('Chin Chin Pack 500g', 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=500', 1500, 3500),
        ('Plantain Chips 200g', 'https://images.unsplash.com/photo-1601493700631-2b7f1b9b1b1b?w=500', 1000, 2500),
        ('Groundnut Roasted 1kg', 'https://images.unsplash.com/photo-1605493884655-a1b3b3a3b3b3?w=500', 2500, 5500),
        ('Cashew Nuts Roasted', 'https://images.unsplash.com/photo-1536591375667-3b95d9e0f3c6?w=500', 3500, 7500),
        ('Green Tea Pack 100bag', 'https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=500', 2500, 5500),
        ('Coffee Beans 1kg', 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=500', 4500, 9500),
        ('Milo Tin 1kg', 'https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=500', 3500, 7500),
        ('Spice Mix Suya', 'https://images.unsplash.com/photo-1596797078510-4d3a0b3a3a3a?w=500', 1500, 3500),
        ('Curry Powder 200g', 'https://images.unsplash.com/photo-1596797078510-4d3a0b3a3a3a?w=500', 1500, 2500),
        ('Maggi Cubes Pack', 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=500', 1500, 3500),
        ('Orange Juice 1L', 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=500', 1500, 3500),
        ('Granulated Sugar 2kg', 'https://images.unsplash.com/photo-1596797078510-4d3a0b3a3a3a?w=500', 2500, 4500),
        ('Salt Pack 1kg', 'https://images.unsplash.com/photo-1518110925495-b37653b0c4c3?w=500', 500, 1500),
        ('Biscuit Pack Multi', 'https://images.unsplash.com/photo-1596797078510-4d3a0b3a3a3a?w=500', 1500, 3500),
        ('Chocolate Bar 100g', 'https://images.unsplash.com/photo-1623660053975-cf75a8be0908?w=500', 1000, 2500),
        ('Honey Pure 500ml', 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=500', 3500, 7500),
        ('Dry Pepper Ground 200g', 'https://images.unsplash.com/photo-1563565375-f3b9167c1b58?w=500', 1500, 3500),
        ('Cocoa Powder 250g', 'https://images.unsplash.com/photo-1623660053975-cf75a8be0908?w=500', 2500, 5500),
        ('Coconut Water 1L', 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=500', 1500, 3500),
        ('Soy Milk 1L', 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=500', 1500, 3500),
        ('Cereal Box 500g', 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=500', 2500, 5500),
        ('Bottled Water 12pc', 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=500', 2500, 4500),
    ],
    'Toys': [
        ('Building Blocks 200pc', 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=500', 8500, 18500),
        ('Remote Control Car', 'https://images.unsplash.com/photo-1594787318286-3d835c1d207f?w=500', 12000, 28000),
        ('Doll House Set', 'https://images.unsplash.com/photo-1559299070-3b4e2b3c3a3a?w=500', 15000, 35000),
        ('Action Figure Hero', 'https://images.unsplash.com/photo-1594787318286-3d835c1d207f?w=500', 3500, 8500),
        ('Puzzle 500pc', 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=500', 2500, 5500),
        ('Board Game Family', 'https://images.unsplash.com/photo-1606503153255-59d8b8b82176?w=500', 5500, 12500),
        ('Stuffed Bear Plush', 'https://images.unsplash.com/photo-1559299070-3b4e2b3c3a3a?w=500', 4500, 9500),
        ('Robot Toy Smart', 'https://images.unsplash.com/photo-1565538810643-b5bdb714032a?w=500', 15000, 35000),
        ('STEM Robot Kit', 'https://images.unsplash.com/photo-1565538810643-b5bdb714032a?w=500', 18000, 45000),
        ('Toy Train Set', 'https://images.unsplash.com/photo-1594787318286-3d835c1d207f?w=500', 18000, 45000),
        ('Drone Toy Kids', 'https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=500', 12000, 28000),
        ('Kitchen Play Set', 'https://images.unsplash.com/photo-1559299070-3b4e2b3c3a3a?w=500', 8500, 18500),
        ('Doctor Play Kit', 'https://images.unsplash.com/photo-1559299070-3b4e2b3c3a3a?w=500', 5500, 12500),
        ('Musical Instrument Toy', 'https://images.unsplash.com/photo-1525695230005-efd074980869?w=500', 4500, 9500),
        ('Magnetic Tiles 100pc', 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=500', 12000, 28000),
        ('Car Track Set', 'https://images.unsplash.com/photo-1594787318286-3d835c1d207f?w=500', 9500, 22500),
        ('Water Gun Blaster', 'https://images.unsplash.com/photo-1594787318286-3d835c1d207f?w=500', 3500, 7500),
        ('Slime Set Kids', 'https://images.unsplash.com/photo-1606503153255-59d8b8b82176?w=500', 1500, 3500),
        ('Coloring Set Kids', 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=500', 2500, 5500),
        ('Yoyo Pro Metal', 'https://images.unsplash.com/photo-1594787318286-3d835c1d207f?w=500', 2500, 5500),
        ('Basketball Hoop Toy', 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=500', 6500, 12500),
        ('Tricycle Kids', 'https://images.unsplash.com/photo-1594787318286-3d835c1d207f?w=500', 18000, 45000),
    ],
}

# Sample MP4 URLs (Google's public sample video bucket)
SAMPLE_VIDEOS = [
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4',
]

VIDEO_CAPTIONS = [
    'Check out this amazing product! 🔥',
    'Limited stock — get yours now',
    'Best price in Nigeria 🇳🇬',
    'Quality you can trust',
    'Flash sale — 50% off today only',
    'Watch before you buy',
    'Customer favorite ⭐',
    'New arrival alert 🚨',
    'Don\'t miss this deal',
    'Top trending product',
    'See it in action',
    'You won\'t believe the price',
    'Honest review',
    'Unboxing video',
    'Why everyone is buying this',
]

# ───────────────────────────────────────────────────────────────────────────
# Step 1: Get current MAX IDs
# ───────────────────────────────────────────────────────────────────────────
print("=" * 60)
print("STEP 1: Get current max IDs")
print("=" * 60)
result = sql("SELECT COALESCE(MAX(id), 0) as max_id FROM products;")
product_id_start = result[0]['max_id'] + 1 if result and 'max_id' in result[0] else 100
print(f"  Product ID start: {product_id_start}")

result = sql("SELECT COALESCE(MAX(id), 0) as max_id FROM product_videos;")
video_id_start = result[0]['max_id'] + 1 if result and 'max_id' in result[0] else 1
print(f"  Video ID start: {video_id_start}")

# ───────────────────────────────────────────────────────────────────────────
# Step 2: Insert 50 sellers
# ───────────────────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("STEP 2: Insert 50 sellers")
print("=" * 60)

# Batch into chunks of 10 sellers
BATCH = 10
total_sellers_inserted = 0
all_seller_ids = []

for batch_start in range(0, len(SELLER_TEMPLATES), BATCH):
    batch = SELLER_TEMPLATES[batch_start:batch_start + BATCH]
    values_parts = []
    for name, cat, stype, desc in batch:
        city = random.choice(NG_CITIES)
        img = random.choice(PROFILE_IMAGES)
        values_parts.append(
            f"({sql_escape(name)}, {sql_escape(desc)}, {sql_escape(cat)}, "
            f"{sql_escape(city)}, {sql_escape(img)}, {sql_escape(stype)}, 'active')"
        )
    q = f"""
        INSERT INTO sellers (business_name, business_description, business_category,
                             business_location, profile_image, seller_type, status)
        VALUES {', '.join(values_parts)}
        RETURNING id, business_name;
    """
    result = sql(q, timeout=60)
    if isinstance(result, dict) and 'error' in result:
        print(f"  ✗ Batch {batch_start//BATCH+1} failed: {result['error'][:200]}")
    else:
        for row in result:
            all_seller_ids.append(row['id'])
        total_sellers_inserted += len(batch)
        print(f"  ✓ Batch {batch_start//BATCH+1}: inserted {len(batch)} sellers (total: {total_sellers_inserted})")

print(f"\nTotal sellers inserted: {total_sellers_inserted}")

# ───────────────────────────────────────────────────────────────────────────
# Step 3: Insert 20+ products per seller (1000+ total)
# ───────────────────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("STEP 3: Insert 20+ products per seller")
print("=" * 60)

product_id_counter = product_id_start
all_products_by_seller = {}  # seller_id -> [product_ids]
total_products_inserted = 0

for s_idx, seller_id in enumerate(all_seller_ids):
    # Get the category for this seller
    seller_info = SELLER_TEMPLATES[s_idx]
    seller_category = seller_info[1]
    templates = PRODUCT_TEMPLATES.get(seller_category, PRODUCT_TEMPLATES['Electronics'])

    # Each seller gets 20-25 products
    num_products = random.randint(20, 25)
    # Cycle through templates, picking randomly
    chosen = []
    for i in range(num_products):
        template = templates[i % len(templates)]
        chosen.append(template)

    # Build VALUES — batch of 20-25 at a time
    values_parts = []
    now = datetime.utcnow()
    for i, (name, img, lo, hi) in enumerate(chosen):
        price = round(random.uniform(lo, hi), 2)
        units_sold = random.randint(0, 500)
        total_sales = round(price * units_sold, 2)
        created = (now - timedelta(days=random.randint(1, 90))).isoformat()
        # Add suffix to name to make them unique per seller
        suffix = f" #{i+1}" if i >= len(templates) else ""
        values_parts.append(
            f"({product_id_counter}, {sql_escape(created)}, {sql_escape(name + suffix)}, "
            f"{price}, {sql_escape(f'High-quality {name.lower()} from a verified Cellex seller. Available now with fast delivery across Nigeria.')}, "
            f"{sql_escape(img)}, {sql_escape(seller_category)}, {sql_escape(seller_id)}, "
            f"NULL, {total_sales}, {units_sold})"
        )
        product_id_counter += 1

    q = f"""
        INSERT INTO products (id, created_at, name, price, description, image_url,
                              category, seller_id, additional_images, total_sales, units_sold)
        VALUES {', '.join(values_parts)};
    """
    result = sql(q, timeout=60)
    if isinstance(result, dict) and 'error' in result:
        print(f"  ✗ Seller {s_idx+1} ({seller_info[0]}) products failed: {result['error'][:200]}")
    else:
        # Track product IDs for this seller (for videos)
        seller_product_ids = list(range(product_id_counter - num_products, product_id_counter))
        all_products_by_seller[seller_id] = seller_product_ids
        total_products_inserted += num_products
        print(f"  ✓ Seller {s_idx+1} ({seller_info[0]}): {num_products} products (total: {total_products_inserted})")

print(f"\nTotal products inserted: {total_products_inserted}")

# ───────────────────────────────────────────────────────────────────────────
# Step 4: Insert 10+ videos per seller (500+ total)
# ───────────────────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("STEP 4: Insert 10+ videos per seller")
print("=" * 60)

video_id_counter = video_id_start
total_videos_inserted = 0

for s_idx, seller_id in enumerate(all_seller_ids):
    seller_product_ids = all_products_by_seller.get(seller_id, [])
    if not seller_product_ids:
        continue

    seller_info = SELLER_TEMPLATES[s_idx]
    num_videos = random.randint(10, 15)
    values_parts = []
    now = datetime.utcnow()
    for i in range(num_videos):
        product_id = random.choice(seller_product_ids)
        video_url = random.choice(SAMPLE_VIDEOS)
        caption = random.choice(VIDEO_CAPTIONS)
        views = random.randint(100, 50000)
        likes = random.randint(10, views // 5)
        created = (now - timedelta(days=random.randint(1, 60))).isoformat()
        values_parts.append(
            f"({video_id_counter}, {product_id}, {sql_escape(seller_id)}, "
            f"{sql_escape(video_url)}, NULL, {sql_escape(caption)}, "
            f"{views}, {likes}, 'active', {sql_escape(created)})"
        )
        video_id_counter += 1

    q = f"""
        INSERT INTO product_videos (id, product_id, seller_id, video_url, thumbnail_url,
                                     caption, views_count, likes_count, status, created_at)
        VALUES {', '.join(values_parts)};
    """
    result = sql(q, timeout=60)
    if isinstance(result, dict) and 'error' in result:
        print(f"  ✗ Seller {s_idx+1} ({seller_info[0]}) videos failed: {result['error'][:200]}")
    else:
        total_videos_inserted += num_videos
        print(f"  ✓ Seller {s_idx+1} ({seller_info[0]}): {num_videos} videos (total: {total_videos_inserted})")

print(f"\nTotal videos inserted: {total_videos_inserted}")

# ───────────────────────────────────────────────────────────────────────────
# Step 5: Final counts
# ───────────────────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("STEP 5: Final counts")
print("=" * 60)
result = sql("""
SELECT 'sellers' as tbl, COUNT(*) as count FROM sellers
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'product_videos', COUNT(*) FROM product_videos;
""")
print(json.dumps(result, indent=2))

# Per-seller product/video counts
print("\n=== Per-seller counts (top 10) ===")
result = sql("""
SELECT s.business_name, s.business_category,
       COUNT(DISTINCT p.id) as products,
       COUNT(DISTINCT v.id) as videos
FROM sellers s
LEFT JOIN products p ON p.seller_id = s.id
LEFT JOIN product_videos v ON v.seller_id = s.id
GROUP BY s.id, s.business_name, s.business_category
ORDER BY products DESC
LIMIT 10;
""")
print(json.dumps(result, indent=2))

print(f"\n✅ Done! Inserted {total_sellers_inserted} sellers, {total_products_inserted} products, {total_videos_inserted} videos.")
