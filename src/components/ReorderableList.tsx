'use client'

import type { ReactNode } from 'react'
import { DragDropProvider, type DragEndEvent } from '@dnd-kit/react'
import { useSortable, isSortable } from '@dnd-kit/react/sortable'

interface Item {
  id: string
}

interface ReorderableListProps<T extends Item> {
  items: T[]
  onReorder: (from: number, to: number) => void
  renderItem: (item: T, index: number, handle: ReactNode) => ReactNode
  className?: string
}

/**
 * Daftar yang dapat diurutkan dengan drag-and-drop (Fase 5).
 * Tombol naik/turun tetap tersedia terpisah untuk aksesibilitas.
 */
export function ReorderableList<T extends Item>({
  items,
  onReorder,
  renderItem,
  className,
}: ReorderableListProps<T>) {
  return (
    <DragDropProvider
      onDragEnd={(event: DragEndEvent) => {
        const { source, target } = event.operation
        if (!isSortable(source) || !isSortable(target)) return
        const from = source.index
        const to = target.index
        if (typeof from === 'number' && typeof to === 'number') onReorder(from, to)
      }}
    >
      <ol className={className} data-testid="queue">
        {items.map((item, index) => (
          <SortableRow key={item.id} id={item.id} index={index}>
            {(handle) => renderItem(item, index, handle)}
          </SortableRow>
        ))}
      </ol>
    </DragDropProvider>
  )
}

function SortableRow({
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
      className="drag-handle"
      aria-label={`Geser untuk mengubah urutan`}
      title="Geser untuk mengubah urutan"
      data-testid="drag-handle"
    >
      ⠿
    </button>
  )
  return (
    <li
      ref={ref as unknown as React.Ref<HTMLLIElement>}
      className={`queue__item${isDragging ? ' queue__item--dragging' : ''}`}
      data-testid="queue-item"
    >
      {children(handle)}
    </li>
  )
}
