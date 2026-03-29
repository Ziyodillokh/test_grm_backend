function paginateArray(array: any[], page: number, limit: number) {
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;

  return array
    .sort((a: { date: string | number | Date }, b: { date: string | number | Date }) =>
      new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(startIndex, endIndex);
}

export default paginateArray;
