// app/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'

export default function HomePage() {
  const router = useRouter()

  // 1. SSR-Safe Background Auth Token Detection
  const [isProcessingToken] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return (
        window.location.hash.includes('access_token') ||
        window.location.hash.includes('type=invite') ||
        window.location.hash.includes('type=recovery')
      )
    }
    return false
  })

  // Interactive States
  const [heroSimTab, setHeroSimTab] = useState<'escrow' | 'sla' | 'delegation'>('escrow')
  const [heroActionState, setHeroActionState] = useState<'idle' | 'deduction_verified' | 'escrow_refunded'>('idle')
  const [slaCountdown, setSlaCountdown] = useState(14)
  const [slaDispatched, setSlaDispatched] = useState(false)
  const [delegatedCoordinator, setDelegatedCoordinator] = useState('Faith Mutua')
  const [delegationCommitted, setDelegationCommitted] = useState(false)

  // Interactive ROI Calculator State (Units managed: 50 to 1500)
  const [roiUnits, setRoiUnits] = useState(250)

  // FAQ Accordion State
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0)

  // Walkthrough Modal State
  const [demoModalOpen, setDemoModalOpen] = useState(false)

  // Background Auth Routing Listener
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      (window.location.hash.includes('access_token') ||
        window.location.hash.includes('type=invite') ||
        window.location.hash.includes('type=recovery'))
    ) {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const routeUser = async () => {
        if (
          window.location.hash.includes('type=invite') ||
          window.location.hash.includes('type=recovery')
        ) {
          router.push('/update-password')
          return
        }

        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

          if (profile?.role === 'tenant') {
            router.push('/portal')
            return
          }
        }

        router.push('/dashboard')
      }

      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          routeUser()
        }
      })

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
          routeUser()
        }
      })

      return () => subscription.unsubscribe()
    }
  }, [router])

  // Modal Keyboard Dismiss & Scroll Lock
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && demoModalOpen) {
        setDemoModalOpen(false)
      }
    }

    if (demoModalOpen) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [demoModalOpen])

  // Computed ROI values
  const disputesPrevented = Math.round(roiUnits * 0.38)
  const hoursReclaimed = Math.round(roiUnits * 13.5)
  const escrowProtected = roiUnits * 75000
  const annualSavings = Math.round(roiUnits * 4800)

  // Loading Screen for Auth Token Verification
  if (isProcessingToken) {
    return (
      <div className="min-h-screen bg-[#F5F4EE] flex items-center justify-center text-[#18201A]" role="status" aria-live="polite">
        <div className="flex flex-col items-center">
          <div className="h-10 w-10 border-3 border-[#2D5A43] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-[#3F4840] font-serif text-sm tracking-wide">
            Authenticating institutional security credentials...
          </p>
        </div>
      </div>
    )
  }

  const faqs = [
    {
      q: 'How does Luffi Tech eliminate 100% of deposit disputes under Kenyan law?',
      a: 'Under the Kenya Landlord & Tenant Act, arbitrary security deposit deductions are illegal. Luffi Tech enforces a closed-loop escrow ledger: when a tenant vacates, coordinators cannot deduct any sum without attaching an itemized invoice reference number and timestamped photographic proof. Both parties digitally certify the exit statement before electronic payout is triggered.'
    },
    {
      q: 'Can we migrate existing units, tenant balances, and lease PDFs in bulk?',
      a: 'Yes. Our Automated CSV Ingestion Engine maps hundreds of doors, active tenant phone numbers (+254), national IDs, and current lease expiration dates in under 60 seconds. Our validation pipeline automatically catches duplicate IDs or unassigned units before anything is saved to PostgreSQL.'
    },
    {
      q: 'How does the 48-Hour Maintenance SLA Clock hold external contractors accountable?',
      a: 'The moment a tenant snaps a photo of a plumbing leak or electrical fault, a 48-hour countdown timer begins. The assigned coordinator dispatches pre-vetted contractors via direct SMS link. If the job is not in-progress by hour 36, automated warning alerts ping the Agency Executive Dashboard.'
    },
    {
      q: 'How does Row-Level Security (RLS) guarantee our agency data is 100% private?',
      a: 'Multi-tenancy isolation is enforced at the database kernel level in PostgreSQL 16 using Supabase Row-Level Security. Every SQL query verifies auth.uid() and agency_id. Coordinators can strictly query buildings assigned to them, and competing agencies on the platform have zero cryptographic visibility into your tenant roster.'
    },
    {
      q: 'Does Luffi Tech integrate with M-PESA Paybills and Kenyan Commercial Banks?',
      a: 'Yes. Luffi Tech connects with Daraja M-PESA Paybill/Till APIs for real-time rent and utility collection reconciliation, as well as electronic B2C deposit refund settlement.'
    }
  ]

  return (
    <div className="min-h-screen bg-[#F5F4EE] text-[#1C241E] font-sans selection:bg-[#2D5A43] selection:text-white relative overflow-x-hidden antialiased">
      
      {/* 1. EDITORIAL TOP NAVIGATION */}
      <header className="sticky top-0 z-40 bg-[#F5F4EE]/90 backdrop-blur-md border-b border-[#1C241E]/10 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-3 group focus:outline-none">
            <div className="h-9 w-9 rounded-lg bg-[#1C241E] flex items-center justify-center text-white">
              <span className="font-serif font-bold text-lg text-[#E3DFD4]">L</span>
            </div>
            <div className="flex flex-col">
              <span className="font-serif text-xl tracking-tight font-bold text-[#1C241E]">
                LUFFI <span className="font-sans text-xs font-semibold text-[#2D5A43] tracking-widest uppercase">TECH</span>
              </span>
              <span className="text-[9px] uppercase tracking-widest text-[#667064] font-medium">
                Asset Infrastructure
              </span>
            </div>
          </Link>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-9 text-xs uppercase tracking-widest font-semibold text-[#4A544A]" aria-label="Main Navigation">
            <a href="#about" className="hover:text-[#1C241E] transition">
              About
            </a>
            <a href="#pillars" className="hover:text-[#1C241E] transition">
              Philosophy
            </a>
            <a href="#capabilities" className="hover:text-[#1C241E] transition">
              Capabilities
            </a>
            <a href="#simulator" className="hover:text-[#1C241E] transition">
              Live Console
            </a>
            <a href="#roi-engine" className="hover:text-[#1C241E] transition">
              Performance
            </a>
            <a href="#faq" className="hover:text-[#1C241E] transition">
              Inquire
            </a>
          </nav>

          {/* Nav Actions */}
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-xs uppercase tracking-widest font-bold text-[#4A544A] hover:text-[#1C241E] transition px-2 py-1"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-full bg-[#1C241E] hover:bg-[#2D5A43] text-white text-xs uppercase tracking-widest font-bold px-5 py-2.5 shadow-sm transition-all duration-300 hover:shadow-md"
            >
              <span>Request Access</span>
              <span className="ml-1.5" aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </div>
      </header>

      {/* 2. EDITORIAL HERO SECTION (Matched to User's Inspiration Layout) */}
      <section id="about" className="pt-12 sm:pt-16 pb-16 sm:pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Top Headline & Narrative Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-end mb-12 sm:mb-16">
            
            {/* Left Column: Metadata & Hero Serif Headline */}
            <div className="lg:col-span-7">
              <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[#636E62] block mb-4">
                \ESTABLISHED IN NAIROBI &bull; INSTITUTIONAL PROPERTY OS
              </span>

              <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-[4.2rem] text-[#1C241E] leading-[1.12] tracking-[-0.015em]">
                Architectural precision and{' '}
                <span className="italic font-serif text-[#2D5A43]">lasting confidence</span>{' '}
                for every property owner.
              </h1>
            </div>

            {/* Right Column: Editorial Paragraph & Learn More Link */}
            <div className="lg:col-span-5 pb-2 space-y-5">
              <p className="text-[#4E584E] text-sm sm:text-base leading-relaxed font-normal">
                At LUFFI TECH, we manage every residential portfolio with precision, care, and verifiable transparency—helping asset owners protect capital and enjoy effortless ownership.
              </p>

              <div className="pt-2">
                <a 
                  href="#pillars" 
                  className="inline-flex items-center gap-2 text-xs uppercase font-bold tracking-widest text-[#1C241E] pb-1 border-b border-[#1C241E] hover:text-[#2D5A43] hover:border-[#2D5A43] transition"
                >
                  <span>Learn More About Our Operating System</span>
                  <span aria-hidden="true">&rarr;</span>
                </a>
              </div>
            </div>

          </div>

          {/* 4-Panel Architectural Photography Mosaic (Direct Match to Inspiration) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 items-end">
            
            {/* Photo 1: Modern Villa Entrance with Timber Soffit */}
            <div className="overflow-hidden rounded-2xl aspect-[3/4] bg-[#E8E6DD] group shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80" 
                alt="Modern luxury villa entrance with warm wood canopy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
              />
            </div>

            {/* Photo 2: Cedar & Glass Pavilion under Clear Sky */}
            <div className="overflow-hidden rounded-2xl aspect-[3/4] bg-[#E8E6DD] group shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80" 
                alt="Cedar wood and glass architectural pavilion"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
              />
            </div>

            {/* Photo 3: ICONIC ARCH CUTOUT (Sunlit Modern Interior Corridor) */}
            <div className="overflow-hidden rounded-t-full rounded-b-2xl aspect-[3/4] bg-[#E8E6DD] group shadow-sm border-2 border-[#1C241E]/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src="https://images.unsplash.com/photo-1600565193348-f74bd3c7ccdf?auto=format&fit=crop&w=800&q=80" 
                alt="Arched sunlit architectural corridor"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
              />
            </div>

            {/* Photo 4: Cantilevered Modern Glass Residence */}
            <div className="overflow-hidden rounded-2xl aspect-[3/4] bg-[#E8E6DD] group shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=800&q=80" 
                alt="Cantilevered modern glass and concrete residence"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
              />
            </div>

          </div>

        </div>
      </section>

      {/* 3. DEEP FOREST GREEN SECTION: PILLARS & ARCHITECTURAL VILLA (Matched to Inspiration) */}
      <section id="pillars" className="py-20 sm:py-28 bg-[#0F1E17] text-[#EDEAE2] rounded-t-[40px] sm:rounded-t-[56px] relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
            
            {/* Left Column: Infinity Pool Villa Image */}
            <div className="lg:col-span-6 space-y-6">
              <div className="overflow-hidden rounded-3xl bg-[#1A2E24] shadow-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src="https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80" 
                  alt="Hillside tropical infinity pool villa with teak sunbeds"
                  className="w-full h-[420px] object-cover hover:scale-105 transition-transform duration-700"
                />
              </div>

              {/* Sub-tag */}
              <div className="flex items-center justify-between text-xs text-[#8BA193] font-mono uppercase tracking-widest pt-2">
                <span>\01 &bull; LUXURY RESIDENTIAL STANDARDS</span>
                <span>NAIROBI, KENYA</span>
              </div>
            </div>

            {/* Right Column: Three Architectural Pillars + Mini Inset Photo */}
            <div className="lg:col-span-6 space-y-10">
              
              {/* Pillar 1: Innovation */}
              <div className="space-y-2 border-b border-white/[0.08] pb-6">
                <h3 className="font-serif text-2xl sm:text-3xl text-white font-normal">
                  Innovation
                </h3>
                <p className="text-[#A2B5A8] text-xs sm:text-sm leading-relaxed max-w-lg">
                  We embrace creative solutions and cutting-edge technology to enhance property operations and deliver exceptional value. Every deposit deduction requires verified contractor work orders and photographic condition logs before funds are released.
                </p>
              </div>

              {/* Pillar 2: Community & Velocity */}
              <div className="space-y-2 border-b border-white/[0.08] pb-6">
                <h3 className="font-serif text-2xl sm:text-3xl text-white font-normal">
                  Community &amp; Velocity
                </h3>
                <p className="text-[#A2B5A8] text-xs sm:text-sm leading-relaxed max-w-lg">
                  We foster inclusive and supportive environments, connecting residents and asset owners. Emergency maintenance requests operate under strict 48-hour countdown SLAs with automated contractor dispatch.
                </p>
              </div>

              {/* Pillar 3: Sustainability & Security (with Mini Inset Thumbnail) */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pt-2">
                <div className="space-y-2 max-w-md">
                  <h3 className="font-serif text-2xl sm:text-3xl text-white font-normal">
                    Sustainability &amp; Governance
                  </h3>
                  <p className="text-[#A2B5A8] text-xs sm:text-sm leading-relaxed">
                    We prioritize transparent governance and cryptographic PostgreSQL Row-Level Security, guaranteeing complete portfolio isolation and zero orphaned units.
                  </p>
                </div>

                {/* Mini Inset Thumbnail Matched to User's Uploaded Image */}
                <div className="w-28 h-20 rounded-xl overflow-hidden bg-[#1A2E24] shadow-lg shrink-0 border border-white/[0.12]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src="https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=400&q=80" 
                    alt="Warm sunlit terrace"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

            </div>

          </div>

          {/* Bottom Curved Architectural Cutout (Direct Match to Inspiration) */}
          <div className="mt-16 sm:mt-24 pt-8 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-6">
            <span className="font-serif text-xl sm:text-2xl text-[#E3DFD4]">
              Protecting KES 2.8B+ in Escrow Across Nairobi&apos;s Premier Estates.
            </span>
            <Link
              href="/signup"
              className="px-6 py-3 rounded-full bg-[#E3DFD4] hover:bg-white text-[#0F1E17] text-xs uppercase font-extrabold tracking-widest transition shadow-lg"
            >
              Start 30-Day Agency Trial
            </Link>
          </div>

        </div>
      </section>

      {/* 4. TACTILE INTERACTIVE SIMULATOR (WARM EDITORIAL STYLING) */}
      <section id="simulator" className="py-24 bg-[#F5F4EE] border-b border-[#1C241E]/10 scroll-mt-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#636E62] block mb-2">
              \LIVE PLATFORM SIMULATION
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-[#1C241E]">
              Experience Dispute-Free Operations in Real Time.
            </h2>
            <p className="mt-3 text-sm text-[#4E584E]">
              Click through the interactive sandbox to see how automated checkout clearances, 48h contractor dispatch, and atomic delegation perform.
            </p>
          </div>

          {/* Simulator Box */}
          <div className="bg-white rounded-3xl border border-[#1C241E]/10 p-6 sm:p-8 shadow-xl">
            
            {/* Mode Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-[#1C241E]/10">
              <span className="text-xs font-mono uppercase tracking-wider text-[#667064]">
                Operating Console Sandbox
              </span>

              <div className="inline-flex p-1 rounded-xl bg-[#EFECE5] border border-[#1C241E]/10" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={heroSimTab === 'escrow'}
                  onClick={() => {
                    setHeroSimTab('escrow')
                    setHeroActionState('idle')
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    heroSimTab === 'escrow'
                      ? 'bg-[#1C241E] text-white shadow-sm'
                      : 'text-[#4A544A] hover:text-[#1C241E]'
                  }`}
                >
                  1. Escrow Checkout
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={heroSimTab === 'sla'}
                  onClick={() => {
                    setHeroSimTab('sla')
                    setSlaDispatched(false)
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    heroSimTab === 'sla'
                      ? 'bg-[#1C241E] text-white shadow-sm'
                      : 'text-[#4A544A] hover:text-[#1C241E]'
                  }`}
                >
                  2. 48h SLA Engine
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={heroSimTab === 'delegation'}
                  onClick={() => {
                    setHeroSimTab('delegation')
                    setDelegationCommitted(false)
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    heroSimTab === 'delegation'
                      ? 'bg-[#1C241E] text-white shadow-sm'
                      : 'text-[#4A544A] hover:text-[#1C241E]'
                  }`}
                >
                  3. Atomic Delegation
                </button>
              </div>
            </div>

            {/* Simulation Tab 1: Escrow Checkout */}
            {heroSimTab === 'escrow' && (
              <div className="pt-6 space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#FAF9F5] p-5 rounded-2xl border border-[#1C241E]/10">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#2D5A43] font-bold block">
                      Exit Clearance &bull; Riverside Prime, Unit 4B
                    </span>
                    <h4 className="font-serif text-xl text-[#1C241E] font-bold mt-0.5">
                      Itemized Escrow Clearance Statement
                    </h4>
                    <p className="text-xs text-[#5A645A]">
                      Every deduction requires an attached contractor invoice and condition photos.
                    </p>
                  </div>

                  <div>
                    {heroActionState === 'idle' && (
                      <button
                        type="button"
                        onClick={() => setHeroActionState('deduction_verified')}
                        className="px-4 py-2 rounded-xl bg-[#1C241E] hover:bg-[#2D5A43] text-white font-bold text-xs transition"
                      >
                        Step 1: Verify Work Order &rarr;
                      </button>
                    )}

                    {heroActionState === 'deduction_verified' && (
                      <button
                        type="button"
                        onClick={() => setHeroActionState('escrow_refunded')}
                        className="px-4 py-2 rounded-xl bg-[#2D5A43] hover:bg-[#1E3E2E] text-white font-bold text-xs transition shadow-md"
                      >
                        Step 2: Release Electronic Refund &rarr;
                      </button>
                    )}

                    {heroActionState === 'escrow_refunded' && (
                      <button
                        type="button"
                        onClick={() => setHeroActionState('idle')}
                        className="px-3 py-1.5 rounded-xl bg-[#EFECE5] text-[#1C241E] font-bold text-xs hover:bg-[#E2DFD6] transition"
                      >
                        Reset Demo
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-[#F5F4EE] border border-[#1C241E]/10 text-xs font-mono space-y-3">
                  <div className="flex justify-between items-center text-[#4A544A] pb-2 border-b border-[#1C241E]/10">
                    <span>Initial Escrow Security Deposit:</span>
                    <span className="font-bold text-[#1C241E] text-sm tabular-nums">KES 180,000.00</span>
                  </div>

                  <div className="flex justify-between items-center text-[#4A544A]">
                    <span className="flex items-center gap-2">
                      <span>Paint Touchup (Work Order #WO-9021)</span>
                      {heroActionState !== 'idle' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-[#E3EFE7] text-[#2D5A43] font-bold border border-[#2D5A43]/20">
                          ✓ PHOTO & INVOICE CERTIFIED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-[#F7EBE1] text-[#9A521E] font-bold">
                          PENDING VERIFICATION
                        </span>
                      )}
                    </span>
                    <span className="font-bold text-rose-600 tabular-nums">- KES 4,500.00</span>
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-[#1C241E]/10 text-sm font-bold">
                    <span className="text-[#1C241E]">Net Electronic Refund Authorized:</span>
                    <span className="text-[#2D5A43] text-base tabular-nums">KES 175,500.00</span>
                  </div>
                </div>

                {heroActionState === 'escrow_refunded' && (
                  <div className="p-4 rounded-xl bg-[#E3EFE7] border border-[#2D5A43]/30 flex items-center justify-between text-xs text-[#1E3E2E] animate-fadeIn">
                    <span className="font-bold">
                      ✓ REFUND SETTLED: KES 175,500 disbursed to Tenant M-PESA &bull; 0 Days Dispute Recorded
                    </span>
                    <span className="font-mono text-[10px] font-bold">SEAL #CLR-99420</span>
                  </div>
                )}
              </div>
            )}

            {/* Simulation Tab 2: 48h SLA Engine */}
            {heroSimTab === 'sla' && (
              <div className="pt-6 space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#FAF9F5] p-5 rounded-2xl border border-[#1C241E]/10">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#9A521E] font-bold block">
                      Emergency Repair Ticket &bull; Karen Villa 8B
                    </span>
                    <h4 className="font-serif text-xl text-[#1C241E] font-bold mt-0.5">
                      Hydraulic Booster Pump Failure
                    </h4>
                    <p className="text-xs text-[#5A645A]">
                      Automatic timer countdown with certified contractor dispatch.
                    </p>
                  </div>

                  <div>
                    {!slaDispatched ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSlaDispatched(true)
                          setSlaCountdown(4)
                        }}
                        className="px-4 py-2 rounded-xl bg-[#1C241E] hover:bg-[#2D5A43] text-white font-bold text-xs transition"
                      >
                        Dispatch Certified Plumber &rarr;
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setSlaDispatched(false)
                          setSlaCountdown(14)
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#EFECE5] text-[#1C241E] font-bold text-xs hover:bg-[#E2DFD6] transition"
                      >
                        Reset Ticket
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-[#F5F4EE] border border-[#1C241E]/10 space-y-4">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#4A544A] font-semibold">Contractor SLA Countdown Cap:</span>
                    <span className="font-mono font-bold text-[#9A521E] bg-[#F7EBE1] px-2.5 py-1 rounded border border-[#9A521E]/20">
                      ⏱️ {slaCountdown}h Remaining of 48h SLA Limit
                    </span>
                  </div>

                  <div className="w-full bg-[#E2DFD6] rounded-full h-2.5 overflow-hidden">
                    <div 
                      className={`h-2.5 rounded-full transition-all duration-500 ${
                        slaDispatched ? 'bg-[#2D5A43] w-full' : 'bg-[#9A521E] w-3/4'
                      }`}
                    />
                  </div>

                  <div className="flex justify-between text-[11px] text-[#667064]">
                    <span>Status: {slaDispatched ? 'Contractor on-site (Westlands Hydraulics Ltd)' : 'Awaiting Coordinator Dispatch'}</span>
                    <span className="text-[#2D5A43] font-semibold">{slaDispatched ? '✓ Resolved inside SLA cap' : 'Auto-escalates at 36h'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Simulation Tab 3: Atomic Delegation */}
            {heroSimTab === 'delegation' && (
              <div className="pt-6 space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#FAF9F5] p-5 rounded-2xl border border-[#1C241E]/10">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#2D5A43] font-bold block">
                      Portfolio Reallocation &bull; Kilimani Urban OS (36 Units)
                    </span>
                    <h4 className="font-serif text-xl text-[#1C241E] font-bold mt-0.5">
                      Atomic Coordinator Delegation
                    </h4>
                    <p className="text-xs text-[#5A645A]">
                      Assign site portfolios in single database transactions with zero orphaned properties.
                    </p>
                  </div>

                  <div>
                    {!delegationCommitted ? (
                      <button
                        type="button"
                        onClick={() => setDelegationCommitted(true)}
                        className="px-4 py-2 rounded-xl bg-[#1C241E] hover:bg-[#2D5A43] text-white font-bold text-xs transition"
                      >
                        Commit Transaction &rarr;
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDelegationCommitted(false)}
                        className="px-3 py-1.5 rounded-xl bg-[#EFECE5] text-[#1C241E] font-bold text-xs hover:bg-[#E2DFD6] transition"
                      >
                        Reset Assignment
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-[#F5F4EE] border border-[#1C241E]/10 space-y-3 text-xs">
                  <div className="flex justify-between items-center text-[#4A544A]">
                    <span>Designated Property Coordinator:</span>
                    <select 
                      value={delegatedCoordinator}
                      onChange={(e) => setDelegatedCoordinator(e.target.value)}
                      className="bg-white border border-[#1C241E]/20 rounded-lg px-3 py-1.5 text-[#1C241E] font-semibold focus:outline-none"
                    >
                      <option value="Faith Mutua">Faith Mutua (Lead Coordinator)</option>
                      <option value="Brian Omondi">Brian Omondi (Westlands Team)</option>
                      <option value="Sarah Chebet">Sarah Chebet (Kilimani Lead)</option>
                    </select>
                  </div>

                  <div className="flex justify-between items-center text-[#4A544A] pt-2 border-t border-[#1C241E]/10">
                    <span>PostgreSQL Integrity Status:</span>
                    {delegationCommitted ? (
                      <span className="text-[#2D5A43] font-mono font-bold bg-[#E3EFE7] px-2.5 py-0.5 rounded border border-[#2D5A43]/20">
                        TRANSACTION COMMITTED &bull; 0 ORPHANS
                      </span>
                    ) : (
                      <span className="text-[#667064] font-mono">READY TO STAGE</span>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>
      </section>

      {/* 5. QUANTITATIVE ROI & PERFORMANCE CALCULATOR */}
      <section id="roi-engine" className="py-24 bg-[#EFECE5] text-[#1C241E] border-b border-[#1C241E]/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#636E62] block mb-2">
              \QUANTITATIVE IMPACT
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-[#1C241E]">
              Calculate Your Agency&apos;s Return on Precision.
            </h2>
            <p className="mt-3 text-sm text-[#4E584E]">
              Drag the slider to your active unit count to compute dispute eliminations, hours reclaimed, and financial returns.
            </p>
          </div>

          <div className="p-8 sm:p-10 rounded-3xl bg-white border border-[#1C241E]/10 shadow-lg space-y-8">
            
            {/* Slider */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs uppercase font-bold tracking-widest text-[#4A544A]">
                  Active Residential Doors Managed:
                </span>
                <span className="font-serif text-3xl sm:text-4xl font-bold text-[#1C241E] tabular-nums">
                  {roiUnits} <span className="font-sans text-sm font-normal text-[#667064]">Units</span>
                </span>
              </div>

              <input 
                type="range" 
                min="50" 
                max="1500" 
                step="25"
                value={roiUnits}
                onChange={(e) => setRoiUnits(Number(e.target.value))}
                className="w-full h-2.5 bg-[#E8E6DD] rounded-lg appearance-none cursor-pointer accent-[#2D5A43] focus:outline-none"
              />

              <div className="flex justify-between text-xs text-[#7A8478]">
                <span>50 Units</span>
                <span>500 Units</span>
                <span>1,500+ Units</span>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-6 border-t border-[#1C241E]/10 text-center">
              <div className="p-5 rounded-2xl bg-[#FAF9F5] border border-[#1C241E]/10">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#667064] block mb-1">
                  Disputes Prevented
                </span>
                <p className="font-serif text-3xl font-bold text-[#1C241E] tabular-nums">
                  {disputesPrevented} <span className="text-sm font-sans text-[#2D5A43]">/yr</span>
                </p>
                <span className="text-[10px] text-[#7A8478] mt-1 block">Zero court or tribunal friction</span>
              </div>

              <div className="p-5 rounded-2xl bg-[#FAF9F5] border border-[#1C241E]/10">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#667064] block mb-1">
                  Staff Hours Saved
                </span>
                <p className="font-serif text-3xl font-bold text-[#2D5A43] tabular-nums">
                  {hoursReclaimed.toLocaleString()} <span className="text-sm font-sans text-[#4A544A]">hrs</span>
                </p>
                <span className="text-[10px] text-[#7A8478] mt-1 block">Manual checkouts eliminated</span>
              </div>

              <div className="p-5 rounded-2xl bg-[#FAF9F5] border border-[#1C241E]/10">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#667064] block mb-1">
                  Protected Escrow
                </span>
                <p className="font-serif text-2xl font-bold text-[#1C241E] tabular-nums">
                  KES {(escrowProtected / 1000000).toFixed(1)}M
                </p>
                <span className="text-[10px] text-[#7A8478] mt-1 block">Locked in verifiable trust</span>
              </div>

              <div className="p-5 rounded-2xl bg-[#E3EFE7] border border-[#2D5A43]/30">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#2D5A43] block mb-1">
                  Annual Agency ROI
                </span>
                <p className="font-serif text-2xl font-bold text-[#1E3E2E] tabular-nums">
                  KES {annualSavings.toLocaleString()}
                </p>
                <span className="text-[10px] text-[#2D5A43] mt-1 block font-semibold">Net agency bottom-line boost</span>
              </div>
            </div>

            <div className="pt-2 text-center">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-full bg-[#1C241E] hover:bg-[#2D5A43] text-white text-xs uppercase tracking-widest font-bold px-8 py-3.5 shadow-md transition"
              >
                <span>Protect My {roiUnits} Units with Luffi Tech</span>
                <span className="ml-2 font-sans" aria-hidden="true">&rarr;</span>
              </Link>
            </div>

          </div>

        </div>
      </section>

      {/* 6. COMPARISON: TRADITIONAL PROPERTY MANAGEMENT VS LUFFI TECH */}
      <section className="py-24 bg-[#F5F4EE] border-b border-[#1C241E]/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#636E62] block mb-2">
              \THE OPERATIONAL CONTRAST
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-[#1C241E]">
              Why Premier Portfolios Choose Luffi Tech.
            </h2>
            <p className="mt-3 text-sm text-[#4E584E]">
              Compare the friction of legacy management against the speed of institutional automation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* The Old Way */}
            <div className="p-8 rounded-3xl bg-white border border-rose-200 shadow-sm space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b border-rose-100">
                <span className="h-7 w-7 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 font-bold text-xs">✕</span>
                <h3 className="font-serif text-xl font-bold text-[#1C241E]">The Traditional Legacy Workflow</h3>
              </div>
              <ul className="space-y-4 text-xs sm:text-sm text-[#4E584E] leading-relaxed">
                <li className="flex items-start gap-3">
                  <span className="text-rose-500 font-bold text-base">&times;</span>
                  <span><strong>Bitter Deposit Disputes:</strong> Deductions calculated on scrap paper with zero verifiable invoices or photographic timestamps.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-rose-500 font-bold text-base">&times;</span>
                  <span><strong>Forgotten Repairs:</strong> Tenant maintenance requests buried in coordinator WhatsApp chats with zero SLA countdowns.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-rose-500 font-bold text-base">&times;</span>
                  <span><strong>Fragmented Portfolios:</strong> No audit logs when properties change coordinators, creating orphaned units and missed rent.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-rose-500 font-bold text-base">&times;</span>
                  <span><strong>Spreadsheet Vulnerabilities:</strong> Anyone with file access can overwrite tenant balances or export unmasked customer data.</span>
                </li>
              </ul>
            </div>

            {/* The Luffi Tech Way */}
            <div className="p-8 rounded-3xl bg-[#0F1E17] text-white border border-[#2D5A43]/40 shadow-xl space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b border-white/[0.08]">
                <span className="h-7 w-7 rounded-full bg-[#2D5A43] flex items-center justify-center text-white font-bold text-xs">✓</span>
                <h3 className="font-serif text-xl font-bold text-[#EDEAE2]">The Luffi Tech Institutional OS</h3>
              </div>
              <ul className="space-y-4 text-xs sm:text-sm text-[#A2B5A8] leading-relaxed">
                <li className="flex items-start gap-3">
                  <span className="text-emerald-400 font-bold text-base">✓</span>
                  <span><strong>100% Escrow Protection:</strong> Certified electronic exit statements require contractor work orders before deductions are settled.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-emerald-400 font-bold text-base">✓</span>
                  <span><strong>48-Hour SLA Guarantee:</strong> Automatic countdown timers, contractor dispatch tracking, and executive escalation.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-emerald-400 font-bold text-base">✓</span>
                  <span><strong>Atomic Delegation:</strong> Transactional site assignments with permanent PostgreSQL history and zero orphan risk.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-emerald-400 font-bold text-base">✓</span>
                  <span><strong>PostgreSQL Row-Level Security:</strong> Bank-grade cryptographic access isolation between coordinators and agencies.</span>
                </li>
              </ul>
            </div>

          </div>

        </div>
      </section>

      {/* 7. FREQUENTLY ASKED QUESTIONS */}
      <section id="faq" className="py-24 bg-[#EFECE5] text-[#1C241E] border-b border-[#1C241E]/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center mb-14">
            <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#636E62] block mb-2">
              \FREQUENTLY ASKED QUESTIONS
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-[#1C241E]">
              Clear Answers for Agency Principals.
            </h2>
            <p className="mt-3 text-sm text-[#4E584E]">
              Everything you need to know about migrating your portfolio to Luffi Tech.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => {
              const isOpen = openFaqIndex === index
              return (
                <div 
                  key={index}
                  className="rounded-2xl border border-[#1C241E]/10 bg-white overflow-hidden transition shadow-sm hover:border-[#1C241E]/20"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    className="w-full p-6 text-left flex items-center justify-between gap-4 focus:outline-none"
                    aria-expanded={isOpen}
                  >
                    <span className="font-serif font-bold text-[#1C241E] text-base sm:text-lg">
                      {faq.q}
                    </span>
                    <span className={`p-1.5 rounded-full bg-[#F5F4EE] text-[#1C241E] transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-6 pb-6 text-xs sm:text-sm text-[#4E584E] leading-relaxed border-t border-[#1C241E]/10 pt-4">
                      {faq.a}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

        </div>
      </section>

      {/* 8. EDITORIAL CONVERTING FOOTER CTA */}
      <section className="py-24 bg-[#0F1E17] text-[#EDEAE2] text-center relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-6">
          <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[#8BA193] block">
            \ELEVATE YOUR OPERATIONS
          </span>
          <h2 className="font-serif text-3xl sm:text-5xl lg:text-6xl text-white font-normal leading-tight">
            Ready to experience effortless property ownership?
          </h2>
          <p className="text-sm sm:text-base text-[#A2B5A8] max-w-xl mx-auto leading-relaxed">
            Eliminate deposit disputes, protect your agency brand, and empower your property coordinators with a surgical command center.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto px-8 py-4 rounded-full bg-[#E3DFD4] hover:bg-white text-[#0F1E17] text-xs uppercase font-extrabold tracking-widest transition shadow-xl"
            >
              Start 30-Day Agency Trial &rarr;
            </Link>
            <button
              type="button"
              onClick={() => setDemoModalOpen(true)}
              className="w-full sm:w-auto px-8 py-4 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-white text-xs uppercase font-extrabold tracking-widest border border-white/[0.15] transition"
            >
              Explore Platform Tour
            </button>
          </div>
        </div>
      </section>

      {/* 9. REFINED FOOTER */}
      <footer className="py-16 bg-[#0B1510] border-t border-white/[0.08] text-[#8BA193] text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-10 pb-12 border-b border-white/[0.06]">
            
            <div className="md:col-span-2 space-y-3">
              <span className="font-serif text-lg font-bold text-white tracking-tight">
                LUFFI <span className="font-sans text-xs font-semibold text-[#8BA193] tracking-widest uppercase">TECH</span>
              </span>
              <p className="text-[#8BA193] text-xs leading-relaxed max-w-sm">
                Luffi Tech Property Operating System is engineered for premier residential portfolios and asset managers in Nairobi, Kenya.
              </p>
              <div className="text-[11px] text-[#5D7063]">
                Nairobi, Kenya &bull; <a href="mailto:contact@luffitech.com" className="hover:text-white underline">contact@luffitech.com</a>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Platform</h4>
              <ul className="space-y-2 text-[#8BA193]">
                <li><a href="#simulator" className="hover:text-white transition">Escrow Checkout</a></li>
                <li><a href="#simulator" className="hover:text-white transition">48h SLA Engine</a></li>
                <li><a href="#simulator" className="hover:text-white transition">Atomic Delegation</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Governance</h4>
              <ul className="space-y-2 text-[#8BA193]">
                <li><span className="text-[#8BA193]">PostgreSQL RLS Boundary</span></li>
                <li><span className="text-[#8BA193]">Kenyan Tenancy Law</span></li>
                <li><span className="text-[#8BA193]">Immutable Audit Logs</span></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Account</h4>
              <ul className="space-y-2 text-[#8BA193]">
                <li><Link href="/login" className="hover:text-white transition">Agency Owner Sign In</Link></li>
                <li><Link href="/login" className="hover:text-white transition">Coordinator HUD</Link></li>
                <li><Link href="/signup" className="hover:text-white transition">New Agency Onboarding</Link></li>
              </ul>
            </div>

          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[#5D7063]">
            <p>&copy; {new Date().getFullYear()} Luffi Tech Ltd. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <span className="hover:text-white transition cursor-pointer">Terms of Service</span>
              <span className="hover:text-white transition cursor-pointer">Privacy & Tenancy Data</span>
              <span className="hover:text-white transition cursor-pointer">Security Standards</span>
            </div>
          </div>
        </div>
      </footer>

      {/* 10. ACCESSIBLE WALKTHROUGH MODAL */}
      {demoModalOpen && (
        <div 
          className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="demo-modal-title"
          onClick={() => setDemoModalOpen(false)}
        >
          <div 
            className="relative bg-white w-full max-w-3xl rounded-3xl border border-[#1C241E]/10 shadow-2xl p-6 sm:p-8 text-[#1C241E]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-[#2D5A43] px-2.5 py-0.5 rounded-full bg-[#E3EFE7] border border-[#2D5A43]/20">
                  Interactive Platform Tour
                </span>
                <h3 id="demo-modal-title" className="font-serif text-2xl font-bold text-[#1C241E] mt-1">
                  Luffi Tech Enterprise Walkthrough
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDemoModalOpen(false)}
                className="p-1.5 text-[#667064] hover:text-[#1C241E] rounded-lg hover:bg-[#EFECE5] transition"
                aria-label="Close walkthrough modal"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 text-xs sm:text-sm text-[#4E584E]">
              <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#1C241E]/10 space-y-1">
                <h4 className="font-serif text-base font-bold text-[#1C241E]">1. Agency Owner Executive HUD</h4>
                <p>Monitor gross collections across all managed sites, audit locked deposits in trust, and track coordinator velocity in real time.</p>
              </div>

              <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#1C241E]/10 space-y-1">
                <h4 className="font-serif text-base font-bold text-[#1C241E]">2. Property Coordinator Action Center</h4>
                <p>Coordinators operate under strict countdown clocks with 3 immediate action buckets: overdue bills, maintenance tickets nearing SLA caps, and vacant unit turnover.</p>
              </div>

              <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#1C241E]/10 space-y-1">
                <h4 className="font-serif text-base font-bold text-[#1C241E]">3. Dispute-Free Tenant Escrow Portal</h4>
                <p>Tenants view their protected security deposit balance in real time, inspect monthly itemized water/power statements, and track maintenance dispatches directly.</p>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-[#1C241E]/10 flex items-center justify-between">
              <span className="text-xs text-[#667064]">Ready to test the live platform?</span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDemoModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#667064] hover:text-[#1C241E] transition"
                >
                  Close Tour
                </button>
                <Link
                  href="/signup"
                  className="px-5 py-2.5 rounded-full text-xs font-bold bg-[#1C241E] hover:bg-[#2D5A43] text-white transition"
                >
                  Start Free Trial Now
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}