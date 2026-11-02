// Файловый проводник: дерево папок и заметок с контекстным меню (создать, переименовать, удалить, переместить).
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { VaultFacade } from '@lingua/core/data-access';
import { FileTreeNode } from '@lingua/shared/models';
import { DialogService } from '@lingua/shared/ui';

@Component({
  selector: 'lv-file-explorer',
  imports: [NgTemplateOutlet, MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './file-explorer.component.html',
  styleUrl: './views.scss',
})
export class FileExplorerComponent {
  readonly vault = inject(VaultFacade);
  private readonly dialogs = inject(DialogService);
  private readonly snackBar = inject(MatSnackBar);

  /** Множество свёрнутых папок (по умолчанию всё развёрнуто). */
  readonly collapsed = signal<ReadonlySet<string>>(new Set());
  /** Узел, для которого открыто контекстное меню. */
  readonly menuNode = signal<FileTreeNode | null>(null);
  /** Id активной заметки для подсветки. */
  readonly activeId = computed(() => this.vault.activeNote()?.id ?? null);

  /** Сворачивает/разворачивает папку. */
  toggle(path: string): void {
    this.collapsed.update((set) => {
      const next = new Set(set);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  /** Сворачивает все папки. */
  collapseAll(): void {
    this.collapsed.set(new Set(this.vault.folders()));
  }

  /** Создаёт заметку в папке. */
  newNote(folder = ''): void {
    this.vault.createNote({ title: 'Без названия', folder });
  }

  /** Создаёт папку (можно вложенную через «/»). */
  newFolder(parent = ''): void {
    this.dialogs
      .prompt({
        title: 'Новая папка',
        label: 'Название',
        confirmText: 'Создать',
        hint: 'Вложенность через «/»',
      })
      .subscribe((name) => this.vault.createFolder(parent ? `${parent}/${name}` : name));
  }

  /** Переименовывает заметку. */
  rename(node: FileTreeNode): void {
    this.dialogs
      .prompt({
        title: 'Переименовать заметку',
        label: 'Заголовок',
        value: node.name,
        confirmText: 'Сохранить',
      })
      .subscribe((title) => {
        if (!this.vault.rename(node.key, title)) {
          this.snackBar.open('Заметка с таким названием уже существует', 'OK', { duration: 3000 });
        }
      });
  }

  /** Перемещает заметку в выбранную папку. */
  move(node: FileTreeNode, folder: string): void {
    this.vault.move(node.key, folder);
  }

  /** Удаляет заметку или папку после подтверждения. */
  remove(node: FileTreeNode): void {
    const isFolder = node.kind === 'folder';
    this.dialogs
      .confirm({
        title: isFolder ? 'Удалить папку?' : 'Удалить заметку?',
        message: isFolder
          ? `Папка «${node.name}» и все заметки в ней будут удалены.`
          : `Заметка «${node.name}» будет удалена без возможности восстановления.`,
        confirmText: 'Удалить',
        danger: true,
      })
      .subscribe(() =>
        isFolder ? this.vault.deleteFolder(node.key) : this.vault.delete(node.key),
      );
  }

  /** Перетаскивание: начало — запоминаем id заметки. */
  onDragStart(event: DragEvent, node: FileTreeNode): void {
    if (node.kind === 'note') event.dataTransfer?.setData('text/lv-note', node.key);
  }

  /** Перетаскивание: бросили на папку — перемещаем заметку. */
  onDrop(event: DragEvent, folder: string): void {
    const id = event.dataTransfer?.getData('text/lv-note');
    if (id) {
      event.preventDefault();
      event.stopPropagation();
      this.vault.move(id, folder);
    }
  }
}
