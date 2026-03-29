const sizeParser = (item) => {
  if (typeof item !== 'string') {
    return []; // yoki xato qaytaring: throw new Error('item string emas');
  }

  const regex = /\d+\.*\d*/g;
  const matches = item.match(regex);
  if (matches) {
    return matches.map((match) => parseFloat(match));
  }
  return [];
};

export default sizeParser;
