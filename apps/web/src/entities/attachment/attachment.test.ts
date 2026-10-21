import { describe, expect, it } from 'vitest'
import { fileFormat, fileProblem, formatSize, MAX_FILE_BYTES } from './attachment'

describe('fileFormat', () => {
  it('reads the extension, whatever its case', () => {
    expect(fileFormat('IMG_2041.JPG')).toMatchObject({ kind: 'photo', mime: 'image/jpeg' })
    expect(fileFormat('акт.приёмки.pdf')).toMatchObject({ kind: 'document', label: 'PDF' })
  })

  it('knows nothing without a known extension', () => {
    expect(fileFormat('README')).toBeNull()
    expect(fileFormat('setup.exe')).toBeNull()
  })
})

describe('fileProblem', () => {
  it('accepts a photo within the limit', () => {
    expect(fileProblem({ name: 'рукав.jpg', size: 2_400_000 })).toBeNull()
  })

  it('names the file and the reason', () => {
    expect(fileProblem({ name: 'scan.tiff', size: 10 })).toMatch(/^«scan\.tiff»: такой формат/)
    expect(fileProblem({ name: 'пусто.pdf', size: 0 })).toBe('«пусто.pdf»: файл пустой')
    expect(fileProblem({ name: 'big.png', size: MAX_FILE_BYTES + 1 })).toMatch(/больше 10 МБ$/)
  })
})

describe('formatSize', () => {
  it('uses Russian units and a decimal comma', () => {
    expect(formatSize(512)).toBe('512 Б')
    expect(formatSize(860_000)).toBe('840 КБ')
    expect(formatSize(2.4 * 1024 * 1024)).toBe('2,4 МБ')
  })
})
