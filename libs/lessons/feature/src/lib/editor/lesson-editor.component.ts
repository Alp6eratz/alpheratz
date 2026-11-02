// Редактор урока (только администратор): параметры урока и список материалов
// с добавлением, изменением, удалением и сортировкой.
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { formatFileSize, MediaStore } from '@lingua/core/data-access';
import { LessonsFacade } from '@lingua/lessons/data-access';
import { LessonMaterial, MATERIAL_TYPES, MaterialType } from '@lingua/shared/models';
import { DialogService } from '@lingua/shared/ui';
import {
  MaterialFormData,
  MaterialFormDialog,
  MaterialFormResult,
} from '../shared/material-form.dialog';

@Component({
  selector: 'lv-lesson-editor',
  imports: [
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatSlideToggleModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './lesson-editor.component.html',
  styleUrl: './lesson-editor.component.scss',
})
export class LessonEditorComponent {
  readonly facade = inject(LessonsFacade);
  private readonly dialog = inject(MatDialog);
  private readonly dialogs = inject(DialogService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly media = inject(MediaStore);
  readonly types = MATERIAL_TYPES;
  readonly typeList = Object.entries(MATERIAL_TYPES).map(([key, v]) => ({
    key: key as MaterialType,
    ...v,
  }));
  readonly formatSize = formatFileSize;

  /** Id урока из маршрута. */
  readonly id = input.required<string>();
  readonly lesson = computed(() => this.facade.lesson(this.id()));

  /** Сохраняет поле урока. */
  update(changes: {
    title?: string;
    description?: string;
    published?: boolean;
    requireNote?: boolean;
  }): void {
    if (changes.title !== undefined && !changes.title.trim()) return;
    this.facade.updateLesson(this.id(), changes);
  }

  /** Открывает диалог добавления материала нужного типа. */
  add(type: MaterialType): void {
    this.openForm({ type }).subscribe(async (result) => {
      if (!result) return;
      await this.facade.addMaterial(this.id(), result.material, result.file);
      this.snackBar.open('Материал добавлен', 'OK', { duration: 2000 });
    });
  }

  /** Редактирование материала. */
  edit(material: LessonMaterial): void {
    this.openForm({ material }).subscribe(async (result) => {
      if (!result) return;
      // Если файл заменён ссылкой — удаляем старый файл из хранилища.
      if (material.mediaId && !result.material.mediaId && !result.file)
        await this.media.remove(material.mediaId);
      await this.facade.updateMaterial(
        this.id(),
        { ...result.material, id: material.id },
        result.file,
      );
    });
  }

  /** Удаление материала после подтверждения. */
  remove(material: LessonMaterial): void {
    this.dialogs
      .confirm({
        title: 'Удалить материал?',
        message: `«${material.title}» будет удалён из урока.`,
        confirmText: 'Удалить',
        danger: true,
      })
      .subscribe(() => this.facade.removeMaterial(this.id(), material));
  }

  private openForm(data: MaterialFormData) {
    return this.dialog
      .open<MaterialFormDialog, MaterialFormData, MaterialFormResult>(MaterialFormDialog, {
        data,
        maxWidth: '96vw',
      })
      .afterClosed();
  }
}
