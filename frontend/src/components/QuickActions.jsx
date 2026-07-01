import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  Building2,
  ChevronDown,
  ClipboardList,
  ImagePlus,
  PenSquare,
  Share2,
  Sparkles,
  UserPlus,
  Workflow,
  X,
} from 'lucide-react'
import clsx from 'clsx'
import { Button, Modal, ModalLoading } from './ui'
import MediaDropzone from './composer/MediaDropzone'
import WorkspaceCreateModal from './workspaces/WorkspaceCreateModal'
import AccountConnectModal from './accounts/AccountConnectModal'
import AutomationCreateModal from './automations/AutomationCreateModal'
import TeamInviteModal from './team/TeamInviteModal'

const ComposerContent = lazy(() => import('../pages/Composer').then((module) => ({ default: module.ComposerContent })))
const PlanEditorModal = lazy(() => import('./planner/PlanEditorModal'))

const ACTIONS = [
  { key: 'composer', label: 'New post', description: 'Compose and publish content.', icon: PenSquare },
  { key: 'planner', label: 'New planner', description: 'Save a plan or campaign note.', icon: ClipboardList },
  { key: 'account', label: 'Connect account', description: 'Add a social profile or page.', icon: Share2 },
  { key: 'media', label: 'Upload media', description: 'Drop files into the library.', icon: ImagePlus },
  { key: 'automation', label: 'New automation', description: 'Create a repeatable workflow.', icon: Workflow },
  { key: 'workspace', label: 'New workspace', description: 'Create a separate brand space.', icon: Building2 },
  { key: 'team', label: 'New team invite', description: 'Invite a collaborator.', icon: UserPlus },
]

export default function QuickActions() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(null)
  const [modalDirty, setModalDirty] = useState(false)
  const [desktopMenuPosition, setDesktopMenuPosition] = useState({ top: 0, right: 0 })
  const desktopButtonRef = useRef(null)
  const desktopMenuRef = useRef(null)
  const desktopPanelRef = useRef(null)
  const mobileMenuRef = useRef(null)

  useEffect(() => {
    const close = (event) => {
      const inDesktopMenu = desktopMenuRef.current?.contains(event.target)
      const inDesktopPanel = desktopPanelRef.current?.contains(event.target)
      const inMobileMenu = mobileMenuRef.current?.contains(event.target)
      if (!inDesktopMenu && !inDesktopPanel && !inMobileMenu) setOpen(false)
    }
    const openFromPage = (event) => {
      setModalDirty(false)
      setActive(event.detail || { type: 'composer' })
    }
    const requestedNavigation = (event) => {
      const to = event.detail?.to
      if (!to || !active) return
      if (modalDirty && !window.confirm('You have unsaved popup changes. Press OK to discard them and open the page, or Cancel to keep editing.')) {
        return
      }
      setActive(null)
      setModalDirty(false)
      navigate(to)
      window.dispatchEvent(new CustomEvent('postflow:navigation-confirmed'))
    }
    const forceClosePopup = () => {
      setActive(null)
      setModalDirty(false)
    }

    document.addEventListener('mousedown', close, true)
    window.addEventListener('postflow:quick-action', openFromPage)
    window.addEventListener('postflow:request-navigation', requestedNavigation)
    window.addEventListener('postflow:force-close-popup', forceClosePopup)
    return () => {
      document.removeEventListener('mousedown', close, true)
      window.removeEventListener('postflow:quick-action', openFromPage)
      window.removeEventListener('postflow:request-navigation', requestedNavigation)
      window.removeEventListener('postflow:force-close-popup', forceClosePopup)
    }
  }, [active, modalDirty, navigate])

  useEffect(() => {
    window.__postflowActivePopup = active ? { active: true, dirty: modalDirty } : null
  }, [active, modalDirty])

  useEffect(() => {
    if (!open) return undefined

    const updatePosition = () => {
      const rect = desktopButtonRef.current?.getBoundingClientRect()
      if (!rect) return
      setDesktopMenuPosition({
        top: rect.bottom + 8,
        right: Math.max(16, window.innerWidth - rect.right),
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  const choose = (type) => {
    setActive({ type })
    setModalDirty(false)
    setOpen(false)
  }

  const closeModal = () => {
    setActive(null)
    setModalDirty(false)
  }
  const modalType = active?.type

  return (
    <>
      <div className="relative hidden sm:block" ref={desktopMenuRef}>
        <button
          ref={desktopButtonRef}
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          aria-expanded={open}
          aria-haspopup="menu"
        >
          <Sparkles className="h-4 w-4" />
          <span className="hidden sm:inline">New</span>
          <ChevronDown className={clsx('h-4 w-4 transition', open && 'rotate-180')} />
        </button>
      </div>

      {typeof document !== 'undefined' && open && createPortal(
        <div
          ref={desktopPanelRef}
          className="fixed z-[170] hidden w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl dark:border-slate-700 dark:bg-slate-800 sm:block"
          style={{ top: desktopMenuPosition.top, right: desktopMenuPosition.right }}
          role="menu"
        >
          {ACTIONS.map(({ key, label, description, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => choose(key)}
              className="flex w-full items-start gap-3 border-b border-slate-100 px-3 py-2.5 text-left transition last:border-b-0 hover:bg-slate-100 dark:border-slate-700/70 dark:hover:bg-slate-700"
              role="menuitem"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
                <Icon className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</span>
                <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{description}</span>
              </span>
            </button>
          ))}
        </div>,
        document.body,
      )}

      {typeof document !== 'undefined' && createPortal(
        <div className="sm:hidden" ref={mobileMenuRef}>
          {open && (
            <div className="fixed bottom-36 right-4 z-[170] w-[min(22rem,calc(100vw_-_2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl dark:border-slate-700 dark:bg-slate-800" role="menu">
              {ACTIONS.map(({ key, label, description, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => choose(key)}
                  className="flex w-full items-start gap-3 border-b border-slate-100 px-3 py-2.5 text-left transition last:border-b-0 hover:bg-slate-100 dark:border-slate-700/70 dark:hover:bg-slate-700"
                  role="menuitem"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</span>
                    <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{description}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="fixed bottom-20 right-5 z-[170] flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-xl shadow-brand-600/30 transition hover:bg-brand-700"
            aria-label={open ? 'Close new menu' : 'Open new menu'}
            aria-expanded={open}
            aria-haspopup="menu"
          >
            {open ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
          </button>
        </div>,
        document.body,
      )}

      <Modal open={modalType === 'composer'} title="New post" description="Compose a post without leaving this page." onClose={closeModal} size="screen" fullscreenable>
        <div className="p-5">
          <Suspense fallback={<ModalLoading label="Loading composer..." />}>
            <ComposerContent modal initialScheduledAt={active?.scheduledAt} onDone={closeModal} onDirtyChange={setModalDirty} />
          </Suspense>
        </div>
      </Modal>

      {modalType === 'planner' && (
        <Suspense fallback={(
          <Modal open title="Create plan" description="Preparing the plan editor." onClose={closeModal} size="xl" fullscreenable>
            <ModalLoading label="Loading plan editor..." />
          </Modal>
        )}>
          <PlanEditorModal
            key={`planner-${active?.scheduledAt || 'new'}`}
            open
            initialScheduledAt={active?.scheduledAt}
            onClose={closeModal}
            onDirtyChange={setModalDirty}
            onSaved={() => window.dispatchEvent(new CustomEvent('postflow:refresh-planner'))}
          />
        </Suspense>
      )}

      {modalType === 'account' && <AccountConnectModal open onClose={closeModal} />}

      <Modal open={modalType === 'media'} title="Upload media" description="Drop one or more files into your media library." onClose={closeModal} size="lg">
        <MediaUploadQuickForm onDone={closeModal} />
      </Modal>

      {modalType === 'automation' && <AutomationCreateModal open onClose={closeModal} />}

      <WorkspaceCreateModal
        open={modalType === 'workspace'}
        title="New workspace"
        description="Create a separate workspace for a brand or team."
        onClose={closeModal}
      />

      {modalType === 'team' && <TeamInviteModal open onClose={closeModal} />}
    </>
  )
}

function MediaUploadQuickForm({ onDone }) {
  const [items, setItems] = useState([])
  const uploading = items.some((item) => item.uploading)

  return (
    <div className="space-y-4 p-5">
      <MediaDropzone items={items} onChange={setItems} />
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        <Button variant="ghost" onClick={onDone}>Cancel</Button>
        <Button onClick={onDone} disabled={uploading}>{uploading ? 'Uploading...' : 'Done'}</Button>
      </div>
    </div>
  )
}
