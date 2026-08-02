'use client';

import { Camera, Tag, Headphones, TrendingUp, GraduationCap, Sparkles } from 'lucide-react';

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
        <h1 className="text-2xl font-bold">Academy</h1>
        <p className="text-sm text-slate-400 mt-0.5">Learn to grow your store</p>
      </div>

      {/* Coming soon hero */}
      <div className="border border-white/10 rounded-md p-8 text-center bg-white/5">
        <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center mx-auto mb-4">
          <GraduationCap className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-xl font-bold mb-2">Coming soon</h2>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          The Cellex Seller Academy will offer bite-sized courses on product photography,
          pricing, customer service, and growing your social following.
          Stay tuned — we&apos;re building it now.
        </p>
        <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 bg-white/10 px-3 py-1.5 rounded-full border border-white/10">
          <Sparkles className="w-3 h-3" />
          Launching Q3 2026
        </div>
      </div>

      {/* Upcoming courses */}
      <div>
        <h3 className="font-semibold mb-3 text-sm uppercase tracking-wide text-slate-300">
          What&apos;s coming
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {upcomingCourses.map((course) => {
            const Icon = course.icon;
            return (
              <div key={course.title} className="border border-white/10 rounded-md p-4 bg-white/10 hover:bg-white/5 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-md bg-white/5 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{course.title}</div>
                    <div className="text-xs text-slate-400 mt-0.5 line-clamp-2">{course.desc}</div>
                    <div className="flex items-center gap-2 mt-2 text-[10px]">
                      <span className="px-2 py-0.5 rounded-full bg-white/5 text-slate-300 font-medium">
                        {course.duration}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-white/5 text-slate-300 font-medium">
                        {course.level}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Notify me */}
      <div className="border border-white/10 rounded-md p-5 text-center bg-white/10">
        <p className="text-sm text-slate-400 mb-3">
          Want to be the first to know when courses launch?
        </p>
        <button
          disabled
          className="bg-white/10 border border-white/15 text-slate-500 font-semibold rounded-md px-4 py-2 text-sm cursor-not-allowed inline-flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" /> Notify me at launch
        </button>
        <p className="text-[10px] text-slate-500 mt-2">
          We&apos;ll send a one-time notification through the Cellex app.
        </p>
      </div>
    </div>
  );
}
