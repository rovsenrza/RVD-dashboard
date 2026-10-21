import { useEffect, useEffectEvent, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEquipment, useFindProducts } from '@/shared/api/queries'
import { Button, Dialog, Field, Input } from '@/shared/ui'
import { matchCode, normaliseCode } from './matchCode'

type Camera = 'starting' | 'scanning' | 'blocked' | 'missing' | 'insecure' | 'failed'

const CAMERA_NOTE: Record<Exclude<Camera, 'scanning'>, string> = {
  starting: 'Включаем камеру…',
  blocked: 'Нет доступа к камере. Разрешите его в настройках браузера или введите номер ниже.',
  missing: 'Камера не найдена. Введите номер ниже.',
  insecure: 'Камера доступна только по защищённому соединению (https). Введите номер ниже.',
  failed: 'Не удалось запустить камеру. Введите номер ниже.',
}

const cameraAvailable = () => window.isSecureContext && !!navigator.mediaDevices?.getUserMedia

function cameraProblem(error: unknown): Camera {
  const name = error instanceof DOMException ? error.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'blocked'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'missing'
  return 'failed'
}

/**
 * Reads a barcode or QR code with the rear camera and opens the hose or
 * machine it names. The decoder (zxing) loads only when this opens; the
 * camera stops the moment a code is read or the sheet closes. Typing the
 * number is always possible, for a worn label or a device without a camera.
 */
export function ScanDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const find = useFindProducts()
  const equipment = useEquipment()
  const video = useRef<HTMLVideoElement>(null)
  const [camera, setCamera] = useState<Camera>(() => (cameraAvailable() ? 'starting' : 'insecure'))
  const [typed, setTyped] = useState('')
  const [miss, setMiss] = useState<string | null>(null)
  const [looking, setLooking] = useState(false)

  // The server finds the hoses a code may name; the match itself stays exact (matchCode).
  const resolve = async (code: string) => {
    const wanted = normaliseCode(code)
    setLooking(true)
    try {
      const found = wanted ? await find({ q: wanted, limit: 50 }) : []
      const hit = matchCode(code, found, equipment.data ?? [])
      if (!hit) {
        setMiss(code.trim())
        return false
      }
      onClose()
      navigate(hit.to)
      return true
    } catch {
      setMiss(code.trim())
      return false
    } finally {
      setLooking(false)
    }
  }
  // The camera callback outlives renders; this always sees the latest data.
  const onCode = useEffectEvent(resolve)

  useEffect(() => {
    if (!cameraAvailable()) return
    let stopped = false
    let stop = () => {}
    let last = ''
    ;(async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        if (stopped || !video.current) return
        const controls = await new BrowserMultiFormatReader().decodeFromConstraints(
          { video: { facingMode: 'environment' } },
          video.current,
          (result, _error, running) => {
            const text = result?.getText()
            // The same unknown code arrives on every frame; report it once.
            if (!text || text === last) return
            last = text
            void onCode(text).then((opened) => opened && running.stop())
          },
        )
        stop = () => controls.stop()
        if (stopped) stop()
        else setCamera('scanning')
      } catch (error) {
        if (!stopped) setCamera(cameraProblem(error))
      }
    })()
    return () => {
      stopped = true
      stop()
    }
  }, [])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (typed.trim()) void resolve(typed)
  }

  const live = camera === 'starting' || camera === 'scanning'

  return (
    <Dialog
      open
      onClose={onClose}
      title="Сканировать код"
      description="Штрих-код или QR-код на бирке рукава или на технике."
    >
      <div className="grid gap-4">
        {live && (
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-rail">
            <video
              ref={video}
              playsInline
              muted
              aria-label="Изображение с камеры"
              className="size-full object-cover"
            />
            {/* Aim frame: where to hold the label, not a claim about detection. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-[18%] inset-y-[22%] rounded-lg shadow-[0_0_0_2px_var(--color-brand),0_0_0_100vmax_var(--color-scrim)]"
            />
          </div>
        )}
        <p role="status" className="text-ui text-ink-muted">
          {miss ? (
            <span className="text-status-replace-ink">
              Код «{miss}» не найден среди ваших изделий и техники.
            </span>
          ) : camera === 'scanning' ? (
            'Наведите камеру на код — карточка откроется сама.'
          ) : (
            CAMERA_NOTE[camera]
          )}
        </p>
        <form onSubmit={submit} className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Field label="Или введите номер">
              {(id) => (
                <Input
                  id={id}
                  value={typed}
                  onChange={(e) => {
                    setTyped(e.target.value)
                    setMiss(null)
                  }}
                  placeholder="Серийный, каталожный или гаражный №"
                  autoComplete="off"
                />
              )}
            </Field>
          </div>
          <Button type="submit" variant="secondary" disabled={looking}>
            {looking ? 'Ищем…' : 'Найти'}
          </Button>
        </form>
      </div>
    </Dialog>
  )
}
