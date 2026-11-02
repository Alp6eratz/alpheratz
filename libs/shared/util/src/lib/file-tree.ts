// Построение дерева папок и заметок для файлового проводника.
import { FileTreeNode, Note } from '@lingua/shared/models';

/** Строит отсортированное дерево (папки сверху, затем заметки по алфавиту). */
export function buildFileTree(notes: Note[], extraFolders: string[] = []): FileTreeNode[] {
  const root: FileTreeNode = { kind: 'folder', name: '', key: '', children: [] };

  // Находит или создаёт папку по пути «A/B/C».
  const ensureFolder = (path: string): FileTreeNode => {
    if (!path) return root;
    let current = root;
    let accumulated = '';
    for (const part of path.split('/').filter(Boolean)) {
      accumulated = accumulated ? `${accumulated}/${part}` : part;
      let next = current.children.find((c) => c.kind === 'folder' && c.key === accumulated);
      if (!next) {
        next = { kind: 'folder', name: part, key: accumulated, children: [] };
        current.children.push(next);
      }
      current = next;
    }
    return current;
  };

  extraFolders.forEach(ensureFolder);
  for (const note of notes) {
    ensureFolder(note.folder).children.push({
      kind: 'note',
      name: note.title,
      key: note.id,
      children: [],
    });
  }

  // Рекурсивная сортировка узлов.
  const sort = (nodes: FileTreeNode[]): FileTreeNode[] =>
    nodes
      .sort((a, b) =>
        a.kind !== b.kind ? (a.kind === 'folder' ? -1 : 1) : a.name.localeCompare(b.name, 'ru'),
      )
      .map((n) => ({ ...n, children: sort(n.children) }));

  return sort(root.children);
}

/** Возвращает все пути папок (включая родительские) из списка заметок. */
export function collectFolders(notes: Note[]): string[] {
  const folders = new Set<string>();
  for (const note of notes) {
    const parts = note.folder.split('/').filter(Boolean);
    parts.forEach((_, i) => folders.add(parts.slice(0, i + 1).join('/')));
  }
  return [...folders].sort();
}
