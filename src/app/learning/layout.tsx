'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import PageTransition from '@/components/PageTransition'
import InactivityLogout from '@/components/InactivityLogout'
import PresenceHeartbeat from '@/components/PresenceHeartbeat'
import { getMfaRedirect } from '@/lib/mfaCheck'
import { verifyPortalRole } from '@/lib/verifyPortalRole'
import { getEnabledProducts, productHref } from '@/lib/products'
import { isCoverageAvailable } from '@/lib/coverage'
import { isSubstitutionAvailable, isSubstitutionToolsAvailable, isCoverAvailable, useSubstitutionUnfilledCount, useCoverCount } from '@/lib/substitution'
import { FLAGS_CHANGED_EVENT, loadFlagCounts } from '@/lib/tutorFlags'
import { isLibraryAvailable } from '@/lib/library'
import { isFlashcardsAvailable } from '@/lib/flashcards'
import { isClassFeedbackAvailable } from '@/lib/classFeedback'
import { isSupportAvailable } from '@/lib/support'
import { isVideosAvailable } from '@/lib/videos'
import { isResourcesAvailable } from '@/lib/departmentResources'
import { resolveRole } from '@/lib/offline/role'
import { registerOfflineWorker, warmOfflinePages } from '@/lib/offline/serviceWorker'
import OfflineBanner from '@/components/OfflineBanner'
import OnboardingTour, { type TourStep } from '@/components/OnboardingTour'

type Role = 'student' | 'teacher' | 'supervisor' | 'admin' | 'principal'
const ROLES: Role[] = ['student', 'teacher', 'supervisor', 'admin', 'principal']

const STUDENT_NAV = [{ label: 'My lessons', icon: 'ti-school', href: '/learning' }]
const AUTHOR_NAV = [
  { label: 'My lessons', icon: 'ti-school', href: '/learning' },
  { label: 'New lesson', icon: 'ti-square-plus', href: '/learning/lessons/new' },
  { label: 'Lesson plans', icon: 'ti-notebook', href: '/learning/lesson-plans' },
]
const OVERVIEW_NAV = [{ label: 'Coverage', icon: 'ti-chart-grid-dots', href: '/learning' }]
const COVERAGE_ITEM = { label: 'Coverage', icon: 'ti-chart-grid-dots', href: '/learning/coverage' }
const FLAGS_ITEM = { label: 'Tutor flags', icon: 'ti-shield-check', href: '/learning/flags' }
const REPORT_ABSENCE_ITEM = { label: 'Report Absence', icon: 'ti-user-off', href: '/learning/report-absence' }
const MY_COVER_ITEM = { label: 'My Cover', icon: 'ti-calendar-event', href: '/learning/cover' }
const LIBRARY_ITEM = { label: 'Library', icon: 'ti-books', href: '/learning/library' }
const FLASHCARDS_ITEM = { label: 'Flashcards', icon: 'ti-cards', href: '/learning/flashcards' }
const RESOURCES_ITEM = { label: 'Resources', icon: 'ti-file-text', href: '/learning/resources' }
const FEEDBACK_ITEM = { label: 'Class feedback', icon: 'ti-message-circle', href: '/learning/feedback' }
const SUPPORT_ITEM = { label: 'Student support', icon: 'ti-users', href: '/learning/support' }
const PROGRESS_ITEM = { label: 'My progress', icon: 'ti-chart-line', href: '/learning/progress' }
const VIDEOS_ITEM = { label: 'Videos', icon: 'ti-player-play', href: '/learning/videos' }
const WEEK_ITEM = { label: 'Current and future', icon: 'ti-calendar-event', href: '/learning/week' }
const TEACHER_WEEK_ITEM = { label: 'Current and future', icon: 'ti-calendar-event', href: '/learning/week' }

// The first-visit tour of Smart Learning, one per kind of person. OnboardingTour skips any stop whose menu item is not on the page for this person
// (a school without the Library, say), and shows once per person (profiles.onboarding_tours_seen).
const STUDENT_LEARN_TOUR: TourStep[] = [
  { href: '/learning', title: 'My lessons', body: 'Lessons from your teachers. Each has five steps and short check questions at your level. If you miss a class, the lesson waits here as a catch-up.' },
  { href: '/learning/week', title: 'Current and future', body: 'What changed in the last 7 days, and what is coming up in the next 7.' },
  { href: '/learning/feedback', title: 'Class feedback', body: 'Tell your teachers how the week went in each class. It takes about a minute, and it helps them teach you better.' },
  { href: '/learning/progress', title: 'My progress', body: 'Your results compared with your own earlier results, with a few gentle tips. Never compared with classmates.' },
  { href: '/learning/flashcards', title: 'Flashcards', body: 'Make your own decks. Cards you miss come back sooner, so you spend your time on what you find hard.' },
  { href: '/learning/videos', title: 'Videos', body: 'Short videos your teachers chose. Tap Play to watch. Low-data mode saves your data.' },
  { href: '/learning/library', title: 'Library', body: 'Books to read or listen to, for school and for fun.' },
]
const TEACHER_LEARN_TOUR: TourStep[] = [
  { href: '/learning', title: 'My lessons', body: 'The lessons you have written, and who has finished them.' },
  { href: '/learning/lessons/new', title: 'New lesson', body: 'Build a five-step lesson with check questions at three levels. The AI can draft one for you to review.' },
  { href: '/learning/lesson-plans', title: 'Lesson plans', body: 'A full 5E plan with a general objective, specific objectives and a DOK level, shaped for Jamaica. You review everything the AI drafts.' },
  { href: '/learning/week', title: 'Current and future', body: 'How each of your classes did in the last 7 days, who may need support, and what is coming up.' },
  { href: '/learning/feedback', title: 'Class feedback', body: 'See what each class said this week, write your end-of-week reflection, and get an AI summary you check. A reminder email comes on Friday.' },
  { href: '/learning/support', title: 'Student support', body: 'Students who may need help, and why. Start a support plan, record what you did, and see whether results moved.' },
  { href: '/learning/coverage', title: 'Coverage', body: 'Which topics each class has been taught, and where the gaps are.' },
  { href: '/learning/resources', title: 'Resources', body: 'Share links and files with your department, tagged by subject and topic.' },
  { href: '/learning/videos', title: 'Videos', body: 'Add links to YouTube, Vimeo or Khan Academy videos. Your head of department approves them before students see them.' },
]
const LEADER_LEARN_TOUR: TourStep[] = [
  { href: '/learning', title: 'Coverage', body: 'Which topics each class has been taught, and where the gaps are.' },
  { href: '/learning/flags', title: 'Tutor flags', body: 'Worrying AI-tutor conversations are flagged here for an adult to read.' },
  { href: '/learning/support', title: 'Student support', body: 'Students who may need help across the school, and the support plans in progress.' },
  { href: '/learning/feedback', title: 'Class feedback', body: 'What students said about each class. Anonymous, and shown only when 5 or more students have answered.' },
  { href: '/learning/videos', title: 'Videos', body: 'Review and approve videos your teachers add, and bring back any that students reported.' },
]

// Smart Learning's own shell. Everyone signed in can enter (the lessons themselves are
// protected by the database), but only when the school has switched Smart Learning on.
export default function LearningLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [role, setRole] = useState<Role | null>(null)
  const [state, setState] = useState<'checking' | 'ready' | 'off' | 'offline'>('checking')
  // Heads of department and school admins get a Coverage page once migration 063 is applied.
  const [coverageOn, setCoverageOn] = useState(false)
  // The principal team and school admins get the school-wide list of flagged tutor conversations once
  // migration 065 is applied. `flagCount` is how many are still to be read (shown as a menu badge).
  const [flagsOn, setFlagsOn] = useState(false)
  const [flagCount, setFlagCount] = useState(0)
  // Teachers and HODs who teach can report their own absence from here once migration 073 is applied.
  const [substitutionOn, setSubstitutionOn] = useState(false)
  // HODs and school admins can arrange cover from here once migration 074 is applied.
  const [toolsOn, setToolsOn] = useState(false)
  const unfilled = useSubstitutionUnfilledCount(toolsOn)
  // Teachers and HODs can see the classes they have been asked to cover once migration 075 is applied.
  const [coverOn, setCoverOn] = useState(false)
  const coverCount = useCoverCount(coverOn)
  // Everyone can browse the Library once the school has switched it on and migration 077 is applied.
  const [libraryOn, setLibraryOn] = useState(false)
  // Students get Flashcards once migration 084 is applied.
  const [flashcardsOn, setFlashcardsOn] = useState(false)
  // Teachers, heads of department and the school admin get Resources once migration 087 is applied.
  const [resourcesOn, setResourcesOn] = useState(false)
  // Everyone who teaches, learns or oversees gets Class feedback once migration 091 is applied.
  const [feedbackOn, setFeedbackOn] = useState(false)
  // Staff get Student support and students get My progress once migration 092 is applied.
  const [supportOn, setSupportOn] = useState(false)
  // Everyone gets Videos once migration 093 is applied.
  const [videosOn, setVideosOn] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function check() {
      // Who is this? Asked of the server, or, with no connection, the person last signed in on this device. Only a student gets an offline
      // copy of Smart Learning (their flashcards and lessons already opened); everyone else needs to reconnect.
      const who = await resolveRole()
      if (!who || !ROLES.includes(who.role as Role)) { router.push('/login'); return }
      const r = who.role as Role
      if (who.fromCache) {
        if (cancelled) return
        if (r === 'student') setFlashcardsOn(true)
        setRole(r)
        setState(r === 'student' ? 'ready' : 'offline')
        return
      }

      // Same account checks as every portal (active, password changed, not the platform owner)...
      const mfaPromise = r === 'student' ? Promise.resolve(null) : getMfaRedirect(r)
      mfaPromise.catch(() => {})
      const roleRedirect = await verifyPortalRole(r)
      if (roleRedirect) { router.push(roleRedirect); return }
      // ...and the same MFA rule for staff.
      const mfaRedirect = await mfaPromise
      if (mfaRedirect) { router.push(`${mfaRedirect}?from=${encodeURIComponent(pathname)}`); return }

      const products = await getEnabledProducts()
      const coverage = r === 'supervisor' || r === 'admin' ? await isCoverageAvailable() : false
      const flags = r === 'admin' || r === 'principal' ? await loadFlagCounts() : null
      const substitution = r === 'teacher' || r === 'supervisor' ? await isSubstitutionAvailable() : false
      const tools = r === 'supervisor' || r === 'admin' ? await isSubstitutionToolsAvailable() : false
      const cover = r === 'teacher' || r === 'supervisor' ? await isCoverAvailable() : false
      const library = await isLibraryAvailable()
      const flashcards = r === 'student' ? await isFlashcardsAvailable() : false
      const resources = r === 'teacher' || r === 'supervisor' || r === 'admin' ? await isResourcesAvailable() : false
      const feedback = await isClassFeedbackAvailable()
      const support = await isSupportAvailable()
      const videos = await isVideosAvailable()
      if (cancelled) return
      setFeedbackOn(feedback)
      setSupportOn(support)
      setVideosOn(videos)
      setCoverageOn(coverage)
      setFlagsOn(!!flags)
      setFlagCount(flags?.open_total ?? 0)
      setSubstitutionOn(substitution)
      setCoverOn(cover)
      setToolsOn(tools)
      setLibraryOn(library)
      setFlashcardsOn(flashcards)
      setResourcesOn(resources)
      setRole(r)
      setState(products.includes('learning') ? 'ready' : 'off')
    }
    check()
    return () => { cancelled = true }
  }, [router, pathname])

  // Students get the offline copy: a small service worker keeps the Smart Learning pages and files they use, so they open without a connection.
  useEffect(() => {
    if (state === 'ready' && role === 'student') registerOfflineWorker().then(() => warmOfflinePages(['/learning', '/learning/flashcards']))
  }, [state, role])

  // The lesson editor and lesson plans are for the people who teach. Anyone in an oversight role (school admin,
  // principal / VP) who types one of those addresses is sent to their overview.
  const blockedForOversight = (role === 'admin' || role === 'principal') && (pathname.startsWith('/learning/lessons') || pathname.startsWith('/learning/lesson-plans'))
  useEffect(() => { if (blockedForOversight) router.replace('/learning') }, [blockedForOversight, router])
  // The lesson editor, lesson plans, coverage, resources, student support, tutor flags, report absence, my cover and substitution are staff pages:
  // a student who types one of those addresses is sent back to their lessons. (/learning/lesson/<id>, with no "s", is the student's own lesson.)
  const blockedForStudent = role === 'student' && /^\/learning\/(lessons|lesson-plans|coverage|resources|support|flags|report-absence|cover|substitution)(\/|$)/.test(pathname)
  useEffect(() => { if (blockedForStudent) router.replace('/learning') }, [blockedForStudent, router])

  // When someone marks a flagged conversation read, the menu count updates without a page change.
  useEffect(() => {
    if (!flagsOn) return
    let cancelled = false
    const refresh = () => { loadFlagCounts().then((c) => { if (!cancelled && c) setFlagCount(c.open_total) }) }
    window.addEventListener(FLAGS_CHANGED_EVENT, refresh)
    return () => { cancelled = true; window.removeEventListener(FLAGS_CHANGED_EVENT, refresh) }
  }, [flagsOn])

  if (blockedForOversight || blockedForStudent) return null

  if (state === 'checking' || !role) return null

  if (state === 'offline') {
    return (
      <div className="page-container" style={{ maxWidth: 520 }}>
        <h1>You are offline</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Smart Learning needs a connection for your role. Reconnect and try again.</p>
      </div>
    )
  }

  if (state === 'off') {
    return (
      <div className="page-container" style={{ maxWidth: 520 }}>
        <h1>Smart Learning isn&rsquo;t switched on for your school</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Your school administrator can ask for it to be added.</p>
        <a href={productHref('assess', role)} className="btn btn-secondary">Back to Smart Assess</a>
      </div>
    )
  }

  // School admins and the principal team oversee Smart Learning (Coverage, flagged tutor chats); they do not teach in it.
  const base = role === 'student' ? STUDENT_NAV : (role === 'principal' || role === 'admin') ? OVERVIEW_NAV : coverageOn ? [...AUTHOR_NAV, COVERAGE_ITEM] : AUTHOR_NAV
  const withSubstitution = (role === 'teacher' || role === 'supervisor') && substitutionOn ? [...base, REPORT_ABSENCE_ITEM, ...(coverOn ? [MY_COVER_ITEM] : [])] : base
  const manageItem = { label: 'Substitution', icon: 'ti-replace', href: '/learning/substitution' }
  const withTools = toolsOn && (role === 'supervisor' || role === 'admin') ? [...withSubstitution, manageItem] : withSubstitution
  const withFlags = flagsOn && (role === 'admin' || role === 'principal') ? [...withTools, FLAGS_ITEM] : withTools
  const withWeek = role === 'student' ? [...withFlags, WEEK_ITEM] : role === 'teacher' || role === 'supervisor' ? [...withFlags, TEACHER_WEEK_ITEM] : withFlags
  const withFeedback = feedbackOn ? [...withWeek, FEEDBACK_ITEM] : withWeek
  const withSupport = supportOn ? [...withFeedback, role === 'student' ? PROGRESS_ITEM : SUPPORT_ITEM] : withFeedback
  const withVideos = videosOn ? [...withSupport, VIDEOS_ITEM] : withSupport
  const withResources = resourcesOn ? [...withVideos, RESOURCES_ITEM] : withVideos
  const withFlashcards = flashcardsOn && role === 'student' ? [...withResources, FLASHCARDS_ITEM] : withResources
  const nav = libraryOn ? [...withFlashcards, LIBRARY_ITEM] : withFlashcards
  const badges = { ...(flagsOn ? { [FLAGS_ITEM.href]: flagCount } : {}), ...(toolsOn ? { [manageItem.href]: unfilled } : {}), ...(coverOn ? { [MY_COVER_ITEM.href]: coverCount } : {}) }
  return (
    <div className="portal-layout" style={{ minHeight: '100vh' }}>
      <InactivityLogout />
      <PresenceHeartbeat />
      <main className="portal-content">{role === 'student' && <OfflineBanner />}<PageTransition>{children}</PageTransition></main>
      <OnboardingTour key={role} tourKey={role === 'student' ? 'learning-student' : role === 'teacher' || role === 'supervisor' ? 'learning-teacher' : 'learning-leader'} steps={role === 'student' ? STUDENT_LEARN_TOUR : role === 'teacher' || role === 'supervisor' ? TEACHER_LEARN_TOUR : LEADER_LEARN_TOUR} />
      <Sidebar navItems={nav} badges={badges} portalLabel="Smart Learning" resolveActivePathname={(p) => (p.startsWith('/learning/library') ? '/learning/library' : p.startsWith('/learning/flashcards') ? '/learning/flashcards' : p === '/learning/week' ? '/learning/week' : p.startsWith('/learning/resources') ? '/learning/resources' : p.startsWith('/learning/feedback') ? '/learning/feedback' : p.startsWith('/learning/support') ? '/learning/support' : p.startsWith('/learning/videos') ? '/learning/videos' : p.startsWith('/learning/progress') ? '/learning/progress' : p.startsWith('/learning/lesson/') || p.startsWith('/learning/lessons/') && p !== '/learning/lessons/new' ? '/learning' : p)} />
    </div>
  )
}
