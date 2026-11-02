// Список уроков. Студент видит прогресс курса и заблокированные уроки,
// администратор — все уроки (включая черновики) и кнопки управления.
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LessonsFacade } from '@lingua/lessons/data-access';
import { Lesson, MATERIAL_TYPES } from '@lingua/shared/models';
import { DialogService } from '@lingua/shared/ui';

@Component({
  selector: 'lv-lessons-list',
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatProgressBarModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './lessons-list.component.html',
  styleUrl: './lessons-list.component.scss',
})
export class LessonsListComponent {
  readonly facade = inject(LessonsFacade);
  private readonly dialogs = inject(DialogService);
  private readonly router = inject(Router);
  readonly types = MATERIAL_TYPES;

  /** Уникальные типы материалов урока (для иконок). */
  materialTypes(lesson: Lesson) {
    return [...new Set(lesson.materials.map((m) => m.type))];
  }

  /** Создание нового урока и переход в редактор. */
  create(): void {
    this.dialogs
      .prompt({ title: 'Новый урок', label: 'Название урока', confirmText: 'Создать' })
      .subscribe((title) => {
        const lesson = this.facade.createLesson(title);
        this.router.navigate(['/lessons', lesson.id, 'edit']);
      });
  }

  /** Удаление урока после подтверждения. */
  remove(lesson: Lesson): void {
    this.dialogs
      .confirm({
        title: 'Удалить урок?',
        message: `Урок «${lesson.title}», его материалы, прогресс и заметки студентов будут удалены.`,
        confirmText: 'Удалить',
        danger: true,
      })
      .subscribe(() => this.facade.deleteLesson(lesson.id));
  }
}
