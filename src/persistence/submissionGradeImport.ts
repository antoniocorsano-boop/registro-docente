import type { ClassData, Grade, OnlineSubmission, Student } from '../types';

function classMatches(className: string, submissionClass: string): boolean {
  const left = className.toLowerCase();
  const right = submissionClass.toLowerCase();
  return left.includes(right) || right.includes(left);
}

function studentMatches(student: Student, submissionName: string): boolean {
  const left = student.name.toLowerCase().trim();
  const right = submissionName.toLowerCase().trim();
  return left === right || left.includes(right) || right.includes(left);
}

function gradeFromSubmission(
  submission: OnlineSubmission,
  studentId: string,
  targetUdaId?: string
): Grade {
  const grade10 = submission.total > 0
    ? Math.round((submission.score / submission.total) * 10 * 10) / 10
    : 0;

  return {
    id: `online_grade_${submission.id}`,
    batchId: `online_${submission.id}`,
    studentId,
    date: submission.date.slice(0, 10),
    type: 'test',
    period: 'Q1',
    title: `Flashcard: ${submission.testTitle}`,
    value: String(grade10),
    udaId: targetUdaId || submission.testId
  };
}

export function reconcileSubmissionGrades(
  classes: ClassData[],
  submissions: OnlineSubmission[],
  targetUdaId?: string
): { classes: ClassData[]; importedCount: number } {
  let importedCount = 0;

  const nextClasses = classes.map(classData => {
    let grades = [...(classData.grades || [])];

    for (const submission of submissions) {
      if (!classMatches(classData.name, submission.class)) continue;

      const student = classData.students.find(candidate => studentMatches(candidate, submission.name));
      if (!student) continue;

      const nextGrade = gradeFromSubmission(submission, student.id, targetUdaId);
      grades = grades.filter(grade => grade.batchId !== nextGrade.batchId);
      grades.push(nextGrade);
      importedCount += 1;
    }

    return {
      ...classData,
      grades
    };
  });

  return {
    classes: nextClasses,
    importedCount
  };
}
