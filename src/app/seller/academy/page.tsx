'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GraduationCap, Camera, Tag, Headphones, TrendingUp, Sparkles } from 'lucide-react';

const upcomingCourses = [
  {
    icon: Camera,
    title: 'Product Photography 101',
    desc: 'Lighting, angles, and editing tips that make your products pop on the feed.',
    duration: '12 min',
    level: 'Beginner',
  },
  {
    icon: Tag,
    title: 'Pricing for Profit',
    desc: 'How to price your goods competitively without leaving money on the table.',
    duration: '8 min',
    level: 'Beginner',
  },
  {
    icon: Headphones,
    title: 'Customer Service that Sells',
    desc: 'Templates and tone guides for handling complaints, returns, and reviews.',
    duration: '15 min',
    level: 'Intermediate',
  },
  {
    icon: TrendingUp,
    title: 'Growing Your Social Following',
    desc: 'Cross-posting strategies for WhatsApp, Telegram, and the Cellex video feed.',
    duration: '18 min',
    level: 'Intermediate',
  },
];

export default function SellerAcademyPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Academy</h1>
        <p className="text-sm text-slate-500 mt-0.5">Learn to grow your store</p>
      </div>

      {/* Coming soon hero */}
      <Card className="p-8 text-center bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
        <div className="w-16 h-16 rounded-full bg-black flex items-center justify-center mx-auto mb-4">
          <GraduationCap className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Coming soon</h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          The Cellex Seller Academy will offer bite-sized courses on product photography,
          pricing, customer service, and growing your social following.
          Stay tuned — we&apos;re building it now.
        </p>
        <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-white px-3 py-1.5 rounded-full border border-slate-200">
          <Sparkles className="w-3 h-3" />
          Launching Q3 2026
        </div>
      </Card>

      {/* Upcoming courses */}
      <div>
        <h3 className="font-semibold text-slate-900 mb-3 text-sm uppercase tracking-wide">
          What&apos;s coming
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {upcomingCourses.map((course) => {
            const Icon = course.icon;
            return (
              <Card key={course.title} className="p-4 space-y-2 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-slate-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-slate-900">{course.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{course.desc}</div>
                    <div className="flex items-center gap-2 mt-2 text-[10px]">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                        {course.duration}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                        {course.level}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Notify me */}
      <Card className="p-5 text-center">
        <p className="text-sm text-slate-600 mb-3">
          Want to be the first to know when courses launch?
        </p>
        <Button variant="outline" size="sm" disabled className="gap-2">
          <Sparkles className="w-4 h-4" /> Notify me at launch
        </Button>
        <p className="text-[10px] text-slate-400 mt-2">
          We&apos;ll send a one-time notification through the Cellex app.
        </p>
      </Card>
    </div>
  );
}
