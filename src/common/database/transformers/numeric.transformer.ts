export class NumericTransformer {
  to(value: number): number {
    return value;
  }

  from(value: string): number {
    return value ? parseFloat(value) : 0;
  }
}

export function numericColumn(precision = 20, scale = 2, defaultValue = 0) {
  return {
    type: 'numeric' as const,
    precision,
    scale,
    transformer: new NumericTransformer(),
    default: defaultValue,
  };
}
