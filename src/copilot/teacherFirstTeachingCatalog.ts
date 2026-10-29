import type { ClassData, UdaRecord } from '../types';
import { parseLowerSecondaryClassSemanticKey } from '../teaching/classIdentity';

export interface TeacherFirstTeachingCatalogClass {
  classId: string;
  label: string;
  semanticKey: string | null;
  aliases: string[];
  udaIds: string[];
}

export interface TeacherFirstTeachingCatalogAmbiguity {
  semanticKey: string;
  classIds: string[];
  candidates: Array<{ classId: string; label: string }>;
  udaIds: string[];
}

export interface TeacherFirstTeachingCatalog {
  classes: TeacherFirstTeachingCatalogClass[];
  ambiguities: TeacherFirstTeachingCatalogAmbiguity[];
  unresolvedUdaIds: string[];
  udasById: Map<string, UdaRecord>;
}

export interface BuildTeacherFirstTeachingCatalogInput {
  classes: ClassData[];
  udas: UdaRecord[];
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

export function buildTeacherFirstTeachingCatalog({
  classes,
  udas
}: BuildTeacherFirstTeachingCatalogInput): TeacherFirstTeachingCatalog {
  const realClassesById = new Map<string, ClassData>();
  for (const classData of classes) {
    if (!realClassesById.has(classData.id)) realClassesById.set(classData.id, classData);
  }

  const semanticClassGroups = new Map<string, ClassData[]>();
  for (const classData of realClassesById.values()) {
    const semanticKey = parseLowerSecondaryClassSemanticKey(classData.name);
    if (!semanticKey) continue;
    const group = semanticClassGroups.get(semanticKey) ?? [];
    group.push(classData);
    semanticClassGroups.set(semanticKey, group);
  }

  const ambiguousSemanticKeys = new Set(
    Array.from(semanticClassGroups.entries())
      .filter(([, group]) => new Set(group.map(item => item.id)).size > 1)
      .map(([semanticKey]) => semanticKey)
  );

  const entriesById = new Map<string, TeacherFirstTeachingCatalogClass>();
  for (const classData of realClassesById.values()) {
    const semanticKey = parseLowerSecondaryClassSemanticKey(classData.name);
    if (semanticKey && ambiguousSemanticKeys.has(semanticKey)) continue;
    entriesById.set(classData.id, {
      classId: classData.id,
      label: classData.name,
      semanticKey,
      aliases: [classData.name],
      udaIds: []
    });
  }

  const ambiguities = Array.from(ambiguousSemanticKeys)
    .sort()
    .map(semanticKey => {
      const group = semanticClassGroups.get(semanticKey) ?? [];
      return {
        semanticKey,
        classIds: group.map(item => item.id),
        candidates: group.map(item => ({ classId: item.id, label: item.name })),
        udaIds: [] as string[]
      };
    });
  const ambiguitiesByKey = new Map(ambiguities.map(item => [item.semanticKey, item]));

  const unresolvedUdaIds: string[] = [];
  for (const uda of udas) {
    const exactCandidates = Array.from(realClassesById.values()).filter(
      classData => classData.name === uda.className
    );
    if (exactCandidates.length === 1) {
      const exact = exactCandidates[0];
      const semanticKey = parseLowerSecondaryClassSemanticKey(exact.name);
      if (semanticKey && ambiguousSemanticKeys.has(semanticKey)) {
        ambiguitiesByKey.get(semanticKey)?.udaIds.push(uda.id);
        continue;
      }
      const entry = entriesById.get(exact.id);
      if (entry) {
        entry.udaIds.push(uda.id);
        entry.aliases = uniqueStrings([...entry.aliases, uda.className]);
        continue;
      }
    }

    const semanticKey = parseLowerSecondaryClassSemanticKey(uda.className);
    if (!semanticKey) {
      unresolvedUdaIds.push(uda.id);
      continue;
    }

    if (ambiguousSemanticKeys.has(semanticKey)) {
      ambiguitiesByKey.get(semanticKey)?.udaIds.push(uda.id);
      continue;
    }

    const group = semanticClassGroups.get(semanticKey) ?? [];
    if (group.length !== 1) {
      unresolvedUdaIds.push(uda.id);
      continue;
    }

    const entry = entriesById.get(group[0].id);
    if (!entry) {
      unresolvedUdaIds.push(uda.id);
      continue;
    }
    entry.udaIds.push(uda.id);
    entry.aliases = uniqueStrings([...entry.aliases, uda.className]);
  }

  const catalogClasses = Array.from(entriesById.values())
    .map(entry => ({ ...entry, udaIds: uniqueStrings(entry.udaIds) }))
    .sort((left, right) => left.label.localeCompare(right.label, 'it'));

  return {
    classes: catalogClasses,
    ambiguities: ambiguities.map(item => ({ ...item, udaIds: uniqueStrings(item.udaIds) })),
    unresolvedUdaIds: uniqueStrings(unresolvedUdaIds),
    udasById: new Map(udas.map(uda => [uda.id, uda]))
  };
}

export function udasForCanonicalClass(
  catalog: TeacherFirstTeachingCatalog,
  classId: string
): UdaRecord[] {
  const entry = catalog.classes.find(candidate => candidate.classId === classId);
  if (!entry) return [];
  return entry.udaIds
    .map(udaId => catalog.udasById.get(udaId))
    .filter((uda): uda is UdaRecord => Boolean(uda));
}
