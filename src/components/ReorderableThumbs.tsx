'use client'

import type { ReactNode } from 'react'
import { DragDropProvider, type DragEndEvent } from '@dnd-kit/react'
import { useSortable, isSortable } from '@dnd-kit/react/sortable'

/**
 * Grid yang dapat disusun ulang dengan drag-and-drop (pratinjau halaman PDF).
 * Pola sama dengan ReorderableList, tetapi untuk kartu thumbnail (flex/grid)
 * dan menyediakan tombol naik/turun sebagai alternatif aksesibilitas.
 */
export function ReorderableThumbs({
  orderIds,
  onReorder,
  renderItem,
  className,
}: {
  /** Urutan id saat ini; indeks di sini = posisi visual. */
  orderIds: string[]
  onReorder: (from: number, to: number) => void
  renderItem: (id: string, index: number, handle: ReactNode) => ReactNode
  className?: string
}) {
  return (
    <DragDropProvider
      onDragEnd={(event: DragEndEvent) => {
        const { source, target } = event.operation
        if (!isSortable(source) || !isSortable(target)) return
        const from = source.index
        const to = target.index
        if (typeof from === 'number' && typeof to === 'number' && from !== to) onReorder(from, to)
      }}
    >
      <ul className={className} data-testid="thumbgrid">
        {orderIds.map((id, index) => (
          <SortableThumb key={id} id={id} index={index}>
            {(handle) => renderItem(id, index, handle)}
          </SortableThumb>
        ))}
      </ul>
    </DragDropProvider>
  )
}

function SortableThumb({
  id,
  index,
  children,
}: {
  id: string
  index: number
  children: (handle: ReactNode) => ReactNode
}) {
  const { ref, handleRef, isDragging } = useSortable({ id, index })
  const handle = (
    <button
      type="button"
      ref={handleRef as unknown as React.Ref<HTMLButtonElement>}
      className="drag-handle thumb__handle"
      aria-label="Geser untuk mengubah urutan halaman"
      title="Geser untuk mengubah urutan halaman"
      data-testid="page-drag-handle"
    >
      ⠿
    </button>
  )
  return (
    <li
      ref={ref as unknown as React.Ref<HTMLLIElement>}
      className={`thumb${isDragging ? ' thumb--dragging' : ''}`}
      data-testid="pdftools-page"
    >
      {children(handle)}
    </li>
  )
}
